'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/api';

interface Props {
  onExport: (formato: 'xlsx' | 'pdf') => Promise<void>;
}

export default function ExportButtons({ onExport }: Props) {
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function exportar(formato: 'xlsx' | 'pdf') {
    setBusy(formato);
    setErro(null);
    try {
      await onExport(formato);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao gerar o arquivo.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="export-acoes">
      <div className="actions">
        <button
          className="btn ghost"
          onClick={() => exportar('xlsx')}
          disabled={busy !== null}
        >
          {busy === 'xlsx' ? 'Gerando…' : 'Exportar Excel'}
        </button>
        <button
          className="btn ghost"
          onClick={() => exportar('pdf')}
          disabled={busy !== null}
        >
          {busy === 'pdf' ? 'Gerando…' : 'Exportar PDF'}
        </button>
      </div>
      {erro ? (
        <div className="export-erro" role="alert">
          {erro}
        </div>
      ) : null}
    </div>
  );
}
