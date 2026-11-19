'use client';

// Manutenção do formulário (só admin): campos e exames.
// Campos e exames do papel não mudam de chave/código nem são excluídos (o PDF
// depende deles); podem ser renomeados, reordenados e desativados. Pedidos
// já feitos guardam a própria cópia e não mudam.
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { CampoEncaminhamento, ExameEncaminhamento, GrupoExames } from '@/lib/types';
import { Tubos } from '@/components/encaminhamento/Marcas';

const SECOES = { laudo: 'Emissão de laudos', motivo: 'Motivo da solicitação', laboratorio: 'Uso do laboratório',
  histo: 'Histologia e Citologia', parasito: 'Amostras de exame (ex.: 213)' };
const TIPOS = {
  texto: 'Texto curto', texto_longo: 'Texto longo', data: 'Data', numero: 'Número',
  opcao: 'Escolha (opções)', marcar: 'Marcar ( )', clinica: 'Clínica (busca no cadastro)',
  multipla: 'Várias escolhas ( )', diagrama: 'Desenho (distribuição das lesões)',
};
const LARGURAS = { 1: 'Linha inteira', 2: 'Metade', 3: 'Um terço', 4: 'Um quarto' };

type Aba = 'campos' | 'exames';

export default function ConfigurarFormularioPage() {
  const { usuario } = useAuth();
  const [aba, setAba] = useState<Aba>('exames');
  const [campos, setCampos] = useState<CampoEncaminhamento[]>([]);
  const [exames, setExames] = useState<ExameEncaminhamento[]>([]);
  const [grupos, setGrupos] = useState<GrupoExames[]>([]);
  const [editCampo, setEditCampo] = useState<Partial<CampoEncaminhamento> | null>(null);
  const [editExame, setEditExame] = useState<Partial<ExameEncaminhamento> | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [c, e, f] = await Promise.all([api.configCampos(), api.configExames(), api.formularioEncaminhamento()]);
      setCampos(c);
      setExames(e);
      setGrupos(f.grupos);
    } catch (err) {
      setAviso(err instanceof ApiError ? err.message : 'Não foi possível carregar a configuração.');
    }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  if (usuario && usuario.perfil !== 'admin') {
    return <div className="state"><div className="muted">Só administradores configuram o formulário.</div></div>;
  }

  async function acao(fn: () => Promise<unknown>, ok: string) {
    setAviso(null);
    try {
      await fn();
      setAviso(ok);
      await carregar();
    } catch (err) {
      setAviso(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    }
  }

  // Sobe/desce trocando a ordem com o vizinho do mesmo bloco.
  function mover<T extends { id: string; ordem: number }>(lista: T[], i: number, d: -1 | 1, salvar: (id: string, ordem: number) => Promise<unknown>) {
    const j = i + d;
    if (j < 0 || j >= lista.length) return;
    const a = lista[i], b = lista[j];
    const oa = a.ordem === b.ordem ? a.ordem + d : b.ordem;
    acao(() => Promise.all([salvar(a.id, oa), salvar(b.id, a.ordem)]), 'Ordem atualizada.');
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Configurar formulário de encaminhamento</h1>
          <div className="lead">
            Inclua, edite, reordene ou desative campos e exames. Pedidos já feitos não mudam.
          </div>
        </div>
        <div className="actions">
          {aba === 'campos' ? (
            <button className="btn primary" onClick={() => setEditCampo({ tipo: 'texto', secao: 'laudo', largura: 2, opcoes: [] })}>
              + Novo campo
            </button>
          ) : (
            <button className="btn primary" onClick={() => setEditExame({ grupo: 'fast_track', tubos: [], inclui: [] })}>
              + Novo exame
            </button>
          )}
        </div>
      </div>

      <div className="tabs" role="tablist">
        {(['exames', 'campos'] as Aba[]).map((a) => (
          <button key={a} role="tab" aria-selected={aba === a} className={`tab${aba === a ? ' ativo' : ''}`} onClick={() => setAba(a)}>
            {a === 'exames' ? `Exames (${exames.filter((e) => e.ativo).length})` : `Campos (${campos.filter((c) => c.ativo).length})`}
          </button>
        ))}
      </div>

      {aviso ? <div className="card" style={{ marginTop: 14, fontSize: '.85rem' }}>{aviso}</div> : null}

      {aba === 'exames'
        ? grupos.map((g) => {
            const lista = exames.filter((e) => e.grupo === g.id);
            return (
              <div key={g.id} className="tablewrap" style={{ marginTop: 14 }}>
                <div className="tabletools"><div className="t-left">{g.titulo}<span className="count">{lista.length}</span></div></div>
                <div className="scroll">
                  <table>
                    <tbody>
                      {lista.map((e, i) => (
                        <tr key={e.id} style={{ opacity: e.ativo ? 1 : 0.5 }}>
                          <td className="nowrap"><b>{e.codigo}</b></td>
                          <td className="wrap">
                            {e.nome}
                            {e.selo ? <span className="enc-selo" style={{ marginLeft: 6 }}>{e.selo}</span> : null}
                            {e.descricao ? <div className="obs">{e.descricao}</div> : null}
                          </td>
                          <td className="nowrap"><Tubos tubos={e.tubos} amostra={e.amostra} /></td>
                          <td className="nowrap">{e.ativo ? 'Ativo' : 'Desativado'}{e.do_papel ? ' · do papel' : ''}</td>
                          <td className="nowrap">
                            <div className="row-acoes">
                              <button className="notebtn" aria-label="Subir" onClick={() => mover(lista, i, -1, (id, ordem) => api.editarExame(id, { ordem }))}>↑</button>
                              <button className="notebtn" aria-label="Descer" onClick={() => mover(lista, i, 1, (id, ordem) => api.editarExame(id, { ordem }))}>↓</button>
                              <button className="notebtn" onClick={() => setEditExame(e)}>Editar</button>
                              <button className="notebtn" onClick={() => acao(() => api.editarExame(e.id, { ativo: !e.ativo }), e.ativo ? 'Exame desativado.' : 'Exame reativado.')}>
                                {e.ativo ? 'Desativar' : 'Reativar'}
                              </button>
                              {!e.do_papel ? (
                                <button className="notebtn danger" onClick={() => window.confirm(`Excluir o exame ${e.codigo}?`) && acao(() => api.excluirExame(e.id), 'Exame excluído.')}>
                                  Excluir
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        : (Object.keys(SECOES) as (keyof typeof SECOES)[]).map((s) => {
            const lista = campos.filter((c) => c.secao === s);
            return (
              <div key={s} className="tablewrap" style={{ marginTop: 14 }}>
                <div className="tabletools"><div className="t-left">{SECOES[s]}<span className="count">{lista.length}</span></div></div>
                <div className="scroll">
                  <table>
                    <tbody>
                      {lista.map((c, i) => (
                        <tr key={c.id} style={{ opacity: c.ativo ? 1 : 0.5 }}>
                          <td className="wrap">
                            <b>{c.rotulo}</b>{c.obrigatorio ? ' *' : ''}
                            <div className="obs">{c.chave}{c.mostrar_se ? ` · aparece se ${c.mostrar_se}` : ''}</div>
                          </td>
                          <td className="nowrap">{TIPOS[c.tipo]}</td>
                          <td className="nowrap">{c.ativo ? 'Ativo' : 'Desativado'}{c.do_papel ? ' · do papel' : ' · fora do papel'}</td>
                          <td className="nowrap">
                            <div className="row-acoes">
                              <button className="notebtn" aria-label="Subir" onClick={() => mover(lista, i, -1, (id, ordem) => api.editarCampo(id, { ordem }))}>↑</button>
                              <button className="notebtn" aria-label="Descer" onClick={() => mover(lista, i, 1, (id, ordem) => api.editarCampo(id, { ordem }))}>↓</button>
                              <button className="notebtn" onClick={() => setEditCampo(c)}>Editar</button>
                              <button className="notebtn" onClick={() => acao(() => api.editarCampo(c.id, { ativo: !c.ativo }), c.ativo ? 'Campo desativado.' : 'Campo reativado.')}>
                                {c.ativo ? 'Desativar' : 'Reativar'}
                              </button>
                              {!c.do_papel ? (
                                <button className="notebtn danger" onClick={() => window.confirm(`Excluir o campo "${c.rotulo}"?`) && acao(() => api.excluirCampo(c.id), 'Campo excluído.')}>
                                  Excluir
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

      {editCampo ? (
        <ModalCampo
          campo={editCampo}
          onClose={() => setEditCampo(null)}
          onSalvar={(c) =>
            acao(async () => {
              if (editCampo.id) await api.editarCampo(editCampo.id, c);
              else await api.criarCampo(c);
              setEditCampo(null);
            }, editCampo.id ? 'Campo atualizado.' : 'Campo criado. Ele aparece no formulário e na página extra do PDF.')
          }
        />
      ) : null}
      {editExame ? (
        <ModalExame
          exame={editExame}
          grupos={grupos}
          onClose={() => setEditExame(null)}
          onSalvar={(e) =>
            acao(async () => {
              if (editExame.id) await api.editarExame(editExame.id, e);
              else await api.criarExame(e);
              setEditExame(null);
            }, editExame.id ? 'Exame atualizado.' : 'Exame criado.')
          }
        />
      ) : null}
    </div>
  );
}

function ModalCampo({ campo, onClose, onSalvar }: {
  campo: Partial<CampoEncaminhamento>;
  onClose: () => void;
  onSalvar: (c: Partial<CampoEncaminhamento>) => void;
}) {
  const [f, setF] = useState(campo);
  const [opcoesTxt, setOpcoesTxt] = useState((campo.opcoes ?? []).map((o) => o.rotulo).join('\n'));
  const novo = !campo.id;
  const set = (p: Partial<CampoEncaminhamento>) => setF((x) => ({ ...x, ...p }));
  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const corpo: Partial<CampoEncaminhamento> = {
      rotulo: f.rotulo, secao: f.secao, obrigatorio: f.obrigatorio ?? false, largura: f.largura,
      mostrar_se: f.mostrar_se ?? '', ajuda: f.ajuda ?? '',
    };
    if (novo) {
      corpo.chave = f.chave;
      corpo.tipo = f.tipo;
    }
    if ((novo ? f.tipo : campo.tipo) === 'opcao') {
      corpo.opcoes = opcoesTxt.split('\n').map((t) => t.trim()).filter(Boolean).map((rotulo) => ({
        rotulo,
        valor: (campo.opcoes ?? []).find((o) => o.rotulo === rotulo)?.valor ??
          rotulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      }));
    }
    onSalvar(corpo);
  }
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={salvar}>
        <h3>{novo ? 'Novo campo' : `Editar campo: ${campo.rotulo}`}</h3>
        <div className="m-sub">
          {campo.do_papel ? 'Campo do formulário impresso: chave e tipo não mudam.' : 'Campos novos saem na página "Informações adicionais" do PDF.'}
        </div>
        <div className="form-grid">
          <div className="field col-2">
            <label htmlFor="cf-rot">Rótulo (como aparece na tela)</label>
            <input id="cf-rot" required value={f.rotulo ?? ''} onChange={(e) => set({ rotulo: e.target.value })} />
          </div>
          {novo ? (
            <div className="field">
              <label htmlFor="cf-chave">Chave (sem acento, ex.: jejum_horas)</label>
              <input id="cf-chave" required pattern="[a-z][a-z0-9_]{1,59}" value={f.chave ?? ''}
                onChange={(e) => set({ chave: e.target.value.toLowerCase() })} />
            </div>
          ) : null}
          {novo ? (
            <div className="field">
              <label htmlFor="cf-tipo">Tipo</label>
              <select id="cf-tipo" value={f.tipo} onChange={(e) => set({ tipo: e.target.value as CampoEncaminhamento['tipo'] })}>
                {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="cf-secao">Bloco</label>
            <select id="cf-secao" value={f.secao} onChange={(e) => set({ secao: e.target.value as CampoEncaminhamento['secao'] })}>
              {Object.entries(SECOES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cf-larg">Largura no computador</label>
            <select id="cf-larg" value={f.largura ?? 1} onChange={(e) => set({ largura: Number(e.target.value) })}>
              {Object.entries(LARGURAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {['opcao', 'multipla'].includes((novo ? f.tipo : campo.tipo) ?? '') ? (
            <div className="field col-2">
              <label htmlFor="cf-op">Opções (uma por linha)</label>
              <textarea id="cf-op" value={opcoesTxt} onChange={(e) => setOpcoesTxt(e.target.value)} />
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="cf-mostrar">Mostrar só se (opcional)</label>
            <input id="cf-mostrar" placeholder="ex.: especie=outros" value={f.mostrar_se ?? ''} onChange={(e) => set({ mostrar_se: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="cf-ajuda">Dica (opcional)</label>
            <input id="cf-ajuda" value={f.ajuda ?? ''} onChange={(e) => set({ ajuda: e.target.value })} />
          </div>
          <label className="field col-2" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={Boolean(f.obrigatorio)} onChange={(e) => set({ obrigatorio: e.target.checked })} />
            Obrigatório
          </label>
        </div>
        <div className="modal-acoes">
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn primary">Salvar</button>
        </div>
      </form>
    </div>
  );
}

function ModalExame({ exame, grupos, onClose, onSalvar }: {
  exame: Partial<ExameEncaminhamento>;
  grupos: GrupoExames[];
  onClose: () => void;
  onSalvar: (e: Partial<ExameEncaminhamento>) => void;
}) {
  const [f, setF] = useState(exame);
  const [incluiTxt, setIncluiTxt] = useState((exame.inclui ?? []).join('\n'));
  const set = (p: Partial<ExameEncaminhamento>) => setF((x) => ({ ...x, ...p }));
  const tubos = f.tubos ?? [];
  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const corpo: Partial<ExameEncaminhamento> = {
      nome: f.nome, descricao: f.descricao ?? '', grupo: f.grupo, tubos, amostra: f.amostra ?? '',
      selo: f.selo ?? '', destaque: f.destaque ?? false,
      inclui: incluiTxt.split('\n').map((t) => t.trim()).filter(Boolean),
    };
    if (!exame.do_papel) corpo.codigo = f.codigo;
    onSalvar(corpo);
  }
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal wide" onSubmit={salvar}>
        <h3>{exame.id ? `Editar exame ${exame.codigo}` : 'Novo exame'}</h3>
        <div className="m-sub">
          {exame.do_papel ? 'Exame do formulário impresso: o código não muda.' : 'Exames novos aparecem no rodapé de códigos do PDF.'}
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="ce-cod">Código</label>
            <input id="ce-cod" required disabled={exame.do_papel} pattern="[0-9A-Za-z]{1,10}" value={f.codigo ?? ''} onChange={(e) => set({ codigo: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ce-grupo">Bloco</label>
            <select id="ce-grupo" value={f.grupo} onChange={(e) => set({ grupo: e.target.value })}>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.titulo}</option>)}
            </select>
          </div>
          <div className="field col-2">
            <label htmlFor="ce-nome">Nome</label>
            <input id="ce-nome" required value={f.nome ?? ''} onChange={(e) => set({ nome: e.target.value })} />
          </div>
          <div className="field col-2">
            <label htmlFor="ce-desc">Descrição (o que inclui, condutos…)</label>
            <textarea id="ce-desc" value={f.descricao ?? ''} onChange={(e) => set({ descricao: e.target.value })} />
          </div>
          <fieldset className="field">
            <label>Tubos</label>
            {['amarelo', 'roxo', 'cinza'].map((t) => (
              <label key={t} style={{ display: 'flex', gap: 6, alignItems: 'center', textTransform: 'none', fontWeight: 400 }}>
                <input type="checkbox" checked={tubos.includes(t)}
                  onChange={(e) => set({ tubos: e.target.checked ? [...tubos, t] : tubos.filter((x) => x !== t) })} />
                <Tubos tubos={[t]} /> {t}
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor="ce-amostra">Sigla da amostra (ex.: U, SS, LE ou R)</label>
            <input id="ce-amostra" value={f.amostra ?? ''} onChange={(e) => set({ amostra: e.target.value })} />
            <label htmlFor="ce-selo" style={{ marginTop: 10 }}>Selo</label>
            <select id="ce-selo" value={f.selo ?? ''} onChange={(e) => set({ selo: e.target.value })}>
              <option value="">—</option>
              <option value="NOVO">NOVO</option>
              <option value="EXCLUSIVO">EXCLUSIVO</option>
            </select>
          </div>
          {f.grupo === 'perfis_onehealth' ? (
            <div className="field col-2">
              <label htmlFor="ce-inclui">Inclui (um por linha, ex.: Hematologia)</label>
              <textarea id="ce-inclui" value={incluiTxt} onChange={(e) => setIncluiTxt(e.target.value)} />
            </div>
          ) : null}
          <label className="field col-2" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={Boolean(f.destaque)} onChange={(e) => set({ destaque: e.target.checked })} />
            Destacar com contorno vermelho (como no papel)
          </label>
        </div>
        <div className="modal-acoes">
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn primary">Salvar</button>
        </div>
      </form>
    </div>
  );
}
