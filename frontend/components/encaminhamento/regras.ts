// Regras do formulário compartilhadas pela tela (o servidor aplica as mesmas).
import type { CampoEncaminhamento, ValorCampo } from '@/lib/types';

export type Dados = Record<string, ValorCampo>;

// "especie=outros" (valor igual) ou "recoleta" (marcado).
export function visivel(campo: CampoEncaminhamento, dados: Dados): boolean {
  const regra = (campo.mostrar_se || '').trim();
  if (!regra) return true;
  if (regra.includes('=')) {
    const [chave, valor] = regra.split('=', 2);
    return String(dados[chave.trim()] ?? '') === valor.trim();
  }
  return Boolean(dados[regra]);
}

export function vazio(v: ValorCampo | undefined): boolean {
  return v === undefined || v === '' || v === false;
}

// Campos obrigatórios visíveis ainda sem valor (fora a seção do laboratório).
export function faltando(campos: CampoEncaminhamento[], dados: Dados): CampoEncaminhamento[] {
  return campos.filter(
    (c) => c.secao !== 'laboratorio' && c.obrigatorio && visivel(c, dados) && vazio(dados[c.chave]),
  );
}
