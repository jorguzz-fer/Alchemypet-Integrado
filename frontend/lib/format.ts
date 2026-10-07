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

// Data pura, sem hora: 'YYYY-MM-DD'.
const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
// Designador de fuso no fim da string ('Z', '+00:00', '-0300').
const TEM_FUSO = /([zZ])|([+-]\d{2}:?\d{2})$/;

// Converte um instante vindo da API em Date.
//
// Os campos de data/hora (created_at, updated_at) são gravados em UTC mas
// serializados sem designador de fuso. Sem acrescentar o 'Z', o navegador os
// leria como horário local e mostraria o horário adiantado.
function paraInstante(iso: string): Date | null {
  const d = new Date(TEM_FUSO.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ISO (ou 'YYYY-MM-DD') -> dd/mm/aaaa. Retorna '—' quando vazio/invalido.
export function formatData(iso: string | null | undefined): string {
  if (!iso) return '—';
  // Uma data pura não tem fuso: formatar pelos componentes. Passar por
  // `new Date` faria o navegador lê-la como meia-noite UTC e, a oeste de
  // Greenwich, exibir o dia anterior.
  const puro = SO_DATA.exec(iso);
  if (puro) return `${puro[3]}/${puro[2]}/${puro[1]}`;

  const d = paraInstante(iso);
  if (!d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
  }
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

// Instante ISO -> 'dd/mm/aaaa hh:mm' no fuso de quem está olhando.
export function formatDataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  // Uma data pura não carrega hora; devolvê-la como instante acabaria em
  // "dia anterior 21:00" por causa do fuso.
  if (SO_DATA.test(iso)) return formatData(iso);
  const d = paraInstante(iso);
  if (!d) return formatData(iso);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${d.getFullYear()} ${hh}:${mm}`;
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
