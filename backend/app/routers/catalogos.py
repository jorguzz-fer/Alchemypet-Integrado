"""Endpoints de apoio: clínicas (filtro) e usuários."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Clinica, Pendencia, Usuario
from ..schemas import ClinicasOut, UsuarioOut

router = APIRouter(tags=["catalogos"])


@router.get("/clinicas", response_model=ClinicasOut)
def clinicas(db: Session = Depends(get_db)):
    # Master data quando existir; senão, distintos direto das pendências.
    nomes = list(db.scalars(select(Clinica.nome).order_by(Clinica.nome)))
    if not nomes:
        nomes = [
            n for n in db.scalars(
                select(Pendencia.clinica).where(Pendencia.clinica != "").distinct().order_by(Pendencia.clinica)
            )
        ]
    return ClinicasOut(items=nomes)


@router.get("/usuarios", response_model=list[UsuarioOut])
def usuarios(db: Session = Depends(get_db)):
    return list(db.scalars(select(Usuario).order_by(Usuario.nome)))
