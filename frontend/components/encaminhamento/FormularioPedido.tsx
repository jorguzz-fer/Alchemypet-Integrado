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
  GrupoExames,
  PedidoExame,
  PontoLesao,
  ValorCampo,
} from '@/lib/types';
import { Contexto, Dados, faltando, visivel } from './regras';
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

// Quadrinhos de letra: mede a largura real de cada letra na fonte usada e
// ajusta o espaçamento para cada letra cair no seu quadrinho.
const QUADRINHO = 17;
function useQuadrinhos(ativo: boolean) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!ativo || !el) return;
    const ajustar = () => {
      const cs = getComputedStyle(el);
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) return;
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const w = ctx.measureText('M').width;
      const cx = Math.max(QUADRINHO, Math.ceil(w + 4));
      el.style.letterSpacing = `${cx - w}px`;
      el.style.paddingLeft = `${(cx - w) / 2}px`;
      el.style.setProperty('--cx', `${cx}px`);
    };
    ajustar();
    document.fonts?.ready.then(ajustar).catch(() => undefined);
  }, [ativo]);
  return ref;
}

function Campo({
  campo,
  valor,
  erro,
  onChange,
  onClinica,
  estilo,
  rotuloPapel,
  semRotulo,
  naLinha,
  lista,
}: {
  campo: CampoEncaminhamento;
  valor: ValorCampo | undefined;
  erro: boolean;
  onChange: (v: ValorCampo) => void;
  onClinica: (c: Conta | null) => void;
  estilo?: 'linha' | 'grade' | 'caixa';
  rotuloPapel?: string;
  semRotulo?: boolean;
  naLinha?: boolean;
  lista?: string;
}) {
  const id = `enc-${campo.chave}`;
  const refGrade = useQuadrinhos(estilo === 'grade');
  const rotulo = semRotulo ? null : (
    <>
      {rotuloPapel ?? campo.rotulo}
      {campo.obrigatorio ? <span className="enc-obrig">*</span> : null}
      {rotuloPapel !== undefined && rotuloPapel.endsWith('?') ? '' : ':'}
    </>
  );
  const cls = `enc-campo w-${campo.largura}${erro ? ' erro' : ''} t-${campo.tipo}${
    estilo ? ` e-${estilo}` : ''}${semRotulo ? ' sem-rotulo' : ''}`;

  if (campo.tipo === 'multipla') {
    // Várias escolhas, como os "( )" do papel (Mácula, Bolha, Pápula…).
    const lista = Array.isArray(valor) ? (valor as string[]) : [];
    return (
      <fieldset className={cls} data-campo={campo.chave}>
        <legend className="enc-rot">{rotulo}</legend>
        <div className="enc-multi">
          {campo.opcoes.map((o) => {
            const ativo = lista.includes(o.valor);
            return (
              <label key={o.valor} className={`enc-multi-op${ativo ? ' ativo' : ''}`}>
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={() => onChange(ativo ? lista.filter((x) => x !== o.valor) : [...lista, o.valor])}
                />
                <span aria-hidden className="enc-par">( {ativo ? 'X' : ' '} )</span> {o.rotulo}
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (campo.tipo === 'diagrama') {
    return (
      <div className={cls} data-campo={campo.chave}>
        <span className="enc-rot">{rotulo}</span>
        {campo.ajuda ? <span className="enc-ajuda-vis">{campo.ajuda}</span> : null}
        <Diagrama pontos={Array.isArray(valor) ? (valor as PontoLesao[]) : []} onChange={onChange} />
      </div>
    );
  }

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

  if (campo.tipo === 'opcao' && naLinha) {
    // Na linha do papel: rótulo e opções lado a lado (fieldset/legend não
    // se alinham numa linha só).
    return (
      <div className={cls} data-campo={campo.chave} role="group" aria-labelledby={`${id}-rot`}>
        <span id={`${id}-rot`} className={semRotulo ? 'sr-only' : 'enc-rot'}>
          {semRotulo ? campo.rotulo : rotulo}
        </span>
        <div className="enc-opcoes" role="radiogroup" aria-labelledby={`${id}-rot`}>
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
                {o.rotulo} <span aria-hidden>( {ativo ? 'X' : ' '} )</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (campo.tipo === 'opcao') {
    return (
      <fieldset className={cls} data-campo={campo.chave}>
        <legend className={semRotulo ? 'sr-only' : 'enc-rot'}>{semRotulo ? campo.rotulo : rotulo}</legend>
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
      {semRotulo ? (
        <label htmlFor={id} className="sr-only">
          {campo.rotulo}
        </label>
      ) : (
        <label htmlFor={id} className="enc-rot">
          {rotulo}
          {campo.ajuda ? <span className="enc-ajuda">{campo.ajuda}</span> : null}
        </label>
      )}
      {campo.tipo === 'texto_longo' ? (
        <textarea
          id={id}
          value={String(valor ?? '')}
          rows={estilo === 'linha' ? 1 : 2}
          onChange={(e) => {
            onChange(e.target.value);
            if (estilo === 'linha') {
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }
          }}
        />
      ) : campo.tipo === 'clinica' ? (
        <BuscaClinica id={id} valor={String(valor ?? '')} onTexto={onChange} onEscolher={onClinica} />
      ) : (
        <input
          id={id}
          ref={estilo === 'grade' ? refGrade : undefined}
          type={campo.tipo === 'data' ? 'date' : campo.tipo === 'numero' ? 'number' : 'text'}
          inputMode={campo.tipo === 'numero' ? 'numeric' : undefined}
          placeholder={semRotulo ? campo.rotulo : undefined}
          list={lista}
          autoComplete={lista ? 'off' : undefined}
          min={campo.tipo === 'numero' ? 0 : undefined}
          value={String(valor ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------ planta do papel
//
// As seções "Informações para emissão de laudos" e "Motivo da solicitação"
// seguem linha a linha o impresso (mesma ordem, mesma proporção de espaço),
// para quem está acostumado com o papel achar cada campo no mesmo lugar.
// Campos criados depois na configuração aparecem embaixo, na grade comum.

type Peca = {
  chave: string;
  // proporção do espaço da linha (como no papel)
  peso: number;
  estilo?: 'linha' | 'grade' | 'caixa';
  rotulo?: string;
  semRotulo?: boolean;
  // datalist com sugestões (listas do LIS)
  lista?: string;
};

const PLANTA: Record<string, Peca[][]> = {
  laudo: [
    [{ chave: 'clinica', peso: 7 }, { chave: 'data_coleta', peso: 3 }],
    [{ chave: 'veterinario', peso: 7 }, { chave: 'crmv', peso: 3, estilo: 'caixa', rotulo: 'CRMV (com carimbo)' }],
    [{ chave: 'responsavel', peso: 7.6, estilo: 'grade' }, { chave: 'cpf', peso: 2.4 }],
    [{ chave: 'paciente', peso: 10, estilo: 'grade' }],
    [{ chave: 'plano_saude', peso: 5.2 }, { chave: 'matricula', peso: 4.8 }],
    [{ chave: 'categoria_plano', peso: 10 }],
    [
      { chave: 'especie', peso: 2.6 },
      { chave: 'especie_outro', peso: 1.6, semRotulo: true, lista: 'enc-lista-especies' },
      { chave: 'genero', peso: 1.4 },
      { chave: 'raca', peso: 2.4, lista: 'enc-lista-racas' },
      { chave: 'idade', peso: 2 },
    ],
    [
      { chave: 'recoleta', peso: 1.4 },
      { chave: 'guia_recoleta', peso: 1.6, rotulo: 'Nº guia' },
      { chave: 'material_faltante', peso: 2 },
      { chave: 'guia_material', peso: 1.6, rotulo: 'Nº guia' },
      { chave: 'fast_track', peso: 1.6 },
      { chave: 'exame_urgente', peso: 1.8 },
    ],
  ],
  motivo: [
    [{ chave: 'motivo', peso: 10, semRotulo: true }],
    [{ chave: 'suspeita', peso: 10, estilo: 'linha' }],
    [{ chave: 'uso_medicamento', peso: 3.6 }, { chave: 'medicamentos', peso: 6.4, rotulo: 'Qual(is)?' }],
  ],
};

// Peças da planta que dependem de outra (ficam sempre à vista, como no papel:
// escrever nelas marca a opção correspondente).
const DEPENDE: Record<string, { chave: string; valor: string }> = {
  especie_outro: { chave: 'especie', valor: 'outros' },
  medicamentos: { chave: 'uso_medicamento', valor: 'sim' },
  guia_recoleta: { chave: 'recoleta', valor: 'true' },
  guia_material: { chave: 'material_faltante', valor: 'true' },
};

function chavesDaPlanta(secao: string): Set<string> {
  const out = new Set<string>();
  (PLANTA[secao] ?? []).flat().forEach((p) => {
    if (p.chave === 'idade') {
      out.add('idade_anos');
      out.add('idade_meses');
    } else out.add(p.chave);
  });
  return out;
}

function Planta({
  secao,
  campos,
  dados,
  pendentes,
  tentouEnviar,
  set,
  onClinica,
}: {
  secao: string;
  campos: CampoEncaminhamento[];
  dados: Dados;
  pendentes: CampoEncaminhamento[];
  tentouEnviar: boolean;
  set: (chave: string, v: ValorCampo) => void;
  onClinica: (c: Conta | null) => void;
}) {
  const porChave = Object.fromEntries(campos.map((c) => [c.chave, c]));
  const comErro = (chave: string) => tentouEnviar && pendentes.some((p) => p.chave === chave);

  function peca(p: Peca) {
    if (p.chave === 'idade') {
      const anos = porChave.idade_anos;
      const meses = porChave.idade_meses;
      if (!anos && !meses) return null;
      const erro = comErro('idade_anos') || comErro('idade_meses');
      return (
        <div key="idade" className={`enc-campo e-idade${erro ? ' erro' : ''}`} style={{ flexGrow: p.peso }} data-campo="idade_anos">
          <span className="enc-rot">
            Idade{anos?.obrigatorio ? <span className="enc-obrig">*</span> : null}:
          </span>
          {anos ? (
            <>
              <label htmlFor="enc-idade_anos" className="sr-only">Idade em anos</label>
              <input id="enc-idade_anos" type="number" inputMode="numeric" min={0}
                value={String(dados.idade_anos ?? '')} onChange={(e) => set('idade_anos', e.target.value)} />
              <span className="enc-suf" aria-hidden>A</span>
            </>
          ) : null}
          {meses ? (
            <>
              <label htmlFor="enc-idade_meses" className="sr-only">Idade em meses</label>
              <input id="enc-idade_meses" type="number" inputMode="numeric" min={0} max={11}
                value={String(dados.idade_meses ?? '')} onChange={(e) => set('idade_meses', e.target.value)} />
              <span className="enc-suf" aria-hidden>M</span>
            </>
          ) : null}
        </div>
      );
    }
    const c = porChave[p.chave];
    if (!c) return null;
    const dep = DEPENDE[p.chave];
    return (
      <div key={p.chave} className="enc-peca" style={{ flexGrow: p.peso }}>
        <Campo
          campo={c}
          valor={dados[c.chave]}
          erro={comErro(c.chave)}
          estilo={p.estilo}
          rotuloPapel={p.rotulo}
          semRotulo={p.semRotulo}
          lista={p.lista}
          naLinha
          onChange={(v) => {
            set(c.chave, v);
            if (dep && typeof v === 'string' && v.trim()) {
              const alvo = dep.valor === 'true' ? true : dep.valor;
              if (dados[dep.chave] !== alvo) set(dep.chave, alvo);
            }
          }}
          onClinica={onClinica}
        />
      </div>
    );
  }

  return (
    <div className={`enc-planta p-${secao}`}>
      {(PLANTA[secao] ?? []).map((linha, i) => {
        const pecas = linha.map(peca).filter(Boolean);
        return pecas.length ? (
          <div key={i} className="enc-linha">
            {pecas}
          </div>
        ) : null;
      })}
    </div>
  );
}

// Distribuição das lesões: toque no desenho (ventral à esquerda, dorsal à
// direita) para marcar; toque num ponto para tirar.
function Diagrama({ pontos, onChange }: { pontos: PontoLesao[]; onChange: (v: PontoLesao[]) => void }) {
  function marcar(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 0.93) return;
    onChange([...pontos, { lado: x < 0.5 ? 'ventral' : 'dorsal', x: +x.toFixed(4), y: +y.toFixed(4) }]);
  }
  return (
    <div className="enc-diagrama">
      <div className="enc-diag-img" onClick={marcar} role="presentation">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/encaminhamento/distribuicao-lesoes.png" alt="Desenho do animal: vista ventral e dorsal" />
        {pontos.map((p, i) => (
          <button
            key={i}
            type="button"
            className="enc-diag-ponto"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            aria-label={`Tirar marcação ${i + 1} (${p.lado})`}
            onClick={(e) => {
              e.stopPropagation();
              onChange(pontos.filter((_, j) => j !== i));
            }}
          />
        ))}
      </div>
      <div className="enc-diag-rodape">
        {pontos.length ? `${pontos.length} marcação(ões)` : 'Nenhuma marcação'}
        {pontos.length ? (
          <button type="button" className="btn ghost sm" onClick={() => onChange([])}>
            Limpar
          </button>
        ) : null}
      </div>
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

function IconeInfo() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden>
      <circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="6" r="1.2" fill="currentColor" />
      <rect x="9" y="8.6" width="2" height="6.4" rx="1" fill="currentColor" />
    </svg>
  );
}

// Composição do exame (e tubos) num ⓘ: a lista fica só com o título, e quem
// tiver dúvida passa o mouse ou toca no ícone.
function InfoExame({ exame, legenda }: { exame: ExameEncaminhamento; legenda: Record<string, string> }) {
  const [aberto, setAberto] = useState(false);
  if (!exame.descricao && !exame.tubos.length && !exame.amostra) return null;
  return (
    <span
      className={`enc-info${aberto ? ' aberto' : ''}`}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setAberto(false);
      }}
    >
      <button
        type="button"
        aria-label={`Composição do exame ${exame.codigo}`}
        aria-expanded={aberto}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAberto((v) => !v);
        }}
        onBlur={() => setAberto(false)}
      >
        <IconeInfo />
      </button>
      <span className="enc-info-pop" role="tooltip">
        <b>
          {exame.codigo} · {exame.nome}
        </b>
        {exame.descricao ? <span>{exame.descricao}</span> : null}
        {exame.tubos.length || exame.amostra ? (
          <span className="enc-info-tubos">
            <Tubos tubos={exame.tubos} amostra={exame.amostra} legenda={legenda} />
            {exame.tubos.map((t) => legenda[t] ?? t).join(' · ')}
            {exame.amostra ? `${exame.tubos.length ? ' · ' : ''}Amostra: ${exame.amostra}` : ''}
          </span>
        ) : null}
      </span>
    </span>
  );
}

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
  variante: 'linha' | 'cartao' | 'perfil';
}) {
  const marca = variante === 'perfil' ? ` p-${exame.marca || 'outro'}` : '';
  return (
    <label className={`enc-exame v-${variante}${marca}${marcado ? ' marcado' : ''}`}>
      <input type="checkbox" checked={marcado} onChange={onToggle} />
      <span className="enc-ex-corpo">
        <span className="enc-ex-topo">
          <b className="enc-cod">{exame.codigo}</b>
          {variante === 'perfil' ? null : <span className="enc-ex-nome">{exame.nome}</span>}
          <Selo selo={exame.selo} />
          <InfoExame exame={exame} legenda={legenda} />
        </span>
        {variante === 'perfil' ? <span className="enc-ex-titulo">{exame.nome}</span> : null}
        {variante === 'perfil' && exame.inclui.length ? (
          <span className="enc-ex-inclui">
            {exame.inclui.map((i) => (
              <span key={i} className="enc-item">
                {i}
              </span>
            ))}
          </span>
        ) : null}
        {variante === 'cartao' && exame.descricao ? <span className="enc-ex-desc">({exame.descricao})</span> : null}
      </span>
    </label>
  );
}

// Textos do banner do perfil em destaque (iguais ao impresso novo).
const DESTAQUE: Record<string, { imagem: string; titulo: string; texto: string }> = {
  gold_pro: {
    imagem: '/encaminhamento/gold-pro.webp',
    titulo: 'Avaliação laboratorial ampliada.',
    texto:
      'Hemograma, bioquímica e marcadores metabólicos, incluindo β-hidroxibutirato (BHB) e ácidos biliares, ' +
      'ampliando a investigação metabólica e hepatobiliar.',
  },
};

function BannerDestaque({
  exame,
  marcado,
  onToggle,
  legenda,
}: {
  exame: ExameEncaminhamento;
  marcado: boolean;
  onToggle: () => void;
  legenda: Record<string, string>;
}) {
  const d = DESTAQUE[exame.marca];
  return (
    <div className={`enc-banner${marcado ? ' marcado' : ''}`}>
      {d ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.imagem} alt={`Perfil em destaque: ${exame.nome}`} className="enc-banner-img" />
      ) : (
        <div className="enc-banner-marca">
          <MarcaPerfil marca={exame.marca} />
        </div>
      )}
      <div className="enc-banner-txt">
        <span className="enc-banner-cod">
          Cód. <b>{exame.codigo}</b>
        </span>
        <h3>{d ? d.titulo : exame.nome}</h3>
        <p>{d ? d.texto : exame.descricao}</p>
        <label className="enc-banner-sol">
          <input type="checkbox" checked={marcado} onChange={onToggle} />
          Solicitar perfil {exame.codigo}
          <InfoExame exame={exame} legenda={legenda} />
        </label>
      </div>
    </div>
  );
}

// Ícones das faixas (mesmos do impresso).
function IconeFaixa({ tipo }: { tipo: string }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <span className="enc-faixa-ico" aria-hidden>
      <svg viewBox="0 0 24 24" width="18" height="18">
        {tipo === 'laudo' ? (
          <g {...p}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M8.5 10h7M8.5 14h7M8.5 18h4" /></g>
        ) : tipo === 'motivo' ? (
          <g {...p}><path d="M6 3v6a4 4 0 0 0 8 0V3" /><path d="M10 13v2a5 5 0 0 0 10 0v-2" /><circle cx="20" cy="11" r="2" /></g>
        ) : tipo === 'fast_track' ? (
          <g {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></g>
        ) : tipo === 'renal' ? (
          <g {...p}><path d="M9 4c-4 0-5 4-5 8s1 8 5 8c2 0 3-2 2-4s-1-6 0-8 0-4-2-4zM15 4c4 0 5 4 5 8s-1 8-5 8" /></g>
        ) : (
          <g {...p}><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" /><path d="M7.5 15h9" /></g>
        )}
      </svg>
    </span>
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
  // Exames e grupos marcados: campos como a Histologia e as 3 amostras do 213
  // só aparecem (e só são exigidos) quando o pedido tem esses exames.
  const ctx: Contexto = useMemo(() => {
    const exames = new Set(marcados);
    const grupos = new Set<string>();
    marcados.forEach((c) => {
      if (exPorCodigo[c]) grupos.add(exPorCodigo[c].grupo);
    });
    (form?.grupos ?? []).forEach((g) => {
      if ((g.itens ?? []).some((c) => exames.has(c))) grupos.add(g.id);
    });
    return { exames, grupos };
  }, [marcados, exPorCodigo, form]);
  const pendentes = form ? faltando(campos, dados, ctx) : [];
  const tubosPedido = useMemo(() => {
    const s = new Set<string>();
    marcados.forEach((c) => exPorCodigo[c]?.tubos.forEach((t) => s.add(t)));
    return ['amarelo', 'roxo', 'cinza', 'azul', 'verde', 'branco'].filter((t) => s.has(t));
  }, [marcados, exPorCodigo]);

  function set(chave: string, v: ValorCampo) {
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
          return c ? visivel(c, dados, ctx) : false;
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

  // Itens de um bloco na ordem do papel (um exame pode estar em mais de um
  // bloco) e, depois, os incluídos na configuração.
  const grupo = (id: string) => {
    const g = form.grupos.find((x) => x.id === id);
    const doPapel = (g?.itens ?? []).map((c) => exPorCodigo[c]).filter(Boolean);
    const vistos = new Set(doPapel.map((e) => e.codigo));
    return [...doPapel, ...form.exames.filter((e) => e.grupo === id && !vistos.has(e.codigo))];
  };
  const campoVisivel = (c: CampoEncaminhamento) => visivel(c, dados, ctx);
  const camposHisto = campos.filter((c) => c.secao === 'histo' && campoVisivel(c));
  // Campos de um exame (ex.: 1ª/2ª/3ª amostra do 213), mostrados logo abaixo dele.
  const camposDoExame = (cod: string) =>
    campos.filter((c) => c.secao === 'parasito' && (c.mostrar_se || '').split(/[:|]/).includes(cod) && campoVisivel(c));
  const renderCampo = (c: CampoEncaminhamento) => (
    <Campo
      key={c.chave}
      campo={c}
      valor={dados[c.chave]}
      erro={tentouEnviar && pendentes.some((p) => p.chave === c.chave)}
      onChange={(v) => set(c.chave, v)}
      onClinica={(conta) => setClinicaId(conta?.id ?? null)}
    />
  );
  const listaGrupo = (g: GrupoExames) => {
    const itens = grupo(g.id);
    if (!itens.length) return null;
    const n = itens.filter((e) => marcados.includes(e.codigo)).length;
    return (
      <details key={g.id} className={`enc-lista l-${g.id}`} open>
        <summary className="enc-lista-tit">
          <IconeFaixa tipo={g.id} />
          <span className="enc-lista-nome">{g.titulo}</span>
          {n ? <span className="enc-cont">{n}</span> : null}
        </summary>
        {g.aviso ? <div className="enc-lista-aviso">{g.aviso}</div> : null}
        {itens.map((e) => (
          <div key={e.codigo} className="enc-lista-item">
            <CaixaExame exame={e} marcado={marcados.includes(e.codigo)}
              onToggle={() => alternar(e.codigo)} legenda={form.tubos} variante="linha" />
            {marcados.includes(e.codigo) && camposDoExame(e.codigo).length ? (
              <div className="enc-exame-campos">{camposDoExame(e.codigo).map(renderCampo)}</div>
            ) : null}
          </div>
        ))}
      </details>
    );
  };
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

      {/* Sugestões das listas do LIS (Raça e "Outros" da espécie) */}
      <datalist id="enc-lista-racas">
        {(form.racas ?? []).map((r) => (
          <option key={r.codigo} value={r.nome} />
        ))}
      </datalist>
      <datalist id="enc-lista-especies">
        {(form.especies ?? [])
          .filter((e) => !['canino', 'felino'].includes(e.nome.toLowerCase()))
          .map((e) => (
            <option key={e.codigo} value={e.nome} />
          ))}
      </datalist>

      <div className="enc-lab" aria-label="Para uso do laboratório">
        <b>Para uso do laboratório:</b>
        <span>Data de chegada</span>
        <span>Nº de amostras</span>
        <span>Recebido por</span>
        <small>preenchido na chegada da amostra</small>
      </div>

      {SECOES.map((s) => (
        <section key={s.id} className="enc-secao">
          <h2 className={`enc-faixa f-${s.id}`}>
            <IconeFaixa tipo={s.id} />
            {s.titulo} <small>(*dados obrigatórios)</small>
          </h2>
          <Planta
            secao={s.id}
            campos={campos.filter((c) => c.secao === s.id)}
            dados={dados}
            pendentes={pendentes}
            tentouEnviar={tentouEnviar}
            set={set}
            onClinica={(conta) => setClinicaId(conta?.id ?? null)}
          />
          <div className="enc-grade">
            {campos
              .filter((c) => c.secao === s.id && visivel(c, dados, ctx) && !chavesDaPlanta(s.id).has(c.chave))
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
          <BannerDestaque key={e.codigo} exame={e} marcado={marcados.includes(e.codigo)}
            onToggle={() => alternar(e.codigo)} legenda={form.tubos} />
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
          {form.grupos.filter((g) => g.estilo === 'lista' && (g.pagina ?? 1) === 1).map(listaGrupo)}
        </div>

        {[2, 3, 4].map((pg) => {
          const blocos = form.grupos.filter((g) => g.estilo === 'lista' && g.pagina === pg);
          if (!blocos.length) return null;
          return (
            <div key={pg} className="enc-pagina">
              <h2 className="enc-pagina-tit">
                Página {pg} <small>do formulário</small>
              </h2>
              <div className="enc-listas-3">{blocos.map(listaGrupo)}</div>
              {pg === 2 ? (
                <div className={`enc-histo${camposHisto.length ? '' : ' vazio'}`} id="enc-histo">
                  <h3 className="enc-histo-tit">Histologia e Citologia</h3>
                  {camposHisto.length ? (
                    <>
                      <p className="enc-histo-aviso">
                        <b>Preenchimento obrigatório.</b> O laboratório não se responsabiliza por limitações
                        diagnósticas decorrentes de informações ausentes, incompletas ou incorretas fornecidas nesta
                        requisição.
                      </p>
                      <div className="enc-grade">{camposHisto.map(renderCampo)}</div>
                    </>
                  ) : (
                    <p className="enc-histo-aviso">
                      Marque acima um exame de Citologia, Histopatologia ou Imuno-histoquímica e as perguntas (material, localização, características da lesão e o desenho para marcar as lesões) aparecem aqui.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}

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
