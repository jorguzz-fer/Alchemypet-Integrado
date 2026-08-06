# Integração Gmail → Chamados (automação de leitura de e-mails)

Este documento descreve o que o time de TI precisa liberar para ligarmos a
**ingestão automática** dos chamados a partir da caixa de e-mail
`danilo@alchemypet.com.br` (Google Workspace).

O painel de Chamados (dashboard, pizza por motivo, complexidade, caixa com
"resolver" e importação de planilha) **já está pronto e funciona** com a base
histórica. Falta apenas conectar a leitura viva da caixa — que depende das
liberações abaixo.

## Visão geral

```
Gmail (danilo@)  ──►  API do Gmail  ──►  Backend Alchemypet
                                            │ classifica (regras + IA)
                                            ▼
                                    tabela "chamado" ──► Dashboard
```

## 1. Como autorizar a leitura da caixa

Escolher **uma** das opções:

### Opção A — Service account + delegação de domínio (recomendada)
Melhor para automação de backend: roda sozinha, sem ninguém reautorizar.

1. No **Google Cloud Console**, criar um projeto (ou usar um existente).
2. Ativar a **Gmail API**.
3. Criar uma **conta de serviço** e gerar uma **chave JSON**.
4. Anotar o **Client ID** da conta de serviço.
5. No **Admin do Google Workspace** → *Segurança → Controles de API →
   Delegação em todo o domínio*, autorizar esse Client ID com os escopos:
   - `https://www.googleapis.com/auth/gmail.readonly` (ler)
   - *(fase 2, opcional)* `https://www.googleapis.com/auth/gmail.send` (responder pelo painel)
6. A automação passa a **impersonar** `danilo@alchemypet.com.br` para ler a caixa.

> Requer alguém com acesso de **administrador** do Workspace para o passo 5.

### Opção B — OAuth com refresh token do próprio Danilo
Não precisa de admin, porém o token pode ser revogado/expirar.

1. Criar credenciais **OAuth 2.0 (Desktop/Web)** no Google Cloud.
2. O Danilo autoriza uma vez (tela de consentimento) com escopo `gmail.readonly`.
3. Guardamos o **refresh token** com segurança (variável de ambiente).

## 2. Tempo real (Pub/Sub) — opção escolhida

Para receber os e-mails **na hora** (em vez de checar de tempos em tempos):

1. Criar um **tópico do Google Pub/Sub** (ex.: `chamados-gmail`).
2. Dar permissão de publicação ao serviço do Gmail
   (`gmail-api-push@system.gserviceaccount.com`) no tópico.
3. Criar uma **subscription push** apontando para o webhook do backend:
   `POST https://api-alchemypet.<dominio>/chamados/gmail/webhook`
4. O backend chama `users.watch` na caixa do Danilo para começar a receber
   notificações; a cada evento, busca as mensagens novas (`history`) e
   registra os chamados.

> O `watch` expira a cada ~7 dias e é renovado automaticamente por uma rotina.

## 3. Classificação (híbrida)

Cada e-mail é classificado em **complexidade** (baixa/média/alta) e **motivo**
(taxonomia fixa: revisão de resultado, dúvida técnica realização/solicitação,
questionamento/extensão de recoleta, prioridade liberação, etc.):

1. **Regras por palavra-chave** (já implementadas) resolvem os casos claros.
2. **IA (Claude)** entra quando a regra fica em dúvida — habilitada com a
   variável `ANTHROPIC_API_KEY`. Sem a chave, opera só com regras.

## 4. Variáveis de ambiente esperadas (Coolify)

Preencher quando a opção de acesso estiver decidida (nunca commitar segredos):

```
# Acesso ao Gmail (opção A)
GMAIL_SA_JSON=<conteúdo do JSON da conta de serviço, ou caminho>
GMAIL_IMPERSONATE=danilo@alchemypet.com.br
# ou (opção B)
GMAIL_OAUTH_CLIENT_ID=...
GMAIL_OAUTH_CLIENT_SECRET=...
GMAIL_OAUTH_REFRESH_TOKEN=...

# Tempo real
GMAIL_PUBSUB_TOPIC=projects/<projeto>/topics/chamados-gmail

# Classificação por IA (opcional; sem ela, só regras)
ANTHROPIC_API_KEY=...
```

## 5. Rede

O ambiente (Coolify) precisa permitir saída HTTPS para `googleapis.com`
e `oauth2.googleapis.com`. O webhook do Pub/Sub precisa que a rota
`/chamados/gmail/webhook` seja acessível publicamente (é validada por token).

## Escopo por fases

- **Fase 1 (entregue):** painel de Chamados a partir da planilha —
  dashboard, pizza por motivo, complexidade, caixa com resolver/CRUD e importação.
- **Fase 2 (após liberação do Google):** ingestão viva (Pub/Sub) + classificação
  híbrida com IA nos e-mails novos.
- **Fase 3 (opcional):** responder o chamado direto do painel (escopo `gmail.send`).
