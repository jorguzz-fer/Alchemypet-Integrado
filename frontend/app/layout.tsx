import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: 'Painel Convênio · Alchemypet',
  description: 'Gestão de pendências de convênio da Alchemypet.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
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
            <Nav />
          </div>
        </header>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
