// Helpers de formatacao (pt-BR).

const MESES = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

// ISO (ou 'YYYY-MM-DD') -> dd/mm/aaaa. Retorna '—' quando vazio/invalido.
export function formatData(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    // fallback simples para 'YYYY-MM-DD'
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return '—';
  }
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

// Numero -> string pt-BR.
export function formatNumero(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('pt-BR');
}

// Numero decimal com casas.
export function formatDecimal(
  n: number | null | undefined,
  casas = 1,
): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

// Rotulo curto de periodo ano/mes -> 'jul/25'.
export function labelPeriodo(
  ano: number | null | undefined,
  mes: number | null | undefined,
): string {
  if (!ano && !mes) return '—';
  const nomeMes = mes && mes >= 1 && mes <= 12 ? MESES[mes - 1] : '';
  const anoCurto = ano ? String(ano).slice(-2) : '';
  if (nomeMes && anoCurto) return `${nomeMes}/${anoCurto}`;
  if (nomeMes) return nomeMes;
  return anoCurto || '—';
}

export function nomeMes(mes: number): string {
  return mes >= 1 && mes <= 12 ? MESES[mes - 1] : String(mes);
}
