# Recriação do Software de Gestão da Alchemypet — Mapeamento para Orçamento (Fase 1)

> Status: **Mapeamento / Escopo para orçamento** — sem implementação nesta etapa.
> Fonte: transcrição da reunião de *walkthrough* do software de gestão em uso hoje na
> Alchemypet, percorrido de **Home até Internação**, mais os prints dos menus **Financeiro** e
> **Faturamento** e as respostas às perguntas em aberto (§9). O **cadastro de clientes/pacientes**
> foi fechado na reunião anterior e não está nesta transcrição (pré-requisito em §4, E2).
> Revisão 3 acrescenta ao mesmo orçamento: **interfaceamento com equipamentos** (AU480 e
> Ac·T 10), **CRM**, **Rastreio e Logística** e **Agente de atendimento com Chatwoot** (§3.11–§3.14).
> Revisão 4 traz o **LIS completo** para dentro do orçamento (E21: controle de qualidade, lotes
> de reagente e laudo com imagem), em vez de deixá-lo na sustentação.
> Data: 2026-09-02 (revisão 4)

---

## 1. Contexto

A **Alchemypet** é um laboratório de análises clínicas veterinárias. A ideia é **recriar, de
forma simplificada e AI-First, o software de gestão que a Alchemypet usa hoje** (agenda,
atendimento, vendas, comissões, cadastros, internação, financeiro, faturamento…), como núcleo
do **Alchemypet Integrado** — a linha *Sistema Integrado / Gestão de Clínicas* do
[mapa de módulos do escopo geral](ESCOPO-ORCAMENTO.md#4-mapa-de-módulos-construir--integrar).
Por ser white-label, o mesmo produto poderá ser revendido a clínicas e hospitais depois.

**Não vamos recriar o software inteiro.** Entra na Fase 1 o que foi percorrido na reunião
(Home → Internação) mais **Financeiro e Faturamento**, incluídos a partir dos prints dos menus
(§3.9 e §3.10). Estoque e Relatórios aparecem no menu, mas ainda não foram percorridos e ficam
para a próxima reunião (§10).

Ao mesmo orçamento foram acrescentados quatro blocos que **não estão no software atual** e vêm
do escopo geral do ecossistema: interfaceamento com os analisadores do laboratório, CRM,
rastreio/logística e o agente de atendimento sobre Chatwoot (§3.11–§3.14). Eles são orçados em
separado (bloco B em §8) para a diretoria poder decidir por bloco.

> Nota: o escopo geral previa *integrar* um ERP/financeiro existente. Como o financeiro faz
> parte do software que está sendo substituído, na Fase 1 ele é **construído** (E11 e E14).

### 1.1 Diagnóstico do software atual (repetido ao longo da reunião)

- Arquitetura antiga ("feito em meados dos anos 2000"): navegação que abre janela em cima de
  janela, botões que não fazem nada, tela que trava depois de criar usuário.
- Relatórios redundantes: a mesma análise em três ou quatro telas (lista de vendas, consulta de
  vendas, minhas vendas, resumo total, vendas por grupo…).
- Funcionalidade no módulo errado: saldo devedor do cliente em Vendas, produtividade fora de
  Vendas, "consultas" que significa "consultar".
- Catálogos vazios que o usuário precisa cadastrar do zero: vacinas, patologias, produtos.
- Nada é ativo: a tela de vacinas vencidas não avisa o tutor; a comissão não tem consolidado;
  a alta da internação não gera cobrança.
- Extratos abrem mostrando 2024 inteiro — "você perde totalmente".

### 1.2 Mercado citado

SimplesVet, VetSmart e Vetus pertencem ao mesmo grupo (Petlove), que "quer monopolizar o
mercado". Veterinários não querem ficar presos a um único fornecedor — é a janela de entrada
para a versão white-label. O VetSmart (bulário inteligente) foi citado como referência.

### 1.3 Princípios de produto extraídos da reunião

| Princípio | Onde apareceu |
|---|---|
| **Uma tela por análise** — nada de quatro relatórios para a mesma pergunta | Vendas, Painel de inteligência |
| **Navegar, não abrir janelas** — fluxo em página única, sem pop-ups empilhados | Internação, Comissão, Agenda |
| **Todo botão faz algo** — o ícone de telefone tem que ligar ou mandar WhatsApp | Vacinação |
| **Visão por login** — o médico só vê a agenda e as ações dele; o admin vê tudo | Agenda |
| **Catálogos já carregados** — raças, vacinas, medicamentos e patologias vêm "de fábrica" | Cadastros |
| **Tudo por código** — produto, serviço e exame com código numérico, sem abreviação | Orçamento |
| **Ação gera cobrança** — medicação aplicada, alta e atendimento vão direto para a fatura | Internação |
| **Período atual por padrão** — extratos e listas não abrem mostrando o passado inteiro | Comissão / Extratos |
| **Consolidado + individual** — sempre as duas visões (comissão, produtividade, internação) | Comissão, Internação |

---

## 2. Legenda das decisões

| Decisão | Significado |
|---|---|
| ✅ **Manter** | Existe hoje e entra na Fase 1 (com a UI refeita) |
| 🔧 **Simplificar** | Entra, mas consolidado/reduzido em relação ao atual |
| ↪️ **Reorganizar** | Entra, porém em outro módulo |
| ✨ **Novo** | Não existe no software atual — diferencial nosso |
| ❌ **Fora** | Descartado ou adiado para depois da Fase 1 |

---

## 3. Mapa módulo a módulo

### 3.1 Home / Painel de controle

| Funcionalidade atual | Decisão | Como fica | Observações da reunião |
|---|---|---|---|
| Home com "carinha" fixa | 🔧 | Home = **painel de controle**: agenda do dia, internados e próximos procedimentos, lembretes pendentes, resumo do dia | "Não sei se essa é a melhor forma de apresentar a home"; apresentar "pelo painel de controle". Conteúdo confirmado em §9 |
| Atendimento clínico → todos os pacientes | ✅ | Lista de pacientes com busca (nome do tutor, telefone, nome do pet) | Já resolvido na reunião anterior ("a gente já fez") |

### 3.2 Agenda

| Funcionalidade atual | Decisão | Como fica | Observações da reunião |
|---|---|---|---|
| Agenda do dia / dia anterior com vários especialistas | ✅ | Agenda multi-profissional, visões **dia** e **semana**, impressão | A atendente usa para marcar |
| Card abre "chamar cliente" com busca por nome, telefone ou nome do animal | ✅ | Busca unificada (tutor / telefone / pet) na marcação e no "adicionar" | "Ou pelo telefone ou pelo nome do animal — perfeito" |
| Filtro = **filas de atendimento** por especialista (titular, volante, cada médico) | 🔧 | Fila por profissional continua para a **recepção/controle** | "É pro controle da clínica"; o médico não usa essa tela |
| Visão do médico | ✨ | Logado, o profissional vê **só a própria agenda** + ações do dia (lançar exame, evoluir, prescrever) | "Associado ao login dele: colocou login, só aparece a agenda dele"; perfil admin vê tudo |
| Configuração de agenda: criar usuário cria a agenda; regra de intervalo (ex.: 20 min); plantão por dia/horário (seg 11h–20h, sáb 8h–17h) | ✅ | Mesmo modelo, sem o bug de UI (botão "criar usuário" que não volta) | "Se você criar um usuário, automaticamente cria uma agenda pra esse cara" |
| Escala de colaboradores | ❌ | Avaliar depois; útil quando a equipe crescer | "Não sei se usa muito" |
| Integração com **Google Agenda** por profissional | ✨ | Sincronização bidirecional com o Google Calendar de cada profissional; **a empresa toda usa Google Workspace**, então a autorização pode ser feita no domínio | "Esse software não tem e a gente deve fazer" |
| **IA de atendimento faz agendamentos automáticos** | ✨ | O **agente de atendimento já implementado** na Alchemypet passa a marcar/remarcar dentro das regras e da agenda Google | "A gente tem total controle de pedir pra IA fazer os agendamentos automáticos" |

### 3.3 Vendas, orçamento e tabela de preço

| Funcionalidade atual | Decisão | Como fica | Observações da reunião |
|---|---|---|---|
| **Ponto de venda (PDV)** e multi-loja | ❌ | Fora da Fase 1 | "A gente quer fazer gestão, não vamos fazer venda agora"; PDV/multi-loja é para pet shop com várias lojas |
| Lista de vendas, consulta de vendas, minhas vendas, resumo total produto/serviço, vendas em PDF | 🔧 | **Um único painel de vendas** (ver §3.5) | "Tá repetindo"; o PDF atual "não tem nem o nome do produto" |
| Clientes que mais compram (rank), vendas por turno (produto + serviço) | ✅ | Indicadores dentro do painel único | "Isso aqui parece ser interessante" |
| Pacotes vendidos | 🔧 | Indicador no painel; **pacote** vira entidade do catálogo | |
| Lista de recebimento | ↪️ | Financeiro (contas a receber) | "Não tem nada a ver" com vendas |
| Lista / tabela de preço | ✅ | **Um lugar só**, junto ao catálogo unificado (§3.7) | "Tabela de preço tem que ter; lista de preço é brincadeira" |
| Saldo dos clientes (saldo devedor) | ↪️ | Financeiro (conta do cliente) | "Tem que tá no módulo financeiro, não no de vendas" |
| Modelo de orçamento (ex.: "campanha de tártaro" = pacote de serviços por R$ 3.100) | 🔧 | **Orçamento** acessível pelo cadastro do cliente (botão), montado com pacotes prontos ou itens avulsos **por código** | "Pacote é importante"; "tudo código, muito mais fácil de lidar"; orçamento fica em Vendas |
| Produtos físicos (remédio, ração, coleira) | ✅ | Módulo de produtos sim (catálogo + preço); PDV não | "Hospitais veterinários costumam ter remédio, ração, coleira — tem que ter esse módulo inteiro" |
| Configuração de vendas (fechar caixa diariamente, unificar vendas por dia) | ✅ | Regras do processo de venda em Configurações | "Tem coisas necessárias" |
| Comissão de pet shop / venda online | ❌ | Fora | |

### 3.4 Comissionamento

| Funcionalidade atual | Decisão | Como fica | Observações da reunião |
|---|---|---|---|
| Percentual de comissão por produto, calculado automaticamente por venda | ✅ | Regra de comissão por **profissional × item**, nos **dois modelos: percentual e valor fixo** (confirmado em §9) | "Ela tem uma porcentagem de cada produto, aí automaticamente ele calcula" |
| Especialista com valor combinado (ex.: cobra R$ 150; a Alchemypet cobra R$ 300 do cliente) | ✨ | O atendimento marcado como **realizado** pelo profissional gera a comissão a pagar | "Desde que o Jorge, na área dele, indique que fez o atendimento" |
| Comissão em aberto por profissional (venda, código, cliente, base, %, comissão) | 🔧 | **Visão individual**: o que fez no mês, quanto pagar, marcar como pago | "Entrei no do Jorge: o que ele fez no mês, quanto pagar, pago, beleza" |
| Consolidado de comissões a pagar | ✨ | **Lista única** com todos os profissionais e o total de cada um; gera as contas a pagar (§3.9) | "Senão eu tenho que ficar entrando médico por médico" |
| Extratos por dia (mostrando desde 2024) | 🔧 | Extrato por período, **período atual por padrão** | "Fica um negócio monstruoso" |
| Minhas comissões | 🔧 | Vira a visão do profissional logado | |

### 3.5 Painel de inteligência (produtividade + vendas)

| Funcionalidade atual | Decisão | Como fica | Observações da reunião |
|---|---|---|---|
| Produtividade por colaborador: clientes atendidos, % do período, nº de vendas, bruto, descontos, líquido, ticket médio, comissão | ✅ | **Painel gerencial** — "é o resumo" | "A tela mais útil até agora" |
| Setores misturados com pessoas (hotel, "vetro cuidar" listados como colaborador) | ✨ | Produtividade **por colaborador** e **por setor**. Setores da Fase 1 (confirmados em §9): **internação, farmácia, especialistas e hotel** | "Tinha que ser por colaborador… pode ser por setor: internação, farmácia, especialista" |
| Vendas: produto/serviço mais vendido, venda por grupo (repetido de Vendas) | 🔧 | Uma vez só, no mesmo painel | "Isso já tava lá naquele outro" |
| Abrir uma tela nova a cada clique | ❌ | Navegação única | "Fica um monte de tela aberta" |

> Valor real desse painel depende de alguém acompanhar metas. Para o veterinário, o que importa
> é ter **um lugar** com tudo consolidado.

### 3.6 Vacinação → Lembretes

| Funcionalidade atual | Decisão | Como fica | Observações da reunião |
|---|---|---|---|
| Histórico de vacinas por paciente, próxima dose, vacinas vencidas | ✅ | No **prontuário** do paciente (histórico + programação) | |
| Lista geral de vacinas vencidas | 🔧 | Vira o módulo **Lembretes** | "Esse módulo teria que ser o modo de lembrete" |
| Ícone de telefone que só mostra o número | ❌ | Ação real: **enviar WhatsApp** ao tutor | "Tem um botão na tela que não faz nada" |
| Lembrete de vacina, aniversário do pet, outros | ✨ | Botão "enviar WhatsApp" + envio **automático** configurável; disparo pelo **agente de atendimento já existente**; registro do envio | "Tem que mandar os aniversários, mandar o presentinho, alguma coisa tem que fazer" |
| Menu "Consultas" (= consultar) | ❌ | Nomenclatura descartada | "Tá confuso" |

### 3.7 Cadastros e catálogos

| Funcionalidade atual | Decisão | Como fica | Observações da reunião |
|---|---|---|---|
| Espécie (canina, felino, exótico, roedor) com gráfico de animais ativos por ciclo de vida (7.728 cadastrados, 58% ativos) | ✅ | Categorias + indicador de ativos (vivos) | "Ativos se chama o que tá vivo" |
| Raça | ✅ | **Aproveitar a base que a Alchemypet já tem** (integração com o sistema atual/CRM); no cadastro, espécie → raças | "Melhor pegar da Alchemypet, como a gente vai integrar, já faz direto de lá" |
| Pelagem | ✅ | Poucas entradas; copiar do software atual | "Isso eu não tenho, mas não são muitas" |
| Patologia | 🔧 | Refazer: **base própria** levantada com IA (Rodrigo) + conhecimento Alchemypet (confirmado em §9) | "Esse aqui tá bem pobre, eu faria de outra forma" |
| Tipo de atendimento (regras: duração, clínico ou não) | ✅ | Mesmo modelo | Ícone "wi-fi"/relatório de procedimento cirúrgico: **confirmar com Ana Terra** |
| Cadastro de vacina | ✅ | Pré-carregado | "Isso já deveria tá na base" |
| Produtos, exames laboratoriais, exames de imagem, cirurgias, vacinas, medicamentos, tabela de preço — hoje espalhados | ✨ | **Catálogo unificado** de itens, cada um com **código**, tipo, grupo e preço | "Tem que tá num lugar só: produtos cadastrados, tabela de preço, exames…" |
| Modelo de receita (ex.: dor crônica → gabapentina) | ✅ | Editor de modelos melhor que o atual ("pequenininho") | "Aqui tá bonitinho" |
| Tela "Origem dos clientes" (campanhas) | ❌ tela / ↪️ campo | Campo no cadastro do cliente (Google, indicação, passando na porta…) + relatório | "Informação importante, mas não desse jeito" |
| Modelo de documento (contrato de cirurgia etc.) | ✅ | Biblioteca de **documentos**; reescrever os modelos atuais | "Vou chupinhar esse trem todo e reescrever" |

### 3.8 Internação e prontuário eletrônico

| Funcionalidade atual | Decisão | Como fica | Observações da reunião |
|---|---|---|---|
| Cards dos animais internados | ✅ | Card já mostra o **próximo procedimento** sem precisar entrar | "Podia tá o próximo procedimento, só pro cara saber" |
| Ficha de internação | ✅ | É o **prontuário eletrônico** — o mesmo do paciente ambulatorial | "Aqui deveria ter o nome prontuário eletrônico de cada paciente" |
| Botões: relatório médico, comunicado, peso, prescrição, parâmetros clínicos | 🔧 | Menos botões, **linha do tempo única** | "Botão, botão, botão… tem que ser mais simples" |
| Fluxo admissão → internação → evolução | ✅ | Timeline do paciente | "Aí vai evoluindo" |
| Prescrição médica | ✅ | Adicionar prescrição na timeline | |
| Procedimentos | ✅ | Entram na timeline | |
| Alta / óbito (com veterinário responsável) | ✅ + ✨ | Ao dar alta, **gera a cobrança automaticamente** → Faturamento/Financeiro | "Quando for dar alta tem que gerar a cobrança de alta automático" |
| **Mapa de execução**: tarefas por horário (aplicar medicação, dar comprimido), marcar realizado (muda de cor), ocorrências | ✅ | Integrado na **mesma tela** dos internados | "Nem precisava tá separado" |
| Painel de TV da internação | ✨ | Tela consolidada estilo painel de produção (referência: painel de entrada/saída feito para a Estocel) | "Vou colocar uma TV na internação" |
| Tablet por baia | ✨ | Visão por paciente com só o que é daquele pet | "Isso aí é inovador, evita erro" |
| Faturamento por ação executada | ✨ | Aplicou a medicação → item vai para a fatura, consolidando a conta final | "Cada ação dessa que o cara faz, puf, já cobra" |
| Histórico de internação (resumo do período) | ✅ | Mantém | "Geralmente tem uma pessoa responsável por esse setor" |
| Parâmetros clínicos (valores pré-definidos: temperatura, hipertérmico/hipotérmico…) | ✅ | Mantém | |
| Modelo de prescrição (pré-prontos) | ✅ | Mantém + **migração** dos modelos existentes | "Gerar um padrão pra subir o que você já tem aí" |

### 3.9 Financeiro

Não foi percorrido na reunião; mapeado a partir do **print do menu** e das decisões de
reorganização (saldo do cliente, recebimentos e comissões vêm para cá). Detalhar tela a tela na
próxima reunião.

| Funcionalidade atual (menu) | Decisão | Como fica | Observações |
|---|---|---|---|
| Contas a pagar | ✅ | Lançamento, vencimento, baixa, fornecedor, categoria/centro de custo | Recebe automaticamente as **comissões a pagar** (§3.4) |
| Lote de contas a pagar | ✅ | Baixa/pagamento em lote | |
| Tabela de custos | ✅ | Custo por item do catálogo (base para margem e DRE) | Ligada ao catálogo unificado (§3.7) |
| DRE | ✅ | Demonstrativo por período (receitas por grupo, custos, comissões, despesas) | |
| Fluxo de caixa | ✅ | Realizado + previsto (contas a pagar/receber por vencimento) | |
| Contas a receber / conta do cliente / saldo devedor | ↪️ | Vem de Vendas: saldo por cliente, recebimentos, baixa | "Tem que tá no módulo financeiro" |
| Lista de recebimento | ↪️ | Vem de Vendas | |

### 3.10 Faturamento

Idem: mapeado a partir do **print do menu**. No contexto de laboratório, o faturamento tende a
ser por **clínica/convênio e por período** (guias e exames agrupados em lote) — a confirmar.

| Funcionalidade atual (menu) | Decisão | Como fica | Observações |
|---|---|---|---|
| Faturar | ✅ | Gera fatura a partir de vendas, atendimentos, altas e ações de internação ainda não faturados | Recebe a **cobrança de alta** e o **faturamento por ação** (§3.8) |
| Faturas | ✅ | Lista/consulta por cliente, clínica, período e status; emissão em PDF; baixa → contas a receber | |
| Lote de faturas | ✅ | Fechamento periódico por clínica/convênio (várias guias numa fatura) | Encaixe com as pendências de convênio já em produção neste repositório |

### 3.11 Exames, resultados e interfaceamento com equipamentos

Acrescentado ao orçamento. Cobre a ligação dos analisadores do laboratório ao sistema:

| Equipamento | Tipo | Comunicação (a confirmar no manual/instalação) | Sentido |
|---|---|---|---|
| **Beckman Coulter AU480** | Analisador bioquímico | Protocolo **ASTM** (E1381/E1394), via serial RS-232 ou Ethernet TCP/IP | **Bidirecional**: recebe a lista de trabalho (consulta por código de barras da amostra) e envia resultados |
| **Beckman Coulter Ac·T 10** | Analisador hematológico (hemograma) | Saída **serial RS-232**, transmissão de resultados | **Unidirecional** (equipamento → sistema); a amostra é identificada pelo ID informado no aparelho |

Para o resultado de um equipamento ter onde cair, é preciso existir o **pedido de exame** e a
**amostra** no sistema (E16), pré-requisito do interfaceamento (E17). Por decisão de
2026-09-02, o **LIS completo** também entra no orçamento como E21 — controle de qualidade,
lotes de reagente e laudo com imagem —, fechando o laboratório de ponta a ponta.

| Funcionalidade | Decisão | Como fica |
|---|---|---|
| Pedido de exame (guia) | ✨ | Vinculado a paciente, clínica solicitante e itens do catálogo (exames lab); nasce do atendimento, do portal/agente ou do lote da clínica |
| Amostra e etiqueta | ✨ | Código de barras por amostra; mapa de trabalho do dia por setor (bioquímica, hematologia) |
| Entrada de resultado | ✨ | Manual e **automática via interface**; valores de referência **por espécie**; sinalização de fora de faixa e de repetição |
| Validação e liberação | ✨ | Conferência técnica antes de liberar (**human-in-the-loop**); auditoria de quem liberou |
| Laudo | ✨ | PDF com identidade Alchemypet; disponibilizado no portal, por e-mail e pelo agente (§3.14) |
| Gateway de interfaceamento | ✨ | Serviço on-premise (mini-PC junto aos aparelhos, conversor serial) que fala ASTM/serial com os equipamentos e entrega ao backend por API/fila; monitor de conexão e reprocessamento |
| Driver AU480 | ✨ | Lista de trabalho por código de barras + recepção de resultados; mapeamento de códigos de analito → exames do catálogo |
| Driver Ac·T 10 | ✨ | Recepção dos parâmetros do hemograma; vínculo à amostra pelo ID; tela de "resultados sem vínculo" para resolver divergências |
| **Controle de qualidade** | ✨ | CQ interno por analito, nível e lote; carta de Levey-Jennings e regras de Westgard; liberação bloqueada com o CQ fora de controle |
| **Lotes de reagente** | ✨ | Cadastro com validade, rastreio do lote usado em cada resultado e consumo por exame |
| **Laudo com imagem** | ✨ | Imagem anexada ao laudo com legenda (citologia, microscopia, diagnóstico por imagem), no PDF e no portal |

### 3.12 CRM

Acrescentado ao orçamento. O escopo geral previa *integrar* um CRM já em produção; como o
pedido é um **módulo CRM** no produto, a premissa passa a ser **construir** (se for só integrar,
o esforço cai para 2–3 dev-wk).

| Funcionalidade | Decisão | Como fica |
|---|---|---|
| Contas e contatos | ✨ | **Clínicas parceiras** (B2B) e **tutores** (B2C) com contatos, endereços, responsáveis, origem (Google, indicação, fachada…) |
| Ciclo de vida da clínica | ✨ | Funil: prospecção → ativa → inativa/churn; motivo; responsável comercial |
| Histórico unificado | ✨ | Linha do tempo por conta: conversas (Chatwoot), chamados por e-mail (módulo existente), pendências de convênio/triagem (módulo existente), pedidos, faturas |
| Tarefas e follow-up | ✨ | Tarefas com prazo e responsável; lembretes de retorno; fila do comercial |
| Segmentação e campanhas | ✨ | Listas por critério (espécie, região, inatividade, aniversário); disparo pelo agente (§3.14) com opt-out |
| Indicadores | ✨ | Clínicas ativas, novas, em risco; frequência de pedidos; origem dos clientes (relatório pedido na reunião) |

### 3.13 Rastreio e Logística

Acrescentado ao orçamento (o escopo geral já marcava Logística como "construir do zero").

| Funcionalidade | Decisão | Como fica |
|---|---|---|
| Rastreio da amostra | ✨ | Cadeia de custódia por código de barras: coletada na clínica → retirada → em trânsito → recebida no lab → triagem → em análise → liberada; hora e responsável em cada etapa |
| Alertas | ✨ | Tempo máximo por etapa e por tipo de amostra; atraso ou amostra inadequada viram ocorrência e aviso à clínica pelo agente |
| Rotas de coleta | ✨ | Agenda de coletas por clínica/região, coletores (motoboys), roteiro do dia, ocorrências |
| Tela do coletor (celular) | ✨ | PWA: roteiro, check-in por QR na clínica, leitura das etiquetas, registro de ocorrência |
| Entregas e envios | ✨ | Rastreio de itens enviados (laudos impressos, kits, materiais) |
| Pedido de suprimentos | ✨ | Clínica pede kits/tubos pelo portal ou pelo agente; separação, envio e rastreio |
| Painel de logística | ✨ | Coletas do dia, amostras por etapa, atrasos, ocorrências |

### 3.14 Agente de atendimento com Chatwoot

Acrescentado ao orçamento. O **Chatwoot** (open source, self-hosted) vira a caixa de entrada
omnichannel oficial; o agente de IA entra como *bot* dele. Se o agente já existente rodar sobre
Chatwoot, esta linha cobre a **evolução** dele e as integrações com os módulos deste documento.

| Funcionalidade | Decisão | Como fica |
|---|---|---|
| Canais | ✨ | WhatsApp (API oficial), Instagram/Facebook, e-mail, chat no portal — tudo numa inbox |
| Agente de IA (Claude) | ✨ | Conectado ao Chatwoot como *agent bot* (webhooks/API); base de conhecimento (RAG) de exames, preparo, coleta e prazos |
| Ferramentas do agente | ✨ | Status do exame e envio do laudo (E16), agendar/remarcar (E4/E13), lembretes (E8), abrir chamado, consultar pendência de convênio (módulo existente), pedido de suprimentos (E19) |
| Transbordo humano | ✨ | Handoff com contexto para a equipe certa (atendimento, comercial, técnico); horários; filas |
| Chamados por e-mail | ↪️ | A caixa de chamados hoje lida via Gmail passa a entrar pela inbox de e-mail do Chatwoot, mantendo a classificação já feita neste repositório |
| CRM | ↪️ | Toda conversa fica na linha do tempo da conta (§3.12) |
| Métricas | ✨ | Tempo de resposta, taxa de resolução pela IA, transbordos, satisfação |
| Ações sensíveis | ✨ | Confirmação humana para liberar laudo, alterar faturamento ou cancelar pedido |

---

## 4. Escopo consolidado da Fase 1 (épicos)

| # | Épico | O que entra | Depende de |
|---|---|---|---|
| E1 | **Fundação do produto** | Perfis (admin, recepção, veterinário, setor), shell/navegação, configurações gerais (setores, tipos de atendimento), códigos de item | Auth já existente no repositório |
| E2 | **Clientes & Pacientes** | Cadastro de tutor e pet (definido na reunião anterior), origem do cliente, busca unificada, ficha do paciente | — |
| E3 | **Catálogos** | Espécie/raça (base existente da Alchemypet), pelagem, patologias (base própria, carga assistida por IA), vacinas, catálogo unificado (produtos, exames lab/imagem, cirurgias, medicamentos) com tabela de preço, custo e pacotes | Acesso à base atual |
| E4 | **Agenda** | Multi-profissional, dia/semana, regras (intervalo, plantão), marcação com busca, filas por especialista, visão do profissional logado, impressão | E1, E2 |
| E5 | **Vendas & Orçamento** | Registro de atendimento/venda (produto + serviço), orçamento a partir do cliente por código/pacote, tabela de preço, regras (caixa diário, unificar por dia), rank de clientes | E2, E3 |
| E6 | **Comissionamento** | Regras por profissional × item (percentual e fixo), confirmação de atendimento realizado, cálculo automático, visão individual, consolidado a pagar, marcar pago, extrato por período | E5, E11 |
| E7 | **Painel gerencial** | Produtividade por colaborador e por setor (internação, farmácia, especialistas, hotel), vendas consolidadas (grupos, mais vendidos, turno, clientes que mais compram) | E5, E6 |
| E8 | **Lembretes** | Vacinas vencidas/próximas, aniversários; envio WhatsApp manual e automático pelo agente; registro | E20 |
| E9 | **Prontuário & Internação** | Timeline, admissão, evolução, prescrição, procedimentos, parâmetros clínicos, alta/óbito, histórico, mapa de execução, faturamento por ação | E2, E3, E14 |
| E10 | **Modelos & Documentos** | Modelos de receita, prescrição e documentos/contratos; geração em PDF | E3 |
| E11 | **Financeiro** | Contas a pagar (+ lote), tabela de custos, DRE, fluxo de caixa, contas a receber / conta do cliente / saldo devedor, recebimentos | E3, E14 |
| E12 | **Migração** | Importador da base atual (clientes, pacientes, catálogo, histórico, modelos), idempotente; os dados já estão disponíveis | Acesso à base atual |
| E13 | **Google Agenda** | Sincronização da agenda de cada profissional com o Google Calendar (Google Workspace) | Credenciais do Workspace |
| E14 | **Faturamento** | Faturar (vendas, altas, ações de internação), faturas (consulta, PDF, baixa), lote de faturas por clínica/convênio | E5, E9 |
| E15 | **Painel de TV + tablet por baia** (opcional) | Visão consolidada da internação em TV e visão por paciente em tablet | E9 |
| E16 | **Exames & Resultados** | Pedido de exame, amostra/etiqueta, mapa de trabalho, entrada de resultado, referência por espécie, validação/liberação, laudo PDF | E2, E3 |
| E17 | **Interfaceamento com equipamentos** | Gateway on-premise, driver ASTM do AU480 (bidirecional), driver serial do Ac·T 10, mapeamento de analitos, resultados sem vínculo, monitoramento | E16; acesso físico/rede aos aparelhos |
| E18 | **CRM** | Contas (clínicas e tutores), ciclo de vida, histórico unificado, tarefas/follow-up, segmentação e campanhas, indicadores | E2, E20 |
| E19 | **Rastreio & Logística** | Cadeia de custódia da amostra, alertas, rotas de coleta, tela do coletor (PWA), entregas, pedido de suprimentos, painel | E16 |
| E20 | **Agente de atendimento (Chatwoot)** | Chatwoot self-hosted com canais, agente IA como bot com ferramentas (exames, agenda, lembretes, chamados, convênio, suprimentos), transbordo humano, migração dos chamados por e-mail, métricas | Canais (WhatsApp API); E4, E16 |
| E21 | **LIS completo** | Controle de qualidade (Levey-Jennings, Westgard), lotes de reagente com validade e rastreio, laudo com imagem, auditoria de liberação | E16 |

### 4.1 Proposta de navegação (menu)

Proposta derivada das reclamações de organização e dos prints; a validar com as telas.

- **Início** — painel de controle do dia
- **Agenda** — dia / semana / minha agenda
- **Clientes & Pacientes** — cadastro, busca, ficha do paciente, prontuário
- **Internação** — internados, mapa de execução, painel de TV
- **Exames** — pedidos, amostras e mapa de trabalho, resultados (manual e dos equipamentos), liberação, laudos
- **Logística** — coletas do dia, rotas, rastreio de amostras, envios, pedidos de suprimentos
- **Atendimento** — inbox Chatwoot (WhatsApp, Instagram, e-mail, chat), transbordos, métricas do agente
- **CRM** — clínicas e tutores, funil, histórico, tarefas, campanhas
- **Vendas** — orçamentos, vendas, pacotes, tabela de preço
- **Faturamento** — faturar, faturas, lotes
- **Financeiro** — contas a pagar (+ lotes), contas a receber / conta do cliente, tabela de custos, fluxo de caixa, DRE, comissões (individual + consolidado)
- **Painel gerencial** — produtividade por colaborador/setor, vendas consolidadas
- **Lembretes** — vacinas, aniversários, envios
- **Catálogos** — espécies/raças, pelagens, patologias, tipos de atendimento, itens (produtos, exames, cirurgias, vacinas, medicamentos)
- **Modelos & Documentos** — receitas, prescrições, contratos
- **Configurações** — usuários/perfis, agendas e plantões, regras de venda, setores, integrações

---

## 5. Fora do escopo da Fase 1

- **Ponto de venda (PDV)**, multi-loja e distribuição de estoque entre lojas.
- Relatórios redundantes de vendas (lista, consulta, minhas vendas, resumo total, PDF atual).
- Tela de "origem dos clientes" e o menu "Consultas".
- **Escala de colaboradores** (reavaliar quando a equipe crescer).
- Comissão de pet shop / venda online.
- **Hotel como módulo** (reservas, diárias): na Fase 1 o hotel entra apenas como **setor** para
  produtividade e classificação de itens.
- Módulos ainda **não percorridos** na reunião: **Estoque** e **Relatórios** (aparecem no menu)
  e configurações restantes — entram no mapeamento na próxima reunião.
- **Outros equipamentos** além do AU480 e do Ac·T 10: cada aparelho novo é um driver à parte.

---

## 6. Modelo de dados essencial

Entidades mínimas para sustentar os épicos acima. Os catálogos vêm da base já existente da
Alchemypet (espécie/raça) e são parametrizáveis por instância white-label (itens, preços, modelos).

```mermaid
erDiagram
  USUARIO ||--o| PROFISSIONAL : "login de"
  PROFISSIONAL ||--|| AGENDA : possui
  AGENDA ||--o{ REGRA_AGENDA : "intervalo / plantao"
  AGENDA ||--o{ AGENDAMENTO : contem
  CLIENTE ||--o{ PACIENTE : "tutor de"
  ESPECIE ||--o{ RACA : possui
  RACA ||--o{ PACIENTE : classifica
  PACIENTE ||--o{ AGENDAMENTO : marcado
  PACIENTE ||--o{ REGISTRO_PRONTUARIO : "linha do tempo"
  PACIENTE ||--o{ VACINA_APLICADA : historico
  PACIENTE ||--o{ INTERNACAO : tem
  PACIENTE ||--o{ LEMBRETE : dispara
  ITEM_CATALOGO ||--o{ PRECO : "tabela de preco"
  ITEM_CATALOGO ||--o| CUSTO : "tabela de custos"
  PACOTE ||--o{ ITEM_PACOTE : agrupa
  ITEM_CATALOGO ||--o{ ITEM_PACOTE : compoe
  CLIENTE ||--o{ ORCAMENTO : recebe
  ORCAMENTO ||--o{ ITEM_ORCAMENTO : lista
  PROFISSIONAL ||--o{ ATENDIMENTO : realiza
  PACIENTE ||--o{ ATENDIMENTO : recebe
  ATENDIMENTO ||--o{ ITEM_VENDA : gera
  PROFISSIONAL ||--o{ REGRA_COMISSAO : tem
  ITEM_VENDA ||--o| COMISSAO : gera
  COMISSAO ||--o| CONTA_PAGAR : "vira"
  INTERNACAO ||--o{ PRESCRICAO : possui
  PRESCRICAO ||--o{ TAREFA_EXECUCAO : "mapa de execucao"
  TAREFA_EXECUCAO ||--o| ITEM_VENDA : "fatura ao executar"
  INTERNACAO ||--o| ALTA : encerra
  FATURA ||--o{ ITEM_VENDA : consolida
  CLIENTE ||--o{ FATURA : deve
  LOTE_FATURA ||--o{ FATURA : agrupa
  FATURA ||--o{ RECEBIMENTO : baixa
  FORNECEDOR ||--o{ CONTA_PAGAR : emite
  MODELO ||--o{ REGISTRO_PRONTUARIO : "receita / documento / prescricao"
  CLINICA ||--o{ PEDIDO_EXAME : solicita
  PACIENTE ||--o{ PEDIDO_EXAME : tem
  PEDIDO_EXAME ||--o{ AMOSTRA : gera
  AMOSTRA ||--o{ EVENTO_CUSTODIA : "rastreio"
  AMOSTRA ||--o{ RESULTADO : produz
  EQUIPAMENTO ||--o{ RESULTADO : envia
  ITEM_CATALOGO ||--o{ RESULTADO : "exame / analito"
  PEDIDO_EXAME ||--o| LAUDO : libera
  ROTA_COLETA ||--o{ PARADA_COLETA : "roteiro do dia"
  CLINICA ||--o{ PARADA_COLETA : visitada
  CLINICA ||--o{ PEDIDO_SUPRIMENTO : pede
  CLINICA ||--o{ CONVERSA : "chatwoot"
  CLIENTE ||--o{ CONVERSA : "chatwoot"
  CLINICA ||--o{ TAREFA_CRM : "follow-up"

  ITEM_CATALOGO {
    int codigo
    string tipo "produto|servico|exame_lab|exame_imagem|cirurgia|vacina|medicamento"
    string nome
    string grupo
    string setor "internacao|farmacia|especialistas|hotel"
  }
  REGRA_COMISSAO {
    string tipo "percentual|fixo"
    decimal valor
    string escopo "item|grupo|todos"
    bool exige_confirmacao
  }
  REGRA_AGENDA {
    int intervalo_min
    string dia_semana
    time inicio
    time fim
  }
  TAREFA_EXECUCAO {
    datetime programado
    datetime realizado
    string status "pendente|realizado|ocorrencia"
    string executor
  }
  LEMBRETE {
    string tipo "vacina|aniversario|retorno"
    date data_alvo
    string canal "whatsapp"
    datetime enviado_em
  }
  FATURA {
    string origem "venda|alta|internacao|lote"
    date emissao
    date vencimento
    string status "aberta|paga|cancelada"
  }
  CONTA_PAGAR {
    string origem "comissao|fornecedor|despesa"
    date vencimento
    string categoria
    datetime pago_em
  }
  CLIENTE {
    string nome
    string telefone
    string origem "google|indicacao|fachada|outro"
  }
  CLINICA {
    string nome
    string estagio "prospeccao|ativa|inativa"
    string responsavel_comercial
  }
  AMOSTRA {
    string codigo_barras
    string tipo
    string etapa "coletada|retirada|transito|recebida|triagem|analise|liberada"
  }
  EQUIPAMENTO {
    string modelo "AU480|AcT10"
    string protocolo "ASTM|serial"
    string sentido "bidirecional|unidirecional"
  }
  RESULTADO {
    decimal valor
    string unidade
    string flag "normal|baixo|alto|repetir"
    string origem "manual|interface"
    datetime validado_em
  }
  CONVERSA {
    string canal "whatsapp|instagram|email|chat"
    string status "bot|humano|resolvida"
    string chatwoot_id
  }
```

---

## 7. Diferenciais em relação ao software atual

O que **não existe** hoje e justifica a recriação (além da UI limpa):

1. **Visão por login** — cada profissional entra e vê só a própria agenda e as próprias ações.
2. **Google Agenda por profissional** (Workspace) e o **agente de atendimento existente agendando**
   dentro das regras.
3. **Lembretes ativos** por WhatsApp (vacina vencida, aniversário) — hoje a tela só mostra.
4. **Orçamento por código e por pacote**, direto do cadastro do cliente.
5. **Comissão consolidada** (todos os profissionais numa lista) + individual com "pago", já
   virando conta a pagar.
6. **Painel gerencial único** — produtividade por colaborador **e por setor**, vendas consolidadas.
7. **Internação viva** — mapa de execução na mesma tela, **painel de TV** consolidado e
   **tablet por baia**; cada ação executada **fatura na hora**; alta gera cobrança.
8. **Financeiro e faturamento ligados à operação** — venda, alta, internação e comissão
   alimentam faturas, contas a receber, contas a pagar, fluxo de caixa e DRE sem redigitação.
9. **Catálogos pré-carregados** — raças da base atual, patologias levantadas com IA, vacinas e
   medicamentos em base própria.
10. **Migração** da base atual, que já está disponível.
11. **Resultados direto dos analisadores** (AU480 e Ac·T 10) — sem digitação, com validação humana
    antes de liberar.
12. **CRM com histórico unificado** — conversa, chamado, pendência, pedido e fatura na mesma linha
    do tempo da clínica.
13. **Amostra rastreada de ponta a ponta**, com rota de coleta e tela do coletor.
14. **Atendimento omnichannel com IA** sobre Chatwoot, com transbordo humano e ferramentas ligadas
    aos módulos.

---

## 8. Estimativa de esforço (base para o orçamento)

Estimativa preliminar em **semanas-desenvolvedor (dev-wk)**, mesma unidade dos demais docs
do repositório. Faixas incluem a incerteza que os prints e a próxima reunião vão reduzir.

| # | Épico | dev-wk |
|---|---|---|
| E1 | Fundação do produto | 2–3 |
| E2 | Clientes & Pacientes | 3–4 |
| E3 | Catálogos (inclui espécie/raça da base existente) | 3–5 |
| E4 | Agenda | 4–6 |
| E5 | Vendas & Orçamento | 4–6 |
| E6 | Comissionamento | 2–3 |
| E7 | Painel gerencial | 2–3 |
| E8 | Lembretes | 2–3 |
| E9 | Prontuário & Internação | 6–9 |
| E10 | Modelos & Documentos | 2–3 |
| E11 | Financeiro (*) | 5–8 |
| E12 | Migração | 2–3 |
| E13 | Google Agenda | 2–3 |
| E14 | Faturamento (*) | 3–5 |
| | **Bloco A — Gestão (E1–E14)** | **42–64** |
| E16 | Exames & Resultados | 4–6 |
| E17 | Interfaceamento AU480 + Ac·T 10 (***) | 6–10 |
| E18 | CRM (****) | 4–7 |
| E19 | Rastreio & Logística | 5–8 |
| E20 | Agente de atendimento (Chatwoot) | 6–10 |
| E21 | LIS completo: CQ, lotes de reagente, laudo com imagem (**) | 5–8 |
| | **Bloco B — Laboratório, CRM, Logística e Atendimento (E16–E21)** | **30–49** |
| | **Subtotal Fase 1 (A + B)** | **72–113** |
| E15 | Painel de TV + tablet por baia (opcional) | 2–3 |
| | **Total com o opcional** | **74–116** |

(*) Financeiro e Faturamento foram mapeados pelos menus, não tela a tela; as faixas assumem o
conjunto listado em §3.9 e §3.10 e devem ser revistas após o walkthrough desses módulos.
(**) Substitui o LIS que o escopo geral previa à parte; não há dupla contagem com E16.
(***) Dentro da faixa: gateway on-premise 2–3, driver AU480 3–5, driver Ac·T 10 1–2. Assume
protocolo ASTM no AU480 e saída serial no Ac·T 10; confirmar nos manuais e na instalação.
Hardware do gateway (mini-PC e conversor serial) não incluído.
(****) Se a decisão voltar a ser **integrar** o CRM existente em vez de construir, cai para 2–3.

### 8.1 Premissas da estimativa

- Reaproveita a stack já em produção neste repositório (FastAPI + Next.js + PostgreSQL) e a
  autenticação/perfis existentes; nenhuma tecnologia nova.
- A empresa inteira usa **Google Workspace**: a integração de agenda usa autorização no domínio,
  sem fluxo individual por profissional.
- O agente de atendimento passa a rodar sobre **Chatwoot self-hosted** (E20); se o agente já
  existente estiver nessa base, E20 cobre sua evolução e as ferramentas ligadas aos módulos.
- Os analisadores ficam acessíveis por serial ou rede a partir de um **gateway on-premise** no
  laboratório; a saída por equipamento será validada com amostras reais antes da liberação.
- **Os dados atuais estão disponíveis** para a migração; o importador é próprio.
- Inclui implementação da UI, mas não um trabalho de design visual separado — os wireframes
  das telas principais serão apresentados na próxima reunião.
- Estimativa de **esforço**, não de prazo; o prazo depende do tamanho da equipe alocada.
- Uma instância por cliente (white-label), sem multi-unidade dentro da mesma instância.

### 8.2 Custos recorrentes a considerar no orçamento

Hospedagem por instância (app + Postgres + storage), hospedagem do **Chatwoot** (self-hosted,
sem licença), conversas da **API oficial do WhatsApp** (cobrança por conversa), tokens de IA
(agente, lembretes, agendamento, carga de patologias), APIs Google (Calendar, sem custo
adicional no Workspace) e o **hardware do gateway** de interfaceamento (mini-PC + conversores
serial, custo único).

### 8.3 Faseamento em contrato de 24 meses

O orçamento será apresentado como **contrato de 24 meses**. Proposta de distribuição do escopo
(sem valores; esforço em dev-wk, capacidade de referência: 1 dev ≈ 4,3 dev-wk/mês):

| Período | Onda | Épicos | Esforço | Resultado para a Alchemypet |
|---|---|---|---|---|
| Meses 1–3 | **1 — Base e agenda** | E1, E2, E3, E4, E13 | 14–21 | Cadastros, catálogos e agenda (com Google Agenda) no ar; recepção já opera no novo sistema |
| Meses 3–6 | **2 — Operação e dinheiro** | E5, E6, E7, E10, E11, E14, E12 | 20–31 | Vendas, orçamento, comissões, financeiro, faturamento e migração: **desliga o software atual** |
| Meses 6–9 | **3 — Clínica e laboratório** | E9, E16, E17, E21 | 21–33 | Prontuário e internação e o laboratório completo: resultados direto do AU480 e do Ac·T 10, CQ, lotes de reagente e laudo com imagem |
| Meses 9–12 | **4 — Relacionamento e logística** | E20, E18, E19, E8, E15 | 17–28 | Chatwoot com agente de IA, CRM, rastreio de amostras e rotas, lembretes por WhatsApp e painel de TV da internação |
| Meses 13–24 | **Sustentação e evolução** | Estoque, Relatórios, hotel, novos equipamentos, empacotamento white-label | banco de horas | Ajustes de uso, evoluções priorizadas com a diretoria, operação assistida |

No limite superior das faixas, a onda 4 pode avançar para os meses 13–14; a sustentação absorve.

**Dois modelos de alocação para o mesmo contrato:**

| Modelo | Alocação | Efeito |
|---|---|---|
| A — linear | 1 dev em tempo integral por 24 meses (≈ 100 dev-wk) | Cobre o escopo, mas as ondas 3 e 4 só ficam prontas perto do fim do contrato |
| **B — concentrado (recomendado)** | 2 devs nos meses 1–12 (≈ 100 dev-wk) + 0,5 a 1 dev nos meses 13–24 | Software atual desligado em ~6 meses; laboratório, CRM e logística no primeiro ano; segundo ano para estabilizar e evoluir |

**Composição sugerida do contrato (24 meses):**

1. **Desenvolvimento da Fase 1** (ondas 1–4): esforço de §8, com aceite por onda.
2. **Sustentação e evolução** (meses 13–24): alocação parcial ou banco de horas mensal, com
   backlog priorizado pela diretoria.
3. **Operação recorrente** durante os 24 meses: itens de §8.2 (hospedagem, Chatwoot, WhatsApp,
   tokens de IA), repassados ou embutidos na mensalidade.
4. **Custo único**: hardware do gateway de interfaceamento.
5. **Condições a definir no contrato**: parcela mensal fixa × marcos por onda, propriedade do
   código e da base white-label, SLA de suporte, garantia pós-onda, revisão de escopo a cada
   onda com as pendências de §9.1.

---

## 9. Premissas fechadas e pendências

Respostas dadas em 2026-09-02 às perguntas em aberto da primeira versão deste documento.

| # | Pergunta | Resposta | Efeito no escopo |
|---|---|---|---|
| 1 | Financeiro: ERP externo ou nosso módulo? | **Financeiro e Faturamento devem ser previstos** (prints dos menus) | E11 passa de "mínimo" para módulo completo; entra E14 |
| 2 | Comissão: percentual, fixo ou os dois? | **Os dois modelos** | Já contemplado em E6 e no modelo de dados |
| 3 | Setores | **Seguir a lista da reunião**: internação, farmácia, especialistas, hotel | Hotel só como setor; módulo de hotel fora |
| 4 | IA de atendimento / WhatsApp | **Já existe um agente de atendimento implementado** | E13 vira integração; sem custo novo de canal |
| 5 | Google Workspace | **A empresa toda usa** | Google Agenda entra na Fase 1 (E13) |
| 6 | Ícone "wi-fi" no tipo de atendimento | ok — confirmar com Ana Terra | Sem efeito no orçamento |
| 7 | Migração | **Importador próprio; todos os dados já estão disponíveis** | E12 mantido |
| 8 | Bulário/medicamentos | ok — base própria | E3 mantido |
| 9 | Campos do cadastro de clientes/pacientes | ok | Registrar os campos neste documento (pendente) |
| 10 | Home | ok — proposta de §3.1 | Sem efeito |

### 9.1 Pendências que ainda afetam o número

1. **Walkthrough de Financeiro e Faturamento** tela a tela (hoje mapeados só pelo menu).
2. **Estoque e Relatórios**: decidir se entram na Fase 1 e mapear.
3. **Campos do cadastro de clientes/pacientes** da reunião anterior: registrar aqui.
4. **Forma de integração do agente de atendimento** (API/webhooks disponíveis) para E13.
5. **Faturamento por convênio/clínica**: confirmar o fluxo de lote e o encaixe com as pendências
   de convênio já em produção neste repositório.
6. Ícone "wi-fi" no tipo de atendimento (Ana Terra).
7. **Equipamentos**: confirmar nos manuais/instalação o protocolo e a porta de cada aparelho
   (AU480: ASTM serial ou TCP/IP; Ac·T 10: serial), se já estão ligados a algum software hoje e
   onde ficará o gateway. Um exemplo de transmissão real de cada um acelera o driver.
9. **CRM**: construir o módulo (premissa atual) ou integrar o CRM já em produção?
10. **Agente atual**: em que plataforma roda hoje e o que migra para o Chatwoot; canais a ativar
    (WhatsApp já homologado?, Instagram, e-mail).
11. **Logística**: quantidade de clínicas, coletas por dia e coletores, para dimensionar rotas.

---

## 10. Próximos passos

1. Validar este mapeamento com a equipe Alchemypet (decisões ✅ / 🔧 / ❌ por módulo).
2. Capturar os **prints de referência** do software atual (checklist em §11), agora incluindo
   Financeiro, Faturamento, Estoque e Relatórios.
3. Próxima reunião: percorrer Financeiro, Faturamento, Estoque e Relatórios e apresentar as
   primeiras telas (agenda, prontuário/internação, painel gerencial, orçamento).
4. Fechar as pendências de §9.1 e refinar as faixas de §8.
5. Montar o orçamento: esforço × custo/hora + recorrentes de §8.2.

---

## 11. Prints de referência a capturar

Telas do software atual que valem como referência para o orçamento e para o desenho das novas:

- **Agenda**: visão dia e semana; card de agendamento aberto (busca de cliente); tela de
  configuração de agenda (usuários, intervalo, plantão); escala.
- **Cadastro**: cliente/tutor e paciente (reunião anterior), lista de pacientes.
- **Vendas**: registro de uma venda; modelo de orçamento (ex.: campanha de tártaro); tabela/lista
  de preço; configuração de vendas; rank de clientes.
- **Comissão**: comissão em aberto de um profissional; extrato; resumo.
- **Painel de inteligência**: produtividade por colaborador (a tela "mais útil").
- **Vacinação**: lista de vencidas e histórico de um paciente.
- **Cadastros**: espécie (gráfico), raça, pelagem, patologia, tipo de atendimento (ícone
  "wi-fi"), vacina, modelo de receita, modelo de documento.
- **Internação**: cards de internados; ficha/prontuário com os botões; prescrição; mapa de
  execução (programado/realizado/ocorrência); tela de alta/óbito; histórico de internação;
  parâmetros clínicos; modelo de prescrição.
- **Financeiro**: contas a pagar; lote de contas a pagar; tabela de custos; DRE; fluxo de caixa.
- **Faturamento**: faturar; lista de faturas e uma fatura aberta/PDF; lote de faturas.
- **Estoque e Relatórios**: menus e telas principais (para a próxima reunião).
- **Exportação**: qualquer tela de exportação/relatório em CSV/XLSX (para dimensionar a migração).
- **Equipamentos**: tela de configuração de comunicação (host/LIS) do AU480 e do Ac·T 10, foto da
  conexão atual (cabo serial/rede) e, se houver, um exemplo de resultado transmitido.
- **CRM e atendimento atuais**: telas do CRM em produção e do agente/inbox de hoje.
