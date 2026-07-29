import type { Modulo } from './types';

export interface InfoModulo {
  key: Modulo;
  nome: string;
  descricao: string; // usado em títulos/leads
}

// Ordem no menu lateral.
export const MODULOS: InfoModulo[] = [
  {
    key: 'triagem',
    nome: 'Triagem',
    descricao: 'pendências cadastrais (Triagem/SAC)',
  },
  {
    key: 'convenio',
    nome: 'Convênio',
    descricao: 'pendências de convênio',
  },
];

export function moduloValido(m: string | undefined): m is Modulo {
  return m === 'convenio' || m === 'triagem';
}

export function infoModulo(m: Modulo): InfoModulo {
  return MODULOS.find((x) => x.key === m) ?? MODULOS[0];
}
