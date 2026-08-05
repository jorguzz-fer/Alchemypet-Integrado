// Ícones SVG de linha (stroke = currentColor), estilo consistente com o app.

interface IconeProps {
  className?: string;
  size?: number;
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

// Triagem/SAC — prancheta com check (conferência cadastral)
export function IconeTriagem({ className, size = 18 }: IconeProps) {
  return (
    <svg className={className} {...base(size)}>
      <path d="M9 3h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M16 4h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

// Convênio — documento (guias/lançamentos)
export function IconeConvenio({ className, size = 18 }: IconeProps) {
  return (
    <svg className={className} {...base(size)}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </svg>
  );
}

// Usuários — duas pessoas
export function IconeUsuarios({ className, size = 18 }: IconeProps) {
  return (
    <svg className={className} {...base(size)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

// Dashboard — painel com blocos/indicadores
export function IconeDashboard({ className, size = 18 }: IconeProps) {
  return (
    <svg className={className} {...base(size)}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

// Fazer triagem — fila/lista com seta de ação
export function IconeFila({ className, size = 18 }: IconeProps) {
  return (
    <svg className={className} {...base(size)}>
      <line x1="3" y1="6" x2="14" y2="6" />
      <line x1="3" y1="12" x2="12" y2="12" />
      <line x1="3" y1="18" x2="10" y2="18" />
      <path d="m16 10 4 4-4 4" />
      <line x1="20" y1="14" x2="13" y2="14" />
    </svg>
  );
}

// POP — documento com selo/estrela (procedimento padrão)
export function IconePop({ className, size = 18 }: IconeProps) {
  return (
    <svg className={className} {...base(size)}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="m10.5 12 1 2 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L7.5 14.3l2-.3z" />
    </svg>
  );
}

export function iconeModulo(key: string, className?: string) {
  if (key === 'triagem') return <IconeTriagem className={className} />;
  return <IconeConvenio className={className} />;
}
