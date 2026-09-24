import threading
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import pytest

from app.core import microsoft
from app.core.config import settings

FRONT = "https://front.teste"


@pytest.fixture
def sso(monkeypatch):
    """SSO ligado com valores falsos e a Microsoft simulada."""
    valores = {
        "MS_TENANT_ID": "tenant-teste",
        "MS_CLIENT_ID": "cliente-teste",
        "MS_CLIENT_SECRET": "segredo-teste",
        "MS_REDIRECT_URI": "http://testserver/auth/microsoft/callback",
        "FRONTEND_URL": FRONT + "/",  # barra no fim de propósito: não pode duplicar
    }
    for chave, valor in valores.items():
        monkeypatch.setattr(settings, chave, valor)

    falso = SimpleNamespace(email="maria@healthsafetytech.com", erro=None, codes=[])

    def trocar(code):
        falso.codes.append(code)
        if falso.erro:
            raise microsoft.ErroMicrosoft(falso.erro)
        return "token-ms"

    monkeypatch.setattr(microsoft, "trocar_code_por_token", trocar)
    monkeypatch.setattr(microsoft, "email_do_usuario", lambda token: falso.email)
    return falso


def _callback(client, state="s1", cookie="s1", **extra):
    params = {"state": state, "code": "code-ms", **extra}
    params = {k: v for k, v in params.items() if v is not None}
    headers = {"Cookie": f"sso_state={cookie}"} if cookie is not None else {}
    return client.get("/auth/microsoft/callback", params=params, headers=headers, follow_redirects=False)


def _destino(resposta):
    assert resposta.status_code == 302, resposta.text
    url = urlparse(resposta.headers["location"])
    return f"{url.scheme}://{url.netloc}{url.path}", {k: v[0] for k, v in parse_qs(url.query).items()}


def _erro(resposta):
    destino, q = _destino(resposta)
    assert destino == FRONT + "/login"
    return q["erro_sso"]


# ---------- status ----------

def test_status_desligado_por_padrao(client):
    assert client.get("/auth/sso/status").json() == {"ativo": False}


def test_status_ligado(client, sso):
    assert client.get("/auth/sso/status").json() == {"ativo": True}


# ---------- início ----------

def test_inicio_redireciona_para_a_microsoft_e_grava_o_state(client, sso):
    r = client.get("/auth/microsoft", follow_redirects=False)
    assert r.status_code == 302
    url = urlparse(r.headers["location"])
    assert url.netloc == "login.microsoftonline.com"
    state = parse_qs(url.query)["state"][0]
    assert len(state) >= 40
    cookie = r.headers["set-cookie"]
    assert f"sso_state={state}" in cookie
    for atributo in ("HttpOnly", "Secure", "Path=/auth/microsoft", "Max-Age=600"):
        assert atributo in cookie
    assert "samesite=lax" in cookie.lower()


def test_inicio_gera_state_novo_a_cada_vez(client, sso):
    estados = {
        parse_qs(urlparse(client.get("/auth/microsoft", follow_redirects=False).headers["location"]).query)["state"][0]
        for _ in range(3)
    }
    assert len(estados) == 3


def test_inicio_com_sso_desligado_manda_de_volta_ao_login(client, monkeypatch):
    monkeypatch.setattr(settings, "FRONTEND_URL", FRONT)
    assert _erro(client.get("/auth/microsoft", follow_redirects=False)) == "sso_desligado"


def test_inicio_sem_nada_configurado_responde_404(client):
    assert client.get("/auth/microsoft", follow_redirects=False).status_code == 404


# ---------- callback ----------

def test_callback_feliz_manda_ticket_ao_front(client, sso, criar_usuario):
    criar_usuario("maria", email="maria@healthsafetytech.com")
    r = _callback(client)
    destino, q = _destino(r)
    assert destino == FRONT + "/auth/callback"
    assert set(q) == {"ticket"}
    assert sso.codes == ["code-ms"]
    # o cookie do state é apagado na volta
    assert 'sso_state=""' in r.headers["set-cookie"] or "sso_state=;" in r.headers["set-cookie"]


def test_email_com_maiusculas_e_espacos_acha_o_usuario(client, sso, criar_usuario):
    criar_usuario("maria", email="maria@healthsafetytech.com")
    sso.email = "  Maria@HealthSafetyTech.COM "
    destino, _ = _destino(_callback(client))
    assert destino == FRONT + "/auth/callback"


@pytest.mark.parametrize(
    "state,cookie",
    [("outro", "s1"), (None, "s1"), ("s1", None), ("çãé🙂", "s1"), ("s1", "")],
    ids=["diferente", "sem-state", "sem-cookie", "state-com-acento", "cookie-vazio"],
)
def test_state_invalido_nunca_da_500(client, sso, criar_usuario, state, cookie):
    criar_usuario("maria", email="maria@healthsafetytech.com")
    assert _erro(_callback(client, state=state, cookie=cookie)) == "state_invalido"
    assert sso.codes == []  # nem chega a falar com a Microsoft


def test_cancelar_na_microsoft(client, sso):
    assert _erro(_callback(client, code=None, error="access_denied")) == "cancelado"


def test_outro_erro_da_microsoft(client, sso):
    assert _erro(_callback(client, code=None, error="server_error")) == "falha_microsoft"


def test_sem_code(client, sso):
    assert _erro(_callback(client, code=None)) == "falha_microsoft"


def test_falha_na_troca(client, sso):
    sso.erro = "troca do code: HTTP 400"
    assert _erro(_callback(client)) == "falha_microsoft"


@pytest.mark.parametrize("email", [None, "", "sem-arroba", "ninguem@healthsafetytech.com"])
def test_email_sem_usuario(client, sso, criar_usuario, email):
    criar_usuario("maria", email="maria@healthsafetytech.com")
    sso.email = email
    assert _erro(_callback(client)) == "usuario_nao_encontrado"


def test_callback_com_sso_desligado(client, monkeypatch):
    monkeypatch.setattr(settings, "FRONTEND_URL", FRONT)
    assert _erro(_callback(client)) == "sso_desligado"


# ---------- troca ----------

def _ticket(client, criar_usuario, papel="financeiro"):
    uid = criar_usuario("maria", papel=papel, email="maria@healthsafetytech.com")
    _, q = _destino(_callback(client))
    return uid, q["ticket"]


def test_troca_devolve_o_mesmo_formato_do_login(client, sso, criar_usuario):
    uid, ticket = _ticket(client, criar_usuario)
    r = client.post("/auth/sso/exchange", json={"ticket": ticket})
    assert r.status_code == 200
    corpo = r.json()
    assert set(corpo) == {"access_token", "token_type", "role", "username", "user_id"}
    assert (corpo["token_type"], corpo["role"], corpo["username"], corpo["user_id"]) == (
        "bearer", "financeiro", "maria", uid,
    )
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {corpo['access_token']}"})
    assert me.status_code == 200 and me.json()["id"] == uid


def test_troca_e_de_uso_unico(client, sso, criar_usuario):
    _, ticket = _ticket(client, criar_usuario)
    assert client.post("/auth/sso/exchange", json={"ticket": ticket}).status_code == 200
    r = client.post("/auth/sso/exchange", json={"ticket": ticket})
    assert r.status_code == 400
    assert r.json()["detail"] == "Link de acesso inválido ou expirado."


@pytest.mark.parametrize("ticket", ["inventado", "", "a\x00b"])
def test_troca_com_ticket_invalido(client, ticket):
    r = client.post("/auth/sso/exchange", json={"ticket": ticket})
    assert r.status_code == 400
    assert r.json()["detail"] == "Link de acesso inválido ou expirado."


def test_troca_de_usuario_excluido_no_meio(client, sso, criar_usuario, engine):
    from sqlalchemy import text

    _, ticket = _ticket(client, criar_usuario)
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM auth.usuarios WHERE username = 'maria'"))
    assert client.post("/auth/sso/exchange", json={"ticket": ticket}).status_code == 400


def test_ticket_gigante_e_recusado_sem_ir_ao_banco(client):
    assert client.post("/auth/sso/exchange", json={"ticket": "x" * 500}).status_code == 422
