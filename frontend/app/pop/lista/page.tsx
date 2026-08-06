'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type {
  FiltrosPop,
  Pop,
  PopDashboardResponse,
  PopsResponse,
} from '@/lib/types';
import { formatNumero } from '@/lib/format';
import Kpi from '@/components/Kpi';
import PopFormModal from '@/components/PopFormModal';
import OrdenarSelect from '@/components/OrdenarSelect';

const PER_PAGE = 25;

const FILTROS_INICIAIS: FiltrosPop = {
  ano: '',
  tipo: '',
  area: '',
  busca: '',
  ordem: 'recentes',
  page: 1,
  per_page: PER_PAGE,
};

export default function PopListaPage() {
  const [filtros, setFiltros] = useState<FiltrosPop>(FILTROS_INICIAIS);
  const [busca, setBusca] = useState('');
  const [resp, setResp] = useState<PopsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [areas, setAreas] = useState<string[]>([]);
  const [dash, setDash] = useState<PopDashboardResponse | null>(null);
  const [form, setForm] = useState<'novo' | Pop | null>(null);
  const [excluindo, setExcluindo] = useState<Record<string, boolean>>({});
  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .popsAreas(ctrl.signal)
      .then(setAreas)
      .catch(() => {
        /* opcional */
      });
    return () => ctrl.abort();
  }, [resp]);

  // KPIs globais (não dependem dos filtros da lista).
  const carregarDash = useCallback(async (signal?: AbortSignal) => {
    try {
      const d = await api.popsDashboard(signal);
      setDash(d);
    } catch {
      /* KPIs indisponíveis: mantém o último valor */
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    carregarDash(ctrl.signal);
    return () => ctrl.abort();
  }, [carregarDash]);

  const carregar = useCallback(async (f: FiltrosPop, signal?: AbortSignal) => {
    setLoading(true);
    setErro(null);
    try {
      const r = await api.listPops({ ...f, per_page: f.per_page ?? PER_PAGE }, signal);
      setResp(r);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setErro(
        e instanceof ApiError ? e.message : 'Não foi possível conectar à API.',
      );
      setResp(null);
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
  const page = resp?.page ?? filtros.page ?? 1;
  const perPage = resp?.per_page ?? PER_PAGE;
  const totalPaginas = Math.max(1, Math.ceil(total / perPage));

  function aplicar(patch: Partial<FiltrosPop>) {
    setFiltros((f) => ({ ...f, ...patch, page: 1 }));
  }
  function irPara(p: number) {
    setFiltros((f) => ({ ...f, page: Math.min(Math.max(1, p), totalPaginas) }));
  }

  async function importar(file: File) {
    setImportando(true);
    setAviso(null);
    try {
      const r = await api.importarPops(file);
      setAviso(
        `Importação concluída: ${formatNumero(r.importados)} novo(s) POP(s), total ${formatNumero(r.total)}.`,
      );
      setFiltros((f) => ({ ...f, page: 1 }));
      await carregar({ ...filtros, page: 1 });
      await carregarDash();
    } catch (e) {
      setAviso(
        e instanceof ApiError ? e.message : 'Não foi possível importar a planilha.',
      );
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function excluir(p: Pop) {
    const ok = window.confirm(
      `Excluir o POP ${p.numero || '—'} (${p.nome})?\n\nEsta ação não pode ser desfeita.`,
    );
    if (!ok) return;
    setExcluindo((s) => ({ ...s, [p.id]: true }));
    try {
      await api.deletePop(p.id);
      setAviso('POP excluído.');
      await carregar(filtros);
      await carregarDash();
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : 'Falha ao excluir o POP.');
    } finally {
      setExcluindo((s) => {
        const n = { ...s };
        delete n[p.id];
        return n;
      });
    }
  }

  async function aposSalvar(p: Pop) {
    const criacao = form === 'novo';
    setForm(null);
    setAviso(criacao ? `POP criado (${p.nome}).` : `POP atualizado (${p.nome}).`);
    if (criacao) setFiltros((f) => ({ ...f, page: 1 }));
    await carregar(criacao ? { ...filtros, page: 1 } : filtros);
    await carregarDash();
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Lista de POPs</h1>
          <div className="lead">Cadastro e manutenção dos POPs elaborados e atualizados.</div>
        </div>
        <div className="actions">
          <button
            className="btn ghost"
            onClick={() => fileRef.current?.click()}
            disabled={importando}
          >
            {importando ? 'Importando…' : 'Importar planilha'}
          </button>
          <button className="btn primary" onClick={() => setForm('novo')}>
            + Novo POP
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importar(f);
            }}
          />
        </div>
      </div>

      {dash ? (
        <div className="kpis kpis-4 kpis-compact">
          <Kpi label="Total de POPs" value={formatNumero(dash.total)} tone="total" />
          <Kpi label="Novos" value={formatNumero(dash.novos)} tone="ok" />
          <Kpi label="Atualizados" value={formatNumero(dash.atualizados)} tone="taxa" />
          <Kpi
            label="Período"
            value={dash.periodo || '—'}
            sub="anos com POPs"
            tone="tempo"
          />
        </div>
      ) : null}

      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          aplicar({ busca });
        }}
      >
        <div className="fgroup">
          <label htmlFor="pop-f-ano">Ano</label>
          <select
            id="pop-f-ano"
            value={String(filtros.ano ?? '')}
            onChange={(e) => aplicar({ ano: e.target.value })}
          >
            <option value="">Todos</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
        </div>
        <div className="fgroup">
          <label htmlFor="pop-f-tipo">Tipo</label>
          <select
            id="pop-f-tipo"
            value={filtros.tipo ?? ''}
            onChange={(e) => aplicar({ tipo: e.target.value as FiltrosPop['tipo'] })}
          >
            <option value="">Todos</option>
            <option value="novo">Novos</option>
            <option value="atualizado">Atualizados</option>
          </select>
        </div>
        <div className="fgroup">
          <label htmlFor="pop-f-area">Área</label>
          <select
            id="pop-f-area"
            value={filtros.area ?? ''}
            onChange={(e) => aplicar({ area: e.target.value })}
          >
            <option value="">Todas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="fgroup wide">
          <label htmlFor="pop-f-busca">Busca</label>
          <input
            id="pop-f-busca"
            value={busca}
            placeholder="Nº ou nome do POP"
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="actions">
          <div className="left">
            {resp ? (
              <>
                <b>{formatNumero(total)}</b> POP(s) no filtro atual
              </>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => {
                setBusca('');
                setFiltros(FILTROS_INICIAIS);
              }}
            >
              Limpar
            </button>
            <button type="submit" className="btn primary sm">
              Aplicar filtros
            </button>
          </div>
        </div>
      </form>

      {aviso ? (
        <div className="card" style={{ marginTop: 14, fontSize: '.85rem' }}>
          {aviso}
        </div>
      ) : null}

      <div className="tablewrap">
        <div className="tabletools">
          <div className="t-left">
            POPs
            <span className="count">{formatNumero(total)}</span>
          </div>
          <div className="t-right">
            <OrdenarSelect
              value={filtros.ordem ?? 'recentes'}
              onChange={(v) => aplicar({ ordem: v as FiltrosPop['ordem'] })}
            />
            <span className="muted">
              Página {page} de {totalPaginas}
            </span>
          </div>
        </div>

        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Nº POP</th>
                <th>Nome</th>
                <th>Ano</th>
                <th>Tipo</th>
                <th>Área</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="empty-row" colSpan={6}>
                    <div className="spinner" />
                    Carregando POPs…
                  </td>
                </tr>
              ) : erro ? (
                <tr>
                  <td className="empty-row" colSpan={6}>
                    <div style={{ color: 'var(--erro)', fontWeight: 700 }}>{erro}</div>
                    <button
                      className="btn primary sm"
                      style={{ marginTop: 12 }}
                      onClick={() => carregar(filtros)}
                    >
                      Tentar novamente
                    </button>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="empty-row" colSpan={6}>
                    Nenhum POP para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                items.map((p) => (
                  <tr key={p.id}>
                    <td className="nowrap">{p.numero || '—'}</td>
                    <td className="wrap">{p.nome || '—'}</td>
                    <td className="nowrap">{p.ano ?? '—'}</td>
                    <td>
                      <span className={`pop-tag ${p.tipo}`}>
                        {p.tipo === 'novo' ? 'Novo' : 'Atualizado'}
                      </span>
                    </td>
                    <td className="wrap">{p.area || '—'}</td>
                    <td className="nowrap">
                      <div className="row-acoes">
                        <button className="notebtn" onClick={() => setForm(p)}>
                          Editar
                        </button>
                        <button
                          className="notebtn danger"
                          onClick={() => excluir(p)}
                          disabled={!!excluindo[p.id]}
                        >
                          {excluindo[p.id] ? '…' : 'Excluir'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <div className="pinfo">
            Mostrando {items.length > 0 ? (page - 1) * perPage + 1 : 0}
            {'–'}
            {(page - 1) * perPage + items.length} de {formatNumero(total)}
          </div>
          <div className="pbtns">
            <button onClick={() => irPara(1)} disabled={page <= 1}>
              «
            </button>
            <button onClick={() => irPara(page - 1)} disabled={page <= 1}>
              Anterior
            </button>
            <span className="cur">
              {page} / {totalPaginas}
            </span>
            <button onClick={() => irPara(page + 1)} disabled={page >= totalPaginas}>
              Próxima
            </button>
            <button onClick={() => irPara(totalPaginas)} disabled={page >= totalPaginas}>
              »
            </button>
          </div>
        </div>
      </div>

      {form ? (
        <PopFormModal
          pop={form === 'novo' ? null : form}
          areas={areas}
          onClose={() => setForm(null)}
          onSaved={aposSalvar}
        />
      ) : null}
    </div>
  );
}
