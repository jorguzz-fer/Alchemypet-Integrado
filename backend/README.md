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
| POST | `/crm/importar-pocket` | Admin. Importa vários arquivos exportados dos grids do Pocket (.csv/.xlsx), reconhecidos pelo cabeçalho; idempotente |
| GET | `/crm/contas` | Contas do CRM (clínicas e leads) com filtros: busca, etapa, uso, região, vendedor |
| GET | `/crm/resumo` | Indicadores da carteira (clientes, uso, leads, região, vendedor, captação, concorrentes) |
| GET | `/crm/filtros` | Regiões, vendedores, etapas, temperaturas e tipos de atividade |
| GET | `/crm/funil` | Contas por etapa do funil (aceita os mesmos filtros da lista) |
| POST | `/crm/contas` | Novo lead (registra a criação no histórico) |
| GET / PATCH | `/crm/contas/{id}` | Detalhe e edição (etapa, temperatura, vendedor, contato); Inativo/Bloqueado exigem motivo |
| GET / POST | `/crm/contas/{id}/atividades` | Histórico e registro de atividade (13 tipos do Pocket) |
| DELETE | `/crm/atividades/{id}` | Exclui atividade (autor ou admin; registros do sistema não) |
| GET | `/crm/atividades/ranking` | Atividades por pessoa e tipo no período (padrão: 30 dias) |

## Testes
```bash
cd backend && python -m unittest discover -s tests
```

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
