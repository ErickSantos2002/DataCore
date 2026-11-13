"""Token de agente do HS.OS: Iris e Guardis leem o DataCore como a pessoa do `sub`.

Pedido vindo do HS.OS em 10/11/2026; mesmo desenho do TaskHS (v2.13.0). As rotas
aceitas são a lista fechada `ROTAS_DO_AGENTE` (core/security.py), só GET.
"""
import importlib
import pkgutil
import re
import time

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.core.config import settings
from app.core.security import ROTAS_DO_AGENTE
from tests.semente_contas import contas, tabela_contas  # noqa: F401
from tests.test_inadimplencia_api import ROTAS_GET, _contato, limpa, tabelas  # noqa: F401

CHAVE = Ed25519PrivateKey.generate()
PEM_PUBLICO = CHAVE.public_key().public_bytes(
    serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
).decode()


@pytest.fixture(autouse=True)
def chave_configurada(monkeypatch):
    # Como o EasyPanel guarda: uma linha só, com \n literal.
    monkeypatch.setattr(settings, "HSOS_AGENTE_CHAVE_PUBLICA", PEM_PUBLICO.replace("\n", "\\n"))


@pytest.fixture(params=[False, True], ids=["flag-desligada", "flag-ligada"])
def flag(request, monkeypatch):
    monkeypatch.setattr(settings, "AUTH_OBRIGATORIA", request.param)


def token(sub="np@healthsafetytech.com", aud="datacore", vida=300, chave=CHAVE, **extra):
    payload = {"iss": "hsos", "aud": aud, "sub": sub, "act": {"sub": "iris"},
               "exp": int(time.time()) + vida, **extra}
    return {"Authorization": f"Bearer {jwt.encode(payload, chave, algorithm='EdDSA')}"}


@pytest.fixture
def nicholson(criar_usuario):
    return criar_usuario("nicholson", papel="admin", email="NP@healthsafetytech.com")


@pytest.mark.parametrize("rota", ROTAS_GET)
def test_token_valido_le_as_leituras(client, nicholson, contas, flag, rota):
    contas(venceu_ha=40)
    r = client.get(rota, headers=token())
    assert r.status_code == 200, r.text


def test_resumo_traz_o_mesmo_que_o_login(client, nicholson, admin, contas):
    contas(venceu_ha=40)
    pelo_agente = client.get("/inadimplencia/resumo", headers=token()).json()
    assert pelo_agente == client.get("/inadimplencia/resumo", headers=admin.headers).json()


@pytest.mark.parametrize("headers", [
    pytest.param(lambda: token(aud="taskhs"), id="aud-errado"),
    pytest.param(lambda: token(vida=-60), id="vencido"),
    pytest.param(lambda: token(vida=3600), id="exp-longe-demais"),
    pytest.param(lambda: token(sub="ninguem@healthsafetytech.com"), id="email-sem-usuario"),
    pytest.param(lambda: token(chave=Ed25519PrivateKey.generate()), id="outra-chave"),
    pytest.param(lambda: token(act=None), id="sem-act"),
])
def test_token_invalido_leva_401(client, nicholson, flag, headers):
    assert client.get("/inadimplencia/resumo", headers=headers()).status_code == 401


def test_sem_chave_configurada_leva_401(client, nicholson, monkeypatch):
    monkeypatch.setattr(settings, "HSOS_AGENTE_CHAVE_PUBLICA", "")
    assert client.get("/inadimplencia/resumo", headers=token()).status_code == 401


def test_aplica_o_papel_da_pessoa(client, criar_usuario, login, contas):
    criar_usuario("joao", papel="comum", email="joao@healthsafetytech.com")
    contas(venceu_ha=40)
    pelo_login = client.get("/inadimplencia/resumo", headers=login("joao"))
    pelo_agente = client.get("/inadimplencia/resumo", headers=token(sub="joao@healthsafetytech.com"))
    assert pelo_agente.status_code == pelo_login.status_code == 403
    assert pelo_agente.json() == pelo_login.json()


def test_escritas_recusam_o_agente(client, nicholson, contas, flag):
    contas(venceu_ha=40)
    h = token()
    assert client.post("/inadimplencia/empresas/11111111/eventos", json=_contato(),
                       headers=h).status_code == 403
    assert client.put("/inadimplencia/empresas/11111111/observacao", json={"texto": "x"},
                      headers=h).status_code == 403
    assert client.post("/inadimplencia/eventos/1/anexos", headers=h).status_code == 403
    assert client.get("/inadimplencia/anexos/1", headers=h).status_code == 403
    assert client.delete("/inadimplencia/anexos/1", headers=h).status_code == 403


def _rotas_get():
    """(caminho, métodos) de todas as rotas — o FastAPI 0.141 aninha os routers."""
    from fastapi.routing import APIRoute
    from app.main import app

    def andar(rotas):
        for r in rotas:
            if hasattr(r, "effective_route_contexts"):
                yield from r.effective_route_contexts()
            elif isinstance(r, APIRoute):
                yield r
    return [(r.path, r.methods) for r in andar(app.routes)]


def test_toda_rota_da_lista_existe_e_e_get():
    # Pega erro de digitação: rota da lista que não existe nunca abriria.
    gets = {caminho for caminho, metodos in _rotas_get() if "GET" in metodos}
    assert ROTAS_DO_AGENTE - gets == set()


class Chegou(Exception):
    """O endpoint pediu o banco: a autenticação já tinha deixado passar."""


@pytest.fixture
def banco_que_acusa(banco_que_acusa_tarde):
    # Cada endpoint tem a sua get_db; trocadas todas, nenhuma rota precisa das tabelas.
    banco_que_acusa_tarde()


@pytest.fixture
def banco_que_acusa_tarde():
    """O banco_que_acusa ligado quando o teste mandar (depois dos logins)."""
    from app.main import app

    def ligar():
        from app.api import endpoints as pacote

        def acusar():
            raise Chegou()
            yield  # noqa

        for m in pkgutil.iter_modules(pacote.__path__):
            modulo = importlib.import_module(f"app.api.endpoints.{m.name}")
            if hasattr(modulo, "get_db"):
                app.dependency_overrides[modulo.get_db] = acusar
    yield ligar
    app.dependency_overrides.clear()


def _concreto(caminho):
    return re.sub(r"\{[^}]+\}", "1", caminho)


# /agente/capacidades não vai ao banco (a pessoa já veio): tem testes próprios.
@pytest.mark.parametrize("rota", sorted(ROTAS_DO_AGENTE - {"/agente/capacidades"}))
def test_toda_rota_da_lista_aceita_o_agente(client, nicholson, banco_que_acusa, flag, rota):
    with pytest.raises(Chegou):
        client.get(_concreto(rota), headers=token())


@pytest.fixture
def joao_logado(criar_usuario, login):
    # Login antes do banco_que_acusa: o /auth/login também usa get_db.
    criar_usuario("joao", papel="comum", email="joao@healthsafetytech.com")
    return login("joao")


def test_comum_ve_pelo_agente_o_que_ve_pelo_login(client, joao_logado):
    # /faturamento/resumo é do comercial: o login do comum leva 403, e o agente dele
    # leva o mesmo 403, com a mesma mensagem.
    pelo_login = client.get("/faturamento/resumo", headers=joao_logado)
    pelo_agente = client.get("/faturamento/resumo", headers=token(sub="joao@healthsafetytech.com"))
    assert pelo_agente.status_code == pelo_login.status_code == 403
    assert pelo_agente.json() == pelo_login.json()


# O que cada papel abre entre as ROTAS_DO_AGENTE — o espelho do permissoes.ts.
LIVRES = {"/estoque/", "/estoque/{estoque_id}", "/faturamento/mensal", "/agente/capacidades"}
COMERCIAL = {"/faturamento/resumo", "/faturamento/filtros", "/faturamento/vendas",
             "/faturamento/vendas/{id_nota}/observacoes",
             "/clientes/", "/clientes/{id}"}  # liberadas ao vendas em 12/11 (Guardi do SDR)
SERVICOS = {"/faturamento/servicos", "/faturamento/servicos/resumo"}
DIRETORIA = {"/notas_fiscais/locacao/", "/centro_custo/resumo_produto/",
             "/notas_entrada/resumo", "/notas_entrada/pagina", "/notas_entrada/{id_nota}/itens"}
FINANCEIRO = ROTAS_DO_AGENTE - LIVRES - COMERCIAL - SERVICOS - DIRETORIA
ABRE = {
    "comum": LIVRES,
    "vendas": LIVRES | COMERCIAL,
    "servicos": LIVRES | SERVICOS,
    "financeiro": LIVRES | COMERCIAL | SERVICOS | FINANCEIRO,
    "admin": LIVRES | COMERCIAL | SERVICOS | FINANCEIRO,
}


def _resultado(client, rota, headers):
    try:
        return client.get(_concreto(rota), headers=headers).status_code
    except Chegou:
        return "passou"


@pytest.fixture
def pessoas(criar_usuario, login, engine):
    """Uma pessoa por papel, com login feito antes do banco_que_acusa."""
    from sqlalchemy import text
    with engine.begin() as conn:  # ids 1, 3 e 4 ficam para a diretoria, criada à parte
        conn.execute(text("SELECT setval('auth.usuarios_id_seq', 100)"))
        conn.execute(text("INSERT INTO auth.papeis (nome) VALUES ('vendas'), ('servicos')"))
    gente = {}
    for papel in ABRE:
        criar_usuario(f"p_{papel}", papel=papel, email=f"{papel}@healthsafetytech.com")
        gente[papel] = (login(f"p_{papel}"), token(sub=f"{papel}@healthsafetytech.com"))
    return gente


@pytest.mark.parametrize("papel", list(ABRE))
def test_cada_papel_abre_pelo_agente_o_mesmo_que_pelo_login(client, pessoas, banco_que_acusa, papel):
    pelo_login, pelo_agente = pessoas[papel]
    for rota in sorted(ROTAS_DO_AGENTE - DIRETORIA - {"/agente/capacidades"}
                       - {r for r in ROTAS_DO_AGENTE if r.startswith("/inadimplencia")}):
        esperado = "passou" if rota in ABRE[papel] else 403
        assert _resultado(client, rota, pelo_login) == esperado, (papel, rota, "login")
        assert _resultado(client, rota, pelo_agente) == esperado, (papel, rota, "agente")


def test_diretoria_e_por_id_nao_por_papel(client, criar_usuario, login, engine, banco_que_acusa_tarde):
    from sqlalchemy import text
    with engine.begin() as conn:
        conn.execute(text("SELECT setval('auth.usuarios_id_seq', 2, false)"))  # próximo id = 2
    criar_usuario("fora", papel="admin", email="fora@healthsafetytech.com")       # id 2
    criar_usuario("dentro", papel="comum", email="dentro@healthsafetytech.com")   # id 3
    fora = (login("fora"), token(sub="fora@healthsafetytech.com"))
    dentro = (login("dentro"), token(sub="dentro@healthsafetytech.com"))
    banco_que_acusa_tarde()
    for rota in DIRETORIA:
        for h in fora:
            assert _resultado(client, rota, h) == 403, rota
        for h in dentro:
            assert _resultado(client, rota, h) == "passou", rota


FORA_DA_LISTA = ["/auth/me", "/auth/roles", "/auth/users", "/configuracoes/", "/configuracoes/historico",
                 "/operacao/avisos", "/operacao/execucoes", "/inadimplencia/anexos/1",
                 "/centro_custo/config/", "/enderecos_entrega/", "/formas_envio/", "/marcadores/",
                 "/contas_receber/", "/contas_pagar/"]


@pytest.mark.parametrize("rota", FORA_DA_LISTA)
def test_rota_fora_da_lista_leva_403(client, nicholson, flag, rota):
    assert client.get(rota, headers=token()).status_code == 403


def test_fora_da_lista_e_403_mesmo_com_token_ruim(client, nicholson):
    # Rota fechada não conta se o token era bom.
    assert client.get("/marcadores/", headers=token(aud="taskhs")).status_code == 403


@pytest.mark.parametrize("metodo,rota", [
    ("post", "/estoque/"), ("put", "/estoque/1"), ("delete", "/estoque/1"),
    ("patch", "/notas_fiscais/1/tipo"), ("post", "/notas_servico/importar"),
    ("post", "/centro_custo/config/"), ("post", "/operacao/atualizacao-manual"),
    ("put", "/configuracoes/x"), ("post", "/auth/register"),
])
def test_escrita_em_qualquer_rota_leva_403(client, nicholson, flag, metodo, rota):
    assert client.request(metodo.upper(), rota, headers=token(), json={}).status_code == 403


def test_openapi_continua_publico(client):
    r = client.get("/openapi.json")
    assert r.status_code == 200
    assert "data_inicio" in str(r.json()["paths"]["/faturamento/resumo"])
