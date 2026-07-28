"""Painel Convênio API — aplicação FastAPI (M1)."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from .config import settings
from .database import Base, SessionLocal, engine
from .models import Usuario
from .routers import catalogos, dashboard, importacao, pendencias, tratativas

app = FastAPI(title=settings.APP_NAME, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pendencias.router)
app.include_router(tratativas.router)
app.include_router(dashboard.router)
app.include_router(catalogos.router)
app.include_router(importacao.router)


@app.on_event("startup")
def on_startup() -> None:
    # M1: cria o schema automaticamente. Em produção madura, migrar para Alembic.
    Base.metadata.create_all(bind=engine)
    # Seed mínimo de usuários (placeholder até a auth do ecossistema — Fase 0).
    with SessionLocal() as db:
        if not db.scalar(select(func.count()).select_from(Usuario)):
            db.add_all([
                Usuario(nome="Atendimento", perfil="atendente"),
                Usuario(nome="Supervisão", perfil="supervisor"),
            ])
            db.commit()


@app.get("/health", tags=["infra"])
def health() -> dict:
    return {"status": "ok"}


@app.get("/", tags=["infra"])
def root() -> dict:
    return {"app": settings.APP_NAME, "docs": "/docs", "health": "/health"}
