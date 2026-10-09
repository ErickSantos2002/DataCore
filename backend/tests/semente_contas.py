"""Uma `tiny.contas_receber` mínima para os testes de inadimplência.

Só as colunas que as consultas leem, com os tipos de produção. Empresas fictícias —
o repo é público.
"""
from datetime import date, timedelta
from itertools import count

import pytest
from sqlalchemy import text

_ids = count(1)

DDL = """
CREATE TABLE tiny.contas_receber (
    id bigserial PRIMARY KEY,
    id_tiny bigint UNIQUE NOT NULL,
    data date NOT NULL,
    vencimento date NOT NULL,
    valor numeric(15,2) NOT NULL,
    saldo numeric(15,2) NOT NULL,
    situacao varchar(500),
    liquidacao date,
    categoria varchar(500),
    nro_documento varchar(500),
    historico varchar(500),
    forma_pagamento varchar(500),
    portador varchar(500),
    ocorrencia char(1) NOT NULL DEFAULT 'U',
    cliente_nome varchar(500) NOT NULL,
    cliente_cpf_cnpj varchar(500),
    cliente_cidade varchar(500),
    cliente_uf varchar(500),
    cliente_fone varchar(500),
    cliente_email varchar(500),
    excluida_na_origem_em timestamp
)
"""


@pytest.fixture(scope="module")
def tabela_contas(engine):
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS tiny.contas_receber"))
        conn.execute(text(DDL))
        conn.execute(text("GRANT SELECT ON tiny.contas_receber TO app_teste"))
    return engine


@pytest.fixture
def contas(tabela_contas):
    """`contas(...)` insere um título; os dias são relativos a HOJE."""
    with tabela_contas.begin() as conn:
        conn.execute(text("TRUNCATE tiny.contas_receber RESTART IDENTITY"))

    def _inserir(*, nome="Alfa Ltda", doc="11.111.111/0001-11", venceu_ha=40,
                 valor=1000, saldo=None, situacao="aberto", pago_dias_depois=None,
                 emissao_ha=None, excluida=False, hoje=None, categoria=None,
                 forma_pagamento=None, uf=None):
        hoje = hoje or date.today()
        vencimento = hoje - timedelta(days=venceu_ha)
        liquidacao = None
        if pago_dias_depois is not None:
            situacao = "pago"
            liquidacao = vencimento + timedelta(days=pago_dias_depois)
        if saldo is None:
            saldo = 0 if situacao == "pago" else valor
        i = next(_ids)
        with tabela_contas.begin() as conn:
            conn.execute(text(
                "INSERT INTO tiny.contas_receber (id_tiny, data, vencimento, valor, saldo, situacao,"
                " liquidacao, cliente_nome, cliente_cpf_cnpj, cliente_fone, cliente_email,"
                " excluida_na_origem_em, categoria, forma_pagamento, cliente_uf)"
                " VALUES (:i, :e, :v, :valor, :saldo, :s, :l, :n, :d, '(11) 0000-0000',"
                " 'financeiro@exemplo.com', :x, :cat, :forma, :uf)"
            ), {"i": 100000 + i, "e": vencimento - timedelta(days=emissao_ha or 10),
                "v": vencimento, "valor": valor, "saldo": saldo, "s": situacao,
                "l": liquidacao, "n": nome, "d": doc,
                "x": date.today() if excluida else None,
                "cat": categoria, "forma": forma_pagamento, "uf": uf})
    return _inserir
