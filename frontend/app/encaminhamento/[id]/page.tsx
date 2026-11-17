'use client';

import Link from 'next/link';
import { Fragment, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { PedidoExame } from '@/lib/types';
import { formatDataHora } from '@/lib/format';

const SECOES: Record<string, string> = {
  laudo: 'Informações para emissão de laudos',
  motivo: 'Motivo da solicitação',
  laboratorio: 'Para uso do laboratório',
};

export default function PedidoPage({ params }: { params: { id: string } }) {
  const [p, setP] = useState<PedidoExame | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lab, setLab] = useState({ data_chegada: '', n_amostras: '', recebido_por: '' });
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .getPedido(params.id, ctrl.signal)
      .then((x) => {
        setP(x);
        setLab({
          data_chegada: String(x.dados.data_chegada ?? ''),
          n_amostras: x.dados.n_amostras != null ? String(x.dados.n_amostras) : '',
          recebido_por: String(x.dados.recebido_por ?? ''),
        });
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setErro(e instanceof ApiError ? e.message : 'Não foi possível carregar o pedido.');
      });
    return () => ctrl.abort();
  }, [params.id]);

  async function salvarLab(e: React.FormEvent) {
    e.preventDefault();
    if (!p) return;
    setSalvando(true);
    setAviso(null);
    try {
      const x = await api.registrarChegada(p.id, {
        data_chegada: lab.data_chegada || null,
        n_amostras: lab.n_amostras ? Number(lab.n_amostras) : null,
        recebido_por: lab.recebido_por,
      });
      setP(x);
      setAviso('Dados do laboratório salvos.');
    } catch (err) {
      setAviso(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  if (erro) return <div className="state"><div className="errbox"><p>{erro}</p></div></div>;
  if (!p) return <div className="state"><div className="spinner" /></div>;

  const numero = String(p.numero).padStart(8, '0');
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Pedido Nº {numero}</h1>
          <div className="lead">
            {p.paciente} · {p.clinica} · criado em {formatDataHora(p.created_at)} por {p.criado_por || '—'}
            {p.urgente ? ' · URGENTE' : ''}
          </div>
        </div>
        <div className="actions">
          <Link className="btn ghost" href="/encaminhamento">Voltar</Link>
          <button className="btn ghost" onClick={() => api.baixarPdfPedido(p.id, p.numero).catch(() => undefined)}>
            Baixar PDF
          </button>
          <button className="btn primary" onClick={() => api.abrirPdfPedido(p.id).catch(() => undefined)}>
            Imprimir formulário
          </button>
        </div>
      </div>

      <div className="grid-charts-2">
        <div className="card">
          {['laudo', 'motivo'].map((s) => (
            <div key={s} style={{ marginBottom: 14 }}>
              <h4>{SECOES[s]}</h4>
              <dl className="dados">
                {p.campos.filter((c) => c.secao === s).map((c) => (
                  <Fragment key={c.chave}><dt>{c.rotulo}</dt><dd>{c.texto}</dd></Fragment>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <div>
          <div className="card">
            <h4>Exames ({p.exames.length})</h4>
            <ul className="timeline" style={{ marginTop: 10 }}>
              {p.exames.map((e) => (
                <li key={e.codigo}>
                  <div className="tl-topo"><b>{e.codigo}</b> <span>{e.nome}</span></div>
                </li>
              ))}
            </ul>
            <div className="crm-sub">{p.versao}</div>
          </div>
          <form className="card" style={{ marginTop: 14 }} onSubmit={salvarLab}>
            <h4>Para uso do laboratório</h4>
            <div className="csub">Preencha na chegada da amostra.</div>
            <div className="form-grid" style={{ marginTop: 10 }}>
              <div className="field">
                <label htmlFor="lab-data">Data de chegada</label>
                <input id="lab-data" type="date" value={lab.data_chegada}
                  onChange={(e) => setLab((l) => ({ ...l, data_chegada: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="lab-n">Nº de amostras</label>
                <input id="lab-n" type="number" min={0} value={lab.n_amostras}
                  onChange={(e) => setLab((l) => ({ ...l, n_amostras: e.target.value }))} />
              </div>
              <div className="field col-2">
                <label htmlFor="lab-por">Recebido por</label>
                <input id="lab-por" value={lab.recebido_por}
                  onChange={(e) => setLab((l) => ({ ...l, recebido_por: e.target.value }))} />
              </div>
            </div>
            {aviso ? <div className="crm-sub" style={{ marginBottom: 8 }}>{aviso}</div> : null}
            <button className="btn primary sm" type="submit" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
