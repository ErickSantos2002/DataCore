# DataCore

Sistema de dados da Health & Safety sobre o Tiny ERP: extrai vendas, notas, contas e
estoque do Tiny para um Postgres, modela os números com dbt e mostra tudo num painel
web com autenticação própria.

| Pasta | O que é | Serviço no EasyPanel |
|---|---|---|
| `frontend/` | Painel React + TypeScript | `datacore-sistema`, path `/frontend/` |
| `backend/` | API FastAPI, jobs de extração, auth | `datacore-api`, path `/backend/` |
| `analytics/` | dbt sobre o schema `tiny` | `datacore-dbt`, path `/analytics/` |
| `deploy/` | timers do systemd e scripts dos jobs na VPS | — |

## Dev local

```bash
cp backend/.env.example backend/.env   # preencher
docker compose up
```

Sobe o backend em http://localhost:8000 (`/docs`) e o frontend em
http://localhost:5174, apontando um pro outro. Detalhes de cada parte no README e no
CLAUDE.md de cada pasta.
