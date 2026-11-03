'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { RankingAtividades as Ranking } from '@/lib/types';
import { formatNumero } from '@/lib/format';

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function RankingAtividades() {
  const hoje = new Date();
  const [periodo, setPeriodo] = useState({
    data_de: iso(new Date(hoje.getTime() - 29 * 86_400_000)),
    data_ate: iso(hoje),
  });
  const [dados, setDados] = useState<Ranking | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setErro(null);
    api
      .rankingAtividades(periodo, ctrl.signal)
      .then(setDados)
      .catch((e) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setErro(e instanceof ApiError ? e.message : 'Não foi possível carregar o ranking.');
      });
    return () => ctrl.abort();
  }, [periodo]);

  return (
    <div className="tablewrap" style={{ marginTop: 14 }}>
      <div className="tabletools">
        <div className="t-left">
          Atividades por pessoa
          <span className="count">{formatNumero(dados?.total ?? 0)}</span>
        </div>
        <div className="t-right periodo">
          <label>
            De{' '}
            <input type="date" value={periodo.data_de} max={periodo.data_ate}
              onChange={(e) => setPeriodo((p) => ({ ...p, data_de: e.target.value }))} />
          </label>
          <label>
            até{' '}
            <input type="date" value={periodo.data_ate} min={periodo.data_de}
              onChange={(e) => setPeriodo((p) => ({ ...p, data_ate: e.target.value }))} />
          </label>
        </div>
      </div>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Pessoa</th>
              <th>Total</th>
              {(dados?.tipos ?? []).map((t) => (
                <th key={t}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {erro ? (
              <tr>
                <td className="empty-row" colSpan={2}>{erro}</td>
              </tr>
            ) : !dados ? (
              <tr>
                <td className="empty-row" colSpan={2}>
                  <div className="spinner" />
                </td>
              </tr>
            ) : dados.linhas.length === 0 ? (
              <tr>
                <td className="empty-row" colSpan={2}>
                  Nenhuma atividade registrada no período.
                </td>
              </tr>
            ) : (
              dados.linhas.map((l) => (
                <tr key={l.usuario}>
                  <td><b>{l.usuario}</b></td>
                  <td><b>{formatNumero(l.total)}</b></td>
                  {dados.tipos.map((t) => (
                    <td key={t}>{l.por_tipo[t] ? formatNumero(l.por_tipo[t]) : '—'}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
