'use client';

import { useEffect, useState } from 'react';
import type { FiltrosPendencias } from '@/lib/types';
import { MOTIVOS_PENDENCIA } from '@/lib/types';
import { nomeMes } from '@/lib/format';

interface FiltrosProps {
  value: FiltrosPendencias;
  onApply: (f: FiltrosPendencias) => void;
  // Campos extras (tabela de pendencias).
  clinicas?: string[];
  // Seletor Particular/Convênio (telas que mostram todos os módulos).
  showTipo?: boolean;
  showClinica?: boolean;
  showResponsavel?: boolean;
  showBusca?: boolean;
  // Texto/resumo exibido na barra de acoes (direita).
  resumo?: React.ReactNode;
}

// Anos disponiveis: ano atual ate 4 anos atras.
function anosDisponiveis(): number[] {
  const atual = new Date().getFullYear();
  const anos: number[] = [];
  for (let a = atual; a >= atual - 4; a--) anos.push(a);
  return anos;
}

const MESES = Array.from({ length: 12 }, (_, i) => i + 1);

export default function Filtros({
  value,
  onApply,
  clinicas,
  showTipo = false,
  showClinica = false,
  showResponsavel = false,
  showBusca = false,
  resumo,
}: FiltrosProps) {
  const [draft, setDraft] = useState<FiltrosPendencias>(value);

  // Mantem o rascunho sincronizado quando o pai reseta os filtros.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const anos = anosDisponiveis();

  function set<K extends keyof FiltrosPendencias>(
    key: K,
    v: FiltrosPendencias[K],
  ) {
    setDraft((d) => ({ ...d, [key]: v }));
  }

  function aplicar(e: React.FormEvent) {
    e.preventDefault();
    onApply({ ...draft, page: 1 });
  }

  function limpar() {
    const vazio: FiltrosPendencias = {
      modulo: '',
      ano: '',
      mes_de: '',
      mes_ate: '',
      data_de: '',
      data_ate: '',
      status: '',
      gestao: '',
      motivo: '',
      clinica: '',
      responsavel: '',
      busca: '',
      page: 1,
      per_page: value.per_page,
    };
    setDraft(vazio);
    onApply(vazio);
  }

  return (
    <form className="filters" onSubmit={aplicar}>
      {showTipo ? (
        <div className="fgroup">
          <label htmlFor="f-tipo">Tipo</label>
          <select
            id="f-tipo"
            value={draft.modulo ?? ''}
            onChange={(e) => set('modulo', e.target.value as FiltrosPendencias['modulo'])}
          >
            <option value="">Todas</option>
            <option value="particular">Particular</option>
            <option value="convenio">Convênio</option>
          </select>
        </div>
      ) : null}

      <div className="fgroup">
        <label htmlFor="f-ano">Ano</label>
        <select
          id="f-ano"
          value={draft.ano ?? ''}
          onChange={(e) => set('ano', e.target.value)}
        >
          <option value="">Todos</option>
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="fgroup">
        <label htmlFor="f-mesde">Mês (de)</label>
        <select
          id="f-mesde"
          value={draft.mes_de ?? ''}
          onChange={(e) => set('mes_de', e.target.value)}
        >
          <option value="">Inicio</option>
          {MESES.map((m) => (
            <option key={m} value={m}>
              {nomeMes(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="fgroup">
        <label htmlFor="f-mesate">Mês (até)</label>
        <select
          id="f-mesate"
          value={draft.mes_ate ?? ''}
          onChange={(e) => set('mes_ate', e.target.value)}
        >
          <option value="">Fim</option>
          {MESES.map((m) => (
            <option key={m} value={m}>
              {nomeMes(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="fgroup">
        <label htmlFor="f-dia-de">Dia (de)</label>
        <input
          id="f-dia-de"
          type="date"
          value={draft.data_de ?? ''}
          max={draft.data_ate || undefined}
          onChange={(e) => set('data_de', e.target.value)}
        />
      </div>

      <div className="fgroup">
        <label htmlFor="f-dia-ate">Dia (até)</label>
        <input
          id="f-dia-ate"
          type="date"
          value={draft.data_ate ?? ''}
          min={draft.data_de || undefined}
          onChange={(e) => set('data_ate', e.target.value)}
        />
      </div>

      <div className="fgroup">
        <label htmlFor="f-motivo">Motivo</label>
        <select
          id="f-motivo"
          value={draft.motivo ?? ''}
          onChange={(e) => set('motivo', e.target.value)}
        >
          <option value="">Todos</option>
          {MOTIVOS_PENDENCIA.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="fgroup">
        <label htmlFor="f-status">Status planilha</label>
        <select
          id="f-status"
          value={draft.status ?? ''}
          onChange={(e) =>
            set('status', e.target.value as FiltrosPendencias['status'])
          }
        >
          <option value="">Todos</option>
          <option value="pendente">Pendente</option>
          <option value="tratativa">Em tratativa</option>
          <option value="concluido">Concluído</option>
        </select>
      </div>

      <div className="fgroup">
        <label htmlFor="f-gestao">Gestão</label>
        <select
          id="f-gestao"
          value={draft.gestao ?? ''}
          onChange={(e) =>
            set('gestao', e.target.value as FiltrosPendencias['gestao'])
          }
        >
          <option value="">Todas</option>
          <option value="aberto">Aberto</option>
          <option value="andamento">Andamento</option>
          <option value="resolvido">Resolvido</option>
        </select>
      </div>

      {showClinica ? (
        <div className="fgroup">
          <label htmlFor="f-clinica">Clínica</label>
          <select
            id="f-clinica"
            value={draft.clinica ?? ''}
            onChange={(e) => set('clinica', e.target.value)}
          >
            <option value="">Todas</option>
            {(clinicas ?? []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {showResponsavel ? (
        <div className="fgroup">
          <label htmlFor="f-resp">Responsável</label>
          <input
            id="f-resp"
            type="text"
            placeholder="Nome"
            value={draft.responsavel ?? ''}
            onChange={(e) => set('responsavel', e.target.value)}
          />
        </div>
      ) : null}

      {showBusca ? (
        <div className="fgroup wide">
          <label htmlFor="f-busca">Busca</label>
          <input
            id="f-busca"
            type="text"
            placeholder="Guia, paciente, clínica, motivo, observação…"
            value={draft.busca ?? ''}
            onChange={(e) => set('busca', e.target.value)}
          />
        </div>
      ) : null}

      <div className="actions">
        <div className="left">{resumo}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn ghost sm" onClick={limpar}>
            Limpar
          </button>
          <button type="submit" className="btn primary sm">
            Aplicar filtros
          </button>
        </div>
      </div>
    </form>
  );
}
