"""GET /agente/capacidades: o que o Guardi alcança aqui com o login da pessoa.

A tabela `QUEM_PASSA_NAS_ROTAS_DO_AGENTE` (core/security.py) é presa às rotas por
`test_tabela_bate_com_as_rotas`: papel a papel, a rota declarada aberta passa da
autorização e a fechada leva 403 — pelo token de agente, o caminho que importa aqui.
"""
import pytest

from app.core.security import QUEM_PASSA_NAS_ROTAS_DO_AGENTE, ROTAS_DO_AGENTE, rotas_do_agente_para
from tests.test_token_agente import (  # noqa: F401
    ABRE, Chegou, _concreto, banco_que_acusa_tarde, chave_configurada, flag, pessoas, token,
)

CAPACIDADES = "/agente/capacidades"


def _resultado(client, rota, headers):
    try:
        return client.get(_concreto(rota), headers=headers).status_code
    except Chegou:
        return "passou"


def _declarada_aberta(usuario_papel, usuario_id, rota):
    from types import SimpleNamespace
    u = SimpleNamespace(id=usuario_id, papel=SimpleNamespace(nome=usuario_papel))
    return ["GET", rota] in rotas_do_agente_para(u)


@pytest.mark.parametrize("papel", list(ABRE))
def test_tabela_bate_com_as_rotas(client, pessoas, banco_que_acusa_tarde, papel):
    _, pelo_agente = pessoas[papel]
    banco_que_acusa_tarde()
    for rota in sorted(ROTAS_DO_AGENTE - {CAPACIDADES}):
        aberta = _declarada_aberta(papel, 101, rota)  # pessoas nascem com id > 100
        r = _resultado(client, rota, pelo_agente)
        assert (r == "passou") == aberta, (papel, rota, r)
        assert r in ("passou", 403), (papel, rota, r)


def test_tabela_bate_com_as_rotas_na_diretoria(client, criar_usuario, engine, banco_que_acusa_tarde):
    from sqlalchemy import text
    with engine.begin() as conn:
        conn.execute(text("SELECT setval('auth.usuarios_id_seq', 3, false)"))  # próximo id = 3
    criar_usuario("dentro", papel="comum", email="dentro@healthsafetytech.com")  # id 3
    h = token(sub="dentro@healthsafetytech.com")
    banco_que_acusa_tarde()
    for rota in sorted(ROTAS_DO_AGENTE - {CAPACIDADES}):
        r = _resultado(client, rota, h)
        assert (r == "passou") == _declarada_aberta("comum", 3, rota), (rota, r)


def test_tabela_cobre_a_lista_e_so_ela():
    assert set(QUEM_PASSA_NAS_ROTAS_DO_AGENTE) == ROTAS_DO_AGENTE


@pytest.mark.parametrize("papel,rotulo", [
    ("admin", "Administrador"), ("financeiro", "Financeiro"), ("vendas", "Vendas"),
    ("servicos", "Serviços"), ("comum", "Comum"),
])
def test_responde_papel_e_rotas_do_login(client, pessoas, flag, papel, rotulo):
    _, pelo_agente = pessoas[papel]
    r = client.get(CAPACIDADES, headers=pelo_agente)
    assert r.status_code == 200, r.text
    corpo = r.json()
    assert corpo["papel"] == rotulo
    esperado = sorted(["GET", rota] for rota in ABRE[papel])
    assert sorted(corpo["rotas"]) == esperado


def test_vendas_ve_clientes_e_nao_ve_inadimplencia(client, pessoas):
    rotas = client.get(CAPACIDADES, headers=pessoas["vendas"][1]).json()["rotas"]
    assert ["GET", "/clientes/"] in rotas
    assert ["GET", "/agente/capacidades"] in rotas
    assert not [m for m, r in rotas if r.startswith("/inadimplencia")]
    assert all(m == "GET" for m, _ in rotas)


def test_diretoria_por_id_ve_notas_de_entrada(client, criar_usuario, engine):
    from sqlalchemy import text
    with engine.begin() as conn:
        conn.execute(text("SELECT setval('auth.usuarios_id_seq', 4, false)"))  # próximo id = 4
    criar_usuario("dono", papel="comum", email="dono@healthsafetytech.com")
    rotas = client.get(CAPACIDADES, headers=token(sub="dono@healthsafetytech.com")).json()["rotas"]
    assert ["GET", "/notas_entrada/pagina"] in rotas
    assert ["GET", "/centro_custo/resumo_produto/"] in rotas
    assert ["GET", "/clientes/"] not in rotas


def test_login_normal_leva_404(client, admin, flag):
    assert client.get(CAPACIDADES, headers=admin.headers).status_code == 404


def test_sem_token_nao_responde(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "AUTH_OBRIGATORIA", True)
    assert client.get(CAPACIDADES).status_code == 401
    monkeypatch.setattr(settings, "AUTH_OBRIGATORIA", False)
    assert client.get(CAPACIDADES).status_code == 404


@pytest.mark.parametrize("headers", [
    pytest.param(lambda: token(sub="ninguem@healthsafetytech.com"), id="sem-usuario"),
    pytest.param(lambda: token(aud="taskhs"), id="aud-errado"),
])
def test_token_invalido_leva_401(client, pessoas, headers):
    assert client.get(CAPACIDADES, headers=headers()).status_code == 401


def test_escrita_recusa_o_agente(client, pessoas):
    assert client.post(CAPACIDADES, headers=pessoas["admin"][1]).status_code in (403, 405)
