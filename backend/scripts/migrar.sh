#!/usr/bin/env bash
# Aplica as migrations do schema auth no datacore com o superusuário do admin.toml.
# Roda no Konsole (o Claude não lê o admin.toml), na raiz do repo:
#   AUTH_APP_DB_USER=<usuario_do_DATABASE_URL_de_produção> bash scripts/migrar.sh
set -euo pipefail
cd "$(dirname "$0")/.."

: "${AUTH_APP_DB_USER:?Defina AUTH_APP_DB_USER com o usuário do Postgres que o tinyapi usa em produção}"
PY=.venv/bin/python

ALEMBIC_DATABASE_URL="$("$PY" scripts/_admin_url.py datacore)"
export ALEMBIC_DATABASE_URL AUTH_APP_DB_USER

echo "== Antes:";  "$PY" -m alembic current
"$PY" -m alembic upgrade head
echo "== Depois:"; "$PY" -m alembic current
