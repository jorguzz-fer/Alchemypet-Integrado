'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { ContaDetalhe, ContaInput, Temperatura } from '@/lib/types';
import { TEMPERATURAS } from './crmUi';

interface Props {
  vendedores: string[];
  regioes: string[];
  onClose: () => void;
  onSaved: (c: ContaDetalhe) => void;
}

const VAZIO: ContaInput = {
  nome: '',
  whatsapp: '',
  email: '',
  cidade: '',
  uf: '',
  vendedor: '',
  captacao: '',
  temperatura: '',
  regiao: '',
  observacao: '',
};

const CAPTACOES = ['Google', 'Indicação', 'Já nos conhecia', 'Instagram', 'Mailing', 'Network', 'Site', 'WhatsApp', 'Outros'];

export default function NovaContaModal({ vendedores, regioes, onClose, onSaved }: Props) {
  const [form, setForm] = useState<ContaInput>(VAZIO);
  const [mais, setMais] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function set<K extends keyof ContaInput>(k: K, v: ContaInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) {
      setErro('Informe o nome da clínica ou do contato.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      onSaved(await api.createConta({ ...form, nome: form.nome.trim() }));
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível criar o lead.');
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
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="nl-titulo">
        <h3 id="nl-titulo">Novo lead</h3>
        <div className="m-sub">Só o nome é obrigatório. O resto pode ser completado depois.</div>

        <form onSubmit={salvar}>
          <div className="form-grid">
            <div className="field col-2">
              <label htmlFor="nl-nome">Clínica ou contato *</label>
              <input id="nl-nome" autoFocus value={form.nome} maxLength={200}
                onChange={(e) => set('nome', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="nl-whats">WhatsApp</label>
              <input id="nl-whats" inputMode="tel" placeholder="(11) 99999-9999" value={form.whatsapp}
                maxLength={40} onChange={(e) => set('whatsapp', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="nl-vend">Vendedor</label>
              <input id="nl-vend" list="nl-vendedores" value={form.vendedor} maxLength={120}
                onChange={(e) => set('vendedor', e.target.value)} />
              <datalist id="nl-vendedores">
                {vendedores.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>
            <div className="field col-2">
              <label>Temperatura</label>
              <div className="temp-seletor" role="radiogroup" aria-label="Temperatura">
                {TEMPERATURAS.map((t) => (
                  <button key={t.valor} type="button" role="radio" aria-checked={form.temperatura === t.valor}
                    className={`temp-opcao t-${t.valor}${form.temperatura === t.valor ? ' ativo' : ''}`}
                    onClick={() => set('temperatura', (form.temperatura === t.valor ? '' : t.valor) as Temperatura)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {mais ? (
              <>
                <div className="field">
                  <label htmlFor="nl-email">E-mail</label>
                  <input id="nl-email" type="email" value={form.email} maxLength={200}
                    onChange={(e) => set('email', e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="nl-capt">Captação</label>
                  <select id="nl-capt" value={form.captacao} onChange={(e) => set('captacao', e.target.value)}>
                    <option value="">—</option>
                    {CAPTACOES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="nl-cidade">Cidade</label>
                  <input id="nl-cidade" value={form.cidade} maxLength={120}
                    onChange={(e) => set('cidade', e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="nl-regiao">Região</label>
                  <select id="nl-regiao" value={form.regiao} onChange={(e) => set('regiao', e.target.value)}>
                    <option value="">—</option>
                    {regioes.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="field col-2">
                  <label htmlFor="nl-obs">Observação</label>
                  <textarea id="nl-obs" value={form.observacao} maxLength={2000}
                    placeholder="Como chegou, o que pediu…" onChange={(e) => set('observacao', e.target.value)} />
                </div>
              </>
            ) : (
              <div className="col-2">
                <button type="button" className="link-btn" onClick={() => setMais(true)}>
                  + E-mail, captação, cidade, região e observação
                </button>
              </div>
            )}
          </div>

          {erro ? <div className="form-erro">{erro}</div> : null}

          <div className="modal-acoes">
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn primary" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Criar lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
