"""Formulário de Encaminhamento Geral: pedidos de exame, PDF e configuração.

- `/encaminhamentos/formulario`: campos e exames ativos (a tela monta o
  formulário a partir daqui).
- Pedidos: criar, listar, ver, exportar, PDF e dados do laboratório.
- `/encaminhamentos/config/...` (admin): manter campos e exames.

Cada pedido guarda a cópia dos campos e exames como estavam no envio, então
mudar o formulário nunca altera nem quebra um pedido já feito.
"""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..encaminhamento_catalogo import GRUPOS, REVISAO, SIGLAS, TUBOS
from ..encaminhamento_pdf import gerar_pdf
from ..models import CampoEncaminhamento, Clinica, Encaminhamento, ExameEncaminhamento, Usuario
from ..ordenacao import MAX_EXPORTACAO, ordenar
from ..reports import descrever_filtros, lista_xlsx
from ..security import exige_admin, usuario_atual
from .. import listas_lis
from ..xlsx_resposta import _xlsx

router = APIRouter(prefix="/encaminhamentos", tags=["encaminhamentos"])

TIPOS = {"texto", "texto_longo", "data", "numero", "opcao", "marcar", "clinica"}
SECOES = {"laudo", "motivo", "laboratorio"}
_BRASILIA = timezone(timedelta(hours=-3))


# ------------------------------------------------------------------ schemas

class CampoOut(BaseModel):
    model_config = {"from_attributes": True}
    id: str
    chave: str
    rotulo: str
    secao: str
    tipo: str
    opcoes: list
    obrigatorio: bool
    mostrar_se: str
    largura: int
    ajuda: str
    ordem: int
    ativo: bool
    do_papel: bool


class ExameOut(BaseModel):
    model_config = {"from_attributes": True}
    id: str
    codigo: str
    nome: str
    descricao: str
    grupo: str
    tubos: list
    amostra: str
    selo: str
    destaque: bool
    marca: str
    inclui: list
    ordem: int
    ativo: bool
    do_papel: bool


class FormularioOut(BaseModel):
    versao: str
    grupos: list
    campos: list[CampoOut]
    exames: list[ExameOut]
    siglas: dict
    tubos: dict
    racas: list = []
    especies: list = []


class PedidoIn(BaseModel):
    dados: dict = Field(default_factory=dict)
    exames: list[str] = Field(default_factory=list, max_length=200)
    clinica_id: str | None = None


class LaboratorioIn(BaseModel):
    data_chegada: date | None = None
    n_amostras: int | None = Field(None, ge=0, le=999)
    recebido_por: str = Field("", max_length=120)


class PedidoResumo(BaseModel):
    id: str
    numero: int
    clinica: str
    paciente: str
    veterinario: str
    data_coleta: date | None
    urgente: bool
    codigos: list[str]
    criado_por: str
    created_at: datetime
    recebido: bool


class PedidoOut(PedidoResumo):
    responsavel: str
    dados: dict
    campos: list
    exames: list
    versao: str


class PedidoPage(BaseModel):
    total: int
    page: int
    per_page: int
    items: list[PedidoResumo]


class CampoIn(BaseModel):
    chave: str | None = Field(None, pattern=r"^[a-z][a-z0-9_]{1,59}$")
    rotulo: str | None = Field(None, min_length=1, max_length=160)
    secao: str | None = None
    tipo: str | None = None
    opcoes: list | None = None
    obrigatorio: bool | None = None
    mostrar_se: str | None = Field(None, max_length=80)
    largura: int | None = Field(None, ge=1, le=4)
    ajuda: str | None = Field(None, max_length=200)
    ordem: int | None = None
    ativo: bool | None = None


class ExameIn(BaseModel):
    codigo: str | None = Field(None, pattern=r"^[0-9A-Za-z]{1,10}$")
    nome: str | None = Field(None, min_length=1, max_length=200)
    descricao: str | None = None
    grupo: str | None = None
    tubos: list[str] | None = None
    amostra: str | None = Field(None, max_length=40)
    selo: str | None = Field(None, max_length=20)
    destaque: bool | None = None
    inclui: list[str] | None = None
    ordem: int | None = None
    ativo: bool | None = None


# ----------------------------------------------------------------- regras

def _visivel(campo: CampoEncaminhamento, dados: dict) -> bool:
    """`mostrar_se`: "especie=outros" (valor igual) ou "recoleta" (marcado)."""
    regra = (campo.mostrar_se or "").strip()
    if not regra:
        return True
    if "=" in regra:
        chave, valor = regra.split("=", 1)
        return str(dados.get(chave.strip(), "")) == valor.strip()
    return bool(dados.get(regra))


def _vazio(v) -> bool:
    return v is None or v == "" or v is False or v == []


def _normalizar(campo: CampoEncaminhamento, valor):
    """Valida e converte o valor; devolve (valor, texto legível)."""
    if _vazio(valor):
        return None, ""
    t = campo.tipo
    if t == "marcar":
        return True, "Sim"
    if t == "numero":
        try:
            n = float(str(valor).replace(",", "."))
        except ValueError:
            raise HTTPException(422, f"{campo.rotulo}: informe um número")
        n = int(n) if n.is_integer() else n
        return n, str(n).replace(".", ",")
    if t == "data":
        try:
            d = date.fromisoformat(str(valor)[:10])
        except ValueError:
            raise HTTPException(422, f"{campo.rotulo}: data inválida")
        return d.isoformat(), d.strftime("%d/%m/%Y")
    if t == "opcao":
        rotulos = {o.get("valor"): o.get("rotulo") for o in campo.opcoes or []}
        if str(valor) not in rotulos:
            raise HTTPException(422, f"{campo.rotulo}: opção inválida")
        return str(valor), rotulos[str(valor)]
    texto = str(valor).strip()[:2000]
    return texto, texto


def _resumo(e: Encaminhamento) -> dict:
    return {
        "id": e.id, "numero": e.numero, "clinica": e.clinica, "paciente": e.paciente,
        "veterinario": e.veterinario, "data_coleta": e.data_coleta, "urgente": e.urgente,
        "codigos": [x["codigo"] for x in e.exames or []], "criado_por": e.criado_por,
        "created_at": e.created_at, "recebido": bool((e.dados or {}).get("data_chegada")),
    }


def _detalhe(e: Encaminhamento) -> PedidoOut:
    return PedidoOut(**_resumo(e), responsavel=e.responsavel, dados=e.dados or {},
                     campos=e.campos or [], exames=e.exames or [], versao=e.versao)


def _pedido_ou_404(db: Session, pedido_id: str) -> Encaminhamento:
    e = db.get(Encaminhamento, pedido_id)
    if e is None:
        raise HTTPException(404, "Pedido não encontrado")
    return e


# -------------------------------------------------------------- formulário

@router.get("/formulario", response_model=FormularioOut)
def formulario(db: Session = Depends(get_db)):
    campos = db.scalars(
        select(CampoEncaminhamento).where(CampoEncaminhamento.ativo.is_(True))
        .order_by(CampoEncaminhamento.ordem)
    ).all()
    exames = db.scalars(
        select(ExameEncaminhamento).where(ExameEncaminhamento.ativo.is_(True))
        .order_by(ExameEncaminhamento.ordem)
    ).all()
    return FormularioOut(versao=REVISAO, grupos=GRUPOS, campos=campos, exames=exames,
                         siglas=SIGLAS, tubos=TUBOS, racas=listas_lis.racas(),
                         especies=listas_lis.especies())


# ------------------------------------------------------------------ pedidos

@router.post("", response_model=PedidoOut, status_code=201)
def criar_pedido(body: PedidoIn, db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_atual)):
    campos = db.scalars(
        select(CampoEncaminhamento).where(CampoEncaminhamento.ativo.is_(True))
        .order_by(CampoEncaminhamento.ordem)
    ).all()
    dados, copia, faltando = {}, [], []
    for c in campos:
        if c.secao == "laboratorio" or not _visivel(c, body.dados):
            continue
        valor, texto = _normalizar(c, body.dados.get(c.chave))
        if valor is None:
            if c.obrigatorio:
                faltando.append(c.rotulo)
            continue
        dados[c.chave] = valor
        copia.append({"chave": c.chave, "rotulo": c.rotulo, "secao": c.secao, "valor": valor, "texto": texto})
    if faltando:
        raise HTTPException(422, "Preencha: " + ", ".join(faltando))

    # Códigos do LIS (para integração): espécie e raça, quando casam com a lista.
    nome_especie = {"canino": "Canino", "felino": "Felino"}.get(str(dados.get("especie", "")))
    nome_especie = nome_especie or str(dados.get("especie_outro") or "")
    if nome_especie and (cod := listas_lis.codigo("especies", nome_especie)):
        dados["especie_lis"] = cod
    if dados.get("raca") and (cod := listas_lis.codigo("racas", str(dados["raca"]))):
        dados["raca_lis"] = cod

    codigos = list(dict.fromkeys(x.strip() for x in body.exames if x and x.strip()))
    if not codigos:
        raise HTTPException(422, "Marque ao menos um exame")
    cat = {x.codigo: x for x in db.scalars(select(ExameEncaminhamento).where(ExameEncaminhamento.codigo.in_(codigos)))}
    exames = [
        {"codigo": cod, "nome": cat[cod].nome if cod in cat else "Código do portfólio",
         "grupo": cat[cod].grupo if cod in cat else "portfolio"}
        for cod in codigos
    ]

    clinica_id = body.clinica_id if body.clinica_id and db.get(Clinica, body.clinica_id) else None
    data_coleta = date.fromisoformat(dados["data_coleta"]) if dados.get("data_coleta") else None
    for tentativa in range(3):
        numero = (db.scalar(select(func.max(Encaminhamento.numero))) or 0) + 1
        e = Encaminhamento(
            numero=numero, clinica=str(dados.get("clinica", ""))[:200], clinica_id=clinica_id,
            paciente=str(dados.get("paciente", ""))[:160], responsavel=str(dados.get("responsavel", ""))[:160],
            veterinario=str(dados.get("veterinario", ""))[:160], data_coleta=data_coleta,
            urgente=bool(dados.get("exame_urgente")), dados=dados, campos=copia, exames=exames,
            versao=REVISAO, criado_por_id=usuario.id, criado_por=usuario.nome,
        )
        db.add(e)
        try:
            db.commit()
            break
        except IntegrityError:  # dois pedidos ao mesmo tempo: tenta o próximo número
            db.rollback()
            if tentativa == 2:
                raise HTTPException(409, "Não foi possível numerar o pedido; tente de novo")
    db.refresh(e)
    return _detalhe(e)


ORDENAVEIS = {
    "numero": [Encaminhamento.numero],
    "created_at": [Encaminhamento.created_at],
    "data_coleta": [Encaminhamento.data_coleta],
    "clinica": [Encaminhamento.clinica],
    "paciente": [Encaminhamento.paciente],
    "veterinario": [Encaminhamento.veterinario],
    "urgente": [Encaminhamento.urgente],
    "criado_por": [Encaminhamento.criado_por],
}


def _filtrar(stmt, busca, data_de, data_ate, urgente):
    if busca:
        termo = f"%{busca.lower()}%"
        conds = [func.lower(Encaminhamento.clinica).like(termo),
                 func.lower(Encaminhamento.paciente).like(termo),
                 func.lower(Encaminhamento.responsavel).like(termo),
                 func.lower(Encaminhamento.veterinario).like(termo)]
        if busca.strip().isdigit():
            conds.append(Encaminhamento.numero == int(busca.strip()))
        stmt = stmt.where(or_(*conds))
    if data_de:
        stmt = stmt.where(Encaminhamento.created_at >= datetime.combine(data_de, datetime.min.time()))
    if data_ate:
        stmt = stmt.where(Encaminhamento.created_at < datetime.combine(data_ate + timedelta(days=1), datetime.min.time()))
    if urgente:
        stmt = stmt.where(Encaminhamento.urgente.is_(True))
    return stmt


@router.get("", response_model=PedidoPage)
def listar(
    busca: str | None = None,
    data_de: date | None = None,
    data_ate: date | None = None,
    urgente: bool = False,
    sort: str | None = None,
    dir: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    base = _filtrar(select(Encaminhamento), busca, data_de, data_ate, urgente)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    stmt = ordenar(base, sort, dir, ORDENAVEIS, ("numero", "desc"))
    itens = db.scalars(stmt.offset((page - 1) * per_page).limit(per_page)).all()
    return PedidoPage(total=total, page=page, per_page=per_page, items=[_resumo(e) for e in itens])


@router.get("/lista.xlsx")
def exportar_lista(
    busca: str | None = None,
    data_de: date | None = None,
    data_ate: date | None = None,
    urgente: bool = False,
    sort: str | None = None,
    dir: str | None = None,
    db: Session = Depends(get_db),
):
    base = _filtrar(select(Encaminhamento), busca, data_de, data_ate, urgente)
    stmt = ordenar(base, sort, dir, ORDENAVEIS, ("numero", "desc")).limit(MAX_EXPORTACAO)
    linhas = (
        [e.numero, e.created_at, e.clinica, e.paciente, e.responsavel, e.veterinario, e.data_coleta,
         "Sim" if e.urgente else "", ", ".join(x["codigo"] for x in e.exames or []),
         (e.dados or {}).get("data_chegada") or "", e.criado_por]
        for e in db.scalars(stmt)
    )
    conteudo = lista_xlsx(
        "Pedidos de exame — Formulário de Encaminhamento",
        [("Pedido", 10), ("Criado em", 18), ("Clínica", 32), ("Paciente", 20), ("Responsável", 26),
         ("Veterinário", 26), ("Data da coleta", 14), ("Urgente", 9), ("Exames", 40),
         ("Chegada no lab", 14), ("Criado por", 18)],
        linhas,
        descrever_filtros(busca=busca, criado_de=data_de, criado_ate=data_ate, urgente=urgente),
    )
    return _xlsx(conteudo, "pedidos-de-exame")


@router.get("/{pedido_id}", response_model=PedidoOut)
def detalhar(pedido_id: str, db: Session = Depends(get_db)):
    return _detalhe(_pedido_ou_404(db, pedido_id))


@router.get("/{pedido_id}/pdf")
def baixar_pdf(pedido_id: str, db: Session = Depends(get_db)):
    e = _pedido_ou_404(db, pedido_id)
    criado = e.created_at.replace(tzinfo=timezone.utc).astimezone(_BRASILIA) if e.created_at else None
    conteudo = gerar_pdf({
        "numero": e.numero, "campos": e.campos or [], "exames": e.exames or [],
        "criado_em": criado.strftime("%d/%m/%Y %H:%M") if criado else "", "criado_por": e.criado_por,
    })
    nome = f"pedido-{e.numero:08d}.pdf"
    return Response(content=conteudo, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{nome}"'})


@router.patch("/{pedido_id}/laboratorio", response_model=PedidoOut)
def registrar_chegada(pedido_id: str, body: LaboratorioIn, db: Session = Depends(get_db)):
    """'Para uso do laboratório': chegada, nº de amostras e quem recebeu."""
    e = _pedido_ou_404(db, pedido_id)
    dados = dict(e.dados or {})
    copia = [c for c in (e.campos or []) if c.get("secao") != "laboratorio"]
    rotulos = {c.chave: c.rotulo for c in db.scalars(
        select(CampoEncaminhamento).where(CampoEncaminhamento.secao == "laboratorio"))}
    valores = {
        "data_chegada": (body.data_chegada.isoformat(), body.data_chegada.strftime("%d/%m/%Y")) if body.data_chegada else None,
        "n_amostras": (body.n_amostras, str(body.n_amostras)) if body.n_amostras is not None else None,
        "recebido_por": (body.recebido_por.strip(), body.recebido_por.strip()) if body.recebido_por.strip() else None,
    }
    for chave, vt in valores.items():
        dados.pop(chave, None)
        if vt:
            dados[chave] = vt[0]
            copia.append({"chave": chave, "rotulo": rotulos.get(chave, chave), "secao": "laboratorio",
                          "valor": vt[0], "texto": vt[1]})
    e.dados, e.campos = dados, copia
    db.commit()
    db.refresh(e)
    return _detalhe(e)


# ------------------------------------------------------- configuração (admin)

def _validar_campo(dados: dict) -> None:
    if "secao" in dados and dados["secao"] not in SECOES:
        raise HTTPException(422, "Seção inválida")
    if "tipo" in dados and dados["tipo"] not in TIPOS:
        raise HTTPException(422, "Tipo de campo inválido")
    if dados.get("tipo") == "opcao" and "opcoes" in dados and not dados["opcoes"]:
        raise HTTPException(422, "Um campo de opções precisa de ao menos uma opção")
    for o in dados.get("opcoes") or []:
        if not isinstance(o, dict) or not str(o.get("valor", "")).strip() or not str(o.get("rotulo", "")).strip():
            raise HTTPException(422, "Cada opção precisa de valor e rótulo")


@router.get("/config/campos", response_model=list[CampoOut], dependencies=[Depends(exige_admin)])
def config_campos(db: Session = Depends(get_db)):
    return db.scalars(select(CampoEncaminhamento).order_by(CampoEncaminhamento.ordem)).all()


@router.post("/config/campos", response_model=CampoOut, status_code=201, dependencies=[Depends(exige_admin)])
def criar_campo(body: CampoIn, db: Session = Depends(get_db)):
    dados = body.model_dump(exclude_none=True)
    if not dados.get("chave") or not dados.get("rotulo"):
        raise HTTPException(422, "Informe a chave e o rótulo do campo")
    dados.setdefault("tipo", "texto")
    dados.setdefault("secao", "laudo")
    _validar_campo(dados)
    if db.scalar(select(CampoEncaminhamento).where(CampoEncaminhamento.chave == dados["chave"])):
        raise HTTPException(409, "Já existe um campo com essa chave")
    if "ordem" not in dados:
        dados["ordem"] = (db.scalar(select(func.max(CampoEncaminhamento.ordem))) or 0) + 10
    c = CampoEncaminhamento(**dados, do_papel=False)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.patch("/config/campos/{campo_id}", response_model=CampoOut, dependencies=[Depends(exige_admin)])
def editar_campo(campo_id: str, body: CampoIn, db: Session = Depends(get_db)):
    c = db.get(CampoEncaminhamento, campo_id)
    if c is None:
        raise HTTPException(404, "Campo não encontrado")
    dados = body.model_dump(exclude_unset=True)
    if c.do_papel and any(k in dados for k in ("chave", "tipo")):
        raise HTTPException(422, "Campos do formulário impresso não mudam de chave nem de tipo (o PDF depende deles)")
    if "chave" in dados and dados["chave"] != c.chave and db.scalar(
            select(CampoEncaminhamento).where(CampoEncaminhamento.chave == dados["chave"])):
        raise HTTPException(409, "Já existe um campo com essa chave")
    _validar_campo({**{"tipo": c.tipo}, **dados})
    for k, v in dados.items():
        if v is not None:
            setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/config/campos/{campo_id}", status_code=204, dependencies=[Depends(exige_admin)])
def excluir_campo(campo_id: str, db: Session = Depends(get_db)):
    c = db.get(CampoEncaminhamento, campo_id)
    if c is None:
        raise HTTPException(404, "Campo não encontrado")
    if c.do_papel:
        raise HTTPException(422, "Campo do formulário impresso: desative em vez de excluir")
    db.delete(c)  # pedidos antigos guardam a própria cópia do campo
    db.commit()
    return Response(status_code=204)


@router.get("/config/exames", response_model=list[ExameOut], dependencies=[Depends(exige_admin)])
def config_exames(db: Session = Depends(get_db)):
    return db.scalars(select(ExameEncaminhamento).order_by(ExameEncaminhamento.ordem)).all()


@router.post("/config/exames", response_model=ExameOut, status_code=201, dependencies=[Depends(exige_admin)])
def criar_exame(body: ExameIn, db: Session = Depends(get_db)):
    dados = body.model_dump(exclude_none=True)
    if not dados.get("codigo") or not dados.get("nome"):
        raise HTTPException(422, "Informe o código e o nome do exame")
    if db.scalar(select(ExameEncaminhamento).where(ExameEncaminhamento.codigo == dados["codigo"])):
        raise HTTPException(409, "Já existe um exame com esse código")
    if dados.get("grupo") and dados["grupo"] not in {g["id"] for g in GRUPOS}:
        raise HTTPException(422, "Grupo inválido")
    if "ordem" not in dados:
        dados["ordem"] = (db.scalar(select(func.max(ExameEncaminhamento.ordem))) or 0) + 10
    dados.setdefault("grupo", "fast_track")
    x = ExameEncaminhamento(**dados, do_papel=False)
    db.add(x)
    db.commit()
    db.refresh(x)
    return x


@router.patch("/config/exames/{exame_id}", response_model=ExameOut, dependencies=[Depends(exige_admin)])
def editar_exame(exame_id: str, body: ExameIn, db: Session = Depends(get_db)):
    x = db.get(ExameEncaminhamento, exame_id)
    if x is None:
        raise HTTPException(404, "Exame não encontrado")
    dados = body.model_dump(exclude_unset=True)
    if x.do_papel and "codigo" in dados and dados["codigo"] != x.codigo:
        raise HTTPException(422, "Exame do formulário impresso não muda de código (o PDF depende dele)")
    if dados.get("grupo") and dados["grupo"] not in {g["id"] for g in GRUPOS}:
        raise HTTPException(422, "Grupo inválido")
    if "codigo" in dados and dados["codigo"] != x.codigo and db.scalar(
            select(ExameEncaminhamento).where(ExameEncaminhamento.codigo == dados["codigo"])):
        raise HTTPException(409, "Já existe um exame com esse código")
    for k, v in dados.items():
        if v is not None:
            setattr(x, k, v)
    db.commit()
    db.refresh(x)
    return x


@router.delete("/config/exames/{exame_id}", status_code=204, dependencies=[Depends(exige_admin)])
def excluir_exame(exame_id: str, db: Session = Depends(get_db)):
    x = db.get(ExameEncaminhamento, exame_id)
    if x is None:
        raise HTTPException(404, "Exame não encontrado")
    if x.do_papel:
        raise HTTPException(422, "Exame do formulário impresso: desative em vez de excluir")
    db.delete(x)
    db.commit()
    return Response(status_code=204)


# ------------------------------------------------------------ carga inicial

def semear(db: Session) -> None:
    """Carrega os campos e exames do papel na primeira subida (idempotente:
    só insere o que ainda não existe, sem desfazer edições da equipe)."""
    from ..encaminhamento_campos import CAMPOS, FORA_DO_IMPRESSO
    from ..encaminhamento_catalogo import EXAMES
    from ..models import Migracao

    existentes = set(db.scalars(select(CampoEncaminhamento.chave)))
    for i, c in enumerate(CAMPOS):
        if c["chave"] not in existentes:
            db.add(CampoEncaminhamento(**c, ordem=(i + 1) * 10, do_papel=True))
    existentes = set(db.scalars(select(ExameEncaminhamento.codigo)))
    for i, e in enumerate(EXAMES):
        if e["codigo"] not in existentes:
            dados = {k: v for k, v in e.items() if k != "caixa"}
            db.add(ExameEncaminhamento(**dados, ordem=(i + 1) * 10, do_papel=True))
    # Impresso atual (sem "Categoria do plano" e sem os "Nº guia"): roda uma vez.
    if not db.get(Migracao, "encaminhamento_impresso_v2"):
        db.flush()  # banco novo: os campos acabaram de ser incluídos
        for campo in db.scalars(select(CampoEncaminhamento).where(
                CampoEncaminhamento.chave.in_(FORA_DO_IMPRESSO))):
            campo.ativo = False
        db.add(Migracao(chave="encaminhamento_impresso_v2"))
    db.commit()
