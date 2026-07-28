"""Endpoints de pendências."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..filters import Filtros, aplicar
from ..models import Pendencia
from ..schemas import PendenciaCreate, PendenciaOut, PendenciaPage, PendenciaUpdate

router = APIRouter(prefix="/pendencias", tags=["pendencias"])


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
    import hashlib

    chave = hashlib.sha1(f"manual|{dados.guia}|{dados.paciente}|{dados.informacao_necessaria}".encode()).hexdigest()[:32]
    p = Pendencia(chave=chave, **dados.model_dump())
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
    for k, v in dados.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p
