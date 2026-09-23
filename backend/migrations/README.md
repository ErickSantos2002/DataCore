# migrations/ — SQL manual

SQL numerado, rodado à mão no Postgres, para os schemas **`tiny`** e **`operacao`**.
É o caminho de DDL desses dois schemas: número novo = próximo da sequência
(`012_...sql`). Não há registro automático do que já foi aplicado — conferir no
banco antes de rodar.

O schema **`auth`** (usuários do DataCoreHS) é o único versionado com **Alembic**,
em `alembic/`, cujo `env.py` só enxerga o `auth`. Para aplicar:
`AUTH_APP_DB_USER=<usuario_da_app> bash scripts/migrar.sh`.
