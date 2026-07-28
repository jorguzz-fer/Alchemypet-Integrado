export type KpiTone = 'total' | 'pend' | 'trat' | 'ok' | 'taxa' | 'tempo';

interface KpiProps {
  label: string;
  value: string;
  sub?: string;
  tone?: KpiTone;
}

export default function Kpi({ label, value, sub, tone = 'total' }: KpiProps) {
  return (
    <div className={`kpi t-${tone}`}>
      <span className="tag" />
      <div className="lab">{label}</div>
      <div className="val">{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}
