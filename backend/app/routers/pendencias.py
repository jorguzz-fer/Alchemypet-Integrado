"""Endpoints de pendências."""
from datetime import date
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..filters import Filtros, aplicar
from ..models import Pendencia
from ..schemas import PendenciaCreate, PendenciaOut, PendenciaPage, PendenciaUpdate

router = APIRouter(prefix="/pendencias", tags=["pendencias"])


def _derivar_status(confirmacao: str, resposta: str, data_dev: date | None) -> str:
    """Mesma regra da importação: concluído se confirmação = OK; em tratativa
    se há resposta/devolutiva; senão pendente."""
    conf = (confirmacao or "").strip().lower()
    if conf == "ok" or conf.startswith("ok ") or conf == "okk":
        return "concluido"
    if (resposta or "").strip() or data_dev:
        return "tratativa"
    return "pendente"


def _filtros(
    ano: int | None = None,
    mes_de: int | None = None,
    mes_ate: int | None = None,
    status: str | None = None,
    gestao: str | None = None,
    clinica: str | None = None,
    responsavel: str | None = None,
    busca: str | None = None,
) -> Filtros:
    return Filtros(ano, mes_de, mes_ate, status, gestao, clinica, responsavel, busca)


@router.get("", response_model=PendenciaPage)
def listar(
    f: Filtros = Depends(_filtros),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    base = aplicar(select(Pendencia), f)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    stmt = base.order_by(Pendencia.ano.desc(), Pendencia.mes.desc(), Pendencia.data_pedido.desc()) \
        .offset((page - 1) * per_page).limit(per_page)
    items = list(db.scalars(stmt))
    return PendenciaPage(total=total, page=page, per_page=per_page, items=items)


@router.post("", response_model=PendenciaOut, status_code=201)
def criar(dados: PendenciaCreate, db: Session = Depends(get_db)):
    """Lançamento manual de pendência (substitui a digitação na planilha)."""
    campos = dados.model_dump()
    gestao = campos.pop("gestao", None)

    # Período (ano/mês) derivado da data do pedido, quando houver.
    dp = campos.get("data_pedido")
    ano = dp.year if dp else None
    mes = dp.month if dp else None

    status = _derivar_status(campos["confirmacao"], campos["resposta_cliente"], campos["data_devolutiva"])

    p = Pendencia(
        chave=uuid4().hex,  # lançamento manual: chave única própria
        aba="Manual",
        status=status,
        gestao=gestao or ("resolvido" if status == "concluido" else "aberto"),
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
def atualizar(pendencia_id: str, dados: PendenciaUpdate, db: Session = Depends(get_db)):
    p = db.get(Pendencia, pendencia_id)
    if not p:
        raise HTTPException(404, "Pendência não encontrada")

    enviados = dados.model_dump(exclude_unset=True)
    for k, v in enviados.items():
        setattr(p, k, v)

    # Recalcula período se a data do pedido mudou.
    if "data_pedido" in enviados:
        p.ano = p.data_pedido.year if p.data_pedido else None
        p.mes = p.data_pedido.month if p.data_pedido else None

    # Recalcula status da planilha quando não foi informado explicitamente,
    # mas algum campo que o define mudou.
    if "status" not in enviados and enviados.keys() & {"confirmacao", "resposta_cliente", "data_devolutiva"}:
        p.status = _derivar_status(p.confirmacao, p.resposta_cliente, p.data_devolutiva)

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
