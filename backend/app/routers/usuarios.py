"""Gestão de usuários (somente admin)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Usuario
from ..schemas import UsuarioCreate, UsuarioOut, UsuarioUpdate
from ..security import exige_admin, hash_senha, usuario_atual

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


@router.get("", response_model=list[UsuarioOut])
def listar(db: Session = Depends(get_db), _=Depends(usuario_atual)):
    return list(db.scalars(select(Usuario).order_by(Usuario.nome)))


@router.post("", response_model=UsuarioOut, status_code=201)
def criar(dados: UsuarioCreate, db: Session = Depends(get_db), _=Depends(exige_admin)):
    email = dados.email.strip().lower()
    if db.scalar(select(Usuario).where(func.lower(Usuario.email) == email)):
        raise HTTPException(409, "Já existe um usuário com esse e-mail")
    u = Usuario(
        nome=dados.nome.strip(),
        email=email,
        perfil=dados.perfil,
        senha_hash=hash_senha(dados.senha),
        ativo=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@router.patch("/{usuario_id}", response_model=UsuarioOut)
def atualizar(usuario_id: str, dados: UsuarioUpdate, db: Session = Depends(get_db), _=Depends(exige_admin)):
    u = db.get(Usuario, usuario_id)
    if not u:
        raise HTTPException(404, "Usuário não encontrado")
    campos = dados.model_dump(exclude_unset=True)
    if "senha" in campos:
        senha = campos.pop("senha")
        if senha:
            u.senha_hash = hash_senha(senha)
    for k, v in campos.items():
        setattr(u, k, v)
    db.commit()
    db.refresh(u)
    return u
