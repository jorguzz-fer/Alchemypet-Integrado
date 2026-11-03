'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type {
  Conta,
  ContaDetalhe,
  ContasResponse,
  CrmContagem,
  CrmFiltros,
  CrmFunil,
  CrmImportArquivo,
  CrmResumo,
  FiltrosContas,
  Temperatura,
} from '@/lib/types';
import { diasDesde, formatNumero, tempoDesde } from '@/lib/format';
import Kpi from '@/components/Kpi';
import Funil from '@/components/crm/Funil';
import ContaPainel from '@/components/crm/ContaPainel';
import NovaContaModal from '@/components/crm/NovaContaModal';
import RankingAtividades from '@/components/crm/RankingAtividades';
import { EtapaChip, IconeWhats, TEMPERATURAS, Termometro, linkWhatsapp } from '@/components/crm/crmUi';

const PER_PAGE = 25;
// A partir de quantos dias sem atividade a conta merece atenção.
const DIAS_ALERTA = 30;

type Aba = 'contas' | 'atividades' | 'indicadores';

const FILTROS_INICIAIS: FiltrosContas = {
  busca: '',
  etapa: '',
  uso: '',
  regiao: '',
  vendedor: '',
  temperatura: '',
  ordem: 'nome',
  page: 1,
  per_page: PER_PAGE,
};

function Barras({ itens }: { itens: CrmContagem[] }) {
  if (!itens || itens.length === 0) return <div className="trat-empty">Sem dados.</div>;
  const max = Math.max(1, ...itens.map((i) => i.total));
  return (
    <div className="hbars">
      {itens.map((i) => (
        <div className="hbar alt" key={i.label}>
          <span className="nm" title={i.label}>
            {i.label}
          </span>
          <span className="track">
            <span className="fill" style={{ width: `${Math.max(3, (i.total / max) * 100)}%` }} />
          </span>
          <span className="num">{formatNumero(i.total)}</span>
        </div>
      ))}
    </div>
  );
}

function UltimoContato({ conta }: { conta: Conta }) {
  // Vermelho só para quem já teve contato e esfriou; "nunca" fica neutro
  // (o histórico do Pocket ainda não foi importado).
  const dias = diasDesde(conta.ultima_atividade_em);
  const atrasado = dias !== null && dias >= DIAS_ALERTA;
  return (
    <span className={atrasado ? 'contato-atrasado' : 'muted'}>{tempoDesde(conta.ultima_atividade_em)}</span>
  );
}

export default function CrmPage() {
  const { usuario } = useAuth();
  const admin = usuario?.perfil === 'admin';

  const [aba, setAba] = useState<Aba>('contas');
  const [opcoes, setOpcoes] = useState<CrmFiltros>({
    regioes: [],
    vendedores: [],
    etapas: [],
    temperaturas: [],
    tipos_atividade: [],
  });
  const [resumo, setResumo] = useState<CrmResumo | null>(null);
  const [funil, setFunil] = useState<CrmFunil | null>(null);
  const [filtros, setFiltros] = useState<FiltrosContas>(FILTROS_INICIAIS);
  const [busca, setBusca] = useState('');
  const [maisFiltros, setMaisFiltros] = useState(false);
  const [resp, setResp] = useState<ContasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [painel, setPainel] = useState<{ id: string; atividade: boolean } | null>(null);
  const [novo, setNovo] = useState(false);

  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState<CrmImportArquivo[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const carregarOpcoes = useCallback(async (signal?: AbortSignal) => {
    try {
      setOpcoes(await api.crmFiltros(signal));
    } catch {
      /* os filtros ficam vazios; a lista ainda funciona */
    }
  }, []);

  const carregar = useCallback(async (f: FiltrosContas, signal?: AbortSignal) => {
    setLoading(true);
    setErro(null);
    try {
      const [r, fu] = await Promise.all([
        api.listContas({ ...f, per_page: f.per_page ?? PER_PAGE }, signal),
        api.crmFunil(f, signal),
      ]);
      setResp(r);
      setFunil(fu);
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
    carregarOpcoes(ctrl.signal);
    return () => ctrl.abort();
  }, [carregarOpcoes]);

  useEffect(() => {
    const ctrl = new AbortController();
    carregar(filtros, ctrl.signal);
    return () => ctrl.abort();
  }, [filtros, carregar]);

  useEffect(() => {
    if (aba !== 'indicadores') return;
    const ctrl = new AbortController();
    api
      .crmResumo(ctrl.signal)
      .then(setResumo)
      .catch(() => {
        /* mostra "Sem dados" */
      });
    return () => ctrl.abort();
  }, [aba]);

  const items = resp?.items ?? [];
  const total = resp?.total ?? 0;
  const page = resp?.page ?? filtros.page ?? 1;
  const perPage = resp?.per_page ?? PER_PAGE;
  const totalPaginas = Math.max(1, Math.ceil(total / perPage));
  const semContas = !loading && !erro && funil !== null && funil.total === 0 && !temFiltro(filtros);

  function aplicar(patch: Partial<FiltrosContas>) {
    setFiltros((f) => ({ ...f, ...patch, page: 1 }));
  }
  function irPara(p: number) {
    setFiltros((f) => ({ ...f, page: Math.min(Math.max(1, p), totalPaginas) }));
  }

  // Atualiza a linha sem recarregar a lista; o funil é recontado.
  function aposMudanca(c: ContaDetalhe) {
    setResp((r) => (r ? { ...r, items: r.items.map((it) => (it.id === c.id ? { ...it, ...c } : it)) } : r));
    api.crmFunil(filtros).then(setFunil).catch(() => undefined);
  }

  async function importar(files: File[]) {
    if (files.length === 0) return;
    setImportando(true);
    setAviso(null);
    setRelatorio(null);
    try {
      const r = await api.importarPocket(files);
      setRelatorio(r.arquivos);
      await carregarOpcoes();
      setFiltros((f) => ({ ...f, page: 1 }));
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : 'Não foi possível importar os arquivos.');
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>CRM</h1>
          <div className="lead">Clínicas e leads numa conta só: funil, contato e histórico.</div>
        </div>
        <div className="actions">
          {admin ? (
            <>
              <button className="btn ghost" onClick={() => fileRef.current?.click()} disabled={importando}>
                {importando ? 'Importando…' : 'Importar do Pocket'}
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                style={{ display: 'none' }}
                onChange={(e) => importar(Array.from(e.target.files ?? []))}
              />
            </>
          ) : null}
          <button className="btn primary" onClick={() => setNovo(true)}>
            + Novo lead
          </button>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {(
          [
            ['contas', 'Contas'],
            ['atividades', 'Atividades'],
            ['indicadores', 'Indicadores'],
          ] as [Aba, string][]
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={aba === k} className={`tab${aba === k ? ' ativo' : ''}`}
            onClick={() => setAba(k)}>
            {l}
          </button>
        ))}
      </div>

      {aviso ? (
        <div className="card" style={{ marginTop: 14, fontSize: '.85rem' }}>
          {aviso}
        </div>
      ) : null}

      {relatorio ? (
        <div className="tablewrap crm-import">
          <div className="tabletools">
            <div className="t-left">
              Resultado da importação
              <span className="count">{relatorio.length}</span>
            </div>
            <div className="t-right">
              <button className="btn ghost sm" onClick={() => setRelatorio(null)}>
                Fechar
              </button>
            </div>
          </div>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Linhas</th>
                  <th>Novos</th>
                  <th>Atualizados</th>
                  <th>Ignorados</th>
                </tr>
              </thead>
              <tbody>
                {relatorio.map((a) => (
                  <tr key={a.arquivo}>
                    <td className="wrap">
                      <b>{a.rotulo}</b>
                      <div className="crm-sub">{a.arquivo}</div>
                      {a.avisos.length ? (
                        <ul className="avisos">
                          {a.avisos.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td>{formatNumero(a.linhas)}</td>
                    <td>{formatNumero(a.criados)}</td>
                    <td>{formatNumero(a.atualizados)}</td>
                    <td>{formatNumero(a.ignorados)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {aba === 'contas' ? (
        semContas ? (
          <div className="state">
            <div className="muted">
              Nenhuma conta ainda.{' '}
              {admin
                ? 'Use “Importar do Pocket” e selecione de uma vez os arquivos exportados dos grids (clínicas, leads, utilização, usuários…), ou crie um lead.'
                : 'Crie um lead ou peça a um administrador para importar as exportações do Pocket.'}
            </div>
          </div>
        ) : (
          <>
            <Funil funil={funil} ativa={filtros.etapa ?? ''} onChange={(e) => aplicar({ etapa: e })} />

            <form
              className="crm-filtros"
              onSubmit={(e) => {
                e.preventDefault();
                aplicar({ busca });
              }}
            >
              <input
                className="crm-busca"
                aria-label="Buscar conta"
                value={busca}
                placeholder="Buscar por nome, código, cidade, e-mail ou telefone"
                onChange={(e) => setBusca(e.target.value)}
              />
              <select aria-label="Vendedor" value={filtros.vendedor ?? ''}
                onChange={(e) => aplicar({ vendedor: e.target.value })}>
                <option value="">Todos os vendedores</option>
                {opcoes.vendedores.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <select aria-label="Temperatura" value={filtros.temperatura ?? ''}
                onChange={(e) => aplicar({ temperatura: e.target.value as Temperatura })}>
                <option value="">Qualquer temperatura</option>
                {TEMPERATURAS.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn primary sm">
                Buscar
              </button>
              <button type="button" className="link-btn" aria-expanded={maisFiltros}
                onClick={() => setMaisFiltros((m) => !m)}>
                {maisFiltros ? 'Menos filtros' : 'Mais filtros'}
              </button>
              {temFiltro(filtros) || busca ? (
                <button type="button" className="link-btn"
                  onClick={() => {
                    setBusca('');
                    setFiltros(FILTROS_INICIAIS);
                  }}>
                  Limpar
                </button>
              ) : null}
              {maisFiltros ? (
                <div className="crm-filtros-mais">
                  <select aria-label="Região" value={filtros.regiao ?? ''}
                    onChange={(e) => aplicar({ regiao: e.target.value })}>
                    <option value="">Todas as regiões</option>
                    {opcoes.regioes.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <select aria-label="Uso no período" value={filtros.uso ?? ''}
                    onChange={(e) => aplicar({ uso: e.target.value as FiltrosContas['uso'] })}>
                    <option value="">Uso: todos</option>
                    <option value="com">Com uso no período</option>
                    <option value="sem">Sem uso no período</option>
                    <option value="sem_info">Sem informação de uso</option>
                  </select>
                </div>
              ) : null}
            </form>

            <div className="tablewrap">
              <div className="tabletools">
                <div className="t-left">
                  Contas
                  <span className="count">{formatNumero(total)}</span>
                </div>
                <div className="t-right">
                  <select aria-label="Ordenar" value={filtros.ordem ?? 'nome'}
                    onChange={(e) => aplicar({ ordem: e.target.value as FiltrosContas['ordem'] })}>
                    <option value="nome">Nome (A–Z)</option>
                    <option value="atividade">Sem contato há mais tempo</option>
                    <option value="recentes">Contato mais recente</option>
                    <option value="os">Mais OS no período</option>
                  </select>
                </div>
              </div>

              <div className="scroll">
                <table className="crm-tabela">
                  <thead>
                    <tr>
                      <th>Conta</th>
                      <th>Etapa</th>
                      <th>Vendedor</th>
                      <th>Último contato</th>
                      <th aria-label="Ações" />
                    </tr>
                  </thead>
                  <tbody>
                    {loading && !resp ? (
                      <tr>
                        <td className="empty-row" colSpan={5}>
                          <div className="spinner" />
                          Carregando contas…
                        </td>
                      </tr>
                    ) : erro ? (
                      <tr>
                        <td className="empty-row" colSpan={5}>
                          <div style={{ color: 'var(--erro)', fontWeight: 700 }}>{erro}</div>
                          <button className="btn primary sm" style={{ marginTop: 12 }} onClick={() => carregar(filtros)}>
                            Tentar novamente
                          </button>
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td className="empty-row" colSpan={5}>
                          Nenhuma conta para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      items.map((c) => {
                        const whats = linkWhatsapp(c.whatsapp);
                        return (
                          <tr key={c.id} className={`conta-linha${loading ? ' carregando' : ''}`}
                            onClick={() => setPainel({ id: c.id, atividade: false })}>
                            <td className="wrap">
                              <div className="conta-nome">
                                <Termometro t={c.temperatura} />
                                <button type="button" className="conta-abrir"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPainel({ id: c.id, atividade: false });
                                  }}>
                                  {c.nome}
                                </button>
                              </div>
                              <div className="crm-sub">
                                {c.codigo_pocket ? `Código ${c.codigo_pocket}` : 'Sem código'}
                                {c.cidade ? ` · ${c.cidade}${c.uf ? `/${c.uf}` : ''}` : c.regiao ? ` · ${c.regiao}` : ''}
                                {c.captacao ? ` · ${c.captacao}` : ''}
                              </div>
                            </td>
                            <td>
                              <EtapaChip etapa={c.etapa} />
                            </td>
                            <td className="wrap">{c.vendedor || <span className="muted">—</span>}</td>
                            <td className="nowrap">
                              <UltimoContato conta={c} />
                            </td>
                            <td className="nowrap">
                              <div className="linha-acoes">
                                {whats ? (
                                  <a className="acao-icone" href={whats} target="_blank" rel="noopener noreferrer"
                                    aria-label={`WhatsApp de ${c.nome}`} title="Abrir WhatsApp"
                                    onClick={(e) => e.stopPropagation()}>
                                    <IconeWhats size={18} />
                                  </a>
                                ) : null}
                                <button type="button" className="btn ghost sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPainel({ id: c.id, atividade: true });
                                  }}>
                                  + Atividade
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
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
          </>
        )
      ) : null}

      {aba === 'atividades' ? <RankingAtividades /> : null}

      {aba === 'indicadores' ? (
        resumo ? (
          <>
            <div className="kpis kpis-4" style={{ marginTop: 14 }}>
              <Kpi label="Clínicas do Pocket" value={formatNumero(resumo.clientes_pocket)}
                sub={`${formatNumero(resumo.clientes_com_dados_de_lead)} com qualificação`} tone="total" />
              <Kpi label="Com uso" value={formatNumero(resumo.com_uso)}
                sub={`${formatNumero(resumo.os_no_periodo)} OS no período`} tone="ok" />
              <Kpi label="Sem uso" value={formatNumero(resumo.sem_uso)} sub="clínicas paradas" tone="pend" />
              <Kpi label="Transferências de portador" value={formatNumero(resumo.transferencias)}
                sub={`${formatNumero(resumo.transferencias_aprovadas)} com aprovação`} tone="trat" />
            </div>
            <div className="grid-charts-2" style={{ marginTop: 14 }}>
              <div className="card">
                <h4>Clínicas por região</h4>
                <div className="csub">As 12 regiões com mais clínicas.</div>
                <Barras itens={resumo.por_regiao} />
              </div>
              <div className="card">
                <h4>Laboratórios concorrentes citados</h4>
                <div className="csub">Na qualificação dos leads.</div>
                <Barras itens={resumo.concorrentes} />
              </div>
              <div className="card">
                <h4>Contas por vendedor</h4>
                <div className="csub">Carteira atribuída.</div>
                <Barras itens={resumo.por_vendedor} />
              </div>
              <div className="card">
                <h4>Canal de captação</h4>
                <div className="csub">Como a conta chegou até a Alchemypet.</div>
                <Barras itens={resumo.por_captacao} />
              </div>
            </div>
          </>
        ) : (
          <div className="state">
            <div className="spinner" />
          </div>
        )
      ) : null}

      {painel ? (
        <ContaPainel
          key={painel.id}
          contaId={painel.id}
          focarAtividade={painel.atividade}
          tiposAtividade={opcoes.tipos_atividade}
          vendedores={opcoes.vendedores}
          onClose={() => setPainel(null)}
          onChanged={aposMudanca}
        />
      ) : null}

      {novo ? (
        <NovaContaModal
          vendedores={opcoes.vendedores}
          regioes={opcoes.regioes}
          onClose={() => setNovo(false)}
          onSaved={(c) => {
            setNovo(false);
            setAviso(`Lead "${c.nome}" criado.`);
            carregarOpcoes();
            setFiltros((f) => ({ ...f, page: 1 }));
            setPainel({ id: c.id, atividade: false });
          }}
        />
      ) : null}
    </div>
  );
}

function temFiltro(f: FiltrosContas): boolean {
  return Boolean(f.busca || f.etapa || f.uso || f.regiao || f.vendedor || f.temperatura);
}

