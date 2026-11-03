// Peças visuais compartilhadas do CRM (etapa, temperatura, contato).
import type { EtapaConta, Temperatura } from '@/lib/types';

export const ETAPAS: { valor: EtapaConta; label: string }[] = [
  { valor: 'lead', label: 'Lead' },
  { valor: 'distribuicao', label: 'Distribuição' },
  { valor: 'contratos', label: 'Contratos' },
  { valor: 'onboarding', label: 'Onboarding' },
  { valor: 'cliente_ativo', label: 'Cliente Ativo' },
  { valor: 'inativo', label: 'Inativo' },
  { valor: 'bloqueado', label: 'Bloqueado' },
];
export const ETAPAS_SAIDA: EtapaConta[] = ['inativo', 'bloqueado'];

export function rotuloEtapa(e: string): string {
  return ETAPAS.find((x) => x.valor === e)?.label ?? '—';
}

export const TEMPERATURAS: { valor: Exclude<Temperatura, ''>; label: string }[] = [
  { valor: 'fria', label: 'Fria' },
  { valor: 'morna', label: 'Morna' },
  { valor: 'quente', label: 'Quente' },
];

export function EtapaChip({ etapa }: { etapa: string }) {
  return <span className={`etapa-chip e-${etapa}`}>{rotuloEtapa(etapa)}</span>;
}

// Termômetro: a cor diz a temperatura; o título dá o nome (acessível).
export function Termometro({ t }: { t: Temperatura }) {
  const label = TEMPERATURAS.find((x) => x.valor === t)?.label ?? 'Sem temperatura';
  return (
    <svg
      className={`termo t-${t || 'nenhuma'}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={`Temperatura: ${label}`}
    >
      <title>{`Temperatura: ${label}`}</title>
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
    </svg>
  );
}

// Link de WhatsApp a partir do telefone como veio do cadastro.
export function linkWhatsapp(tel: string): string | null {
  let d = (tel || '').replace(/\D/g, '');
  if (d.length < 10) return null;
  if (!d.startsWith('55') || d.length <= 11) d = `55${d.slice(-11)}`;
  return `https://wa.me/${d}`;
}

export function IconeWhats({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />
    </svg>
  );
}
