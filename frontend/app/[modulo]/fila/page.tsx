'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { moduloValido } from '@/lib/modulos';
import Filtros from '@/components/Filtros';
import StatusBadge from '@/components/StatusBadge';
import TratativasModal from '@/components/TratativasModal';
import PendenciaFormModal from '@/components/PendenciaFormModal';
import OrdenarSelect from '@/components/OrdenarSelect';

const PER_PAGE = 25;

type OrdemFila = 'prioridade' | 'recentes';
const OPCOES_FILA = [
  { value: 'prioridade', label: 'Mais antigas primeiro' },
  { value: 'recentes', label: 'Mais recentes primeiro' },
];

// Fila = só o que ainda não foi concluído, mais antigas primeiro.
const FILTROS_INICIAIS: FiltrosPendencias = {
  ano: '',
  mes_de: '',
  mes_ate: '',
  gestao: '',
  clinica: '',
  responsavel: '',
  busca: '',
  abertas: true,
  ordem: 'prioridade',
  page: 1,
  per_page: PER_PAGE,
};

const GESTAO_CLASSE: Record<Gestao, string> = {
  aberto: 'g-aberto',
  andamento: 'g-andamento',
  resolvido: 'g-resolvido',
};

export default function FilaTriagemPage() {
  const params = useParams();
  const rawModulo = params.modulo as string;
  if (!moduloValido(rawModulo)) notFound();
  const modulo: Modulo = rawModulo;

  const [filtros, setFiltros] = useState<FiltrosPendencias>(FILTROS_INICIAIS);
  const [resp, setResp] = useState<PendenciasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [ordem, setOrdem] = useState<OrdemFila>('prioridade');
  const [clinicas, setClinicas] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<Pendencia | null>(null);
  const [form, setForm] = useState<'nova' | Pendencia | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    setFiltros(FILTROS_INICIAIS);
    setOrdem('prioridade');
    setAviso(null);
  }, [modulo]);

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .clinicas(modulo, ctrl.signal)
      .then((c) => setClinicas(c.items ?? []))
      .catch(() => {
        /* filtro de clínica indisponível */
      });
    return () => ctrl.abort();
  }, [modulo]);

  const carregar = useCallback(
    async (f: FiltrosPendencias, signal?: AbortSignal) => {
      setLoading(true);
      setErro(null);
      try {
        const r = await api.listPendencias(
          {
            ...f,
            modulo,
            abertas: true,
            ordem,
            per_page: f.per_page ?? PER_PAGE,
          },
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
    [modulo, ordem],
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
    setOcupado((s) => ({ ...s, [p.id]: true }));
    try {
      await api.patchPendencia(p.id, { gestao: novo });
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
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : 'Falha ao atualizar a gestão.');
    } finally {
      setOcupado((s) => {
        const n = { ...s };
        delete n[p.id];
        return n;
      });
    }
  }

  // Ação rápida da fila: conclui a triagem e a remove da lista de abertas.
  async function concluir(p: Pendencia) {
    setOcupado((s) => ({ ...s, [p.id]: true }));
    try {
      await api.patchPendencia(p.id, { status: 'concluido', gestao: 'resolvido' });
      setAviso(`Triagem concluída (guia ${p.guia || '—'}).`);
      await carregar(filtros);
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : 'Falha ao concluir a triagem.');
    } finally {
      setOcupado((s) => {
        const n = { ...s };
        delete n[p.id];
        return n;
      });
    }
  }

  async function excluir(p: Pendencia) {
    const ok = window.confirm(
      `Excluir a triagem da guia ${p.guia || '—'} (${p.paciente || 'sem paciente'})?\n\nEsta ação não pode ser desfeita.`,
    );
    if (!ok) return;
    setOcupado((s) => ({ ...s, [p.id]: true }));
    try {
      await api.deletePendencia(p.id);
      setAviso('Triagem excluída.');
      await carregar(filtros);
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : 'Falha ao excluir a triagem.');
    } finally {
      setOcupado((s) => {
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
        ? `Triagem criada (guia ${p.guia || '—'}).`
        : `Triagem atualizada (guia ${p.guia || '—'}).`,
    );
    if (criacao) setFiltros((f) => ({ ...f, page: 1 }));
    await carregar(criacao ? { ...filtros, page: 1 } : filtros);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Fazer triagem</h1>
          <div className="lead">
            Fila de triagens em aberto — as mais antigas aparecem primeiro.
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setForm('nova')}>
            + Nova triagem
          </button>
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
              <b>{formatNumero(total)}</b> triagem(ns) em aberto
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
            Na fila
            <span className="count">{formatNumero(total)}</span>
          </div>
          <div className="t-right">
            <OrdenarSelect
              value={ordem}
              opcoes={OPCOES_FILA}
              onChange={(v) => {
                setOrdem(v as OrdemFila);
                setFiltros((f) => ({ ...f, page: 1 }));
              }}
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
                <th>Período</th>
                <th>Guia</th>
                <th>Paciente</th>
                <th>Clínica</th>
                <th>Informação necessária</th>
                <th>Responsável</th>
                <th>Status</th>
                <th>Gestão</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="empty-row" colSpan={9}>
                    <div className="spinner" />
                    Carregando fila…
                  </td>
                </tr>
              ) : erro ? (
                <tr>
                  <td className="empty-row" colSpan={9}>
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
                  <td className="empty-row" colSpan={9}>
                    Nenhuma triagem em aberto. 🎉
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
                        disabled={!!ocupado[p.id]}
                        onChange={(e) =>
                          alterarGestao(p, e.target.value as Gestao)
                        }
                      >
                        <option value="aberto">Aberto</option>
                        <option value="andamento">Andamento</option>
                        <option value="resolvido">Resolvido</option>
                      </select>
                    </td>
                    <td className="nowrap">
                      <div className="row-acoes">
                        <button
                          className="notebtn ok"
                          onClick={() => concluir(p)}
                          disabled={!!ocupado[p.id]}
                          title="Concluir triagem"
                        >
                          {ocupado[p.id] ? '…' : 'Concluir'}
                        </button>
                        <button className="notebtn" onClick={() => setForm(p)}>
                          Editar
                        </button>
                        <button className="notebtn" onClick={() => setModal(p)}>
                          Tratativas
                        </button>
                        <button
                          className="notebtn danger"
                          onClick={() => excluir(p)}
                          disabled={!!ocupado[p.id]}
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
