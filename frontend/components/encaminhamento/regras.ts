// Regras do formulário compartilhadas pela tela (o servidor aplica as mesmas).
import type { CampoEncaminhamento, ValorCampo } from '@/lib/types';

export type Dados = Record<string, ValorCampo>;

// O que o pedido já tem marcado (para campos que dependem dos exames).
export type Contexto = { exames: Set<string>; grupos: Set<string> };

// "especie=outros" (valor igual; em campo de várias opções, valor marcado),
// "recoleta" (marcado), "exame:213" (exame no pedido) e
// "grupo:citologia|histopatologia" (algum exame desses grupos no pedido).
export function visivel(campo: CampoEncaminhamento, dados: Dados, ctx?: Contexto): boolean {
  const regra = (campo.mostrar_se || '').trim();
  if (!regra) return true;
  if (regra.startsWith('exame:')) return regra.slice(6).split('|').some((c) => ctx?.exames.has(c));
  if (regra.startsWith('grupo:')) return regra.slice(6).split('|').some((g) => ctx?.grupos.has(g));
  if (regra.includes('=')) {
    const [chave, valor] = regra.split('=', 2);
    const atual = dados[chave.trim()];
    if (Array.isArray(atual)) return (atual as unknown[]).includes(valor.trim());
    return String(atual ?? '') === valor.trim();
  }
  return Boolean(dados[regra]);
}

export function vazio(v: ValorCampo | undefined): boolean {
  return v === undefined || v === '' || v === false || (Array.isArray(v) && v.length === 0);
}

// Campos obrigatórios visíveis ainda sem valor (fora a seção do laboratório).
export function faltando(campos: CampoEncaminhamento[], dados: Dados, ctx?: Contexto): CampoEncaminhamento[] {
  return campos.filter(
    (c) => c.secao !== 'laboratorio' && c.obrigatorio && visivel(c, dados, ctx) && vazio(dados[c.chave]),
  );
}
