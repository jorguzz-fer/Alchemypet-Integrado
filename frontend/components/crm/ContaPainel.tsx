'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Atividade, ContaDetalhe, ContaPatch, EtapaConta, Temperatura } from '@/lib/types';
import { formatData, formatNumero } from '@/lib/format';
import {
  ETAPAS,
  ETAPAS_SAIDA,
  EtapaChip,
  IconeWhats,
  TEMPERATURAS,
  Termometro,
  linkWhatsapp,
  rotuloEtapa,
} from './crmUi';

interface Props {
  contaId: string;
  tiposAtividade: string[];
  vendedores: string[];
  // Abre já com o formulário de atividade em foco (botão "+ Atividade" da lista).
  focarAtividade?: boolean;
  onClose: () => void;
  onChanged: (c: ContaDetalhe) => void;
}

function hoje(): { data: string; hora: string } {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    data: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    hora: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}

function simNao(v: boolean | null): string {
  return v === true ? 'Sim' : v === false ? 'Não' : '—';
}

export default function ContaPainel({
  contaId,
  tiposAtividade,
  vendedores,
  focarAtividade,
  onClose,
  onChanged,
}: Props) {
  const { usuario } = useAuth();
  const [conta, setConta] = useState<ContaDetalhe | null>(null);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Mudança para Inativo/Bloqueado pede o motivo antes de salvar.
  const [saidaPendente, setSaidaPendente] = useState<EtapaConta | null>(null);
  const [motivo, setMotivo] = useState('');

  const [tipo, setTipo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [quando, setQuando] = useState(hoje);
  const [registrando, setRegistrando] = useState(false);
  const tipoRef = useRef<HTMLSelectElement>(null);

  const carregar = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const [c, ats] = await Promise.all([
          api.getConta(contaId, signal),
          api.listAtividades(contaId, signal),
        ]);
        setConta(c);
        setAtividades(ats);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setErro(e instanceof ApiError ? e.message : 'Não foi possível carregar a conta.');
      }
    },
    [contaId],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    carregar(ctrl.signal);
    return () => ctrl.abort();
  }, [carregar]);

  useEffect(() => {
    if (focarAtividade && conta) tipoRef.current?.focus();
  }, [focarAtividade, conta]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function salvar(patch: ContaPatch) {
    if (!conta) return;
    setSalvando(true);
    setErro(null);
    try {
      const c = await api.patchConta(conta.id, patch);
      setConta(c);
      onChanged(c);
      // A mudança de etapa gera um registro no histórico.
      if (patch.etapa) setAtividades(await api.listAtividades(conta.id));
      return true;
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar.');
      return false;
    } finally {
      setSalvando(false);
    }
  }

  function escolherEtapa(e: EtapaConta) {
    if (!conta || e === conta.etapa) return;
    if (ETAPAS_SAIDA.includes(e)) {
      setSaidaPendente(e);
      setMotivo('');
      return;
    }
    setSaidaPendente(null);
    salvar({ etapa: e });
  }

  async function confirmarSaida() {
    if (!saidaPendente || !motivo.trim()) return;
    const ok = await salvar({ etapa: saidaPendente, motivo_encerramento: motivo.trim() });
    if (ok) setSaidaPendente(null);
  }

  async function registrar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!conta || !tipo) return;
    setRegistrando(true);
    setErro(null);
    try {
      const at = await api.createAtividade(conta.id, {
        tipo,
        descricao: descricao.trim(),
        data: quando.data,
        hora: quando.hora,
      });
      setAtividades((lista) => [at, ...lista]);
      const agora = new Date().toISOString();
      setConta({ ...conta, ultima_atividade_em: agora });
      onChanged({ ...conta, ultima_atividade_em: agora });
      setTipo('');
      setDescricao('');
      setQuando(hoje());
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível registrar a atividade.');
    } finally {
      setRegistrando(false);
    }
  }

  async function excluir(at: Atividade) {
    if (!window.confirm(`Excluir a atividade "${at.tipo}" de ${formatData(at.data)}?`)) return;
    try {
      await api.deleteAtividade(at.id);
      setAtividades((lista) => lista.filter((x) => x.id !== at.id));
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível excluir.');
    }
  }

  const whats = conta ? linkWhatsapp(conta.whatsapp) : null;

  return (
    <div
      className="drawer-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Conta">
        <div className="drawer-head">
          <div>
            <h3>{conta?.nome ?? 'Carregando…'}</h3>
            {conta ? (
              <div className="crm-sub">
                {conta.codigo_pocket ? `Código ${conta.codigo_pocket}` : 'Sem código no Pocket'}
                {conta.regiao ? ` · ${conta.regiao}` : ''}
                {conta.cidade ? ` · ${conta.cidade}${conta.uf ? `/${conta.uf}` : ''}` : ''}
              </div>
            ) : null}
          </div>
          <button className="btn ghost sm" onClick={onClose} aria-label="Fechar">
            Fechar
          </button>
        </div>

        {erro ? <div className="drawer-erro">{erro}</div> : null}

        {!conta ? (
          <div className="state">
            <div className="spinner" />
          </div>
        ) : (
          <div className="drawer-body">
            {/* Contato: as ações mais usadas, no topo e grandes. */}
            <div className="contato-acoes">
              {whats ? (
                <a className="btn primary sm" href={whats} target="_blank" rel="noopener noreferrer">
                  <IconeWhats /> WhatsApp
                </a>
              ) : null}
              {conta.email ? (
                <a className="btn ghost sm" href={`mailto:${conta.email}`}>
                  E-mail
                </a>
              ) : null}
              <span className="crm-sub">
                {conta.whatsapp || 'Sem telefone'}
                {conta.email ? ` · ${conta.email}` : ''}
              </span>
            </div>

            <section className="drawer-sec">
              <div className="sec-titulo">Etapa</div>
              <div className="etapa-seletor" role="radiogroup" aria-label="Etapa do funil">
                {ETAPAS.map((e) => (
                  <button
                    key={e.valor}
                    type="button"
                    role="radio"
                    aria-checked={conta.etapa === e.valor}
                    className={`etapa-opcao e-${e.valor}${conta.etapa === e.valor ? ' ativo' : ''}${
                      saidaPendente === e.valor ? ' pendente' : ''
                    }`}
                    disabled={salvando}
                    onClick={() => escolherEtapa(e.valor)}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
              {conta.etapa_derivada ? (
                <div className="crm-sub" style={{ marginTop: 6 }}>
                  Etapa deduzida na importação do Pocket. Ao escolher uma etapa aqui, ela passa a valer.
                </div>
              ) : null}
              {ETAPAS_SAIDA.includes(conta.etapa) && conta.motivo_encerramento ? (
                <div className="crm-sub" style={{ marginTop: 6 }}>
                  Motivo: {conta.motivo_encerramento}
                </div>
              ) : null}
              {saidaPendente ? (
                <div className="saida-motivo">
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label htmlFor="crm-motivo">
                      Motivo para mover para {rotuloEtapa(saidaPendente)} *
                    </label>
                    <input
                      id="crm-motivo"
                      autoFocus
                      value={motivo}
                      maxLength={1000}
                      placeholder="Ex.: fechou laboratório próprio, inadimplência…"
                      onChange={(e) => setMotivo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          confirmarSaida();
                        }
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn primary sm"
                      disabled={!motivo.trim() || salvando}
                      onClick={confirmarSaida}
                    >
                      Confirmar
                    </button>
                    <button className="btn ghost sm" onClick={() => setSaidaPendente(null)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="drawer-sec grid-2">
              <div>
                <div className="sec-titulo">Temperatura</div>
                <div className="temp-seletor" role="radiogroup" aria-label="Temperatura">
                  {TEMPERATURAS.map((t) => (
                    <button
                      key={t.valor}
                      type="button"
                      role="radio"
                      aria-checked={conta.temperatura === t.valor}
                      className={`temp-opcao t-${t.valor}${conta.temperatura === t.valor ? ' ativo' : ''}`}
                      disabled={salvando}
                      onClick={() =>
                        salvar({ temperatura: (conta.temperatura === t.valor ? '' : t.valor) as Temperatura })
                      }
                    >
                      <Termometro t={t.valor} /> {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="crm-vend">Vendedor</label>
                <select
                  id="crm-vend"
                  value={conta.vendedor}
                  disabled={salvando}
                  onChange={(e) => salvar({ vendedor: e.target.value })}
                >
                  <option value="">Sem vendedor</option>
                  {[...new Set([...vendedores, conta.vendedor].filter(Boolean))].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="drawer-sec">
              <div className="sec-titulo">Registrar atividade</div>
              <form className="atv-form" onSubmit={registrar}>
                <div className="atv-linha">
                  <div className="field">
                    <label htmlFor="atv-tipo">Tipo *</label>
                    <select
                      id="atv-tipo"
                      ref={tipoRef}
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value)}
                    >
                      <option value="">Escolha…</option>
                      {tiposAtividade.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="atv-data">Data</label>
                    <input
                      id="atv-data"
                      type="date"
                      value={quando.data}
                      onChange={(e) => setQuando((q) => ({ ...q, data: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="atv-hora">Hora</label>
                    <input
                      id="atv-hora"
                      type="time"
                      value={quando.hora}
                      onChange={(e) => setQuando((q) => ({ ...q, hora: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="atv-desc">Descrição</label>
                  <textarea
                    id="atv-desc"
                    value={descricao}
                    maxLength={4000}
                    placeholder="O que foi feito ou combinado"
                    onChange={(e) => setDescricao(e.target.value)}
                  />
                </div>
                <button className="btn primary sm" type="submit" disabled={!tipo || registrando}>
                  {registrando ? 'Registrando…' : 'Registrar'}
                </button>
              </form>
            </section>

            <section className="drawer-sec">
              <div className="sec-titulo">
                Histórico <span className="count">{atividades.length}</span>
              </div>
              {atividades.length === 0 ? (
                <div className="crm-sub">Nenhuma atividade ainda.</div>
              ) : (
                <ol className="timeline">
                  {atividades.map((a) => {
                    const sistema = a.tipo === 'Sistema';
                    const podeExcluir =
                      !sistema && (usuario?.perfil === 'admin' || a.usuario_id === usuario?.id);
                    return (
                      <li key={a.id} className={sistema ? 'sistema' : ''}>
                        <div className="tl-topo">
                          <b>{sistema ? 'Registro' : a.tipo}</b>
                          <span className="crm-sub">
                            {formatData(a.data)}
                            {a.hora ? ` ${a.hora}` : ''} · {a.usuario_nome || '—'}
                          </span>
                          {podeExcluir ? (
                            <button className="tl-excluir" onClick={() => excluir(a)} aria-label="Excluir atividade">
                              Excluir
                            </button>
                          ) : null}
                        </div>
                        {a.descricao ? <div className="tl-desc">{a.descricao}</div> : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <section className="drawer-sec">
              <div className="sec-titulo">Qualificação</div>
              <dl className="dados">
                <dt>Etapa</dt>
                <dd>
                  <EtapaChip etapa={conta.etapa} />
                </dd>
                <dt>Uso no período</dt>
                <dd>
                  {conta.em_uso === true
                    ? `${formatNumero(conta.qtd_os_periodo)} OS`
                    : conta.em_uso === false
                      ? 'Sem uso'
                      : '—'}
                </dd>
                <dt>Captação</dt>
                <dd>{conta.captacao || '—'}</dd>
                <dt>Decisor</dt>
                <dd>{simNao(conta.decisor)}</dd>
                <dt>Atendimentos/mês</dt>
                <dd>{conta.atendimentos_mes ?? '—'}</dd>
                <dt>Exames/mês</dt>
                <dd>{conta.exames_mes ?? '—'}</dd>
                <dt>Divide laboratório</dt>
                <dd>{simNao(conta.divide_laboratorio)}</dd>
                <dt>Laboratórios</dt>
                <dd>{conta.laboratorios.join(', ') || conta.laboratorios_texto || '—'}</dd>
                <dt>Nota do laboratório</dt>
                <dd>{conta.nota_laboratorio || '—'}</dd>
                <dt>Atende convênio</dt>
                <dd>
                  {conta.atende_convenio ? 'Sim' : 'Não'}
                  {conta.convenios ? ` (${conta.convenios})` : ''}
                </dd>
                <dt>Responsável</dt>
                <dd>{conta.responsavel || '—'}</dd>
                <dt>Onboarding</dt>
                <dd>{formatData(conta.onboarding_em)}</dd>
              </dl>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
