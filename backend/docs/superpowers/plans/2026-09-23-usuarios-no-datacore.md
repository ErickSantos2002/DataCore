# Usuários do DataCoreHS no `datacore` — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O tiny-integrador passa a autenticar os usuários do DataCoreHS a partir de um
schema `auth` próprio no `datacore`, versionado com Alembic, e a proteger todas as
rotas de dados atrás de uma flag de transição.

**Architecture:** Schema `auth` (tabelas `papeis` e `usuarios`) criado por uma
revisão Alembic cujo `env.py` só enxerga esse schema. `core/security.py` concentra
hash (bcrypt), JWT (PyJWT) e as dependências `usuario_atual`, `exigir_admin` e
`exigir_usuario`. As rotas ficam em `api/endpoints/auth.py` sob `/auth`, com o mesmo
contrato JSON do authapi. As rotas de dados ganham `exigir_usuario` no
`include_router` do `main.py`. Scripts avulsos copiam os usuários do authapi e
aplicam a migration com o superusuário do `admin.toml`.

**Tech Stack:** FastAPI, SQLAlchemy 2, Alembic, PyJWT, bcrypt, Pydantic v2,
pytest + TestClient, Postgres 18 em container para os testes.

**Spec:** `docs/superpowers/specs/2026-09-23-usuarios-no-datacore-design.md`

## Global Constraints

- O código de `app/` precisa rodar em **Python 3.11** (é a imagem do `dockerfile`). Nada de sintaxe 3.12+ (`type X = ...`, generics PEP 695).
- O Alembic mexe **só** no schema `auth`. Nenhuma DDL em `tiny`, `silver`, `gold`, `operacao`, `snapshots` nem `dbt_*`.
- A aplicação **não** roda migration no startup. O `dockerfile` não muda.
- JSON de entrada e saída com os nomes do authapi: `username`, `password`, `role_name`, `email`, `created_at`, `role: {id, name}`, `access_token`, `token_type`, `role`, `user_id`. Os nomes de tabela e coluna são em português (`usuarios`, `papeis`, `senha_hash`, `papel_id`, `criado_em`, `nome`).
- `SECRET_KEY` é obrigatória e **diferente** da do authapi.
- Rotas de autenticação sob o prefixo **`/auth`**.
- Papel de administrador: a string `admin`. Papel padrão de cadastro: `comum`.
- Senha e e-mail são definidos **só por admin**. Não existe troca de senha pelo próprio usuário.
- Mensagens de erro herdadas do authapi mantêm o texto: `"Username already registered"`, `"Incorrect username or password"`, `"Role '<nome>' not found."`, `"User not found"`, `"Usuário <id> não encontrado"`, `"Usuário não encontrado."`, `"Acesso restrito a administradores."`, `"Não é possível excluir seu próprio usuário."`.
- Cada arquivo de endpoint define a própria `get_db()` (padrão vigente do repo).
- Testes **nunca** rodam contra o `datacore`, só contra o Postgres de `docker-compose.test.yml`.
- Código, comentários e mensagens em português. Commits em português, no imperativo, terminando com a linha `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Não** fazer commit de `CLAUDE.md` nem de `SETUP-CLAUDE.md` (estão fora do git por escolha do Erick).

## Review Focus

1. **Senha acima de 72 bytes.** O bcrypt 5 lança `ValueError`. No login deve dar `401`, no cadastro e na edição `422`, e **nunca** `500`. Testes nas Tasks 2 e 3.
2. **Username e e-mail com maiúscula, espaço ou vazio.** `"  Maria "` é o mesmo usuário que `maria`, tanto no login quanto na checagem de duplicado. E-mail `""` vira `null`, senão dois `""` colidem no índice único. Testes na Task 3.
3. **Admin que se tranca pra fora.** O admin não pode se excluir nem tirar o próprio papel de admin, senão pode sobrar zero administradores. Testes na Task 3.
4. **Router de dados novo sem proteção.** Quem adicionar um router no futuro e esquecer o `dependencies=PROTEGIDO` deixa a rota aberta. Um teste percorre `app.routes` e falha nesse caso. Task 4.
5. **Token malformado, esquema errado ou assinado com a chave do authapi.** Deve dar `401` com a flag ligada, passar com `WARNING` com a flag desligada, e **nunca** `500`. Testes nas Tasks 2, 3 e 4.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `requirements.txt` (mod.) | + `alembic`, `PyJWT`, `bcrypt` |
| `requirements-dev.txt` (novo) | `pytest`, `httpx` |
| `docker-compose.test.yml` (novo) | Postgres 18 descartável na porta 55432 |
| `pytest.ini` (novo) | `testpaths = tests` |
| `alembic.ini`, `alembic/env.py`, `alembic/script.py.mako` (novos) | Alembic restrito ao schema `auth` |
| `alembic/versions/0001_criar_schema_auth.py` (novo) | schema, tabelas, índice, grants |
| `migrations/README.md` (novo) | diz que o SQL manual é histórico do `tiny` |
| `app/models/papel.py`, `app/models/usuario.py` (novos) | modelos do `auth` |
| `app/core/config.py` (mod.) | `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `AUTH_OBRIGATORIA` |
| `app/core/security.py` (reescrito) | hash, JWT, dependências de autenticação |
| `app/schemas/auth.py` (novo) | entrada/saída com normalização |
| `app/api/endpoints/auth.py` (novo) | as 8 rotas `/auth/...` |
| `app/api/endpoints/__init__.py`, `app/main.py` (mod.) | registro do router e proteção dos routers de dados |
| `scripts/_admin_url.py`, `scripts/migrar.sh`, `scripts/copiar_usuarios_authapi.py` (novos) | operação no Konsole |
| `.env.example` (mod.) | variáveis novas |
| `tests/conftest.py`, `tests/test_*.py` (novos) | suíte |

---

### Task 1: Infra de testes, modelos e migration do schema `auth`

**Files:**
- Modify: `requirements.txt`
- Create: `requirements-dev.txt`, `docker-compose.test.yml`, `pytest.ini`
- Create: `alembic.ini`, `alembic/env.py`, `alembic/script.py.mako`, `alembic/versions/0001_criar_schema_auth.py`
- Create: `app/models/papel.py`, `app/models/usuario.py`
- Create: `migrations/README.md`
- Create: `tests/__init__.py` (vazio), `tests/conftest.py`
- Test: `tests/test_migrations.py`

**Interfaces:**
- Consumes: `app.models.database.Base` (existente).
- Produces:
  - `app.models.papel.Papel` — colunas `id: int`, `nome: str`; tabela `auth.papeis`.
  - `app.models.usuario.Usuario` — colunas `id`, `username`, `email`, `senha_hash`, `papel_id`, `criado_em`; relação `papel: Papel` (carregada com `lazy="joined"`); tabela `auth.usuarios`.
  - Fixtures em `tests/conftest.py`: `alembic_cfg` (sessão), `engine` (sessão, banco já migrado), `banco_limpo` (autouse: esvazia `auth` e semeia os papéis `admin`=1, `comum`=2, `financeiro`=3). Constante `TEST_DATABASE_URL`.
  - Role Postgres `app_teste`, criada pela fixture `engine`, que recebe os grants da migration nos testes.

- [ ] **Step 1: Dependências, container de teste e config do pytest**

Acrescente ao fim de `requirements.txt`:

```
alembic
PyJWT
bcrypt
```

Crie `requirements-dev.txt`:

```
-r requirements.txt
pytest
httpx
```

Crie `docker-compose.test.yml`:

```yaml
# Postgres descartável para a suíte de testes. Nada aqui persiste (tmpfs).
# Subir:  docker compose -f docker-compose.test.yml up -d --wait
services:
  pg-teste:
    image: postgres:18
    container_name: tiny-integrador-pg-teste
    environment:
      POSTGRES_USER: teste
      POSTGRES_PASSWORD: teste
      POSTGRES_DB: tiny_teste
    ports:
      - "55432:5432"
    tmpfs:
      - /var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U teste -d tiny_teste"]
      interval: 2s
      timeout: 3s
      retries: 20
```

Crie `pytest.ini`:

```ini
[pytest]
testpaths = tests
```

Rode:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
docker compose -f docker-compose.test.yml up -d --wait
```

Esperado: instalação sem erro e o container `tiny-integrador-pg-teste` como `healthy`.

- [ ] **Step 2: Conftest com banco migrado**

Crie `tests/__init__.py` vazio e `tests/conftest.py`:

```python
"""Fixtures compartilhadas.

Os testes rodam contra o Postgres descartável de docker-compose.test.yml, nunca
contra o datacore. Suba antes com:
    docker compose -f docker-compose.test.yml up -d --wait
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

RAIZ = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def alembic_cfg():
    cfg = Config(str(RAIZ / "alembic.ini"))
    cfg.set_main_option("script_location", str(RAIZ / "alembic"))
    return cfg


@pytest.fixture(scope="session")
def engine(alembic_cfg):
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
```

- [ ] **Step 3: Escrever os testes da migration (vão falhar)**

Crie `tests/test_migrations.py`:

```python
import importlib.util

import pytest
from alembic import command
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from tests.conftest import RAIZ


def test_upgrade_cria_as_tabelas_do_auth(engine):
    tabelas = set(inspect(engine).get_table_names(schema="auth"))
    assert tabelas == {"papeis", "usuarios", "alembic_version"}


def test_colunas_de_usuarios(engine):
    colunas = {c["name"]: c for c in inspect(engine).get_columns("usuarios", schema="auth")}
    assert set(colunas) == {"id", "username", "email", "senha_hash", "papel_id", "criado_em"}
    assert colunas["email"]["nullable"] is True
    assert colunas["username"]["nullable"] is False


def test_email_unico_so_quando_preenchido(engine):
    inserir = text(
        "INSERT INTO auth.usuarios (username, email, senha_hash, papel_id)"
        " VALUES (:u, :e, 'x', 1)"
    )
    with engine.begin() as conn:
        conn.execute(inserir, {"u": "a", "e": None})
        conn.execute(inserir, {"u": "b", "e": None})
        conn.execute(inserir, {"u": "c", "e": "c@hs.com"})
    with pytest.raises(IntegrityError):
        with engine.begin() as conn:
            conn.execute(inserir, {"u": "d", "e": "c@hs.com"})


def test_modelos_batem_com_a_migration_e_ignoram_o_tiny(engine, alembic_cfg):
    # tiny.marcadores existe no banco e não está no metadata: se o filtro de schema
    # falhasse, o check acusaria "remove table".
    command.check(alembic_cfg)
    assert "marcadores" in inspect(engine).get_table_names(schema="tiny")


def test_usuario_da_app_recebe_so_os_grants_das_tabelas(engine):
    with engine.connect() as conn:
        pode = lambda sql: conn.execute(text(sql)).scalar_one()  # noqa: E731
        assert pode("SELECT has_table_privilege('app_teste', 'auth.usuarios', 'INSERT, SELECT, UPDATE, DELETE')")
        assert pode("SELECT has_table_privilege('app_teste', 'auth.papeis', 'SELECT')")
        assert pode("SELECT has_sequence_privilege('app_teste', 'auth.usuarios_id_seq', 'USAGE')")
        assert not pode("SELECT has_table_privilege('app_teste', 'auth.alembic_version', 'UPDATE')")


def test_downgrade_e_upgrade_de_novo(engine, alembic_cfg):
    command.downgrade(alembic_cfg, "base")
    assert set(inspect(engine).get_table_names(schema="auth")) == {"alembic_version"}
    command.upgrade(alembic_cfg, "head")
    assert {"papeis", "usuarios"} <= set(inspect(engine).get_table_names(schema="auth"))


def _carregar_migration():
    caminho = RAIZ / "alembic" / "versions" / "0001_criar_schema_auth.py"
    spec = importlib.util.spec_from_file_location("migration_0001", caminho)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


@pytest.mark.parametrize("valor", [None, "", "x; DROP TABLE y", "a b"])
def test_migration_exige_auth_app_db_user_valido(monkeypatch, valor):
    migration = _carregar_migration()
    if valor is None:
        monkeypatch.delenv("AUTH_APP_DB_USER", raising=False)
    else:
        monkeypatch.setenv("AUTH_APP_DB_USER", valor)
    with pytest.raises(RuntimeError, match="AUTH_APP_DB_USER"):
        migration._usuario_app()
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `.venv/bin/pytest tests/test_migrations.py -v`
Expected: erro na fixture `engine` (`alembic.ini` ou `script_location` não encontrado).

- [ ] **Step 5: Modelos**

Crie `app/models/papel.py`:

```python
from sqlalchemy import Column, Integer, Text
from app.models.database import Base


class Papel(Base):
    __tablename__ = "papeis"
    __table_args__ = {"schema": "auth"}

    id = Column(Integer, primary_key=True)
    nome = Column(Text, nullable=False, unique=True)
```

Crie `app/models/usuario.py`:

```python
from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, Text, func, text
from sqlalchemy.orm import relationship
from app.models.database import Base
from app.models.papel import Papel  # noqa: F401  (registra o alvo da relação)


class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = (
        # E-mail é opcional, mas não pode repetir quando preenchido.
        Index(
            "usuarios_email_unico",
            "email",
            unique=True,
            postgresql_where=text("email IS NOT NULL"),
        ),
        {"schema": "auth"},
    )

    id = Column(Integer, primary_key=True)
    username = Column(Text, nullable=False, unique=True)
    email = Column(Text, nullable=True)
    senha_hash = Column(Text, nullable=False)
    papel_id = Column(Integer, ForeignKey("auth.papeis.id"), nullable=False)
    criado_em = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # joined: o papel vem junto na mesma query e continua acessível depois que a
    # sessão fecha (a autenticação usa o usuário fora da sessão da rota).
    papel = relationship("Papel", lazy="joined")
```

- [ ] **Step 6: Alembic**

Crie `alembic.ini`:

```ini
# Alembic cuida SÓ do schema auth. O schema tiny é do processo de sincronia com o
# Tiny e segue com SQL manual em migrations/.
# A URL não fica aqui: o env.py lê ALEMBIC_DATABASE_URL (ou DATABASE_URL).
[alembic]
script_location = alembic
prepend_sys_path = .

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARNING
handlers = console
qualname =

[logger_sqlalchemy]
level = WARNING
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

Crie `alembic/env.py`:

```python
"""Ambiente do Alembic, restrito ao schema auth.

O app não é dono do schema tiny (nem dos schemas do dbt): o filtro abaixo impede
que o autogenerate/check enxergue qualquer coisa fora do auth.
"""
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool, text

SCHEMA = "auth"

config = context.config
if config.config_file_name is not None:
    # disable_existing_loggers=False: não calar os loggers da aplicação (e do pytest).
    fileConfig(config.config_file_name, disable_existing_loggers=False)

URL = os.environ.get("ALEMBIC_DATABASE_URL") or os.environ.get("DATABASE_URL")
if not URL:
    raise RuntimeError("Defina ALEMBIC_DATABASE_URL (ou DATABASE_URL) para rodar as migrations.")

# O import dos modelos passa pelo Settings da aplicação, que exige essas duas
# variáveis. Nas migrations elas não são usadas para nada além disso.
os.environ.setdefault("DATABASE_URL", URL)
os.environ.setdefault("SECRET_KEY", "nao-usada-nas-migrations")

from app.models.database import Base  # noqa: E402
from app.models import papel, usuario  # noqa: E402,F401  (registram as tabelas)


def include_name(name, type_, parent_names):
    if type_ == "schema":
        return name == SCHEMA
    return True


def include_object(obj, name, type_, reflected, compare_to):
    if type_ == "table":
        return obj.schema == SCHEMA
    return True


def run_migrations_online() -> None:
    engine = create_engine(URL, poolclass=pool.NullPool)
    with engine.connect() as conn:
        # A tabela de versão mora no auth, então o schema precisa existir antes
        # da primeira revisão rodar.
        conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}"))
        conn.commit()
        context.configure(
            connection=conn,
            target_metadata=Base.metadata,
            include_schemas=True,
            include_name=include_name,
            include_object=include_object,
            version_table_schema=SCHEMA,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    raise RuntimeError("Modo offline não é suportado; rode contra um banco.")
run_migrations_online()
```

Crie `alembic/script.py.mako`:

```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}
"""
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

Crie `alembic/versions/0001_criar_schema_auth.py`:

```python
"""Cria o schema auth com papéis e usuários do DataCoreHS.

Revision ID: 0001
Revises:
Create Date: 2026-09-23
"""
import os
import re

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def _usuario_app() -> str:
    """Usuário do Postgres que a aplicação usa (o do DATABASE_URL de produção)."""
    nome = (os.environ.get("AUTH_APP_DB_USER") or "").strip()
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_-]*", nome):
        raise RuntimeError(
            "Defina AUTH_APP_DB_USER com o usuário do Postgres que o tinyapi usa "
            "(o do DATABASE_URL de produção). Valor atual inválido ou ausente."
        )
    return nome


def upgrade() -> None:
    usuario_app = f'"{_usuario_app()}"'

    op.execute("CREATE SCHEMA IF NOT EXISTS auth")
    op.create_table(
        "papeis",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("nome", sa.Text, nullable=False, unique=True),
        schema="auth",
    )
    op.create_table(
        "usuarios",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.Text, nullable=False, unique=True),
        sa.Column("email", sa.Text, nullable=True),
        sa.Column("senha_hash", sa.Text, nullable=False),
        sa.Column("papel_id", sa.Integer, sa.ForeignKey("auth.papeis.id"), nullable=False),
        sa.Column(
            "criado_em", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        schema="auth",
    )
    op.create_index(
        "usuarios_email_unico",
        "usuarios",
        ["email"],
        unique=True,
        schema="auth",
        postgresql_where=sa.text("email IS NOT NULL"),
    )

    # A aplicação lê e escreve nas tabelas; não recebe nada na alembic_version.
    op.execute(f"GRANT USAGE ON SCHEMA auth TO {usuario_app}")
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON auth.papeis, auth.usuarios TO {usuario_app}")
    op.execute(f"GRANT USAGE, SELECT ON SEQUENCE auth.papeis_id_seq, auth.usuarios_id_seq TO {usuario_app}")


def downgrade() -> None:
    op.drop_index("usuarios_email_unico", table_name="usuarios", schema="auth")
    op.drop_table("usuarios", schema="auth")
    op.drop_table("papeis", schema="auth")
```

Crie `migrations/README.md`:

```markdown
# migrations/ — SQL manual (histórico)

Os arquivos daqui são SQL rodado à mão no Postgres, de antes de o projeto ter
Alembic. Valem só para o schema `tiny`, que é populado pelo processo externo de
sincronia com o Tiny — o app não é dono dele.

- `001_add_cancelada_column.sql` — já aplicado no `datacore`.

O schema `auth` (usuários do DataCoreHS) é do app e é versionado com **Alembic**,
em `alembic/`. Para aplicar: `AUTH_APP_DB_USER=<usuario_da_app> bash scripts/migrar.sh`.
```

- [ ] **Step 7: Rodar os testes e ver passar**

Run: `.venv/bin/pytest tests/test_migrations.py -v`
Expected: todos PASS.

Se `test_modelos_batem_com_a_migration_e_ignoram_o_tiny` acusar diferença em
constraint de unicidade, a causa é nome divergente entre modelo e banco. Nomeie
explicitamente nos dois lados (`sa.UniqueConstraint("username", name="usuarios_username_key")`
na migration e `UniqueConstraint(..., name=...)` no `__table_args__` do modelo) e
rode de novo. Não relaxe o teste.

- [ ] **Step 8: Commit**

```bash
git add requirements.txt requirements-dev.txt docker-compose.test.yml pytest.ini \
  alembic.ini alembic/ app/models/papel.py app/models/usuario.py migrations/README.md tests/
git commit -m "Cria schema auth com Alembic e base da suíte de testes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Configuração, hash de senha e JWT

**Files:**
- Modify: `app/core/config.py` (classe `Settings`, logo abaixo de `DATABASE_URL: str`)
- Modify: `app/core/security.py` (substitui o stub inteiro)
- Modify: `.env.example`
- Test: `tests/test_seguranca.py`

**Interfaces:**
- Consumes: `app.models.usuario.Usuario` (Task 1), só como anotação de tipo.
- Produces (em `app.core.security`):
  - `PAPEL_ADMIN = "admin"`
  - `LIMITE_SENHA_BYTES = 72`
  - `gerar_hash_senha(senha: str) -> str` — lança `ValueError` acima de 72 bytes.
  - `verificar_senha(senha: str, senha_hash: str) -> bool` — nunca lança.
  - `criar_token(usuario) -> str` — `usuario` precisa ter `.id`, `.username` e `.papel.nome`.
  - `decodificar_token(token: str) -> Optional[int]` — devolve o `user_id`, ou `None` se o token for inválido ou estiver expirado.
- Produces (em `app.core.config.settings`): `SECRET_KEY: str`, `ACCESS_TOKEN_EXPIRE_MINUTES: int = 30`, `AUTH_OBRIGATORIA: bool = False`.

- [ ] **Step 1: Escrever os testes (vão falhar)**

Crie `tests/test_seguranca.py`:

```python
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import jwt
import pytest

from app.core.config import settings
from app.core.security import (
    criar_token,
    decodificar_token,
    gerar_hash_senha,
    verificar_senha,
)

# Gerado pelo authapi real (passlib 1.7.4 + bcrypt 4.1.2) para a senha abaixo.
HASH_AUTHAPI = "$2b$12$ePWpw.mP7U.dQzH/FYu8L.IVq1sjlXV3VQ.Pt.vJhQLSS/ExU8Q6e"
SENHA_AUTHAPI = "senha-do-authapi"

USUARIO = SimpleNamespace(id=7, username="maria", papel=SimpleNamespace(nome="financeiro"))


def test_config_tem_os_padroes_da_spec():
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES == 30
    assert settings.AUTH_OBRIGATORIA is False


def test_hash_e_verificacao():
    h = gerar_hash_senha("abc12345")
    assert h.startswith("$2b$")
    assert verificar_senha("abc12345", h) is True
    assert verificar_senha("outra", h) is False


def test_hash_gerado_pelo_authapi_continua_valido():
    assert verificar_senha(SENHA_AUTHAPI, HASH_AUTHAPI) is True
    assert verificar_senha("errada", HASH_AUTHAPI) is False


def test_gerar_hash_recusa_senha_acima_de_72_bytes():
    with pytest.raises(ValueError):
        gerar_hash_senha("x" * 73)
    # 72 bytes contando multibyte: "ç" ocupa 2 bytes em UTF-8.
    with pytest.raises(ValueError):
        gerar_hash_senha("ç" * 37)


def test_verificar_senha_longa_nao_explode_e_compara_os_72_primeiros_bytes():
    # O authapi (bcrypt 4.x) truncava em 72 bytes em silêncio; mantemos a
    # compatibilidade em vez de estourar ValueError no login.
    h = gerar_hash_senha("x" * 72)
    assert verificar_senha("x" * 100, h) is True
    assert verificar_senha("y" * 100, h) is False


def test_verificar_senha_com_hash_corrompido_devolve_false():
    assert verificar_senha("abc", "nao-e-um-hash") is False


def test_token_tem_os_campos_do_authapi():
    token = criar_token(USUARIO)
    dados = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    assert dados["sub"] == "maria"
    assert dados["user_id"] == 7
    assert dados["role"] == "financeiro"
    expira = datetime.fromtimestamp(dados["exp"], tz=timezone.utc)
    restante = expira - datetime.now(timezone.utc)
    assert timedelta(minutes=29) < restante <= timedelta(minutes=30)


def test_decodificar_token_valido_devolve_user_id():
    assert decodificar_token(criar_token(USUARIO)) == 7


def _assinado(dados, chave=None):
    return jwt.encode(dados, chave or settings.SECRET_KEY, algorithm="HS256")


@pytest.mark.parametrize(
    "token",
    [
        "lixo",
        "",
        _assinado({"user_id": 7, "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}, chave="chave-do-authapi"),
        _assinado({"user_id": 7, "exp": datetime.now(timezone.utc) - timedelta(seconds=1)}),
        _assinado({"user_id": "7", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}),
        _assinado({"sub": "maria", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}),
    ],
    ids=["lixo", "vazio", "outra-chave", "expirado", "user-id-texto", "sem-user-id"],
)
def test_decodificar_token_invalido_devolve_none(token):
    assert decodificar_token(token) is None
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `.venv/bin/pytest tests/test_seguranca.py -v`
Expected: FAIL com `ImportError: cannot import name 'criar_token' from 'app.core.security'`.

- [ ] **Step 3: Config**

Em `app/core/config.py`, logo abaixo de `DATABASE_URL: str`, acrescente:

```python

    # Autenticação (usuários do DataCoreHS no schema auth)
    SECRET_KEY: str  # diferente da do authapi — ver spec 2026-09-23
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    # false: rotas de dados aceitam anônimo e só registram WARNING (transição)
    # true: rotas de dados exigem token válido
    AUTH_OBRIGATORIA: bool = False
```

- [ ] **Step 4: Núcleo de `security.py`**

Substitua o conteúdo inteiro de `app/core/security.py` por:

```python
# app/core/security.py
"""Autenticação da API: hash de senha, JWT e as dependências de proteção.

Os usuários moram no schema auth do datacore (antes ficavam no authapi). Os hashes
são bcrypt $2b$, compatíveis com os que o authapi gerava.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt

from app.core.config import settings

PAPEL_ADMIN = "admin"
LIMITE_SENHA_BYTES = 72  # limite do bcrypt
ALGORITMO = "HS256"


def gerar_hash_senha(senha: str) -> str:
    dados = senha.encode("utf-8")
    if len(dados) > LIMITE_SENHA_BYTES:
        raise ValueError(f"Senha acima de {LIMITE_SENHA_BYTES} bytes.")
    return bcrypt.hashpw(dados, bcrypt.gensalt()).decode("ascii")


def verificar_senha(senha: str, senha_hash: str) -> bool:
    # Trunca em 72 bytes como o bcrypt 4.x do authapi fazia em silêncio: assim a
    # senha de quem foi copiado continua valendo e o bcrypt 5 não lança erro.
    try:
        return bcrypt.checkpw(
            senha.encode("utf-8")[:LIMITE_SENHA_BYTES], senha_hash.encode("ascii")
        )
    except ValueError:
        return False


def criar_token(usuario) -> str:
    expira = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    dados = {
        "sub": usuario.username,
        "user_id": usuario.id,
        "role": usuario.papel.nome,
        "exp": expira,
    }
    return jwt.encode(dados, settings.SECRET_KEY, algorithm=ALGORITMO)


def decodificar_token(token: str) -> Optional[int]:
    """Devolve o user_id de um token válido, ou None."""
    try:
        dados = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITMO])
    except jwt.PyJWTError:
        return None
    user_id = dados.get("user_id")
    if not isinstance(user_id, int) or isinstance(user_id, bool):
        return None
    return user_id
```

- [ ] **Step 5: `.env.example`**

Acrescente depois do bloco `# Database`:

```
# ===== AUTENTICAÇÃO =====
# Chave dos JWT. Gere com: python -c "import secrets; print(secrets.token_urlsafe(48))"
# Tem que ser DIFERENTE da SECRET_KEY do authapi.
SECRET_KEY=
ACCESS_TOKEN_EXPIRE_MINUTES=30
# false = rotas de dados aceitam anônimo e só registram WARNING (período de transição)
# true  = rotas de dados exigem token (401 sem ele)
AUTH_OBRIGATORIA=false
```

- [ ] **Step 6: Rodar e ver passar**

Run: `.venv/bin/pytest -v`
Expected: `test_seguranca.py` e `test_migrations.py` todos PASS.

- [ ] **Step 7: Commit**

```bash
git add app/core/config.py app/core/security.py .env.example tests/test_seguranca.py
git commit -m "Adiciona hash bcrypt e JWT compatíveis com o authapi

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Rotas `/auth` (login e gestão de usuários)

**Files:**
- Modify: `app/core/security.py` (acrescenta as dependências)
- Create: `app/schemas/auth.py`
- Create: `app/api/endpoints/auth.py`
- Modify: `app/api/endpoints/__init__.py` (+1 linha)
- Modify: `app/main.py` (registra o router)
- Modify: `tests/conftest.py` (fixtures de cliente e usuários)
- Test: `tests/test_auth_rotas.py`

**Interfaces:**
- Consumes: `Usuario`, `Papel` (Task 1); `gerar_hash_senha`, `verificar_senha`, `criar_token`, `decodificar_token`, `PAPEL_ADMIN`, `LIMITE_SENHA_BYTES` (Task 2); `app.models.database.SessionLocal`.
- Produces:
  - Em `app.core.security`: `bearer = HTTPBearer(auto_error=False)`; `usuario_do_token(token: str) -> Optional[Usuario]`; `usuario_atual(...) -> Usuario` (dependência FastAPI, `401` se não autenticado); `exigir_admin(...) -> Usuario` (dependência, `403` se não é admin); `nao_autenticado() -> HTTPException`.
  - `app.api.endpoints.auth` (reexportado como `endpoints.auth`).
  - Fixtures no conftest: `client`, `criar_usuario(username, senha="senha123", papel="comum", email=None, senha_hash=None) -> int`, `login(username, senha="senha123") -> dict` (headers), `admin` e `comum` (`SimpleNamespace(id, headers)`).

- [ ] **Step 1: Fixtures no conftest**

Acrescente ao fim de `tests/conftest.py`:

```python
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
```

- [ ] **Step 2: Escrever os testes das rotas (vão falhar)**

Crie `tests/test_auth_rotas.py`:

```python
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
    [("maria", "errada"), ("ninguem", "segredo1"), ("maria", "x" * 100), ("maria", "")],
    ids=["senha-errada", "usuario-inexistente", "senha-longa", "senha-vazia"],
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
        headers = _token({"user_id": comum.id, "exp": agora + timedelta(minutes=5)}, chave="chave-do-authapi")
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
    ],
    ids=["username-vazio", "senha-vazia", "senha-73-bytes", "email-invalido"],
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
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `.venv/bin/pytest tests/test_auth_rotas.py -v`
Expected: FAIL. As rotas `/auth/...` devolvem 404, e a fixture `login` falha no `assert r.status_code == 200`.

- [ ] **Step 4: Dependências de autenticação em `security.py`**

Em `app/core/security.py`, troque o bloco de imports por:

```python
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings
from app.models.database import SessionLocal
from app.models.usuario import Usuario
```

E acrescente ao fim do arquivo:

```python
# auto_error=False: quem decide o que fazer sem token são as dependências abaixo
# (e exigir_usuario, que na transição deixa passar).
bearer = HTTPBearer(auto_error=False)


def nao_autenticado() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def usuario_do_token(token: str) -> Optional[Usuario]:
    """Valida o token e busca o usuário no banco.

    O papel que vale é o do banco, não o gravado no token: exclusão ou rebaixamento
    têm efeito na hora.
    """
    user_id = decodificar_token(token)
    if user_id is None:
        return None
    db = SessionLocal()
    try:
        return db.get(Usuario, user_id)  # papel vem junto (lazy="joined")
    finally:
        db.close()


def usuario_atual(
    credenciais: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> Usuario:
    usuario = usuario_do_token(credenciais.credentials) if credenciais else None
    if usuario is None:
        raise nao_autenticado()
    return usuario


def exigir_admin(usuario: Usuario = Depends(usuario_atual)) -> Usuario:
    if usuario.papel.nome != PAPEL_ADMIN:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")
    return usuario
```

- [ ] **Step 5: Schemas**

Crie `app/schemas/auth.py`:

```python
from datetime import datetime
from typing import Annotated, Optional

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from app.core.security import LIMITE_SENHA_BYTES

# Os nomes do JSON seguem o authapi (o front já fala esse contrato); os nomes das
# colunas são em português, daí os validation_alias.


def _normalizar_username(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return None
    valor = valor.strip().lower()
    if not valor:
        raise ValueError("username não pode ser vazio")
    return valor


def _normalizar_email(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return None
    valor = valor.strip().lower()
    if not valor:
        return None  # "" vira null: senão dois vazios colidiriam no índice único
    local, arroba, dominio = valor.partition("@")
    if not arroba or not local or not dominio:
        raise ValueError("e-mail inválido")
    return valor


def _validar_senha(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return None
    if not valor:
        raise ValueError("senha não pode ser vazia")
    if len(valor.encode("utf-8")) > LIMITE_SENHA_BYTES:
        raise ValueError(f"senha acima de {LIMITE_SENHA_BYTES} bytes")
    return valor


Username = Annotated[str, AfterValidator(_normalizar_username)]
Senha = Annotated[str, AfterValidator(_validar_senha)]
Email = Annotated[Optional[str], AfterValidator(_normalizar_email)]


class PapelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str = Field(validation_alias="nome")


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: Optional[str] = None
    created_at: Optional[datetime] = Field(default=None, validation_alias="criado_em")
    role: Optional[PapelOut] = Field(default=None, validation_alias="papel")


class LoginEntrada(BaseModel):
    # Sem validar a senha: no login, senha estranha é só senha errada (401).
    username: Annotated[str, AfterValidator(lambda v: v.strip().lower())]
    password: str


class TokenSaida(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str
    user_id: int


class UsuarioCriar(BaseModel):
    username: Username
    password: Senha
    role_name: Optional[str] = None
    email: Email = None


class UsuarioAtualizar(BaseModel):
    """Campos ausentes não mudam. Para o e-mail, enviar null ou "" limpa."""

    username: Optional[Username] = None
    password: Optional[Senha] = None
    role_name: Optional[str] = None
    email: Email = None
```

- [ ] **Step 6: Router**

Crie `app/api/endpoints/auth.py`:

```python
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import (
    PAPEL_ADMIN,
    criar_token,
    exigir_admin,
    gerar_hash_senha,
    usuario_atual,
    verificar_senha,
)
from app.models.database import SessionLocal
from app.models.papel import Papel
from app.models.usuario import Usuario
from app.schemas.auth import (
    LoginEntrada,
    PapelOut,
    TokenSaida,
    UsuarioAtualizar,
    UsuarioCriar,
    UsuarioOut,
)

# Substitui o authapi para o DataCoreHS. Caminhos e JSON iguais aos dele; o front
# só troca a base URL para .../auth.
router = APIRouter(prefix="/auth", tags=["Autenticação"])

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _buscar_papel(db: Session, nome: str) -> Papel:
    papel = db.query(Papel).filter(Papel.nome == nome).first()
    if not papel:
        raise HTTPException(status_code=400, detail=f"Role '{nome}' not found.")
    return papel


def _username_em_uso(db: Session, username: str, ignorar_id: Optional[int] = None) -> bool:
    query = db.query(Usuario.id).filter(func.lower(Usuario.username) == username)
    if ignorar_id is not None:
        query = query.filter(Usuario.id != ignorar_id)
    return query.first() is not None


def _email_em_uso(db: Session, email: str, ignorar_id: Optional[int] = None) -> bool:
    query = db.query(Usuario.id).filter(Usuario.email == email)
    if ignorar_id is not None:
        query = query.filter(Usuario.id != ignorar_id)
    return query.first() is not None


def _salvar(db: Session, usuario: Usuario) -> None:
    # As checagens acima cobrem o caso normal; isto cobre duas requisições
    # simultâneas com o mesmo username/e-mail.
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Username ou e-mail já cadastrado.")
    db.refresh(usuario)


# POST /auth/login
@router.post("/login", response_model=TokenSaida)
def login(dados: LoginEntrada, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(func.lower(Usuario.username) == dados.username).first()
    if not usuario or not verificar_senha(dados.password, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    return TokenSaida(
        access_token=criar_token(usuario),
        token_type="bearer",
        role=usuario.papel.nome,
        username=usuario.username,
        user_id=usuario.id,
    )


# GET /auth/me
@router.get("/me", response_model=UsuarioOut)
def ler_me(atual: Usuario = Depends(usuario_atual)):
    return atual


# GET /auth/roles
@router.get("/roles", response_model=List[PapelOut])
def listar_papeis(db: Session = Depends(get_db), atual: Usuario = Depends(usuario_atual)):
    return db.query(Papel).order_by(Papel.id).all()


# GET /auth/users
@router.get("/users", response_model=List[UsuarioOut])
def listar_usuarios(db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    return db.query(Usuario).order_by(Usuario.id).all()


# GET /auth/users/{user_id} — admin vê qualquer um; os demais, só a si mesmos
@router.get("/users/{user_id}", response_model=UsuarioOut)
def obter_usuario(user_id: int, db: Session = Depends(get_db), atual: Usuario = Depends(usuario_atual)):
    if atual.papel.nome != PAPEL_ADMIN and atual.id != user_id:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")
    usuario = db.get(Usuario, user_id)
    if not usuario:
        raise HTTPException(status_code=404, detail=f"Usuário {user_id} não encontrado")
    return usuario


# POST /auth/register — só admin (no authapi era aberta)
@router.post("/register", response_model=UsuarioOut)
def cadastrar_usuario(dados: UsuarioCriar, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    if _username_em_uso(db, dados.username):
        raise HTTPException(status_code=400, detail="Username already registered")
    if dados.email is not None and _email_em_uso(db, dados.email):
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")
    papel = _buscar_papel(db, dados.role_name or "comum")

    usuario = Usuario(
        username=dados.username,
        email=dados.email,
        senha_hash=gerar_hash_senha(dados.password),
        papel=papel,
    )
    db.add(usuario)
    _salvar(db, usuario)
    return usuario


# PUT /auth/users/{user_id} — só admin; senha e e-mail são definidos pelo admin
@router.put("/users/{user_id}", response_model=UsuarioOut)
def atualizar_usuario(
    user_id: int,
    dados: UsuarioAtualizar,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin),
):
    usuario = db.get(Usuario, user_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="User not found")

    if dados.username is not None:
        if _username_em_uso(db, dados.username, ignorar_id=usuario.id):
            raise HTTPException(status_code=400, detail="Username already registered")
        usuario.username = dados.username

    if "email" in dados.model_fields_set:
        if dados.email is not None and _email_em_uso(db, dados.email, ignorar_id=usuario.id):
            raise HTTPException(status_code=400, detail="E-mail já cadastrado.")
        usuario.email = dados.email

    if dados.password is not None:
        usuario.senha_hash = gerar_hash_senha(dados.password)

    if dados.role_name is not None:
        papel = _buscar_papel(db, dados.role_name)
        # Evita o admin se trancar pra fora (e a empresa ficar sem admin).
        if usuario.id == admin.id and papel.nome != PAPEL_ADMIN:
            raise HTTPException(
                status_code=400,
                detail="Não é possível remover seu próprio papel de administrador.",
            )
        usuario.papel = papel

    _salvar(db, usuario)
    return usuario


# DELETE /auth/users/{user_id}
@router.delete("/users/{user_id}", status_code=204)
def excluir_usuario(user_id: int, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="Não é possível excluir seu próprio usuário.")
    usuario = db.get(Usuario, user_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    db.delete(usuario)
    db.commit()
```

- [ ] **Step 7: Registrar o router**

Em `app/api/endpoints/__init__.py`, acrescente ao fim:

```python
from .auth import router as auth
```

Em `app/main.py`, logo abaixo de `# Registrar endpoints`, acrescente:

```python
app.include_router(endpoints.auth)
```

- [ ] **Step 8: Rodar e ver passar**

Run: `.venv/bin/pytest -v`
Expected: todos PASS.

- [ ] **Step 9: Commit**

```bash
git add app/core/security.py app/schemas/auth.py app/api/endpoints/auth.py \
  app/api/endpoints/__init__.py app/main.py tests/conftest.py tests/test_auth_rotas.py
git commit -m "Adiciona rotas de login e gestão de usuários em /auth

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Proteção das rotas de dados com flag de transição

**Files:**
- Modify: `app/core/security.py` (acrescenta `exigir_usuario`)
- Modify: `app/main.py`
- Test: `tests/test_protecao.py`

**Interfaces:**
- Consumes: `bearer`, `usuario_do_token`, `nao_autenticado` (Task 3); `settings.AUTH_OBRIGATORIA` (Task 2).
- Produces: `exigir_usuario(request: Request, credenciais=Depends(bearer)) -> Optional[Usuario]` em `app.core.security`; logger `"app.auth"`; `PROTEGIDO` em `app.main`.

- [ ] **Step 1: Escrever os testes (vão falhar)**

Crie `tests/test_protecao.py`:

```python
import logging

import pytest
from fastapi.routing import APIRoute

from app.core.config import settings
from app.core.security import exigir_usuario


@pytest.fixture
def flag_ligada(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_OBRIGATORIA", True)


def test_flag_desligada_anonimo_passa_e_gera_warning(client, caplog):
    with caplog.at_level(logging.WARNING, logger="app.auth"):
        r = client.get("/marcadores/")
    assert r.status_code == 200
    assert "GET /marcadores/" in caplog.text


def test_flag_desligada_token_invalido_passa_e_gera_warning(client, caplog):
    with caplog.at_level(logging.WARNING, logger="app.auth"):
        r = client.get("/marcadores/", headers={"Authorization": "Bearer lixo"})
    assert r.status_code == 200
    assert "GET /marcadores/" in caplog.text


def test_token_valido_nao_gera_warning(client, comum, caplog):
    with caplog.at_level(logging.WARNING, logger="app.auth"):
        r = client.get("/marcadores/", headers=comum.headers)
    assert r.status_code == 200
    assert [x for x in caplog.records if x.name == "app.auth"] == []


def test_flag_ligada_bloqueia_anonimo_e_token_invalido(client, flag_ligada):
    for headers in ({}, {"Authorization": "Bearer lixo"}):
        r = client.get("/marcadores/", headers=headers)
        assert r.status_code == 401
        assert r.headers["www-authenticate"] == "Bearer"


def test_flag_ligada_libera_usuario_logado(client, comum, flag_ligada):
    assert client.get("/marcadores/", headers=comum.headers).status_code == 200


@pytest.mark.parametrize("rota", ["/", "/docs", "/redoc", "/openapi.json"])
def test_rotas_publicas_continuam_publicas_com_flag_ligada(client, flag_ligada, rota):
    assert client.get(rota).status_code == 200


def test_login_continua_publico_com_flag_ligada(client, criar_usuario, flag_ligada):
    criar_usuario("maria")
    r = client.post("/auth/login", json={"username": "maria", "password": "senha123"})
    assert r.status_code == 200


def test_toda_rota_de_dados_esta_protegida():
    # Pega o router novo que alguém registrar sem dependencies=PROTEGIDO.
    from app.main import app

    abertas = [
        r.path
        for r in app.routes
        if isinstance(r, APIRoute)
        and r.path != "/"
        and not r.path.startswith("/auth")
        and not any(d.dependency is exigir_usuario for d in r.dependencies)
    ]
    assert abertas == []


def test_openapi_declara_bearer(client):
    esquema = client.get("/openapi.json").json()
    assert "HTTPBearer" in esquema["components"]["securitySchemes"]
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `.venv/bin/pytest tests/test_protecao.py -v`
Expected: FAIL com `ImportError: cannot import name 'exigir_usuario'`.

- [ ] **Step 3: `exigir_usuario`**

Em `app/core/security.py`:
- acrescente `import logging` aos imports da biblioteca padrão;
- troque `from fastapi import Depends, HTTPException, status` por `from fastapi import Depends, HTTPException, Request, status`;
- logo abaixo de `ALGORITMO = "HS256"`, acrescente `logger = logging.getLogger("app.auth")`;
- acrescente ao fim do arquivo:

```python
def exigir_usuario(
    request: Request,
    credenciais: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> Optional[Usuario]:
    """Protege as rotas de dados.

    AUTH_OBRIGATORIA=true: sem token válido, 401.
    AUTH_OBRIGATORIA=false (transição): deixa passar, mas registra quem chamou sem
    token — é assim que se descobre cliente esquecido antes de ligar a flag.
    """
    usuario = usuario_do_token(credenciais.credentials) if credenciais else None
    if usuario is not None:
        return usuario
    if settings.AUTH_OBRIGATORIA:
        raise nao_autenticado()
    origem = request.client.host if request.client else "?"
    logger.warning(
        "Acesso sem token válido: %s %s (origem %s)", request.method, request.url.path, origem
    )
    return None
```

- [ ] **Step 4: `main.py`**

Em `app/main.py`:
- troque `from fastapi import FastAPI` por `from fastapi import Depends, FastAPI`;
- acrescente `from app.core.security import exigir_usuario` junto dos imports;
- no `allow_origins`, acrescente `"http://localhost:5173"` (porta de dev do DataCoreHS, que o authapi também liberava);
- substitua todo o bloco `# Registrar endpoints` por:

```python
# Registrar endpoints
# Toda rota de dados passa por exigir_usuario: com AUTH_OBRIGATORIA=false só
# registra acesso anônimo; com true, devolve 401. Router novo entra com PROTEGIDO.
PROTEGIDO = [Depends(exigir_usuario)]

app.include_router(endpoints.auth)
app.include_router(endpoints.nota_fiscal, dependencies=PROTEGIDO)
app.include_router(endpoints.nota_servico, dependencies=PROTEGIDO)
app.include_router(endpoints.cliente, dependencies=PROTEGIDO)
app.include_router(endpoints.item_nota, dependencies=PROTEGIDO)
app.include_router(endpoints.endereco_entrega, dependencies=PROTEGIDO)
app.include_router(endpoints.forma_envio, dependencies=PROTEGIDO)
app.include_router(endpoints.marcador, dependencies=PROTEGIDO)
app.include_router(endpoints.configuracoes, dependencies=PROTEGIDO)
app.include_router(endpoints.estoque, dependencies=PROTEGIDO)
app.include_router(endpoints.contas_pagar, dependencies=PROTEGIDO)
app.include_router(endpoints.contas_receber, dependencies=PROTEGIDO)
app.include_router(endpoints.centro_custo, dependencies=PROTEGIDO)
```

- [ ] **Step 5: Rodar a suíte inteira**

Run: `.venv/bin/pytest -v`
Expected: todos PASS.

- [ ] **Step 6: Commit**

```bash
git add app/core/security.py app/main.py tests/test_protecao.py
git commit -m "Protege as rotas de dados com token e flag de transição

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Scripts de operação (migration e cópia do authapi)

**Files:**
- Create: `scripts/_admin_url.py`, `scripts/migrar.sh`, `scripts/copiar_usuarios_authapi.py`
- Test: `tests/test_copiar_usuarios.py`

**Interfaces:**
- Consumes: tabelas `auth.papeis`/`auth.usuarios` (Task 1); fixtures `engine`, `client` (Tasks 1 e 3).
- Produces:
  - `scripts/_admin_url.py`: `ADMIN_TOML: Path`; `url_admin(apelido: str) -> str` (encerra com `SystemExit` se o apelido não existir). Executável: `python scripts/_admin_url.py datacore` imprime a URL.
  - `scripts/copiar_usuarios_authapi.py`: `copiar(origem_url: str, destino_url: str) -> dict[str, list[str]]` com as chaves `papeis_copiados`, `papeis_pulados`, `usuarios_copiados`, `usuarios_pulados`.

- [ ] **Step 1: Escrever os testes (vão falhar)**

Crie `tests/test_copiar_usuarios.py`:

```python
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `.venv/bin/pytest tests/test_copiar_usuarios.py -v`
Expected: FAIL com `ModuleNotFoundError: No module named '_admin_url'`.

- [ ] **Step 3: `scripts/_admin_url.py`**

```python
"""Monta a URL de conexão de um banco a partir do admin.toml do cadastro central.

Roda no Konsole do Erick: o admin.toml tem o superusuário, e o Claude não lê esse
arquivo. Uso direto: python scripts/_admin_url.py datacore
"""
import sys
import tomllib
from pathlib import Path
from urllib.parse import quote

ADMIN_TOML = Path.home() / ".config" / "bancos" / "admin.toml"


def url_admin(apelido: str) -> str:
    with ADMIN_TOML.open("rb") as fh:
        cadastro = tomllib.load(fh)
    if apelido not in cadastro:
        raise SystemExit(f"Banco '{apelido}' não está no {ADMIN_TOML}.")
    d = cadastro[apelido]
    usuario = quote(str(d["usuario"]), safe="")
    senha = quote(str(d["senha"]), safe="")
    return f"postgresql://{usuario}:{senha}@{d['host']}:{d['porta']}/{d['banco']}"


if __name__ == "__main__":
    print(url_admin(sys.argv[1] if len(sys.argv) > 1 else "datacore"))
```

- [ ] **Step 4: `scripts/copiar_usuarios_authapi.py`**

```python
"""Copia papéis e usuários do banco do authapi para o schema auth do datacore.

Preserva ids e hashes (ninguém troca de senha; os ids 1, 3 e 4 liberam
/financeiro e /locacao no front). E-mail fica vazio. Idempotente: quem já existe
(mesmo id) é pulado. Tudo numa transação: se algo falha, nada é gravado.

Uso, no Konsole e na raiz do repo, depois de scripts/migrar.sh:
    .venv/bin/python scripts/copiar_usuarios_authapi.py
A URL do banco do authapi é pedida sem eco (tem senha). O destino vem do admin.toml.
"""
import getpass
import sys
from pathlib import Path

from sqlalchemy import create_engine, text

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _admin_url import url_admin  # noqa: E402

INSERIR_PAPEL = text(
    "INSERT INTO auth.papeis (id, nome) VALUES (:id, :nome)"
    " ON CONFLICT (id) DO NOTHING RETURNING id"
)
INSERIR_USUARIO = text(
    "INSERT INTO auth.usuarios (id, username, senha_hash, papel_id, criado_em)"
    " VALUES (:id, lower(:username), :senha_hash, :papel_id, COALESCE(:criado_em, now()))"
    " ON CONFLICT (id) DO NOTHING RETURNING id"
)
# Próximo id = max + 1 (ou 1 com a tabela vazia).
AJUSTAR_SEQUENCE = (
    "SELECT setval(pg_get_serial_sequence('auth.{t}', 'id'),"
    " COALESCE((SELECT max(id) FROM auth.{t}), 0) + 1, false)"
)


def copiar(origem_url: str, destino_url: str) -> dict:
    origem = create_engine(origem_url)
    destino = create_engine(destino_url)
    try:
        with origem.connect() as conn:
            papeis = conn.execute(text("SELECT id, name FROM roles ORDER BY id")).all()
            usuarios = conn.execute(text(
                "SELECT id, username, password_hash, role_id, created_at FROM users ORDER BY id"
            )).all()

        resultado = {"papeis_copiados": [], "papeis_pulados": [], "usuarios_copiados": [], "usuarios_pulados": []}
        with destino.begin() as conn:
            for p in papeis:
                novo = conn.execute(INSERIR_PAPEL, {"id": p.id, "nome": p.name}).first()
                resultado["papeis_copiados" if novo else "papeis_pulados"].append(p.name)
            for u in usuarios:
                novo = conn.execute(INSERIR_USUARIO, {
                    "id": u.id,
                    "username": u.username,
                    "senha_hash": u.password_hash,
                    "papel_id": u.role_id,
                    "criado_em": u.created_at,
                }).first()
                resultado["usuarios_copiados" if novo else "usuarios_pulados"].append(u.username.lower())
            for tabela in ("papeis", "usuarios"):
                conn.execute(text(AJUSTAR_SEQUENCE.format(t=tabela)))
        return resultado
    finally:
        origem.dispose()
        destino.dispose()


def main() -> None:
    origem_url = getpass.getpass("URL do banco do authapi (postgresql://...): ").strip()
    resultado = copiar(origem_url, url_admin("datacore"))
    print(f"Papéis copiados ({len(resultado['papeis_copiados'])}): {', '.join(resultado['papeis_copiados']) or '-'}")
    print(f"Papéis já existentes ({len(resultado['papeis_pulados'])}): {', '.join(resultado['papeis_pulados']) or '-'}")
    print(f"Usuários copiados ({len(resultado['usuarios_copiados'])}): {', '.join(resultado['usuarios_copiados']) or '-'}")
    print(f"Usuários já existentes ({len(resultado['usuarios_pulados'])}): {', '.join(resultado['usuarios_pulados']) or '-'}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: `scripts/migrar.sh`**

```bash
#!/usr/bin/env bash
# Aplica as migrations do schema auth no datacore com o superusuário do admin.toml.
# Roda no Konsole (o Claude não lê o admin.toml), na raiz do repo:
#   AUTH_APP_DB_USER=<usuario_do_DATABASE_URL_de_produção> bash scripts/migrar.sh
set -euo pipefail
cd "$(dirname "$0")/.."

: "${AUTH_APP_DB_USER:?Defina AUTH_APP_DB_USER com o usuário do Postgres que o tinyapi usa em produção}"
PY=.venv/bin/python

ALEMBIC_DATABASE_URL="$("$PY" scripts/_admin_url.py datacore)"
export ALEMBIC_DATABASE_URL AUTH_APP_DB_USER

echo "== Antes:";  "$PY" -m alembic current
"$PY" -m alembic upgrade head
echo "== Depois:"; "$PY" -m alembic current
```

Run: `chmod +x scripts/migrar.sh && bash -n scripts/migrar.sh`
Expected: sem saída (sintaxe ok).

- [ ] **Step 6: Rodar e ver passar**

Run: `.venv/bin/pytest -v`
Expected: todos PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/ tests/test_copiar_usuarios.py
git commit -m "Adiciona scripts de migration e cópia dos usuários do authapi

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Documentação e verificação final

**Files:**
- Modify: `CLAUDE.md` (**sem commit**: o arquivo está fora do git)
- Modify: `README.md`, só se ele listar variáveis de ambiente ou comandos (confira com `grep -n "DATABASE_URL\|uvicorn" README.md`)

- [ ] **Step 1: Atualizar `CLAUDE.md`**

Na seção **Comandos**, acrescente ao bloco:

```bash
pip install -r requirements-dev.txt
docker compose -f docker-compose.test.yml up -d --wait   # Postgres dos testes (porta 55432)
pytest                                                    # suíte (só o módulo de auth por enquanto)
AUTH_APP_DB_USER=<usuario_app> bash scripts/migrar.sh     # migrations do schema auth (Konsole, superusuário)
```

Troque a frase "**Não existe suíte de testes**; ..." por:

> A suíte (`tests/`) cobre autenticação, migrations e o script de cópia, e roda
> contra o Postgres de `docker-compose.test.yml`, nunca contra o `datacore`. As
> rotas de dados antigas não têm teste. `testar_importacao_nfse.py` continua sendo
> script manual contra uma API rodando.

Em **Arquitetura → O app não é dono do schema**, acrescente um parágrafo:

> **Exceção: o schema `auth` é do app.** Os usuários e papéis do DataCoreHS
> (`auth.usuarios`, `auth.papeis`) são versionados com **Alembic** (`alembic/`),
> cujo `env.py` só enxerga o `auth`. O `migrations/` segue como SQL manual,
> histórico do `tiny`. A migration roda pelo `scripts/migrar.sh` no Konsole, nunca
> no startup.

Em **Pontos de atenção**, troque o item "**A API não tem autenticação.** ..." por:

> - **Autenticação JWT (`core/security.py`), rotas em `/auth`.** Substitui o
>   authapi para o DataCoreHS (o authapi segue de pé pro HealthScore). As rotas de
>   dados passam por `exigir_usuario` via `PROTEGIDO` no `main.py`; router novo
>   **precisa** entrar com `dependencies=PROTEGIDO` (há teste que falha se não
>   entrar). `AUTH_OBRIGATORIA=false` deixa passar anônimo com `WARNING` no log;
>   `true` bloqueia. Senha e e-mail são definidos só por admin.

- [ ] **Step 2: Verificação final**

Run: `.venv/bin/pytest -v`
Expected: todos PASS, zero skip.

Run: `DATABASE_URL=postgresql://teste:teste@localhost:55432/tiny_teste SECRET_KEY=x .venv/bin/python -c "import app.main"`
Expected: sem erro.

Run: `git status --short`
Expected: só `CLAUDE.md` e `SETUP-CLAUDE.md` fora do git.

- [ ] **Step 3: Commit (se o README mudou)**

```bash
git add README.md
git commit -m "Documenta autenticação e migrations do schema auth

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Entregar ao Erick o roteiro de implantação**

Não executar. Só apresentar (é a seção 9 da spec):
1. No EasyPanel: `SECRET_KEY` nova (`python -c "import secrets; print(secrets.token_urlsafe(48))"`) e `AUTH_OBRIGATORIA=false`. Deploy.
2. No Konsole: `AUTH_APP_DB_USER=<usuario> bash scripts/migrar.sh` e depois `.venv/bin/python scripts/copiar_usuarios_authapi.py`.
3. Conferir pelo Swagger: `/auth/login` com uma conta real, `/auth/me`, `/auth/users`.
4. Etapa do front (sessão no DataCoreHS).
5. Log sem `Acesso sem token válido` por alguns dias → `AUTH_OBRIGATORIA=true`.

Também perguntar se o Erick quer atualizar a nota `Health-Safety/Sistemas/DataCoreHS.md` do vault. Fazer isso com a skill `nota-obsidian`.
