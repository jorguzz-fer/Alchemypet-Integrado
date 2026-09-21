"""Endpoints de apoio: clínicas (filtro)."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
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
