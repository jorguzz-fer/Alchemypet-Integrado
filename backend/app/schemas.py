"""Schemas Pydantic (entrada/saída da API)."""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Status = Literal["pendente", "tratativa", "concluido"]
Gestao = Literal["aberto", "andamento", "resolvido"]


class PendenciaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    guia: str
    paciente: str
    cod_clinica: str
    clinica: str
    informacao_necessaria: str
    resposta_cliente: str
    responsavel: str
    colaborador: str
    confirmacao: str
    triagem: str
    status: Status
    gestao: Gestao
    ano: int | None
    mes: int | None
    data_pedido: date | None
    data_devolutiva: date | None
    dias_em_aberto: int | None = None
    aba: str
    updated_at: datetime


class PendenciaCreate(BaseModel):
    guia: str = Field("", max_length=40)
    paciente: str = Field("", max_length=160)
    cod_clinica: str = Field("", max_length=40)
    clinica: str = Field("", max_length=200)
    informacao_necessaria: str
    resposta_cliente: str = ""
    responsavel: str = Field("", max_length=120)
    colaborador: str = Field("", max_length=120)
    confirmacao: str = Field("", max_length=120)
    triagem: str = Field("", max_length=120)
    data_pedido: date | None = None
    data_devolutiva: date | None = None
    gestao: Gestao | None = None


class PendenciaUpdate(BaseModel):
    """Edição parcial: qualquer campo enviado é atualizado."""

    guia: str | None = Field(None, max_length=40)
    paciente: str | None = Field(None, max_length=160)
    cod_clinica: str | None = Field(None, max_length=40)
    clinica: str | None = Field(None, max_length=200)
    informacao_necessaria: str | None = None
    resposta_cliente: str | None = None
    responsavel: str | None = Field(None, max_length=120)
    colaborador: str | None = Field(None, max_length=120)
    confirmacao: str | None = Field(None, max_length=120)
    triagem: str | None = Field(None, max_length=120)
    data_pedido: date | None = None
    data_devolutiva: date | None = None
    gestao: Gestao | None = None
    status: Status | None = None


class PendenciaPage(BaseModel):
    total: int
    page: int
    per_page: int
    items: list[PendenciaOut]


class TratativaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    pendencia_id: str
    usuario_nome: str | None = None
    acao: str
    gestao: str
    por_agente: bool
    created_at: datetime


class TratativaCreate(BaseModel):
    acao: str
    gestao: Gestao | None = None
    usuario_id: str | None = None


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    nome: str
    email: str | None = None
    perfil: str
    ativo: bool = True


class LoginIn(BaseModel):
    email: str
    senha: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioOut


class UsuarioCreate(BaseModel):
    nome: str
    email: str
    senha: str = Field(min_length=6)
    perfil: Literal["atendente", "supervisor", "admin"] = "atendente"


class UsuarioUpdate(BaseModel):
    nome: str | None = None
    perfil: Literal["atendente", "supervisor", "admin"] | None = None
    ativo: bool | None = None
    senha: str | None = Field(default=None, min_length=6)


class SerieMes(BaseModel):
    ano: int
    mes: int
    pendente: int
    tratativa: int
    concluido: int


class TopItem(BaseModel):
    nome: str
    total: int


class DashboardOut(BaseModel):
    total: int
    pendentes: int
    tratativa: int
    concluidas: int
    taxa_resolucao: float
    tempo_medio_devolutiva: float | None
    antigas: int = 0
    sla_dias: int = 7
    por_mes: list[SerieMes]
    top_clinicas: list[TopItem]
    top_motivos: list[TopItem]


class ClinicasOut(BaseModel):
    items: list[str]


class ImportResult(BaseModel):
    importados: int
    abas: int
    total: int
