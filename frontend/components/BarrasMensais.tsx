'use client';

import type { PorMes } from '@/lib/types';
import { nomeMes } from '@/lib/format';

const COR = {
  pendente: '#c0532f', // --erro
  tratativa: '#d98a2b', // --alerta
  concluido: '#2e9e6b', // --ok
};

interface Props {
  dados: PorMes[];
}

// Grafico de barras empilhadas por mes, em SVG inline (sem libs).
export default function BarrasMensais({ dados }: Props) {
  if (!dados || dados.length === 0) {
    return (
      <div className="trat-empty">Sem dados para o período selecionado.</div>
    );
  }

  // Ordena por ano/mes.
  const meses = [...dados].sort((a, b) =>
    a.ano === b.ano ? a.mes - b.mes : a.ano - b.ano,
  );

  const maxTotal = Math.max(
    1,
    ...meses.map((m) => m.pendente + m.tratativa + m.concluido),
  );

  // Geometria do desenho (unidades de viewBox).
  const H = 240;
  const padTop = 12;
  const padBottom = 28;
  const plotH = H - padTop - padBottom;
  const barW = 34;
  const gap = 22;
  const W = Math.max(320, meses.length * (barW + gap) + gap);

  return (
    <div className="scroll">
      <svg
        className="barras-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Barras empilhadas por mes"
        style={{ minWidth: Math.max(320, meses.length * (barW + gap)) }}
      >
        {/* linha de base */}
        <line
          x1={0}
          y1={padTop + plotH}
          x2={W}
          y2={padTop + plotH}
          stroke="#dde5ec"
          strokeWidth={1}
        />
        {meses.map((m, i) => {
          const x = gap + i * (barW + gap);
          const total = m.pendente + m.tratativa + m.concluido;
          const scale = (v: number) => (v / maxTotal) * plotH;

          const hPend = scale(m.pendente);
          const hTrat = scale(m.tratativa);
          const hConc = scale(m.concluido);

          // Empilha de baixo para cima: pendente, tratativa, concluido.
          let yCursor = padTop + plotH;
          const segPend = { y: yCursor - hPend, h: hPend };
          yCursor -= hPend;
          const segTrat = { y: yCursor - hTrat, h: hTrat };
          yCursor -= hTrat;
          const segConc = { y: yCursor - hConc, h: hConc };
          yCursor -= hConc;

          const topY = yCursor;

          return (
            <g key={`${m.ano}-${m.mes}`}>
              {hPend > 0 && (
                <rect
                  x={x}
                  y={segPend.y}
                  width={barW}
                  height={segPend.h}
                  fill={COR.pendente}
                />
              )}
              {hTrat > 0 && (
                <rect
                  x={x}
                  y={segTrat.y}
                  width={barW}
                  height={segTrat.h}
                  fill={COR.tratativa}
                />
              )}
              {hConc > 0 && (
                <rect
                  x={x}
                  y={segConc.y}
                  width={barW}
                  height={segConc.h}
                  fill={COR.concluido}
                  rx={0}
                />
              )}
              {/* total acima da barra */}
              <text
                x={x + barW / 2}
                y={topY - 5}
                textAnchor="middle"
                style={{ fontWeight: 700, fill: '#2b3640' }}
              >
                {total.toLocaleString('pt-BR')}
              </text>
              {/* rotulo do mes */}
              <text
                x={x + barW / 2}
                y={padTop + plotH + 18}
                textAnchor="middle"
              >
                {nomeMes(m.mes)}/{String(m.ano).slice(-2)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="legend">
        <span>
          <i style={{ background: COR.pendente }} /> Pendente
        </span>
        <span>
          <i style={{ background: COR.tratativa }} /> Em tratativa
        </span>
        <span>
          <i style={{ background: COR.concluido }} /> Concluido
        </span>
      </div>
    </div>
  );
}
