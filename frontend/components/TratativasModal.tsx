'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Gestao, Pendencia, Tratativa } from '@/lib/types';
import { formatData } from '@/lib/format';

interface Props {
  pendencia: Pendencia;
  onClose: () => void;
  // Chamado apos registrar uma tratativa (para recarregar a lista, se preciso).
  onSaved?: () => void;
}

const GESTAO_OPCOES: { value: '' | Gestao; label: string }[] = [
  { value: '', label: 'Não alterar gestão' },
  { value: 'aberto', label: 'Aberto' },
  { value: 'andamento', label: 'Andamento' },
  { value: 'resolvido', label: 'Resolvido' },
];

function dataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatData(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatData(iso)} ${hh}:${mm}`;
}

export default function TratativasModal({ pendencia, onClose, onSaved }: Props) {
  const [lista, setLista] = useState<Tratativa[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [acao, setAcao] = useState('');
  const [gestao, setGestao] = useState<'' | Gestao>('');
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const t = await api.listTratativas(pendencia.id);
      setLista(t);
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? e.message
          : 'Falha ao carregar as tratativas.',
      );
      setLista([]);
    } finally {
      setLoading(false);
    }
  }, [pendencia.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Fecha com ESC.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!acao.trim()) {
      setErroSalvar('Descreva a ação realizada.');
      return;
    }
    setSalvando(true);
    setErroSalvar(null);
    try {
      await api.createTratativa(pendencia.id, {
        acao: acao.trim(),
        gestao: gestao || undefined,
      });
      setAcao('');
      setGestao('');
      await carregar();
      onSaved?.();
    } catch (err) {
      setErroSalvar(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível registrar a tratativa.',
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="modal-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true">
        <h3>Tratativas</h3>
        <div className="m-sub">Histórico e registro de ações da pendência.</div>

        <div className="m-info">
          <div>
            <b>Guia:</b> {pendencia.guia || '—'} &nbsp;·&nbsp;{' '}
            <b>Paciente:</b> {pendencia.paciente || '—'}
          </div>
          <div style={{ marginTop: 4 }}>
            <b>Clínica:</b> {pendencia.clinica || '—'}
          </div>
          <div style={{ marginTop: 4 }}>
            <b>Informação necessária:</b>{' '}
            {pendencia.informacao_necessaria || '—'}
          </div>
        </div>

        {loading ? (
          <div className="trat-empty">Carregando tratativas…</div>
        ) : erro ? (
          <div className="trat-empty" style={{ color: 'var(--erro)' }}>
            {erro}
          </div>
        ) : lista.length === 0 ? (
          <div className="trat-empty">Nenhuma tratativa registrada ainda.</div>
        ) : (
          <div className="trat-list">
            {lista.map((t) => (
              <div className="trat-item" key={t.id}>
                <div className="trat-top">
                  <span className="trat-who">
                    {t.usuario_nome || 'Sem usuário'}
                    {t.por_agente ? (
                      <span className="agente"> · agente</span>
                    ) : null}
                  </span>
                  <span className="trat-when">{dataHora(t.created_at)}</span>
                </div>
                <div className="trat-acao">{t.acao}</div>
                {t.gestao ? (
                  <div
                    className="trat-when"
                    style={{ marginTop: 6 }}
                  >
                    Gestão: <b>{t.gestao}</b>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={salvar}>
          <div className="field">
            <label htmlFor="t-acao">Nova tratativa</label>
            <textarea
              id="t-acao"
              value={acao}
              onChange={(e) => setAcao(e.target.value)}
              placeholder="Descreva a ação realizada…"
            />
          </div>
          <div className="field">
            <label htmlFor="t-gestao">Atualizar gestão</label>
            <select
              id="t-gestao"
              value={gestao}
              onChange={(e) => setGestao(e.target.value as '' | Gestao)}
            >
              {GESTAO_OPCOES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {erroSalvar ? (
            <div
              className="trat-when"
              style={{ color: 'var(--erro)', marginBottom: 10 }}
            >
              {erroSalvar}
            </div>
          ) : null}

          <div className="m-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={onClose}
              disabled={salvando}
            >
              Fechar
            </button>
            <button type="submit" className="btn primary" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Registrar tratativa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
