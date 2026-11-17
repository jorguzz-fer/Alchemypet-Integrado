'use client';

// Formulário de Encaminhamento Geral online.
//
// Mesma "planta" do papel (ordem dos blocos, nomes, códigos, cores e tubos)
// para o veterinário se achar de primeira; o digital só tira trabalho:
// clínica do cadastro, CRMV lembrado, busca por código, resumo do que falta.
// No computador lembra a folha; no celular cada bloco vira um cartão.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import type {
  CampoEncaminhamento,
  Conta,
  ExameEncaminhamento,
  FormularioEncaminhamento,
  PedidoExame,
} from '@/lib/types';
import { Dados, faltando, visivel } from './regras';
import { MarcaPerfil, Selo, Tubos } from './Marcas';

const LEMBRAR = 'enc_ultimo_vet';
const SECOES: { id: 'laudo' | 'motivo'; titulo: string }[] = [
  { id: 'laudo', titulo: 'Informações para emissão de laudos' },
  { id: 'motivo', titulo: 'Motivo da solicitação' },
];

function hoje(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function lerLembrado(): Dados {
  try {
    return JSON.parse(window.localStorage.getItem(LEMBRAR) || '{}');
  } catch {
    return {};
  }
}

function salvarLembrado(d: Dados) {
  try {
    window.localStorage.setItem(
      LEMBRAR,
      JSON.stringify({ clinica: d.clinica, veterinario: d.veterinario, crmv: d.crmv }),
    );
  } catch {
    /* sem armazenamento local: só não lembra */
  }
}

// ---------------------------------------------------------------- campos

function Campo({
  campo,
  valor,
  erro,
  onChange,
  onClinica,
}: {
  campo: CampoEncaminhamento;
  valor: string | boolean | undefined;
  erro: boolean;
  onChange: (v: string | boolean) => void;
  onClinica: (c: Conta | null) => void;
}) {
  const id = `enc-${campo.chave}`;
  const rotulo = (
    <>
      {campo.rotulo}
      {campo.obrigatorio ? <span className="enc-obrig">*</span> : null}
    </>
  );
  const cls = `enc-campo w-${campo.largura}${erro ? ' erro' : ''} t-${campo.tipo}`;

  if (campo.tipo === 'marcar') {
    return (
      <div className={cls} data-campo={campo.chave}>
        <label className="enc-marcar">
          <input type="checkbox" checked={Boolean(valor)} onChange={(e) => onChange(e.target.checked)} />
          <span className="enc-rot">{rotulo}</span>
          <span className="enc-parenteses" aria-hidden>
            ( {valor ? 'X' : ' '} )
          </span>
        </label>
      </div>
    );
  }

  if (campo.tipo === 'opcao') {
    return (
      <fieldset className={cls} data-campo={campo.chave}>
        <legend className="enc-rot">{rotulo}</legend>
        <div className="enc-opcoes" role="radiogroup">
          {campo.opcoes.map((o) => {
            const ativo = valor === o.valor;
            return (
              <button
                key={o.valor}
                type="button"
                role="radio"
                aria-checked={ativo}
                className={`enc-opcao${ativo ? ' ativo' : ''}`}
                onClick={() => onChange(ativo && !campo.obrigatorio ? '' : o.valor)}
              >
                {o.rotulo} <span aria-hidden>( {ativo ? 'X' : ' '} )</span>
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  }

  return (
    <div className={cls} data-campo={campo.chave}>
      <label htmlFor={id} className="enc-rot">
        {rotulo}
        {campo.ajuda ? <span className="enc-ajuda">{campo.ajuda}</span> : null}
      </label>
      {campo.tipo === 'texto_longo' ? (
        <textarea id={id} value={String(valor ?? '')} rows={2} onChange={(e) => onChange(e.target.value)} />
      ) : campo.tipo === 'clinica' ? (
        <BuscaClinica id={id} valor={String(valor ?? '')} onTexto={onChange} onEscolher={onClinica} />
      ) : (
        <input
          id={id}
          type={campo.tipo === 'data' ? 'date' : campo.tipo === 'numero' ? 'number' : 'text'}
          inputMode={campo.tipo === 'numero' ? 'numeric' : undefined}
          min={campo.tipo === 'numero' ? 0 : undefined}
          value={String(valor ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

// Clínica: digita e escolhe do cadastro (ou deixa o texto livre, como no papel).
function BuscaClinica({
  id,
  valor,
  onTexto,
  onEscolher,
}: {
  id: string;
  valor: string;
  onTexto: (v: string) => void;
  onEscolher: (c: Conta | null) => void;
}) {
  const [sugestoes, setSugestoes] = useState<Conta[]>([]);
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    if (valor.trim().length < 3) {
      setSugestoes([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api
        .listContas({ busca: valor.trim(), per_page: 8 }, ctrl.signal)
        .then((r) => setSugestoes(r.items))
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [valor]);

  return (
    <div className="enc-busca">
      <input
        id={id}
        autoComplete="off"
        value={valor}
        onChange={(e) => {
          onTexto(e.target.value);
          onEscolher(null);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        role="combobox"
        aria-expanded={aberto && sugestoes.length > 0}
        aria-controls={`${id}-lista`}
      />
      {aberto && sugestoes.length ? (
        <ul id={`${id}-lista`} className="enc-sugestoes" role="listbox">
          {sugestoes.map((c) => (
            <li key={c.id} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onTexto(c.nome);
                  onEscolher(c);
                  setAberto(false);
                }}
              >
                <b>{c.nome}</b>
                <span>
                  {c.codigo_pocket ? `Código ${c.codigo_pocket}` : ''}
                  {c.regiao ? ` · ${c.regiao}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- exames

function CaixaExame({
  exame,
  marcado,
  onToggle,
  legenda,
  variante,
}: {
  exame: ExameEncaminhamento;
  marcado: boolean;
  onToggle: () => void;
  legenda: Record<string, string>;
  variante: 'linha' | 'cartao' | 'perfil' | 'destaque';
}) {
  return (
    <label className={`enc-exame v-${variante}${marcado ? ' marcado' : ''}${exame.destaque ? ' realce' : ''}`}>
      <input type="checkbox" checked={marcado} onChange={onToggle} />
      {variante === 'perfil' || variante === 'destaque' ? <MarcaPerfil marca={exame.marca} /> : null}
      <span className="enc-ex-corpo">
        <span className="enc-ex-topo">
          <b className="enc-cod">{exame.codigo}</b>
          {variante !== 'perfil' ? <span className="enc-ex-nome">{exame.nome}</span> : null}
          <Selo selo={exame.selo} />
        </span>
        {exame.inclui.length ? (
          <span className="enc-ex-inclui">
            {exame.inclui.map((i) => (
              <span key={i} className="enc-item">
                {i}
              </span>
            ))}
          </span>
        ) : null}
        {exame.descricao ? <span className="enc-ex-desc">{exame.descricao}</span> : null}
      </span>
      <Tubos tubos={exame.tubos} amostra={exame.amostra} legenda={legenda} />
    </label>
  );
}

// ------------------------------------------------------------------ tela

export default function FormularioPedido() {
  const [form, setForm] = useState<FormularioEncaminhamento | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [dados, setDados] = useState<Dados>({});
  const [clinicaId, setClinicaId] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [codigo, setCodigo] = useState('');
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criado, setCriado] = useState<PedidoExame | null>(null);
  const topo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .formularioEncaminhamento(ctrl.signal)
      .then((f) => {
        setForm(f);
        setDados({ data_coleta: hoje(), ...lerLembrado() });
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setErroCarga(e instanceof ApiError ? e.message : 'Não foi possível carregar o formulário.');
      });
    return () => ctrl.abort();
  }, []);

  const exPorCodigo = useMemo(
    () => Object.fromEntries((form?.exames ?? []).map((e) => [e.codigo, e])),
    [form],
  );
  const campos = useMemo(() => (form?.campos ?? []).filter((c) => c.secao !== 'laboratorio'), [form]);
  const pendentes = form ? faltando(campos, dados) : [];
  const tubosPedido = useMemo(() => {
    const s = new Set<string>();
    marcados.forEach((c) => exPorCodigo[c]?.tubos.forEach((t) => s.add(t)));
    return ['amarelo', 'roxo', 'cinza'].filter((t) => s.has(t));
  }, [marcados, exPorCodigo]);

  function set(chave: string, v: string | boolean) {
    setDados((d) => ({ ...d, [chave]: v }));
  }
  function alternar(cod: string) {
    setMarcados((m) => (m.includes(cod) ? m.filter((x) => x !== cod) : [...m, cod]));
  }
  function adicionarCodigo(cod: string) {
    const c = cod.trim();
    if (!c) return;
    setMarcados((m) => (m.includes(c) ? m : [...m, c]));
    setCodigo('');
  }

  function irPara(chave: string) {
    const el = document.querySelector(`[data-campo="${chave}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (el?.querySelector('input,textarea,button') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  async function enviar() {
    setTentouEnviar(true);
    setErro(null);
    if (pendentes.length) {
      irPara(pendentes[0].chave);
      return;
    }
    if (!marcados.length) {
      setErro('Marque ao menos um exame.');
      document.getElementById('enc-exames')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setEnviando(true);
    try {
      const visiveis = Object.fromEntries(
        Object.entries(dados).filter(([k]) => {
          const c = campos.find((x) => x.chave === k);
          return c ? visivel(c, dados) : false;
        }),
      );
      const p = await api.criarPedido({ dados: visiveis, exames: marcados, clinica_id: clinicaId });
      salvarLembrado(dados);
      setCriado(p);
      topo.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível enviar o pedido.');
    } finally {
      setEnviando(false);
    }
  }

  function novoPedido(mesmaClinica: boolean) {
    setCriado(null);
    setMarcados([]);
    setTentouEnviar(false);
    setErro(null);
    setDados(
      mesmaClinica
        ? { data_coleta: hoje(), clinica: dados.clinica, veterinario: dados.veterinario, crmv: dados.crmv }
        : { data_coleta: hoje() },
    );
    if (!mesmaClinica) setClinicaId(null);
    topo.current?.scrollIntoView({ behavior: 'smooth' });
  }

  if (erroCarga) return <div className="state"><div className="errbox"><p>{erroCarga}</p></div></div>;
  if (!form) return <div className="state"><div className="spinner" /></div>;

  if (criado) {
    return (
      <div className="enc-folha" ref={topo}>
        <div className="enc-sucesso" role="status">
          <div className="enc-suc-num">Pedido Nº {String(criado.numero).padStart(8, '0')}</div>
          <h2>Pedido enviado</h2>
          <p>
            {criado.paciente} · {criado.clinica} · {criado.codigos.length} exame(s)
            {criado.urgente ? ' · URGENTE' : ''}
          </p>
          <p className="crm-sub">
            Imprima o formulário preenchido e envie junto com a amostra: é o mesmo papel de sempre, já com o
            código de barras do pedido.
          </p>
          <div className="enc-suc-acoes">
            <button className="btn primary" onClick={() => api.abrirPdfPedido(criado.id).catch(() => undefined)}>
              Imprimir formulário
            </button>
            <button className="btn ghost" onClick={() => novoPedido(true)}>
              Novo pedido da mesma clínica
            </button>
            <button className="btn ghost" onClick={() => novoPedido(false)}>
              Novo pedido
            </button>
            <Link className="btn ghost" href="/encaminhamento">
              Ver pedidos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const grupo = (id: string) => form.exames.filter((e) => e.grupo === id);
  const conhecidos = new Set(form.exames.map((e) => e.codigo));
  const foraDoFormulario = marcados.filter((c) => !conhecidos.has(c));
  const busca = codigo.trim().toLowerCase();
  const sugestoesExame = busca
    ? form.exames
        .filter((e) => e.codigo.startsWith(busca) || e.nome.toLowerCase().includes(busca))
        .slice(0, 6)
    : [];

  return (
    <div className="enc-folha" ref={topo}>
      <header className="enc-cab">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-horiz.png" alt="Alchemypet" className="enc-logo" />
        <div className="enc-cab-txt">
          <h1>Formulário de Encaminhamento Geral</h1>
          <p>
            *O preenchimento do formulário é obrigatório e deve seguir a RESOLUÇÃO Federal do CFMV Nº 1.374, de 2
            de dezembro de 2020, artigo 7º e 8º
          </p>
        </div>
        <div className="enc-etiqueta">
          <span>Etiqueta de identificação do pedido</span>
          <b>gerada ao enviar</b>
        </div>
      </header>

      {SECOES.map((s) => (
        <section key={s.id} className="enc-secao">
          <h2 className="enc-faixa">
            {s.titulo} <small>(*dados obrigatórios)</small>
          </h2>
          <div className="enc-grade">
            {campos
              .filter((c) => c.secao === s.id && visivel(c, dados))
              .map((c) => (
                <Campo
                  key={c.chave}
                  campo={c}
                  valor={dados[c.chave]}
                  erro={tentouEnviar && pendentes.some((p) => p.chave === c.chave)}
                  onChange={(v) => set(c.chave, v)}
                  onClinica={(conta) => setClinicaId(conta?.id ?? null)}
                />
              ))}
          </div>
        </section>
      ))}

      <section id="enc-exames" className="enc-secao">
        {grupo('gold_pro').map((e) => (
          <div key={e.codigo} className="enc-gold-pro">
            <CaixaExame exame={e} marcado={marcados.includes(e.codigo)} onToggle={() => alternar(e.codigo)}
              legenda={form.tubos} variante="destaque" />
          </div>
        ))}

        {grupo('mais_utilizados').length || grupo('perfis_onehealth').length ? (
          <div className="enc-mais">
            <h2 className="enc-mais-tit">Exames mais utilizados clinicamente</h2>
            <div className="enc-cartoes">
              {grupo('mais_utilizados').map((e) => (
                <CaixaExame key={e.codigo} exame={e} marcado={marcados.includes(e.codigo)}
                  onToggle={() => alternar(e.codigo)} legenda={form.tubos} variante="cartao" />
              ))}
            </div>
            <div className="enc-perfis">
              {grupo('perfis_onehealth').map((e) => (
                <CaixaExame key={e.codigo} exame={e} marcado={marcados.includes(e.codigo)}
                  onToggle={() => alternar(e.codigo)} legenda={form.tubos} variante="perfil" />
              ))}
            </div>
          </div>
        ) : null}

        <div className="enc-listas">
          {form.grupos
            .filter((g) => g.estilo === 'lista')
            .map((g) => {
              const itens = grupo(g.id);
              if (!itens.length) return null;
              const n = itens.filter((e) => marcados.includes(e.codigo)).length;
              return (
                <details key={g.id} className="enc-lista" open>
                  <summary className="enc-lista-tit">
                    {g.titulo}
                    {n ? <span className="enc-cont">{n}</span> : null}
                  </summary>
                  {itens.map((e) => (
                    <CaixaExame key={e.codigo} exame={e} marcado={marcados.includes(e.codigo)}
                      onToggle={() => alternar(e.codigo)} legenda={form.tubos} variante="linha" />
                  ))}
                </details>
              );
            })}
        </div>

        <div className="enc-nao-achou">
          <label htmlFor="enc-codigo">Se não achou seu exame, insira o código apresentado no portfólio &gt;&gt;&gt;</label>
          <div className="enc-cod-linha">
            <input
              id="enc-codigo"
              value={codigo}
              placeholder="Código ou nome"
              autoComplete="off"
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  adicionarCodigo(sugestoesExame[0] && sugestoesExame[0].codigo.startsWith(busca)
                    ? sugestoesExame[0].codigo : codigo);
                }
              }}
            />
            <button type="button" className="btn sm" onClick={() => adicionarCodigo(codigo)} disabled={!codigo.trim()}>
              Adicionar
            </button>
          </div>
          {sugestoesExame.length ? (
            <div className="enc-cod-sug">
              {sugestoesExame.map((e) => (
                <button key={e.codigo} type="button" onClick={() => adicionarCodigo(e.codigo)}>
                  <b>{e.codigo}</b> {e.nome}
                </button>
              ))}
            </div>
          ) : null}
          {foraDoFormulario.length ? (
            <div className="enc-chips">
              {foraDoFormulario.map((c) => (
                <span key={c} className="enc-chip">
                  {c}
                  <button type="button" aria-label={`Remover código ${c}`} onClick={() => alternar(c)}>×</button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* Resumo fixo: o que foi marcado, os tubos e o que falta. */}
      <div className="enc-resumo" role="region" aria-label="Resumo do pedido">
        <div className="enc-res-info">
          <b>{marcados.length}</b> exame(s)
          {tubosPedido.length ? (
            <span className="enc-res-tubos">
              <Tubos tubos={tubosPedido} legenda={form.tubos} />
            </span>
          ) : null}
          {marcados.length ? <span className="enc-res-cods">{marcados.join(' · ')}</span> : null}
        </div>
        {tentouEnviar && pendentes.length ? (
          <button type="button" className="enc-res-falta" onClick={() => irPara(pendentes[0].chave)}>
            Falta: {pendentes.map((p) => p.rotulo).join(', ')}
          </button>
        ) : null}
        {erro ? <span className="enc-res-erro">{erro}</span> : null}
        <button type="button" className="btn primary" onClick={enviar} disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar pedido'}
        </button>
      </div>
    </div>
  );
}
