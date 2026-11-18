'use client';

// Lê a exportação do Gmail (Google Takeout) e conclui as revisões de
// resultado pela nossa resposta à clínica.
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { ImportacaoEmailsResponse, TarefaEmails } from '@/lib/types';
import { formatNumero } from '@/lib/format';

export default function ImportarEmailsModal({
  onClose,
  onConcluido,
}: {
  onClose: () => void;
  onConcluido: (r: ImportacaoEmailsResponse) => void;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [envio, setEnvio] = useState<number | null>(null);
  const [tarefa, setTarefa] = useState<TarefaEmails | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<ImportacaoEmailsResponse | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const trabalhando = envio !== null || (tarefa !== null && (tarefa.fase === 'lendo' || tarefa.fase === 'ligando'));

  // Acompanha a leitura no servidor a cada 2 s até concluir.
  const tarefaId = tarefa?.id;
  const emAndamento = tarefa?.fase === 'lendo' || tarefa?.fase === 'ligando';
  useEffect(() => {
    if (!tarefaId || !emAndamento) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const st = await api.statusEmailsRevisao(tarefaId, ctrl.signal);
        setTarefa(st);
        if (st.fase === 'concluido' && st.resultado) {
          setRes(st.resultado);
          onConcluido(st.resultado);
        } else if (st.fase === 'erro') {
          setErro(st.erro || 'Não foi possível ler os e-mails.');
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setTarefa((x) => (x ? { ...x } : x)); // tenta de novo no próximo ciclo
      }
    }, 2000);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [tarefa, tarefaId, emAndamento, onConcluido]);

  async function enviar() {
    if (!arquivo) return;
    setErro(null);
    setEnvio(0);
    try {
      const t = await api.enviarEmailsRevisao(arquivo, setEnvio);
      setTarefa(t);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível enviar o arquivo.');
    } finally {
      setEnvio(null);
    }
  }

  const pctLeitura = tarefa && tarefa.tamanho ? Math.min(100, Math.round((100 * tarefa.lidos) / tarefa.tamanho)) : 0;

  return (
    <div
      className="modal-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !trabalhando) onClose();
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
              <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()} disabled={trabalhando}>
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

            {envio !== null ? (
              <div className="imp-prog" role="status">
                <div className="imp-prog-tit">1/2 · Enviando o arquivo… {envio}%</div>
                <div className="imp-barra"><span style={{ width: `${envio}%` }} /></div>
                <small>Arquivos grandes levam alguns minutos para subir. Não feche esta janela.</small>
              </div>
            ) : null}
            {tarefa && emAndamento ? (
              <div className="imp-prog" role="status">
                <div className="imp-prog-tit">
                  2/2 ·{' '}
                  {tarefa.fase === 'ligando'
                    ? 'Ligando as conversas aos chamados…'
                    : `Lendo os e-mails… ${formatNumero(tarefa.emails)} lidos`}
                </div>
                <div className="imp-barra">
                  <span style={{ width: `${tarefa.fase === 'ligando' ? 100 : pctLeitura}%` }} />
                </div>
                <small>Pode fechar esta janela: a leitura continua no servidor. Depois, atualize a lista para ver o resultado.</small>
              </div>
            ) : null}

            {erro ? <div className="imp-erro">{erro}</div> : null}

            <div className="m-actions" style={{ marginTop: 18 }}>
              <button type="button" className="btn ghost" onClick={onClose} disabled={envio !== null}>
                {emAndamento ? 'Fechar' : 'Cancelar'}
              </button>
              <button type="button" className="btn primary" onClick={enviar} disabled={!arquivo || trabalhando}>
                {trabalhando ? 'Processando…' : 'Classificar revisões'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
