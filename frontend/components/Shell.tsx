'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import {
  IconeConvenio,
  IconeDashboard,
  IconeFila,
  IconeTriagem,
  IconeUsuarios,
} from '@/components/icons';

export default function Shell({ children }: { children: React.ReactNode }) {
  const { usuario, carregando, sair } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const naLogin = pathname === '/login';

  useEffect(() => {
    if (!carregando && !usuario && !naLogin) {
      router.replace('/login');
    }
  }, [carregando, usuario, naLogin, router]);

  if (naLogin) return <main className="wrap-login">{children}</main>;

  if (carregando || !usuario) {
    return (
      <div className="tela-carregando">
        <div className="spinner" />
      </div>
    );
  }

  const linkAtivo = (href: string, exato = false) =>
    exato ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="side-brand" aria-label="Painel Alchemypet">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horiz.png" alt="Alchemypet" width={150} height={29} />
        </Link>

        <nav className="side-nav">
          {/* Dashboard — visão geral e pendências (dados de triagem). */}
          <div className="side-group">
            <Link
              href="/triagem"
              className={`side-group-title link${linkAtivo('/triagem', true) ? ' ativo' : ''}`}
            >
              <IconeDashboard className="side-ic" />
              Dashboard
            </Link>
            <Link
              href="/triagem/pendencias"
              className={`side-link${linkAtivo('/triagem/pendencias') ? ' ativo' : ''}`}
            >
              Pendências
            </Link>
          </div>

          {/* Triagem — fila operacional de triagens a resolver. */}
          <div className="side-group">
            <div className="side-group-title">
              <IconeTriagem className="side-ic" />
              Triagem
            </div>
            <Link
              href="/triagem/fila"
              className={`side-link${linkAtivo('/triagem/fila') ? ' ativo' : ''}`}
            >
              <IconeFila className="side-ic-sm" /> Fazer triagem
            </Link>
          </div>

          {/* Convênios — pendências de convênio. */}
          <div className="side-group">
            <Link
              href="/convenio"
              className={`side-group-title link${linkAtivo('/convenio', true) ? ' ativo' : ''}`}
            >
              <IconeConvenio className="side-ic" />
              Convênios
            </Link>
            <Link
              href="/convenio/pendencias"
              className={`side-link${linkAtivo('/convenio/pendencias') ? ' ativo' : ''}`}
            >
              Pendências
            </Link>
          </div>

          {usuario.perfil === 'admin' ? (
            <div className="side-group side-group-admin">
              <Link
                href="/usuarios"
                className={`side-link${linkAtivo('/usuarios') ? ' ativo' : ''}`}
              >
                <IconeUsuarios className="side-ic" /> Usuários
              </Link>
            </div>
          ) : null}
        </nav>

        <div className="side-user">
          <div className="side-user-info">
            <span className="side-user-nome">{usuario.nome}</span>
            <span className="side-user-perfil">{usuario.perfil}</span>
          </div>
          <button className="btn ghost sm" onClick={sair}>
            Sair
          </button>
        </div>
      </aside>

      <main className="app-main">
        <div className="wrap">{children}</div>
      </main>
    </div>
  );
}
