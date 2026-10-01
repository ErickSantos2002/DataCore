"""Configurações: migrações 002/003, validação por chave, permissão e histórico.

A tabela tiny.configuracoes existe em produção desde antes do Alembic; aqui ela é
criada à mão com a mesma forma, e a 002 roda por cima — assim o teste exercita o
mesmo SQL que vai para o Konsole.
"""
from pathlib import Path

import pytest
from sqlalchemy import text

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"
SEMENTE = {
    "META": "12666666.72",
    "CFOP_VALIDOS": "6102,5102,6108,5108",
    "MARCADORES_INVALIDOS": "cancelar, nf devolvida",
    "MESES_ANALISE": "10,11,12",
    "ANIMACAO_META": "true",
}


def _rodar(engine, arquivo):
    # Pelo cursor do driver e sem parâmetros, como o psql roda: o `%` do LIKE no
    # SQL não pode virar marcador de interpolação.
    bruta = engine.raw_connection()
    try:
        with bruta.cursor() as cur:
            cur.execute((MIGRATIONS / arquivo).read_text())
        bruta.commit()
    finally:
        bruta.close()


@pytest.fixture(scope="module", autouse=True)
def tabela_configuracoes(engine):
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS tiny.configuracoes_historico"))
        conn.execute(text("DROP TABLE IF EXISTS tiny.configuracoes"))
        conn.execute(text(
            "CREATE TABLE tiny.configuracoes ("
            " id serial PRIMARY KEY, chave varchar NOT NULL UNIQUE, valor varchar NOT NULL)"
        ))
        # O usuário da aplicação escreve em configuracoes: a 002 tem que copiar isso.
        conn.execute(text("GRANT SELECT, UPDATE, INSERT ON tiny.configuracoes TO app_teste"))
    _rodar(engine, "002_configuracoes_historico.sql")


@pytest.fixture
def configs(engine):
    with engine.begin() as conn:
        conn.execute(text(
            "TRUNCATE tiny.configuracoes, tiny.configuracoes_historico RESTART IDENTITY"
        ))
        for chave, valor in {**SEMENTE, "TRIMESTRE_APURACAO": "auto"}.items():
            conn.execute(
                text("INSERT INTO tiny.configuracoes (chave, valor) VALUES (:c, :v)"),
                {"c": chave, "v": valor},
            )
    return engine


def _valor(engine, chave):
    with engine.connect() as conn:
        return conn.execute(
            text("SELECT valor FROM tiny.configuracoes WHERE chave = :c"), {"c": chave}
        ).scalar_one_or_none()


# ------------------------------------------------------------------ migrações

def test_002_cria_o_historico_com_a_permissao_de_quem_escreve_em_configuracoes(engine):
    with engine.connect() as conn:
        pode = conn.execute(text(
            "SELECT has_table_privilege('app_teste', 'tiny.configuracoes_historico', 'INSERT'),"
            "       has_sequence_privilege('app_teste', 'tiny.configuracoes_historico_id_seq', 'USAGE')"
        )).one()
    assert pode == (True, True)


def test_002_cria_trimestre_automatico_e_e_idempotente(engine, configs):
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM tiny.configuracoes WHERE chave = 'TRIMESTRE_APURACAO'"))
    _rodar(engine, "002_configuracoes_historico.sql")
    _rodar(engine, "002_configuracoes_historico.sql")  # segunda vez não quebra nem duplica
    assert _valor(engine, "TRIMESTRE_APURACAO") == "auto"


def test_002_nao_sobrescreve_trimestre_ja_fixado(engine, configs):
    with engine.begin() as conn:
        conn.execute(text(
            "UPDATE tiny.configuracoes SET valor = '2026-T3' WHERE chave = 'TRIMESTRE_APURACAO'"
        ))
    _rodar(engine, "002_configuracoes_historico.sql")
    assert _valor(engine, "TRIMESTRE_APURACAO") == "2026-T3"


def test_003_apaga_so_meses_analise(engine, configs):
    _rodar(engine, "003_aposentar_meses_analise.sql")
    assert _valor(engine, "MESES_ANALISE") is None
    assert _valor(engine, "CFOP_VALIDOS") == SEMENTE["CFOP_VALIDOS"]
