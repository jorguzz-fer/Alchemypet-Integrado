'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Gestao, Modulo, Pendencia, PendenciaInput } from '@/lib/types';

interface Props {
  // Módulo da pendência (usado na criação).
  modulo: Modulo;
  // Quando presente, é edição; ausente, é criação.
  pendencia?: Pendencia | null;
  onClose: () => void;
  onSaved: (p: Pendencia) => void;
}

type FormState = {
  data_pedido: string;
  guia: string;
  paciente: string;
  cod_clinica: string;
  clinica: string;
  informacao_necessaria: string;
  responsavel: string;
  resposta_cliente: string;
  data_devolutiva: string;
  confirmacao: string;
  triagem: string;
  gestao: Gestao;
};

function estadoInicial(p?: Pendencia | null): FormState {
  return {
    data_pedido: p?.data_pedido ?? '',
    guia: p?.guia ?? '',
    paciente: p?.paciente ?? '',
    cod_clinica: p?.cod_clinica ?? '',
    clinica: p?.clinica ?? '',
    informacao_necessaria: p?.informacao_necessaria ?? '',
    responsavel: p?.responsavel ?? '',
    resposta_cliente: p?.resposta_cliente ?? '',
    data_devolutiva: p?.data_devolutiva ?? '',
    confirmacao: p?.confirmacao ?? '',
    triagem: p?.triagem ?? '',
    gestao: p?.gestao ?? 'aberto',
  };
}

export default function PendenciaFormModal({
  modulo,
  pendencia,
  onClose,
  onSaved,
}: Props) {
  const editando = !!pendencia;
  const [form, setForm] = useState<FormState>(estadoInicial(pendencia));
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
    if (!form.informacao_necessaria.trim()) {
      setErro('Informe a “Informação necessária”.');
      return;
    }
    setSalvando(true);
    setErro(null);

    const body: PendenciaInput = {
      guia: form.guia.trim(),
      paciente: form.paciente.trim(),
      cod_clinica: form.cod_clinica.trim(),
      clinica: form.clinica.trim(),
      informacao_necessaria: form.informacao_necessaria.trim(),
      responsavel: form.responsavel.trim(),
      resposta_cliente: form.resposta_cliente.trim(),
      confirmacao: form.confirmacao.trim(),
      triagem: form.triagem.trim(),
      data_pedido: form.data_pedido || null,
      data_devolutiva: form.data_devolutiva || null,
      gestao: form.gestao,
    };

    try {
      const salva = editando
        ? await api.patchPendencia(pendencia!.id, body)
        : await api.createPendencia({
            ...body,
            modulo,
            informacao_necessaria: form.informacao_necessaria.trim(),
          });
      onSaved(salva);
    } catch (err) {
      setErro(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível salvar a pendência.',
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
      <div className="modal wide" role="dialog" aria-modal="true">
        <h3>{editando ? 'Editar pendência' : 'Nova pendência'}</h3>
        <div className="m-sub">
          {editando
            ? 'Altere os campos e salve. O status da planilha é recalculado pela confirmação/devolutiva.'
            : 'Lance uma pendência de convênio diretamente no painel.'}
        </div>

        <form onSubmit={salvar}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="pf-data">Data do pedido</label>
              <input
                id="pf-data"
                type="date"
                value={form.data_pedido}
                onChange={(e) => set('data_pedido', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="pf-guia">Guia</label>
              <input
                id="pf-guia"
                value={form.guia}
                maxLength={40}
                onChange={(e) => set('guia', e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="pf-paciente">Paciente</label>
              <input
                id="pf-paciente"
                value={form.paciente}
                maxLength={160}
                onChange={(e) => set('paciente', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="pf-cod">Código da clínica</label>
              <input
                id="pf-cod"
                value={form.cod_clinica}
                maxLength={40}
                onChange={(e) => set('cod_clinica', e.target.value)}
              />
            </div>

            <div className="field col-2">
              <label htmlFor="pf-clinica">Clínica</label>
              <input
                id="pf-clinica"
                value={form.clinica}
                maxLength={200}
                onChange={(e) => set('clinica', e.target.value)}
              />
            </div>

            <div className="field col-2">
              <label htmlFor="pf-info">Informação necessária *</label>
              <textarea
                id="pf-info"
                value={form.informacao_necessaria}
                onChange={(e) => set('informacao_necessaria', e.target.value)}
                placeholder="Ex.: LANÇAR EXAME NO CONVÊNIO"
              />
            </div>

            <div className="field">
              <label htmlFor="pf-resp">Responsável</label>
              <input
                id="pf-resp"
                value={form.responsavel}
                maxLength={120}
                onChange={(e) => set('responsavel', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="pf-gestao">Gestão</label>
              <select
                id="pf-gestao"
                value={form.gestao}
                onChange={(e) => set('gestao', e.target.value as Gestao)}
              >
                <option value="aberto">Aberto</option>
                <option value="andamento">Andamento</option>
                <option value="resolvido">Resolvido</option>
              </select>
            </div>

            <div className="field col-2">
              <label htmlFor="pf-resposta">Resposta do cliente</label>
              <textarea
                id="pf-resposta"
                value={form.resposta_cliente}
                onChange={(e) => set('resposta_cliente', e.target.value)}
                placeholder="Retorno da clínica/cliente (opcional)"
              />
            </div>

            <div className="field">
              <label htmlFor="pf-dev">Data da devolutiva</label>
              <input
                id="pf-dev"
                type="date"
                value={form.data_devolutiva}
                onChange={(e) => set('data_devolutiva', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="pf-conf">Confirmação</label>
              <input
                id="pf-conf"
                value={form.confirmacao}
                maxLength={120}
                placeholder="Ex.: OK"
                onChange={(e) => set('confirmacao', e.target.value)}
              />
            </div>

            <div className="field col-2">
              <label htmlFor="pf-triagem">Triagem</label>
              <input
                id="pf-triagem"
                value={form.triagem}
                maxLength={120}
                onChange={(e) => set('triagem', e.target.value)}
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
            <button
              type="button"
              className="btn ghost"
              onClick={onClose}
              disabled={salvando}
            >
              Cancelar
            </button>
            <button type="submit" className="btn primary" disabled={salvando}>
              {salvando
                ? 'Salvando…'
                : editando
                  ? 'Salvar alterações'
                  : 'Criar pendência'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
