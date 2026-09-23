import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import _admin_url  # noqa: E402
import copiar_usuarios_authapi as copia  # noqa: E402

HASH_AUTHAPI = "$2b$12$ePWpw.mP7U.dQzH/FYu8L.IVq1sjlXV3VQ.Pt.vJhQLSS/ExU8Q6e"

# Formato das tabelas do authapi (login-hs), com ids com buraco como na vida real.
DDL_AUTHAPI = [
    "CREATE TABLE roles (id serial PRIMARY KEY, name varchar UNIQUE NOT NULL)",
    "CREATE TABLE users (id serial PRIMARY KEY, username varchar UNIQUE NOT NULL,"
    " password_hash varchar NOT NULL, created_at timestamptz DEFAULT now(),"
    " role_id int NOT NULL REFERENCES roles(id))",
    "INSERT INTO roles (id, name) VALUES (1, 'admin'), (2, 'comum'), (3, 'financeiro'), (4, 'servicos')",
]
USUARIOS = [(1, "erick", 1), (3, "Ana", 3), (4, "bia", 3), (7, "caio", 4)]


def _url(engine, banco):
    return engine.url.set(database=banco).render_as_string(hide_password=False)


@pytest.fixture
def destino_url(engine):
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE auth.usuarios, auth.papeis RESTART IDENTITY CASCADE"))
    return engine.url.render_as_string(hide_password=False)


@pytest.fixture
def criar_origem(engine):
    criados = []
    servidor = create_engine(engine.url, isolation_level="AUTOCOMMIT")

    def _criar(usuarios=USUARIOS, banco="authapi_teste"):
        with servidor.connect() as conn:
            conn.execute(text(f"DROP DATABASE IF EXISTS {banco} WITH (FORCE)"))
            conn.execute(text(f"CREATE DATABASE {banco}"))
        criados.append(banco)
        origem = create_engine(_url(engine, banco))
        with origem.begin() as conn:
            for sql in DDL_AUTHAPI:
                conn.execute(text(sql))
            for uid, nome, papel in usuarios:
                conn.execute(
                    text("INSERT INTO users (id, username, password_hash, role_id) VALUES (:i, :u, :h, :r)"),
                    {"i": uid, "u": nome, "h": HASH_AUTHAPI, "r": papel},
                )
        origem.dispose()
        return _url(engine, banco)

    yield _criar
    with servidor.connect() as conn:
        for banco in criados:
            conn.execute(text(f"DROP DATABASE IF EXISTS {banco} WITH (FORCE)"))
    servidor.dispose()


def test_copia_preserva_ids_hash_e_papel(engine, criar_origem, destino_url):
    resultado = copia.copiar(criar_origem(), destino_url)
    assert resultado["papeis_copiados"] == ["admin", "comum", "financeiro", "servicos"]
    assert resultado["usuarios_copiados"] == ["erick", "ana", "bia", "caio"]
    with engine.connect() as conn:
        linhas = conn.execute(text(
            "SELECT u.id, u.username, u.email, u.senha_hash, p.nome"
            " FROM auth.usuarios u JOIN auth.papeis p ON p.id = u.papel_id ORDER BY u.id"
        )).all()
    assert [(l.id, l.username, l.nome) for l in linhas] == [
        (1, "erick", "admin"), (3, "ana", "financeiro"), (4, "bia", "financeiro"), (7, "caio", "servicos"),
    ]
    assert all(l.email is None and l.senha_hash == HASH_AUTHAPI for l in linhas)


def test_senha_copiada_funciona_no_login(client, criar_origem, destino_url):
    copia.copiar(criar_origem(), destino_url)
    r = client.post("/auth/login", json={"username": "Ana", "password": "senha-do-authapi"})
    assert r.status_code == 200
    assert r.json()["user_id"] == 3


def test_sequences_ajustadas_depois_da_copia(engine, criar_origem, destino_url):
    copia.copiar(criar_origem(), destino_url)
    with engine.begin() as conn:
        novo_papel = conn.execute(text("INSERT INTO auth.papeis (nome) VALUES ('novo') RETURNING id")).scalar_one()
        novo_usuario = conn.execute(text(
            "INSERT INTO auth.usuarios (username, senha_hash, papel_id) VALUES ('novo', 'x', 1) RETURNING id"
        )).scalar_one()
    assert novo_papel == 5
    assert novo_usuario == 8


def test_segunda_execucao_nao_duplica(engine, criar_origem, destino_url):
    origem = criar_origem()
    copia.copiar(origem, destino_url)
    resultado = copia.copiar(origem, destino_url)
    assert resultado["papeis_copiados"] == [] and resultado["usuarios_copiados"] == []
    assert len(resultado["usuarios_pulados"]) == 4
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM auth.usuarios")).scalar_one() == 4


def test_username_que_colide_depois_do_minusculo_aborta_tudo(engine, criar_origem, destino_url):
    origem = criar_origem(usuarios=[(1, "erick", 1), (2, "Ana", 3), (3, "ana", 3)])
    with pytest.raises(IntegrityError):
        copia.copiar(origem, destino_url)
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM auth.usuarios")).scalar_one() == 0
        assert conn.execute(text("SELECT count(*) FROM auth.papeis")).scalar_one() == 0


def test_url_admin_escapa_a_senha(tmp_path, monkeypatch):
    arquivo = tmp_path / "admin.toml"
    arquivo.write_text(
        '[datacore]\nhost = "10.0.0.1"\nporta = 5555\nbanco = "datacore-banco"\n'
        'usuario = "postgres"\nsenha = "p@ss:w%rd/1"\n',
        encoding="utf-8",
    )
    monkeypatch.setattr(_admin_url, "ADMIN_TOML", arquivo)
    url = make_url(_admin_url.url_admin("datacore"))
    assert (url.host, url.port, url.database, url.username, url.password) == (
        "10.0.0.1", 5555, "datacore-banco", "postgres", "p@ss:w%rd/1",
    )


def test_url_admin_apelido_inexistente(tmp_path, monkeypatch):
    arquivo = tmp_path / "admin.toml"
    arquivo.write_text("", encoding="utf-8")
    monkeypatch.setattr(_admin_url, "ADMIN_TOML", arquivo)
    with pytest.raises(SystemExit, match="datacore"):
        _admin_url.url_admin("datacore")
