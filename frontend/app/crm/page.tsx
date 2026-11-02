'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type {
  Conta,
  ContasResponse,
  CrmContagem,
  CrmFiltros,
  CrmImportArquivo,
  CrmResumo,
  FiltrosContas,
} from '@/lib/types';
import { formatNumero } from '@/lib/format';
import Kpi from '@/components/Kpi';

const PER_PAGE = 25;

const FILTROS_INICIAIS: FiltrosContas = {
  busca: '',
  etapa: '',
  uso: '',
  regiao: '',
  vendedor: '',
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

function TagEtapa({ etapa }: { etapa: string }) {
  if (etapa === 'cliente') return <span className="cxtag baixa">Cliente</span>;
  if (etapa === 'lead') return <span className="cxtag media">Lead</span>;
  return <span className="stag aberto">—</span>;
}

function TagUso({ conta }: { conta: Conta }) {
  if (conta.etapa !== 'cliente') return <span className="muted">—</span>;
  if (conta.em_uso === true)
    return <span className="stag resolvido">{formatNumero(conta.qtd_os_periodo)} OS</span>;
  if (conta.em_uso === false) return <span className="cxtag alta">Sem uso</span>;
  return <span className="stag aberto">Sem informação</span>;
}

export default function CrmPage() {
  const { usuario } = useAuth();
  const admin = usuario?.perfil === 'admin';

  const [resumo, setResumo] = useState<CrmResumo | null>(null);
  const [opcoes, setOpcoes] = useState<CrmFiltros>({ regioes: [], vendedores: [] });
  const [filtros, setFiltros] = useState<FiltrosContas>(FILTROS_INICIAIS);
  const [busca, setBusca] = useState('');
  const [resp, setResp] = useState<ContasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState<CrmImportArquivo[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const carregarResumo = useCallback(async (signal?: AbortSignal) => {
    try {
      const [r, o] = await Promise.all([api.crmResumo(signal), api.crmFiltros(signal)]);
      setResumo(r);
      setOpcoes(o);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }, []);

  const carregar = useCallback(async (f: FiltrosContas, signal?: AbortSignal) => {
    setLoading(true);
    setErro(null);
    try {
      setResp(await api.listContas({ ...f, per_page: f.per_page ?? PER_PAGE }, signal));
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
    carregarResumo(ctrl.signal);
    return () => ctrl.abort();
  }, [carregarResumo]);

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

  function aplicar(patch: Partial<FiltrosContas>) {
    setFiltros((f) => ({ ...f, ...patch, page: 1 }));
  }
  function irPara(p: number) {
    setFiltros((f) => ({ ...f, page: Math.min(Math.max(1, p), totalPaginas) }));
  }

  async function importar(files: File[]) {
    if (files.length === 0) return;
    setImportando(true);
    setAviso(null);
    setRelatorio(null);
    try {
      const r = await api.importarPocket(files);
      setRelatorio(r.arquivos);
      await Promise.all([carregarResumo(), carregar({ ...filtros, page: 1 })]);
      setFiltros((f) => ({ ...f, page: 1 }));
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : 'Não foi possível importar os arquivos.');
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const vazio = resumo !== null && resumo.contas === 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>CRM · Contas</h1>
          <div className="lead">
            Clínicas e leads numa conta só, a partir das exportações do Sistema Pocket.
          </div>
        </div>
        {admin ? (
          <div className="actions">
            <button
              className="btn primary"
              onClick={() => fileRef.current?.click()}
              disabled={importando}
            >
              {importando ? 'Importando…' : 'Importar exportações do Pocket'}
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: 'none' }}
              onChange={(e) => importar(Array.from(e.target.files ?? []))}
            />
          </div>
        ) : null}
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

      {vazio ? (
        <div className="state">
          <div className="muted">
            Nenhuma conta ainda.{' '}
            {admin
              ? 'Use “Importar exportações do Pocket” e selecione os arquivos dos grids (clínicas, leads, utilização, usuários…) de uma vez.'
              : 'Peça a um administrador para importar as exportações do Pocket.'}
          </div>
        </div>
      ) : null}

      {resumo && !vazio ? (
        <>
          <div className="section-title">
            <span className="bar" />
            <h3>Carteira</h3>
          </div>
          <div className="kpis kpis-5">
            <Kpi
              label="Contas"
              value={formatNumero(resumo.contas)}
              sub="clínicas + leads"
              tone="total"
              onClick={() => aplicar({ etapa: '', uso: '' })}
              ativo={!filtros.etapa && !filtros.uso}
            />
            <Kpi
              label="Clientes"
              value={formatNumero(resumo.clientes)}
              sub={`${formatNumero(resumo.clientes_com_dados_de_lead)} com qualificação`}
              tone="ok"
              onClick={() => aplicar({ etapa: 'cliente', uso: '' })}
              ativo={filtros.etapa === 'cliente' && !filtros.uso}
            />
            <Kpi
              label="Com uso"
              value={formatNumero(resumo.com_uso)}
              sub={`${formatNumero(resumo.os_no_periodo)} OS no período`}
              tone="taxa"
              onClick={() => aplicar({ etapa: 'cliente', uso: 'com' })}
              ativo={filtros.uso === 'com'}
            />
            <Kpi
              label="Sem uso"
              value={formatNumero(resumo.sem_uso)}
              sub="clientes parados"
              tone="pend"
              onClick={() => aplicar({ etapa: 'cliente', uso: 'sem' })}
              ativo={filtros.uso === 'sem'}
            />
            <Kpi
              label="Leads"
              value={formatNumero(resumo.leads)}
              sub="ainda não são clientes"
              tone="trat"
              onClick={() => aplicar({ etapa: 'lead', uso: '' })}
              ativo={filtros.etapa === 'lead'}
            />
          </div>

          <div className="grid-charts-2" style={{ marginTop: 14 }}>
            <div className="card">
              <h4>Clientes por região</h4>
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
              <div className="csub">Carteira atribuída no Pocket.</div>
              <Barras itens={resumo.por_vendedor} />
            </div>
            <div className="card">
              <h4>Canal de captação</h4>
              <div className="csub">Como a conta chegou até a Alchemypet.</div>
              <Barras itens={resumo.por_captacao} />
            </div>
          </div>
        </>
      ) : null}

      {!vazio ? (
        <>
          <form
            className="filters"
            onSubmit={(e) => {
              e.preventDefault();
              aplicar({ busca });
            }}
          >
            <div className="fgroup">
              <label htmlFor="crm-etapa">Etapa</label>
              <select
                id="crm-etapa"
                value={filtros.etapa ?? ''}
                onChange={(e) => aplicar({ etapa: e.target.value as FiltrosContas['etapa'] })}
              >
                <option value="">Todas</option>
                <option value="cliente">Cliente</option>
                <option value="lead">Lead</option>
              </select>
            </div>
            <div className="fgroup">
              <label htmlFor="crm-uso">Uso</label>
              <select
                id="crm-uso"
                value={filtros.uso ?? ''}
                onChange={(e) => aplicar({ uso: e.target.value as FiltrosContas['uso'] })}
              >
                <option value="">Todos</option>
                <option value="com">Com uso</option>
                <option value="sem">Sem uso</option>
                <option value="sem_info">Sem informação</option>
              </select>
            </div>
            <div className="fgroup wide">
              <label htmlFor="crm-regiao">Região</label>
              <select
                id="crm-regiao"
                value={filtros.regiao ?? ''}
                onChange={(e) => aplicar({ regiao: e.target.value })}
              >
                <option value="">Todas</option>
                {opcoes.regioes.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="fgroup">
              <label htmlFor="crm-vendedor">Vendedor</label>
              <select
                id="crm-vendedor"
                value={filtros.vendedor ?? ''}
                onChange={(e) => aplicar({ vendedor: e.target.value })}
              >
                <option value="">Todos</option>
                {opcoes.vendedores.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="fgroup full">
              <label htmlFor="crm-busca">Busca</label>
              <input
                id="crm-busca"
                value={busca}
                placeholder="Nome, código, cidade ou telefone"
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div className="actions">
              <div className="left">
                {resp ? (
                  <>
                    <b>{formatNumero(total)}</b> conta(s) no filtro atual
                  </>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => {
                    setBusca('');
                    setFiltros(FILTROS_INICIAIS);
                  }}
                >
                  Limpar
                </button>
                <button type="submit" className="btn primary sm">
                  Aplicar filtros
                </button>
              </div>
            </div>
          </form>

          <div className="tablewrap">
            <div className="tabletools">
              <div className="t-left">
                Contas
                <span className="count">{formatNumero(total)}</span>
              </div>
              <div className="t-right">
                <select
                  aria-label="Ordenar"
                  value={filtros.ordem ?? 'nome'}
                  onChange={(e) => aplicar({ ordem: e.target.value as FiltrosContas['ordem'] })}
                >
                  <option value="nome">Nome (A–Z)</option>
                  <option value="os">Mais OS no período</option>
                </select>
                <span className="muted">
                  Página {page} de {totalPaginas}
                </span>
              </div>
            </div>

            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Conta</th>
                    <th>Etapa</th>
                    <th>Uso</th>
                    <th>Região</th>
                    <th>Vendedor</th>
                    <th>Contato</th>
                    <th>Qualificação</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="empty-row" colSpan={7}>
                        <div className="spinner" />
                        Carregando contas…
                      </td>
                    </tr>
                  ) : erro ? (
                    <tr>
                      <td className="empty-row" colSpan={7}>
                        <div style={{ color: 'var(--erro)', fontWeight: 700 }}>{erro}</div>
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
                      <td className="empty-row" colSpan={7}>
                        Nenhuma conta para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    items.map((c) => (
                      <tr key={c.id}>
                        <td className="wrap">
                          <b>{c.nome}</b>
                          <div className="crm-sub">
                            {c.codigo_pocket ? `Código ${c.codigo_pocket}` : 'Sem código'}
                            {c.cidade ? ` · ${c.cidade}${c.uf ? `/${c.uf}` : ''}` : ''}
                          </div>
                        </td>
                        <td>
                          <TagEtapa etapa={c.etapa} />
                        </td>
                        <td className="nowrap">
                          <TagUso conta={c} />
                        </td>
                        <td className="wrap">{c.regiao || '—'}</td>
                        <td className="wrap">{c.vendedor || '—'}</td>
                        <td className="wrap">
                          {c.whatsapp || '—'}
                          {c.email ? <div className="crm-sub">{c.email}</div> : null}
                        </td>
                        <td className="wrap">
                          {c.exames_mes != null ? `${formatNumero(c.exames_mes)} exames/mês` : '—'}
                          {c.captacao ? <div className="crm-sub">Captação: {c.captacao}</div> : null}
                          {c.laboratorios.length ? (
                            <div className="crm-sub">Usa: {c.laboratorios.join(', ')}</div>
                          ) : null}
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
                <button onClick={() => irPara(totalPaginas)} disabled={page >= totalPaginas}>
                  »
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
