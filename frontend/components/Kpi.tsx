export type KpiTone =
  | 'total'
  | 'pend'
  | 'trat'
  | 'ok'
  | 'taxa'
  | 'tempo'
  | 'antigas';

interface KpiProps {
  label: string;
  value: string;
  sub?: string;
  tone?: KpiTone;
  onClick?: () => void;
  ativo?: boolean;
}

export default function Kpi({
  label,
  value,
  sub,
  tone = 'total',
  onClick,
  ativo,
}: KpiProps) {
  const classe = `kpi t-${tone}${onClick ? ' clicavel' : ''}${ativo ? ' ativo' : ''}`;
  if (onClick) {
    return (
      <button type="button" className={classe} onClick={onClick} aria-pressed={ativo}>
        <span className="tag" />
        <div className="lab">{label}</div>
        <div className="val">{value}</div>
        {sub ? <div className="sub">{sub}</div> : null}
      </button>
    );
  }
  return (
    <div className={classe}>
      <span className="tag" />
      <div className="lab">{label}</div>
      <div className="val">{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}
