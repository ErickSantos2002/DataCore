"""Migração 013: tabelas da cobrança, idempotência e permissões.

Roda o mesmo SQL que vai para o Konsole, por cima de um `tiny.configuracoes` com a
permissão que a aplicação tem em produção — a 013 copia as permissões de lá.
"""
from pathlib import Path

import pytest
from sqlalchemy import text

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"


def rodar_migracao(engine, arquivo):
    bruta = engine.raw_connection()
    try:
        with bruta.cursor() as cur:
            cur.execute((MIGRATIONS / arquivo).read_text())
        bruta.commit()
    finally:
        bruta.close()


@pytest.fixture(scope="module", autouse=True)
def base(engine):
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS tiny.cobranca_eventos, tiny.cobranca_ciclos, tiny.cobranca_empresas"))
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS tiny.configuracoes ("
            " id serial PRIMARY KEY, chave varchar NOT NULL UNIQUE, valor varchar NOT NULL)"
        ))
        conn.execute(text("GRANT SELECT, UPDATE, INSERT ON tiny.configuracoes TO app_teste"))
    rodar_migracao(engine, "013_cobranca.sql")


def test_cria_as_tres_tabelas(engine):
    with engine.connect() as conn:
        nomes = set(conn.execute(text(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'tiny'"
        )).scalars())
    assert {"cobranca_ciclos", "cobranca_eventos", "cobranca_empresas"} <= nomes


def test_e_idempotente(engine):
    rodar_migracao(engine, "013_cobranca.sql")


def test_um_ciclo_aberto_por_empresa(engine):
    from sqlalchemy.exc import IntegrityError

    with engine.begin() as conn:
        conn.execute(text("TRUNCATE tiny.cobranca_eventos, tiny.cobranca_ciclos RESTART IDENTITY CASCADE"))
        conn.execute(text("INSERT INTO tiny.cobranca_ciclos (empresa, status, aberto_por) VALUES ('11111111', 'sem_contato', 'sistema')"))
    with pytest.raises(IntegrityError):
        with engine.begin() as conn:
            conn.execute(text("INSERT INTO tiny.cobranca_ciclos (empresa, status, aberto_por) VALUES ('11111111', 'em_contato', 'x')"))
    with engine.begin() as conn:  # depois de encerrado, abre outro
        conn.execute(text("UPDATE tiny.cobranca_ciclos SET encerrado_em = now()"))
        conn.execute(text("INSERT INTO tiny.cobranca_ciclos (empresa, status, aberto_por) VALUES ('11111111', 'em_contato', 'x')"))


def test_quem_escreve_em_configuracoes_escreve_na_cobranca_mas_nao_apaga_evento(engine):
    with engine.connect() as conn:
        p = conn.execute(text(
            "SELECT has_table_privilege('app_teste', 'tiny.cobranca_ciclos', 'INSERT'),"
            "       has_table_privilege('app_teste', 'tiny.cobranca_ciclos', 'UPDATE'),"
            "       has_table_privilege('app_teste', 'tiny.cobranca_eventos', 'INSERT'),"
            "       has_table_privilege('app_teste', 'tiny.cobranca_eventos', 'UPDATE'),"
            "       has_table_privilege('app_teste', 'tiny.cobranca_eventos', 'DELETE'),"
            "       has_table_privilege('app_teste', 'tiny.cobranca_empresas', 'DELETE')"
        )).one()
    assert p == (True, True, True, False, False, True)
