from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.core.config import settings

HASH_AUTHAPI = "$2b$12$ePWpw.mP7U.dQzH/FYu8L.IVq1sjlXV3VQ.Pt.vJhQLSS/ExU8Q6e"


# ---------- login ----------

def test_login_devolve_token_e_dados_como_o_authapi(client, criar_usuario):
    uid = criar_usuario("maria", senha="segredo1", papel="financeiro")
    r = client.post("/auth/login", json={"username": "maria", "password": "segredo1"})
    assert r.status_code == 200
    corpo = r.json()
    assert set(corpo) == {"access_token", "token_type", "role", "username", "user_id"}
    assert corpo["token_type"] == "bearer"
    assert corpo["role"] == "financeiro"
    assert corpo["username"] == "maria"
    assert corpo["user_id"] == uid


def test_login_ignora_maiusculas_e_espacos_no_username(client, criar_usuario):
    criar_usuario("maria", senha="segredo1")
    r = client.post("/auth/login", json={"username": "  Maria ", "password": "segredo1"})
    assert r.status_code == 200


def test_login_com_hash_copiado_do_authapi(client, criar_usuario):
    criar_usuario("antigo", senha_hash=HASH_AUTHAPI)
    r = client.post("/auth/login", json={"username": "antigo", "password": "senha-do-authapi"})
    assert r.status_code == 200


@pytest.mark.parametrize(
    "username,senha",
    [
        ("maria", "errada"),
        ("ninguem", "segredo1"),
        ("maria", "x" * 100),
        ("maria", ""),
        ("ma\x00ria", "segredo1"),
    ],
    ids=["senha-errada", "usuario-inexistente", "senha-longa", "senha-vazia", "username-com-nul"],
)
def test_login_invalido_devolve_401(client, criar_usuario, username, senha):
    criar_usuario("maria", senha="segredo1")
    r = client.post("/auth/login", json={"username": username, "password": senha})
    assert r.status_code == 401
    assert r.json()["detail"] == "Incorrect username or password"


# ---------- token ----------

def _token(dados, chave=None):
    return {"Authorization": "Bearer " + jwt.encode(dados, chave or settings.SECRET_KEY, algorithm="HS256")}


def test_me_devolve_o_proprio_usuario(client, criar_usuario, login):
    uid = criar_usuario("maria", papel="financeiro", email="maria@hs.com")
    r = client.get("/auth/me", headers=login("maria"))
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["id"] == uid
    assert corpo["username"] == "maria"
    assert corpo["email"] == "maria@hs.com"
    assert corpo["role"] == {"id": 3, "name": "financeiro"}
    assert corpo["created_at"]
    assert "senha_hash" not in corpo and "password" not in corpo


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Bearer lixo"},
        {"Authorization": "Basic dXNlcjpzZW5oYQ=="},
        "outra-chave",
        "expirado",
    ],
    ids=["sem-header", "lixo", "basic", "outra-chave", "expirado"],
)
def test_me_sem_token_valido_devolve_401(client, comum, headers):
    agora = datetime.now(timezone.utc)
    if headers == "outra-chave":
        headers = _token({"user_id": comum.id, "exp": agora + timedelta(minutes=5)}, chave="chave-do-authapi-antiga-com-32-bytes-ou-mais")
    elif headers == "expirado":
        headers = _token({"user_id": comum.id, "exp": agora - timedelta(seconds=1)})
    r = client.get("/auth/me", headers=headers)
    assert r.status_code == 401
    assert r.headers["www-authenticate"] == "Bearer"


def test_token_de_usuario_excluido_para_de_valer(client, admin, comum):
    assert client.delete(f"/auth/users/{comum.id}", headers=admin.headers).status_code == 204
    assert client.get("/auth/me", headers=comum.headers).status_code == 401


def test_admin_rebaixado_perde_o_acesso_na_hora(client, admin, criar_usuario, login):
    outro_id = criar_usuario("vice", papel="admin")
    vice = login("vice")
    assert client.get("/auth/users", headers=vice).status_code == 200
    r = client.put(f"/auth/users/{outro_id}", json={"role_name": "comum"}, headers=admin.headers)
    assert r.status_code == 200
    assert client.get("/auth/users", headers=vice).status_code == 403


# ---------- leitura ----------

def test_roles_exige_login(client, comum):
    assert client.get("/auth/roles").status_code == 401
    r = client.get("/auth/roles", headers=comum.headers)
    assert r.status_code == 200
    assert [p["name"] for p in r.json()] == ["admin", "comum", "financeiro"]


def test_listar_usuarios_so_admin(client, admin, comum):
    assert client.get("/auth/users").status_code == 401
    r = client.get("/auth/users", headers=comum.headers)
    assert r.status_code == 403
    assert r.json()["detail"] == "Acesso restrito a administradores."
    r = client.get("/auth/users", headers=admin.headers)
    assert r.status_code == 200
    assert [u["id"] for u in r.json()] == sorted([admin.id, comum.id])


def test_ver_usuario_por_id(client, admin, comum):
    assert client.get(f"/auth/users/{comum.id}").status_code == 401
    assert client.get(f"/auth/users/{comum.id}", headers=comum.headers).status_code == 200
    assert client.get(f"/auth/users/{admin.id}", headers=comum.headers).status_code == 403
    assert client.get(f"/auth/users/{comum.id}", headers=admin.headers).status_code == 200
    r = client.get("/auth/users/9999", headers=admin.headers)
    assert r.status_code == 404
    assert r.json()["detail"] == "Usuário 9999 não encontrado"


# ---------- cadastro ----------

def test_register_exige_admin(client, comum):
    novo = {"username": "novo", "password": "senha123"}
    assert client.post("/auth/register", json=novo).status_code == 401
    assert client.post("/auth/register", json=novo, headers=comum.headers).status_code == 403


def test_register_cria_com_papel_padrao_comum(client, admin, login):
    r = client.post("/auth/register", json={"username": "Novo ", "password": "senha123"}, headers=admin.headers)
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["username"] == "novo"
    assert corpo["role"]["name"] == "comum"
    assert corpo["email"] is None
    login("novo")  # a senha cadastrada funciona


def test_register_com_papel_e_email_normalizado(client, admin):
    r = client.post(
        "/auth/register",
        json={"username": "ana", "password": "senha123", "role_name": "financeiro", "email": " Ana@HS.com "},
        headers=admin.headers,
    )
    assert r.status_code == 200
    assert r.json()["role"]["name"] == "financeiro"
    assert r.json()["email"] == "ana@hs.com"


def test_register_email_vazio_vira_null_e_nao_colide(client, admin):
    for nome in ("um", "dois"):
        r = client.post("/auth/register", json={"username": nome, "password": "senha123", "email": ""}, headers=admin.headers)
        assert r.status_code == 200
        assert r.json()["email"] is None


def test_register_recusa_duplicados_e_papel_inexistente(client, admin, criar_usuario):
    criar_usuario("maria", email="maria@hs.com")
    casos = [
        ({"username": "MARIA", "password": "senha123"}, "Username already registered"),
        ({"username": "outra", "password": "senha123", "email": "MARIA@hs.com"}, "E-mail já cadastrado."),
        ({"username": "outra", "password": "senha123", "role_name": "chefao"}, "Role 'chefao' not found."),
    ]
    for corpo, detalhe in casos:
        r = client.post("/auth/register", json=corpo, headers=admin.headers)
        assert r.status_code == 400, corpo
        assert r.json()["detail"] == detalhe


@pytest.mark.parametrize(
    "corpo",
    [
        {"username": "   ", "password": "senha123"},
        {"username": "x", "password": ""},
        {"username": "x", "password": "x" * 73},
        {"username": "x", "password": "senha123", "email": "sem-arroba"},
        {"username": "ma\x00ria", "password": "senha123"},
        {"username": "x", "password": "senha123", "email": "ma\x00ria@hs.com"},
        {"username": "x", "password": "senha123", "role_name": "ad\x00min"},
    ],
    ids=[
        "username-vazio",
        "senha-vazia",
        "senha-73-bytes",
        "email-invalido",
        "username-nul",
        "email-nul",
        "role_name-nul",
    ],
)
def test_register_valida_entrada_com_422(client, admin, corpo):
    assert client.post("/auth/register", json=corpo, headers=admin.headers).status_code == 422


# ---------- edição ----------

def test_put_exige_admin_ate_para_o_proprio_usuario(client, comum):
    assert client.put(f"/auth/users/{comum.id}", json={"password": "nova1234"}).status_code == 401
    r = client.put(f"/auth/users/{comum.id}", json={"password": "nova1234"}, headers=comum.headers)
    assert r.status_code == 403


def test_admin_troca_senha(client, admin, comum):
    r = client.put(f"/auth/users/{comum.id}", json={"password": "nova1234"}, headers=admin.headers)
    assert r.status_code == 200
    assert client.post("/auth/login", json={"username": "joao", "password": "senha123"}).status_code == 401
    assert client.post("/auth/login", json={"username": "joao", "password": "nova1234"}).status_code == 200


def test_admin_define_e_limpa_email(client, admin, comum):
    r = client.put(f"/auth/users/{comum.id}", json={"email": "Joao@HS.com"}, headers=admin.headers)
    assert r.json()["email"] == "joao@hs.com"
    r = client.put(f"/auth/users/{comum.id}", json={"username": "joao2"}, headers=admin.headers)
    assert r.json()["email"] == "joao@hs.com"  # campo não enviado não muda
    r = client.put(f"/auth/users/{comum.id}", json={"email": ""}, headers=admin.headers)
    assert r.json()["email"] is None


def test_put_corpo_vazio_nao_muda_nada(client, admin, comum):
    antes = client.get(f"/auth/users/{comum.id}", headers=admin.headers).json()
    r = client.put(f"/auth/users/{comum.id}", json={}, headers=admin.headers)
    assert r.status_code == 200
    assert r.json() == antes


@pytest.mark.parametrize(
    "corpo",
    [{"username": "jo\x00ao"}, {"email": "jo\x00ao@hs.com"}, {"role_name": "ad\x00min"}],
    ids=["username-nul", "email-nul", "role_name-nul"],
)
def test_put_username_ou_email_com_nul_devolve_422(client, admin, comum, corpo):
    r = client.put(f"/auth/users/{comum.id}", json=corpo, headers=admin.headers)
    assert r.status_code == 422


def test_put_recusa_conflitos(client, admin, comum, criar_usuario):
    criar_usuario("maria", email="maria@hs.com")
    casos = [
        ({"username": "Maria"}, 400, "Username already registered"),
        ({"email": "maria@hs.com"}, 400, "E-mail já cadastrado."),
        ({"role_name": "chefao"}, 400, "Role 'chefao' not found."),
    ]
    for corpo, status, detalhe in casos:
        r = client.put(f"/auth/users/{comum.id}", json=corpo, headers=admin.headers)
        assert r.status_code == status, corpo
        assert r.json()["detail"] == detalhe
    r = client.put("/auth/users/9999", json={"email": "x@hs.com"}, headers=admin.headers)
    assert r.status_code == 404
    assert r.json()["detail"] == "User not found"


def test_put_manter_o_proprio_username_nao_e_conflito(client, admin, comum):
    r = client.put(f"/auth/users/{comum.id}", json={"username": "JOAO"}, headers=admin.headers)
    assert r.status_code == 200


def test_admin_nao_tira_o_proprio_papel_de_admin(client, admin):
    r = client.put(f"/auth/users/{admin.id}", json={"role_name": "comum"}, headers=admin.headers)
    assert r.status_code == 400
    assert r.json()["detail"] == "Não é possível remover seu próprio papel de administrador."
    r = client.put(f"/auth/users/{admin.id}", json={"role_name": "admin"}, headers=admin.headers)
    assert r.status_code == 200


# ---------- exclusão ----------

def test_delete(client, admin, comum):
    assert client.delete(f"/auth/users/{comum.id}").status_code == 401
    assert client.delete(f"/auth/users/{admin.id}", headers=comum.headers).status_code == 403
    r = client.delete(f"/auth/users/{admin.id}", headers=admin.headers)
    assert r.status_code == 400
    assert r.json()["detail"] == "Não é possível excluir seu próprio usuário."
    assert client.delete(f"/auth/users/{comum.id}", headers=admin.headers).status_code == 204
    r = client.delete(f"/auth/users/{comum.id}", headers=admin.headers)
    assert r.status_code == 404
    assert r.json()["detail"] == "Usuário não encontrado."
