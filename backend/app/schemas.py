"""Schemas Pydantic (entrada/saída da API)."""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

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
    aba: str
    updated_at: datetime


class PendenciaCreate(BaseModel):
    guia: str = ""
    paciente: str = ""
    cod_clinica: str = ""
    clinica: str = ""
    informacao_necessaria: str
    responsavel: str = ""
    ano: int | None = None
    mes: int | None = None
    data_pedido: date | None = None


class PendenciaUpdate(BaseModel):
    gestao: Gestao | None = None
    status: Status | None = None
    responsavel: str | None = None


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
    perfil: str


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
    por_mes: list[SerieMes]
    top_clinicas: list[TopItem]
    top_motivos: list[TopItem]


class ClinicasOut(BaseModel):
    items: list[str]


class ImportResult(BaseModel):
    importados: int
    abas: int
    total: int
