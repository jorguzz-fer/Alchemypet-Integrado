"""Painel Convênio API — aplicação FastAPI."""
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, text

from .config import settings
from .database import Base, SessionLocal, engine
from .models import Usuario
from .routers import auth, catalogos, dashboard, importacao, pendencias, tratativas, usuarios
from .security import hash_senha, usuario_atual

app = FastAPI(title=settings.APP_NAME, version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rotas abertas
app.include_router(auth.router)

# Rotas protegidas (exigem usuário autenticado)
protegido = [Depends(usuario_atual)]
app.include_router(pendencias.router, dependencies=protegido)
app.include_router(tratativas.router, dependencies=protegido)
app.include_router(dashboard.router, dependencies=protegido)
app.include_router(catalogos.router, dependencies=protegido)
app.include_router(importacao.router, dependencies=protegido)
app.include_router(usuarios.router)  # protege internamente (usuario_atual/exige_admin)


def _migracao_leve() -> None:
    """Adiciona colunas de auth ao usuario em bancos já existentes (idempotente).
    create_all não altera tabelas; no Postgres usamos ADD COLUMN IF NOT EXISTS.
    Em SQLite novo, create_all já cria o schema completo."""
    if not engine.url.get_backend_name().startswith("postgresql"):
        return
    ddl = [
        "ALTER TABLE usuario ADD COLUMN IF NOT EXISTS email VARCHAR(160)",
        "ALTER TABLE usuario ADD COLUMN IF NOT EXISTS senha_hash VARCHAR(255)",
        "ALTER TABLE usuario ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_usuario_email ON usuario (email)",
        # Campos de comentário viram TEXT (fim da truncagem). varchar->text é
        # barato no Postgres; rodar de novo sobre TEXT é no-op.
        "ALTER TABLE pendencia ALTER COLUMN colaborador TYPE TEXT",
        "ALTER TABLE pendencia ALTER COLUMN confirmacao TYPE TEXT",
        "ALTER TABLE pendencia ALTER COLUMN triagem TYPE TEXT",
    ]
    with engine.begin() as conn:
        for stmt in ddl:
            conn.execute(text(stmt))


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    _migracao_leve()
    # Garante um admin inicial (idempotente) a partir das variáveis de ambiente.
    with SessionLocal() as db:
        email = settings.ADMIN_EMAIL.strip().lower()
        admin = db.scalar(select(Usuario).where(func.lower(Usuario.email) == email))
        if not admin:
            db.add(Usuario(
                nome=settings.ADMIN_NOME,
                email=email,
                perfil="admin",
                senha_hash=hash_senha(settings.ADMIN_SENHA),
                ativo=True,
            ))
            db.commit()


@app.get("/health", tags=["infra"])
def health() -> dict:
    return {"status": "ok"}


@app.get("/", tags=["infra"])
def root() -> dict:
    return {"app": settings.APP_NAME, "docs": "/docs", "health": "/health"}
