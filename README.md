# Alchemypet — Ecossistema Integrado

Ecossistema **AI-First** e **white-label** para integração de todos os departamentos da **Alchemypet**,
um laboratório de análises clínicas veterinárias.

## Visão geral
- **AI First**: agentes internos executam o máximo de processos possível.
- **White-label revendível**: deploy/instância isolada por cliente (não multitenant).
- **Entrega faseada**, começando por um MVP do core laboratorial.

## Documentação
- [Escopo para Orçamento](docs/ESCOPO-ORCAMENTO.md) — escopo, arquitetura recomendada, mapa de
  módulos, faseamento e itens em aberto para fechar o orçamento.
- [Apresentação de Orçamento (Diretoria)](apresentacao-orcamento/index.html) — apresentação visual,
  em linguagem executiva, para decisão de investimento. Abra o arquivo no navegador.
- [Gestão de Clínica — Mapeamento para Orçamento (Fase 1)](docs/GESTAO-CLINICA-MAPEAMENTO.md) —
  recriação simplificada e AI-First do software de gestão em uso hoje na Alchemypet: decisões
  módulo a módulo (Home → Internação, mais Financeiro e Faturamento), escopo da Fase 1, modelo de
  dados, estimativa de esforço, premissas fechadas e pendências.

## Módulos
- [Painel Convênio](painel-convenio/README.md) — tela de gestão das pendências de convênio.
  Importa a planilha de pendências (todas as abas mensais) e monta indicadores, gráficos,
  filtros e uma tabela operacional com gestão por registro. Abra `painel-convenio/index.html`
  no navegador.
  - [Evolução para módulo do ecossistema](docs/PAINEL-CONVENIO-MODULO.md) — arquitetura AI-First,
    modelo de dados, integração com LIS/CRM e estimativa de esforço para o orçamento.
  - **M1 (núcleo compartilhado)** — versão multiusuário com backend + banco:
    [`backend/`](backend/README.md) (FastAPI + Postgres, API e importação da planilha) e
    [`frontend/`](frontend/) (Next.js consumindo a API). Rode local com `docker compose up --build`;
    deploy no Coolify em [docs/M1-DEPLOY.md](docs/M1-DEPLOY.md).

> Projeto em fase de **discovery/escopo**. Stack e arquitetura ainda serão definidas — ver documento de escopo.
