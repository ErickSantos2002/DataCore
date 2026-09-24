# Login com Microsoft (Entra ID) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** somar "Entrar com Microsoft" ao login do DataCoreHS, ligando a conta do Entra ID ao usuário do DataCore pelo e-mail, sem mexer no login por senha.

**Architecture:** o backend (FastAPI) faz o OAuth com a Microsoft, com o `state` num cookie. Ele acha o usuário pelo e-mail do Graph, gera o JWT de sempre e o entrega ao front por um ticket de uso único, de 60 s, guardado em `auth.sso_tickets` no Postgres. O front (React) troca o ticket pelo token e reaproveita o mesmo caminho de sessão do login por senha.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic + `requests` (backend, pytest contra Postgres descartável); React 19 + TypeScript + react-router + axios (frontend, vitest + Testing Library).

**Spec:** `docs/superpowers/specs/2026-09-24-login-microsoft-design.md`

## Global Constraints

- Código, comentários, interface e mensagem de commit em **português do Brasil**.
- **Repo público:** antes de cada commit, `scripts/varrer.sh` (da raiz) tem que dar `OK: nada encontrado`. `git add` por caminho, nunca `-A`. O `backend/.env` tem o client secret real e **nunca** entra no git (já está no `.gitignore`).
- Os testes do backend não podem usar os valores reais do `backend/.env`. O `conftest.py` zera as cinco variáveis do SSO, e quem precisa de SSO ligado usa a fixture `sso`.
- Os endpoints são `def` (síncronos), como os demais do `auth.py`.
- Comparação de `state`: `secrets.compare_digest(a.encode(), b.encode())`, **nunca** sobre `str`.
- Cookie: nome `sso_state`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/auth/microsoft`, `Max-Age=600`.
- Ticket: `secrets.token_urlsafe(32)`, validade de 60 s, resgate por `DELETE ... RETURNING`.
- Escopos da Microsoft: `openid email profile User.Read`. Graph: `GET https://graph.microsoft.com/v1.0/me`, com `mail` e, se vier nulo, `userPrincipalName`.
- Códigos de `erro_sso`: `sso_desligado`, `cancelado`, `state_invalido`, `falha_microsoft`, `usuario_nao_encontrado`.
- Mensagens na tela (texto exato):
  - `usuario_nao_encontrado` → "Sua conta Microsoft não tem acesso ao DataCore. Fale com o administrador."
  - `cancelado` → "Login com Microsoft cancelado."
  - demais → "Não foi possível entrar com a Microsoft. Tente de novo ou use usuário e senha."
  - ticket inválido (backend e tela de callback) → "Link de acesso inválido ou expirado."
- Frontend: a suíte passa em `TZ=UTC` **e** em `TZ=America/Sao_Paulo`. O lint não pode subir da baseline (9 avisos, 0 erros). Nada de hexadecimal em `.ts/.tsx/.css`, porque o `guarda-cores` acusa. O logo da Microsoft vai como arquivo `.svg` em `src/assets/`.
- **Migration e deploy:** o Erick roda a migration no Konsole, porque ela lê o `admin.toml`, que o Claude não lê. O "Implantar" do EasyPanel também é ele quem clica.

## Review Focus

1. **`state` com acento ou emoji na query string**: o `compare_digest` sobre `str` levantaria `TypeError` e daria 500; o esperado é `erro_sso=state_invalido`. Teste na Task 3.
2. **O mesmo ticket trocado duas vezes ao mesmo tempo** (clique duplo, aba duplicada, retry do navegador): exatamente uma troca recebe o token. Teste na Task 1.
3. **`StrictMode` montando o callback duas vezes em dev**: a segunda troca queimaria o ticket e mostraria erro a quem acabou de entrar. Esperado: uma chamada só. Teste na Task 6.
4. **Conta sem `mail` no Entra (só `userPrincipalName`) e e-mail com maiúsculas**: tem que achar o usuário cadastrado em minúsculas. Testes nas Tasks 2 e 3.
5. **`/auth/sso/status` fora do ar ou lento**: o login por senha continua funcionando e o botão só não aparece. Teste na Task 5.

---

### Task 1: Tabela de tickets (migration 0002, modelo, `sso_tickets`) e configuração

**Files:**
- Create: `backend/alembic/versions/0002_sso_tickets.py`
- Create: `backend/app/models/sso_ticket.py`
- Create: `backend/app/core/sso_tickets.py`
- Create: `backend/tests/test_sso_tickets.py`
- Modify: `backend/alembic/env.py:28` (importar o modelo novo)
- Modify: `backend/app/core/config.py:24` (cinco variáveis + `sso_ativo`)
- Modify: `backend/tests/conftest.py:20-23` (zerar SSO) e `:86-91` (`TRUNCATE` da tabela nova)
- Modify: `backend/tests/test_migrations.py:11-13` e `:45-51`

**Interfaces:**
- Produces: `settings.MS_TENANT_ID`, `settings.MS_CLIENT_ID`, `settings.MS_CLIENT_SECRET`, `settings.MS_REDIRECT_URI`, `settings.FRONTEND_URL` (todos `str`, padrão `""`), e `settings.sso_ativo -> bool`.
- Produces: `app.core.sso_tickets.emitir(db: Session, access_token: str) -> str` e `app.core.sso_tickets.resgatar(db: Session, ticket: str) -> Optional[str]`.
- Produces: `app.models.sso_ticket.SsoTicket` (tabela `auth.sso_tickets`: `ticket text PK`, `access_token text NOT NULL`, `expira_em timestamptz NOT NULL`).

- [ ] **Step 1: Subir o Postgres de teste**

```bash
cd ~/github/DataCore/backend
docker compose -f docker-compose.test.yml up -d --wait
.venv/bin/python -m pytest -q -p no:cacheprovider
```

Esperado: tudo verde, que é a baseline. Anote o número de testes.

- [ ] **Step 2: Zerar o SSO no `conftest.py` e limpar a tabela nova entre testes**

Em `backend/tests/conftest.py`, logo depois de `os.environ["AUTH_APP_DB_USER"] = "app_teste"`:

```python
# O backend/.env da máquina tem o SSO real configurado, e o Settings lê o .env.
# Variável de ambiente vence o .env: aqui o SSO nasce DESLIGADO em todo teste, e
# quem precisa dele ligado usa a fixture `sso` (valores falsos).
for _var in ("MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET", "MS_REDIRECT_URI", "FRONTEND_URL"):
    os.environ[_var] = ""
```

Na fixture `banco_limpo`, trocar o `TRUNCATE` por:

```python
        conn.execute(text(
            "TRUNCATE auth.sso_tickets, auth.usuarios, auth.papeis RESTART IDENTITY CASCADE"
        ))
```

- [ ] **Step 3: Escrever os testes da migration (vão falhar)**

Em `backend/tests/test_migrations.py`, trocar `test_upgrade_cria_as_tabelas_do_auth` por:

```python
def test_upgrade_cria_as_tabelas_do_auth(engine):
    tabelas = set(inspect(engine).get_table_names(schema="auth"))
    assert tabelas == {"papeis", "usuarios", "sso_tickets", "alembic_version"}


def test_colunas_de_sso_tickets(engine):
    colunas = {c["name"]: c for c in inspect(engine).get_columns("sso_tickets", schema="auth")}
    assert set(colunas) == {"ticket", "access_token", "expira_em"}
    assert not colunas["access_token"]["nullable"]
    assert not colunas["expira_em"]["nullable"]
    assert inspect(engine).get_pk_constraint("sso_tickets", schema="auth")["constrained_columns"] == ["ticket"]
```

E em `test_usuario_da_app_recebe_so_os_grants_das_tabelas`, antes do último `assert`:

```python
        assert pode("SELECT has_table_privilege('app_teste', 'auth.sso_tickets', 'SELECT, INSERT, DELETE')")
        assert not pode("SELECT has_table_privilege('app_teste', 'auth.sso_tickets', 'UPDATE')")
```

Em `test_downgrade_e_upgrade_de_novo`, trocar a última linha por:

```python
    assert {"papeis", "usuarios", "sso_tickets"} <= set(inspect(engine).get_table_names(schema="auth"))
```

- [ ] **Step 4: Escrever os testes do ticket (vão falhar)**

Criar `backend/tests/test_sso_tickets.py`:

```python
import threading

from sqlalchemy import text

from app.core import sso_tickets
from app.models.database import SessionLocal


def _sessao():
    return SessionLocal()


def test_emitir_e_resgatar_devolve_o_token():
    db = _sessao()
    try:
        ticket = sso_tickets.emitir(db, "jwt-da-maria")
        assert len(ticket) >= 40
        assert sso_tickets.resgatar(db, ticket) == "jwt-da-maria"
    finally:
        db.close()


def test_ticket_e_de_uso_unico():
    db = _sessao()
    try:
        ticket = sso_tickets.emitir(db, "jwt")
        assert sso_tickets.resgatar(db, ticket) == "jwt"
        assert sso_tickets.resgatar(db, ticket) is None
    finally:
        db.close()


def test_tickets_sao_diferentes_a_cada_emissao():
    db = _sessao()
    try:
        assert sso_tickets.emitir(db, "a") != sso_tickets.emitir(db, "a")
    finally:
        db.close()


def test_ticket_vencido_nao_vale_e_e_apagado(engine):
    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO auth.sso_tickets (ticket, access_token, expira_em)"
            " VALUES ('velho', 'jwt', now() - interval '1 second')"
        ))
    db = _sessao()
    try:
        assert sso_tickets.resgatar(db, "velho") is None
    finally:
        db.close()
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM auth.sso_tickets")).scalar_one() == 0


def test_resgate_limpa_os_vencidos_de_outros(engine):
    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO auth.sso_tickets (ticket, access_token, expira_em)"
            " VALUES ('esquecido', 'jwt', now() - interval '1 minute')"
        ))
    db = _sessao()
    try:
        sso_tickets.resgatar(db, "qualquer")
    finally:
        db.close()
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM auth.sso_tickets")).scalar_one() == 0


def test_ticket_inexistente_vazio_ou_com_nul_devolve_none():
    db = _sessao()
    try:
        assert sso_tickets.resgatar(db, "nao-existe") is None
        assert sso_tickets.resgatar(db, "") is None
        # NUL quebra o bind do psycopg2 (ValueError -> 500); tem que ser só "inválido".
        assert sso_tickets.resgatar(db, "ab\x00cd") is None
    finally:
        db.close()


def test_duas_trocas_simultaneas_so_uma_leva():
    db = _sessao()
    try:
        ticket = sso_tickets.emitir(db, "jwt-unico")
    finally:
        db.close()

    largada = threading.Barrier(2)
    resultados = []

    def trocar():
        sessao = _sessao()
        try:
            largada.wait()
            resultados.append(sso_tickets.resgatar(sessao, ticket))
        finally:
            sessao.close()

    fios = [threading.Thread(target=trocar) for _ in range(2)]
    for f in fios:
        f.start()
    for f in fios:
        f.join()
    assert len(resultados) == 2
    assert resultados.count("jwt-unico") == 1
    assert resultados.count(None) == 1
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `.venv/bin/python -m pytest -q -p no:cacheprovider tests/test_migrations.py tests/test_sso_tickets.py`
Esperado: FAIL. Os de migration falham porque a tabela `sso_tickets` não existe, e o de ticket falha com `ImportError` de `app.core.sso_tickets`.

- [ ] **Step 6: Configuração**

Em `backend/app/core/config.py`, logo depois de `AUTH_OBRIGATORIA: bool = False`:

```python

    # Login com Microsoft (Entra ID) — ver spec 2026-09-24. Os valores vêm do
    # registro de aplicativo "DataCore" no Entra. Qualquer um vazio = SSO
    # desligado: a API sobe normal e o front esconde o botão.
    MS_TENANT_ID: str = ""
    MS_CLIENT_ID: str = ""
    MS_CLIENT_SECRET: str = ""
    MS_REDIRECT_URI: str = ""
    FRONTEND_URL: str = ""

    @property
    def sso_ativo(self) -> bool:
        return all((
            self.MS_TENANT_ID, self.MS_CLIENT_ID, self.MS_CLIENT_SECRET,
            self.MS_REDIRECT_URI, self.FRONTEND_URL,
        ))
```

- [ ] **Step 7: Modelo**

Criar `backend/app/models/sso_ticket.py`:

```python
from sqlalchemy import Column, DateTime, Text

from app.models.database import Base


class SsoTicket(Base):
    """Ticket de uso único do login com Microsoft (ver app/core/sso_tickets.py).

    O código lê e escreve por SQL direto; o modelo existe para o `alembic check`
    enxergar a tabela e não acusá-la como sobra.
    """

    __tablename__ = "sso_tickets"
    __table_args__ = {"schema": "auth"}

    ticket = Column(Text, primary_key=True)
    access_token = Column(Text, nullable=False)
    expira_em = Column(DateTime(timezone=True), nullable=False)
```

Em `backend/alembic/env.py`, trocar a linha de import dos modelos por:

```python
from app.models import papel, sso_ticket, usuario  # noqa: E402,F401  (registram as tabelas)
```

- [ ] **Step 8: Migration**

Criar `backend/alembic/versions/0002_sso_tickets.py`:

```python
"""Tickets de uso único do login com Microsoft.

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-24
"""
import os
import re

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def _usuario_app() -> str:
    """Mesmo contrato da 0001 (migration é retrato congelado: não importa da outra)."""
    nome = (os.environ.get("AUTH_APP_DB_USER") or "").strip()
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_-]*", nome):
        raise RuntimeError(
            "Defina AUTH_APP_DB_USER com o usuário do Postgres que o tinyapi usa "
            "(o do DATABASE_URL de produção). Valor atual inválido ou ausente."
        )
    return nome


def upgrade() -> None:
    usuario_app = f'"{_usuario_app()}"'
    op.create_table(
        "sso_tickets",
        sa.Column("ticket", sa.Text, primary_key=True),
        sa.Column("access_token", sa.Text, nullable=False),
        sa.Column("expira_em", sa.DateTime(timezone=True), nullable=False),
        schema="auth",
    )
    # Só o que o app usa: grava ao emitir, lê e apaga ao resgatar. Nada de UPDATE.
    op.execute(f"GRANT SELECT, INSERT, DELETE ON auth.sso_tickets TO {usuario_app}")


def downgrade() -> None:
    op.drop_table("sso_tickets", schema="auth")
```

- [ ] **Step 9: `sso_tickets`**

Criar `backend/app/core/sso_tickets.py`:

```python
"""Ticket de uso único entre o callback da Microsoft e o front.

O callback não pode mandar o JWT na URL (histórico, log do proxy, Referer): grava
o token sob um ticket opaco de 60 s e manda só o ticket. O front troca por POST.

Mora no Postgres, e não num dict em memória como no GestorHS: em memória, com dois
workers ou duas réplicas, a troca cai num processo que não emitiu o ticket e o
login falha em metade das tentativas, sem nada no log.
"""
import secrets
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

VALIDADE_SEGUNDOS = 60


def emitir(db: Session, access_token: str) -> str:
    ticket = secrets.token_urlsafe(32)
    db.execute(
        text(
            "INSERT INTO auth.sso_tickets (ticket, access_token, expira_em)"
            " VALUES (:t, :a, now() + make_interval(secs => :s))"
        ),
        {"t": ticket, "a": access_token, "s": VALIDADE_SEGUNDOS},
    )
    db.commit()
    return ticket


def resgatar(db: Session, ticket: str) -> Optional[str]:
    """Devolve o token e queima o ticket; None se não existe, venceu ou já foi usado.

    O DELETE ... RETURNING é atômico: duas trocas simultâneas do mesmo ticket, a
    segunda espera o lock da linha, acha a linha apagada e volta vazia.
    """
    if not ticket or "\x00" in ticket:
        return None
    db.execute(text("DELETE FROM auth.sso_tickets WHERE expira_em <= now()"))
    token = db.execute(
        text(
            "DELETE FROM auth.sso_tickets WHERE ticket = :t AND expira_em > now()"
            " RETURNING access_token"
        ),
        {"t": ticket},
    ).scalar_one_or_none()
    db.commit()
    return token
```

- [ ] **Step 10: Rodar e ver passar**

Run: `.venv/bin/python -m pytest -q -p no:cacheprovider`
Esperado: PASS em tudo, contando a suíte inteira (baseline + os novos). O `test_modelos_batem_com_a_migration_e_ignoram_o_tiny` também passa, e é ele que prova que o modelo bate com a migration.

- [ ] **Step 11: Commit**

```bash
cd ~/github/DataCore && scripts/varrer.sh
git add backend/alembic/versions/0002_sso_tickets.py backend/alembic/env.py backend/app/models/sso_ticket.py backend/app/core/sso_tickets.py backend/app/core/config.py backend/tests/conftest.py backend/tests/test_migrations.py backend/tests/test_sso_tickets.py
git commit -m "feat(auth): tabela de tickets do login com Microsoft e configuração do SSO"
```

---

### Task 2: Cliente da Microsoft (`app/core/microsoft.py`)

**Files:**
- Create: `backend/app/core/microsoft.py`
- Create: `backend/tests/test_microsoft.py`

**Interfaces:**
- Consumes: `settings.MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_REDIRECT_URI` (Task 1).
- Produces: `class ErroMicrosoft(Exception)`; `url_de_autorizacao(state: str) -> str`; `trocar_code_por_token(code: str) -> str`; `email_do_usuario(access_token: str) -> Optional[str]`. A Task 3 chama esses nomes **pelo módulo** (`microsoft.trocar_code_por_token(...)`), para o `monkeypatch` funcionar.

- [ ] **Step 1: Escrever os testes (vão falhar)**

Criar `backend/tests/test_microsoft.py`:

```python
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import pytest
import requests

from app.core import microsoft
from app.core.config import settings


@pytest.fixture(autouse=True)
def config(monkeypatch):
    valores = {
        "MS_TENANT_ID": "tenant-teste",
        "MS_CLIENT_ID": "cliente-teste",
        "MS_CLIENT_SECRET": "segredo-teste",
        "MS_REDIRECT_URI": "https://api.teste/auth/microsoft/callback",
    }
    for chave, valor in valores.items():
        monkeypatch.setattr(settings, chave, valor)


def _resposta(status=200, corpo=None, json_quebrado=False):
    def _json():
        if json_quebrado:
            raise ValueError("não é JSON")
        return corpo or {}
    return SimpleNamespace(status_code=status, ok=200 <= status < 300, json=_json)


def test_url_de_autorizacao_leva_os_parametros_certos():
    url = urlparse(microsoft.url_de_autorizacao("estado-123"))
    assert url.scheme == "https"
    assert url.netloc == "login.microsoftonline.com"
    assert url.path == "/tenant-teste/oauth2/v2.0/authorize"
    q = {k: v[0] for k, v in parse_qs(url.query).items()}
    assert q == {
        "client_id": "cliente-teste",
        "response_type": "code",
        "redirect_uri": "https://api.teste/auth/microsoft/callback",
        "response_mode": "query",
        "scope": "openid email profile User.Read",
        "state": "estado-123",
    }


def test_trocar_code_manda_o_formulario_e_devolve_o_token(monkeypatch):
    chamadas = []

    def post(url, data, timeout):
        chamadas.append((url, data, timeout))
        return _resposta(corpo={"access_token": "tok-ms"})

    monkeypatch.setattr(microsoft.requests, "post", post)
    assert microsoft.trocar_code_por_token("code-1") == "tok-ms"
    url, data, timeout = chamadas[0]
    assert url == "https://login.microsoftonline.com/tenant-teste/oauth2/v2.0/token"
    assert data == {
        "grant_type": "authorization_code",
        "client_id": "cliente-teste",
        "client_secret": "segredo-teste",
        "code": "code-1",
        "redirect_uri": "https://api.teste/auth/microsoft/callback",
        "scope": "openid email profile User.Read",
    }
    assert timeout == 10


@pytest.mark.parametrize(
    "resposta",
    [_resposta(status=400, corpo={"error": "invalid_grant"}), _resposta(corpo={}), _resposta(json_quebrado=True)],
    ids=["http-400", "sem-access-token", "json-quebrado"],
)
def test_trocar_code_com_resposta_ruim_levanta_erro(monkeypatch, resposta):
    monkeypatch.setattr(microsoft.requests, "post", lambda *a, **k: resposta)
    with pytest.raises(microsoft.ErroMicrosoft):
        microsoft.trocar_code_por_token("code-1")


def test_trocar_code_com_falha_de_rede_levanta_erro(monkeypatch):
    def post(*a, **k):
        raise requests.ConnectionError("sem rede")

    monkeypatch.setattr(microsoft.requests, "post", post)
    with pytest.raises(microsoft.ErroMicrosoft):
        microsoft.trocar_code_por_token("code-1")


def test_email_usa_mail(monkeypatch):
    chamadas = []

    def get(url, headers, params, timeout):
        chamadas.append((url, headers, params))
        return _resposta(corpo={"mail": "Maria@HealthSafetyTech.com", "userPrincipalName": "outra@x"})

    monkeypatch.setattr(microsoft.requests, "get", get)
    assert microsoft.email_do_usuario("tok-ms") == "Maria@HealthSafetyTech.com"
    url, headers, params = chamadas[0]
    assert url == "https://graph.microsoft.com/v1.0/me"
    assert headers == {"Authorization": "Bearer tok-ms"}
    assert params == {"$select": "mail,userPrincipalName"}


def test_email_sem_mail_cai_no_user_principal_name(monkeypatch):
    monkeypatch.setattr(
        microsoft.requests, "get",
        lambda *a, **k: _resposta(corpo={"mail": None, "userPrincipalName": "ti03@healthsafetytech.com"}),
    )
    assert microsoft.email_do_usuario("tok-ms") == "ti03@healthsafetytech.com"


def test_email_sem_nenhum_devolve_none(monkeypatch):
    monkeypatch.setattr(microsoft.requests, "get", lambda *a, **k: _resposta(corpo={}))
    assert microsoft.email_do_usuario("tok-ms") is None


def test_email_com_http_401_levanta_erro(monkeypatch):
    monkeypatch.setattr(microsoft.requests, "get", lambda *a, **k: _resposta(status=401))
    with pytest.raises(microsoft.ErroMicrosoft):
        microsoft.email_do_usuario("tok-ms")
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `.venv/bin/python -m pytest -q -p no:cacheprovider tests/test_microsoft.py`
Esperado: FAIL com `ImportError: cannot import name 'microsoft'`.

- [ ] **Step 3: Implementar**

Criar `backend/app/core/microsoft.py`:

```python
"""Conversa com a Microsoft no login por Entra ID: autorização, token e e-mail.

O token da Microsoft só serve para ler o e-mail no Graph e é descartado — nada
dele é guardado. Mensagens de ErroMicrosoft vão para o log: nunca pôr ali o
`code`, o token ou o segredo.
"""
from typing import Optional
from urllib.parse import urlencode

import requests

from app.core.config import settings

ESCOPOS = "openid email profile User.Read"
GRAPH_ME = "https://graph.microsoft.com/v1.0/me"
TIMEOUT = 10


class ErroMicrosoft(Exception):
    """Falha de rede ou resposta inesperada da Microsoft."""


def _base() -> str:
    return f"https://login.microsoftonline.com/{settings.MS_TENANT_ID}/oauth2/v2.0"


def _corpo(resposta, etapa: str) -> dict:
    if not resposta.ok:
        raise ErroMicrosoft(f"{etapa}: HTTP {resposta.status_code}")
    try:
        corpo = resposta.json()
    except ValueError as erro:
        raise ErroMicrosoft(f"{etapa}: resposta não é JSON") from erro
    if not isinstance(corpo, dict):
        raise ErroMicrosoft(f"{etapa}: resposta inesperada")
    return corpo


def url_de_autorizacao(state: str) -> str:
    parametros = {
        "client_id": settings.MS_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": settings.MS_REDIRECT_URI,
        "response_mode": "query",
        "scope": ESCOPOS,
        "state": state,
    }
    return f"{_base()}/authorize?{urlencode(parametros)}"


def trocar_code_por_token(code: str) -> str:
    try:
        resposta = requests.post(
            f"{_base()}/token",
            data={
                "grant_type": "authorization_code",
                "client_id": settings.MS_CLIENT_ID,
                "client_secret": settings.MS_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.MS_REDIRECT_URI,
                "scope": ESCOPOS,
            },
            timeout=TIMEOUT,
        )
    except requests.RequestException as erro:
        raise ErroMicrosoft(f"troca do code: {type(erro).__name__}") from erro
    token = _corpo(resposta, "troca do code").get("access_token")
    if not isinstance(token, str) or not token:
        raise ErroMicrosoft("troca do code: sem access_token")
    return token


def email_do_usuario(access_token: str) -> Optional[str]:
    """E-mail da conta, cru (quem chama normaliza). `mail` vem nulo em conta sem
    caixa de correio; aí vale o `userPrincipalName`, que no tenant da H&S é o e-mail."""
    try:
        resposta = requests.get(
            GRAPH_ME,
            headers={"Authorization": f"Bearer {access_token}"},
            params={"$select": "mail,userPrincipalName"},
            timeout=TIMEOUT,
        )
    except requests.RequestException as erro:
        raise ErroMicrosoft(f"Graph /me: {type(erro).__name__}") from erro
    corpo = _corpo(resposta, "Graph /me")
    return corpo.get("mail") or corpo.get("userPrincipalName") or None
```

- [ ] **Step 4: Rodar e ver passar**

Run: `.venv/bin/python -m pytest -q -p no:cacheprovider tests/test_microsoft.py`
Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/github/DataCore && scripts/varrer.sh
git add backend/app/core/microsoft.py backend/tests/test_microsoft.py
git commit -m "feat(auth): cliente da Microsoft para o login por Entra ID"
```

---

### Task 3: Rotas do SSO, `.env.example` e README

**Files:**
- Modify: `backend/app/api/endpoints/auth.py` (imports e quatro rotas no fim)
- Modify: `backend/app/schemas/auth.py` (depois de `TokenSaida`)
- Modify: `backend/.env.example` (bloco novo depois de `AUTH_OBRIGATORIA=false`)
- Modify: `backend/README.md` (subseção nova na parte de autenticação)
- Create: `backend/tests/test_sso.py`

**Interfaces:**
- Consumes: `settings.sso_ativo` e `settings.FRONTEND_URL` (Task 1); `sso_tickets.emitir/resgatar` (Task 1); `microsoft.url_de_autorizacao/trocar_code_por_token/email_do_usuario/ErroMicrosoft` (Task 2); `criar_token`, `usuario_do_token` e `logger` de `app.core.security`; `_normalizar_email` de `app.schemas.auth`.
- Produces (HTTP):
  - `GET /auth/sso/status` → `{"ativo": bool}`
  - `GET /auth/microsoft` → 302
  - `GET /auth/microsoft/callback` → 302 para `{FRONTEND_URL}/auth/callback?ticket=…` ou `{FRONTEND_URL}/login?erro_sso=<código>`
  - `POST /auth/sso/exchange {"ticket": str}` → `TokenSaida`, ou `400 {"detail": "Link de acesso inválido ou expirado."}`

- [ ] **Step 1: Escrever os testes (vão falhar)**

Criar `backend/tests/test_sso.py`:

```python
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `.venv/bin/python -m pytest -q -p no:cacheprovider tests/test_sso.py`
Esperado: FAIL, com 404 nas rotas que ainda não existem.

- [ ] **Step 3: Schemas**

Em `backend/app/schemas/auth.py`, logo depois da classe `TokenSaida`:

```python


class TicketEntrada(BaseModel):
    # O ticket tem 43 caracteres; o teto barra lixo grande antes do banco.
    ticket: str = Field(max_length=200)


class SsoStatus(BaseModel):
    ativo: bool
```

- [ ] **Step 4: Rotas**

Em `backend/app/api/endpoints/auth.py`, trocar o bloco de imports do topo por:

```python
import secrets
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import microsoft, sso_tickets
from app.core.config import settings
from app.core.security import (
    PAPEL_ADMIN,
    criar_token,
    exigir_admin,
    gerar_hash_senha,
    logger,
    usuario_atual,
    usuario_do_token,
    verificar_senha,
)
from app.models.database import SessionLocal
from app.models.papel import Papel
from app.models.usuario import Usuario
from app.schemas.auth import (
    LoginEntrada,
    PapelOut,
    SsoStatus,
    TicketEntrada,
    TokenSaida,
    UsuarioAtualizar,
    UsuarioCriar,
    UsuarioOut,
    _normalizar_email,
)
```

E acrescentar no fim do arquivo:

```python


# ---------------------------------------------------------------- login com Microsoft
#
# Fluxo e decisões: docs/superpowers/specs/2026-09-24-login-microsoft-design.md.
# Quem não tem usuário com o e-mail da conta Microsoft não entra (não há cadastro
# automático). Excluir o usuário aqui continua sendo o que corta o acesso.

COOKIE_STATE = "sso_state"
CAMINHO_COOKIE = "/auth/microsoft"  # cobre /auth/microsoft/callback
TICKET_INVALIDO = "Link de acesso inválido ou expirado."


def _para_o_front(caminho: str) -> RedirectResponse:
    if not settings.FRONTEND_URL:
        # Sem FRONTEND_URL não há para onde mandar a pessoa.
        raise HTTPException(status_code=404, detail="Login com Microsoft não configurado.")
    return RedirectResponse(settings.FRONTEND_URL.rstrip("/") + caminho, status_code=302)


def _erro_sso(codigo: str) -> RedirectResponse:
    return _para_o_front(f"/login?erro_sso={codigo}")


# GET /auth/sso/status
@router.get("/sso/status", response_model=SsoStatus)
def sso_status():
    return SsoStatus(ativo=settings.sso_ativo)


# GET /auth/microsoft — o botão do front navega para cá
@router.get("/microsoft")
def iniciar_login_microsoft():
    if not settings.sso_ativo:
        return _erro_sso("sso_desligado")
    state = secrets.token_urlsafe(32)
    resposta = RedirectResponse(microsoft.url_de_autorizacao(state), status_code=302)
    # O state no cookie impede login CSRF: sem ele, alguém com conta mandaria um
    # link que faz outra pessoa entrar na conta DELE.
    resposta.set_cookie(
        COOKIE_STATE, state, max_age=600, path=CAMINHO_COOKIE,
        secure=True, httponly=True, samesite="lax",
    )
    return resposta


def _resultado_do_callback(
    request: Request, code: Optional[str], state: Optional[str], error: Optional[str], db: Session
) -> RedirectResponse:
    if not settings.sso_ativo:
        return _erro_sso("sso_desligado")

    guardado = request.cookies.get(COOKIE_STATE) or ""
    # compare_digest sobre bytes: sobre str ele levanta TypeError com acento, e o
    # state vem da query string — seria um 500 esperando acontecer.
    if not state or not guardado or not secrets.compare_digest(state.encode(), guardado.encode()):
        return _erro_sso("state_invalido")

    if error:
        return _erro_sso("cancelado" if error == "access_denied" else "falha_microsoft")
    if not code:
        return _erro_sso("falha_microsoft")

    try:
        email_cru = microsoft.email_do_usuario(microsoft.trocar_code_por_token(code))
    except microsoft.ErroMicrosoft as erro:
        logger.warning("Login com Microsoft falhou: %s", erro)
        return _erro_sso("falha_microsoft")

    try:
        email = _normalizar_email(email_cru)
    except ValueError:
        email = None
    usuario = db.query(Usuario).filter(Usuario.email == email).first() if email else None
    if usuario is None:
        logger.info("Login com Microsoft sem usuário no DataCore: %r", email_cru)
        return _erro_sso("usuario_nao_encontrado")

    ticket = sso_tickets.emitir(db, criar_token(usuario))
    return _para_o_front(f"/auth/callback?ticket={ticket}")


# GET /auth/microsoft/callback — a Microsoft devolve a pessoa para cá
@router.get("/microsoft/callback")
def callback_microsoft(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    resposta = _resultado_do_callback(request, code, state, error, db)
    resposta.delete_cookie(
        COOKIE_STATE, path=CAMINHO_COOKIE, secure=True, httponly=True, samesite="lax"
    )
    return resposta


# POST /auth/sso/exchange — o front troca o ticket pelo token
@router.post("/sso/exchange", response_model=TokenSaida)
def trocar_ticket(dados: TicketEntrada, db: Session = Depends(get_db)):
    token = sso_tickets.resgatar(db, dados.ticket)
    # usuario_do_token relê do banco: se o usuário foi excluído nos 60 s do
    # ticket, a troca falha em vez de entregar um token de quem não existe mais.
    usuario = usuario_do_token(token) if token else None
    if usuario is None:
        raise HTTPException(status_code=400, detail=TICKET_INVALIDO)
    return TokenSaida(
        access_token=token,
        token_type="bearer",
        role=usuario.papel.nome,
        username=usuario.username,
        user_id=usuario.id,
    )
```

- [ ] **Step 5: Rodar e ver passar**

Run: `.venv/bin/python -m pytest -q -p no:cacheprovider`
Esperado: PASS na suíte inteira.

Se `test_callback_feliz_manda_ticket_ao_front` falhar só na asserção do cookie apagado, imprima `r.headers["set-cookie"]` e ajuste a asserção ao formato que o Starlette gera (`sso_state=""; expires=...; Max-Age=0`). O que importa é o `Max-Age=0` para `sso_state`. Não mude o código por causa disso.

- [ ] **Step 6: `.env.example`**

Em `backend/.env.example`, logo depois de `AUTH_OBRIGATORIA=false`:

```
# ===== LOGIN COM MICROSOFT (Entra ID) =====
# Valores do registro de aplicativo "DataCore" no portal do Entra (single tenant).
# Com qualquer um vazio o SSO fica desligado e só o login por senha funciona.
# Local: MS_REDIRECT_URI=http://localhost:8000/auth/microsoft/callback
#        FRONTEND_URL=http://localhost:5174
MS_TENANT_ID=
MS_CLIENT_ID=
MS_CLIENT_SECRET=
MS_REDIRECT_URI=https://tinyapi.healthsafetytech.com/auth/microsoft/callback
FRONTEND_URL=https://datacorehs.healthsafetytech.com
```

- [ ] **Step 7: README**

Em `backend/README.md`, achar a seção de autenticação (`grep -n "AUTH_OBRIGATORIA" backend/README.md`) e, no fim dela, acrescentar:

```markdown
### Login com Microsoft (Entra ID)

Botão "Entrar com Microsoft" na tela de login, somado ao login por senha. Entra
quem tem usuário com o **e-mail** da conta Microsoft cadastrado; não há cadastro
automático. Spec: `docs/superpowers/specs/2026-09-24-login-microsoft-design.md`.

- Configuração: `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`,
  `MS_REDIRECT_URI`, `FRONTEND_URL` (ver `.env.example`). Qualquer uma vazia
  desliga o SSO, e o front esconde o botão.
- O client secret do Entra **vence**. Quando vencer, o botão passa a devolver
  "Não foi possível entrar com a Microsoft" e o log mostra `troca do code: HTTP 401`.
  Gerar outro no portal e trocar no EasyPanel.
- O ticket entre o callback e o front mora em `auth.sso_tickets` (60 s, uso
  único), e não em memória: dá para subir workers e réplicas sem quebrar o login.
- Desativar a conta no Entra só barra logins novos: o token já emitido vale até
  vencer (8 h). Para cortar na hora, excluir o usuário aqui.
```

- [ ] **Step 8: Commit**

```bash
cd ~/github/DataCore && scripts/varrer.sh
git add backend/app/api/endpoints/auth.py backend/app/schemas/auth.py backend/.env.example backend/README.md backend/tests/test_sso.py
git commit -m "feat(auth): rotas do login com Microsoft (Entra ID)"
```

Se a varredura acusar alguma linha nova (ex.: uma palavra comum que também está na lista de valores), confira que é falso positivo e acrescente a exceção em `scripts/varrer-excecoes.txt`, no formato `caminho|trecho`. O trecho não pode conter o valor sensível. Inclua o arquivo de exceções no mesmo commit.

---

### Task 4: Frontend — serviço e `entrarComToken` no `AuthContext`

**Files:**
- Modify: `frontend/src/services/api.ts` (depois de `const authApi = criarHttp(baseURL);`)
- Modify: `frontend/src/services/api.test.ts` (novos `describe` no fim)
- Modify: `frontend/src/context/AuthContext.tsx`
- Modify: `frontend/src/context/AuthContext.test.tsx` (novo `describe` no fim)
- Modify: `frontend/src/pages/Login.test.tsx:11-18` (acrescentar `entrarComToken: vi.fn()` ao `value` padrão)

**Interfaces:**
- Produces: `URL_LOGIN_MICROSOFT: string`, `irParaLoginMicrosoft(): void` (navega o navegador para essa URL), `ssoAtivo(): Promise<boolean>` (nunca rejeita) e `trocarTicket(ticket: string): Promise<string>` (rejeita em erro HTTP), exportados de `services/api.ts`.
- Produces: `entrarComToken(accessToken: string): Promise<void>` no `AuthContext`. Grava a sessão ou, em falha, limpa tudo e **rejeita**.

- [ ] **Step 1: Testes do serviço (vão falhar)**

No fim de `frontend/src/services/api.test.ts` (acrescentar `ssoAtivo`, `trocarTicket` e `URL_LOGIN_MICROSOFT` ao import de `./api`; `InternalAxiosRequestConfig` já é importado no topo do arquivo):

```ts
describe("login com Microsoft", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("a URL do botao e a /microsoft da base da autenticacao", () => {
    expect(URL_LOGIN_MICROSOFT).toBe(`${authApi.defaults.baseURL}/microsoft`);
  });

  it("ssoAtivo le GET /sso/status", async () => {
    const capturadas: string[] = [];
    authApi.defaults.adapter = async (config) => {
      capturadas.push(`${config.method} ${config.url}`);
      return { data: { ativo: true }, status: 200, statusText: "OK", headers: {}, config };
    };
    await expect(ssoAtivo()).resolves.toBe(true);
    expect(capturadas).toEqual(["get /sso/status"]);
  });

  it("ssoAtivo responde false quando o backend falha, sem rejeitar", async () => {
    authApi.defaults.adapter = async () => {
      throw new Error("rede caiu");
    };
    await expect(ssoAtivo()).resolves.toBe(false);
  });

  it("ssoAtivo so aceita true de verdade", async () => {
    authApi.defaults.adapter = async (config) => ({
      data: { ativo: "sim" }, status: 200, statusText: "OK", headers: {}, config,
    });
    await expect(ssoAtivo()).resolves.toBe(false);
  });

  it("trocarTicket manda POST /sso/exchange e devolve o access_token", async () => {
    const capturadas: InternalAxiosRequestConfig[] = [];
    authApi.defaults.adapter = async (config) => {
      capturadas.push(config);
      return { data: { access_token: "tok-sso" }, status: 200, statusText: "OK", headers: {}, config };
    };
    await expect(trocarTicket("tic-1")).resolves.toBe("tok-sso");
    expect(capturadas[0].method).toBe("post");
    expect(capturadas[0].url).toBe("/sso/exchange");
    expect(JSON.parse(String(capturadas[0].data))).toEqual({ ticket: "tic-1" });
  });
});
```

- [ ] **Step 2: Testes do `entrarComToken` (vão falhar)**

No fim de `frontend/src/context/AuthContext.test.tsx`. O arquivo já faz `vi.mock("../services/api", () => ({ default: { post: vi.fn(), get: vi.fn() } }))`; importe o mock com `import api from "../services/api";` no topo, se ainda não estiver importado.

```tsx
describe("entrarComToken", () => {
  function Entrar({ token, aoFalhar }: { token: string; aoFalhar?: (e: unknown) => void }) {
    const { entrarComToken, user } = useAuth();
    return (
      <>
        <button onClick={() => entrarComToken(token).catch((e) => aoFalhar?.(e))}>entrar</button>
        <p>{user ? `Logado como ${user.username} (${user.role})` : "Sem sessão"}</p>
      </>
    );
  }

  it("busca o /me com o token e grava a sessao inteira", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { id: 26, username: "rickelme", role: { id: 1, name: "admin" } },
    });
    render(
      <AuthProvider>
        <Entrar token="tok-sso" />
      </AuthProvider>,
    );

    await act(async () => {
      screen.getByText("entrar").click();
    });

    expect(api.get).toHaveBeenCalledWith("/me", {
      headers: { Authorization: "Bearer tok-sso" },
    });
    expect(screen.getByText("Logado como rickelme (admin)")).toBeInTheDocument();
    expect(localStorage.getItem("access_token")).toBe("tok-sso");
    expect(localStorage.getItem("id")).toBe("26");
    expect(localStorage.getItem("username")).toBe("rickelme");
    expect(localStorage.getItem("role")).toBe("admin");
  });

  it("se o /me falha, nao deixa sessao pela metade e rejeita", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new AxiosError("boom"));
    const aoFalhar = vi.fn();
    render(
      <AuthProvider>
        <Entrar token="tok-sso" aoFalhar={aoFalhar} />
      </AuthProvider>,
    );

    await act(async () => {
      screen.getByText("entrar").click();
    });

    expect(aoFalhar).toHaveBeenCalledOnce();
    expect(screen.getByText("Sem sessão")).toBeInTheDocument();
    expect(localStorage.getItem("access_token")).toBeNull();
  });

  it("o login com senha continua indo por POST /login e depois /me", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { access_token: "tok-senha" } });
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { id: 1, username: "erick", role: { id: 1, name: "admin" } },
    });
    function Logar() {
      const { login, user } = useAuth();
      return (
        <>
          <button onClick={() => login("erick", "x")}>logar</button>
          <p>{user ? `Logado como ${user.username}` : "Sem sessão"}</p>
        </>
      );
    }
    render(
      <AuthProvider>
        <Logar />
      </AuthProvider>,
    );

    await act(async () => {
      screen.getByText("logar").click();
    });

    expect(api.post).toHaveBeenCalledWith("/login", { username: "erick", password: "x" });
    expect(screen.getByText("Logado como erick")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run (de `frontend/`): `npx vitest run src/services/api.test.ts src/context/AuthContext.test.tsx`
Esperado: FAIL. Os exports não existem e `entrarComToken` não é função.

- [ ] **Step 4: Implementar o serviço**

Em `frontend/src/services/api.ts`, logo depois de `const authApi = criarHttp(baseURL);`:

```ts

// ── Login com Microsoft ──────────────────────────────────────────────────────
//
// O botao NAVEGA para esta URL (window.location), nao chama por axios: o backend
// responde com redirect para a Microsoft, em outro dominio.
export const URL_LOGIN_MICROSOFT = `${baseURL}/microsoft`;

/** Uma funcao, e nao `window.location` solto no componente: o teste simula esta. */
export function irParaLoginMicrosoft(): void {
  window.location.assign(URL_LOGIN_MICROSOFT);
}

/** Se o botao aparece. Qualquer falha vira `false`: o login por senha segue. */
export async function ssoAtivo(): Promise<boolean> {
  try {
    const res = await authApi.get<{ ativo: unknown }>("/sso/status");
    return res.data.ativo === true;
  } catch {
    return false;
  }
}

/** Troca o ticket de uso unico da volta da Microsoft pelo token de sessao. */
export async function trocarTicket(ticket: string): Promise<string> {
  const res = await authApi.post<{ access_token: string }>("/sso/exchange", {
    ticket,
  });
  return res.data.access_token;
}
```

- [ ] **Step 5: Implementar o `entrarComToken`**

Em `frontend/src/context/AuthContext.tsx`:

1. No tipo `AuthContextType`, depois de `login: ...`:

```ts
  /** Grava a sessao de um token ja emitido (login por senha ou por Microsoft). */
  entrarComToken: (accessToken: string) => Promise<void>;
```

2. Antes de `const login = async ...`, acrescentar:

```ts
  // Um caminho só para abrir sessão: o login por senha e a volta da Microsoft
  // passam por aqui. Falhou no meio (o /me caiu)? Limpa tudo e rejeita —
  // sessão pela metade é pior que sessão nenhuma.
  const entrarComToken = async (accessToken: string) => {
    try {
      localStorage.setItem("access_token", accessToken);
      setToken(accessToken);

      const me = await api.get("/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const { id, username: userNameFromAPI, role } = me.data;
      const roleName = typeof role === "string" ? role : role?.name || "";

      localStorage.setItem("id", id.toString());
      localStorage.setItem("username", userNameFromAPI);
      localStorage.setItem("role", roleName);

      setUser({ id, username: userNameFromAPI, role: roleName });
    } catch (erro) {
      limparSessao();
      setToken(null);
      setUser(null);
      throw erro;
    }
  };
```

3. Dentro do `try` do `login`, trocar tudo do `const { access_token } = res.data;` até `setUser(...)` por:

```ts
      const { access_token } = res.data;
      await entrarComToken(access_token);
```

O `catch` do `login` continua igual e trata o erro que o `entrarComToken` repassa.

4. No `value` do provider: `{ user, token, loading, login, entrarComToken, logout, error }`.

5. Em `frontend/src/pages/Login.test.tsx`, no objeto `value` de `renderLogin`, acrescentar `entrarComToken: vi.fn(),` depois de `login: vi.fn(),`.

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/services/api.test.ts src/context/AuthContext.test.tsx src/pages/Login.test.tsx`
Esperado: PASS.

- [ ] **Step 7: Commit**

```bash
cd ~/github/DataCore && scripts/varrer.sh
git add frontend/src/services/api.ts frontend/src/services/api.test.ts frontend/src/context/AuthContext.tsx frontend/src/context/AuthContext.test.tsx frontend/src/pages/Login.test.tsx
git commit -m "feat(front): serviço do login com Microsoft e entrarComToken no AuthContext"
```

---

### Task 5: Frontend — botão e mensagens na tela de login

**Files:**
- Create: `frontend/src/assets/microsoft.svg`
- Create: `frontend/src/auth/erroSso.ts`
- Create: `frontend/src/auth/erroSso.test.ts`
- Modify: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/pages/Login.test.tsx`

**Interfaces:**
- Consumes: `irParaLoginMicrosoft()` e `ssoAtivo()` (Task 4).
- Produces: `mensagemDeErroSso(codigo: string | null): string | null`, em `auth/erroSso.ts`.

- [ ] **Step 1: Testes da tradução de erro (vão falhar)**

Criar `frontend/src/auth/erroSso.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mensagemDeErroSso } from "./erroSso";

describe("mensagemDeErroSso", () => {
  it("sem codigo, sem mensagem", () => {
    expect(mensagemDeErroSso(null)).toBeNull();
    expect(mensagemDeErroSso("")).toBeNull();
  });

  it("conta sem acesso", () => {
    expect(mensagemDeErroSso("usuario_nao_encontrado")).toBe(
      "Sua conta Microsoft não tem acesso ao DataCore. Fale com o administrador.",
    );
  });

  it("cancelado", () => {
    expect(mensagemDeErroSso("cancelado")).toBe("Login com Microsoft cancelado.");
  });

  it.each(["state_invalido", "falha_microsoft", "sso_desligado", "codigo-que-nao-existe"])(
    "%s cai na mensagem generica",
    (codigo) => {
      expect(mensagemDeErroSso(codigo)).toBe(
        "Não foi possível entrar com a Microsoft. Tente de novo ou use usuário e senha.",
      );
    },
  );
});
```

- [ ] **Step 2: Testes da tela (vão falhar)**

Em `frontend/src/pages/Login.test.tsx`:

1. No topo, depois dos imports:

```tsx
// `default` também: o AuthContext importa a instância, mesmo sem usá-la aqui.
vi.mock("../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
  irParaLoginMicrosoft: vi.fn(),
  ssoAtivo: vi.fn(),
}));
import { irParaLoginMicrosoft, ssoAtivo } from "../services/api";
```

2. `renderLogin` ganha um segundo parâmetro com a rota inicial. Troque a assinatura e o `MemoryRouter`:

```tsx
function renderLogin(
  auth: Partial<React.ComponentProps<typeof AuthContext.Provider>["value"]>,
  rota = "/login",
) {
```

```tsx
    <MemoryRouter initialEntries={[rota]}>
```

3. Acrescentar um `beforeEach` no topo do arquivo (importar `beforeEach` do vitest), para os testes antigos terem SSO desligado:

```tsx
beforeEach(() => {
  vi.mocked(ssoAtivo).mockReset().mockResolvedValue(false);
  vi.mocked(irParaLoginMicrosoft).mockReset();
});
```

4. No fim do arquivo:

```tsx
describe("Entrar com Microsoft", () => {
  it("com SSO ativo, mostra o botao alem do formulario", async () => {
    vi.mocked(ssoAtivo).mockResolvedValue(true);
    renderLogin({});
    expect(
      await screen.findByRole("button", { name: /entrar com microsoft/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
  });

  it("com SSO desligado, nao ha botao", async () => {
    renderLogin({});
    await waitFor(() => expect(ssoAtivo).toHaveBeenCalled());
    expect(
      screen.queryByRole("button", { name: /entrar com microsoft/i }),
    ).not.toBeInTheDocument();
  });

  it("enquanto o status nao chega, o login por senha ja funciona", () => {
    vi.mocked(ssoAtivo).mockReturnValue(new Promise(() => {}));
    const login = vi.fn();
    renderLogin({ login });
    fireEvent.change(screen.getByLabelText(/usu[áa]rio/i), { target: { value: "erick" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
    expect(login).toHaveBeenCalledWith("erick", "x");
  });

  it("clicar leva ao login da Microsoft", async () => {
    vi.mocked(ssoAtivo).mockResolvedValue(true);
    renderLogin({});
    fireEvent.click(await screen.findByRole("button", { name: /entrar com microsoft/i }));
    expect(irParaLoginMicrosoft).toHaveBeenCalledOnce();
  });

  it("mostra o erro que veio da volta da Microsoft", () => {
    renderLogin({}, "/login?erro_sso=usuario_nao_encontrado");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Sua conta Microsoft não tem acesso ao DataCore. Fale com o administrador.",
    );
  });

  it("o erro do login por senha vence o da Microsoft", () => {
    renderLogin(
      { error: "Usuário ou senha incorretos." },
      "/login?erro_sso=cancelado",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Usuário ou senha incorretos.");
  });
});
```

Importe `fireEvent` e `waitFor` de `@testing-library/react`.

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/auth/erroSso.test.ts src/pages/Login.test.tsx`
Esperado: FAIL. O módulo `erroSso` não existe e o botão não aparece.

- [ ] **Step 4: `erroSso.ts`**

Criar `frontend/src/auth/erroSso.ts`:

```ts
/**
 * O que dizer quando a volta da Microsoft chega em `/login?erro_sso=<codigo>`.
 * Os codigos vem do backend (`auth.py`, login com Microsoft). Codigo
 * desconhecido cai na mensagem generica: a tela nunca fica calada.
 */
const MENSAGENS: Record<string, string> = {
  usuario_nao_encontrado:
    "Sua conta Microsoft não tem acesso ao DataCore. Fale com o administrador.",
  cancelado: "Login com Microsoft cancelado.",
};

const GENERICA =
  "Não foi possível entrar com a Microsoft. Tente de novo ou use usuário e senha.";

export function mensagemDeErroSso(codigo: string | null): string | null {
  if (!codigo) return null;
  return MENSAGENS[codigo] ?? GENERICA;
}
```

- [ ] **Step 5: Logo da Microsoft**

Criar `frontend/src/assets/microsoft.svg` (os quatro quadrados oficiais. Fica em `.svg`, e não inline no `.tsx`, porque o `guarda-cores` barra hexadecimal em `.tsx`):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" width="21" height="21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
```

- [ ] **Step 6: Tela de login**

Em `frontend/src/pages/Login.tsx`:

1. Imports: trocar `import { useNavigate } from "react-router-dom";` por `import { useNavigate, useSearchParams } from "react-router-dom";` e acrescentar:

```tsx
import logoMicrosoft from "../assets/microsoft.svg";
import { irParaLoginMicrosoft, ssoAtivo } from "../services/api";
import { mensagemDeErroSso } from "../auth/erroSso";
```

2. Depois de `const [password, setPassword] = useState("");`:

```tsx
  const [parametros, setParametros] = useSearchParams();
  // Lido uma vez: o parâmetro sai da URL logo abaixo, e a mensagem fica.
  const [erroSso] = useState(() => mensagemDeErroSso(parametros.get("erro_sso")));
  const [mostrarMicrosoft, setMostrarMicrosoft] = useState(false);

  useEffect(() => {
    if (parametros.has("erro_sso")) setParametros({}, { replace: true });
  }, [parametros, setParametros]);

  // O botão só aparece com o SSO configurado no backend. Enquanto a resposta
  // não chega (ou se ela falha), o login por senha já está de pé.
  useEffect(() => {
    let montado = true;
    ssoAtivo().then((ativo) => {
      if (montado) setMostrarMicrosoft(ativo);
    });
    return () => {
      montado = false;
    };
  }, []);

  const mensagem = error ?? erroSso;
```

3. No bloco do alerta, trocar `{error && (` por `{mensagem && (` e `{error}` por `{mensagem}`.

4. Depois do `</form>` (ainda dentro do cartão), acrescentar:

```tsx
        {mostrarMicrosoft && (
          <>
            <div
              className="my-5 flex items-center gap-3 text-xs text-white/60"
              aria-hidden="true"
            >
              <span className="h-px flex-1 bg-white/20" />
              ou
              <span className="h-px flex-1 bg-white/20" />
            </div>
            {/* Botão cru, como os campos acima: o painel é escuro nos dois
                temas (exceção documentada), e o `Button` do design system
                segue o tema. Navegação, não fetch: é redirect entre domínios. */}
            <button
              type="button"
              onClick={irParaLoginMicrosoft}
              disabled={loading}
              className="flex h-[48px] w-full items-center justify-center gap-3 rounded-lg border border-white/30 bg-white/10 font-medium text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
            >
              <img src={logoMicrosoft} alt="" className="h-5 w-5" />
              Entrar com Microsoft
            </button>
          </>
        )}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run src/auth/erroSso.test.ts src/pages/Login.test.tsx src/test/`
Esperado: PASS, com os guardas (`src/test/guarda-*.test.ts`) verdes também.

- [ ] **Step 8: Commit**

```bash
cd ~/github/DataCore && scripts/varrer.sh
git add frontend/src/assets/microsoft.svg frontend/src/auth/erroSso.ts frontend/src/auth/erroSso.test.ts frontend/src/pages/Login.tsx frontend/src/pages/Login.test.tsx
git commit -m "feat(front): botão Entrar com Microsoft e mensagens de erro do SSO no login"
```

A frase "Fale com o administrador." dispara a varredura: é o mesmo falso positivo de "Acesso restrito a". Para cada arquivo acusado (`erroSso.ts`, `erroSso.test.ts`, `Login.test.tsx`), acrescente em `scripts/varrer-excecoes.txt` uma linha `caminho|trecho`. O trecho deve pegar o começo da linha **sem** a palavra acusada (ex.: `frontend/src/auth/erroSso.ts|    "Sua conta Microsoft não tem acesso ao DataCore. Fale com o`). Rode de novo até dar OK e inclua o arquivo de exceções no commit.

---

### Task 6: Frontend — página `/auth/callback`

**Files:**
- Create: `frontend/src/pages/AuthCallback.tsx`
- Create: `frontend/src/pages/AuthCallback.test.tsx`
- Modify: `frontend/src/router.tsx` (lazy import + rota ao lado de `/login`)
- Modify: `frontend/src/App.tsx:15` (`noLayoutRoutes`)

**Interfaces:**
- Consumes: `trocarTicket(ticket)` (Task 4) e `entrarComToken(token)` do `useAuth()` (Task 4); `setDarkModeOnLogin` do `useTheme()`.
- Produces: rota pública `/auth/callback`, sem layout.

`/auth/callback` **não** entra em `auth/permissoes.ts`, como o `/login`: não passa por `RequirePermissao` nem aparece na barra lateral. O `permissoes.test.ts` exige que a matriz tenha exatamente as rotas protegidas mais `/login`.

- [ ] **Step 1: Testes (vão falhar)**

Criar `frontend/src/pages/AuthCallback.test.tsx`:

```tsx
import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AuthCallback from "./AuthCallback";
import { AuthContext } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";

vi.mock("../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
  trocarTicket: vi.fn(),
}));
import { trocarTicket } from "../services/api";

function montar(rota: string, entrarComToken = vi.fn().mockResolvedValue(undefined), estrito = false) {
  const value = {
    user: null,
    token: null,
    loading: false,
    login: vi.fn(),
    entrarComToken,
    logout: vi.fn(),
    error: null,
  };
  const arvore = (
    <MemoryRouter initialEntries={[rota]}>
      <ThemeProvider>
        <AuthContext.Provider value={value}>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/inicio" element={<p>pagina:/inicio</p>} />
            <Route path="/login" element={<p>pagina:/login</p>} />
          </Routes>
        </AuthContext.Provider>
      </ThemeProvider>
    </MemoryRouter>
  );
  render(estrito ? <StrictMode>{arvore}</StrictMode> : arvore);
  return { entrarComToken };
}

beforeEach(() => {
  vi.mocked(trocarTicket).mockReset();
});

describe("AuthCallback", () => {
  it("troca o ticket, abre a sessao e vai para o inicio", async () => {
    vi.mocked(trocarTicket).mockResolvedValue("tok-sso");
    const { entrarComToken } = montar("/auth/callback?ticket=tic-1");
    expect(await screen.findByText("pagina:/inicio")).toBeInTheDocument();
    expect(trocarTicket).toHaveBeenCalledWith("tic-1");
    expect(entrarComToken).toHaveBeenCalledWith("tok-sso");
  });

  it("em StrictMode troca o ticket uma vez so", async () => {
    vi.mocked(trocarTicket).mockResolvedValue("tok-sso");
    montar("/auth/callback?ticket=tic-1", undefined, true);
    await screen.findByText("pagina:/inicio");
    expect(trocarTicket).toHaveBeenCalledTimes(1);
  });

  it("ticket recusado mostra o erro e o caminho de volta", async () => {
    vi.mocked(trocarTicket).mockRejectedValue(new Error("400"));
    montar("/auth/callback?ticket=velho");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Link de acesso inválido ou expirado.",
    );
    expect(screen.getByRole("link", { name: /voltar para o login/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("sem ticket nem tenta trocar", async () => {
    montar("/auth/callback");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Link de acesso inválido ou expirado.",
    );
    expect(trocarTicket).not.toHaveBeenCalled();
  });

  it("se abrir a sessao falha, mostra o erro em vez de entrar", async () => {
    vi.mocked(trocarTicket).mockResolvedValue("tok-sso");
    montar("/auth/callback?ticket=tic-1", vi.fn().mockRejectedValue(new Error("me caiu")));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("pagina:/inicio")).not.toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/pages/AuthCallback.test.tsx`
Esperado: FAIL com `Failed to resolve import "./AuthCallback"`.

- [ ] **Step 3: Implementar**

Criar `frontend/src/pages/AuthCallback.tsx`:

```tsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../context/ThemeContext";
import { trocarTicket } from "../services/api";
import { Spinner } from "../design-system/ui/core/Spinner";

const TICKET_INVALIDO = "Link de acesso inválido ou expirado.";

/**
 * Volta do login com Microsoft: `/auth/callback?ticket=<opaco>`.
 *
 * O ticket é de uso único e vale 60 s. Ele sai da barra de endereço na hora
 * (não fica no histórico) e é trocado UMA vez: o StrictMode monta o componente
 * duas vezes em dev, e a segunda troca queimaria o ticket e mostraria erro a
 * quem acabou de entrar — daí o `useRef`.
 *
 * Mesmo painel escuro do login, pelo mesmo motivo: aparece antes do tema.
 */
const AuthCallback: React.FC = () => {
  const [parametros] = useSearchParams();
  const navigate = useNavigate();
  const { entrarComToken } = useAuth();
  const { setDarkModeOnLogin } = useTheme();
  const [falhou, setFalhou] = useState(false);
  const iniciado = useRef(false);

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;

    const ticket = parametros.get("ticket");
    window.history.replaceState(null, "", "/auth/callback");

    (async () => {
      try {
        if (!ticket) throw new Error("sem ticket");
        await entrarComToken(await trocarTicket(ticket));
        setDarkModeOnLogin();
        navigate("/inicio", { replace: true });
      } catch {
        setFalhou(true);
      }
    })();
  }, [parametros, entrarComToken, navigate, setDarkModeOnLogin]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-login">
      <div className="w-full max-w-[360px] rounded-[20px] border border-white/20 bg-white/10 p-8 text-center text-white shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-md">
        {falhou ? (
          <>
            <div
              role="alert"
              className="mb-4 rounded-lg border border-danger bg-tint-danger p-2 text-sm text-white"
            >
              {TICKET_INVALIDO}
            </div>
            <Link
              to="/login"
              replace
              className="rounded font-medium text-white underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Voltar para o login
            </Link>
          </>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <Spinner size="sm" />
            <span>Entrando...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
```

- [ ] **Step 4: Rota e layout**

Em `frontend/src/router.tsx`, depois de `const Login = lazy(() => import("./pages/Login"));`:

```tsx
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
```

E depois de `<Route path="/login" element={<Login />} />`:

```tsx
      <Route path="/auth/callback" element={<AuthCallback />} />
```

Em `frontend/src/App.tsx`, trocar a linha 15 por:

```tsx
const noLayoutRoutes = ["/login", "/auth/callback"];
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/pages/AuthCallback.test.tsx src/router.carregamento.test.tsx src/auth/ src/test/`
Esperado: PASS.

- [ ] **Step 6: Commit**

```bash
cd ~/github/DataCore && scripts/varrer.sh
git add frontend/src/pages/AuthCallback.tsx frontend/src/pages/AuthCallback.test.tsx frontend/src/router.tsx frontend/src/App.tsx
git commit -m "feat(front): página de volta do login com Microsoft"
```

---

### Task 7: Verificação completa, migration e colocação no ar

**Files:** nenhum código novo. Só conserto do que a verificação acusar.

- [ ] **Step 1: Backend completo**

```bash
cd ~/github/DataCore/backend
.venv/bin/python -m pytest -q -p no:cacheprovider
```

Esperado: tudo verde. Anote o total e compare com a baseline da Task 1.

- [ ] **Step 2: Frontend completo, nos dois fusos, mais lint, tipos e build**

```bash
cd ~/github/DataCore/frontend
TZ=UTC npm test && TZ=America/Sao_Paulo npm test
npm run lint
npx tsc --noEmit -p .
npm run build
npx prettier --check .
```

Esperado: as duas suítes verdes; o lint com no máximo **9 avisos, 0 erros** (baseline); `tsc`, build e prettier limpos. Se o prettier acusar arquivo novo, rode `npx prettier --write <arquivo>` e faça commit.

- [ ] **Step 3: Ponta a ponta local, com o Entra de verdade**

Precisa da redirect URI `http://localhost:8000/auth/microsoft/callback` cadastrada no app do Entra (ela já está na lista do registro). No `backend/.env` local, ajustar `MS_REDIRECT_URI` e `FRONTEND_URL` para os endereços locais (ver `.env.example`). **Aponte o backend para o Postgres de teste, nunca para produção.** Depois:

```bash
cd ~/github/DataCore && docker compose up
```

Abrir `http://localhost:5174/login`, clicar em "Entrar com Microsoft", entrar com a conta da TI e conferir que cai em `/inicio` logado. O usuário precisa existir no banco de teste com o e-mail da conta. Se esse caminho ficar caro, pule para o Step 6 e faça a verificação em produção.

Ao terminar, voltar o `backend/.env` para os valores de produção.

- [ ] **Step 4: Push (com o ok do Erick)**

```bash
cd ~/github/DataCore && scripts/varrer.sh && git push
```

- [ ] **Step 5: Migration 0002 em produção — o Erick roda no Konsole**

Da pasta `backend/`:

```bash
cd ~/github/DataCore/backend
AUTH_APP_DB_USER=<usuário do DATABASE_URL de produção> bash scripts/migrar.sh
```

Esperado: `== Antes:` mostra `0001`, e `== Depois:` mostra `0002 (head)`. Depois, conferir pelo cadastro de leitura:

```python
bancos.consultar("datacore", "select count(*) from auth.sso_tickets")  # 0, sem erro
```

- [ ] **Step 6: Deploy e verificação em produção — o Erick clica**

1. EasyPanel → `datacore-api` → ambiente: as cinco variáveis (`MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_REDIRECT_URI=https://tinyapi.healthsafetytech.com/auth/microsoft/callback`, `FRONTEND_URL=https://datacorehs.healthsafetytech.com`). Depois, "Implantar".
2. `curl -s https://tinyapi.healthsafetytech.com/auth/sso/status` → `{"ativo":true}`.
3. EasyPanel → `datacore-sistema` → "Implantar".
4. Abrir `https://datacorehs.healthsafetytech.com/login`: o botão aparece; clicar e entrar com a conta Microsoft; cair em `/inicio` com o papel certo.
5. Conferir o caminho triste com uma conta do tenant **sem** usuário no DataCore (ou pedir para alguém testar): a mensagem "Sua conta Microsoft não tem acesso ao DataCore…" aparece.
6. O login por senha continua funcionando.
