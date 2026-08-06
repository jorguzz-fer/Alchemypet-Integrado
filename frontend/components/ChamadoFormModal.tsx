'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Chamado, ChamadoInput, StatusChamado } from '@/lib/types';

interface Props {
  chamado?: Chamado | null; // presente = edição; ausente = criação
  motivos: string[];
  onClose: () => void;
  onSaved: (c: Chamado) => void;
}

type FormState = {
  assunto: string;
  remetente: string;
  link_gmail: string;
  complexidade: string;
  motivo: string;
  status: StatusChamado;
  resposta: string;
  texto: string;
  data: string;
};

function estadoInicial(c?: Chamado | null): FormState {
  return {
    assunto: c?.assunto ?? '',
    remetente: c?.remetente ?? '',
    link_gmail: c?.link_gmail ?? '',
    complexidade: c?.complexidade ?? '',
    motivo: c?.motivo ?? '',
    status: c?.status ?? 'aberto',
    resposta: c?.resposta ?? '',
    texto: c?.texto ?? '',
    data: c?.data ?? '',
  };
}

export default function ChamadoFormModal({ chamado, motivos, onClose, onSaved }: Props) {
  const editando = !!chamado;
  const [form, setForm] = useState<FormState>(estadoInicial(chamado));
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
    if (!form.assunto.trim()) {
      setErro('Informe o assunto do chamado.');
      return;
    }
    setSalvando(true);
    setErro(null);
    const body: ChamadoInput = {
      assunto: form.assunto.trim(),
      remetente: form.remetente.trim(),
      link_gmail: form.link_gmail.trim(),
      complexidade: form.complexidade,
      motivo: form.motivo.trim(),
      status: form.status,
      resposta: form.resposta.trim(),
      texto: form.texto.trim(),
      data: form.data || null,
    };
    try {
      const salvo = editando
        ? await api.patchChamado(chamado!.id, body)
        : await api.createChamado(body);
      onSaved(salvo);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível salvar o chamado.');
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
      <div className="modal wide" role="dialog" aria-modal="true">
        <h3>{editando ? 'Editar chamado' : 'Novo chamado'}</h3>
        <div className="m-sub">
          {editando
            ? 'Ajuste a classificação, registre a resposta ou marque como resolvido.'
            : 'Cadastre um chamado manualmente. Deixe complexidade/motivo em branco para classificar automaticamente.'}
        </div>

        <form onSubmit={salvar}>
          <div className="form-grid">
            <div className="field col-2">
              <label htmlFor="ch-assunto">Assunto *</label>
              <input
                id="ch-assunto"
                value={form.assunto}
                onChange={(e) => set('assunto', e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="ch-remetente">Remetente</label>
              <input
                id="ch-remetente"
                value={form.remetente}
                maxLength={200}
                onChange={(e) => set('remetente', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ch-data">Data</label>
              <input
                id="ch-data"
                type="date"
                value={form.data}
                onChange={(e) => set('data', e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="ch-complex">Complexidade</label>
              <select
                id="ch-complex"
                value={form.complexidade}
                onChange={(e) => set('complexidade', e.target.value)}
              >
                <option value="">Automática</option>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="ch-status">Status</label>
              <select
                id="ch-status"
                value={form.status}
                onChange={(e) => set('status', e.target.value as StatusChamado)}
              >
                <option value="aberto">Aberto</option>
                <option value="resolvido">Resolvido</option>
              </select>
            </div>

            <div className="field col-2">
              <label htmlFor="ch-motivo">Motivo</label>
              <input
                id="ch-motivo"
                list="ch-motivos"
                value={form.motivo}
                onChange={(e) => set('motivo', e.target.value)}
                placeholder="Deixe em branco para classificar automaticamente"
              />
              <datalist id="ch-motivos">
                {motivos.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>

            <div className="field col-2">
              <label htmlFor="ch-link">Link do Gmail</label>
              <input
                id="ch-link"
                value={form.link_gmail}
                onChange={(e) => set('link_gmail', e.target.value)}
                placeholder="https://mail.google.com/…"
              />
            </div>

            <div className="field col-2">
              <label htmlFor="ch-resposta">Resposta / observação</label>
              <textarea
                id="ch-resposta"
                value={form.resposta}
                onChange={(e) => set('resposta', e.target.value)}
                placeholder="Registro da tratativa (opcional)"
              />
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
            <button type="button" className="btn ghost" onClick={onClose} disabled={salvando}>
              Cancelar
            </button>
            <button type="submit" className="btn primary" disabled={salvando}>
              {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar chamado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
