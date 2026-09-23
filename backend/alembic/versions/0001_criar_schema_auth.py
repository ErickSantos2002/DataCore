"""Cria o schema auth com papéis e usuários do DataCoreHS.

Revision ID: 0001
Revises:
Create Date: 2026-09-23
"""
import os
import re

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def _usuario_app() -> str:
    """Usuário do Postgres que a aplicação usa (o do DATABASE_URL de produção)."""
    nome = (os.environ.get("AUTH_APP_DB_USER") or "").strip()
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_-]*", nome):
        raise RuntimeError(
            "Defina AUTH_APP_DB_USER com o usuário do Postgres que o tinyapi usa "
            "(o do DATABASE_URL de produção). Valor atual inválido ou ausente."
        )
    return nome


def upgrade() -> None:
    usuario_app = f'"{_usuario_app()}"'

    op.execute("CREATE SCHEMA IF NOT EXISTS auth")
    op.create_table(
        "papeis",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("nome", sa.Text, nullable=False, unique=True),
        schema="auth",
    )
    op.create_table(
        "usuarios",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.Text, nullable=False, unique=True),
        sa.Column("email", sa.Text, nullable=True),
        sa.Column("senha_hash", sa.Text, nullable=False),
        sa.Column("papel_id", sa.Integer, sa.ForeignKey("auth.papeis.id"), nullable=False),
        sa.Column(
            "criado_em", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        schema="auth",
    )
    op.create_index(
        "usuarios_email_unico",
        "usuarios",
        ["email"],
        unique=True,
        schema="auth",
        postgresql_where=sa.text("email IS NOT NULL"),
    )

    # A aplicação lê e escreve nas tabelas; não recebe nada na alembic_version.
    op.execute(f"GRANT USAGE ON SCHEMA auth TO {usuario_app}")
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON auth.papeis, auth.usuarios TO {usuario_app}")
    op.execute(f"GRANT USAGE, SELECT ON SEQUENCE auth.papeis_id_seq, auth.usuarios_id_seq TO {usuario_app}")


def downgrade() -> None:
    op.drop_index("usuarios_email_unico", table_name="usuarios", schema="auth")
    op.drop_table("usuarios", schema="auth")
    op.drop_table("papeis", schema="auth")
