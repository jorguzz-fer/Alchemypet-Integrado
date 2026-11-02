"""Modelos de dados do Painel Convênio (M1).

Portável entre SQLite (dev) e PostgreSQL (produção): IDs em UUID armazenados
como string, enums validados na camada Pydantic (colunas String).
"""
from datetime import date, datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Integer, LargeBinary, String, Text,
)
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
    """Conta (clínica ou lead). Nasceu como master data das pendências e passa
    a ser a conta do CRM: lead e clínica são o mesmo registro (muda a etapa)."""

    __tablename__ = "clinica"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    codigo: Mapped[str] = mapped_column(String(40), default="")
    nome: Mapped[str] = mapped_column(String(200), index=True)
    atende_convenio: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    # ----- CRM (importado do Pocket) -----
    # Origem do registro: pendencia | pocket | lead
    origem: Mapped[str] = mapped_column(String(20), default="pendencia", index=True)
    codigo_pocket: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    # Chave do lead que não casou com nenhuma clínica (idempotência).
    lead_chave: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    # lead | cliente. A etapa fina do funil depende de exportação do Pocket.
    etapa: Mapped[str] = mapped_column(String(30), default="", index=True)
    regiao_id: Mapped[str | None] = mapped_column(ForeignKey("regiao.id"), nullable=True, index=True)
    whatsapp: Mapped[str] = mapped_column(String(40), default="")
    telefone_norm: Mapped[str] = mapped_column(String(20), default="", index=True)
    responsavel: Mapped[str] = mapped_column(String(160), default="")
    email: Mapped[str] = mapped_column(String(200), default="")
    cidade: Mapped[str] = mapped_column(String(120), default="")
    uf: Mapped[str] = mapped_column(String(2), default="")
    vendedor: Mapped[str] = mapped_column(String(120), default="", index=True)
    captacao: Mapped[str] = mapped_column(String(60), default="")
    decisor: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    atendimentos_mes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    exames_mes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    divide_laboratorio: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    nota_laboratorio: Mapped[str] = mapped_column(String(20), default="")
    laboratorios_texto: Mapped[str] = mapped_column(Text, default="")
    convenios: Mapped[str] = mapped_column(Text, default="")
    onboarding_em: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Uso no período do relatório "Clínicas em Utilização": None = sem informação.
    em_uso: Mapped[bool | None] = mapped_column(Boolean, nullable=True, index=True)
    qtd_os_periodo: Mapped[int] = mapped_column(Integer, default=0)
    tem_login_pocket: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, onupdate=_now)

    regiao: Mapped["Regiao | None"] = relationship()
    laboratorios: Mapped[list["Laboratorio"]] = relationship(secondary="clinica_laboratorio")


# ===== CRM e logística (base vinda do Pocket) =====

class Regiao(Base):
    __tablename__ = "regiao"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    nome: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    ativa: Mapped[bool] = mapped_column(Boolean, default=True)


class Laboratorio(Base):
    """Laboratório concorrente (qualificação de leads)."""

    __tablename__ = "laboratorio"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    nome: Mapped[str] = mapped_column(String(120), unique=True, index=True)


class ClinicaLaboratorio(Base):
    __tablename__ = "clinica_laboratorio"

    clinica_id: Mapped[str] = mapped_column(
        ForeignKey("clinica.id", ondelete="CASCADE"), primary_key=True
    )
    laboratorio_id: Mapped[str] = mapped_column(
        ForeignKey("laboratorio.id", ondelete="CASCADE"), primary_key=True
    )


class Transportadora(Base):
    __tablename__ = "transportadora"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    nome: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(160), default="")
    telefone: Mapped[str] = mapped_column(String(40), default="")


class Portador(Base):
    __tablename__ = "portador"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    codigo_pocket: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    nome: Mapped[str] = mapped_column(String(160), default="")
    transportadora_id: Mapped[str | None] = mapped_column(
        ForeignKey("transportadora.id"), nullable=True
    )
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)


class TransferenciaPortador(Base):
    """Pedido de troca de portador numa coleta (histórico do Pocket)."""

    __tablename__ = "transferencia_portador"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    chave: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    coleta: Mapped[str] = mapped_column(String(20), index=True)
    solicitado_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    de_portador_id: Mapped[str | None] = mapped_column(ForeignKey("portador.id"), nullable=True)
    para_portador_id: Mapped[str | None] = mapped_column(ForeignKey("portador.id"), nullable=True)
    aprovado_por: Mapped[str] = mapped_column(String(80), default="")
    aprovado_em: Mapped[date | None] = mapped_column(Date, nullable=True)

    de_portador: Mapped["Portador | None"] = relationship(foreign_keys=[de_portador_id])
    para_portador: Mapped["Portador | None"] = relationship(foreign_keys=[para_portador_id])


class Pendencia(Base):
    __tablename__ = "pendencia"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    # Módulo/operação: convenio | particular
    modulo: Mapped[str] = mapped_column(String(20), default="convenio", index=True)
    # Chave natural para importação idempotente (modulo|aba|guia|paciente|info).
    chave: Mapped[str] = mapped_column(String(64), unique=True, index=True)

    guia: Mapped[str] = mapped_column(String(40), default="", index=True)
    paciente: Mapped[str] = mapped_column(String(160), default="")
    cod_clinica: Mapped[str] = mapped_column(String(40), default="")
    clinica: Mapped[str] = mapped_column(String(200), default="", index=True)
    # Legado (texto livre das planilhas antigas); substituído por motivo/observacao.
    informacao_necessaria: Mapped[str] = mapped_column(Text, default="")
    # Motivo (lista fechada, ver motivos.MOTIVOS_PENDENCIA) + observação livre.
    motivo: Mapped[str] = mapped_column(String(80), default="", index=True)
    observacao: Mapped[str] = mapped_column(Text, default="")
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


class Migracao(Base):
    """Marca migrações de dados de execução única.

    Sem este registro, uma migração cara (ou que precisa rodar só uma vez,
    como o realinhamento das chaves naturais) seria repetida a cada boot."""

    __tablename__ = "migracao"

    chave: Mapped[str] = mapped_column(String(80), primary_key=True)
    aplicada_em: Mapped[datetime] = mapped_column(DateTime, default=_now)


class RelatorioQualidade(Base):
    """Relatório Gerencial de Qualidade: .docx enviado pela Qualidade e o PDF
    diagramado gerado a partir dele. Guardamos o .docx para permitir regerar o
    PDF quando o layout evoluir, sem pedir o arquivo de novo."""

    __tablename__ = "relatorio_qualidade"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    arquivo: Mapped[str] = mapped_column(String(260), default="")
    # executivo | completo
    tipo: Mapped[str] = mapped_column(String(20), default="executivo", index=True)
    titulo: Mapped[str] = mapped_column(String(200), default="")
    periodo: Mapped[str] = mapped_column(String(120), default="", index=True)
    paginas: Mapped[int] = mapped_column(Integer, default=0)
    setores: Mapped[int] = mapped_column(Integer, default=0)
    pontos_atencao: Mapped[int] = mapped_column(Integer, default=0)

    docx: Mapped[bytes] = mapped_column(LargeBinary)
    pdf: Mapped[bytes] = mapped_column(LargeBinary)
    tamanho_pdf: Mapped[int] = mapped_column(Integer, default=0)

    enviado_por_id: Mapped[str | None] = mapped_column(
        ForeignKey("usuario.id"), nullable=True
    )
    enviado_por: Mapped["Usuario | None"] = relationship()

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)
