# Painel Convênio — Backend (FastAPI)

API do M1: CRUD de pendências, tratativas, dashboard e importação da planilha.

## Rodar local
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Sem `DATABASE_URL`, usa SQLite (`dev.db`). Docs interativas em `/docs`.

## Variáveis
Ver `.env.example`. Em produção, aponte `DATABASE_URL` para o Postgres.

## Endpoints
| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Healthcheck |
| GET | `/pendencias` | Lista paginada + filtros (ano, mês, status, gestão, clínica, responsável, busca) |
| POST | `/pendencias` | Cria pendência manual |
| GET | `/pendencias/{id}` | Detalhe |
| PATCH | `/pendencias/{id}` | Atualiza gestão/status/responsável |
| GET | `/pendencias/{id}/tratativas` | Histórico de tratativas |
| POST | `/pendencias/{id}/tratativas` | Registra tratativa (avança a gestão) |
| GET | `/dashboard` | KPIs e agregações do conjunto filtrado |
| GET | `/clinicas` | Lista de clínicas (filtro) |
| GET | `/usuarios` | Usuários (placeholder até auth do ecossistema) |
| POST | `/importar` | Importa `.xlsx` (todas as abas, idempotente) |

## Estrutura
```
app/
  main.py        # app, CORS, startup (create_all + seed)
  config.py      # settings via env
  database.py    # engine/session/Base
  models.py      # Pendencia, Tratativa, Clinica, Usuario
  schemas.py     # Pydantic
  filters.py     # filtros compartilhados
  importer.py    # parser do .xlsx (detecção de colunas por cabeçalho)
  routers/       # pendencias, tratativas, dashboard, catalogos, importacao
```

## Notas
- Importação idempotente por chave natural `sha1(aba|guia|paciente|info)`; a
  gestão (situação/observações) é preservada em reimportações.
- Schema criado no startup (M1). Migrar para Alembic numa fase madura.
