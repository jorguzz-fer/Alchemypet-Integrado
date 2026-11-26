'use client';

// Como instalar e usar a extensão que preenche o pedido no LaborLIS.
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

export default function ExtensaoLisModal({ onClose }: { onClose: () => void }) {
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function baixar() {
    setBaixando(true);
    setErro(null);
    try {
      await api.baixarExtensaoLis();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível baixar a extensão.');
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="ext-lis-tit">
        <h3 id="ext-lis-tit">Extensão do LaborLIS</h3>
        <div className="m-sub">
          Lança o pedido no LaborLIS antes de a amostra chegar, sem digitar tudo de novo: a extensão preenche o
          paciente, a guia e os exames; você confere e clica em <b>Salvar</b> no LaborLIS.
        </div>

        <h4 style={{ marginTop: 14 }}>Instalar (uma vez por computador, no Google Chrome)</h4>
        <ol className="imp-passos">
          <li>
            Baixe a extensão e <b>descompacte</b> o arquivo (fica uma pasta <code>alchemypet-lis</code>).
          </li>
          <li>
            No Chrome, abra <code>chrome://extensions</code> e ligue o <b>Modo do desenvolvedor</b> (canto superior
            direito).
          </li>
          <li>
            Clique em <b>Carregar sem compactação</b> e escolha a pasta <code>alchemypet-lis</code>. Não apague a
            pasta depois: o Chrome usa ela.
          </li>
          <li>Abra (ou recarregue) o LaborLIS: aparece o botão roxo <b>Alchemypet</b> no canto da tela.</li>
        </ol>

        <h4>Usar</h4>
        <ol className="imp-passos">
          <li>No botão <b>Alchemypet</b>, entre com o seu login deste sistema.</li>
          <li>Digite o número do pedido (ou passe o leitor no código de barras da etiqueta) e clique em Buscar.</li>
          <li>
            Em <b>Atendimento › Paciente › Novo</b>, clique em <b>1. Preencher paciente</b>; confira e salve.
          </li>
          <li>
            Em <b>Atendimento › Guia › Nova</b>, escolha o <b>Plano</b> e clique em <b>2. Preencher guia</b> e{' '}
            <b>3. Incluir exames</b>; confira e salve.
          </li>
          <li>
            Clique em <b>4. Salvei no LIS</b>: o pedido fica marcado como &quot;No LIS&quot; nesta lista.
          </li>
        </ol>
        <p className="muted">
          Se algum campo não for preenchido, o painel avisa. Nesse caso, abra a tela vazia no LaborLIS, clique em{' '}
          <b>Diagnóstico da tela</b> no painel e envie o texto copiado para ajustarmos a extensão.
        </p>
        <p className="muted">
          Quando a extensão for atualizada, baixe de novo, substitua a pasta e clique em ↻ (recarregar) no card dela em{' '}
          <code>chrome://extensions</code>.
        </p>

        {erro ? <div className="imp-erro">{erro}</div> : null}
        <div className="m-actions" style={{ marginTop: 18 }}>
          <button type="button" className="btn ghost" onClick={onClose}>
            Fechar
          </button>
          <button type="button" className="btn primary" onClick={baixar} disabled={baixando}>
            {baixando ? 'Baixando…' : 'Baixar extensão (.zip)'}
          </button>
        </div>
      </div>
    </div>
  );
}
