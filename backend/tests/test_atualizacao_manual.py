"""Botão "Atualizar dados agora": a fila `operacao.pedidos_atualizacao` e as rotas dela."""
import pytest
from sqlalchemy import text

from tests.conftest import RAIZ

URL = "/operacao/atualizacao-manual"


@pytest.fixture(scope="module", autouse=True)
def schema_operacao(engine):
    """Aplica a migration 012 de verdade — o índice de "um por vez" é parte do contrato."""
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS operacao CASCADE"))
        conn.execute(text("CREATE SCHEMA operacao"))
        # A 012 copia o dono desta tabela, então ela precisa existir antes.
        conn.execute(text("CREATE TABLE operacao.execucoes_job (id bigserial PRIMARY KEY)"))
        conn.execute(text(
            "DO $$ BEGIN"
            " IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dbt')"
            " THEN CREATE ROLE dbt; END IF;"
            " END $$"
        ))
    sql = (RAIZ / "migrations" / "012_pedidos_de_atualizacao.sql").read_text()
    raw = engine.raw_connection()
    try:
        raw.cursor().execute(sql)
        raw.commit()
    finally:
        raw.close()


@pytest.fixture(autouse=True)
def fila_vazia(engine):
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE operacao.pedidos_atualizacao RESTART IDENTITY"))


def _fila(*args):
    from app.jobs.pedido_atualizacao import main
    return main(list(args))


def test_so_admin_pede(client, comum):
    assert client.post(URL, headers=comum.headers).status_code == 403


def test_sem_token_nao_pede(client):
    assert client.post(URL).status_code == 401


def test_pedido_fica_registrado_com_quem_pediu(client, admin):
    r = client.post(URL, headers=admin.headers)
    assert r.status_code == 202
    assert r.json()["pedido_por"] == "chefe"
    assert r.json()["resultado"] is None

    assert client.get(URL, headers=admin.headers).json()["id"] == r.json()["id"]


def test_segundo_clique_nao_abre_outro_pedido(client, admin):
    primeiro = client.post(URL, headers=admin.headers).json()
    r = client.post(URL, headers=admin.headers)
    assert r.status_code == 409
    assert r.json()["detail"]["pedido"]["id"] == primeiro["id"]


def test_get_sem_pedido_nenhum_devolve_null(client, admin):
    r = client.get(URL, headers=admin.headers)
    assert r.status_code == 200
    assert r.json() is None


def test_ciclo_da_vps_pegar_e_concluir(client, admin, capsys):
    pedido = client.post(URL, headers=admin.headers).json()

    _fila("pegar")
    assert capsys.readouterr().out.strip() == str(pedido["id"])
    assert client.get(URL, headers=admin.headers).json()["iniciado_em"] is not None

    # Já pego: a próxima passada do timer não pode pegar de novo.
    _fila("pegar")
    assert capsys.readouterr().out.strip() == ""

    _fila("concluir", str(pedido["id"]), "falha", "importar_nfse saiu com 1")
    fechado = client.get(URL, headers=admin.headers).json()
    assert fechado["resultado"] == "falha"
    assert fechado["detalhe"] == "importar_nfse saiu com 1"

    # Fechado o anterior, a fila aceita outro.
    assert client.post(URL, headers=admin.headers).status_code == 202


def test_pegar_com_fila_vazia_nao_imprime_nada(capsys):
    _fila("pegar")
    assert capsys.readouterr().out == ""


def test_pedido_esquecido_nao_trava_a_fila(client, admin, engine):
    antigo = client.post(URL, headers=admin.headers).json()
    with engine.begin() as conn:
        conn.execute(text(
            "UPDATE operacao.pedidos_atualizacao"
            " SET pedido_em = now() - interval '2 hours', iniciado_em = now() - interval '2 hours'"
        ))

    assert client.post(URL, headers=admin.headers).status_code == 202
    with engine.connect() as conn:
        resultado = conn.execute(text(
            "SELECT resultado FROM operacao.pedidos_atualizacao WHERE id = :id"
        ), {"id": antigo["id"]}).scalar_one()
    assert resultado == "abandonado"
