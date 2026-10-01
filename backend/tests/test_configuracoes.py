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
# ------------------------------------------------------------------ validação
from datetime import date  # noqa: E402

from app.core.configuracoes import ValorInvalido, normalizar  # noqa: E402

HOJE = date(2026, 10, 1)


@pytest.mark.parametrize("entrada", [
    "12666666.72", "12.666.666,72", "12666666,72", "R$ 12.666.666,72", " 12666666.72 ",
])
def test_meta_aceita_os_tres_formatos_e_grava_ponto_decimal(entrada):
    assert normalizar("META", entrada, HOJE) == "12666666.72"


def test_meta_inteira_ganha_duas_casas():
    assert normalizar("META", "12000000", HOJE) == "12000000.00"


@pytest.mark.parametrize("entrada", ["", "abc", "0", "-5", "0,00"])
def test_meta_recusa_vazio_texto_zero_e_negativo(entrada):
    with pytest.raises(ValorInvalido, match="META"):
        normalizar("META", entrada, HOJE)


@pytest.mark.parametrize("entrada,esperado", [
    ("auto", "auto"), (" AUTO ", "auto"), ("2026-T3", "2026-T3"), ("2026-t4", "2026-T4"),
    ("2020-T1", "2020-T1"), ("2027-T1", "2027-T1"),
])
def test_trimestre_aceita_auto_e_ano_trimestre(entrada, esperado):
    assert normalizar("TRIMESTRE_APURACAO", entrada, HOJE) == esperado


@pytest.mark.parametrize("entrada", ["", "10,11,12", "2026-T5", "2026-T0", "2019-T4", "2028-T1", "26-T3"])
def test_trimestre_recusa_o_resto(entrada):
    with pytest.raises(ValorInvalido, match="trimestre"):
        normalizar("TRIMESTRE_APURACAO", entrada, HOJE)


@pytest.mark.parametrize("entrada,esperado", [("true", "true"), ("FALSE", "false")])
def test_animacao_so_aceita_booleano(entrada, esperado):
    assert normalizar("ANIMACAO_META", entrada, HOJE) == esperado


def test_animacao_recusa_outra_coisa():
    with pytest.raises(ValorInvalido):
        normalizar("ANIMACAO_META", "sim", HOJE)


def test_chave_desconhecida_passa_como_veio():
    assert normalizar("CFOP_VALIDOS", " 6102,5102 ", HOJE) == " 6102,5102 "
