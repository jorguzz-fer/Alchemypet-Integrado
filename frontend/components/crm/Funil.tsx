'use client';

import type { CrmFunil, EtapaConta } from '@/lib/types';
import { formatNumero } from '@/lib/format';
import { ETAPAS_SAIDA } from './crmUi';

interface Props {
  funil: CrmFunil | null;
  ativa: EtapaConta | '';
  onChange: (e: EtapaConta | '') => void;
}

// Funil numa faixa: as etapas de avanço juntas e as saídas separadas,
// para o olho ler primeiro o caminho e depois as perdas.
export default function Funil({ funil, ativa, onChange }: Props) {
  const etapas = funil?.etapas ?? [];
  const caminho = etapas.filter((e) => !ETAPAS_SAIDA.includes(e.etapa));
  const saidas = etapas.filter((e) => ETAPAS_SAIDA.includes(e.etapa));

  const Etapa = ({ etapa, label, total }: { etapa: EtapaConta; label: string; total: number }) => (
    <button
      type="button"
      className={`funil-etapa e-${etapa}${ativa === etapa ? ' ativo' : ''}`}
      aria-pressed={ativa === etapa}
      onClick={() => onChange(ativa === etapa ? '' : etapa)}
    >
      <span className="fe-label">{label}</span>
      <span className="fe-num">{formatNumero(total)}</span>
    </button>
  );

  return (
    <div className="funil" aria-label="Funil de contas por etapa">
      <button
        type="button"
        className={`funil-etapa todos${ativa === '' ? ' ativo' : ''}`}
        aria-pressed={ativa === ''}
        onClick={() => onChange('')}
      >
        <span className="fe-label">Todas</span>
        <span className="fe-num">{formatNumero(funil?.total ?? 0)}</span>
      </button>
      <div className="funil-caminho">
        {caminho.map((e) => (
          <Etapa key={e.etapa} {...e} />
        ))}
      </div>
      <div className="funil-saidas">
        {saidas.map((e) => (
          <Etapa key={e.etapa} {...e} />
        ))}
      </div>
    </div>
  );
}
