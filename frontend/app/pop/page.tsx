'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { PopDashboardResponse, TopItem } from '@/lib/types';
import { formatNumero } from '@/lib/format';
import Kpi from '@/components/Kpi';
import ExportButtons from '@/components/ExportButtons';

function ListaBarras({ itens, alt }: { itens: TopItem[]; alt?: boolean }) {
  if (!itens || itens.length === 0) {
    return <div className="trat-empty">Sem dados.</div>;
  }
  const max = Math.max(1, ...itens.map((i) => i.total));
  return (
    <div className="hbars">
      {itens.map((i) => (
        <div className={`hbar${alt ? ' alt' : ''}`} key={i.nome}>
          <span className="nm" title={i.nome}>
            {i.nome || '—'}
          </span>
          <span className="track">
            <span
              className="fill"
              style={{ width: `${Math.max(3, (i.total / max) * 100)}%` }}
            />
          </span>
          <span className="num">{formatNumero(i.total)}</span>
        </div>
      ))}
    </div>
  );
}

function BarrasAno({ dados }: { dados: PopDashboardResponse['por_ano'] }) {
  if (!dados || dados.length === 0)
    return <div className="trat-empty">Sem dados.</div>;
  const max = Math.max(1, ...dados.map((d) => d.total));
  return (
    <div className="pop-anos">
      {dados.map((d) => (
        <div className="pop-ano" key={String(d.ano)}>
          <div className="pa-top">
            <span className="pa-label">{d.ano ?? 'Sem ano'}</span>
            <span className="pa-total">{formatNumero(d.total)}</span>
          </div>
          <div className="pa-track">
            <span
              className="pa-fill novos"
              style={{ width: `${(d.novos / max) * 100}%` }}
              title={`Novos: ${d.novos}`}
            />
            <span
              className="pa-fill atual"
              style={{ width: `${(d.atualizados / max) * 100}%` }}
              title={`Atualizados: ${d.atualizados}`}
            />
          </div>
          <div className="pa-leg">
            <span>
              <i className="dot novos" /> {d.novos} novos
            </span>
            <span>
              <i className="dot atual" /> {d.atualizados} atualizados
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PopDashboardPage() {
  const [dados, setDados] = useState<PopDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setErro(null);
    try {
      const d = await api.popsDashboard(signal);
      setDados(d);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setErro(
        e instanceof ApiError ? e.message : 'Não foi possível conectar à API.',
      );
      setDados(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    carregar(ctrl.signal);
    return () => ctrl.abort();
  }, [carregar]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Controle de POPs</h1>
          <div className="lead">
            POPs elaborados e atualizados — visão gerencial por ano e por área.
          </div>
        </div>
        <ExportButtons onExport={(f) => api.exportarPops(f)} />
      </div>

      {loading ? (
        <div className="state">
          <div className="spinner" />
          <div className="muted">Carregando indicadores…</div>
        </div>
      ) : erro ? (
        <div className="state">
          <div className="errbox">
            <h4>Falha ao carregar</h4>
            <p>{erro}</p>
            <button className="btn primary sm" onClick={() => carregar()}>
              Tentar novamente
            </button>
          </div>
        </div>
      ) : dados ? (
        <>
          <div className="section-title">
            <span className="bar" />
            <h3>Indicadores</h3>
          </div>
          <div className="kpis kpis-4">
            <Kpi label="Total de POPs" value={formatNumero(dados.total)} tone="total" />
            <Kpi label="Novos" value={formatNumero(dados.novos)} tone="ok" />
            <Kpi
              label="Atualizados"
              value={formatNumero(dados.atualizados)}
              tone="taxa"
            />
            <Kpi
              label="Período"
              value={dados.periodo || '—'}
              sub="anos com POPs"
              tone="tempo"
            />
          </div>

          <div className="section-title">
            <span className="bar" />
            <h3>Por ano e por área</h3>
          </div>
          <div className="grid-charts-2">
            <div className="card">
              <h4>POPs por ano</h4>
              <div className="csub">Novos e atualizados em cada ano.</div>
              <BarrasAno dados={dados.por_ano} />
            </div>
            <div className="card">
              <h4>POPs por área</h4>
              <div className="csub">Distribuição por área/processo.</div>
              <ListaBarras itens={dados.por_area} alt />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
