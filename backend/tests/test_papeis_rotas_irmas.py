"""Papel nas rotas irmãs, fora da lista do agente: só o login chega nelas.

Antes de 10/11/2026 todas pediam apenas estar logado. A revisão de segurança apontou
`/centro_custo/config/` aberto ao lado de um relatório restrito à diretoria.
"""
import pytest

from tests.test_token_agente import (  # noqa: F401
    Chegou, banco_que_acusa_tarde, chave_configurada, pessoas, token,
)

# (método, caminho, quem passa)
DIRETORIA = "diretoria"
REGRAS = [
    ("GET", "/centro_custo/config/", DIRETORIA),
    ("POST", "/centro_custo/config/", DIRETORIA),
    ("GET", "/contas_pagar/", {"admin", "financeiro"}),
    ("GET", "/contas_receber/", {"admin", "financeiro"}),
    ("PATCH", "/notas_fiscais/1/tipo", {"admin", "vendas", "financeiro"}),
    ("POST", "/estoque/", {"admin"}),
    ("PUT", "/estoque/1", {"admin"}),
    ("DELETE", "/estoque/1", {"admin"}),
]


def _resultado(client, metodo, rota, headers):
    try:
        return client.request(metodo, rota, headers=headers, json={}).status_code
    except Chegou:
        return "passou"


@pytest.mark.parametrize("metodo,rota,quem", REGRAS)
def test_cada_papel_pelo_login(client, pessoas, banco_que_acusa_tarde, metodo, rota, quem):
    banco_que_acusa_tarde()
    for papel, (pelo_login, _) in pessoas.items():
        passa = papel in quem if quem != DIRETORIA else False  # pessoas nascem com id > 100
        r = _resultado(client, metodo, rota, pelo_login)
        # 422 = passou da autorização e parou na validação do corpo, antes do banco.
        assert (r in ("passou", 422)) == passa, (papel, metodo, rota, r)
        assert r != 401


@pytest.mark.parametrize("metodo,rota", [(m, r) for m, r, q in REGRAS if q == DIRETORIA])
def test_diretoria_por_id(client, criar_usuario, login, banco_que_acusa_tarde, metodo, rota):
    criar_usuario("um", papel="comum")  # id 1: entra por id, mesmo sendo comum
    h = login("um")
    banco_que_acusa_tarde()
    assert _resultado(client, metodo, rota, h) in ("passou", 422)


@pytest.mark.parametrize("metodo,rota,quem", REGRAS)
def test_agente_segue_recusado(client, pessoas, metodo, rota, quem):
    _, pelo_agente = pessoas["admin"]
    assert client.request(metodo, rota, headers=pelo_agente, json={}).status_code == 403
