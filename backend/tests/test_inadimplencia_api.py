from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from sqlalchemy import text

from tests.semente_contas import contas, tabela_contas  # noqa: F401
from tests.test_inadimplencia_migracao import rodar_migracao


@pytest.fixture(scope="module", autouse=True)
def tabelas(engine):
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS tiny.configuracoes ("
            " id serial PRIMARY KEY, chave varchar NOT NULL UNIQUE, valor varchar NOT NULL)"))
        conn.execute(text("GRANT SELECT, UPDATE, INSERT ON tiny.configuracoes TO app_teste"))
    rodar_migracao(engine, "013_cobranca.sql")


@pytest.fixture(autouse=True)
def limpa(engine):
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE tiny.cobranca_eventos, tiny.cobranca_ciclos, tiny.cobranca_empresas RESTART IDENTITY CASCADE"))


@pytest.fixture
def financeiro(criar_usuario, login):
    uid = criar_usuario("ana", papel="financeiro")
    return SimpleNamespace(id=uid, headers=login("ana"))


ROTAS_GET = ["/inadimplencia/resumo", "/inadimplencia/empresas", "/inadimplencia/indicadores",
             "/inadimplencia/empresas/11111111", "/inadimplencia/empresas/11111111/titulos"]


@pytest.mark.parametrize("rota", ROTAS_GET)
def test_papel_comum_leva_403(client, comum, contas, rota):
    contas(venceu_ha=40)
    assert client.get(rota, headers=comum.headers).status_code == 403


@pytest.mark.parametrize("rota", ROTAS_GET)
def test_sem_token_leva_401(client, rota):
    assert client.get(rota).status_code == 401


@pytest.mark.parametrize("rota", ROTAS_GET)
def test_financeiro_e_admin_leem(client, financeiro, admin, contas, rota):
    contas(venceu_ha=40)
    assert client.get(rota, headers=financeiro.headers).status_code == 200
    assert client.get(rota, headers=admin.headers).status_code == 200


def test_lista_filtra_e_ordena(client, financeiro, contas):
    contas(nome="Alfa", doc="11111111000111", venceu_ha=40, valor=100)
    contas(nome="Beta", doc="22222222000122", venceu_ha=100, valor=50)
    r = client.get("/inadimplencia/empresas", params={"ordenar_por": "maior_atraso", "direcao": "desc"},
                   headers=financeiro.headers).json()
    assert [e["nome"] for e in r["itens"]] == ["Beta", "Alfa"]
    r = client.get("/inadimplencia/empresas", params={"faixa": "31_60"}, headers=financeiro.headers).json()
    assert [e["nome"] for e in r["itens"]] == ["Alfa"]


@pytest.mark.parametrize("params", [{"ordenar_por": "x"}, {"direcao": "lado"}, {"faixa": "x"},
                                    {"status": "inventado"}])
def test_parametros_invalidos_422(client, financeiro, params):
    assert client.get("/inadimplencia/empresas", params=params, headers=financeiro.headers).status_code == 422


def test_empresa_inexistente_404(client, financeiro, contas):
    assert client.get("/inadimplencia/empresas/99999999", headers=financeiro.headers).status_code == 404


def _contato(**extra):
    return {"ocorrido_em": datetime.now(timezone.utc).isoformat(), "canal": "telefone", **extra}


def test_comum_nao_escreve(client, comum, contas):
    contas(venceu_ha=40)
    assert client.post("/inadimplencia/empresas/11111111/eventos", json=_contato(),
                       headers=comum.headers).status_code == 403
    assert client.put("/inadimplencia/empresas/11111111/observacao", json={"texto": "x"},
                      headers=comum.headers).status_code == 403


def test_registra_contato_com_promessa_e_grava_quem(client, financeiro, contas, engine):
    from datetime import date, timedelta

    contas(venceu_ha=40)
    r = client.post("/inadimplencia/empresas/11111111/eventos", headers=financeiro.headers, json=_contato(
        status_novo="promessa", anotacao="Paga na sexta",
        promessa={"data": (date.today() + timedelta(days=3)).isoformat(), "valor": 500}))
    assert r.status_code == 200, r.text
    corpo = r.json()
    assert corpo["ciclo"]["status"] == "promessa"
    assert corpo["eventos"][0]["registrado_por"] == "ana"
    assert corpo["eventos"][0]["anotacao"] == "Paga na sexta"


def test_erro_de_regra_vira_422_com_mensagem(client, financeiro, contas):
    contas(venceu_ha=40)
    r = client.post("/inadimplencia/empresas/11111111/eventos", headers=financeiro.headers,
                    json=_contato(status_novo="pago"))
    assert r.status_code == 422
    assert "sistema" in r.json()["detail"]


def test_observacao(client, financeiro, contas):
    contas(venceu_ha=40)
    r = client.put("/inadimplencia/empresas/11111111/observacao", json={"texto": "Só boleto"},
                   headers=financeiro.headers)
    assert r.status_code == 200
    assert r.json()["observacao"] == "Só boleto"


def test_chave_sem_documento_com_barra_e_alcancavel(client, financeiro, contas):
    contas(nome="A/B Ltda", doc="", venceu_ha=40)
    itens = client.get("/inadimplencia/empresas", headers=financeiro.headers).json()["itens"]
    chave = itens[0]["empresa"]
    assert chave.startswith("nome:") and "/" not in chave
    assert client.get(f"/inadimplencia/empresas/{chave}", headers=financeiro.headers).status_code == 200


def test_anotacao_longa_vira_422_em_portugues(client, financeiro, contas):
    contas(venceu_ha=40)
    r = client.post("/inadimplencia/empresas/11111111/eventos", headers=financeiro.headers,
                    json=_contato(anotacao="x" * 4001))
    assert r.status_code == 422
    assert isinstance(r.json()["detail"], str) and "4.000" in r.json()["detail"]


def test_observacao_longa_vira_422_em_portugues(client, financeiro, contas):
    contas(venceu_ha=40)
    r = client.put("/inadimplencia/empresas/11111111/observacao", json={"texto": "x" * 4001},
                   headers=financeiro.headers)
    assert r.status_code == 422
    assert isinstance(r.json()["detail"], str) and "4.000" in r.json()["detail"]


def test_filtros_de_data_e_contato_chegam_a_lista_e_ao_resumo(client, financeiro, contas):
    from datetime import date, timedelta

    contas(nome="Alfa", doc="11111111000111", venceu_ha=40, valor=100)
    contas(nome="Alfa", doc="11111111000111", venceu_ha=100, valor=200)
    params = {"data_tipo": "vencimento", "sem_contato": "nunca",
              "data_inicio": (date.today() - timedelta(days=50)).isoformat(),
              "data_fim": (date.today() - timedelta(days=30)).isoformat()}
    r = client.get("/inadimplencia/empresas", params=params, headers=financeiro.headers).json()
    assert r["itens"][0]["valor_devido"] == 100
    r = client.get("/inadimplencia/resumo", params=params, headers=financeiro.headers).json()
    assert r["total_vencido"] == 100


@pytest.mark.parametrize("rota", ["/inadimplencia/empresas", "/inadimplencia/resumo"])
@pytest.mark.parametrize("params", [
    {"data_tipo": "pagamento"}, {"sem_contato": "5"},
    {"data_inicio": "2026-10-10", "data_fim": "2026-10-01"}, {"data_inicio": "ontem"}])
def test_filtros_invalidos_422(client, financeiro, rota, params):
    assert client.get(rota, params=params, headers=financeiro.headers).status_code == 422


def test_resumo_valida_status_e_faixa(client, financeiro):
    assert client.get("/inadimplencia/resumo", params={"faixa": "x"}, headers=financeiro.headers).status_code == 422
    assert client.get("/inadimplencia/resumo", params={"status": "inventado"},
                      headers=financeiro.headers).status_code == 422


def test_indicadores_recebe_os_filtros(client, financeiro, contas):
    contas(nome="Alfa", doc="11111111000111", venceu_ha=40, valor=100, categoria="Venda", uf="PE")
    contas(nome="Beta", doc="22222222000122", venceu_ha=40, valor=200, categoria=None, uf="SP")
    r = client.get("/inadimplencia/indicadores", headers=financeiro.headers,
                   params=[("categoria", "Venda"), ("categoria", "__sem__"), ("uf", "SP")]).json()
    assert r["total"]["valor"] == 200
    assert r["opcoes"] == {"categorias": ["Venda"], "formas_pagamento": [], "ufs": ["PE", "SP"]}
    r = client.get("/inadimplencia/indicadores", headers=financeiro.headers,
                   params={"cliente": "alfa", "forma_pagamento": "__sem__"}).json()
    assert r["total"]["valor"] == 100


def test_indicadores_recebe_o_periodo(client, financeiro, contas):
    from datetime import date, timedelta

    contas(venceu_ha=40, valor=100)
    mes = (date.today() - timedelta(days=40)).strftime("%Y-%m")
    r = client.get("/inadimplencia/indicadores", headers=financeiro.headers,
                   params={"mes_inicio": mes, "mes_fim": mes}).json()
    assert r["total"]["valor"] == 100
    r = client.get("/inadimplencia/indicadores", headers=financeiro.headers,
                   params={"mes_inicio": "2000-01", "mes_fim": "2000-02"}).json()
    assert r["total"]["valor"] == 0


@pytest.mark.parametrize("params", [{"mes_inicio": "2026-13"}, {"mes_fim": "10/2026"},
                                    {"mes_inicio": "2026-08", "mes_fim": "2026-07"}])
def test_indicadores_periodo_invalido_422(client, financeiro, params):
    r = client.get("/inadimplencia/indicadores", params=params, headers=financeiro.headers)
    assert r.status_code == 422
    assert isinstance(r.json()["detail"], str)
