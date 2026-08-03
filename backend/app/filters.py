"""Filtros compartilhados entre /pendencias e /dashboard."""
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import Select
from sqlalchemy import func as safunc

from .models import Pendencia

SLA_DIAS = 7


@dataclass
class Filtros:
    modulo: str = "convenio"
    ano: int | None = None
    mes_de: int | None = None
    mes_ate: int | None = None
    status: str | None = None
    gestao: str | None = None
    clinica: str | None = None
    responsavel: str | None = None
    busca: str | None = None
    antigas: bool = False
    abertas: bool = False


def aplicar(stmt: Select, f: Filtros) -> Select:
    stmt = stmt.where(Pendencia.modulo == f.modulo)
    if f.ano:
        stmt = stmt.where(Pendencia.ano == f.ano)
    if f.mes_de:
        stmt = stmt.where(Pendencia.mes >= f.mes_de)
    if f.mes_ate:
        stmt = stmt.where(Pendencia.mes <= f.mes_ate)
    if f.status:
        stmt = stmt.where(Pendencia.status == f.status)
    if f.abertas:
        # Fila de trabalho: tudo que ainda não foi concluído.
        stmt = stmt.where(Pendencia.status != "concluido")
    if f.antigas:
        # Não concluídas em aberto há mais de SLA_DIAS dias.
        limite = date.today() - timedelta(days=SLA_DIAS)
        stmt = stmt.where(
            Pendencia.status != "concluido",
            Pendencia.data_pedido.is_not(None),
            Pendencia.data_pedido < limite,
        )
    if f.gestao:
        stmt = stmt.where(Pendencia.gestao == f.gestao)
    if f.clinica:
        stmt = stmt.where(Pendencia.clinica == f.clinica)
    if f.responsavel:
        stmt = stmt.where(Pendencia.responsavel == f.responsavel)
    if f.busca:
        termo = f"%{f.busca.lower()}%"
        stmt = stmt.where(
            safunc.lower(Pendencia.paciente).like(termo)
            | safunc.lower(Pendencia.guia).like(termo)
            | safunc.lower(Pendencia.clinica).like(termo)
            | safunc.lower(Pendencia.informacao_necessaria).like(termo)
            | safunc.lower(Pendencia.responsavel).like(termo)
        )
    return stmt
