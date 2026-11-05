'use client';

// Seleção e exclusão em lote, igual em todas as listas.
//
// A página passa os itens visíveis, o total do filtro e os filtros atuais;
// recebe de volta a caixa do cabeçalho, a caixa de cada linha, a barra de
// ações e o aviso de confirmação, já prontos para colocar na tabela.
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, type RecursoLote } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatNumero } from '@/lib/format';

type Valor = string | number | boolean | null | undefined;

interface Opcoes<T extends { id: string }> {
  recurso: RecursoLote;
  items: T[];
  total: number;
  // Filtros atuais (sem página/ordem). Mudou o filtro, a seleção é limpa.
  filtros: Record<string, Valor>;
  // "pendência" / "pendências" — usado nos textos.
  singular: string;
  plural: string;
  // Concordância dos textos: "pendência" é feminino; "chamado", masculino.
  feminino?: boolean;
  // Linha de alerta extra sobre os selecionados desta página
  // (ex.: "3 ainda não foram concluídas").
  alerta?: (selecionados: T[]) => string | null;
  // Como citar um item no aviso e na caixa (ex.: "guia 782342").
  descrever: (item: T) => string;
  onExcluidos: (n: number) => void;
  // Quantos por página (seletor na barra). Sem isso, o seletor não aparece.
  porPagina?: { valor: number; onChange: (n: number) => void };
}

export const OPCOES_POR_PAGINA = [25, 50, 100, 200];

const PALAVRA = 'EXCLUIR';

export function useSelecaoLote<T extends { id: string }>(o: Opcoes<T>) {
  const { usuario } = useAuth();
  const admin = usuario?.perfil === 'admin';
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [todos, setTodos] = useState(false); // todos os do filtro, não só a página
  const [confirmando, setConfirmando] = useState(false);
  const [palavra, setPalavra] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Exclusão do filtro inteiro aberta pelo atalho (sem seleção prévia):
  // cancelar desfaz a seleção que o atalho criou.
  const [viaAtalho, setViaAtalho] = useState(false);

  const chaveFiltro = JSON.stringify(o.filtros);
  useEffect(() => {
    setIds(new Set());
    setTodos(false);
  }, [chaveFiltro]);

  // Ao trocar de página, a seleção da página anterior sai (o que não se vê
  // não deve ser excluído sem querer); "todos do filtro" continua valendo.
  const chavePagina = o.items.map((i) => i.id).join(',');
  const ultimaPagina = useRef(chavePagina);
  useEffect(() => {
    if (ultimaPagina.current !== chavePagina && !todos) {
      setIds((atual) => new Set([...atual].filter((id) => o.items.some((i) => i.id === id))));
    }
    ultimaPagina.current = chavePagina;
  }, [chavePagina, todos, o.items]);

  const daPagina = o.items.filter((i) => todos || ids.has(i.id));
  const paginaToda = o.items.length > 0 && daPagina.length === o.items.length;
  const quantidade = todos ? o.total : ids.size;
  const nome = (n: number) => (n === 1 ? o.singular : o.plural);
  const fem = o.feminino ?? false;
  const g = (f: string, m: string) => (fem ? f : m);

  function alternar(id: string) {
    if (todos) {
      // Saiu de "todos do filtro": fica a página, menos o desmarcado.
      setTodos(false);
      setIds(new Set(o.items.map((i) => i.id).filter((x) => x !== id)));
      return;
    }
    setIds((atual) => {
      const n = new Set(atual);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function alternarPagina() {
    if (paginaToda) {
      setTodos(false);
      setIds(new Set());
    } else {
      setIds(new Set(o.items.map((i) => i.id)));
    }
  }

  function limpar() {
    setTodos(false);
    setIds(new Set());
  }

  function excluirTudoDoFiltro() {
    setTodos(true);
    setViaAtalho(true);
    setErro(null);
    setPalavra('');
    setConfirmando(true);
  }

  function cancelar() {
    setConfirmando(false);
    if (viaAtalho) limpar();
    setViaAtalho(false);
  }

  async function confirmar() {
    setExcluindo(true);
    setErro(null);
    try {
      const r = todos
        ? await api.excluirFiltro(o.recurso, o.filtros, o.total, palavra)
        : await api.excluirLote(o.recurso, [...ids]);
      setConfirmando(false);
      setViaAtalho(false);
      setPalavra('');
      limpar();
      o.onExcluidos(r.excluidas);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível excluir.');
    } finally {
      setExcluindo(false);
    }
  }

  const cabecalho = (
    <CaixaCabecalho
      marcada={paginaToda}
      parcial={!paginaToda && daPagina.length > 0}
      desabilitada={o.items.length === 0}
      onChange={alternarPagina}
      rotulo={`Selecionar ${o.plural} desta página`}
    />
  );

  const caixa = (item: T) => (
    <input
      type="checkbox"
      className="sel-caixa"
      checked={todos || ids.has(item.id)}
      onChange={() => alternar(item.id)}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Selecionar ${o.descrever(item)}`}
    />
  );

  const seletorPorPagina = o.porPagina ? (
    <label className="sel-porpagina">
      Mostrar
      <select
        value={o.porPagina.valor}
        onChange={(e) => o.porPagina?.onChange(Number(e.target.value))}
        aria-label="Registros por página"
      >
        {OPCOES_POR_PAGINA.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      por página
    </label>
  ) : null;

  // Atalho direto para o filtro inteiro, sem precisar marcar a página antes:
  // é o caminho de quem precisa limpar centenas ou milhares de registros.
  const botaoTodos =
    admin && o.total > o.items.length ? (
      <button type="button" className="btn ghost sm" onClick={() => setTodos(true)}>
        {g('Selecionar todas as', 'Selecionar todos os')} {formatNumero(o.total)} do filtro
      </button>
    ) : null;
  const botaoExcluirTudo =
    admin && o.total > 0 ? (
      <button type="button" className="btn danger sm" onClick={excluirTudoDoFiltro}>
        {g('Excluir todas as', 'Excluir todos os')} {formatNumero(o.total)} do filtro
      </button>
    ) : null;

  const barra =
    quantidade === 0 ? (
      o.items.length > 0 ? (
        <div className="sel-barra neutra" role="region" aria-label="Seleção">
          <span className="muted">
            {formatNumero(o.total)} {nome(o.total)} no filtro
            {o.total > o.items.length ? ` · ${formatNumero(o.items.length)} nesta página` : ''}
          </span>
          {botaoTodos}
          <span className="sel-espaco" />
          {seletorPorPagina}
          {botaoExcluirTudo}
        </div>
      ) : null
    ) : (
      <div className="sel-barra" role="region" aria-label="Seleção">
        <span>
          <b>{formatNumero(quantidade)}</b> {nome(quantidade)}{' '}
          {quantidade === 1 ? g('selecionada', 'selecionado') : g('selecionadas', 'selecionados')}
          {todos ? g(' (todas do filtro)', ' (todos do filtro)') : ''}
        </span>
        {!todos && o.total > quantidade && admin ? (
          <button type="button" className="link-btn" onClick={() => setTodos(true)}>
            {g('Selecionar todas as', 'Selecionar todos os')} {formatNumero(o.total)} do filtro
          </button>
        ) : null}
        <span className="sel-espaco" />
        <button type="button" className="btn ghost sm" onClick={limpar}>
          Limpar seleção
        </button>
        <button
          type="button"
          className="btn danger sm"
          onClick={() => {
            setErro(null);
            setPalavra('');
            setConfirmando(true);
          }}
        >
          Excluir {formatNumero(quantidade)}
        </button>
        {seletorPorPagina}
      </div>
    );

  const alertaPagina = !todos && o.alerta ? o.alerta(daPagina) : null;
  const exemplos = useMemo(() => daPagina.slice(0, 5), [daPagina]);

  const modal = confirmando ? (
    <div
      className="modal-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !excluindo) cancelar();
      }}
    >
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="exc-titulo">
        <h3 id="exc-titulo">
          Excluir {formatNumero(quantidade)} {nome(quantidade)}?
        </h3>
        <div className="exc-alerta">
          <b>{formatNumero(quantidade)}</b> {nome(quantidade)}{' '}
          {quantidade === 1 ? g('será excluída', 'será excluído') : g('serão excluídas', 'serão excluídos')}{' '}
          definitivamente{todos ? g(', todas as que estão no filtro atual', ', todos os que estão no filtro atual') : ''}.
          Esta ação não pode ser desfeita.
          {o.recurso === 'pendencias' ? ' As tratativas delas também são apagadas.' : ''}
        </div>
        {alertaPagina ? <div className="exc-alerta forte">{alertaPagina}</div> : null}
        {!todos && exemplos.length ? (
          <div className="crm-sub" style={{ margin: '8px 0 4px' }}>
            Inclui: {exemplos.map(o.descrever).join('; ')}
            {quantidade > exemplos.length ? ` e mais ${formatNumero(quantidade - exemplos.length)}` : ''}
          </div>
        ) : null}
        {todos ? (
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="exc-palavra">Para confirmar, digite {PALAVRA}</label>
            <input
              id="exc-palavra"
              autoFocus
              autoComplete="off"
              value={palavra}
              onChange={(e) => setPalavra(e.target.value)}
            />
          </div>
        ) : null}
        {erro ? <div className="form-erro">{erro}</div> : null}
        <div className="modal-acoes">
          <button type="button" className="btn ghost" autoFocus={!todos} disabled={excluindo}
            onClick={cancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn danger"
            disabled={excluindo || (todos && palavra.trim().toUpperCase() !== PALAVRA)}
            onClick={confirmar}
          >
            {excluindo ? 'Excluindo…' : `Excluir ${formatNumero(quantidade)}`}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { cabecalho, caixa, barra, modal, quantidade };
}

function CaixaCabecalho({
  marcada,
  parcial,
  desabilitada,
  onChange,
  rotulo,
}: {
  marcada: boolean;
  parcial: boolean;
  desabilitada: boolean;
  onChange: () => void;
  rotulo: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = parcial;
  }, [parcial]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="sel-caixa"
      checked={marcada}
      disabled={desabilitada}
      onChange={onChange}
      aria-label={rotulo}
      title={rotulo}
    />
  );
}
