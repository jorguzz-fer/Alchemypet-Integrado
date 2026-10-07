"""Painel Convênio API — aplicação FastAPI."""
import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, text

from .config import settings
from .database import Base, SessionLocal, engine
from .models import Usuario
from .routers import (
    auth,
    catalogos,
    chamado,
    dashboard,
    importacao,
    pendencias,
    pop,
    relatorio_qualidade,
    tratativas,
    usuarios,
    manutencao,
)
from .security import hash_senha, usuario_atual

log = logging.getLogger("painel.startup")

# As migrações de dados percorrem a tabela de pendências (dezenas de milhares
# de linhas). Processar em lotes, confirmando cada um, mantém a memória baixa
# e torna a migração retomável: se o processo cair no meio, o próximo boot
# continua de onde parou em vez de recomeçar.
LOTE_MIGRACAO = 500

app = FastAPI(title=settings.APP_NAME, version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    # Sem isto o navegador esconde o Content-Disposition e os downloads
    # (relatórios, exports) chegam com nome genérico.
    expose_headers=["Content-Disposition"],
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
app.include_router(pop.router, dependencies=protegido)
app.include_router(chamado.router, dependencies=protegido)
app.include_router(relatorio_qualidade.router, dependencies=protegido)
app.include_router(usuarios.router)  # protege internamente (usuario_atual/exige_admin)
app.include_router(manutencao.router)  # exige_admin no próprio router


def _migracao_leve() -> None:
    """Adiciona colunas a bancos já existentes (idempotente).
    create_all não altera tabelas; no Postgres usamos ADD COLUMN IF NOT EXISTS.
    Em SQLite (dev) só acrescentamos as colunas novas da pendência."""
    if not engine.url.get_backend_name().startswith("postgresql"):
        with engine.begin() as conn:
            cols = {r[1] for r in conn.execute(text("PRAGMA table_info(pendencia)"))}
            if cols and "motivo" not in cols:
                conn.execute(text("ALTER TABLE pendencia ADD COLUMN motivo VARCHAR(80) DEFAULT ''"))
            if cols and "observacao" not in cols:
                conn.execute(text("ALTER TABLE pendencia ADD COLUMN observacao TEXT DEFAULT ''"))
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
        # Multi-módulo: registros existentes são do convênio.
        "ALTER TABLE pendencia ADD COLUMN IF NOT EXISTS modulo VARCHAR(20) DEFAULT 'convenio'",
        "CREATE INDEX IF NOT EXISTS ix_pendencia_modulo ON pendencia (modulo)",
        # Motivo (lista fechada) + observação substituem "informação necessária".
        "ALTER TABLE pendencia ADD COLUMN IF NOT EXISTS motivo VARCHAR(80) DEFAULT ''",
        "ALTER TABLE pendencia ADD COLUMN IF NOT EXISTS observacao TEXT DEFAULT ''",
        "CREATE INDEX IF NOT EXISTS ix_pendencia_motivo ON pendencia (motivo)",
    ]
    with engine.begin() as conn:
        for stmt in ddl:
            conn.execute(text(stmt))


def _recarimba_chaves(db) -> None:
    """A chave natural passou a incluir o módulo. Recalcula uma vez as chaves
    das pendências existentes para a reimportação continuar idempotente."""
    from .importer import _chave
    from .models import Pendencia

    amostra = db.scalar(select(Pendencia).limit(1))
    if not amostra:
        return
    esperado = _chave(amostra.modulo, amostra.aba, amostra.guia, amostra.paciente, amostra.informacao_necessaria)
    if amostra.chave == esperado:
        return  # já no formato novo
    total = 0
    for lote in db.scalars(select(Pendencia).execution_options(yield_per=LOTE_MIGRACAO)).partitions():
        for p in lote:
            p.chave = _chave(p.modulo, p.aba, p.guia, p.paciente, p.informacao_necessaria)
        db.commit()
        total += len(lote)
    if total:
        log.info("Chaves recarimbadas: %s pendência(s).", total)


def _migracao_dados(db) -> None:
    """Ajustes de dados idempotentes:
    - módulo 'triagem' passa a se chamar 'particular';
    - pendências sem motivo ganham motivo/observação a partir do texto legado;
    - status da planilha passa a acompanhar a gestão (resolvido → concluído)."""
    from .models import Pendencia
    from .motivos import MOTIVO_OBSERVACAO, classificar_motivo

    db.execute(text("UPDATE pendencia SET modulo = 'particular' WHERE modulo = 'triagem'"))
    db.execute(text("UPDATE pendencia SET status = 'concluido' WHERE gestao = 'resolvido' AND status <> 'concluido'"))
    db.execute(text("UPDATE pendencia SET status = 'tratativa' WHERE gestao = 'andamento' AND status <> 'tratativa'"))
    db.commit()

    # Classificação do texto legado em lotes. Cada lote confirmado sai do
    # filtro (motivo deixa de ser vazio), então o laço sempre termina e um
    # boot interrompido retoma o trabalho restante.
    total = 0
    while True:
        pendentes = db.scalars(
            select(Pendencia)
            .where(Pendencia.motivo == "", Pendencia.informacao_necessaria != "")
            .limit(LOTE_MIGRACAO)
        ).all()
        if not pendentes:
            break
        for p in pendentes:
            motivo, observacao = classificar_motivo(p.informacao_necessaria)
            # Texto só com espaços não casa com nenhum motivo; sem este
            # fallback a linha continuaria no filtro e o laço não terminaria.
            p.motivo = motivo or MOTIVO_OBSERVACAO
            p.observacao = observacao
        db.commit()
        total += len(pendentes)
        db.expunge_all()  # não acumula objetos entre os lotes
    if total:
        log.info("Motivos classificados: %s pendência(s).", total)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    _migracao_leve()
    # Uma migração de dados que falhe não pode derrubar a API inteira: o erro
    # é registrado e o serviço sobe, permitindo investigar pelo painel.
    try:
        with SessionLocal() as db:
            _recarimba_chaves(db)
            _migracao_dados(db)
    except Exception:  # noqa: BLE001
        log.exception("Falha na migração de dados; a API segue no ar.")
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
