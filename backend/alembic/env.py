"""Ambiente do Alembic, restrito ao schema auth.

O app não é dono do schema tiny (nem dos schemas do dbt): o filtro abaixo impede
que o autogenerate/check enxergue qualquer coisa fora do auth.
"""
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool, text

SCHEMA = "auth"

config = context.config
if config.config_file_name is not None:
    # disable_existing_loggers=False: não calar os loggers da aplicação (e do pytest).
    fileConfig(config.config_file_name, disable_existing_loggers=False)

URL = os.environ.get("ALEMBIC_DATABASE_URL") or os.environ.get("DATABASE_URL")
if not URL:
    raise RuntimeError("Defina ALEMBIC_DATABASE_URL (ou DATABASE_URL) para rodar as migrations.")

# O import dos modelos passa pelo Settings da aplicação, que exige essas duas
# variáveis. Nas migrations elas não são usadas para nada além disso.
os.environ.setdefault("DATABASE_URL", URL)
os.environ.setdefault("SECRET_KEY", "nao-usada-nas-migrations-do-schema-auth")

from app.models.database import Base  # noqa: E402
from app.models import papel, sso_ticket, usuario  # noqa: E402,F401  (registram as tabelas)


def include_name(name, type_, parent_names):
    if type_ == "schema":
        return name == SCHEMA
    return True


def include_object(obj, name, type_, reflected, compare_to):
    if type_ == "table":
        return obj.schema == SCHEMA
    return True


def run_migrations_online() -> None:
    engine = create_engine(URL, poolclass=pool.NullPool)
    with engine.connect() as conn:
        # A tabela de versão mora no auth, então o schema precisa existir antes
        # da primeira revisão rodar.
        conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}"))
        conn.commit()
        context.configure(
            connection=conn,
            target_metadata=Base.metadata,
            include_schemas=True,
            include_name=include_name,
            include_object=include_object,
            version_table_schema=SCHEMA,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    raise RuntimeError("Modo offline não é suportado; rode contra um banco.")
run_migrations_online()
