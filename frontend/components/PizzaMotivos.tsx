'use client';

import type { TopItem } from '@/lib/types';
import { formatNumero } from '@/lib/format';

// Paleta categórica sóbria (até 13 fatias — os motivos da planilha).
const CORES = [
  '#3d6fb4',
  '#2e9e6b',
  '#d98a2b',
  '#c0532f',
  '#7a5aa8',
  '#0fa3a3',
  '#c9a24b',
  '#b4488f',
  '#4b8f3d',
  '#2b6f8f',
  '#a9600c',
  '#5a6b7a',
  '#8f8f2b',
];
const COR_DEMAIS = '#9aa7b4';

interface Props {
  itens: TopItem[];
  centro?: string;
  centroSub?: string;
  // Agrupa a cauda (além das N maiores fatias) em "Demais".
  maxFatias?: number;
  // 'lado' = legenda à direita; 'baixo' = legenda abaixo (chips).
  legenda?: 'lado' | 'baixo';
}

export default function PizzaMotivos({
  itens,
  centro,
  centroSub,
  maxFatias,
  legenda = 'lado',
}: Props) {
  const base = (itens ?? []).filter((i) => i.total > 0);
  const soma = base.reduce((a, i) => a + i.total, 0);
  if (soma === 0) return <div className="trat-empty">Sem dados.</div>;

  // Ordena e agrupa a cauda em "Demais" quando maxFatias é informado.
  const ordenado = [...base].sort((a, b) => b.total - a.total);
  let dados: { nome: string; total: number; demais?: boolean }[] = ordenado;
  if (maxFatias && ordenado.length > maxFatias) {
    const cabeca = ordenado.slice(0, maxFatias);
    const resto = ordenado.slice(maxFatias).reduce((a, i) => a + i.total, 0);
    dados = resto > 0 ? [...cabeca, { nome: 'Demais', total: resto, demais: true }] : cabeca;
  }

  const cor = (idx: number, d?: boolean) => (d ? COR_DEMAIS : CORES[idx % CORES.length]);

  const R = 60;
  const CIRC = 2 * Math.PI * R;
  let acc = 0;

  return (
    <div className={`pizza ${legenda === 'baixo' ? 'baixo' : ''}`}>
      <svg viewBox="0 0 160 160" className="pizza-svg" role="img" aria-label="Distribuição por motivo">
        <g transform="translate(80,80) rotate(-90)">
          {dados.map((i, idx) => {
            const frac = i.total / soma;
            const seg = frac * CIRC;
            const dash = `${seg} ${CIRC - seg}`;
            const off = -acc * CIRC;
            acc += frac;
            return (
              <circle
                key={i.nome}
                r={R}
                cx={0}
                cy={0}
                fill="none"
                stroke={cor(idx, i.demais)}
                strokeWidth={26}
                strokeDasharray={dash}
                strokeDashoffset={off}
              >
                <title>
                  {i.nome}: {formatNumero(i.total)} ({(frac * 100).toFixed(1)}%)
                </title>
              </circle>
            );
          })}
        </g>
        {centro ? (
          <>
            <text x="80" y="76" textAnchor="middle" className="pizza-centro">
              {centro}
            </text>
            {centroSub ? (
              <text x="80" y="94" textAnchor="middle" className="pizza-centro-sub">
                {centroSub}
              </text>
            ) : null}
          </>
        ) : null}
      </svg>

      <ul className={`pizza-leg ${legenda === 'baixo' ? 'chips' : ''}`}>
        {dados.map((i, idx) => {
          const pct = ((i.total / soma) * 100).toFixed(1);
          return (
            <li key={i.nome}>
              <span className="pz-dot" style={{ background: cor(idx, i.demais) }} />
              <span className="pz-nome" title={i.nome}>
                {i.nome}
              </span>
              <span className="pz-val">
                {formatNumero(i.total)} <em>({pct}%)</em>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
