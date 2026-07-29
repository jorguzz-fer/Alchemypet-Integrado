'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { notFound, useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type {
  FiltrosPendencias,
  Gestao,
  Modulo,
  Pendencia,
  PendenciasResponse,
} from '@/lib/types';
import { formatNumero, labelPeriodo } from '@/lib/format';
import { infoModulo, moduloValido } from '@/lib/modulos';
import Filtros from '@/components/Filtros';
import StatusBadge from '@/components/StatusBadge';
import TratativasModal from '@/components/TratativasModal';
import PendenciaFormModal from '@/components/PendenciaFormModal';

const PER_PAGE = 25;

const FILTROS_INICIAIS: FiltrosPendencias = {
  ano: '',
  mes_de: '',
  mes_ate: '',
  status: '',
  gestao: '',
  clinica: '',
  responsavel: '',
  busca: '',
  page: 1,
  per_page: PER_PAGE,
};

const GESTAO_CLASSE: Record<Gestao, string> = {
  aberto: 'g-aberto',
  andamento: 'g-andamento',
  resolvido: 'g-resolvido',
};

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function PendenciasPage() {
  const params = useParams();
  const rawModulo = params.modulo as string;
  if (!moduloValido(rawModulo)) notFound();
  const modulo: Modulo = rawModulo;
  const info = infoModulo(modulo);

  const [filtros, setFiltros] = useState<FiltrosPendencias>(FILTROS_INICIAIS);
  const [resp, setResp] = useState<PendenciasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [clinicas, setClinicas] = useState<string[]>([]);
  const [salvandoGestao, setSalvandoGestao] = useState<Record<string, boolean>>(
    {},
  );
  const [modal, setModal] = useState<Pendencia | null>(null);
  const [form, setForm] = useState<'nova' | Pendencia | null>(null);
  const [excluindo, setExcluindo] = useState<Record<string, boolean>>({});

  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Trocar de módulo limpa filtros e avisos.
  useEffect(() => {
    setFiltros(FILTROS_INICIAIS);
    setAviso(null);
  }, [modulo]);

  // Lista de clínicas do módulo.
  useEffect(() => {
    const ctrl = new AbortController();
    api
      .clinicas(modulo, ctrl.signal)
      .then((c) => setClinicas(c.items ?? []))
      .catch(() => {
        /* clinicas indisponivel: filtro fica vazio */
      });
    return () => ctrl.abort();
  }, [modulo]);

  const carregar = useCallback(
    async (f: FiltrosPendencias, signal?: AbortSignal) => {
      setLoading(true);
      setErro(null);
      try {
        const r = await api.listPendencias(
          { ...f, modulo, per_page: f.per_page ?? PER_PAGE },
          signal,
        );
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
    },
    [modulo],
  );

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

  function irPara(p: number) {
    setFiltros((f) => ({ ...f, page: Math.min(Math.max(1, p), totalPaginas) }));
  }

  async function alterarGestao(p: Pendencia, novo: Gestao) {
    if (novo === p.gestao) return;
    setSalvandoGestao((s) => ({ ...s, [p.id]: true }));
    setResp((r) =>
      r
        ? {
            ...r,
            items: r.items.map((it) =>
              it.id === p.id ? { ...it, gestao: novo } : it,
            ),
          }
        : r,
    );
    try {
      const atualizada = await api.patchPendencia(p.id, { gestao: novo });
      setResp((r) =>
        r
          ? {
              ...r,
              items: r.items.map((it) => (it.id === p.id ? atualizada : it)),
            }
          : r,
      );
    } catch (e) {
      setResp((r) =>
        r
          ? {
              ...r,
              items: r.items.map((it) =>
                it.id === p.id ? { ...it, gestao: p.gestao } : it,
              ),
            }
          : r,
      );
      setAviso(
        e instanceof ApiError ? e.message : 'Falha ao atualizar a gestão.',
      );
    } finally {
      setSalvandoGestao((s) => {
        const n = { ...s };
        delete n[p.id];
        return n;
      });
    }
  }

  async function importar(file: File) {
    setImportando(true);
    setAviso(null);
    try {
      const r = await api.importar(file, modulo);
      setAviso(
        `Importação concluída: ${formatNumero(r.importados)} registro(s), ` +
          `${formatNumero(r.abas)} aba(s), total ${formatNumero(r.total)}.`,
      );
      setFiltros((f) => ({ ...f, page: 1 }));
      await carregar({ ...filtros, page: 1 });
    } catch (e) {
      setAviso(
        e instanceof ApiError
          ? e.message
          : 'Não foi possível importar a planilha.',
      );
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function excluir(p: Pendencia) {
    const ok = window.confirm(
      `Excluir a pendência da guia ${p.guia || '—'} (${p.paciente || 'sem paciente'})?\n\nEsta ação não pode ser desfeita.`,
    );
    if (!ok) return;
    setExcluindo((s) => ({ ...s, [p.id]: true }));
    try {
      await api.deletePendencia(p.id);
      setAviso('Pendência excluída.');
      await carregar(filtros);
    } catch (e) {
      setAviso(
        e instanceof ApiError ? e.message : 'Falha ao excluir a pendência.',
      );
    } finally {
      setExcluindo((s) => {
        const n = { ...s };
        delete n[p.id];
        return n;
      });
    }
  }

  async function aposSalvarForm(p: Pendencia) {
    const criacao = form === 'nova';
    setForm(null);
    setAviso(
      criacao
        ? `Pendência criada (guia ${p.guia || '—'}).`
        : `Pendência atualizada (guia ${p.guia || '—'}).`,
    );
    if (criacao) setFiltros((f) => ({ ...f, page: 1 }));
    await carregar(criacao ? { ...filtros, page: 1 } : filtros);
  }

  function exportarCSV() {
    if (items.length === 0) return;
    const cols: { key: keyof Pendencia; label: string }[] = [
      { key: 'ano', label: 'Ano' },
      { key: 'mes', label: 'Mes' },
      { key: 'guia', label: 'Guia' },
      { key: 'paciente', label: 'Paciente' },
      { key: 'clinica', label: 'Clinica' },
      { key: 'informacao_necessaria', label: 'Informacao necessaria' },
      { key: 'responsavel', label: 'Responsavel' },
      { key: 'status', label: 'Status planilha' },
      { key: 'gestao', label: 'Gestao' },
    ];
    const linhas = [
      cols.map((c) => csvEscape(c.label)).join(';'),
      ...items.map((it) => cols.map((c) => csvEscape(it[c.key])).join(';')),
    ];
    const blob = new Blob(['﻿' + linhas.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${modulo}-pendencias-pagina-${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Pendências</h1>
          <div className="lead">Gestão operacional das {info.descricao}.</div>
        </div>
        <div className="actions">
          <button
            className="btn ghost"
            onClick={exportarCSV}
            disabled={items.length === 0}
          >
            Exportar CSV
          </button>
          <button
            className="btn ghost"
            onClick={() => fileRef.current?.click()}
            disabled={importando}
          >
            {importando ? 'Importando…' : 'Importar planilha'}
          </button>
          <button className="btn primary" onClick={() => setForm('nova')}>
            + Nova pendência
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

      <Filtros
        value={filtros}
        onApply={setFiltros}
        clinicas={clinicas}
        showClinica
        showResponsavel
        showBusca
        resumo={
          resp ? (
            <>
              <b>{formatNumero(total)}</b> pendência(s) encontrada(s)
            </>
          ) : null
        }
      />

      {aviso ? (
        <div
          className="card"
          style={{ marginTop: 14, fontSize: '.85rem', color: 'var(--texto)' }}
        >
          {aviso}
        </div>
      ) : null}

      <div className="tablewrap">
        <div className="tabletools">
          <div className="t-left">
            Registros
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
                <th>Período</th>
                <th>Guia</th>
                <th>Paciente</th>
                <th>Clínica</th>
                <th>Informação necessária</th>
                <th>Responsável</th>
                <th>Status planilha</th>
                <th>Gestão</th>
                <th>Tratativas</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="empty-row" colSpan={10}>
                    <div className="spinner" />
                    Carregando pendências…
                  </td>
                </tr>
              ) : erro ? (
                <tr>
                  <td className="empty-row" colSpan={10}>
                    <div style={{ color: 'var(--erro)', fontWeight: 700 }}>
                      {erro}
                    </div>
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
                  <td className="empty-row" colSpan={10}>
                    Nenhuma pendência para os filtros selecionados.
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
                    <td>
                      <select
                        className={`gsel ${GESTAO_CLASSE[p.gestao]}`}
                        value={p.gestao}
                        disabled={!!salvandoGestao[p.id]}
                        onChange={(e) =>
                          alterarGestao(p, e.target.value as Gestao)
                        }
                      >
                        <option value="aberto">Aberto</option>
                        <option value="andamento">Andamento</option>
                        <option value="resolvido">Resolvido</option>
                      </select>
                    </td>
                    <td>
                      <button className="notebtn" onClick={() => setModal(p)}>
                        Tratativas
                      </button>
                    </td>
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
            <button
              onClick={() => irPara(page + 1)}
              disabled={page >= totalPaginas}
            >
              Próxima
            </button>
            <button
              onClick={() => irPara(totalPaginas)}
              disabled={page >= totalPaginas}
            >
              »
            </button>
          </div>
        </div>
      </div>

      {modal ? (
        <TratativasModal
          pendencia={modal}
          onClose={() => setModal(null)}
          onSaved={() => carregar(filtros)}
        />
      ) : null}

      {form ? (
        <PendenciaFormModal
          modulo={modulo}
          pendencia={form === 'nova' ? null : form}
          onClose={() => setForm(null)}
          onSaved={aposSalvarForm}
        />
      ) : null}
    </div>
  );
}
