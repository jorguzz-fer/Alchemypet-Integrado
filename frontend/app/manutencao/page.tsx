'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AlvoLimpeza, LimpezaPrevia, LimpezaResultado } from '@/lib/types';
import { formatData, formatNumero } from '@/lib/format';

const PALAVRA = 'APAGAR';

const ALVOS: { key: AlvoLimpeza; rotulo: string; descricao: string }[] = [
  { key: 'chamados', rotulo: 'Chamados', descricao: 'Caixa de chamados (por data do chamado)' },
  { key: 'convenio', rotulo: 'Pendências de Convênio', descricao: 'Inclui as tratativas' },
  { key: 'triagem', rotulo: 'Pendências de Triagem', descricao: 'Inclui as tratativas' },
];

export default function ManutencaoPage() {
  const { usuario } = useAuth();
  const [dataAte, setDataAte] = useState('2026-09-01');
  const [semData, setSemData] = useState(false);
  const [alvos, setAlvos] = useState<AlvoLimpeza[]>(['chamados', 'convenio', 'triagem']);

  const [previa, setPrevia] = useState<LimpezaPrevia | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [confirmando, setConfirmando] = useState(false);
  const [palavra, setPalavra] = useState('');
  const [apagando, setApagando] = useState(false);
  const [resultado, setResultado] = useState<LimpezaResultado | null>(null);

  if (usuario && usuario.perfil !== 'admin') {
    return (
      <div className="page">
        <div className="card" style={{ marginTop: 20 }}>
          Acesso restrito a administradores.
        </div>
      </div>
    );
  }

  function alternarAlvo(a: AlvoLimpeza) {
    setPrevia(null);
    setAlvos((l) => (l.includes(a) ? l.filter((x) => x !== a) : [...l, a]));
  }

  async function calcular(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setResultado(null);
    setCalculando(true);
    try {
      setPrevia(await api.limpezaPrevia(dataAte, semData));
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível calcular a prévia.');
      setPrevia(null);
    } finally {
      setCalculando(false);
    }
  }

  const totalSelecionado = previa
    ? alvos.reduce((acc, a) => acc + previa[a], 0)
    : 0;
  const tratativasSel =
    previa && (alvos.includes('convenio') || alvos.includes('triagem')) ? previa.tratativas : 0;

  async function apagar() {
    setApagando(true);
    setErro(null);
    try {
      const r = await api.limpar({
        data_ate: dataAte,
        incluir_sem_data: semData,
        alvos,
        confirmacao: palavra,
      });
      setResultado(r);
      setPrevia(null);
      setConfirmando(false);
      setPalavra('');
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Falha ao apagar os registros.');
    } finally {
      setApagando(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Manutenção</h1>
          <div className="lead">
            Limpeza de registros antigos por data limite. POPs nunca são afetados.
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 4 }}>Limpar registros até uma data</h4>
        <div className="csub" style={{ marginBottom: 14 }}>
          Apaga chamados e pendências com data <b>igual ou anterior</b> à data limite. Pendências
          sem dia (só ano/mês) entram apenas quando o mês inteiro está dentro do período.
        </div>
        <form onSubmit={calcular}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="mt-data">Data limite (inclusive)</label>
              <input
                id="mt-data"
                type="date"
                value={dataAte}
                required
                onChange={(e) => {
                  setDataAte(e.target.value);
                  setPrevia(null);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="mt-semdata">Registros sem data</label>
              <label className="check-inline" htmlFor="mt-semdata">
                <input
                  id="mt-semdata"
                  type="checkbox"
                  checked={semData}
                  onChange={(e) => {
                    setSemData(e.target.checked);
                    setPrevia(null);
                  }}
                />
                Incluir registros sem nenhuma data
              </label>
            </div>
          </div>

          <div className="check-list">
            {ALVOS.map((a) => (
              <label key={a.key} className="check-item">
                <input
                  type="checkbox"
                  checked={alvos.includes(a.key)}
                  onChange={() => alternarAlvo(a.key)}
                />
                <span>
                  <b>{a.rotulo}</b>
                  <em>{a.descricao}</em>
                </span>
              </label>
            ))}
          </div>

          <div className="actions" style={{ marginTop: 14 }}>
            <button
              type="submit"
              className="btn primary"
              disabled={calculando || alvos.length === 0 || !dataAte}
            >
              {calculando ? 'Calculando…' : 'Calcular prévia'}
            </button>
          </div>
        </form>
      </div>

      {erro ? (
        <div className="card" style={{ marginBottom: 14, color: 'var(--erro)', fontWeight: 600 }}>
          {erro}
        </div>
      ) : null}

      {resultado ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <h4 style={{ marginBottom: 8 }}>Limpeza concluída</h4>
          <ul className="lista-simples">
            <li>Chamados apagados: <b>{formatNumero(resultado.chamados)}</b></li>
            <li>Pendências de Convênio apagadas: <b>{formatNumero(resultado.convenio)}</b></li>
            <li>Pendências de Triagem apagadas: <b>{formatNumero(resultado.triagem)}</b></li>
            <li>Tratativas apagadas: <b>{formatNumero(resultado.tratativas)}</b></li>
          </ul>
        </div>
      ) : null}

      {previa ? (
        <div className="card">
          <h4 style={{ marginBottom: 4 }}>Prévia — até {formatData(previa.data_ate)}</h4>
          <div className="csub" style={{ marginBottom: 12 }}>
            Nada foi apagado ainda. Confira as quantidades antes de confirmar.
          </div>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Conjunto</th>
                  <th>Registros a apagar</th>
                </tr>
              </thead>
              <tbody>
                {ALVOS.map((a) => (
                  <tr key={a.key} style={{ opacity: alvos.includes(a.key) ? 1 : 0.45 }}>
                    <td>
                      {a.rotulo}
                      {!alvos.includes(a.key) ? <span className="muted"> (não selecionado)</span> : null}
                    </td>
                    <td>{formatNumero(previa[a.key])}</td>
                  </tr>
                ))}
                <tr>
                  <td>Tratativas vinculadas</td>
                  <td>{formatNumero(tratativasSel)}</td>
                </tr>
                <tr>
                  <td>POPs</td>
                  <td>
                    <span className="stag resolvido">não afetados</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="actions" style={{ marginTop: 14 }}>
            <button
              className="btn danger"
              disabled={totalSelecionado === 0}
              onClick={() => {
                setPalavra('');
                setConfirmando(true);
              }}
            >
              Apagar {formatNumero(totalSelecionado)} registro(s)…
            </button>
          </div>
        </div>
      ) : null}

      {confirmando && previa ? (
        <div
          className="modal-bg"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !apagando) setConfirmando(false);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <h3>Confirmar limpeza</h3>
            <div className="m-sub">
              Serão apagados <b>{formatNumero(totalSelecionado)}</b> registro(s) com data até{' '}
              <b>{formatData(previa.data_ate)}</b>
              {tratativasSel ? <> e {formatNumero(tratativasSel)} tratativa(s)</> : null}. Esta
              ação não pode ser desfeita.
            </div>
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="mt-confirma">
                Digite <b>{PALAVRA}</b> para confirmar
              </label>
              <input
                id="mt-confirma"
                value={palavra}
                autoComplete="off"
                onChange={(e) => setPalavra(e.target.value)}
              />
            </div>
            <div className="m-actions" style={{ marginTop: 18 }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setConfirmando(false)}
                disabled={apagando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={apagar}
                disabled={apagando || palavra.trim().toUpperCase() !== PALAVRA}
              >
                {apagando ? 'Apagando…' : 'Apagar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
