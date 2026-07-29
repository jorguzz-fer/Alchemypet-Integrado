# M1 — Deploy no Coolify

Passo a passo para subir o **M1** do Painel Convênio (backend FastAPI + frontend
Next.js + Postgres) no Coolify. Todos os recursos no mesmo Project/Environment.

## Resources no Coolify

### 1. PostgreSQL
`+ New Resource` → Database → PostgreSQL (imagem `pgvector/pgvector:pg16`).
Anote a connection string interna. Crie o banco `convenio` (ou use o default).

### 2. Backend (FastAPI)
`+ New Resource` → Application → repositório Git.
- **Build Pack:** Dockerfile
- **Base Directory:** `/backend`
- **Dockerfile Location:** `/backend/Dockerfile`
- **Ports Exposes:** `8000`  ← precisa casar com o `PORT` (corrige o "PORT mismatch")
- **Port Mappings:** deixe **vazio** (o Traefik roteia pelo domínio)
- **Domain:** `https://api-alchemypet.tudomudou.com.br`
- **Healthcheck:** path `/health`
- **Environment Variables:**
  ```env
  PORT=8000
  DATABASE_URL=postgresql+psycopg://usuario:senha@postgres:5432/convenio
  CORS_ORIGINS=https://alchemypet.tudomudou.com.br
  # Autenticação (obrigatório em produção):
  SECRET_KEY=<gere com: openssl rand -hex 32>
  ADMIN_EMAIL=admin@alchemypet.com.br
  ADMIN_SENHA=<senha forte do admin inicial>
  ```
  > `postgres` = nome do resource do banco na rede interna do Coolify.
  > A URL que o Coolify entrega pode começar com `postgres://` ou `postgresql://` —
  > o backend normaliza automaticamente.
  > **SECRET_KEY**: sem ela os tokens ficam inseguros (há um default só para dev).
  > No **primeiro deploy** é criado um usuário admin com `ADMIN_EMAIL`/`ADMIN_SENHA`;
  > entre com ele e cadastre a equipe em **Usuários**.

### 3. Frontend (Next.js)
`+ New Resource` → Application → mesmo repositório.
- **Build Pack:** Dockerfile
- **Base Directory:** `/frontend`
- **Dockerfile Location:** `/frontend/Dockerfile`
- **Ports Exposes:** `3000`
- **Port Mappings:** deixe **vazio**
- **Domain:** `https://alchemypet.tudomudou.com.br`
- **Environment Variables:**
  ```env
  NEXT_PUBLIC_API_URL=https://api-alchemypet.tudomudou.com.br
  ```
  > ⚠️ `NEXT_PUBLIC_*` é embutido em **build time** no Next.js. No Coolify, marque
  > essa variável como **Build Variable** para ela valer no build. O Dockerfile já
  > traz esse domínio como default (`ARG`), então funciona out-of-the-box; só
  > precisa marcá-la como build var se for usar **outro domínio** (white-label).

## Ordem de deploy
1. Postgres (aguarde ficar *healthy*).
2. Backend → Deploy. Teste `https://api-alchemypet.tudomudou.com.br/health` → `{"status":"ok"}`.
3. Frontend → Deploy. Abra o domínio do frontend.

## Primeira carga de dados
No painel (frontend), use **Importar planilha** e envie `Pendências Convênio.xlsx`.
O backend processa as 53 abas, normaliza e grava no Postgres (idempotente — pode
reimportar a planilha atualizada quando quiser). Alternativa via API:
```bash
curl -F "file=@Pendências Convênio.xlsx" https://api-alchemypet.tudomudou.com.br/importar
```

## Notas
- O schema é criado automaticamente no startup do backend (M1). Numa fase madura,
  migrar para Alembic.
- Ajustes de porta pendentes na config atual do Coolify: **Backend Ports Exposes
  = 8000** e **remover os Port Mappings `3000:3000`** de backend e frontend (evita
  conflito de porta no host).
- Autenticação real (perfis/login) entra com a Fundação do ecossistema (Fase 0);
  no M1 há um seed mínimo de usuários como placeholder.
