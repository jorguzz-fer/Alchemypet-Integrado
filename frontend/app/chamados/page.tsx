'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { ChamadoDashboardResponse, TopItem } from '@/lib/types';
import { formatDecimal, formatNumero } from '@/lib/format';
import Kpi from '@/components/Kpi';
import PizzaMotivos from '@/components/PizzaMotivos';
import ExportButtons from '@/components/ExportButtons';

const COMPLEX_TONE: Record<string, string> = {
  Alta: 'pend',
  Média: 'trat',
  Baixa: 'ok',
};

function BarrasComplexidade({ itens }: { itens: TopItem[] }) {
  if (!itens || itens.length === 0)
    return <div className="trat-empty">Sem dados.</div>;
  const max = Math.max(1, ...itens.map((i) => i.total));
  const soma = itens.reduce((a, i) => a + i.total, 0);
  return (
    <div className="hbars">
      {itens.map((i) => {
        const pct = soma ? ((i.total / soma) * 100).toFixed(1) : '0';
        return (
          <div className={`hbar cx-${COMPLEX_TONE[i.nome] ?? 'total'}`} key={i.nome}>
            <span className="nm" title={i.nome}>
              {i.nome}
            </span>
            <span className="track">
              <span
                className="fill"
                style={{ width: `${Math.max(3, (i.total / max) * 100)}%` }}
              />
            </span>
            <span className="num">
              {formatNumero(i.total)} <em className="pz-pct">({pct}%)</em>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ListaMotivos({ itens }: { itens: TopItem[] }) {
  const dados = (itens ?? []).filter((i) => i.total > 0);
  if (dados.length === 0) return <div className="trat-empty">Sem dados.</div>;
  const max = Math.max(1, ...dados.map((i) => i.total));
  const soma = dados.reduce((a, i) => a + i.total, 0);
  return (
    <div className="hbars">
      {dados.map((i) => {
        const pct = soma ? ((i.total / soma) * 100).toFixed(1) : '0';
        return (
          <div className="hbar alt" key={i.nome}>
            <span className="nm" title={i.nome}>
              {i.nome}
            </span>
            <span className="track">
              <span
                className="fill"
                style={{ width: `${Math.max(3, (i.total / max) * 100)}%` }}
              />
            </span>
            <span className="num">
              {formatNumero(i.total)} <em className="pz-pct">({pct}%)</em>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ChamadosDashboardPage() {
  const [dados, setDados] = useState<ChamadoDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setErro(null);
    try {
      const d = await api.chamadosDashboard(signal);
      setDados(d);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setErro(e instanceof ApiError ? e.message : 'Não foi possível conectar à API.');
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
          <h1>Chamados por e-mail</h1>
          <div className="lead">
            Distribuição e resolução dos chamados recebidos por e-mail.
          </div>
        </div>
        <ExportButtons onExport={(f) => api.exportarChamados(f)} />
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
            <Kpi label="Total de chamados" value={formatNumero(dados.total)} tone="total" />
            <Kpi label="Abertos" value={formatNumero(dados.abertos)} tone="pend" />
            <Kpi label="Resolvidos" value={formatNumero(dados.resolvidos)} tone="ok" />
            <Kpi
              label="Taxa de resolução"
              value={`${formatDecimal(dados.taxa_resolucao, 1)}%`}
              tone="taxa"
            />
          </div>

          <div className="section-title">
            <span className="bar" />
            <h3>Distribuição das solicitações por motivo</h3>
          </div>
          <div className="card">
            <h4>Distribuição das solicitações por motivo</h4>
            <div className="csub">
              Participação de cada motivo nas {formatNumero(dados.total)} solicitações
              registradas.
            </div>
            <PizzaMotivos
              itens={dados.por_motivo}
              maxFatias={6}
              legenda="baixo"
              centro={formatNumero(dados.total)}
              centroSub="chamados"
            />
          </div>

          <div className="grid-charts-2">
            <div className="card">
              <h4>Por complexidade</h4>
              <div className="csub">Volume de chamados por nível de complexidade.</div>
              <BarrasComplexidade itens={dados.por_complexidade} />
            </div>
            <div className="card">
              <h4>Chamados por motivo</h4>
              <div className="csub">Detalhamento completo (todos os motivos).</div>
              <ListaMotivos itens={dados.por_motivo} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
