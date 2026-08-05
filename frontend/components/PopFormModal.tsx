'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Pop, PopInput, TipoPop } from '@/lib/types';

interface Props {
  pop?: Pop | null; // presente = edição; ausente = criação
  areas: string[];
  onClose: () => void;
  onSaved: (p: Pop) => void;
}

type FormState = {
  numero: string;
  nome: string;
  ano: string;
  tipo: TipoPop;
  area: string;
};

function estadoInicial(p?: Pop | null): FormState {
  return {
    numero: p?.numero ?? '',
    nome: p?.nome ?? '',
    ano: p?.ano != null ? String(p.ano) : '',
    tipo: p?.tipo ?? 'novo',
    area: p?.area ?? '',
  };
}

export default function PopFormModal({ pop, areas, onClose, onSaved }: Props) {
  const editando = !!pop;
  const [form, setForm] = useState<FormState>(estadoInicial(pop));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) {
      setErro('Informe o nome do POP.');
      return;
    }
    const anoNum = form.ano.trim() ? Number(form.ano) : null;
    if (anoNum !== null && (!Number.isInteger(anoNum) || anoNum < 2000 || anoNum > 2100)) {
      setErro('Ano inválido.');
      return;
    }
    setSalvando(true);
    setErro(null);

    const body: PopInput = {
      numero: form.numero.trim(),
      nome: form.nome.trim(),
      ano: anoNum,
      tipo: form.tipo,
      area: form.area.trim(),
    };

    try {
      const salvo = editando
        ? await api.patchPop(pop!.id, body)
        : await api.createPop(body);
      onSaved(salvo);
    } catch (err) {
      setErro(
        err instanceof ApiError ? err.message : 'Não foi possível salvar o POP.',
      );
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
        <h3>{editando ? 'Editar POP' : 'Novo POP'}</h3>
        <div className="m-sub">
          {editando
            ? 'Altere os campos e salve.'
            : 'Cadastre um POP elaborado ou atualizado.'}
        </div>

        <form onSubmit={salvar}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="pop-numero">Nº POP</label>
              <input
                id="pop-numero"
                value={form.numero}
                maxLength={20}
                onChange={(e) => set('numero', e.target.value)}
                placeholder="Ex.: 174"
              />
            </div>
            <div className="field">
              <label htmlFor="pop-ano">Ano</label>
              <input
                id="pop-ano"
                inputMode="numeric"
                value={form.ano}
                onChange={(e) => set('ano', e.target.value)}
                placeholder="Ex.: 2026"
              />
            </div>

            <div className="field col-2">
              <label htmlFor="pop-nome">Nome do POP *</label>
              <textarea
                id="pop-nome"
                value={form.nome}
                onChange={(e) => set('nome', e.target.value)}
                placeholder="Ex.: FLUXOGRAMA DO EXAME DE TRICOGRAMA"
              />
            </div>

            <div className="field">
              <label htmlFor="pop-tipo">Tipo</label>
              <select
                id="pop-tipo"
                value={form.tipo}
                onChange={(e) => set('tipo', e.target.value as TipoPop)}
              >
                <option value="novo">Novo</option>
                <option value="atualizado">Atualizado</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="pop-area">Área</label>
              <input
                id="pop-area"
                list="pop-areas"
                value={form.area}
                maxLength={120}
                onChange={(e) => set('area', e.target.value)}
                placeholder="Deixe em branco para classificar automaticamente"
              />
              <datalist id="pop-areas">
                {areas.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>
          </div>

          {erro ? (
            <div
              style={{
                color: 'var(--erro)',
                fontSize: '.82rem',
                fontWeight: 600,
                margin: '12px 0 2px',
              }}
            >
              {erro}
            </div>
          ) : null}

          <div className="m-actions" style={{ marginTop: 18 }}>
            <button
              type="button"
              className="btn ghost"
              onClick={onClose}
              disabled={salvando}
            >
              Cancelar
            </button>
            <button type="submit" className="btn primary" disabled={salvando}>
              {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar POP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
