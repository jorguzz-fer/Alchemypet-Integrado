# Alchemypet — Ecossistema Integrado AI-First
## Documento de Escopo para Orçamento

> Status: **Discovery / Escopo** — base para fundamentar o orçamento. Sem implementação nesta etapa.
> Data: 2026-06-13

---

## 1. Contexto
A **Alchemypet** é um laboratório de análises clínicas veterinárias que deseja integrar **todos os seus
departamentos** em um único ecossistema de software.

Premissas definidas pelo cliente:
- **AI First** — tudo que for possível deve ser executado por **agentes internos de IA**.
- **White-label revendível** (não multitenant) — a mesma plataforma poderá ser vendida a outros
  laboratórios/clínicas com a marca deles, em **deploy/instância isolada por cliente**.
- Entrega **faseada, começando por um MVP** de maior impacto.

O projeto é **greenfield** (repositório vazio): stack, banco e arquitetura ainda serão definidos.

---

## 2. Decisões já tomadas

| Tema | Decisão |
|---|---|
| CRM e Qualidade (já em produção) | **Integrar via API/eventos** — não reescrever |
| Modelo de produto | **White-label revendível**, deploy isolado por cliente |
| Onde a IA atua | **Todas as 4 áreas**: Atendimento/CRM, Laudos/Exames, Financeiro/Cobranças, Logística/Suprimentos |
| Stack | **Sem preferência** — equipe recomenda |
| Laboratório (resultados) | **Construir LIS/Controle Laboratorial do zero** |
| Sistemas legados | **ERP/financeiro existente** (integrar) + muito em **planilhas/manual** (substituir); **Logística não tem nada** (construir) |
| Canais dos agentes | **WhatsApp oficial + E-mail + Chat no portal** (voz fora por enquanto) |
| Entrega/orçamento | **MVP faseado** |

---

## 3. Arquitetura recomendada

### 3.1 Stack (proposta)
- **Backend**: Python (FastAPI) — melhor ecossistema para IA/agentes/dados — complementado por
  serviços Node/TypeScript onde fizer sentido (ex.: integrações em tempo real).
- **Frontend/Portais**: Next.js + React + TypeScript (portal cliente, portal veterinário, back-office).
- **Banco**: PostgreSQL (transacional) + armazenamento de objetos S3-compatível (laudos/arquivos) +
  store vetorial `pgvector` (conhecimento dos agentes).
- **Mensageria/eventos**: barramento de eventos (Redis Streams / RabbitMQ / Kafka) — essencial para
  integrar CRM/Qualidade/ERP de forma desacoplada.
- **Infra**: containers (Docker) + orquestração, com **IaC** para provisionar uma **instância nova por
  cliente white-label** de forma repetível.

> A escolha final de stack deve ser validada contra a stack atual do CRM/Qualidade (ver itens em aberto).

### 3.2 Padrão AI-First (camada de agentes)
Camada de orquestração de agentes central (modelos **Claude** como padrão):
- Agentes especializados por domínio (atendimento, laudos, financeiro, logística).
- **Tools** que dão aos agentes acesso controlado às APIs internas (LIS, financeiro, CRM).
- **Human-in-the-loop** obrigatório para ações sensíveis (liberar laudo clínico, lançar cobrança).
- Base de conhecimento (**RAG**): procedimentos, catálogo de exames, regras de negócio.
- **Trilha de auditoria** de toda ação de agente (quem/qual agente fez o quê).

### 3.3 White-label (revenda, deploy isolado)
- **Isolamento por instância** (não multitenant): cada cliente tem stack/banco próprios, provisionados via IaC.
- Camada de **branding/tema** configurável (logo, cores, domínio, textos, e-mails).
- Catálogo de exames e regras **parametrizáveis por cliente**.
- Painel de **provisionamento/onboarding** de novos clientes white-label.

### 3.4 Integração com o que já existe
- **CRM e Qualidade**: conectores via API + assinatura de eventos (sem reescrita).
- **ERP/financeiro existente**: conector de integração (lançamentos, faturamento).
- **Planilhas/manual**: substituídos pelos novos módulos nativos.

---

## 4. Mapa de módulos (construir × integrar)

| Módulo | Estratégia |
|---|---|
| CRM | **Integrar** (já em produção) |
| Qualidade | **Integrar** (já em produção) |
| Controle Laboratorial / LIS | **Construir do zero** |
| Exames | **Construir** (ligado ao LIS) |
| Acesso aos Laudos | **Construir** (portal cliente/clínica, white-label) |
| Interface para Veterinários | **Construir** (portal veterinário) |
| Financeiro | **Construir + integrar** ERP existente |
| Cobranças | **Construir** (régua + agente de cobrança) |
| Admin | **Construir** (back-office) |
| Logística | **Construir do zero** |
| Pedido de Suprimentos | **Construir** |
| Acompanhamento de Itens | **Construir** |
| Setup / Manutenção | **Construir** (provisionamento white-label) |
| Sistema Integrado / Gestão de Clínicas | **Construir** (camada de orquestração) |

---

## 5. Faseamento sugerido (MVP primeiro)

- **Fase 0 — Fundação / Discovery técnico**: arquitetura, IaC de instância white-label, barramento de
  eventos, conectores CRM/Qualidade, design system + branding, esqueleto da camada de agentes.
- **Fase 1 — MVP do core laboratorial**: LIS/Controle Laboratorial + Exames + Acesso aos Laudos
  (portal) + Interface Veterinários + 1º agente (atendimento/laudos) nos canais WhatsApp/e-mail/chat.
- **Fase 2 — Financeiro & Cobranças**: módulo financeiro + integração ERP + agente de cobrança.
- **Fase 3 — Logística & Suprimentos**: logística, pedido de suprimentos, acompanhamento de itens + agentes.
- **Fase 4 — Produto white-label**: onboarding/provisionamento self-service e empacotamento para revenda.

---

## 6. Agentes de IA por área (escopo inicial)

- **Atendimento/CRM**: triagem, status de exame, agendamento, follow-up (WhatsApp/e-mail/chat).
- **Laudos/Exames**: apoio à geração/revisão de laudos, sumarização, checagem de consistência (human-in-the-loop).
- **Financeiro/Cobranças**: conciliação, régua de cobrança, lembretes, negociação inicial.
- **Logística/Suprimentos**: previsão/ponto de pedido de insumos, rastreio de coletas/itens.

---

## 7. Itens em aberto para fechar os números do orçamento

Estas respostas afetam diretamente esforço/custo e devem ser coletadas antes do orçamento final:

1. **Volumes**: exames/mês, nº de clínicas/clientes, nº de usuários internos, nº de laudos/dia.
2. **Stack atual do CRM/Qualidade** e qual ERP/financeiro existente (nome / forma de integração / API disponível).
3. **Equipamentos de laboratório**: marcas/modelos de analisadores e se haverá integração futura (HL7/ASTM).
4. **Catálogo de exames**: quantos tipos, complexidade dos laudos, laudos com imagem?
5. **Regulatório/compliance**: LGPD, exigências do MAPA/CRMV, retenção de dados, assinatura digital de laudos.
6. **Identidade/branding** e domínios para o white-label.
7. **Faixa de orçamento e prazo-alvo** do MVP (Fase 1).
8. **Equipe/responsáveis** do lado Alchemypet (PO, TI, acesso aos sistemas atuais).
9. **WhatsApp**: já há conta Business API / BSP (provedor) definido?

---

## 8. Próximos passos

1. Revisar e aprovar este escopo e o faseamento.
2. Coletar as respostas dos **itens em aberto** (ideal: uma chamada de discovery).
3. Produzir o **orçamento detalhado por fase** (esforço, equipe, prazo, infra e custos recorrentes de IA
   e hospedagem por instância white-label).
4. Definir formalmente a **stack** após confirmar a stack atual do CRM/Qualidade/ERP.
