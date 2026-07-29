'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import Nav from './Nav';

export default function Shell({ children }: { children: React.ReactNode }) {
  const { usuario, carregando, sair } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const naLogin = pathname === '/login';

  // Guarda: sem usuário (fora da tela de login) → redireciona.
  useEffect(() => {
    if (!carregando && !usuario && !naLogin) {
      router.replace('/login');
    }
  }, [carregando, usuario, naLogin, router]);

  // A tela de login não usa o layout com topbar.
  if (naLogin) return <main className="wrap-login">{children}</main>;

  if (carregando) {
    return (
      <div className="tela-carregando">
        <div className="spinner" />
      </div>
    );
  }

  if (!usuario) {
    // Aguardando o redirect do efeito acima.
    return (
      <div className="tela-carregando">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <header className="top">
        <div className="top-inner">
          <Link href="/" className="brand" aria-label="Painel Convênio · Alchemypet">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="brand-logo"
              src="/logo-horiz.png"
              alt="Alchemypet"
              width={154}
              height={30}
            />
            <span className="brand-sep" aria-hidden="true" />
            <div>
              <div className="name">Painel Convênio</div>
              <div className="sub">Gestão de Pendências</div>
            </div>
          </Link>
          <div className="top-right">
            <Nav />
            <div className="user-box">
              <div className="user-info">
                <span className="user-nome">{usuario.nome}</span>
                <span className="user-perfil">{usuario.perfil}</span>
              </div>
              <button className="btn ghost sm" onClick={sair}>
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="wrap">{children}</main>
    </>
  );
}
