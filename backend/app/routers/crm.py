"""CRM: contas (clínicas e leads), funil, atividades e importação do Pocket."""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..crm_constantes import (
    ETAPAS,
    ETAPAS_SAIDA,
    TEMPERATURAS,
    TIPO_SISTEMA,
    TIPOS_ATIVIDADE,
)
from ..database import get_db
from ..models import (
    Atividade,
    Clinica,
    ClinicaLaboratorio,
    Laboratorio,
    Portador,
    Regiao,
    TransferenciaPortador,
    Usuario,
)
from ..pocket_importer import _vendedor, norm_telefone
from ..pocket_importer import importar_arquivos
from ..schemas import (
    AtividadeIn,
    AtividadeOut,
    ContaCreate,
    ContaDetalheOut,
    ContaOut,
    ContaPage,
    ContaUpdate,
    CrmContagem,
    CrmFiltrosOut,
    CrmFunilOut,
    CrmImportResult,
    CrmOpcao,
    CrmResumoOut,
    EtapaContagem,
    RankingLinha,
    RankingOut,
)
from ..security import exige_admin, usuario_atual

router = APIRouter(prefix="/crm", tags=["crm"])

_EXTENSOES = (".csv", ".xlsx", ".xlsm")
_MAX_BYTES = 20 * 1024 * 1024
# Brasil sem horário de verão desde 2019: UTC-3 fixo dispensa tzdata.
_BRASILIA = timezone(timedelta(hours=-3))


def _agora_brasilia() -> datetime:
    return datetime.now(_BRASILIA)


def _conta_out(c: Clinica, modelo=ContaOut):
    dados = {k: getattr(c, k) for k in modelo.model_fields if k not in ("regiao", "laboratorios")}
    dados["regiao"] = c.regiao.nome if c.regiao else ""
    dados["laboratorios"] = sorted(lab.nome for lab in c.laboratorios)
    return modelo(**dados)


def _conta_ou_404(db: Session, conta_id: str) -> Clinica:
    c = db.get(Clinica, conta_id)
    if c is None or not c.etapa:
        raise HTTPException(404, "Conta não encontrada")
    return c


def _validar(valor: str | None, permitidos, nome: str) -> None:
    if valor and valor not in permitidos:
        raise HTTPException(422, f"{nome} inválido(a): {valor}")


def _registrar(db: Session, c: Clinica, usuario: Usuario | None, tipo: str, descricao: str,
               quando: datetime | None = None, hora: str = "") -> Atividade:
    agora = _agora_brasilia()
    quando = quando or agora
    at = Atividade(
        clinica_id=c.id,
        tipo=tipo,
        descricao=descricao,
        data=quando.date(),
        hora=hora or quando.strftime("%H:%M"),
        usuario_id=usuario.id if usuario else None,
        usuario_nome=usuario.nome if usuario else "",
    )
    db.add(at)
    c.ultima_atividade_em = datetime.now(timezone.utc).replace(tzinfo=None)
    return at


def _regiao(db: Session, nome: str | None) -> Regiao | None:
    if not nome:
        return None
    r = db.scalar(select(Regiao).where(Regiao.nome == nome))
    if r is None:
        raise HTTPException(422, f"Região inexistente: {nome}")
    return r


# ----------------------------------------------------------------- importação

@router.post("/importar-pocket", response_model=CrmImportResult, dependencies=[Depends(exige_admin)])
async def importar_pocket(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    arquivos = []
    for f in files:
        nome = f.filename or "arquivo"
        if not nome.lower().endswith(_EXTENSOES):
            raise HTTPException(400, f"{nome}: envie arquivos .csv ou .xlsx exportados do Pocket")
        conteudo = await f.read()
        if len(conteudo) > _MAX_BYTES:
            raise HTTPException(413, f"{nome}: arquivo maior que 20 MB")
        arquivos.append((nome, conteudo))
    try:
        resultado = importar_arquivos(db, arquivos)
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        raise HTTPException(422, f"Falha ao importar: {exc}") from exc
    return CrmImportResult(arquivos=resultado)


# --------------------------------------------------------------------- contas

def _filtrar(stmt, busca, uso, regiao, vendedor, temperatura):
    stmt = stmt.where(Clinica.etapa != "")  # só contas do CRM
    if uso == "com":
        stmt = stmt.where(Clinica.em_uso.is_(True))
    elif uso == "sem":
        stmt = stmt.where(Clinica.em_uso.is_(False))
    elif uso == "sem_info":
        stmt = stmt.where(Clinica.em_uso.is_(None), Clinica.codigo_pocket.is_not(None))
    if regiao:
        stmt = stmt.join(Regiao, Clinica.regiao_id == Regiao.id).where(Regiao.nome == regiao)
    if vendedor:
        stmt = stmt.where(Clinica.vendedor == vendedor)
    if temperatura:
        stmt = stmt.where(Clinica.temperatura == temperatura)
    if busca:
        termo = f"%{busca.lower()}%"
        digitos = "".join(ch for ch in busca if ch.isdigit())
        conds = [
            func.lower(Clinica.nome).like(termo),
            func.lower(func.coalesce(Clinica.codigo_pocket, "")).like(termo),
            func.lower(Clinica.cidade).like(termo),
            func.lower(Clinica.email).like(termo),
        ]
        if len(digitos) >= 4:
            conds.append(Clinica.telefone_norm.like(f"%{digitos}%"))
        stmt = stmt.where(or_(*conds))
    return stmt


@router.get("/contas", response_model=ContaPage)
def listar_contas(
    busca: str | None = None,
    etapa: str | None = None,
    uso: str | None = None,
    regiao: str | None = None,
    vendedor: str | None = None,
    temperatura: str | None = None,
    ordem: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    base = _filtrar(select(Clinica), busca, uso, regiao, vendedor, temperatura)
    if etapa:
        base = base.where(Clinica.etapa == etapa)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    if ordem == "os":
        base = base.order_by(Clinica.qtd_os_periodo.desc(), Clinica.nome)
    elif ordem == "atividade":
        # Quem está há mais tempo sem contato primeiro (nunca contatado no topo).
        base = base.order_by(Clinica.ultima_atividade_em.asc().nullsfirst(), Clinica.nome)
    elif ordem == "recentes":
        base = base.order_by(Clinica.ultima_atividade_em.desc().nullslast(), Clinica.nome)
    else:
        base = base.order_by(Clinica.nome)
    stmt = (
        base.options(selectinload(Clinica.regiao), selectinload(Clinica.laboratorios))
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    items = [_conta_out(c) for c in db.scalars(stmt)]
    return ContaPage(total=total, page=page, per_page=per_page, items=items)


@router.get("/funil", response_model=CrmFunilOut)
def funil(
    busca: str | None = None,
    uso: str | None = None,
    regiao: str | None = None,
    vendedor: str | None = None,
    temperatura: str | None = None,
    db: Session = Depends(get_db),
):
    """Contagem por etapa com os mesmos filtros da lista (menos a etapa)."""
    base = _filtrar(select(Clinica.etapa), busca, uso, regiao, vendedor, temperatura).subquery()
    contagem = dict(db.execute(select(base.c.etapa, func.count()).group_by(base.c.etapa)).all())
    etapas = [EtapaContagem(etapa=k, label=v, total=contagem.get(k, 0)) for k, v in ETAPAS.items()]
    return CrmFunilOut(total=sum(contagem.values()), etapas=etapas)


@router.post("/contas", response_model=ContaDetalheOut, status_code=201)
def criar_conta(
    dados: ContaCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(usuario_atual),
):
    _validar(dados.etapa, ETAPAS, "Etapa")
    _validar(dados.temperatura, TEMPERATURAS, "Temperatura")
    if dados.etapa in ETAPAS_SAIDA:
        raise HTTPException(422, "Uma conta nova não pode começar como Inativo ou Bloqueado")
    tel = norm_telefone(dados.whatsapp)
    if tel:
        existente = db.scalar(select(Clinica).where(Clinica.telefone_norm == tel, Clinica.etapa != ""))
        if existente is not None:
            raise HTTPException(409, f"Já existe uma conta com este telefone: {existente.nome}")
    c = Clinica(
        nome=dados.nome.strip(),
        origem="manual",
        etapa=dados.etapa,
        etapa_derivada=False,
        temperatura=dados.temperatura,
        whatsapp=dados.whatsapp.strip(),
        telefone_norm=tel,
        email=dados.email.strip(),
        cidade=dados.cidade.strip(),
        uf=dados.uf.strip().upper(),
        vendedor=_vendedor(dados.vendedor),
        captacao=dados.captacao.strip(),
        regiao=_regiao(db, dados.regiao),
    )
    db.add(c)
    db.flush()
    _registrar(db, c, usuario, TIPO_SISTEMA, "Criação do lead" + (f": {dados.observacao.strip()}" if dados.observacao.strip() else ""))
    db.commit()
    db.refresh(c)
    return _conta_out(c, ContaDetalheOut)


@router.get("/contas/{conta_id}", response_model=ContaDetalheOut)
def detalhar_conta(conta_id: str, db: Session = Depends(get_db)):
    return _conta_out(_conta_ou_404(db, conta_id), ContaDetalheOut)


@router.patch("/contas/{conta_id}", response_model=ContaDetalheOut)
def atualizar_conta(
    conta_id: str,
    dados: ContaUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(usuario_atual),
):
    c = _conta_ou_404(db, conta_id)
    campos = dados.model_dump(exclude_unset=True)
    _validar(campos.get("etapa"), ETAPAS, "Etapa")
    _validar(campos.get("temperatura"), TEMPERATURAS, "Temperatura")

    nova_etapa = campos.pop("etapa", None)
    motivo = (campos.pop("motivo_encerramento", None) or "").strip()
    if nova_etapa and nova_etapa != c.etapa:
        if nova_etapa in ETAPAS_SAIDA and not motivo:
            raise HTTPException(422, f"Informe o motivo para mover a conta para {ETAPAS[nova_etapa]}")
        texto = f"Etapa: {ETAPAS.get(c.etapa, c.etapa)} → {ETAPAS[nova_etapa]}"
        if motivo:
            texto += f". Motivo: {motivo}"
        _registrar(db, c, usuario, TIPO_SISTEMA, texto)
        c.etapa = nova_etapa
        c.motivo_encerramento = motivo if nova_etapa in ETAPAS_SAIDA else ""
    elif nova_etapa:
        c.etapa = nova_etapa
    if nova_etapa:
        c.etapa_derivada = False  # alterada à mão: a importação não mexe mais

    if "regiao" in campos:
        c.regiao = _regiao(db, campos.pop("regiao"))
    if "whatsapp" in campos:
        c.whatsapp = (campos.pop("whatsapp") or "").strip()
        c.telefone_norm = norm_telefone(c.whatsapp)
    if "vendedor" in campos:
        c.vendedor = _vendedor(campos.pop("vendedor") or "")
    if "uf" in campos:
        c.uf = (campos.pop("uf") or "").strip().upper()
    for k, v in campos.items():
        setattr(c, k, v.strip() if isinstance(v, str) else v)
    db.commit()
    db.refresh(c)
    return _conta_out(c, ContaDetalheOut)


# ----------------------------------------------------------------- atividades

@router.get("/contas/{conta_id}/atividades", response_model=list[AtividadeOut])
def listar_atividades(conta_id: str, db: Session = Depends(get_db)):
    _conta_ou_404(db, conta_id)
    return list(db.scalars(
        select(Atividade)
        .where(Atividade.clinica_id == conta_id)
        .order_by(Atividade.data.desc(), Atividade.hora.desc(), Atividade.created_at.desc())
    ))


@router.post("/contas/{conta_id}/atividades", response_model=AtividadeOut, status_code=201)
def registrar_atividade(
    conta_id: str,
    dados: AtividadeIn,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(usuario_atual),
):
    c = _conta_ou_404(db, conta_id)
    _validar(dados.tipo, TIPOS_ATIVIDADE, "Tipo de atividade")
    if not dados.tipo:
        raise HTTPException(422, "Escolha o tipo da atividade")
    agora = _agora_brasilia()
    quando = agora if dados.data is None else datetime.combine(dados.data, agora.time())
    at = _registrar(db, c, usuario, dados.tipo, dados.descricao.strip(), quando, dados.hora)
    db.commit()
    db.refresh(at)
    return at


@router.delete("/atividades/{atividade_id}", status_code=204)
def excluir_atividade(
    atividade_id: str,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(usuario_atual),
):
    at = db.get(Atividade, atividade_id)
    if at is None:
        raise HTTPException(404, "Atividade não encontrada")
    if at.tipo == TIPO_SISTEMA:
        raise HTTPException(403, "Registros automáticos do sistema não podem ser excluídos")
    if usuario.perfil != "admin" and at.usuario_id != usuario.id:
        raise HTTPException(403, "Só quem registrou a atividade (ou um admin) pode excluí-la")
    db.delete(at)
    db.commit()
    return Response(status_code=204)


@router.get("/atividades/ranking", response_model=RankingOut)
def ranking_atividades(
    data_de: date | None = None,
    data_ate: date | None = None,
    db: Session = Depends(get_db),
):
    """Atividades por pessoa e por tipo no período (padrão: últimos 30 dias)."""
    hoje = _agora_brasilia().date()
    data_ate = data_ate or hoje
    data_de = data_de or (data_ate - timedelta(days=29))
    if data_de > data_ate:
        raise HTTPException(422, "A data inicial não pode ser maior que a data final")
    rows = db.execute(
        select(Atividade.usuario_nome, Atividade.tipo, func.count())
        .where(Atividade.tipo != TIPO_SISTEMA, Atividade.data >= data_de, Atividade.data <= data_ate)
        .group_by(Atividade.usuario_nome, Atividade.tipo)
    ).all()
    por_usuario: dict[str, dict[str, int]] = {}
    for nome, tipo, n in rows:
        por_usuario.setdefault(nome or "—", {})[tipo] = n
    linhas = sorted(
        (RankingLinha(usuario=u, total=sum(t.values()), por_tipo=t) for u, t in por_usuario.items()),
        key=lambda linha: -linha.total,
    )
    tipos = [t for t in TIPOS_ATIVIDADE if any(t in linha.por_tipo for linha in linhas)]
    return RankingOut(
        data_de=data_de, data_ate=data_ate, total=sum(linha.total for linha in linhas),
        tipos=tipos, linhas=linhas,
    )


# ------------------------------------------------------------ indicadores

def _contagem(db: Session, coluna, *where, limite: int = 10) -> list[CrmContagem]:
    stmt = (
        select(coluna, func.count())
        .where(Clinica.etapa != "", *where)
        .group_by(coluna)
        .order_by(func.count().desc())
        .limit(limite)
    )
    return [CrmContagem(label=label or "Não informado", total=n) for label, n in db.execute(stmt)]


@router.get("/resumo", response_model=CrmResumoOut)
def resumo(db: Session = Depends(get_db)):
    def conta(*where) -> int:
        return db.scalar(select(func.count()).select_from(Clinica).where(Clinica.etapa != "", *where)) or 0

    do_pocket = Clinica.codigo_pocket.is_not(None)
    por_regiao = [
        CrmContagem(label=nome, total=n)
        for nome, n in db.execute(
            select(Regiao.nome, func.count())
            .join(Clinica, Clinica.regiao_id == Regiao.id)
            .where(do_pocket)
            .group_by(Regiao.nome)
            .order_by(func.count().desc())
            .limit(12)
        )
    ]
    concorrentes = [
        CrmContagem(label=nome, total=n)
        for nome, n in db.execute(
            select(Laboratorio.nome, func.count())
            .join(ClinicaLaboratorio, ClinicaLaboratorio.laboratorio_id == Laboratorio.id)
            .group_by(Laboratorio.nome)
            .order_by(func.count().desc())
            .limit(10)
        )
    ]
    return CrmResumoOut(
        contas=conta(),
        clientes_pocket=conta(do_pocket),
        com_uso=conta(do_pocket, Clinica.em_uso.is_(True)),
        sem_uso=conta(do_pocket, Clinica.em_uso.is_(False)),
        uso_sem_info=conta(do_pocket, Clinica.em_uso.is_(None)),
        clientes_com_dados_de_lead=conta(do_pocket, Clinica.vendedor != ""),
        os_no_periodo=db.scalar(select(func.coalesce(func.sum(Clinica.qtd_os_periodo), 0))) or 0,
        portadores=db.scalar(select(func.count()).select_from(Portador)) or 0,
        transferencias=db.scalar(select(func.count()).select_from(TransferenciaPortador)) or 0,
        transferencias_aprovadas=db.scalar(
            select(func.count()).select_from(TransferenciaPortador).where(TransferenciaPortador.aprovado_por != "")
        ) or 0,
        por_regiao=por_regiao,
        por_vendedor=_contagem(db, Clinica.vendedor, Clinica.vendedor != ""),
        por_captacao=_contagem(db, Clinica.captacao, Clinica.captacao != ""),
        concorrentes=concorrentes,
    )


@router.get("/filtros", response_model=CrmFiltrosOut)
def filtros(db: Session = Depends(get_db)):
    regioes = list(db.scalars(select(Regiao.nome).order_by(Regiao.nome)))
    vendedores = list(db.scalars(
        select(Clinica.vendedor).where(Clinica.vendedor != "").distinct().order_by(Clinica.vendedor)
    ))
    return CrmFiltrosOut(
        regioes=regioes,
        vendedores=vendedores,
        etapas=[CrmOpcao(valor=k, label=v) for k, v in ETAPAS.items()],
        temperaturas=[CrmOpcao(valor=k, label=v) for k, v in TEMPERATURAS.items()],
        tipos_atividade=TIPOS_ATIVIDADE,
    )
