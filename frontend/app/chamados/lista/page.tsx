'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useSelecaoLote } from '@/components/useSelecaoLote';
import type {
  ChamadosResponse,
  Chamado,
  ConclusaoRevisao,
  FiltrosChamado,
  PlacarRevisao,
} from '@/lib/types';
import { formatData, formatNumero } from '@/lib/format';
import ChamadoFormModal from '@/components/ChamadoFormModal';
import ColunaOrdenavel from '@/components/ColunaOrdenavel';
import ImportarEmailsModal from '@/components/ImportarEmailsModal';

const MOTIVO_REVISAO = 'Revisão de resultado';
const CONCLUSOES: { valor: Exclude<ConclusaoRevisao, ''>; rotulo: string; curto: string }[] = [
  { valor: 'erro_nosso', rotulo: 'Erro nosso (corrigido)', curto: 'Erro nosso' },
  { valor: 'correto', rotulo: 'Resultado estava correto', curto: 'Correto' },
  { valor: 'nao_identificado', rotulo: 'Não identificado', curto: '?' },
];

function pct(n: number, total: number) {
  return total ? `${Math.round((100 * n) / total)}%` : '—';
}

const PER_PAGE = 25;

const FILTROS_INICIAIS: FiltrosChamado = {
  complexidade: '',
  motivo: '',
  status: '',
  conclusao: '',
  busca: '',
  data_de: '',
  data_ate: '',
  ordem: 'recentes',
  page: 1,
  per_page: PER_PAGE,
};

const CX_ROTULO: Record<string, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export default function ChamadosListaPage() {
  const [filtros, setFiltros] = useState<FiltrosChamado>(FILTROS_INICIAIS);
  const [busca, setBusca] = useState('');
  const [resp, setResp] = useState<ChamadosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [motivos, setMotivos] = useState<string[]>([]);
  const [form, setForm] = useState<'novo' | Chamado | null>(null);
  const [ocupado, setOcupado] = useState<Record<string, boolean>>({});
  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importarEmails, setImportarEmails] = useState(false);
  const [placar, setPlacar] = useState<PlacarRevisao | null>(null);
  const emRevisao = filtros.motivo === MOTIVO_REVISAO;

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .chamadosMotivos(ctrl.signal)
      .then(setMotivos)
      .catch(() => {
        /* opcional */
      });
    return () => ctrl.abort();
  }, [resp]);

  const carregar = useCallback(async (f: FiltrosChamado, signal?: AbortSignal) => {
    setLoading(true);
    setErro(null);
    try {
      const r = await api.listChamados({ ...f, per_page: f.per_page ?? PER_PAGE }, signal);
      setResp(r);
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
    carregar(filtros, ctrl.signal);
    return () => ctrl.abort();
  }, [filtros, carregar]);

  // Placar das revisões de resultado (mesmos filtros, sem a conclusão).
  const { page: _p1, per_page: _p2, ordem: _p3, sort: _p4, dir: _p5, conclusao: _p6, ...filtrosPlacar } = filtros;
  const chavePlacar = JSON.stringify(filtrosPlacar);
  const carregarPlacar = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setPlacar(await api.placarRevisao(JSON.parse(chavePlacar), signal));
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setPlacar(null);
      }
    },
    [chavePlacar],
  );
  useEffect(() => {
    if (!emRevisao) {
      setPlacar(null);
      return;
    }
    const ctrl = new AbortController();
    carregarPlacar(ctrl.signal);
    return () => ctrl.abort();
  }, [emRevisao, carregarPlacar]);

  async function marcarConclusao(c: Chamado, valor: ConclusaoRevisao) {
    const novo: ConclusaoRevisao = c.conclusao === valor && c.conclusao_origem === 'manual' ? '' : valor;
    const antes = { conclusao: c.conclusao, conclusao_origem: c.conclusao_origem, conclusao_trecho: c.conclusao_trecho };
    const trocar = (patch: Partial<Chamado>) =>
      setResp((r) => (r ? { ...r, items: r.items.map((it) => (it.id === c.id ? { ...it, ...patch } : it)) } : r));
    trocar({ conclusao: novo, conclusao_origem: novo ? 'manual' : '' });
    try {
      const salvo = await api.patchChamado(c.id, { conclusao: novo });
      trocar(salvo);
      carregarPlacar();
    } catch (e) {
      trocar(antes);
      setAviso(e instanceof ApiError ? e.message : 'Não foi possível salvar a conclusão.');
    }
  }

  const items = resp?.items ?? [];
  const total = resp?.total ?? 0;
  const page = resp?.page ?? filtros.page ?? 1;
  const perPage = resp?.per_page ?? PER_PAGE;
  const totalPaginas = Math.max(1, Math.ceil(total / perPage));

  // Seleção e exclusão em lote (filtros sem página/ordem).
  const { page: _pg, per_page: _pp, ordem: _o, sort: _s, dir: _d, ...filtrosLote } = filtros;

  // Ordenação pelo título da coluna (no servidor: vale para todas as páginas).
  const ordProps = {
    sort: filtros.sort,
    dir: filtros.dir,
    padrao: { sort: 'data', dir: 'desc' as const },
    onChange: (sort: string, dir: 'asc' | 'desc') => aplicar({ sort, dir }),
  };

  const [exportando, setExportando] = useState(false);
  async function exportarPlanilha() {
    setExportando(true);
    try {
      const { page: _a, per_page: _b, ...q } = filtros;
      await api.exportarLista('chamados', q, 'chamados.xlsx');
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : 'Não foi possível gerar a planilha.');
    } finally {
      setExportando(false);
    }
  }
  const sel = useSelecaoLote<Chamado>({
    recurso: 'chamados',
    items,
    total,
    filtros: filtrosLote,
    singular: 'chamado',
    plural: 'chamados',
    descrever: (c) => c.assunto || 'sem assunto',
    porPagina: { valor: perPage, onChange: (n) => setFiltros((f) => ({ ...f, per_page: n, page: 1 })) },
    onExcluidos: (n) => {
      setAviso(n === 1 ? '1 chamado excluído.' : `${formatNumero(n)} chamados excluídos.`);
      carregar(filtros);
    },
  });

  function aplicar(patch: Partial<FiltrosChamado>) {
    // A conclusão só existe nas revisões: trocar de motivo limpa esse filtro.
    const limpa = patch.motivo !== undefined && patch.motivo !== MOTIVO_REVISAO ? { conclusao: '' as const } : {};
    setFiltros((f) => ({ ...f, ...patch, ...limpa, page: 1 }));
  }
  function irPara(p: number) {
    setFiltros((f) => ({ ...f, page: Math.min(Math.max(1, p), totalPaginas) }));
  }

  async function alternarStatus(c: Chamado) {
    const novo = c.status === 'resolvido' ? 'aberto' : 'resolvido';
    setOcupado((s) => ({ ...s, [c.id]: true }));
    setResp((r) =>
      r
        ? { ...r, items: r.items.map((it) => (it.id === c.id ? { ...it, status: novo } : it)) }
        : r,
    );
    try {
      await api.patchChamado(c.id, { status: novo });
    } catch (e) {
      setResp((r) =>
        r
          ? { ...r, items: r.items.map((it) => (it.id === c.id ? { ...it, status: c.status } : it)) }
          : r,
      );
      setAviso(e instanceof ApiError ? e.message : 'Falha ao atualizar o status.');
    } finally {
      setOcupado((s) => {
        const n = { ...s };
        delete n[c.id];
        return n;
      });
    }
  }

  async function importar(file: File) {
    setImportando(true);
    setAviso(null);
    try {
      const r = await api.importarChamados(file);
      setAviso(
        `Importação concluída: ${formatNumero(r.importados)} novo(s) chamado(s), total ${formatNumero(r.total)}.`,
      );
      setFiltros((f) => ({ ...f, page: 1 }));
      await carregar({ ...filtros, page: 1 });
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : 'Não foi possível importar a planilha.');
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function excluir(c: Chamado) {
    const ok = window.confirm(`Excluir o chamado "${c.assunto}"?\n\nEsta ação não pode ser desfeita.`);
    if (!ok) return;
    setOcupado((s) => ({ ...s, [c.id]: true }));
    try {
      await api.deleteChamado(c.id);
      setAviso('Chamado excluído.');
      await carregar(filtros);
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : 'Falha ao excluir o chamado.');
    } finally {
      setOcupado((s) => {
        const n = { ...s };
        delete n[c.id];
        return n;
      });
    }
  }

  async function aposSalvar(c: Chamado) {
    const criacao = form === 'novo';
    setForm(null);
    setAviso(criacao ? 'Chamado criado.' : 'Chamado atualizado.');
    if (criacao) setFiltros((f) => ({ ...f, page: 1 }));
    await carregar(criacao ? { ...filtros, page: 1 } : filtros);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Caixa de chamados</h1>
          <div className="lead">
            Chamados recebidos por e-mail — trate, responda e marque como resolvido.
          </div>
        </div>
        <div className="actions">
          <button
            className="btn ghost"
            onClick={exportarPlanilha}
            disabled={exportando || total === 0}
            title="Baixa todos os chamados do filtro, na ordem da lista"
          >
            {exportando ? 'Gerando…' : 'Exportar planilha'}
          </button>
          <button
            className="btn ghost"
            onClick={() => setImportarEmails(true)}
            title="Lê a exportação do Gmail e marca as revisões de resultado como erro nosso ou resultado correto"
          >
            Classificar revisões pelos e-mails
          </button>
          <button
            className="btn ghost"
            onClick={() => fileRef.current?.click()}
            disabled={importando}
          >
            {importando ? 'Importando…' : 'Importar planilha'}
          </button>
          <button className="btn primary" onClick={() => setForm('novo')}>
            + Novo chamado
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importar(f);
            }}
          />
        </div>
      </div>

      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          aplicar({ busca });
        }}
      >
        <div className="fgroup">
          <label htmlFor="ch-f-data-de">Data de</label>
          <input
            id="ch-f-data-de"
            type="date"
            value={filtros.data_de ?? ''}
            max={filtros.data_ate || undefined}
            onChange={(e) => aplicar({ data_de: e.target.value })}
          />
        </div>
        <div className="fgroup">
          <label htmlFor="ch-f-data-ate">Data até</label>
          <input
            id="ch-f-data-ate"
            type="date"
            value={filtros.data_ate ?? ''}
            min={filtros.data_de || undefined}
            onChange={(e) => aplicar({ data_ate: e.target.value })}
          />
        </div>
        <div className="fgroup">
          <label htmlFor="ch-f-complex">Complexidade</label>
          <select
            id="ch-f-complex"
            value={filtros.complexidade ?? ''}
            onChange={(e) =>
              aplicar({ complexidade: e.target.value as FiltrosChamado['complexidade'] })
            }
          >
            <option value="">Todas</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>
        <div className="fgroup">
          <label htmlFor="ch-f-status">Status</label>
          <select
            id="ch-f-status"
            value={filtros.status ?? ''}
            onChange={(e) => aplicar({ status: e.target.value as FiltrosChamado['status'] })}
          >
            <option value="">Todos</option>
            <option value="aberto">Aberto</option>
            <option value="resolvido">Resolvido</option>
          </select>
        </div>
        <div className="fgroup wide">
          <label htmlFor="ch-f-motivo">Motivo</label>
          <select
            id="ch-f-motivo"
            value={filtros.motivo ?? ''}
            onChange={(e) => aplicar({ motivo: e.target.value })}
          >
            <option value="">Todos</option>
            {motivos.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        {emRevisao ? (
          <div className="fgroup">
            <label htmlFor="ch-f-conclusao">Conclusão da revisão</label>
            <select
              id="ch-f-conclusao"
              value={filtros.conclusao ?? ''}
              onChange={(e) => aplicar({ conclusao: e.target.value as FiltrosChamado['conclusao'] })}
            >
              <option value="">Todas</option>
              {CONCLUSOES.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.rotulo}
                </option>
              ))}
              <option value="pendente">A classificar</option>
            </select>
          </div>
        ) : null}
        <div className="fgroup full">
          <label htmlFor="ch-f-busca">Busca</label>
          <input
            id="ch-f-busca"
            value={busca}
            placeholder="Assunto, remetente ou motivo"
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="actions">
          <div className="left">
            {resp ? (
              <>
                <b>{formatNumero(total)}</b> chamado(s) no filtro atual
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

      {aviso ? (
        <div className="card" style={{ marginTop: 14, fontSize: '.85rem' }}>
          {aviso}
        </div>
      ) : null}

      {emRevisao && placar ? (
        <div className="rev-placar" aria-label="Conclusão das revisões de resultado">
          {(
            [
              ['erro_nosso', 'Erro nosso (corrigido)', placar.erro_nosso, 'c-erro'],
              ['correto', 'Resultado estava correto', placar.correto, 'c-certo'],
              ['nao_identificado', 'Não identificado', placar.nao_identificado, 'c-nao'],
              ['pendente', 'A classificar', placar.pendente, 'c-pend'],
            ] as const
          ).map(([valor, rotulo, n, cls]) => (
            <button
              key={valor}
              type="button"
              className={`rev-kpi ${cls}${filtros.conclusao === valor ? ' ativo' : ''}`}
              onClick={() => aplicar({ conclusao: filtros.conclusao === valor ? '' : valor })}
              aria-pressed={filtros.conclusao === valor}
            >
              <span className="lab">{rotulo}</span>
              <span className="val">{formatNumero(n)}</span>
              <span className="sub">{pct(n, placar.total)} das {formatNumero(placar.total)} revisões</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="tablewrap">
        <div className="tabletools">
          <div className="t-left">
            Chamados
            <span className="count">{formatNumero(total)}</span>
          </div>
          <div className="t-right">
            <span className="muted">
              Página {page} de {totalPaginas}
            </span>
          </div>
        </div>

        {sel.barra}

        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th className="sel-col">{sel.cabecalho}</th>
                <ColunaOrdenavel campo="data" label="Data" inicial="desc" {...ordProps} />
                <ColunaOrdenavel campo="assunto" label="Assunto" {...ordProps} />
                <ColunaOrdenavel campo="complexidade" label="Complexidade" inicial="desc" {...ordProps} />
                <ColunaOrdenavel campo="motivo" label="Motivo" {...ordProps} />
                <ColunaOrdenavel campo="status" label="Status" {...ordProps} />
                {emRevisao ? <ColunaOrdenavel campo="conclusao" label="Conclusão da revisão" {...ordProps} /> : null}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="empty-row" colSpan={emRevisao ? 8 : 7}>
                    <div className="spinner" />
                    Carregando chamados…
                  </td>
                </tr>
              ) : erro ? (
                <tr>
                  <td className="empty-row" colSpan={emRevisao ? 8 : 7}>
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
                  <td className="empty-row" colSpan={emRevisao ? 8 : 7}>
                    Nenhum chamado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                items.map((c) => (
                  <tr key={c.id}>
                    <td className="sel-col">{sel.caixa(c)}</td>
                    <td className="nowrap">{formatData(c.data)}</td>
                    <td className="wrap">{c.assunto || '—'}</td>
                    <td>
                      <span className={`cxtag ${c.complexidade || 'media'}`}>
                        {CX_ROTULO[c.complexidade] ?? '—'}
                      </span>
                    </td>
                    <td className="wrap">{c.motivo || '—'}</td>
                    <td>
                      <span className={`stag ${c.status}`}>
                        {c.status === 'resolvido' ? 'Resolvido' : 'Aberto'}
                      </span>
                    </td>
                    {emRevisao ? (
                      <td className="rev-cel">
                        <div className="rev-botoes" role="group" aria-label="Conclusão da revisão">
                          {CONCLUSOES.map((o) => (
                            <button
                              key={o.valor}
                              type="button"
                              className={`rev-bt b-${o.valor}${c.conclusao === o.valor ? ' ativo' : ''}`}
                              aria-pressed={c.conclusao === o.valor}
                              title={o.rotulo}
                              onClick={() => marcarConclusao(c, o.valor)}
                            >
                              {o.curto}
                            </button>
                          ))}
                        </div>
                        {c.conclusao ? (
                          <div className="rev-origem">
                            {c.conclusao_origem === 'manual' ? 'Marcado na tela' : 'Lido do e-mail'}
                          </div>
                        ) : null}
                        {c.conclusao_trecho && c.conclusao_origem === 'email' ? (
                          <div className="rev-trecho" title={c.conclusao_trecho}>
                            “{c.conclusao_trecho}”
                          </div>
                        ) : null}
                      </td>
                    ) : null}
                    <td className="nowrap">
                      <div className="row-acoes">
                        <button
                          className={`notebtn ${c.status === 'resolvido' ? '' : 'ok'}`}
                          onClick={() => alternarStatus(c)}
                          disabled={!!ocupado[c.id]}
                        >
                          {c.status === 'resolvido' ? 'Reabrir' : 'Resolver'}
                        </button>
                        {c.link_gmail ? (
                          <a
                            className="notebtn"
                            href={c.link_gmail}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Abrir no Gmail
                          </a>
                        ) : null}
                        <button className="notebtn" onClick={() => setForm(c)}>
                          Editar
                        </button>
                        <button
                          className="notebtn danger"
                          onClick={() => excluir(c)}
                          disabled={!!ocupado[c.id]}
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
            <button onClick={() => irPara(totalPaginas)} disabled={page >= totalPaginas}>
              »
            </button>
          </div>
        </div>
      </div>

      {form ? (
        <ChamadoFormModal
          chamado={form === 'novo' ? null : form}
          motivos={motivos}
          onClose={() => setForm(null)}
          onSaved={aposSalvar}
        />
      ) : null}

      {importarEmails ? (
        <ImportarEmailsModal
          onClose={() => setImportarEmails(false)}
          onConcluido={() => {
            if (!emRevisao) aplicar({ motivo: MOTIVO_REVISAO });
            else {
              carregar(filtros);
              carregarPlacar();
            }
          }}
        />
      ) : null}

      {sel.modal}
    </div>
  );
}
