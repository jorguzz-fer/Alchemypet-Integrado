'use client';

// Lê a exportação do Gmail (Google Takeout) e conclui as revisões de
// resultado pela nossa resposta à clínica.
import { useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { ImportacaoEmailsResponse } from '@/lib/types';
import { formatNumero } from '@/lib/format';

export default function ImportarEmailsModal({
  onClose,
  onConcluido,
}: {
  onClose: () => void;
  onConcluido: (r: ImportacaoEmailsResponse) => void;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<ImportacaoEmailsResponse | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function enviar() {
    if (!arquivo) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await api.importarEmailsRevisao(arquivo);
      setRes(r);
      onConcluido(r);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível ler o arquivo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="modal-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !enviando) onClose();
      }}
    >
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="imp-em-tit">
        <h3 id="imp-em-tit">Classificar revisões pelos e-mails</h3>
        <div className="m-sub">
          O sistema lê a nossa resposta em cada conversa de &quot;Revisão de resultado&quot; e marca se foi{' '}
          <b>erro nosso (corrigido)</b> ou se o <b>resultado estava correto</b>. O que você já marcou à mão não
          muda.
        </div>

        {res ? (
          <div className="imp-res">
            <div className="imp-res-placar">
              <div className="c-erro">
                <b>{formatNumero(res.erro_nosso)}</b> Erro nosso (corrigido)
              </div>
              <div className="c-certo">
                <b>{formatNumero(res.correto)}</b> Resultado estava correto
              </div>
              <div className="c-nao">
                <b>{formatNumero(res.nao_identificado)}</b> Não identificado
              </div>
            </div>
            <p>
              Lidos {formatNumero(res.emails)} e-mails em {formatNumero(res.conversas)} conversas.{' '}
              {formatNumero(res.ligados)} de {formatNumero(res.revisoes)} revisões foram encontradas no arquivo
              {res.manuais ? ` (${formatNumero(res.manuais)} já marcadas à mão foram mantidas)` : ''}.
            </p>
            {res.sem_email ? (
              <p className="muted">
                {formatNumero(res.sem_email)} revisão(ões) não apareceram no arquivo: confira se a exportação
                inclui a caixa de entrada e os enviados do período.
              </p>
            ) : null}
            {res.nao_identificado ? (
              <p className="muted">
                Os &quot;não identificados&quot; ficam com o trecho da resposta na lista: é só ler e marcar.
              </p>
            ) : null}
            <div className="m-actions" style={{ marginTop: 18 }}>
              <button type="button" className="btn primary" onClick={onClose}>
                Ver na lista
              </button>
            </div>
          </div>
        ) : (
          <>
            <ol className="imp-passos">
              <li>
                Na conta do Gmail da caixa de chamados, abra <b>takeout.google.com</b>, clique em{' '}
                <b>Desmarcar tudo</b> e marque só <b>E-mail</b>.
              </li>
              <li>
                Em <b>Todos os dados de e-mail incluídos</b>, escolha <b>Caixa de entrada</b> e <b>Enviados</b> (as
                nossas respostas ficam nos enviados) e avance.
              </li>
              <li>
                Formato <b>.zip</b>. O Google manda o link por e-mail quando a exportação fica pronta.
              </li>
              <li>Baixe o .zip e envie aqui (também aceita o arquivo .mbox).</li>
            </ol>

            <div className="imp-arquivo">
              <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()} disabled={enviando}>
                Escolher arquivo
              </button>
              <span>{arquivo ? `${arquivo.name} · ${(arquivo.size / 1048576).toFixed(1)} MB` : 'Nenhum arquivo'}</span>
              <input
                ref={fileRef}
                type="file"
                accept=".zip,.mbox,.tgz,.gz,.tar"
                style={{ display: 'none' }}
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              />
            </div>

            {erro ? <div className="imp-erro">{erro}</div> : null}

            <div className="m-actions" style={{ marginTop: 18 }}>
              <button type="button" className="btn ghost" onClick={onClose} disabled={enviando}>
                Cancelar
              </button>
              <button type="button" className="btn primary" onClick={enviar} disabled={!arquivo || enviando}>
                {enviando ? 'Lendo os e-mails…' : 'Classificar revisões'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
