"""Endpoints de apoio: clínicas (filtro)."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Pendencia
from ..schemas import ClinicasOut

router = APIRouter(tags=["catalogos"])


@router.get("/clinicas", response_model=ClinicasOut)
def clinicas(modulo: str = "convenio", db: Session = Depends(get_db)):
    # Distintos direto das pendências do módulo (mantém o filtro coerente).
    nomes = [
        n for n in db.scalars(
            select(Pendencia.clinica)
            .where(Pendencia.modulo == modulo, Pendencia.clinica != "")
            .distinct()
            .order_by(Pendencia.clinica)
        )
    ]
    return ClinicasOut(items=nomes)
