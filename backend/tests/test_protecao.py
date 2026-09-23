import logging

import pytest
from fastapi.routing import APIRoute

from app.core.config import settings
from app.core.security import exigir_usuario


@pytest.fixture
def flag_ligada(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_OBRIGATORIA", True)


def test_flag_desligada_anonimo_passa_e_gera_warning(client, caplog):
    with caplog.at_level(logging.WARNING, logger="app.auth"):
        r = client.get("/marcadores/")
    assert r.status_code == 200
    assert "Acesso sem token" in caplog.text
    assert "'/marcadores/'" in caplog.text


def test_flag_desligada_token_invalido_passa_e_gera_warning(client, caplog):
    with caplog.at_level(logging.WARNING, logger="app.auth"):
        r = client.get("/marcadores/", headers={"Authorization": "Bearer lixo"})
    assert r.status_code == 200
    assert "Acesso com token inválido" in caplog.text
    assert "'/marcadores/'" in caplog.text


def test_flag_desligada_path_forjado_com_quebra_de_linha_nao_forja_o_log(client, caplog):
    # /marcadores/{id} é int-typed, então a rota nem sempre bate — mas a
    # dependência de proteção (dependencies=PROTEGIDO no router) roda antes da
    # validação do path param, então mesmo um id inválido passa por ela.
    with caplog.at_level(logging.WARNING, logger="app.auth"):
        r = client.get("/marcadores/%0Afalso")
    registros = [x for x in caplog.records if x.name == "app.auth"]
    assert registros, "esperava um WARNING de app.auth"
    for registro in registros:
        assert "\n" not in registro.getMessage()


def test_token_valido_nao_gera_warning(client, comum, caplog):
    with caplog.at_level(logging.WARNING, logger="app.auth"):
        r = client.get("/marcadores/", headers=comum.headers)
    assert r.status_code == 200
    assert [x for x in caplog.records if x.name == "app.auth"] == []


def test_flag_ligada_bloqueia_anonimo_e_token_invalido(client, flag_ligada):
    for headers in ({}, {"Authorization": "Bearer lixo"}):
        r = client.get("/marcadores/", headers=headers)
        assert r.status_code == 401
        assert r.headers["www-authenticate"] == "Bearer"


def test_flag_ligada_libera_usuario_logado(client, comum, flag_ligada):
    assert client.get("/marcadores/", headers=comum.headers).status_code == 200


@pytest.mark.parametrize("rota", ["/", "/docs", "/redoc", "/openapi.json"])
def test_rotas_publicas_continuam_publicas_com_flag_ligada(client, flag_ligada, rota):
    assert client.get(rota).status_code == 200


def test_login_continua_publico_com_flag_ligada(client, criar_usuario, flag_ligada):
    criar_usuario("maria")
    r = client.post("/auth/login", json={"username": "maria", "password": "senha123"})
    assert r.status_code == 200


def test_toda_rota_de_dados_esta_protegida():
    # Pega o router novo que alguém registrar sem dependencies=PROTEGIDO.
    from app.main import app

    abertas = [
        r.path
        for r in app.routes
        if isinstance(r, APIRoute)
        and r.path != "/"
        and not r.path.startswith("/auth")
        and not any(d.dependency is exigir_usuario for d in r.dependencies)
    ]
    assert abertas == []


def test_openapi_declara_bearer(client):
    esquema = client.get("/openapi.json").json()
    assert "HTTPBearer" in esquema["components"]["securitySchemes"]
