# Painel Convênio — Alchemypet

Tela de **gestão das pendências de convênio**. Importa a planilha
`Pendências Convênio.xlsx` (todas as abas mensais), normaliza os dados e
apresenta indicadores, gráficos, filtros e uma tabela operacional com gestão
por registro.

> Módulo standalone, 100% client-side. Faz parte do ecossistema em fase de
> discovery — ver [Escopo para Orçamento](../docs/ESCOPO-ORCAMENTO.md).

## Como usar

1. Abra `painel-convenio/index.html` no navegador (Chrome/Edge/Firefox).
2. Clique em **Importar planilha** (ou arraste o `.xlsx` para a área de upload).
3. O painel processa todas as abas mensais e monta o dashboard.

Os dados são processados **localmente no navegador** — nada é enviado a
servidores. Após a primeira importação, o conjunto fica salvo no navegador
(IndexedDB) e reabre automaticamente; para atualizar, basta importar a planilha
mais recente.

## Recursos

- **Indicadores (KPIs):** total, pendentes, em tratativa, concluídas, taxa de
  resolução e tempo médio de devolutiva (em dias).
- **Gráficos:** evolução mensal por status, distribuição por status (donut),
  top clínicas com pendências e tipos de informação mais frequentes.
- **Filtros:** ano, intervalo de meses, status da planilha, situação de gestão,
  triagem, clínica, responsável e busca livre.
- **Tabela operacional:** ordenável, paginada, com badges de status.
- **Gestão por registro:** marque cada pendência como *Aberto / Em andamento /
  Resolvido* e adicione observações. As alterações ficam salvas no navegador
  (localStorage) e entram na exportação.
- **Exportar CSV** do conjunto filtrado (inclui os campos de gestão).

## Como o painel lê a planilha

O leitor detecta as colunas **pelo nome do cabeçalho** (não pela posição), o que
o torna resistente às variações entre abas ao longo dos anos — colunas extras
(ex.: `Horário`), ordens diferentes e até erros de digitação comuns
(`pacinte`, `confitmacao`). Reconhece, entre outras:

`Guia` · `Paciente` · `Código da Clínica` · `Clínica` · `Informação necessária`
· `Responsável` · `Resposta do Cliente` · `Data da devolutiva` ·
`Confirmação para a Clínica` · `Triagem` · `Status`

O período (mês/ano) de cada pendência vem do **nome da aba** (ex.: `JULHO 2026`).

### Regra de status (derivado da planilha)

| Situação        | Critério                                                        |
|-----------------|-----------------------------------------------------------------|
| **Concluído**   | `Confirmação para a Clínica` = `OK`                             |
| **Em tratativa**| há `Resposta do Cliente` ou `Data da devolutiva`, mas sem `OK`  |
| **Pendente**    | apenas a informação foi solicitada, sem retorno                 |

A coluna **Gestão** é independente e controlada por você dentro do painel.

## Técnico

- `index.html` — aplicação (HTML + CSS + JS, sem dependências externas de rede).
- `vendor/xlsx.full.min.js` — [SheetJS](https://sheetjs.com) (leitura de `.xlsx`),
  empacotado localmente para funcionar **offline**.
- Gráficos em SVG puro (sem bibliotecas). Persistência via IndexedDB (dataset) e
  localStorage (gestão/observações).
