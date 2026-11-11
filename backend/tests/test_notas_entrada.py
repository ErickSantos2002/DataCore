"""Notas de entrada: a regra pelo CFOP do item e as rotas da aba do Financeiro.

Empresas fictícias — o repo é público.
"""
from datetime import date
from itertools import count

import pytest
from sqlalchemy import text

_ids = count(1)


@pytest.fixture(scope="module", autouse=True)
def tabelas(engine):
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tiny.clientes (
                id serial PRIMARY KEY, cpf_cnpj varchar, nome text, uf char(2))"""))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tiny.notas_fiscais (
                id serial PRIMARY KEY, numero varchar, serie varchar, data_emissao date,
                valor_nota numeric, situacao varchar, descricao_situacao text,
                natureza_operacao text, chave_acesso varchar, tipo_nota varchar,
                id_cliente int)"""))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tiny.itens_nota (
                id serial PRIMARY KEY, id_nota int, codigo varchar, descricao text,
                unidade varchar, ncm varchar, cfop varchar, quantidade numeric,
                valor_unitario numeric, valor_total numeric)"""))


@pytest.fixture(autouse=True)
def limpa(engine):
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE tiny.itens_nota, tiny.notas_fiscais, tiny.clientes RESTART IDENTITY"))


@pytest.fixture
def nota(engine):
    """Cria uma nota com um item por CFOP; devolve o id."""
    def _nota(cfops=("1102",), valor=100, situacao="7", emissao=date(2026, 3, 10),
              remetente="Fornecedor Alfa", cnpj=None, uf="SP", tipo_nota="N"):
        n = next(_ids)
        with engine.begin() as conn:
            cid = conn.execute(text(
                "INSERT INTO tiny.clientes (cpf_cnpj, nome, uf) VALUES (:c, :n, :u) RETURNING id"),
                {"c": cnpj if cnpj is not None else f"00.000.000/0001-{n:02d}", "n": remetente, "u": uf},
            ).scalar_one()
            nid = conn.execute(text(
                "INSERT INTO tiny.notas_fiscais (numero, data_emissao, valor_nota, situacao, tipo_nota,"
                " id_cliente, natureza_operacao) VALUES (:num, :d, :v, :s, :t, :c, 'teste') RETURNING id"),
                {"num": f"{n:06d}", "d": emissao, "v": valor, "s": situacao, "t": tipo_nota, "c": cid},
            ).scalar_one()
            for cfop in cfops:
                conn.execute(text(
                    "INSERT INTO tiny.itens_nota (id_nota, cfop, descricao, quantidade, valor_unitario,"
                    " valor_total) VALUES (:n, :c, 'Peça', 1, :v, :v)"), {"n": nid, "c": cfop, "v": valor})
        return nid
    return _nota


@pytest.fixture
def diretoria(criar_usuario, login):
    criar_usuario("dono", papel="admin")  # id 1
    return login("dono")


def resumo(client, h, **params):
    r = client.get("/notas_entrada/resumo", headers=h, params=params)
    assert r.status_code == 200, r.text
    return r.json()


def test_entrada_e_pelo_cfop_do_item_e_nao_pelo_tipo_nota(client, diretoria, nota):
    nota(cfops=("2102",), tipo_nota="N", valor=100)       # compra interestadual gravada como "N"
    nota(cfops=("5102",), tipo_nota="E", valor=999)       # venda gravada como "E": fora
    nota(cfops=("2.915",), valor=50)                      # CFOP com ponto também vale
    r = resumo(client, diretoria)
    assert (r["quantidade"], r["valor_total"]) == (2, 150)


def test_tipos_e_importacao(client, diretoria, nota):
    nota(cfops=("1102",), valor=10)
    nota(cfops=("3102",), valor=20)          # importação é compra, marcada à parte
    nota(cfops=("2202",), valor=30)
    nota(cfops=("1915",), valor=40)
    nota(cfops=("1949",), valor=50)
    r = resumo(client, diretoria)
    assert {t["tipo"]: t["valor"] for t in r["por_tipo"]} == {
        "compra": 30, "devolucao": 30, "conserto": 40, "outras": 50}
    assert (r["importacao_quantidade"], r["importacao_valor"]) == (1, 20)


def test_cancelada_fica_de_fora_por_padrao_mas_conta_nas_situacoes(client, diretoria, nota):
    nota(situacao="7", valor=10)
    nota(situacao="8", valor=20)
    nota(situacao="5", valor=30)
    nota(situacao="3", valor=40)
    r = resumo(client, diretoria)
    assert r["valor_total"] == 60
    assert {s["situacao"]: s["quantidade"] for s in r["por_situacao"]} == {
        "emitida": 1, "registrada": 1, "pendente": 1, "cancelada": 1}
    assert resumo(client, diretoria, situacao="cancelada")["valor_total"] == 40


def test_periodo_meses_e_remetentes(client, diretoria, nota):
    nota(emissao=date(2026, 1, 5), valor=10, remetente="Alfa", cnpj="11")
    nota(emissao=date(2026, 1, 20), valor=15, remetente="Alfa", cnpj="11")
    nota(emissao=date(2026, 2, 1), valor=100, remetente="Beta", cnpj="22")
    nota(emissao=date(2025, 12, 31), valor=1000, remetente="Gama", cnpj="33")
    r = resumo(client, diretoria, data_inicio="2026-01-01", data_fim="2026-12-31")
    assert r["por_mes"] == [{"mes": "2026-01", "quantidade": 2, "valor": 25},
                            {"mes": "2026-02", "quantidade": 1, "valor": 100}]
    assert [(x["remetente"], x["valor"]) for x in r["maiores_remetentes"]] == [("Beta", 100), ("Alfa", 25)]
    assert r["remetentes"] == 2


def test_cadastro_sem_cnpj_nao_empresta_o_nome(client, diretoria, nota):
    nota(remetente="Nome Do Ultimo Que Entrou", cnpj="", uf="EX", valor=10)
    r = resumo(client, diretoria)
    assert r["maiores_remetentes"][0]["remetente"] == "Exterior — remetente não identificado"


def test_pagina_busca_ordena_e_itens(client, diretoria, nota):
    nota(valor=10, remetente="Alfa Peças")
    maior = nota(valor=300, remetente="Beta Ferramentas", cfops=("2102", "2949"))
    nota(valor=5, cfops=("5102",))  # venda: nunca aparece
    r = client.get("/notas_entrada/pagina", headers=diretoria,
                   params={"ordenar_por": "valor", "direcao": "desc"}).json()
    assert r["total"] == 2 and r["itens"][0]["id"] == maior
    assert r["itens"][0]["tipo"] == "compra"  # o menor CFOP de entrada decide
    busca = client.get("/notas_entrada/pagina", headers=diretoria, params={"busca": "alfa"}).json()
    assert [i["remetente"] for i in busca["itens"]] == ["Alfa Peças"]
    itens = client.get(f"/notas_entrada/{maior}/itens", headers=diretoria).json()
    assert [i["cfop"] for i in itens] == ["2102", "2949"]


def test_itens_de_nota_que_nao_e_entrada_da_404(client, diretoria, nota):
    venda = nota(cfops=("5102",))
    assert client.get(f"/notas_entrada/{venda}/itens", headers=diretoria).status_code == 404


@pytest.mark.parametrize("params", [
    {"situacao": "xpto"}, {"tipo": "xpto"}, {"ordenar_por": "senha"},
    {"data_inicio": "2026-02-01", "data_fim": "2026-01-01"},
])
def test_filtro_invalido_e_422(client, diretoria, params):
    assert client.get("/notas_entrada/pagina", headers=diretoria, params=params).status_code == 422


def test_so_a_diretoria_ve(client, criar_usuario, login, nota):
    criar_usuario("dono", papel="comum")          # id 1: entra por id
    criar_usuario("outro", papel="admin")         # id 2: admin, mas fora da lista
    assert client.get("/notas_entrada/resumo", headers=login("dono")).status_code == 200
    for rota in ("/notas_entrada/resumo", "/notas_entrada/pagina", "/notas_entrada/1/itens"):
        assert client.get(rota, headers=login("outro")).status_code == 403
        assert client.get(rota).status_code == 401
