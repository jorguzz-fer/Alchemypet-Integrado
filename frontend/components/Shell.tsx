'use client';

// Esqueleto do sistema no estilo do Trezo (sidebar compacta + barra do topo),
// com as cores e fontes da Alchemypet.
//
// Sidebar compacta: só os ícones; passando o mouse ela abre por cima do
// conteúdo com os nomes e os subitens. O botão de menu da barra do topo deixa
// ela fixa aberta (lembrado no navegador). No celular ela vira gaveta.
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  IconeChamados,
  IconeConvenio,
  IconeCrm,
  IconeFormulario,
  IconeDashboard,
  IconePop,
  IconeRelatorio,
  IconeTriagem,
  IconeUsuarios,
  IconeManutencao,
} from '@/components/icons';

type Item = { rotulo: string; href: string; exato?: boolean; admin?: boolean };
type Grupo = {
  titulo: string;
  href: string;
  exato?: boolean;
  Icone: (p: { className?: string; size?: number }) => JSX.Element;
  itens: Item[];
  admin?: boolean;
};

const MENU: Grupo[] = [
  {
    titulo: 'Dashboard',
    href: '/dashboard',
    exato: true,
    Icone: IconeDashboard,
    itens: [
      { rotulo: 'Visão geral', href: '/dashboard', exato: true },
      { rotulo: 'Pendências', href: '/pendencias' },
    ],
  },
  {
    titulo: 'Particular',
    href: '/particular',
    exato: true,
    Icone: IconeTriagem,
    itens: [
      { rotulo: 'Visão geral', href: '/particular', exato: true },
      { rotulo: 'Pendências', href: '/particular/pendencias' },
      { rotulo: 'Fazer triagem', href: '/particular/fila' },
    ],
  },
  {
    titulo: 'Convênios',
    href: '/convenio',
    exato: true,
    Icone: IconeConvenio,
    itens: [
      { rotulo: 'Visão geral', href: '/convenio', exato: true },
      { rotulo: 'Pendências', href: '/convenio/pendencias' },
    ],
  },
  { titulo: 'CRM', href: '/crm', Icone: IconeCrm, itens: [{ rotulo: 'Contas', href: '/crm' }] },
  {
    titulo: 'Pedidos de exame',
    href: '/encaminhamento',
    Icone: IconeFormulario,
    itens: [
      { rotulo: 'Novo pedido', href: '/encaminhamento/novo' },
      { rotulo: 'Pedidos', href: '/encaminhamento', exato: true },
      { rotulo: 'Configurar formulário', href: '/encaminhamento/configurar', admin: true },
    ],
  },
  {
    titulo: 'POP',
    href: '/pop',
    exato: true,
    Icone: IconePop,
    itens: [
      { rotulo: 'Visão geral', href: '/pop', exato: true },
      { rotulo: 'Lista de POPs', href: '/pop/lista' },
    ],
  },
  {
    titulo: 'Qualidade',
    href: '/relatorios',
    Icone: IconeRelatorio,
    itens: [{ rotulo: 'Relatórios gerenciais', href: '/relatorios' }],
  },
  {
    titulo: 'Chamados',
    href: '/chamados',
    exato: true,
    Icone: IconeChamados,
    itens: [
      { rotulo: 'Visão geral', href: '/chamados', exato: true },
      { rotulo: 'Caixa de chamados', href: '/chamados/lista' },
    ],
  },
  { titulo: 'Usuários', href: '/usuarios', Icone: IconeUsuarios, itens: [], admin: true },
  { titulo: 'Manutenção', href: '/manutencao', Icone: IconeManutencao, itens: [], admin: true },
];

const CHAVE_FIXO = 'alchemypet:menu-fixo';

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

function semAcento(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const { usuario, carregando, sair } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const naLogin = pathname === '/login';

  const [fixo, setFixo] = useState(false);
  const [gaveta, setGaveta] = useState(false); // celular
  const [menuUsuario, setMenuUsuario] = useState(false);
  const [busca, setBusca] = useState('');
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);
  const usuarioRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!carregando && !usuario && !naLogin) router.replace('/login');
  }, [carregando, usuario, naLogin, router]);

  useEffect(() => {
    try {
      setFixo(localStorage.getItem(CHAVE_FIXO) === '1');
    } catch {
      /* sem localStorage: fica compacto */
    }
  }, []);

  // Fecha a gaveta e o menu do usuário ao trocar de página.
  useEffect(() => {
    setGaveta(false);
    setMenuUsuario(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuUsuario) return;
    const fechar = (e: MouseEvent) => {
      if (usuarioRef.current && !usuarioRef.current.contains(e.target as Node)) setMenuUsuario(false);
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, [menuUsuario]);

  useEffect(() => {
    const atualizar = () => setTelaCheia(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', atualizar);
    return () => document.removeEventListener('fullscreenchange', atualizar);
  }, []);

  const admin = usuario?.perfil === 'admin';
  const menu = useMemo(
    () =>
      MENU.filter((g) => !g.admin || admin).map((g) => ({ ...g, itens: g.itens.filter((i) => !i.admin || admin) })),
    [admin],
  );

  // Busca no menu: "pedido", "triagem", "pop"...
  const resultados = useMemo(() => {
    const q = semAcento(busca.trim());
    if (!q) return [];
    const todos: { rotulo: string; grupo: string; href: string }[] = [];
    menu.forEach((g) => {
      if (!g.itens.length) todos.push({ rotulo: g.titulo, grupo: '', href: g.href });
      g.itens.forEach((i) => todos.push({ rotulo: i.rotulo, grupo: g.titulo, href: i.href }));
    });
    return todos.filter((t) => semAcento(`${t.grupo} ${t.rotulo}`).includes(q)).slice(0, 8);
  }, [busca, menu]);

  if (naLogin) return <main className="wrap-login">{children}</main>;

  if (carregando || !usuario) {
    return (
      <div className="tela-carregando">
        <div className="spinner" />
      </div>
    );
  }

  const ativo = (href: string, exato = false) =>
    exato ? pathname === href : pathname === href || pathname.startsWith(href + '/');
  const grupoAtivo = (g: Grupo) => ativo(g.href, g.exato) || g.itens.some((i) => ativo(i.href, i.exato));

  function alternarFixo() {
    if (window.matchMedia('(max-width: 991px)').matches) {
      setGaveta((v) => !v);
      return;
    }
    setFixo((v) => {
      try {
        localStorage.setItem(CHAVE_FIXO, v ? '0' : '1');
      } catch {
        /* ignora */
      }
      return !v;
    });
  }

  function alternarTelaCheia() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else document.documentElement.requestFullscreen().catch(() => undefined);
  }

  function irPara(href: string) {
    setBusca('');
    setBuscaAberta(false);
    router.push(href);
  }

  return (
    <div className={`app-shell${fixo ? ' menu-fixo' : ''}${gaveta ? ' gaveta-aberta' : ''}`}>
      <aside className="sidebar" aria-label="Menu principal">
        <Link href="/dashboard" className="side-brand" aria-label="Painel Alchemypet">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="side-simbolo" src="/logo-simbolo.png" alt="" width={34} height={34} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="side-logo" src="/logo-horiz.png" alt="Alchemypet" width={140} height={27} />
        </Link>

        <nav className="side-nav">
          {menu.map((g) => {
            const on = grupoAtivo(g);
            return (
              <div key={g.titulo} className={`side-group${on ? ' ativo' : ''}`}>
                <Link href={g.href} className="side-group-title" title={g.titulo}>
                  <span className="side-ic-box">
                    <g.Icone className="side-ic" size={19} />
                  </span>
                  <span className="side-label">{g.titulo}</span>
                </Link>
                {g.itens.length ? (
                  <div className="side-sub">
                    {g.itens.map((i) => (
                      <Link
                        key={i.href + i.rotulo}
                        href={i.href}
                        className={`side-link${ativo(i.href, i.exato) ? ' ativo' : ''}`}
                      >
                        {i.rotulo}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="side-user" title={usuario.nome}>
          <span className="avatar">{iniciais(usuario.nome)}</span>
          <span className="side-label side-user-info">
            <span className="side-user-nome">{usuario.nome}</span>
            <span className="side-user-perfil">{usuario.perfil}</span>
          </span>
        </div>
      </aside>
      <button
        type="button"
        className="side-fundo"
        aria-label="Fechar menu"
        tabIndex={gaveta ? 0 : -1}
        onClick={() => setGaveta(false)}
      />

      <div className="app-main">
        <header className="topbar">
          <button
            type="button"
            className="top-btn"
            onClick={alternarFixo}
            aria-label={fixo ? 'Recolher menu' : 'Abrir menu'}
            title={fixo ? 'Recolher menu' : 'Fixar menu aberto'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="16" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>

          <div className="top-busca">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <line x1="20" y1="20" x2="16.5" y2="16.5" />
            </svg>
            <input
              value={busca}
              placeholder="Buscar no menu..."
              aria-label="Buscar no menu"
              onChange={(e) => {
                setBusca(e.target.value);
                setBuscaAberta(true);
              }}
              onFocus={() => setBuscaAberta(true)}
              onBlur={() => setTimeout(() => setBuscaAberta(false), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && resultados[0]) irPara(resultados[0].href);
                if (e.key === 'Escape') setBusca('');
              }}
            />
            {buscaAberta && busca.trim() ? (
              <div className="top-busca-lista" role="listbox">
                {resultados.length ? (
                  resultados.map((r) => (
                    <button key={r.href + r.rotulo} type="button" role="option" aria-selected={false}
                      onMouseDown={(e) => e.preventDefault()} onClick={() => irPara(r.href)}>
                      <b>{r.rotulo}</b>
                      {r.grupo ? <small>{r.grupo}</small> : null}
                    </button>
                  ))
                ) : (
                  <span className="top-busca-vazio">Nada encontrado</span>
                )}
              </div>
            ) : null}
          </div>

          <div className="top-direita">
            <button
              type="button"
              className="top-btn esconde-celular"
              onClick={alternarTelaCheia}
              aria-label={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
              title={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {telaCheia ? (
                  <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                ) : (
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                )}
              </svg>
            </button>

            <div className="top-usuario" ref={usuarioRef}>
              <button type="button" className="top-usuario-btn" onClick={() => setMenuUsuario((v) => !v)}
                aria-haspopup="menu" aria-expanded={menuUsuario}>
                <span className="avatar">{iniciais(usuario.nome)}</span>
                <span className="top-usuario-nome">{usuario.nome.split(' ')[0]}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {menuUsuario ? (
                <div className="top-usuario-menu" role="menu">
                  <div className="top-usuario-cab">
                    <span className="avatar grande">{iniciais(usuario.nome)}</span>
                    <span>
                      <b>{usuario.nome}</b>
                      <small>{usuario.email}</small>
                      <small className="perfil">{usuario.perfil}</small>
                    </span>
                  </div>
                  {admin ? (
                    <Link href="/usuarios" role="menuitem">Usuários</Link>
                  ) : null}
                  <button type="button" role="menuitem" className="sair" onClick={sair}>
                    Sair
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="wrap">{children}</main>
      </div>
    </div>
  );
}
