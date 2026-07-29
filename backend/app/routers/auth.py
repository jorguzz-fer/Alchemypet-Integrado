"""Endpoints de autenticação."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Usuario
from ..schemas import LoginIn, TokenOut, UsuarioOut
from ..security import cria_token, usuario_atual, verifica_senha

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
def login(dados: LoginIn, db: Session = Depends(get_db)):
    email = dados.email.strip().lower()
    u = db.scalar(select(Usuario).where(func.lower(Usuario.email) == email))
    if not u or not u.ativo or not verifica_senha(dados.senha, u.senha_hash):
        raise HTTPException(401, "E-mail ou senha inválidos")
    return TokenOut(access_token=cria_token(u), usuario=UsuarioOut.model_validate(u))


@router.get("/me", response_model=UsuarioOut)
def me(usuario: Usuario = Depends(usuario_atual)):
    return usuario
