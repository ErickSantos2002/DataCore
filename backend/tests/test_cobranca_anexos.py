"""Anexos (imagens e PDF) no registro de contato da cobrança.

O arquivo vai para `ARQUIVOS_DIR` (aqui, o `tmp_path` de cada teste) e os metadados
para `tiny.cobranca_anexos` (migração 014, aplicada no Postgres de teste como a 013).
"""
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import text

from tests.semente_contas import contas, tabela_contas  # noqa: F401
from tests.test_inadimplencia_migracao import rodar_migracao

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 64
PDF = b"%PDF-1.7\n" + b"\x00" * 64
MB = 1024 * 1024


@pytest.fixture(scope="module", autouse=True)
def tabelas(engine):
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS tiny.configuracoes ("
            " id serial PRIMARY KEY, chave varchar NOT NULL UNIQUE, valor varchar NOT NULL)"))
        conn.execute(text("GRANT SELECT, UPDATE, INSERT ON tiny.configuracoes TO app_teste"))
    rodar_migracao(engine, "013_cobranca.sql")
    rodar_migracao(engine, "014_cobranca_anexos.sql")


@pytest.fixture(autouse=True)
def limpa(engine):
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE tiny.cobranca_eventos, tiny.cobranca_ciclos, tiny.cobranca_empresas"
                          " RESTART IDENTITY CASCADE"))


@pytest.fixture(autouse=True)
def pasta(tmp_path, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "ARQUIVOS_DIR", str(tmp_path))
    return tmp_path


@pytest.fixture
def financeiro(criar_usuario, login):
    uid = criar_usuario("ana", papel="financeiro")
    return SimpleNamespace(id=uid, headers=login("ana"))


def _contato(**extra):
    return {"ocorrido_em": datetime.now(timezone.utc).isoformat(), "canal": "telefone", **extra}


@pytest.fixture
def evento(client, financeiro, contas):
    """Registra um contato na empresa 11111111 e devolve o id do evento novo."""
    contas(venceu_ha=40)
    r = client.post("/inadimplencia/empresas/11111111/eventos", json=_contato(), headers=financeiro.headers)
    assert r.status_code == 200, r.text
    return r.json()["evento_id"]


def _enviar(client, headers, evento_id, *arquivos):
    return client.post(f"/inadimplencia/eventos/{evento_id}/anexos", headers=headers,
                       files=[("arquivos", a) for a in arquivos])


def _arquivos_no_disco(pasta):
    return sorted(p for p in Path(pasta).rglob("*") if p.is_file())


def _linhas(engine):
    with engine.connect() as conn:
        return conn.execute(text("SELECT * FROM tiny.cobranca_anexos ORDER BY id")).mappings().all()


# ───────────────────────────────────────────────────────── migração

def test_migracao_e_idempotente_e_da_permissao_sem_delete(engine):
    rodar_migracao(engine, "014_cobranca_anexos.sql")
    with engine.connect() as conn:
        p = conn.execute(text(
            "SELECT has_table_privilege('app_teste', 'tiny.cobranca_anexos', 'SELECT'),"
            "       has_table_privilege('app_teste', 'tiny.cobranca_anexos', 'INSERT'),"
            "       has_table_privilege('app_teste', 'tiny.cobranca_anexos', 'UPDATE'),"
            "       has_column_privilege('app_teste', 'tiny.cobranca_anexos', 'apagado_em', 'UPDATE'),"
            "       has_column_privilege('app_teste', 'tiny.cobranca_anexos', 'apagado_por', 'UPDATE'),"
            "       has_column_privilege('app_teste', 'tiny.cobranca_anexos', 'caminho', 'UPDATE'),"
            "       has_table_privilege('app_teste', 'tiny.cobranca_anexos', 'DELETE'),"
            "       has_sequence_privilege('app_teste', 'tiny.cobranca_anexos_id_seq', 'USAGE')"
        )).one()
    # UPDATE só nas colunas de apagar: o app nunca reescreve o caminho de um anexo
    assert p == (True, True, False, True, True, False, False, True)


# ───────────────────────────────────────────────────────── registro devolve o id

def test_registrar_evento_devolve_o_id_do_evento_novo(client, financeiro, contas, engine):
    contas(venceu_ha=40)
    r = client.post("/inadimplencia/empresas/11111111/eventos", json=_contato(), headers=financeiro.headers)
    with engine.connect() as conn:
        ultimo = conn.execute(text("SELECT max(id) FROM tiny.cobranca_eventos")).scalar()
    assert r.json()["evento_id"] == ultimo


# ───────────────────────────────────────────────────────── upload

@pytest.mark.parametrize("nome,conteudo,tipo,ext", [
    ("foto.jpg", JPEG, "image/jpeg", ".jpg"),
    ("print.png", PNG, "image/png", ".png"),
    ("figura.webp", WEBP, "image/webp", ".webp"),
    ("boleto.pdf", PDF, "application/pdf", ".pdf"),
])
def test_envia_cada_tipo_valido(client, financeiro, evento, pasta, engine, nome, conteudo, tipo, ext):
    # o content-type do pedido mente de propósito: vale a assinatura do conteúdo
    r = _enviar(client, financeiro.headers, evento, (nome, conteudo, "application/octet-stream"))
    assert r.status_code == 200, r.text
    [criado] = r.json()
    assert criado["nome_original"] == nome
    assert criado["tipo"] == tipo
    assert criado["tamanho"] == len(conteudo)
    assert criado["enviado_por"] == "ana"
    [linha] = _linhas(engine)
    partes = linha["caminho"].split("/")
    assert partes[0] == "cobranca" and len(partes[1]) == 4 and len(partes[2]) == 2
    assert partes[3].endswith(ext) and len(partes[3]) == 32 + len(ext)
    assert (pasta / linha["caminho"]).read_bytes() == conteudo
    assert len(_arquivos_no_disco(pasta)) == 1  # sem temporário esquecido


def test_extensao_png_com_texto_dentro_leva_422(client, financeiro, evento, pasta, engine):
    r = _enviar(client, financeiro.headers, evento, ("falso.png", b"isto e texto puro", "image/png"))
    assert r.status_code == 422
    assert isinstance(r.json()["detail"], str) and "PDF" in r.json()["detail"]
    assert _linhas(engine) == [] and _arquivos_no_disco(pasta) == []


def test_acima_de_10_mb_e_recusado(client, financeiro, evento, pasta, engine):
    grande = PNG + b"\x00" * (10 * MB)
    r = _enviar(client, financeiro.headers, evento, ("grande.png", grande, "image/png"))
    assert r.status_code in (413, 422)
    assert "10 MB" in r.json()["detail"]
    assert _linhas(engine) == [] and _arquivos_no_disco(pasta) == []


def test_exatamente_10_mb_passa(client, financeiro, evento):
    no_limite = PNG + b"\x00" * (10 * MB - len(PNG))
    assert _enviar(client, financeiro.headers, evento, ("limite.png", no_limite, "image/png")).status_code == 200


def test_sexto_anexo_leva_422_e_nada_e_gravado(client, financeiro, evento, pasta, engine):
    r = _enviar(client, financeiro.headers, evento, *[(f"a{i}.png", PNG, "image/png") for i in range(4)])
    assert r.status_code == 200
    r = _enviar(client, financeiro.headers, evento, ("b1.png", PNG, "image/png"), ("b2.pdf", PDF, "application/pdf"))
    assert r.status_code == 422
    assert "5" in r.json()["detail"]
    assert len(_linhas(engine)) == 4 and len(_arquivos_no_disco(pasta)) == 4


def test_mais_de_cinco_num_pedido_so_leva_422(client, financeiro, evento, pasta):
    r = _enviar(client, financeiro.headers, evento, *[(f"a{i}.png", PNG, "image/png") for i in range(6)])
    assert r.status_code == 422
    assert _arquivos_no_disco(pasta) == []


def test_apagado_libera_vaga(client, financeiro, evento):
    ids = [a["id"] for a in _enviar(client, financeiro.headers, evento,
                                    *[(f"a{i}.png", PNG, "image/png") for i in range(5)]).json()]
    assert client.delete(f"/inadimplencia/anexos/{ids[0]}", headers=financeiro.headers).status_code == 204
    assert _enviar(client, financeiro.headers, evento, ("c.pdf", PDF, "application/pdf")).status_code == 200


def test_tudo_ou_nada_um_invalido_no_meio(client, financeiro, evento, pasta, engine):
    r = _enviar(client, financeiro.headers, evento, ("a.png", PNG, "image/png"),
                ("b.png", b"<html>nada</html>", "image/png"), ("c.pdf", PDF, "application/pdf"))
    assert r.status_code == 422
    assert _linhas(engine) == [] and _arquivos_no_disco(pasta) == []


def test_falha_ao_gravar_no_meio_apaga_o_que_ja_foi(client, financeiro, evento, pasta, engine, monkeypatch):
    from app.services import anexos

    original = anexos._gravar_no_disco
    chamadas = []

    def falha_na_segunda(*args, **kwargs):
        chamadas.append(1)
        if len(chamadas) == 2:
            raise OSError("disco cheio")
        return original(*args, **kwargs)

    monkeypatch.setattr(anexos, "_gravar_no_disco", falha_na_segunda)
    cliente_sem_estourar = client.__class__(client.app, raise_server_exceptions=False)
    r = cliente_sem_estourar.post(f"/inadimplencia/eventos/{evento}/anexos", headers=financeiro.headers,
                                  files=[("arquivos", ("a.png", PNG, "image/png")),
                                         ("arquivos", ("b.png", PNG, "image/png"))])
    assert r.status_code == 500
    assert _linhas(engine) == [] and _arquivos_no_disco(pasta) == []


def test_pedido_acima_do_teto_leva_413_antes_de_ler(client, financeiro, evento, pasta, engine, monkeypatch):
    import importlib

    # `app.api.endpoints.inadimplencia` como atributo é o router (reexportado no __init__)
    rotas = importlib.import_module("app.api.endpoints.inadimplencia")
    monkeypatch.setattr(rotas, "TETO_DO_PEDIDO", 1000)
    r = _enviar(client, financeiro.headers, evento, ("a.png", PNG + b"\x00" * 2000, "image/png"))
    assert r.status_code == 413
    assert isinstance(r.json()["detail"], str)
    assert _linhas(engine) == [] and _arquivos_no_disco(pasta) == []


def test_pedido_sem_content_length_leva_411(client, financeiro, evento):
    def corpo():
        yield b"--x\r\n"

    r = client.post(f"/inadimplencia/eventos/{evento}/anexos", content=corpo(),
                    headers={**financeiro.headers, "content-type": "multipart/form-data; boundary=x"})
    assert r.status_code == 411


def test_seis_arquivos_param_no_parser_com_422_em_portugues(client, financeiro, evento, pasta, monkeypatch):
    from app.services import anexos

    chamado = []
    monkeypatch.setattr(anexos, "enviar", lambda *a, **k: chamado.append(1))
    r = _enviar(client, financeiro.headers, evento, *[(f"a{i}.png", PNG, "image/png") for i in range(6)])
    assert r.status_code == 422
    assert "5" in r.json()["detail"]
    assert chamado == []  # o parser recusou antes de chegar ao serviço


def test_remover_nao_sai_da_pasta_de_arquivos(pasta):
    from app.services import anexos

    fora = pasta.parent / f"fora-{pasta.name}.txt"
    fora.write_text("não apagar")
    try:
        anexos.remover_arquivos([f"../{fora.name}", str(fora)])
        assert fora.exists()
    finally:
        fora.unlink(missing_ok=True)


def test_evento_inexistente_404(client, financeiro, evento):
    assert _enviar(client, financeiro.headers, 999999, ("a.png", PNG, "image/png")).status_code == 404


def test_sem_arquivo_422(client, financeiro, evento):
    r = client.post(f"/inadimplencia/eventos/{evento}/anexos", headers=financeiro.headers)
    assert r.status_code == 422


def test_nome_com_barras_nao_afeta_o_caminho(client, financeiro, evento, pasta, engine):
    r = _enviar(client, financeiro.headers, evento, ("../../etc/passwd.png", PNG, "image/png"))
    assert r.status_code == 200
    [linha] = _linhas(engine)
    assert ".." not in linha["caminho"] and "passwd" not in linha["caminho"]
    assert "/" not in linha["nome_original"] and "\\" not in linha["nome_original"]
    [arquivo] = _arquivos_no_disco(pasta)
    assert arquivo.is_relative_to(pasta / "cobranca")


# ───────────────────────────────────────────────────────── papéis

def test_comum_nao_envia_nem_baixa_nem_apaga(client, financeiro, comum, evento):
    [a] = _enviar(client, financeiro.headers, evento, ("a.png", PNG, "image/png")).json()
    assert _enviar(client, comum.headers, evento, ("b.png", PNG, "image/png")).status_code == 403
    assert client.get(f"/inadimplencia/anexos/{a['id']}", headers=comum.headers).status_code == 403
    assert client.delete(f"/inadimplencia/anexos/{a['id']}", headers=comum.headers).status_code == 403


def test_sem_token_leva_401(client, financeiro, evento):
    [a] = _enviar(client, financeiro.headers, evento, ("a.png", PNG, "image/png")).json()
    assert client.get(f"/inadimplencia/anexos/{a['id']}").status_code == 401


def test_papel_e_conferido_antes_de_ler_o_corpo(client, comum, evento):
    # 6 arquivos dariam 422 no parser: o 401/403 provar que o papel veio antes da leitura
    seis = [(f"a{i}.png", PNG, "image/png") for i in range(6)]
    assert _enviar(client, {}, evento, *seis).status_code == 401
    assert _enviar(client, comum.headers, evento, *seis).status_code == 403


# ───────────────────────────────────────────────────────── download

def test_download_devolve_os_bytes_e_o_tipo(client, financeiro, evento):
    [a] = _enviar(client, financeiro.headers, evento, ("Relatório final.pdf", PDF, "image/png")).json()
    r = client.get(f"/inadimplencia/anexos/{a['id']}", headers=financeiro.headers)
    assert r.status_code == 200
    assert r.content == PDF
    assert r.headers["content-type"] == "application/pdf"
    assert r.headers["content-disposition"] == "inline; filename*=UTF-8''Relat%C3%B3rio%20final.pdf"
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "private" in r.headers["cache-control"]


def test_download_de_arquivo_sumido_do_disco_404(client, financeiro, evento, pasta, engine):
    _enviar(client, financeiro.headers, evento, ("a.png", PNG, "image/png"))
    [linha] = _linhas(engine)
    (pasta / linha["caminho"]).unlink()
    assert client.get(f"/inadimplencia/anexos/{linha['id']}", headers=financeiro.headers).status_code == 404


def test_download_inexistente_404(client, financeiro):
    assert client.get("/inadimplencia/anexos/999999", headers=financeiro.headers).status_code == 404


# ───────────────────────────────────────────────────────── exclusão

def test_apagar_marca_remove_o_arquivo_e_some_da_linha_do_tempo(client, financeiro, admin, evento, pasta, engine):
    [a, b] = _enviar(client, financeiro.headers, evento, ("a.png", PNG, "image/png"),
                     ("b.pdf", PDF, "application/pdf")).json()
    r = client.delete(f"/inadimplencia/anexos/{a['id']}", headers=admin.headers)
    assert r.status_code == 204
    linha = _linhas(engine)[0]
    assert linha["apagado_por"] == "chefe" and linha["apagado_em"] is not None
    assert not (pasta / linha["caminho"]).exists()
    assert len(_arquivos_no_disco(pasta)) == 1
    detalhe = client.get("/inadimplencia/empresas/11111111", headers=financeiro.headers).json()
    [ev] = [e for e in detalhe["eventos"] if e["id"] == evento]
    assert [x["id"] for x in ev["anexos"]] == [b["id"]]
    assert client.get(f"/inadimplencia/anexos/{a['id']}", headers=financeiro.headers).status_code == 404
    assert client.delete(f"/inadimplencia/anexos/{a['id']}", headers=admin.headers).status_code == 404


# ───────────────────────────────────────────────────────── detalhe

def test_detalhe_traz_os_anexos_no_evento_certo(client, financeiro, evento):
    r = client.post("/inadimplencia/empresas/11111111/eventos", json=_contato(canal="email"),
                    headers=financeiro.headers)
    outro = r.json()["evento_id"]
    assert outro != evento
    _enviar(client, financeiro.headers, evento, ("um.png", PNG, "image/png"))
    _enviar(client, financeiro.headers, outro, ("dois.pdf", PDF, "application/pdf"),
            ("tres.jpg", JPEG, "image/jpeg"))
    detalhe = client.get("/inadimplencia/empresas/11111111", headers=financeiro.headers).json()
    por_evento = {e["id"]: [a["nome_original"] for a in e["anexos"]] for e in detalhe["eventos"]}
    assert por_evento[evento] == ["um.png"]
    assert por_evento[outro] == ["dois.pdf", "tres.jpg"]
    a = next(e for e in detalhe["eventos"] if e["id"] == outro)["anexos"][0]
    assert set(a) == {"id", "nome_original", "tipo", "tamanho", "enviado_por", "enviado_em"}


def test_detalhe_busca_os_anexos_numa_consulta_so(client, financeiro, evento, engine):
    from sqlalchemy import event as sa_event

    from app.models.database import engine as engine_do_app

    for canal in ("email", "whatsapp", "presencial"):
        r = client.post("/inadimplencia/empresas/11111111/eventos", json=_contato(canal=canal),
                        headers=financeiro.headers)
        _enviar(client, financeiro.headers, r.json()["evento_id"], ("a.png", PNG, "image/png"))
    consultas = []

    def contar(conn, cursor, statement, *args):
        if "cobranca_anexos" in statement:
            consultas.append(statement)

    sa_event.listen(engine_do_app, "before_cursor_execute", contar)
    try:
        client.get("/inadimplencia/empresas/11111111", headers=financeiro.headers)
    finally:
        sa_event.remove(engine_do_app, "before_cursor_execute", contar)
    assert len(consultas) == 1
