'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type {
  ChamadosResponse,
  Chamado,
  FiltrosChamado,
} from '@/lib/types';
import { formatNumero } from '@/lib/format';
import ChamadoFormModal from '@/components/ChamadoFormModal';

const PER_PAGE = 25;

const FILTROS_INICIAIS: FiltrosChamado = {
  complexidade: '',
  motivo: '',
  status: '',
  busca: '',
  page: 1,
  per_page: PER_PAGE,
};

const CX_ROTULO: Record<string, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export default function ChamadosListaPage() {
  const [filtros, setFiltros] = useState<FiltrosChamado>(FILTROS_INICIAIS);
  const [busca, setBusca] = useState('');
  const [resp, setResp] = useState<ChamadosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [motivos, setMotivos] = useState<string[]>([]);
  const [form, setForm] = useState<'novo' | Chamado | null>(null);
  const [ocupado, setOcupado] = useState<Record<string, boolean>>({});
  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .chamadosMotivos(ctrl.signal)
      .then(setMotivos)
      .catch(() => {
        /* opcional */
      });
    return () => ctrl.abort();
  }, [resp]);

  const carregar = useCallback(async (f: FiltrosChamado, signal?: AbortSignal) => {
    setLoading(true);
    setErro(null);
    try {
      const r = await api.listChamados({ ...f, per_page: f.per_page ?? PER_PAGE }, signal);
      setResp(r);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setErro(e instanceof ApiError ? e.message : 'Não foi possível conectar à API.');
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

  function aplicar(patch: Partial<FiltrosChamado>) {
    setFiltros((f) => ({ ...f, ...patch, page: 1 }));
  }
  function irPara(p: number) {
    setFiltros((f) => ({ ...f, page: Math.min(Math.max(1, p), totalPaginas) }));
  }

  async function alternarStatus(c: Chamado) {
    const novo = c.status === 'resolvido' ? 'aberto' : 'resolvido';
    setOcupado((s) => ({ ...s, [c.id]: true }));
    setResp((r) =>
      r
        ? { ...r, items: r.items.map((it) => (it.id === c.id ? { ...it, status: novo } : it)) }
        : r,
    );
    try {
      await api.patchChamado(c.id, { status: novo });
    } catch (e) {
      setResp((r) =>
        r
          ? { ...r, items: r.items.map((it) => (it.id === c.id ? { ...it, status: c.status } : it)) }
          : r,
      );
      setAviso(e instanceof ApiError ? e.message : 'Falha ao atualizar o status.');
    } finally {
      setOcupado((s) => {
        const n = { ...s };
        delete n[c.id];
        return n;
      });
    }
  }

  async function importar(file: File) {
    setImportando(true);
    setAviso(null);
    try {
      const r = await api.importarChamados(file);
      setAviso(
        `Importação concluída: ${formatNumero(r.importados)} novo(s) chamado(s), total ${formatNumero(r.total)}.`,
      );
      setFiltros((f) => ({ ...f, page: 1 }));
      await carregar({ ...filtros, page: 1 });
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : 'Não foi possível importar a planilha.');
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function excluir(c: Chamado) {
    const ok = window.confirm(`Excluir o chamado "${c.assunto}"?\n\nEsta ação não pode ser desfeita.`);
    if (!ok) return;
    setOcupado((s) => ({ ...s, [c.id]: true }));
    try {
      await api.deleteChamado(c.id);
      setAviso('Chamado excluído.');
      await carregar(filtros);
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : 'Falha ao excluir o chamado.');
    } finally {
      setOcupado((s) => {
        const n = { ...s };
        delete n[c.id];
        return n;
      });
    }
  }

  async function aposSalvar(c: Chamado) {
    const criacao = form === 'novo';
    setForm(null);
    setAviso(criacao ? 'Chamado criado.' : 'Chamado atualizado.');
    if (criacao) setFiltros((f) => ({ ...f, page: 1 }));
    await carregar(criacao ? { ...filtros, page: 1 } : filtros);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Caixa de chamados</h1>
          <div className="lead">
            Chamados recebidos por e-mail — trate, responda e marque como resolvido.
          </div>
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
            + Novo chamado
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

      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          aplicar({ busca });
        }}
      >
        <div className="fgroup">
          <label htmlFor="ch-f-complex">Complexidade</label>
          <select
            id="ch-f-complex"
            value={filtros.complexidade ?? ''}
            onChange={(e) =>
              aplicar({ complexidade: e.target.value as FiltrosChamado['complexidade'] })
            }
          >
            <option value="">Todas</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>
        <div className="fgroup">
          <label htmlFor="ch-f-status">Status</label>
          <select
            id="ch-f-status"
            value={filtros.status ?? ''}
            onChange={(e) => aplicar({ status: e.target.value as FiltrosChamado['status'] })}
          >
            <option value="">Todos</option>
            <option value="aberto">Aberto</option>
            <option value="resolvido">Resolvido</option>
          </select>
        </div>
        <div className="fgroup wide">
          <label htmlFor="ch-f-motivo">Motivo</label>
          <select
            id="ch-f-motivo"
            value={filtros.motivo ?? ''}
            onChange={(e) => aplicar({ motivo: e.target.value })}
          >
            <option value="">Todos</option>
            {motivos.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="fgroup wide">
          <label htmlFor="ch-f-busca">Busca</label>
          <input
            id="ch-f-busca"
            value={busca}
            placeholder="Assunto, remetente ou motivo"
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="actions">
          <div className="left">
            {resp ? (
              <>
                <b>{formatNumero(total)}</b> chamado(s) no filtro atual
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
            Chamados
            <span className="count">{formatNumero(total)}</span>
          </div>
          <div className="muted">
            Página {page} de {totalPaginas}
          </div>
        </div>

        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Assunto</th>
                <th>Complexidade</th>
                <th>Motivo</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="empty-row" colSpan={5}>
                    <div className="spinner" />
                    Carregando chamados…
                  </td>
                </tr>
              ) : erro ? (
                <tr>
                  <td className="empty-row" colSpan={5}>
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
                  <td className="empty-row" colSpan={5}>
                    Nenhum chamado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                items.map((c) => (
                  <tr key={c.id}>
                    <td className="wrap">{c.assunto || '—'}</td>
                    <td>
                      <span className={`cxtag ${c.complexidade || 'media'}`}>
                        {CX_ROTULO[c.complexidade] ?? '—'}
                      </span>
                    </td>
                    <td className="wrap">{c.motivo || '—'}</td>
                    <td>
                      <span className={`stag ${c.status}`}>
                        {c.status === 'resolvido' ? 'Resolvido' : 'Aberto'}
                      </span>
                    </td>
                    <td className="nowrap">
                      <div className="row-acoes">
                        <button
                          className={`notebtn ${c.status === 'resolvido' ? '' : 'ok'}`}
                          onClick={() => alternarStatus(c)}
                          disabled={!!ocupado[c.id]}
                        >
                          {c.status === 'resolvido' ? 'Reabrir' : 'Resolver'}
                        </button>
                        {c.link_gmail ? (
                          <a
                            className="notebtn"
                            href={c.link_gmail}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Abrir no Gmail
                          </a>
                        ) : null}
                        <button className="notebtn" onClick={() => setForm(c)}>
                          Editar
                        </button>
                        <button
                          className="notebtn danger"
                          onClick={() => excluir(c)}
                          disabled={!!ocupado[c.id]}
                        >
                          Excluir
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
        <ChamadoFormModal
          chamado={form === 'novo' ? null : form}
          motivos={motivos}
          onClose={() => setForm(null)}
          onSaved={aposSalvar}
        />
      ) : null}
    </div>
  );
}
