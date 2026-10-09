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
