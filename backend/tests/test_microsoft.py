from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import pytest
import requests

from app.core import microsoft
from app.core.config import settings


@pytest.fixture(autouse=True)
def config(monkeypatch):
    valores = {
        "MS_TENANT_ID": "tenant-teste",
        "MS_CLIENT_ID": "cliente-teste",
        "MS_CLIENT_SECRET": "segredo-teste",
        "MS_REDIRECT_URI": "https://api.teste/auth/microsoft/callback",
    }
    for chave, valor in valores.items():
        monkeypatch.setattr(settings, chave, valor)


def _resposta(status=200, corpo=None, json_quebrado=False):
    def _json():
        if json_quebrado:
            raise ValueError("não é JSON")
        return corpo or {}
    return SimpleNamespace(status_code=status, ok=200 <= status < 300, json=_json)


def test_url_de_autorizacao_leva_os_parametros_certos():
    url = urlparse(microsoft.url_de_autorizacao("estado-123"))
    assert url.scheme == "https"
    assert url.netloc == "login.microsoftonline.com"
    assert url.path == "/tenant-teste/oauth2/v2.0/authorize"
    q = {k: v[0] for k, v in parse_qs(url.query).items()}
    assert q == {
        "client_id": "cliente-teste",
        "response_type": "code",
        "redirect_uri": "https://api.teste/auth/microsoft/callback",
        "response_mode": "query",
        "scope": "openid email profile User.Read",
        "state": "estado-123",
    }


def test_trocar_code_manda_o_formulario_e_devolve_o_token(monkeypatch):
    chamadas = []

    def post(url, data, timeout):
        chamadas.append((url, data, timeout))
        return _resposta(corpo={"access_token": "tok-ms"})

    monkeypatch.setattr(microsoft.requests, "post", post)
    assert microsoft.trocar_code_por_token("code-1") == "tok-ms"
    url, data, timeout = chamadas[0]
    assert url == "https://login.microsoftonline.com/tenant-teste/oauth2/v2.0/token"
    assert data == {
        "grant_type": "authorization_code",
        "client_id": "cliente-teste",
        "client_secret": "segredo-teste",
        "code": "code-1",
        "redirect_uri": "https://api.teste/auth/microsoft/callback",
        "scope": "openid email profile User.Read",
    }
    assert timeout == 10


@pytest.mark.parametrize(
    "resposta",
    [_resposta(status=400, corpo={"error": "invalid_grant"}), _resposta(corpo={}), _resposta(json_quebrado=True)],
    ids=["http-400", "sem-access-token", "json-quebrado"],
)
def test_trocar_code_com_resposta_ruim_levanta_erro(monkeypatch, resposta):
    monkeypatch.setattr(microsoft.requests, "post", lambda *a, **k: resposta)
    with pytest.raises(microsoft.ErroMicrosoft):
        microsoft.trocar_code_por_token("code-1")


def test_trocar_code_com_falha_de_rede_levanta_erro(monkeypatch):
    def post(*a, **k):
        raise requests.ConnectionError("sem rede")

    monkeypatch.setattr(microsoft.requests, "post", post)
    with pytest.raises(microsoft.ErroMicrosoft):
        microsoft.trocar_code_por_token("code-1")


def test_email_usa_mail(monkeypatch):
    chamadas = []

    def get(url, headers, params, timeout):
        chamadas.append((url, headers, params))
        return _resposta(corpo={"mail": "Maria@HealthSafetyTech.com", "userPrincipalName": "outra@x"})

    monkeypatch.setattr(microsoft.requests, "get", get)
    assert microsoft.email_do_usuario("tok-ms") == "Maria@HealthSafetyTech.com"
    url, headers, params = chamadas[0]
    assert url == "https://graph.microsoft.com/v1.0/me"
    assert headers == {"Authorization": "Bearer tok-ms"}
    assert params == {"$select": "mail,userPrincipalName"}


def test_email_sem_mail_cai_no_user_principal_name(monkeypatch):
    monkeypatch.setattr(
        microsoft.requests, "get",
        lambda *a, **k: _resposta(corpo={"mail": None, "userPrincipalName": "ti03@healthsafetytech.com"}),
    )
    assert microsoft.email_do_usuario("tok-ms") == "ti03@healthsafetytech.com"


def test_email_sem_nenhum_devolve_none(monkeypatch):
    monkeypatch.setattr(microsoft.requests, "get", lambda *a, **k: _resposta(corpo={}))
    assert microsoft.email_do_usuario("tok-ms") is None


def test_email_com_http_401_levanta_erro(monkeypatch):
    monkeypatch.setattr(microsoft.requests, "get", lambda *a, **k: _resposta(status=401))
    with pytest.raises(microsoft.ErroMicrosoft):
        microsoft.email_do_usuario("tok-ms")
