'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { FiltrosPedidos, PedidosResponse } from '@/lib/types';
import { formatData, formatDataHora, formatNumero } from '@/lib/format';
import ColunaOrdenavel from '@/components/ColunaOrdenavel';

const PER_PAGE = 25;
const INICIAIS: FiltrosPedidos = { busca: '', data_de: '', data_ate: '', urgente: false, page: 1, per_page: PER_PAGE };

export default function PedidosPage() {
  const router = useRouter();
  const [filtros, setFiltros] = useState<FiltrosPedidos>(INICIAIS);
  const [busca, setBusca] = useState('');
  const [resp, setResp] = useState<PedidosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(async (f: FiltrosPedidos, signal?: AbortSignal) => {
    setLoading(true);
    setErro(null);
    try {
      setResp(await api.listPedidos({ ...f, urgente: f.urgente || undefined }, signal));
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setErro(e instanceof ApiError ? e.message : 'Não foi possível conectar à API.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    carregar(filtros, ctrl.signal);
    return () => ctrl.abort();
  }, [filtros, carregar]);

  const items = resp?.items ?? [];
  const total = resp?.total ?? 0;
  const page = resp?.page ?? 1;
  const totalPaginas = Math.max(1, Math.ceil(total / (resp?.per_page ?? PER_PAGE)));
  const aplicar = (p: Partial<FiltrosPedidos>) => setFiltros((f) => ({ ...f, ...p, page: 1 }));
  const ordProps = {
    sort: filtros.sort,
    dir: filtros.dir,
    padrao: { sort: 'numero', dir: 'desc' as const },
    onChange: (sort: string, dir: 'asc' | 'desc') => aplicar({ sort, dir }),
  };

  async function exportar() {
    setExportando(true);
    try {
      const { page: _a, per_page: _b, ...q } = { ...filtros, urgente: filtros.urgente || undefined };
      await api.exportarLista('encaminhamentos', q, 'pedidos-de-exame.xlsx');
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível gerar a planilha.');
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Pedidos de exame</h1>
          <div className="lead">Formulários de encaminhamento preenchidos no sistema.</div>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={exportar} disabled={exportando || total === 0}>
            {exportando ? 'Gerando…' : 'Exportar planilha'}
          </button>
          <Link className="btn primary" href="/encaminhamento/novo">
            + Novo pedido
          </Link>
        </div>
      </div>

      <form
        className="crm-filtros"
        onSubmit={(e) => {
          e.preventDefault();
          aplicar({ busca });
        }}
      >
        <input
          className="crm-busca"
          aria-label="Buscar pedido"
          placeholder="Nº do pedido, clínica, paciente, responsável ou veterinário"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <label className="sel-porpagina">
          De
          <input type="date" value={filtros.data_de ?? ''} onChange={(e) => aplicar({ data_de: e.target.value })} />
        </label>
        <label className="sel-porpagina">
          até
          <input type="date" value={filtros.data_ate ?? ''} onChange={(e) => aplicar({ data_ate: e.target.value })} />
        </label>
        <label className="sel-porpagina">
          <input type="checkbox" checked={Boolean(filtros.urgente)} onChange={(e) => aplicar({ urgente: e.target.checked })} />
          Só urgentes
        </label>
        <button className="btn primary sm" type="submit">Buscar</button>
      </form>

      <div className="tablewrap">
        <div className="tabletools">
          <div className="t-left">
            Pedidos <span className="count">{formatNumero(total)}</span>
          </div>
          <div className="t-right muted">Página {page} de {totalPaginas}</div>
        </div>
        <div className="scroll">
          <table className="crm-tabela">
            <thead>
              <tr>
                <ColunaOrdenavel campo="numero" label="Pedido" inicial="desc" {...ordProps} />
                <ColunaOrdenavel campo="created_at" label="Criado em" inicial="desc" {...ordProps} />
                <ColunaOrdenavel campo="clinica" label="Clínica" {...ordProps} />
                <ColunaOrdenavel campo="paciente" label="Paciente" {...ordProps} />
                <th>Exames</th>
                <ColunaOrdenavel campo="data_coleta" label="Coleta" inicial="desc" {...ordProps} />
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {loading && !resp ? (
                <tr><td className="empty-row" colSpan={7}><div className="spinner" /></td></tr>
              ) : erro ? (
                <tr><td className="empty-row" colSpan={7} style={{ color: 'var(--erro)' }}>{erro}</td></tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="empty-row" colSpan={7}>
                    Nenhum pedido ainda. <Link href="/encaminhamento/novo">Criar o primeiro</Link>
                  </td>
                </tr>
              ) : (
                items.map((p) => (
                  <tr key={p.id} className="conta-linha" onClick={() => router.push(`/encaminhamento/${p.id}`)}>
                    <td className="nowrap">
                      <Link href={`/encaminhamento/${p.id}`} onClick={(e) => e.stopPropagation()}>
                        <b>{String(p.numero).padStart(8, '0')}</b>
                      </Link>
                      {p.urgente ? <span className="cxtag alta" style={{ marginLeft: 6 }}>Urgente</span> : null}
                    </td>
                    <td className="nowrap">{formatDataHora(p.created_at)}</td>
                    <td className="wrap">{p.clinica}</td>
                    <td className="wrap">{p.paciente}</td>
                    <td className="wrap">{p.codigos.join(', ')}</td>
                    <td className="nowrap">{formatData(p.data_coleta)}</td>
                    <td>
                      <span className={`stag ${p.recebido ? 'resolvido' : 'aberto'}`}>
                        {p.recebido ? 'Recebido no lab' : 'Aguardando amostra'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="pager">
          <div className="pinfo">{formatNumero(total)} pedido(s)</div>
          <div className="pbtns">
            <button onClick={() => setFiltros((f) => ({ ...f, page: Math.max(1, page - 1) }))} disabled={page <= 1}>
              Anterior
            </button>
            <span className="cur">{page} / {totalPaginas}</span>
            <button onClick={() => setFiltros((f) => ({ ...f, page: Math.min(totalPaginas, page + 1) }))}
              disabled={page >= totalPaginas}>
              Próxima
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
