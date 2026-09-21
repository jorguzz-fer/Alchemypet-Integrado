"""Manutenção de dados (somente admin).

Limpeza de registros antigos por data limite — chamados e pendências
(convênio/particular). POPs nunca são afetados por este módulo.

Critério de "antigo" (registro entra na limpeza quando):
- Chamado: `data <= data_ate`; sem data → só quando `incluir_sem_data`.
- Pendência: `data_pedido <= data_ate`; sem data_pedido mas com ano/mês →
  só quando o MÊS INTEIRO é anterior ou igual à data limite (conservador:
  um registro de set/2026 sem dia não entra numa limpeza "até 01/09/2026");
  sem nenhuma data → só quando `incluir_sem_data`.
As tratativas das pendências apagadas são removidas junto.
"""
import calendar
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Chamado, Pendencia, Tratativa
from ..security import exige_admin

router = APIRouter(prefix="/manutencao", tags=["manutencao"], dependencies=[Depends(exige_admin)])

ALVOS = ("chamados", "convenio", "particular")
_ALIAS = {"triagem": "particular"}
PALAVRA_CONFIRMACAO = "APAGAR"


class LimpezaPrevia(BaseModel):
    data_ate: date
    incluir_sem_data: bool
    chamados: int
    convenio: int
    particular: int
    tratativas: int


class LimpezaBody(BaseModel):
    data_ate: date
    incluir_sem_data: bool = False
    alvos: list[str] = Field(default_factory=lambda: list(ALVOS))
    confirmacao: str = ""


class LimpezaResultado(BaseModel):
    chamados: int
    convenio: int
    particular: int
    tratativas: int


def _cond_chamado(data_ate: date, incluir_sem_data: bool):
    cond = Chamado.data <= data_ate
    if incluir_sem_data:
        cond = or_(cond, Chamado.data.is_(None))
    return cond


def _ultimo_mes_inteiro(data_ate: date) -> tuple[int, int]:
    """(ano, mês) do último mês inteiramente coberto por `data_ate`."""
    if data_ate.day == calendar.monthrange(data_ate.year, data_ate.month)[1]:
        return data_ate.year, data_ate.month
    if data_ate.month == 1:
        return data_ate.year - 1, 12
    return data_ate.year, data_ate.month - 1


def _cond_pendencia(modulo: str, data_ate: date, incluir_sem_data: bool):
    ano_c, mes_c = _ultimo_mes_inteiro(data_ate)
    sem_dia = Pendencia.data_pedido.is_(None)
    por_mes = sem_dia & Pendencia.ano.isnot(None) & or_(
        Pendencia.ano < ano_c,
        (Pendencia.ano == ano_c) & Pendencia.mes.isnot(None) & (Pendencia.mes <= mes_c),
    )
    cond = or_(Pendencia.data_pedido <= data_ate, por_mes)
    if incluir_sem_data:
        cond = or_(cond, sem_dia & Pendencia.ano.is_(None))
    return (Pendencia.modulo == modulo) & cond


def _contar(db: Session, modelo, cond) -> int:
    return int(db.scalar(select(func.count()).select_from(modelo).where(cond)) or 0)


def _contar_tratativas(db: Session, cond) -> int:
    ids = select(Pendencia.id).where(cond)
    return int(db.scalar(select(func.count()).select_from(Tratativa).where(Tratativa.pendencia_id.in_(ids))) or 0)


@router.get("/previa", response_model=LimpezaPrevia)
def previa(data_ate: date, incluir_sem_data: bool = False, db: Session = Depends(get_db)):
    c_conv = _cond_pendencia("convenio", data_ate, incluir_sem_data)
    c_tri = _cond_pendencia("particular", data_ate, incluir_sem_data)
    return LimpezaPrevia(
        data_ate=data_ate,
        incluir_sem_data=incluir_sem_data,
        chamados=_contar(db, Chamado, _cond_chamado(data_ate, incluir_sem_data)),
        convenio=_contar(db, Pendencia, c_conv),
        particular=_contar(db, Pendencia, c_tri),
        tratativas=_contar_tratativas(db, or_(c_conv, c_tri)),
    )


@router.post("/limpar", response_model=LimpezaResultado)
def limpar(body: LimpezaBody, db: Session = Depends(get_db)):
    if body.confirmacao.strip().upper() != PALAVRA_CONFIRMACAO:
        raise HTTPException(400, f'Digite "{PALAVRA_CONFIRMACAO}" para confirmar a limpeza')
    alvos = {_ALIAS.get(a, a) for a in body.alvos if _ALIAS.get(a, a) in ALVOS}
    if not alvos:
        raise HTTPException(400, "Selecione ao menos um conjunto de registros")

    res = {"chamados": 0, "convenio": 0, "particular": 0, "tratativas": 0}
    for modulo in ("convenio", "particular"):
        if modulo not in alvos:
            continue
        cond = _cond_pendencia(modulo, body.data_ate, body.incluir_sem_data)
        ids = select(Pendencia.id).where(cond)
        res["tratativas"] += db.execute(
            delete(Tratativa).where(Tratativa.pendencia_id.in_(ids))
        ).rowcount
        res[modulo] = db.execute(delete(Pendencia).where(cond)).rowcount
    if "chamados" in alvos:
        res["chamados"] = db.execute(
            delete(Chamado).where(_cond_chamado(body.data_ate, body.incluir_sem_data))
        ).rowcount
    db.commit()
    return LimpezaResultado(**res)
