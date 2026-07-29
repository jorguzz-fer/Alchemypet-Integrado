"""Endpoint de dashboard: KPIs e agregações do conjunto filtrado."""
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

    top_clinicas = Counter(r.clinica for r in rows if r.clinica)
    top_motivos = Counter(r.informacao_necessaria[:80] for r in rows if r.informacao_necessaria)

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
        top_clinicas=[TopItem(nome=n, total=t) for n, t in top_clinicas.most_common(8)],
        top_motivos=[TopItem(nome=n, total=t) for n, t in top_motivos.most_common(8)],
    )
