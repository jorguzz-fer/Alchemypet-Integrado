"""Endpoints de tratativas (histórico por pendência)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Pendencia, Tratativa, Usuario
from ..schemas import TratativaCreate, TratativaOut
from ..security import usuario_atual

router = APIRouter(prefix="/pendencias/{pendencia_id}/tratativas", tags=["tratativas"])


def _serialize(t: Tratativa) -> TratativaOut:
    return TratativaOut(
        id=t.id,
        pendencia_id=t.pendencia_id,
        usuario_nome=t.usuario.nome if t.usuario else None,
        acao=t.acao,
        gestao=t.gestao,
        por_agente=t.por_agente,
        created_at=t.created_at,
    )


@router.get("", response_model=list[TratativaOut])
def listar(pendencia_id: str, db: Session = Depends(get_db)):
    if not db.get(Pendencia, pendencia_id):
        raise HTTPException(404, "Pendência não encontrada")
    tratativas = db.scalars(
        select(Tratativa).where(Tratativa.pendencia_id == pendencia_id).order_by(Tratativa.created_at)
    )
    return [_serialize(t) for t in tratativas]


@router.post("", response_model=TratativaOut, status_code=201)
def criar(
    pendencia_id: str,
    dados: TratativaCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(usuario_atual),
):
    p = db.get(Pendencia, pendencia_id)
    if not p:
        raise HTTPException(404, "Pendência não encontrada")
    t = Tratativa(
        pendencia_id=pendencia_id,
        usuario_id=usuario.id,  # assina com o usuário logado
        acao=dados.acao,
        gestao=dados.gestao or p.gestao,
        por_agente=False,
    )
    # Registrar tratativa avança a gestão da pendência.
    if dados.gestao:
        p.gestao = dados.gestao
    db.add(t)
    db.commit()
    db.refresh(t)
    return _serialize(t)
