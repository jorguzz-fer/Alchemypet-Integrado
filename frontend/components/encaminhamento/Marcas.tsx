// Peças visuais que repetem o formulário impresso: bolinhas de tubo e os
// selos dos perfis OneHealth (mesmas cores do papel).

const COR_TUBO: Record<string, string> = {
  amarelo: 'var(--tubo-amarelo)',
  roxo: 'var(--tubo-roxo)',
  cinza: 'var(--tubo-cinza)',
};

export function Tubos({ tubos, amostra, legenda }: { tubos: string[]; amostra?: string; legenda?: Record<string, string> }) {
  if (!tubos.length && !amostra) return null;
  const titulo = [
    ...tubos.map((t) => legenda?.[t] ?? t),
    amostra ? `Amostra: ${amostra}` : '',
  ].filter(Boolean).join(' · ');
  return (
    <span className="enc-tubos" title={titulo}>
      {tubos.map((t, i) => (
        <span key={i} className="enc-tubo" style={{ background: COR_TUBO[t] ?? '#999' }} aria-hidden />
      ))}
      {amostra ? <span className="enc-amostra">{amostra}</span> : null}
      <span className="sr-only">{titulo}</span>
    </span>
  );
}

const MARCAS: Record<string, { nome: string; sufixo?: string; classe: string }> = {
  gold_pro: { nome: 'Gold', sufixo: 'PRO', classe: 'm-gold-pro' },
  gold: { nome: 'Gold', classe: 'm-gold' },
  gold_felino: { nome: 'Gold', sufixo: 'felino', classe: 'm-gold-felino' },
  prime: { nome: 'Prime', classe: 'm-prime' },
  infinity: { nome: 'Infinity', classe: 'm-infinity' },
  infinity_felino: { nome: 'Infinity', sufixo: 'felino', classe: 'm-infinity-felino' },
  select: { nome: 'Select', classe: 'm-select' },
};

export function MarcaPerfil({ marca }: { marca: string }) {
  const m = MARCAS[marca];
  if (!m) return null;
  return (
    <span className={`enc-marca ${m.classe}`} aria-label={`Perfil OneHealth ${m.nome} ${m.sufixo ?? ''}`}>
      <span className="mp-perfil">Perfil</span>
      <span className="mp-nome">
        <i>One</i>Health <b>{m.nome}</b>
        {m.sufixo ? <span className="mp-sufixo">{m.sufixo}</span> : null}
      </span>
    </span>
  );
}

export function Selo({ selo }: { selo: string }) {
  if (!selo) return null;
  return <span className={`enc-selo s-${selo.toLowerCase()}`}>{selo}</span>;
}
