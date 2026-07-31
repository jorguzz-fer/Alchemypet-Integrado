'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type {
  FiltrosPendencias,
  Modulo,
  PendenciasResponse,
  StatusPlanilha,
} from '@/lib/types';
import { formatNumero, labelPeriodo } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';

const PER_PAGE = 8;

interface Props {
  modulo: Modulo;
  // Filtros atuais do dashboard (ano/mês/gestão) — status é definido pelo tipo.
  filtrosBase: FiltrosPendencias;
  // Recorte do indicador clicado.
  tipo: {
    label: string;
    status?: StatusPlanilha;
    antigas?: boolean;
  };
  onClose: () => void;
}

export default function DetalheIndicador({
  modulo,
  filtrosBase,
  tipo,
  onClose,
}: Props) {
  const [resp, setResp] = useState<PendenciasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Volta à página 1 quando muda o recorte.
  useEffect(() => {
    setPage(1);
  }, [tipo.label]);

  const carregar = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setErro(null);
      try {
        const query: FiltrosPendencias = {
          modulo,
          ano: filtrosBase.ano,
          mes_de: filtrosBase.mes_de,
          mes_ate: filtrosBase.mes_ate,
          gestao: filtrosBase.gestao,
          status: tipo.status,
          page,
          per_page: PER_PAGE,
        };
        if (tipo.antigas) query.antigas = true;
        const r = await api.listPendencias(query, signal);
        setResp(r);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setErro(
          e instanceof ApiError ? e.message : 'Não foi possível carregar.',
        );
      } finally {
        setLoading(false);
      }
    },
    [modulo, filtrosBase, tipo.status, tipo.antigas, page],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    carregar(ctrl.signal);
    return () => ctrl.abort();
  }, [carregar]);

  const items = resp?.items ?? [];
  const total = resp?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="detalhe-card">
      <div className="detalhe-head">
        <div>
          <h4>
            Detalhe · {tipo.label}
            {resp ? (
              <span className="count" style={{ marginLeft: 8 }}>
                {formatNumero(total)}
              </span>
            ) : null}
          </h4>
          <div className="csub">
            Registros do indicador selecionado (respeita os filtros acima).
          </div>
        </div>
        <button className="btn ghost sm" onClick={onClose}>
          Fechar
        </button>
      </div>

      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Período</th>
              <th>Guia</th>
              <th>Paciente</th>
              <th>Clínica</th>
              <th>Informação necessária</th>
              <th>Responsável</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="empty-row" colSpan={7}>
                  <div className="spinner" />
                  Carregando…
                </td>
              </tr>
            ) : erro ? (
              <tr>
                <td
                  className="empty-row"
                  colSpan={7}
                  style={{ color: 'var(--erro)' }}
                >
                  {erro}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="empty-row" colSpan={7}>
                  Nenhum registro.
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.id}>
                  <td className="nowrap">{labelPeriodo(p.ano, p.mes)}</td>
                  <td className="nowrap">{p.guia || '—'}</td>
                  <td>{p.paciente || '—'}</td>
                  <td className="wrap">{p.clinica || '—'}</td>
                  <td className="wrap">{p.informacao_necessaria || '—'}</td>
                  <td>{p.responsavel || '—'}</td>
                  <td>
                    <StatusBadge status={p.status} />
                    {p.dias_em_aberto != null ? (
                      <div
                        className={`aging${
                          p.dias_em_aberto > 7
                            ? ' aging-alto'
                            : p.dias_em_aberto > 3
                              ? ' aging-medio'
                              : ''
                        }`}
                      >
                        {p.dias_em_aberto}d em aberto
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > PER_PAGE ? (
        <div className="pager">
          <div className="pinfo">
            Página {page} de {totalPaginas}
          </div>
          <div className="pbtns">
            <button onClick={() => setPage(1)} disabled={page <= 1}>
              «
            </button>
            <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
              Anterior
            </button>
            <span className="cur">
              {page} / {totalPaginas}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPaginas}
            >
              Próxima
            </button>
            <button
              onClick={() => setPage(totalPaginas)}
              disabled={page >= totalPaginas}
            >
              »
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
