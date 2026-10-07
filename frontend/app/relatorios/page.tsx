'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type {
  FiltrosRelatorio,
  Ordem,
  RelatorioQualidade,
  RelatoriosResponse,
} from '@/lib/types';
import { formatData, formatNumero } from '@/lib/format';
import OrdenarSelect from '@/components/OrdenarSelect';

const PER_PAGE = 25;

const FILTROS_INICIAIS: FiltrosRelatorio = {
  busca: '',
  tipo: '',
  ordem: 'recentes',
  page: 1,
  per_page: PER_PAGE,
};

const ROTULO_TIPO: Record<string, string> = {
  executivo: 'Executivo',
  completo: 'Completo',
};

function tamanho(bytes: number): string {
  if (!bytes) return '—';
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

export default function RelatoriosPage() {
  const [filtros, setFiltros] = useState<FiltrosRelatorio>(FILTROS_INICIAIS);
  const [busca, setBusca] = useState('');
  const [resp, setResp] = useState<RelatoriosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async (f: FiltrosRelatorio, signal?: AbortSignal) => {
    setLoading(true);
    setErro(null);
    try {
      setResp(await api.listRelatorios({ ...f, per_page: f.per_page ?? PER_PAGE }, signal));
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

  const items = resp?.items ?? [];
  const total = resp?.total ?? 0;
  const page = resp?.page ?? filtros.page ?? 1;
  const perPage = resp?.per_page ?? PER_PAGE;
  const totalPaginas = Math.max(1, Math.ceil(total / perPage));

  function aplicar(patch: Partial<FiltrosRelatorio>) {
    setFiltros((f) => ({ ...f, ...patch, page: 1 }));
  }
  function irPara(p: number) {
    setFiltros((f) => ({ ...f, page: Math.min(Math.max(1, p), totalPaginas) }));
  }

  async function enviar(file: File) {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setFalha('Envie o relatório em .docx (arquivo do Word).');
      return;
    }
    setEnviando(true);
    setAviso(null);
    setFalha(null);
    try {
      const r = await api.importarRelatorio(file);
      setAviso(
        `Relatório gerado: ${r.titulo || file.name} — ${formatNumero(r.paginas)} página(s).`,
      );
      setFiltros((f) => ({ ...f, page: 1 }));
      await carregar({ ...filtros, page: 1 });
      await api.baixarRelatorio(r.id, 'pdf');
    } catch (e) {
      setFalha(e instanceof ApiError ? e.message : 'Não foi possível gerar o relatório.');
    } finally {
      setEnviando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function comOcupado(id: string, acao: () => Promise<void>) {
    setOcupado((s) => ({ ...s, [id]: true }));
    setFalha(null);
    try {
      await acao();
    } catch (e) {
      setFalha(e instanceof ApiError ? e.message : 'Não foi possível concluir a ação.');
    } finally {
      setOcupado((s) => {
        const n = { ...s };
        delete n[id];
        return n;
      });
    }
  }

  async function regerar(r: RelatorioQualidade) {
    await comOcupado(r.id, async () => {
      await api.regerarRelatorio(r.id);
      setAviso('PDF regerado com o layout atual.');
      await carregar(filtros);
    });
  }

  async function excluir(r: RelatorioQualidade) {
    const ok = window.confirm(
      `Excluir o relatório "${r.titulo || r.arquivo}"?\n\nO .docx enviado e o PDF gerado serão removidos.`,
    );
    if (!ok) return;
    await comOcupado(r.id, async () => {
      await api.deleteRelatorio(r.id);
      setAviso('Relatório excluído.');
      await carregar(filtros);
    });
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Relatórios gerenciais</h1>
          <div className="lead">
            Envie o relatório da Qualidade em Word e receba o PDF já diagramado no modelo
            da Diretoria.
          </div>
        </div>
      </div>

      <div
        className={`dropzone${arrastando ? ' ativo' : ''}${enviando ? ' ocupado' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !enviando) enviar(f);
        }}
      >
        <div className="dz-titulo">
          {enviando ? 'Gerando o PDF…' : 'Arraste o arquivo .docx aqui'}
        </div>
        <div className="dz-sub">
          Reconhece as duas versões: executiva (painel por setor) e completa (controle de
          qualidade interno). O download começa automaticamente.
        </div>
        <button
          className="btn primary"
          onClick={() => fileRef.current?.click()}
          disabled={enviando}
        >
          {enviando ? 'Gerando…' : 'Selecionar arquivo'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) enviar(f);
          }}
        />
      </div>

      {aviso ? (
        <div className="card" style={{ marginTop: 14, fontSize: '.85rem' }}>
          {aviso}
        </div>
      ) : null}
      {falha ? (
        <div
          className="card"
          style={{ marginTop: 14, fontSize: '.85rem', color: 'var(--erro)', fontWeight: 600 }}
          role="alert"
        >
          {falha}
        </div>
      ) : null}

      <form
        className="filters"
        style={{ marginTop: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          aplicar({ busca });
        }}
      >
        <div className="fgroup">
          <label htmlFor="rq-tipo">Versão</label>
          <select
            id="rq-tipo"
            value={filtros.tipo ?? ''}
            onChange={(e) => aplicar({ tipo: e.target.value as FiltrosRelatorio['tipo'] })}
          >
            <option value="">Todas</option>
            <option value="executivo">Executivo</option>
            <option value="completo">Completo</option>
          </select>
        </div>
        <div className="fgroup full">
          <label htmlFor="rq-busca">Busca</label>
          <input
            id="rq-busca"
            value={busca}
            placeholder="Título, período ou nome do arquivo"
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="actions">
          <div className="left">
            {resp ? (
              <>
                <b>{formatNumero(total)}</b> relatório(s) gerado(s)
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
            Relatórios
            <span className="count">{formatNumero(total)}</span>
          </div>
          <div className="t-right">
            <OrdenarSelect
              value={filtros.ordem ?? 'recentes'}
              onChange={(v) => aplicar({ ordem: v as Ordem })}
            />
            <span className="muted">
              Página {page} de {totalPaginas}
            </span>
          </div>
        </div>

        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Gerado em</th>
                <th>Relatório</th>
                <th>Período</th>
                <th>Versão</th>
                <th>Páginas</th>
                <th>Enviado por</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="empty-row" colSpan={7}>
                    <div className="spinner" />
                    Carregando relatórios…
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
                    Nenhum relatório gerado ainda.
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap">{formatData(r.created_at)}</td>
                    <td className="wrap">
                      {r.titulo || r.arquivo}
                      <div className="obs">{r.arquivo}</div>
                    </td>
                    <td className="nowrap">{r.periodo || '—'}</td>
                    <td className="nowrap">
                      <span className={`tipo-tag ${r.tipo === 'completo' ? 'convenio' : ''}`}>
                        {ROTULO_TIPO[r.tipo] ?? r.tipo}
                      </span>
                    </td>
                    <td className="nowrap">
                      {formatNumero(r.paginas)}
                      <div className="obs">{tamanho(r.tamanho_pdf)}</div>
                    </td>
                    <td className="wrap">{r.enviado_por_nome || '—'}</td>
                    <td className="nowrap">
                      <div className="row-acoes">
                        <button
                          className="notebtn ok"
                          onClick={() =>
                            comOcupado(r.id, () => api.baixarRelatorio(r.id, 'pdf'))
                          }
                          disabled={!!ocupado[r.id]}
                        >
                          Baixar PDF
                        </button>
                        <button
                          className="notebtn"
                          onClick={() =>
                            comOcupado(r.id, () => api.baixarRelatorio(r.id, 'docx'))
                          }
                          disabled={!!ocupado[r.id]}
                        >
                          Word original
                        </button>
                        <button
                          className="notebtn"
                          onClick={() => regerar(r)}
                          disabled={!!ocupado[r.id]}
                          title="Refaz o PDF a partir do Word enviado"
                        >
                          Regerar
                        </button>
                        <button
                          className="notebtn danger"
                          onClick={() => excluir(r)}
                          disabled={!!ocupado[r.id]}
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
    </div>
  );
}
