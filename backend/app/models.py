"""Modelos de dados do Painel Convênio (M1).

Portável entre SQLite (dev) e PostgreSQL (produção): IDs em UUID armazenados
como string, enums validados na camada Pydantic (colunas String).
"""
from datetime import date, datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _uuid() -> str:
    return str(uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Usuario(Base):
    __tablename__ = "usuario"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str | None] = mapped_column(String(160), unique=True, nullable=True)
    senha_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    perfil: Mapped[str] = mapped_column(String(20), default="atendente")  # atendente|supervisor|admin
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Clinica(Base):
    """Master data de clínicas (consolidado na importação, usado em filtros)."""

    __tablename__ = "clinica"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    codigo: Mapped[str] = mapped_column(String(40), default="")
    nome: Mapped[str] = mapped_column(String(200), index=True)
    atende_convenio: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Pendencia(Base):
    __tablename__ = "pendencia"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    # Módulo/operação: convenio | triagem
    modulo: Mapped[str] = mapped_column(String(20), default="convenio", index=True)
    # Chave natural para importação idempotente (modulo|aba|guia|paciente|info).
    chave: Mapped[str] = mapped_column(String(64), unique=True, index=True)

    guia: Mapped[str] = mapped_column(String(40), default="", index=True)
    paciente: Mapped[str] = mapped_column(String(160), default="")
    cod_clinica: Mapped[str] = mapped_column(String(40), default="")
    clinica: Mapped[str] = mapped_column(String(200), default="", index=True)
    informacao_necessaria: Mapped[str] = mapped_column(Text, default="")
    resposta_cliente: Mapped[str] = mapped_column(Text, default="")
    responsavel: Mapped[str] = mapped_column(String(120), default="", index=True)
    # TEXT (sem limite): campos que, em abas com colunas desalinhadas na
    # origem, podem receber comentários longos.
    colaborador: Mapped[str] = mapped_column(Text, default="")
    confirmacao: Mapped[str] = mapped_column(Text, default="")
    triagem: Mapped[str] = mapped_column(Text, default="")

    # Status derivado da planilha: pendente|tratativa|concluido
    status: Mapped[str] = mapped_column(String(20), default="pendente", index=True)
    # Situação de gestão controlada no painel: aberto|andamento|resolvido
    gestao: Mapped[str] = mapped_column(String(20), default="aberto", index=True)

    ano: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    mes: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    data_pedido: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_devolutiva: Mapped[date | None] = mapped_column(Date, nullable=True)
    aba: Mapped[str] = mapped_column(String(60), default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    tratativas: Mapped[list["Tratativa"]] = relationship(
        back_populates="pendencia", cascade="all, delete-orphan", order_by="Tratativa.created_at"
    )

    @property
    def dias_em_aberto(self) -> int | None:
        """Dias desde a data do pedido enquanto não concluída (SLA/aging)."""
        if self.status == "concluido" or not self.data_pedido:
            return None
        d = (date.today() - self.data_pedido).days
        return d if d >= 0 else 0


class Pop(Base):
    """Controle de POPs (Procedimentos Operacionais Padrão) elaborados e
    atualizados. Cada registro é um POP trabalhado num dado ano, novo ou
    atualizado. Os resumos (por ano, por área, KPIs) derivam desta lista."""

    __tablename__ = "pop"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    # Chave natural para importação idempotente (numero|tipo|ano).
    chave: Mapped[str] = mapped_column(String(64), unique=True, index=True)

    numero: Mapped[str] = mapped_column(String(20), default="", index=True)
    nome: Mapped[str] = mapped_column(Text, default="")
    ano: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    # novo | atualizado
    tipo: Mapped[str] = mapped_column(String(20), default="novo", index=True)
    area: Mapped[str] = mapped_column(String(120), default="", index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class Chamado(Base):
    """Chamado recebido por e-mail (caixa de atendimento). Classificado por
    complexidade e motivo. Alimentado por importação da planilha e, adiante,
    pela automação de leitura da caixa do Gmail (Workspace)."""

    __tablename__ = "chamado"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    # Chave natural para ingestão idempotente (id da mensagem do Gmail, ou
    # hash do link/assunto quando importado da planilha).
    chave: Mapped[str] = mapped_column(String(64), unique=True, index=True)

    assunto: Mapped[str] = mapped_column(Text, default="")
    remetente: Mapped[str] = mapped_column(String(200), default="", index=True)
    link_gmail: Mapped[str] = mapped_column(Text, default="")
    texto: Mapped[str] = mapped_column(Text, default="")

    # baixa | media | alta
    complexidade: Mapped[str] = mapped_column(String(20), default="", index=True)
    motivo: Mapped[str] = mapped_column(String(120), default="", index=True)
    # Como a classificação foi feita: planilha | regra | ia | manual
    origem_classe: Mapped[str] = mapped_column(String(20), default="planilha")

    # aberto | resolvido
    status: Mapped[str] = mapped_column(String(20), default="aberto", index=True)
    resposta: Mapped[str] = mapped_column(Text, default="")

    data: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class Tratativa(Base):
    """Histórico de ações sobre uma pendência (humano ou agente)."""

    __tablename__ = "tratativa"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    pendencia_id: Mapped[str] = mapped_column(ForeignKey("pendencia.id", ondelete="CASCADE"), index=True)
    usuario_id: Mapped[str | None] = mapped_column(ForeignKey("usuario.id"), nullable=True)
    acao: Mapped[str] = mapped_column(Text, default="")
    gestao: Mapped[str] = mapped_column(String(20), default="")
    por_agente: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    pendencia: Mapped["Pendencia"] = relationship(back_populates="tratativas")
    usuario: Mapped["Usuario | None"] = relationship()
