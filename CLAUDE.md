# CLAUDE.md

DataCore — sistema de dados do Tiny ERP da Health & Safety. Um repo, quatro partes.
Código, comentários, interface e commit em **português do Brasil**.

## Mapa

| Pasta | O que é | Serviço no EasyPanel (projeto `erick`) |
|---|---|---|
| `frontend/` | Painel React + TypeScript (o "DataCoreHS") | `datacore-sistema`, path `/frontend/` |
| `backend/` | API FastAPI (o "tinyapi"), jobs de extração, auth | `datacore-api`, path `/backend/` |
| `analytics/` | dbt sobre o schema `tiny` | `datacore-dbt`, path `/analytics/` |
| `deploy/` | timers do systemd e scripts que rodam os jobs na VPS | — (copiados para `/opt/datacore-jobs/`) |

Cada pasta tem as próprias regras: `frontend/CLAUDE.md`, `backend/CLAUDE.md`,
`analytics/README.md`. Comandos de teste e build rodam **de dentro** da pasta.

## Regras transversais

- **Repo público.** Varrer o que vai subir antes de todo push (`scripts/varrer.sh`);
  `git add` por caminho, nunca `-A`. Senha, string de conexão, IP de VPS e dado de
  pessoa não entram — nem em `.md`.
- **Bancos pelo cadastro central:** `bancos.consultar("datacore", sql)`. Não montar
  conexão na mão.
- **Deploy é manual** (botão "Implantar" do EasyPanel, sem webhook). Push não publica.
- **Deploy/ não se atualiza sozinho:** mudou `deploy/`, copiar à mão para
  `/opt/datacore-jobs/` e `/etc/systemd/system/` na VPS (ver `backend/README.md`).

## Dev local

`docker compose up` na raiz sobe backend (8000) e frontend (5174) apontando um pro
outro. O backend precisa de `backend/.env` (ver `backend/.env.example`).

## Origem

Nasceu em 23/09/2026 da junção de `DataCoreHS` (front) e `tiny-integrador` (back,
analytics, deploy), sem histórico — os repos antigos ficaram privados.
