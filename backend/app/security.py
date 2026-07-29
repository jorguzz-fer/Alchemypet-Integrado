"""Autenticação: hash de senha (PBKDF2, stdlib), JWT e dependências."""
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import Usuario

ALGO = "HS256"
_PBKDF2_ROUNDS = 240_000

oauth2 = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


# ---------- Senha (PBKDF2-HMAC-SHA256, sem dependência nativa) ----------
def hash_senha(senha: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", senha.encode(), salt, _PBKDF2_ROUNDS)
    return f"pbkdf2_sha256${_PBKDF2_ROUNDS}${salt.hex()}${dk.hex()}"


def verifica_senha(senha: str, armazenado: str | None) -> bool:
    if not armazenado:
        return False
    try:
        _, rounds, salt_hex, hash_hex = armazenado.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", senha.encode(), bytes.fromhex(salt_hex), int(rounds))
        return hmac.compare_digest(dk.hex(), hash_hex)
    except (ValueError, TypeError):
        return False


# ---------- JWT ----------
def cria_token(usuario: Usuario) -> str:
    agora = datetime.now(timezone.utc)
    payload = {
        "sub": usuario.id,
        "nome": usuario.nome,
        "perfil": usuario.perfil,
        "iat": agora,
        "exp": agora + timedelta(minutes=settings.JWT_EXPIRE_MIN),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGO)


def _decodifica(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGO])


# ---------- Dependências ----------
def usuario_atual(token: str | None = Depends(oauth2), db: Session = Depends(get_db)) -> Usuario:
    cred_erro = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não autenticado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise cred_erro
    try:
        payload = _decodifica(token)
    except jwt.PyJWTError:
        raise cred_erro
    u = db.get(Usuario, payload.get("sub"))
    if not u or not u.ativo:
        raise cred_erro
    return u


def exige_admin(usuario: Usuario = Depends(usuario_atual)) -> Usuario:
    if usuario.perfil != "admin":
        raise HTTPException(status_code=403, detail="Requer perfil de administrador")
    return usuario
