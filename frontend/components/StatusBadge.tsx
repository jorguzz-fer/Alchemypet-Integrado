import type { StatusPlanilha } from '@/lib/types';

const LABELS: Record<StatusPlanilha, string> = {
  pendente: 'Pendente',
  tratativa: 'Em tratativa',
  concluido: 'Concluído',
};

const CLASSES: Record<StatusPlanilha, string> = {
  pendente: 'b-pend',
  tratativa: 'b-trat',
  concluido: 'b-ok',
};

export default function StatusBadge({ status }: { status: StatusPlanilha }) {
  const cls = CLASSES[status] ?? 'b-pend';
  const label = LABELS[status] ?? status;
  return (
    <span className={`badge ${cls}`}>
      <span className="d" />
      {label}
    </span>
  );
}
