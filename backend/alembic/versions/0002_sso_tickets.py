"""Tickets de uso único do login com Microsoft.

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-24
"""
import os
import re

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def _usuario_app() -> str:
    """Mesmo contrato da 0001 (migration é retrato congelado: não importa da outra)."""
    nome = (os.environ.get("AUTH_APP_DB_USER") or "").strip()
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_-]*", nome):
        raise RuntimeError(
            "Defina AUTH_APP_DB_USER com o usuário do Postgres que o tinyapi usa "
            "(o do DATABASE_URL de produção). Valor atual inválido ou ausente."
        )
    return nome


def upgrade() -> None:
    usuario_app = f'"{_usuario_app()}"'
    op.create_table(
        "sso_tickets",
        sa.Column("ticket", sa.Text, primary_key=True),
        sa.Column("access_token", sa.Text, nullable=False),
        sa.Column("expira_em", sa.DateTime(timezone=True), nullable=False),
        schema="auth",
    )
    # Só o que o app usa: grava ao emitir, lê e apaga ao resgatar. Nada de UPDATE.
    op.execute(f"GRANT SELECT, INSERT, DELETE ON auth.sso_tickets TO {usuario_app}")


def downgrade() -> None:
    op.drop_table("sso_tickets", schema="auth")
