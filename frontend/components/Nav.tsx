'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Visão geral' },
  { href: '/pendencias', label: 'Pendências' },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="topnav">
      {LINKS.map((l) => {
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
