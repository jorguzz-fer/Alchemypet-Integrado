"""Endpoints de pendências."""
from datetime import date
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..ordenacao import MAX_EXPORTACAO, ordenar
from ..reports import descrever_filtros, lista_xlsx
from ..xlsx_resposta import _xlsx
from ..exclusao_lote import ExclusaoFiltroIn, ExclusaoLoteIn, ExclusaoOut, excluir_filtro, excluir_ids
from ..filters import Filtros, aplicar
from ..models import Pendencia, Tratativa, Usuario
from ..motivos import MODULOS, MOTIVO_OBSERVACAO, normalizar_modulo, status_por_gestao
from ..security import exige_admin, usuario_atual
from ..schemas import PendenciaCreate, PendenciaOut, PendenciaPage, PendenciaUpdate

router = APIRouter(prefix="/pendencias", tags=["pendencias"])


def _validar_observacao(motivo: str, observacao: str) -> None:
    if motivo == MOTIVO_OBSERVACAO and not (observacao or "").strip():
        raise HTTPException(422, 'Descreva o ocorrido no campo "Observação"')


def _filtros(
    modulo: str | None = None,
    ano: int | None = None,
    mes_de: int | None = None,
    mes_ate: int | None = None,
    status: str | None = None,
    gestao: str | None = None,
    clinica: str | None = None,
    responsavel: str | None = None,
    busca: str | None = None,
    antigas: bool = False,
    abertas: bool = False,
    data_de: date | None = None,
    data_ate: date | None = None,
    motivo: str | None = None,
) -> Filtros:
    modulo = normalizar_modulo(modulo)
    if modulo is not None and modulo not in MODULOS:
        raise HTTPException(422, "Módulo inválido")
    if data_de and data_ate and data_de > data_ate:
        raise HTTPException(422, "A data inicial não pode ser maior que a data final")
    return Filtros(
        modulo, ano, mes_de, mes_ate, status, gestao, clinica, responsavel,
        busca, antigas, abertas, data_de, data_ate, motivo,
    )


# Colunas ordenáveis pelo título (chave da tela → colunas SQL, com desempate).
ORDENAVEIS = {
    "modulo": [Pendencia.modulo],
    "data": [Pendencia.ano, Pendencia.mes, Pendencia.data_pedido],
    "guia": [Pendencia.guia],
    "paciente": [Pendencia.paciente],
    "clinica": [Pendencia.clinica],
    "motivo": [Pendencia.motivo],
    "responsavel": [Pendencia.responsavel],
    "status": [Pendencia.status],
    "gestao": [Pendencia.gestao],
}


def _ordenada(base, ordem: str | None, sort: str | None, direcao: str | None):
    if sort:
        return ordenar(base, sort, direcao, ORDENAVEIS, ("data", "desc"))
    if ordem == "prioridade":
        # Fila de triagem: mais antigas primeiro (nulos por último).
        return base.order_by(Pendencia.data_pedido.is_(None), Pendencia.data_pedido.asc())
    if ordem == "antigos":
        return base.order_by(Pendencia.ano.asc(), Pendencia.mes.asc(), Pendencia.data_pedido.asc())
    return base.order_by(Pendencia.ano.desc(), Pendencia.mes.desc(), Pendencia.data_pedido.desc())


@router.get("", response_model=PendenciaPage)
def listar(
    f: Filtros = Depends(_filtros),
    ordem: str | None = None,
    sort: str | None = None,
    dir: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    base = aplicar(select(Pendencia), f)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    stmt = _ordenada(base, ordem, sort, dir).offset((page - 1) * per_page).limit(per_page)
    items = list(db.scalars(stmt))
    return PendenciaPage(total=total, page=page, per_page=per_page, items=items)


@router.get("/lista.xlsx")
def exportar_lista(
    f: Filtros = Depends(_filtros),
    ordem: str | None = None,
    sort: str | None = None,
    dir: str | None = None,
    db: Session = Depends(get_db),
):
    """Todas as pendências do filtro, na ordem da tela, em planilha."""
    stmt = _ordenada(aplicar(select(Pendencia), f), ordem, sort, dir).limit(MAX_EXPORTACAO)
    nomes = {"convenio": "Convênio", "particular": "Particular"}
    linhas = (
        [
            nomes.get(p.modulo, p.modulo), p.data_pedido, p.ano, p.mes, p.guia, p.paciente,
            p.clinica, p.motivo, p.observacao, p.responsavel, p.status, p.gestao,
            p.dias_em_aberto, p.resposta_cliente,
        ]
        for p in db.scalars(stmt)
    )
    conteudo = lista_xlsx(
        "Pendências — lista",
        [("Tipo", 12), ("Data do pedido", 14), ("Ano", 7), ("Mês", 6), ("Guia", 12),
         ("Paciente", 22), ("Clínica", 30), ("Motivo", 30), ("Observação", 40),
         ("Responsável", 16), ("Status planilha", 15), ("Gestão", 12),
         ("Dias em aberto", 13), ("Resposta do cliente", 40)],
        linhas,
        descrever_filtros(tipo=f.modulo, ano=f.ano, mes_de=f.mes_de, mes_ate=f.mes_ate,
                          dia_de=f.data_de, dia_ate=f.data_ate, motivo=f.motivo,
                          status=f.status, gestao=f.gestao, clinica=f.clinica,
                          responsavel=f.responsavel, busca=f.busca),
    )
    return _xlsx(conteudo, f"pendencias-{f.modulo or 'todas'}")


@router.post("", response_model=PendenciaOut, status_code=201)
def criar(dados: PendenciaCreate, db: Session = Depends(get_db)):
    """Lançamento manual de pendência (substitui a digitação na planilha)."""
    campos = dados.model_dump()
    gestao = campos.pop("gestao", None) or "aberto"
    _validar_observacao(campos["motivo"], campos["observacao"])

    # Período (ano/mês) derivado da data do pedido, quando houver.
    dp = campos.get("data_pedido")
    ano = dp.year if dp else None
    mes = dp.month if dp else None

    p = Pendencia(
        chave=uuid4().hex,  # lançamento manual: chave única própria
        modulo=campos.pop("modulo", None) or "convenio",
        aba="Manual",
        # O status da planilha acompanha a gestão.
        status=status_por_gestao(gestao),
        gestao=gestao,
        ano=ano,
        mes=mes,
        **campos,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("/{pendencia_id}", response_model=PendenciaOut)
def obter(pendencia_id: str, db: Session = Depends(get_db)):
    p = db.get(Pendencia, pendencia_id)
    if not p:
        raise HTTPException(404, "Pendência não encontrada")
    return p


@router.patch("/{pendencia_id}", response_model=PendenciaOut)
def atualizar(
    pendencia_id: str,
    dados: PendenciaUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(usuario_atual),
):
    p = db.get(Pendencia, pendencia_id)
    if not p:
        raise HTTPException(404, "Pendência não encontrada")

    enviados = dados.model_dump(exclude_unset=True)
    _validar_observacao(enviados.get("motivo", p.motivo), enviados.get("observacao", p.observacao))
    gestao_anterior = p.gestao
    for k, v in enviados.items():
        setattr(p, k, v)

    # Auditoria: registra no histórico quando a gestão muda (inclui o seletor
    # inline da tabela), assinada pelo usuário logado.
    if "gestao" in enviados and p.gestao != gestao_anterior:
        db.add(Tratativa(
            pendencia_id=p.id,
            usuario_id=usuario.id,
            acao=f"Gestão alterada: {gestao_anterior} → {p.gestao}",
            gestao=p.gestao,
            por_agente=False,
        ))

    # Recalcula período se a data do pedido mudou.
    if "data_pedido" in enviados:
        p.ano = p.data_pedido.year if p.data_pedido else None
        p.mes = p.data_pedido.month if p.data_pedido else None

    # O status da planilha acompanha a gestão (resolvido → concluído etc.).
    if "gestao" in enviados or "status" not in enviados:
        p.status = status_por_gestao(p.gestao)

    db.commit()
    db.refresh(p)
    return p


@router.delete("/{pendencia_id}", status_code=204)
def excluir(pendencia_id: str, db: Session = Depends(get_db)):
    p = db.get(Pendencia, pendencia_id)
    if not p:
        raise HTTPException(404, "Pendência não encontrada")
    db.delete(p)
    db.commit()
    return Response(status_code=204)


# ----------------------------------------------------------- exclusão em lote

def _tratativas(db: Session):
    return lambda ids: db.execute(delete(Tratativa).where(Tratativa.pendencia_id.in_(ids)))


@router.post("/excluir-lote", response_model=ExclusaoOut)
def excluir_lote(body: ExclusaoLoteIn, db: Session = Depends(get_db)):
    """Exclui as pendências selecionadas na tela (até 500), com as tratativas."""
    return excluir_ids(db, Pendencia, body, _tratativas(db))


@router.post("/excluir-filtro", response_model=ExclusaoOut, dependencies=[Depends(exige_admin)])
def excluir_por_filtro(
    body: ExclusaoFiltroIn,
    f: Filtros = Depends(_filtros),
    db: Session = Depends(get_db),
):
    """Exclui todas as pendências do filtro atual (só admin)."""
    return excluir_filtro(db, Pendencia, aplicar(select(Pendencia), f), body, _tratativas(db))
