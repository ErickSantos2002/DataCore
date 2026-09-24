import importlib.util

import pytest
from alembic import command
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from tests.conftest import RAIZ


def test_upgrade_cria_as_tabelas_do_auth(engine):
    tabelas = set(inspect(engine).get_table_names(schema="auth"))
    assert tabelas == {"papeis", "usuarios", "sso_tickets", "alembic_version"}


def test_colunas_de_sso_tickets(engine):
    colunas = {c["name"]: c for c in inspect(engine).get_columns("sso_tickets", schema="auth")}
    assert set(colunas) == {"ticket_hash", "usuario_id", "expira_em"}
    assert not colunas["usuario_id"]["nullable"]
    assert not colunas["expira_em"]["nullable"]
    assert inspect(engine).get_pk_constraint("sso_tickets", schema="auth")["constrained_columns"] == ["ticket_hash"]
    (fk,) = inspect(engine).get_foreign_keys("sso_tickets", schema="auth")
    assert fk["constrained_columns"] == ["usuario_id"]
    assert (fk["referred_schema"], fk["referred_table"], fk["referred_columns"]) == ("auth", "usuarios", ["id"])
    assert fk["options"].get("ondelete") == "CASCADE"


def test_colunas_de_usuarios(engine):
    colunas = {c["name"]: c for c in inspect(engine).get_columns("usuarios", schema="auth")}
    assert set(colunas) == {"id", "username", "email", "senha_hash", "papel_id", "criado_em"}
    assert colunas["email"]["nullable"] is True
    assert colunas["username"]["nullable"] is False


def test_email_unico_so_quando_preenchido(engine):
    inserir = text(
        "INSERT INTO auth.usuarios (username, email, senha_hash, papel_id)"
        " VALUES (:u, :e, 'x', 1)"
    )
    with engine.begin() as conn:
        conn.execute(inserir, {"u": "a", "e": None})
        conn.execute(inserir, {"u": "b", "e": None})
        conn.execute(inserir, {"u": "c", "e": "c@hs.com"})
    with pytest.raises(IntegrityError):
        with engine.begin() as conn:
            conn.execute(inserir, {"u": "d", "e": "c@hs.com"})


def test_modelos_batem_com_a_migration_e_ignoram_o_tiny(engine, alembic_cfg):
    # tiny.marcadores existe no banco e não está no metadata: se o filtro de schema
    # falhasse, o check acusaria "remove table".
    command.check(alembic_cfg)
    assert "marcadores" in inspect(engine).get_table_names(schema="tiny")


def test_usuario_da_app_recebe_so_os_grants_das_tabelas(engine):
    with engine.connect() as conn:
        pode = lambda sql: conn.execute(text(sql)).scalar_one()  # noqa: E731
        assert pode("SELECT has_table_privilege('app_teste', 'auth.usuarios', 'INSERT, SELECT, UPDATE, DELETE')")
        assert pode("SELECT has_table_privilege('app_teste', 'auth.papeis', 'SELECT')")
        assert pode("SELECT has_sequence_privilege('app_teste', 'auth.usuarios_id_seq', 'USAGE')")
        assert not pode("SELECT has_table_privilege('app_teste', 'auth.alembic_version', 'UPDATE')")
        assert pode("SELECT has_table_privilege('app_teste', 'auth.sso_tickets', 'SELECT, INSERT, DELETE')")
        assert not pode("SELECT has_table_privilege('app_teste', 'auth.sso_tickets', 'UPDATE')")


def test_downgrade_e_upgrade_de_novo(engine, alembic_cfg):
    command.downgrade(alembic_cfg, "base")
    assert set(inspect(engine).get_table_names(schema="auth")) == {"alembic_version"}
    command.upgrade(alembic_cfg, "head")
    assert {"papeis", "usuarios", "sso_tickets"} <= set(inspect(engine).get_table_names(schema="auth"))


def _carregar_migration():
    caminho = RAIZ / "alembic" / "versions" / "0001_criar_schema_auth.py"
    spec = importlib.util.spec_from_file_location("migration_0001", caminho)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


@pytest.mark.parametrize("valor", [None, "", "x; DROP TABLE y", "a b"])
def test_migration_exige_auth_app_db_user_valido(monkeypatch, valor):
    migration = _carregar_migration()
    if valor is None:
        monkeypatch.delenv("AUTH_APP_DB_USER", raising=False)
    else:
        monkeypatch.setenv("AUTH_APP_DB_USER", valor)
    with pytest.raises(RuntimeError, match="AUTH_APP_DB_USER"):
        migration._usuario_app()
