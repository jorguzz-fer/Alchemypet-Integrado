'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const LINKS = [
  { href: '/', label: 'Visão geral' },
  { href: '/pendencias', label: 'Pendências' },
];

export default function Nav() {
  const pathname = usePathname();
  const { usuario } = useAuth();

  const links = [...LINKS];
  if (usuario?.perfil === 'admin') {
    links.push({ href: '/usuarios', label: 'Usuários' });
  }

  return (
    <nav className="topnav">
      {links.map((l) => {
        const active =
          l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={active ? 'active' : undefined}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
