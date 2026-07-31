'use client';

import { useCallback, useEffect, useState } from 'react';
import { notFound, useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type {
  DashboardResponse,
  FiltrosPendencias,
  StatusPlanilha,
  TopItem,
} from '@/lib/types';
import { formatDecimal, formatNumero } from '@/lib/format';
import { infoModulo, moduloValido } from '@/lib/modulos';
import Kpi from '@/components/Kpi';
import Filtros from '@/components/Filtros';
import BarrasMensais from '@/components/BarrasMensais';
import DetalheIndicador from '@/components/DetalheIndicador';

const FILTROS_INICIAIS: FiltrosPendencias = {
  ano: '',
  mes_de: '',
  mes_ate: '',
  status: '',
  gestao: '',
};

// Recorte de cada indicador clicável para o painel de detalhe.
type DetalheKey =
  | 'total'
  | 'pendentes'
  | 'tratativa'
  | 'concluidas'
  | 'taxa'
  | 'tempo'
  | 'antigas';

const DETALHES: Record<
  DetalheKey,
  { label: string; status?: StatusPlanilha; antigas?: boolean }
> = {
  total: { label: 'Total' },
  pendentes: { label: 'Pendentes', status: 'pendente' },
  tratativa: { label: 'Em tratativa', status: 'tratativa' },
  concluidas: { label: 'Concluídas', status: 'concluido' },
  taxa: { label: 'Concluídas (taxa de resolução)', status: 'concluido' },
  tempo: { label: 'Concluídas (tempo de devolutiva)', status: 'concluido' },
  antigas: { label: 'Antigas em aberto', antigas: true },
};

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

export default function DashboardPage() {
  const params = useParams();
  const modulo = params.modulo as string;
  if (!moduloValido(modulo)) notFound();
  const info = infoModulo(modulo);

  const [filtros, setFiltros] = useState<FiltrosPendencias>(FILTROS_INICIAIS);
  const [dados, setDados] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheKey | null>(null);

  const alternarDetalhe = useCallback((key: DetalheKey) => {
    setDetalhe((prev) => (prev === key ? null : key));
  }, []);

  // Trocar de módulo limpa os filtros e fecha o detalhe.
  useEffect(() => {
    setFiltros(FILTROS_INICIAIS);
    setDetalhe(null);
  }, [modulo]);

  // Reaplicar filtros fecha o detalhe (o recorte pode não fazer mais sentido).
  useEffect(() => {
    setDetalhe(null);
  }, [filtros]);

  const carregar = useCallback(
    async (f: FiltrosPendencias, signal?: AbortSignal) => {
      setLoading(true);
      setErro(null);
      try {
        const d = await api.dashboard({ ...f, modulo }, signal);
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
    },
    [modulo],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    carregar(filtros, ctrl.signal);
    return () => ctrl.abort();
  }, [filtros, carregar]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Visão geral</h1>
          <div className="lead">
            Indicadores das {info.descricao} no período selecionado.
          </div>
        </div>
      </div>

      <Filtros
        value={filtros}
        onApply={setFiltros}
        resumo={
          dados ? (
            <>
              <b>{formatNumero(dados.total)}</b> pendências no filtro atual
            </>
          ) : null
        }
      />

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
            <button className="btn primary sm" onClick={() => carregar(filtros)}>
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
          <div className="kpis">
            <Kpi
              label="Total"
              value={formatNumero(dados.total)}
              tone="total"
              onClick={() => alternarDetalhe('total')}
              ativo={detalhe === 'total'}
            />
            <Kpi
              label="Pendentes"
              value={formatNumero(dados.pendentes)}
              tone="pend"
              onClick={() => alternarDetalhe('pendentes')}
              ativo={detalhe === 'pendentes'}
            />
            <Kpi
              label="Em tratativa"
              value={formatNumero(dados.tratativa)}
              tone="trat"
              onClick={() => alternarDetalhe('tratativa')}
              ativo={detalhe === 'tratativa'}
            />
            <Kpi
              label="Concluídas"
              value={formatNumero(dados.concluidas)}
              tone="ok"
              onClick={() => alternarDetalhe('concluidas')}
              ativo={detalhe === 'concluidas'}
            />
            <Kpi
              label="Taxa de resolução"
              value={`${formatDecimal(dados.taxa_resolucao, 1)}%`}
              tone="taxa"
              onClick={() => alternarDetalhe('taxa')}
              ativo={detalhe === 'taxa'}
            />
            <Kpi
              label="Tempo médio devolutiva"
              value={
                dados.tempo_medio_devolutiva === null
                  ? '—'
                  : `${formatDecimal(dados.tempo_medio_devolutiva, 1)} d`
              }
              sub="dias até devolutiva"
              tone="tempo"
              onClick={() => alternarDetalhe('tempo')}
              ativo={detalhe === 'tempo'}
            />
            <Kpi
              label="Antigas"
              value={formatNumero(dados.antigas)}
              sub={`em aberto há mais de ${dados.sla_dias} dias`}
              tone="antigas"
              onClick={() => alternarDetalhe('antigas')}
              ativo={detalhe === 'antigas'}
            />
          </div>

          {detalhe ? (
            <DetalheIndicador
              modulo={modulo}
              filtrosBase={filtros}
              tipo={DETALHES[detalhe]}
              onClose={() => setDetalhe(null)}
            />
          ) : null}

          <div className="section-title">
            <span className="bar" />
            <h3>Evolução mensal</h3>
          </div>
          <div className="grid-charts">
            <div className="card">
              <h4>Pendências por mês</h4>
              <div className="csub">
                Empilhado por status (pendente, em tratativa, concluído).
              </div>
              <BarrasMensais dados={dados.por_mes} />
            </div>
            <div className="card">
              <h4>Distribuição atual</h4>
              <div className="csub">Composição do total filtrado.</div>
              <ListaBarras
                itens={[
                  { nome: 'Pendentes', total: dados.pendentes },
                  { nome: 'Em tratativa', total: dados.tratativa },
                  { nome: 'Concluídas', total: dados.concluidas },
                ]}
              />
            </div>
          </div>

          <div className="grid-charts-2">
            <div className="card">
              <h4>Top clínicas</h4>
              <div className="csub">Clínicas com mais pendências.</div>
              <ListaBarras itens={dados.top_clinicas} />
            </div>
            <div className="card">
              <h4>Top motivos</h4>
              <div className="csub">Informações necessárias mais frequentes.</div>
              <ListaBarras itens={dados.top_motivos} alt />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
