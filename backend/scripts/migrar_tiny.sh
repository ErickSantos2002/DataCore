#!/usr/bin/env bash
# Roda uma migration SQL do schema tiny (migrations/) no datacore, com o
# superusuário do admin.toml. Roda no Konsole (o Claude não lê o admin.toml):
#   bash scripts/migrar_tiny.sh 002_configuracoes_historico.sql
# Para na primeira falha e roda tudo numa transação só.
set -euo pipefail
cd "$(dirname "$0")/.."

ARQUIVO="migrations/${1:?Informe o arquivo de migrations/, ex.: 002_configuracoes_historico.sql}"
[ -f "$ARQUIVO" ] || { echo "Não existe: $ARQUIVO"; exit 1; }

URL="$(.venv/bin/python scripts/_admin_url.py datacore)"
psql "$URL" -v ON_ERROR_STOP=1 --single-transaction -f "$ARQUIVO"
echo "OK: $ARQUIVO aplicada."
