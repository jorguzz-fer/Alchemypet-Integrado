"""Endpoint de dashboard: KPIs e agregações do conjunto filtrado."""
import re
import unicodedata
from collections import Counter, defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..filters import Filtros, aplicar
from ..models import Pendencia
from ..schemas import DashboardOut, SerieMes, TopItem
from .pendencias import _filtros

router = APIRouter(tags=["dashboard"])


def _canon(s: str) -> str:
    """Chave de agrupamento: sem acento, minúsculo, espaços normalizados."""
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip().lower()


def _top(valores, limite: int = 8, corta: int | None = None) -> list[TopItem]:
    """Agrupa por chave canônica (une variações de maiúsc/acento/espaço),
    soma os totais e usa a grafia mais frequente como rótulo."""
    grupos: dict[str, dict] = {}
    for v in valores:
        if not v:
            continue
        k = _canon(v)
        g = grupos.setdefault(k, {"total": 0, "labels": Counter()})
        g["total"] += 1
        g["labels"][v] += 1
    itens = []
    for g in grupos.values():
        label = g["labels"].most_common(1)[0][0]
        if corta:
            label = label[:corta]
        itens.append(TopItem(nome=label, total=g["total"]))
    itens.sort(key=lambda x: -x.total)
    return itens[:limite]


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(f: Filtros = Depends(_filtros), db: Session = Depends(get_db)):
    rows = list(db.scalars(aplicar(select(Pendencia), f)))
    total = len(rows)
    pendentes = sum(1 for r in rows if r.status == "pendente")
    tratativa = sum(1 for r in rows if r.status == "tratativa")
    concluidas = sum(1 for r in rows if r.status == "concluido")
    taxa = round(concluidas / total * 100, 1) if total else 0.0

    tempos = []
    for r in rows:
        if r.data_pedido and r.data_devolutiva:
            d = (r.data_devolutiva - r.data_pedido).days
            if 0 <= d < 400:
                tempos.append(d)
    tempo_medio = round(sum(tempos) / len(tempos), 1) if tempos else None

    # Pendências "antigas": não concluídas há mais de SLA_DIAS dias.
    sla_dias = 7
    antigas = sum(1 for r in rows if (d := r.dias_em_aberto) is not None and d > sla_dias)

    # Série mensal (últimos 18 meses do conjunto)
    por_mes = defaultdict(lambda: {"pendente": 0, "tratativa": 0, "concluido": 0})
    for r in rows:
        if r.ano and r.mes:
            por_mes[(r.ano, r.mes)][r.status] += 1
    chaves = sorted(por_mes.keys())[-18:]
    serie = [SerieMes(ano=a, mes=m, **por_mes[(a, m)]) for (a, m) in chaves]

    top_clinicas = _top((r.clinica for r in rows), 8)
    top_motivos = _top((r.informacao_necessaria for r in rows), 8, corta=80)

    return DashboardOut(
        total=total,
        pendentes=pendentes,
        tratativa=tratativa,
        concluidas=concluidas,
        taxa_resolucao=taxa,
        tempo_medio_devolutiva=tempo_medio,
        antigas=antigas,
        sla_dias=sla_dias,
        por_mes=serie,
        top_clinicas=top_clinicas,
        top_motivos=top_motivos,
    )
