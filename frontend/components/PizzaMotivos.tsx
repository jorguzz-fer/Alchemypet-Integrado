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

interface Props {
  itens: TopItem[];
  // Rótulo do centro (ex.: total).
  centro?: string;
  centroSub?: string;
}

export default function PizzaMotivos({ itens, centro, centroSub }: Props) {
  const dados = (itens ?? []).filter((i) => i.total > 0);
  const soma = dados.reduce((a, i) => a + i.total, 0);
  if (soma === 0) return <div className="trat-empty">Sem dados.</div>;

  const R = 60;
  const CIRC = 2 * Math.PI * R;
  let acc = 0;

  return (
    <div className="pizza">
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
                stroke={CORES[idx % CORES.length]}
                strokeWidth={26}
                strokeDasharray={dash}
                strokeDashoffset={off}
              >
                <title>
                  {i.nome}: {formatNumero(i.total)} ({((frac * 100).toFixed(1))}%)
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

      <ul className="pizza-leg">
        {dados.map((i, idx) => {
          const pct = ((i.total / soma) * 100).toFixed(1);
          return (
            <li key={i.nome}>
              <span
                className="pz-dot"
                style={{ background: CORES[idx % CORES.length] }}
              />
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
