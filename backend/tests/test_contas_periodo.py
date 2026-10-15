"""O campo que decide o período das telas de Contas (`campo_periodo`).

Contas a Pagar recorta e agrupa pelo vencimento; a outra tela continua pela
emissão. A semente é `contas_receber`, mas a regra é a mesma função para as duas.
"""
from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.core.contas_agregado import pagina_de_contas, resumo_de_contas
from tests.semente_contas import contas, tabela_contas  # noqa: F401

HOJE = date(2026, 10, 15)


@pytest.fixture
def db(engine):
    with Session(engine) as sessao:
        yield sessao


@pytest.fixture
def parcelas(contas):  # noqa: F811
    """Três parcelas lançadas no mesmo dia, vencendo em 2026, 2027 e 2028."""
    for vence_em, valor in ((date(2026, 11, 10), 100), (date(2027, 11, 10), 200),
                            (date(2028, 11, 10), 300)):
        contas(hoje=HOJE, venceu_ha=(HOJE - vence_em).days, valor=valor,
               emissao_ha=(vence_em - date(2026, 10, 1)).days)


def _resumo(db, **kw):
    padrao = dict(tabela="contas_receber", campo_emissao="data", quitadas=["pago"],
                  situacoes=None, categorias=None, contrapartes=None,
                  data_inicio=None, data_fim=None, hoje=HOJE)
    padrao.update(kw)
    return resumo_de_contas(db, **padrao)


def test_pela_emissao_tudo_cai_no_mes_do_lancamento(db, parcelas):
    r = _resumo(db)
    assert [(a.ano, a.aberto) for a in r.por_ano] == [(2026, 600)]
    assert [(m.ano, m.mes) for m in r.por_mes] == [(2026, 10)]
    assert r.kpis.media_mensal == 600


def test_pelo_vencimento_cada_parcela_cai_no_seu_ano(db, parcelas):
    r = _resumo(db, campo_periodo="vencimento")
    assert [(a.ano, a.aberto) for a in r.por_ano] == [(2026, 100), (2027, 200), (2028, 300)]
    assert [(m.ano, m.mes, m.aberto) for m in r.por_mes] == [
        (2026, 11, 100), (2027, 11, 200), (2028, 11, 300)]
    assert r.kpis.media_mensal == 200


def test_o_periodo_filtra_pelo_vencimento_no_resumo_e_na_pagina(db, parcelas):
    filtro = dict(data_inicio=date(2027, 1, 1), data_fim=date(2027, 12, 31),
                  campo_periodo="vencimento")
    r = _resumo(db, **filtro)
    assert (r.kpis.contas, r.kpis.total_aberto) == (1, 200)

    p = pagina_de_contas(db, tabela="contas_receber", campo_emissao="data",
                         quitadas=["pago"], situacoes=None, categorias=None,
                         contrapartes=None, busca=None, ordenar_por="vencimento",
                         direcao="asc", limite=10, offset=0, hoje=HOJE, **filtro)
    assert p.total == 1
    # A coluna "Emissão" continua sendo a emissão.
    assert p.itens[0].emissao == date(2026, 10, 1)
    assert p.itens[0].vencimento == date(2027, 11, 10)
