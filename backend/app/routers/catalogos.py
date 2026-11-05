"""Endpoints de apoio: clínicas, anos e motivos (filtros)."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Pendencia
from ..motivos import MOTIVOS_PENDENCIA, normalizar_modulo
from ..schemas import ClinicasOut

router = APIRouter(tags=["catalogos"])


@router.get("/clinicas", response_model=ClinicasOut)
def clinicas(modulo: str | None = None, db: Session = Depends(get_db)):
    # Distintos direto das pendências (do módulo, ou de todos) — filtro coerente.
    stmt = select(Pendencia.clinica).where(Pendencia.clinica != "")
    modulo = normalizar_modulo(modulo)
    if modulo:
        stmt = stmt.where(Pendencia.modulo == modulo)
    nomes = list(db.scalars(stmt.distinct().order_by(Pendencia.clinica)))
    return ClinicasOut(items=nomes)


@router.get("/motivos", response_model=list[str])
def motivos():
    """Lista fechada de motivos das pendências (ordem de exibição)."""
    return list(MOTIVOS_PENDENCIA)


class AnoContagem(BaseModel):
    ano: int
    total: int


@router.get("/anos", response_model=list[AnoContagem])
def anos(modulo: str | None = None, db: Session = Depends(get_db)):
    """Anos que existem nas pendências, do mais recente ao mais antigo, com a
    quantidade em cada um. O filtro de ano usa esta lista: assim um registro
    de 2016 (data digitada errada, aba antiga) também pode ser filtrado."""
    stmt = select(Pendencia.ano, func.count()).where(Pendencia.ano.is_not(None))
    modulo = normalizar_modulo(modulo)
    if modulo:
        stmt = stmt.where(Pendencia.modulo == modulo)
    linhas = db.execute(stmt.group_by(Pendencia.ano).order_by(Pendencia.ano.desc()))
    return [AnoContagem(ano=a, total=n) for a, n in linhas]
