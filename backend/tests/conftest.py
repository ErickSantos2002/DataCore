"""Fixtures compartilhadas.

Os testes rodam contra o Postgres descartável de docker-compose.test.yml, nunca
contra o datacore. Suba antes com:
    docker compose -f docker-compose.test.yml up -d --wait

Guarda de segurança: a fixture `engine` dropa os schemas `auth` e `tiny` do banco
apontado por TEST_DATABASE_URL antes de cada sessão. Para nunca fazer isso contra
um banco de verdade por engano, ela recusa (pytest.exit) qualquer URL cujo host
não seja localhost/127.0.0.1 ou cujo nome de banco não termine em "_teste".
"""
import os
from pathlib import Path

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql://teste:teste@localhost:55432/tiny_teste"
)

# Precisa vir antes de qualquer import de `app`: o Settings lê o ambiente no import.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["SECRET_KEY"] = "segredo-so-dos-testes-com-pelo-menos-32-bytes"
os.environ["AUTH_OBRIGATORIA"] = "false"
os.environ["AUTH_APP_DB_USER"] = "app_teste"

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def alembic_cfg():
    cfg = Config(str(RAIZ / "alembic.ini"))
    cfg.set_main_option("script_location", str(RAIZ / "alembic"))
    return cfg


@pytest.fixture(scope="session")
def engine(alembic_cfg):
    url = make_url(TEST_DATABASE_URL)
    if url.host not in ("localhost", "127.0.0.1") or not (url.database or "").endswith("_teste"):
        pytest.exit(
            "TEST_DATABASE_URL não parece um banco de teste descartável "
            f"({TEST_DATABASE_URL}): o host precisa ser localhost/127.0.0.1 e o "
            "nome do banco precisa terminar em '_teste'. Esta fixture dropa "
            "schemas inteiros — recusar aqui evita apagar um banco de verdade.",
            returncode=1,
        )
    eng = create_engine(TEST_DATABASE_URL)
    try:
        with eng.connect():
            pass
    except Exception as erro:  # noqa: BLE001
        pytest.exit(
            f"Postgres de teste fora do ar ({TEST_DATABASE_URL}).\n"
            "Suba com: docker compose -f docker-compose.test.yml up -d --wait\n"
            f"{erro}",
            returncode=1,
        )
    with eng.begin() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS auth CASCADE"))
        # Um pedaço do schema tiny, só para provar que o Alembic não mexe nele e
        # para as rotas de dados terem o que ler.
        conn.execute(text("DROP SCHEMA IF EXISTS tiny CASCADE"))
        conn.execute(text("CREATE SCHEMA tiny"))
        conn.execute(text(
            "CREATE TABLE tiny.marcadores ("
            " id serial PRIMARY KEY, id_nota int, id_marcador varchar(20),"
            " descricao text, cor varchar(10))"
        ))
        conn.execute(text(
            "DO $$ BEGIN"
            " IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_teste')"
            " THEN CREATE ROLE app_teste; END IF;"
            " END $$"
        ))
    command.upgrade(alembic_cfg, "head")
    yield eng
    eng.dispose()


@pytest.fixture(autouse=True)
def banco_limpo(engine):
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE auth.usuarios, auth.papeis RESTART IDENTITY CASCADE"))
        conn.execute(text(
            "INSERT INTO auth.papeis (nome) VALUES ('admin'), ('comum'), ('financeiro')"
        ))


from types import SimpleNamespace  # noqa: E402


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from app.main import app

    return TestClient(app)


@pytest.fixture
def criar_usuario(engine):
    """Insere direto no banco; devolve o id."""
    from app.core.security import gerar_hash_senha

    def _criar(username, senha="senha123", papel="comum", email=None, senha_hash=None):
        with engine.begin() as conn:
            return conn.execute(
                text(
                    "INSERT INTO auth.usuarios (username, email, senha_hash, papel_id)"
                    " SELECT :u, :e, :h, id FROM auth.papeis WHERE nome = :p RETURNING id"
                ),
                {"u": username, "e": email, "h": senha_hash or gerar_hash_senha(senha), "p": papel},
            ).scalar_one()

    return _criar


@pytest.fixture
def login(client):
    def _login(username, senha="senha123"):
        r = client.post("/auth/login", json={"username": username, "password": senha})
        assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    return _login


@pytest.fixture
def admin(criar_usuario, login):
    uid = criar_usuario("chefe", papel="admin")
    return SimpleNamespace(id=uid, headers=login("chefe"))


@pytest.fixture
def comum(criar_usuario, login):
    uid = criar_usuario("joao", papel="comum")
    return SimpleNamespace(id=uid, headers=login("joao"))
