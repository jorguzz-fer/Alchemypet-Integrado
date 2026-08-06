'use client';

interface Opcao {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  opcoes?: Opcao[];
  id?: string;
}

const PADRAO: Opcao[] = [
  { value: 'recentes', label: 'Mais recentes primeiro' },
  { value: 'antigos', label: 'Mais antigas primeiro' },
];

export default function OrdenarSelect({ value, onChange, opcoes = PADRAO, id }: Props) {
  return (
    <label className="sortbar">
      <span className="sort-ic" aria-hidden>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6h13M3 12h9M3 18h5" />
          <path d="m18 9 3-3 3 3M21 6v12" />
        </svg>
      </span>
      Ordenar
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {opcoes.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
