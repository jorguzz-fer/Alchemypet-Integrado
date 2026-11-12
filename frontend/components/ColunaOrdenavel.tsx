'use client';

// Título de coluna que ordena a lista ao ser clicado (1º clique no sentido
// natural da coluna; o 2º inverte). A ordenação é feita no servidor, então
// vale para todas as páginas, não só para as linhas visíveis.
export type Direcao = 'asc' | 'desc';

interface Props {
  campo: string;
  label: string;
  // Ordenação atual (sort/dir da lista) e a padrão quando nada foi escolhido.
  sort?: string;
  dir?: Direcao;
  padrao: { sort: string; dir: Direcao };
  // Sentido do 1º clique: datas e números costumam começar pelo maior.
  inicial?: Direcao;
  onChange: (sort: string, dir: Direcao) => void;
  className?: string;
}

export default function ColunaOrdenavel({
  campo,
  label,
  sort,
  dir,
  padrao,
  inicial = 'asc',
  onChange,
  className,
}: Props) {
  const atual = sort || padrao.sort;
  const sentido: Direcao = sort ? dir || 'asc' : padrao.dir;
  const ativo = atual === campo;
  const proximo: Direcao = ativo ? (sentido === 'asc' ? 'desc' : 'asc') : inicial;
  return (
    <th
      className={`th-ord${ativo ? ' ativo' : ''}${className ? ` ${className}` : ''}`}
      aria-sort={ativo ? (sentido === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onChange(campo, proximo)}
        title={`Ordenar por ${label.toLowerCase()} (${proximo === 'asc' ? 'crescente' : 'decrescente'})`}
      >
        {label}
        <span className="th-seta" aria-hidden>
          {ativo ? (sentido === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}
