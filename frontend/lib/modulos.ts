import type { Modulo } from './types';

export interface InfoModulo {
  key: Modulo;
  nome: string;
  descricao: string; // usado em títulos/leads
}

// Ordem no menu lateral.
export const MODULOS: InfoModulo[] = [
  {
    key: 'particular',
    nome: 'Particular',
    descricao: 'pendências particulares',
  },
  {
    key: 'convenio',
    nome: 'Convênio',
    descricao: 'pendências de convênio',
  },
];

export function moduloValido(m: string | undefined): m is Modulo {
  return m === 'convenio' || m === 'particular';
}

// Nome antigo do módulo particular (links salvos/favoritos).
export function moduloLegado(m: string | undefined): Modulo | null {
  return m === 'triagem' ? 'particular' : null;
}

export function infoModulo(m: Modulo): InfoModulo {
  return MODULOS.find((x) => x.key === m) ?? MODULOS[0];
}

export function nomeModulo(m: string | undefined): string {
  if (m === 'particular') return 'Particular';
  if (m === 'convenio') return 'Convênio';
  return '—';
}
