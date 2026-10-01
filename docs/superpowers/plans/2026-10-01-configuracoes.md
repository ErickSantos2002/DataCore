# Configurações — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página Configurações com seções nomeadas, histórico de alterações, trimestre em apuração automático (com exceção fixável) e escrita restrita a admin no backend.

**Architecture:** O backend ganha um módulo de validação por chave, a tabela `tiny.configuracoes_historico` gravada na mesma transação do `PUT`/`POST`, e `exigir_admin` nas rotas de escrita. No front, uma função (`trimestreEmApuracao`) passa a decidir o trimestre para o contexto e para a tela; a página vira uma pilha de componentes de seção em `pages/configuracoes/`.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 (psycopg2) + pytest contra Postgres de teste em container · React + TypeScript + Vitest + Testing Library · SQL manual para o schema `tiny`.

**Spec:** `docs/superpowers/specs/2026-10-01-configuracoes-design.md`

## Global Constraints

- Código, comentários, interface e commit em **português do Brasil**.
- **Repo público:** nenhum usuário de banco, senha, IP ou dado de pessoa em código, teste ou `.md`. `git add` por caminho, nunca `-A`. `scripts/varrer.sh` antes de qualquer push.
- O Claude **não lê** `~/.config/bancos/admin.toml`. DDL roda pelo Erick no Konsole, via script.
- Testes do backend: `cd backend && docker compose -f docker-compose.test.yml up -d --wait && .venv/bin/pytest`. Nunca contra o datacore.
- Testes do front: `cd frontend && npx vitest run`; tipos `npx tsc -b --noEmit` (apagar o `tsconfig.tsbuildinfo` gerado, não versionar); formato `npx prettier --check src`.
- Valores aceitos (verbatim da spec): `META` número > 0 nos formatos `12666666.72`, `12.666.666,72`, `12666666,72`, gravado como `12666666.72`; `TRIMESTRE_APURACAO` = `auto` ou `AAAA-TN` (N 1–4, ano 2020..ano corrente + 1), gravado com `T` maiúsculo; `ANIMACAO_META` = `true`/`false`; outras chaves texto livre.
- Histórico: `GET /configuracoes/historico?limite=20`, `limite` 1–100, só admin, mais recente primeiro; mesmo valor não gera linha.
- Ordem de deploy: migração `002` → deploy backend + front → migração `003`.

## Review Focus

1. **META digitada com "R$" e no formato brasileiro** (`R$ 12.666.666,72`) — o backend aceita e grava `12666666.72`, e a prévia de degraus do front mostra o mesmo número. → teste em Task 2 e Task 9.
2. **Switch da comemoração clicado duas vezes / salvar sem mudar** — nenhuma linha de histórico a mais. → teste em Task 3.
3. **Trimestre fixado do ano anterior depois da virada** (`2026-T4` em 02/01/2027) — o contexto busca 2026 e 2025, não 2027, e a projeção mostra o realizado. → testes em Task 5 e Task 6.
4. **Erro ao salvar** (422 do backend, 403, rede) — a mensagem aparece, o campo continua aberto com o que foi digitado. → teste em Task 9.
5. **Chave aposentada `MESES_ANALISE` ainda no banco entre o deploy e a `003`** — não aparece em "Usadas por outros sistemas". → teste em Task 10.

---

## File Structure

**Backend**
- Create `backend/migrations/002_configuracoes_historico.sql` — tabela de histórico, permissões copiadas, chave `TRIMESTRE_APURACAO`.
- Create `backend/migrations/003_aposentar_meses_analise.sql` — apaga `MESES_ANALISE`.
- Create `backend/scripts/migrar_tiny.sh` — roda um `.sql` de `migrations/` com o superusuário (Konsole).
- Create `backend/app/core/configuracoes.py` — `normalizar(chave, valor, hoje)` e `ValorInvalido`.
- Modify `backend/app/models/configuracoes.py` — modelo `ConfiguracaoHistorico`.
- Modify `backend/app/schemas/configuracoes.py` — schema `HistoricoConfiguracao`.
- Modify `backend/app/api/endpoints/configuracoes.py` — admin, validação, histórico.
- Create `backend/tests/test_configuracoes.py` — migração 002/003, validação, rotas.

**Frontend**
- Create `frontend/src/pages/dashboard/trimestre.ts` (+ `.test.ts`) — `trimestreEmApuracao`, rótulos.
- Modify `frontend/src/pages/dashboard/metaTrimestral.ts` (+ test) — `ano` na entrada; remove `mesesDoTrimestre`.
- Modify `frontend/src/pages/dashboard/ProjecaoFechamento.tsx` — `MESES_CURTOS` passa a vir de `trimestre.ts`.
- Modify `frontend/src/context/DashboardContext.tsx` (+ test) — expõe `trimestre`, busca os anos do trimestre; `totaisAnoCorrente` vira `totaisAnoDoTrimestre`.
- Modify `frontend/src/pages/Dashboard.tsx` (+ test) — trimestre do contexto, aviso de fixado.
- Modify `frontend/src/services/notasapi.ts` — `updateConfiguracao` devolve `Configuracao`; `fetchHistoricoConfiguracoes`.
- Modify `frontend/src/context/ConfiguracoesContext.tsx` — grava o valor normalizado que o backend devolveu.
- Create `frontend/src/pages/configuracoes/` — `useSalvarConfiguracao.ts`, `SecaoMeta.tsx`, `SecaoTrimestre.tsx`, `SecaoComemoracao.tsx`, `SecaoOutrosSistemas.tsx`, `SecaoHistorico.tsx`, `chaves.ts`.
- Modify `frontend/src/pages/Configuracoes.tsx` (+ test) — empilha as seções.

---

### Task 1: Migrações 002/003 e o script que as roda

**Files:**
- Create: `backend/migrations/002_configuracoes_historico.sql`
- Create: `backend/migrations/003_aposentar_meses_analise.sql`
- Create: `backend/scripts/migrar_tiny.sh`
- Test: `backend/tests/test_configuracoes.py`

**Interfaces:**
- Produces: tabela `tiny.configuracoes_historico(id, chave, valor_anterior, valor_novo, alterado_por, alterado_em)`; fixture `tabela_configuracoes` (module, autouse) e fixture `configs` (function) em `test_configuracoes.py`, usadas pelas Tasks 2–3.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_configuracoes.py`:

```python
"""Configurações: migrações 002/003, validação por chave, permissão e histórico.

A tabela tiny.configuracoes existe em produção desde antes do Alembic; aqui ela é
criada à mão com a mesma forma, e a 002 roda por cima — assim o teste exercita o
mesmo SQL que vai para o Konsole.
"""
from pathlib import Path

import pytest
from sqlalchemy import text

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"
SEMENTE = {
    "META": "12666666.72",
    "CFOP_VALIDOS": "6102,5102,6108,5108",
    "MARCADORES_INVALIDOS": "cancelar, nf devolvida",
    "MESES_ANALISE": "10,11,12",
    "ANIMACAO_META": "true",
}


def _rodar(engine, arquivo):
    with engine.begin() as conn:
        conn.exec_driver_sql((MIGRATIONS / arquivo).read_text())


@pytest.fixture(scope="module", autouse=True)
def tabela_configuracoes(engine):
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS tiny.configuracoes_historico"))
        conn.execute(text("DROP TABLE IF EXISTS tiny.configuracoes"))
        conn.execute(text(
            "CREATE TABLE tiny.configuracoes ("
            " id serial PRIMARY KEY, chave varchar NOT NULL UNIQUE, valor varchar NOT NULL)"
        ))
        # O usuário da aplicação escreve em configuracoes: a 002 tem que copiar isso.
        conn.execute(text("GRANT SELECT, UPDATE, INSERT ON tiny.configuracoes TO app_teste"))
    _rodar(engine, "002_configuracoes_historico.sql")


@pytest.fixture
def configs(engine):
    with engine.begin() as conn:
        conn.execute(text(
            "TRUNCATE tiny.configuracoes, tiny.configuracoes_historico RESTART IDENTITY"
        ))
        for chave, valor in {**SEMENTE, "TRIMESTRE_APURACAO": "auto"}.items():
            conn.execute(
                text("INSERT INTO tiny.configuracoes (chave, valor) VALUES (:c, :v)"),
                {"c": chave, "v": valor},
            )
    return engine


def _valor(engine, chave):
    with engine.connect() as conn:
        return conn.execute(
            text("SELECT valor FROM tiny.configuracoes WHERE chave = :c"), {"c": chave}
        ).scalar_one_or_none()


# ------------------------------------------------------------------ migrações

def test_002_cria_o_historico_com_a_permissao_de_quem_escreve_em_configuracoes(engine):
    with engine.connect() as conn:
        pode = conn.execute(text(
            "SELECT has_table_privilege('app_teste', 'tiny.configuracoes_historico', 'INSERT'),"
            "       has_sequence_privilege('app_teste', 'tiny.configuracoes_historico_id_seq', 'USAGE')"
        )).one()
    assert pode == (True, True)


def test_002_cria_trimestre_automatico_e_e_idempotente(engine, configs):
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM tiny.configuracoes WHERE chave = 'TRIMESTRE_APURACAO'"))
    _rodar(engine, "002_configuracoes_historico.sql")
    _rodar(engine, "002_configuracoes_historico.sql")  # segunda vez não quebra nem duplica
    assert _valor(engine, "TRIMESTRE_APURACAO") == "auto"


def test_002_nao_sobrescreve_trimestre_ja_fixado(engine, configs):
    with engine.begin() as conn:
        conn.execute(text(
            "UPDATE tiny.configuracoes SET valor = '2026-T3' WHERE chave = 'TRIMESTRE_APURACAO'"
        ))
    _rodar(engine, "002_configuracoes_historico.sql")
    assert _valor(engine, "TRIMESTRE_APURACAO") == "2026-T3"


def test_003_apaga_so_meses_analise(engine, configs):
    _rodar(engine, "003_aposentar_meses_analise.sql")
    assert _valor(engine, "MESES_ANALISE") is None
    assert _valor(engine, "CFOP_VALIDOS") == SEMENTE["CFOP_VALIDOS"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && docker compose -f docker-compose.test.yml up -d --wait && .venv/bin/pytest tests/test_configuracoes.py -v`
Expected: ERROR na fixture — `FileNotFoundError: .../002_configuracoes_historico.sql`.

- [ ] **Step 3: Write the migrations and the runner**

`backend/migrations/002_configuracoes_historico.sql`:

```sql
-- Histórico de alterações das configurações + chave do trimestre automático.
-- Roda ANTES do deploy do backend novo (ele grava histórico em todo PUT).
-- Uso (Konsole, superusuário): bash scripts/migrar_tiny.sh 002_configuracoes_historico.sql

CREATE TABLE IF NOT EXISTS tiny.configuracoes_historico (
    id             bigserial PRIMARY KEY,
    chave          text        NOT NULL,
    valor_anterior text,
    valor_novo     text        NOT NULL,
    alterado_por   text        NOT NULL,
    alterado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS configuracoes_historico_alterado_em
    ON tiny.configuracoes_historico (alterado_em DESC);

COMMENT ON TABLE tiny.configuracoes_historico IS
    'Quem mudou qual configuração, quando, e de qual valor para qual.';
COMMENT ON COLUMN tiny.configuracoes_historico.valor_anterior IS
    'NULL quando a chave foi criada.';
COMMENT ON COLUMN tiny.configuracoes_historico.alterado_por IS
    'username de auth.usuarios (o e-mail é opcional lá).';

-- As permissões copiam as de tiny.configuracoes: quem escreve lá registra
-- histórico aqui; quem só lê lá, só lê aqui. O script não precisa saber o nome
-- de usuário nenhum (o repo é público).
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT rolname FROM pg_roles
         WHERE NOT rolsuper AND rolname NOT LIKE 'pg\_%'
    LOOP
        IF has_table_privilege(r.rolname, 'tiny.configuracoes', 'UPDATE') THEN
            EXECUTE format('GRANT SELECT, INSERT ON tiny.configuracoes_historico TO %I', r.rolname);
            EXECUTE format('GRANT USAGE ON SEQUENCE tiny.configuracoes_historico_id_seq TO %I', r.rolname);
        ELSIF has_table_privilege(r.rolname, 'tiny.configuracoes', 'SELECT') THEN
            EXECUTE format('GRANT SELECT ON tiny.configuracoes_historico TO %I', r.rolname);
        END IF;
    END LOOP;
END $$;

-- 'auto' = o trimestre do calendário. Não sobrescreve um valor já gravado.
INSERT INTO tiny.configuracoes (chave, valor)
SELECT 'TRIMESTRE_APURACAO', 'auto'
 WHERE NOT EXISTS (SELECT 1 FROM tiny.configuracoes WHERE chave = 'TRIMESTRE_APURACAO');
```

`backend/migrations/003_aposentar_meses_analise.sql`:

```sql
-- Aposenta MESES_ANALISE, substituída por TRIMESTRE_APURACAO (migração 002).
-- Roda DEPOIS do deploy do front novo: o front antigo lê esta chave e ficaria
-- sem trimestre. Nenhum outro sistema a lê (varrido em ~/github, 01/10/2026).
-- Uso (Konsole, superusuário): bash scripts/migrar_tiny.sh 003_aposentar_meses_analise.sql

DELETE FROM tiny.configuracoes WHERE chave = 'MESES_ANALISE';
```

`backend/scripts/migrar_tiny.sh`:

```bash
#!/usr/bin/env bash
# Roda uma migration SQL do schema tiny (migrations/) no datacore, com o
# superusuário do admin.toml. Roda no Konsole (o Claude não lê o admin.toml):
#   bash scripts/migrar_tiny.sh 002_configuracoes_historico.sql
# Para na primeira falha e roda tudo numa transação só.
set -euo pipefail
cd "$(dirname "$0")/.."

ARQUIVO="migrations/${1:?Informe o arquivo de migrations/, ex.: 002_configuracoes_historico.sql}"
[ -f "$ARQUIVO" ] || { echo "Não existe: $ARQUIVO"; exit 1; }

URL="$(.venv/bin/python scripts/_admin_url.py datacore)"
psql "$URL" -v ON_ERROR_STOP=1 --single-transaction -f "$ARQUIVO"
echo "OK: $ARQUIVO aplicada."
```

Run: `chmod +x backend/scripts/migrar_tiny.sh`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/test_configuracoes.py -v`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/migrations/002_configuracoes_historico.sql backend/migrations/003_aposentar_meses_analise.sql backend/scripts/migrar_tiny.sh backend/tests/test_configuracoes.py
git commit -m "feat(configuracoes): migrações do histórico e do trimestre automático"
```

---

### Task 2: Validação e normalização por chave

**Files:**
- Create: `backend/app/core/configuracoes.py`
- Test: `backend/tests/test_configuracoes.py` (acrescentar)

**Interfaces:**
- Produces: `normalizar(chave: str, valor: str, hoje: date | None = None) -> str` (lança `ValorInvalido(str)` com mensagem em português); `class ValorInvalido(ValueError)`.

- [ ] **Step 1: Write the failing test** — acrescentar a `test_configuracoes.py`:

```python
# ------------------------------------------------------------------ validação
from datetime import date  # noqa: E402

from app.core.configuracoes import ValorInvalido, normalizar  # noqa: E402

HOJE = date(2026, 10, 1)


@pytest.mark.parametrize("entrada", [
    "12666666.72", "12.666.666,72", "12666666,72", "R$ 12.666.666,72", " 12666666.72 ",
])
def test_meta_aceita_os_tres_formatos_e_grava_ponto_decimal(entrada):
    assert normalizar("META", entrada, HOJE) == "12666666.72"


def test_meta_inteira_ganha_duas_casas():
    assert normalizar("META", "12000000", HOJE) == "12000000.00"


@pytest.mark.parametrize("entrada", ["", "abc", "0", "-5", "0,00"])
def test_meta_recusa_vazio_texto_zero_e_negativo(entrada):
    with pytest.raises(ValorInvalido, match="META"):
        normalizar("META", entrada, HOJE)


@pytest.mark.parametrize("entrada,esperado", [
    ("auto", "auto"), (" AUTO ", "auto"), ("2026-T3", "2026-T3"), ("2026-t4", "2026-T4"),
    ("2020-T1", "2020-T1"), ("2027-T1", "2027-T1"),
])
def test_trimestre_aceita_auto_e_ano_trimestre(entrada, esperado):
    assert normalizar("TRIMESTRE_APURACAO", entrada, HOJE) == esperado


@pytest.mark.parametrize("entrada", ["", "10,11,12", "2026-T5", "2026-T0", "2019-T4", "2028-T1", "26-T3"])
def test_trimestre_recusa_o_resto(entrada):
    with pytest.raises(ValorInvalido, match="trimestre"):
        normalizar("TRIMESTRE_APURACAO", entrada, HOJE)


@pytest.mark.parametrize("entrada,esperado", [("true", "true"), ("FALSE", "false")])
def test_animacao_so_aceita_booleano(entrada, esperado):
    assert normalizar("ANIMACAO_META", entrada, HOJE) == esperado


def test_animacao_recusa_outra_coisa():
    with pytest.raises(ValorInvalido):
        normalizar("ANIMACAO_META", "sim", HOJE)


def test_chave_desconhecida_passa_como_veio():
    assert normalizar("CFOP_VALIDOS", " 6102,5102 ", HOJE) == " 6102,5102 "
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/test_configuracoes.py -v`
Expected: ERROR de coleta — `ModuleNotFoundError: No module named 'app.core.configuracoes'`.

- [ ] **Step 3: Write minimal implementation** — `backend/app/core/configuracoes.py`:

```python
"""As regras de valor das chaves de configuração que o painel entende.

A tabela tiny.configuracoes é texto livre, e por anos aceitou qualquer coisa: a
META foi digitada em três formatos diferentes, e uma lista de meses mal digitada
só aparecia como painel zerado. Aqui cada chave conhecida diz o que aceita e
como fica gravada; chave desconhecida (as que o HS.OS lê) passa como veio.

O parse da META é o mesmo do front (`parseValor` em metaTrimestral.ts) — a
prévia de degraus na página e o valor gravado têm que concordar.
"""
import re
from datetime import date
from decimal import Decimal, InvalidOperation


class ValorInvalido(ValueError):
    """Valor recusado; a mensagem vai para a tela como veio."""


def _meta(valor: str, hoje: date) -> str:
    s = valor.strip().replace("R$", "").replace(" ", "")
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    elif s.count(".") > 1:
        s = s.replace(".", "")
    try:
        numero = Decimal(s)
    except InvalidOperation:
        numero = Decimal(0)
    if not numero.is_finite() or numero <= 0:
        raise ValorInvalido("A META precisa ser um valor em reais maior que zero.")
    return str(numero.quantize(Decimal("0.01")))


_TRIMESTRE = re.compile(r"^(\d{4})-T([1-4])$", re.IGNORECASE)


def _trimestre(valor: str, hoje: date) -> str:
    s = valor.strip()
    if s.lower() == "auto":
        return "auto"
    m = _TRIMESTRE.match(s)
    if m and 2020 <= int(m.group(1)) <= hoje.year + 1:
        return f"{m.group(1)}-T{m.group(2)}"
    raise ValorInvalido(
        f"O trimestre precisa ser 'auto' ou ano-trimestre, ex.: {hoje.year}-T3 "
        f"(ano entre 2020 e {hoje.year + 1})."
    )


def _booleano(valor: str, hoje: date) -> str:
    s = valor.strip().lower()
    if s in ("true", "false"):
        return s
    raise ValorInvalido("A comemoração só aceita true ou false.")


_REGRAS = {
    "META": _meta,
    "TRIMESTRE_APURACAO": _trimestre,
    "ANIMACAO_META": _booleano,
}


def normalizar(chave: str, valor: str, hoje: date | None = None) -> str:
    regra = _REGRAS.get(chave)
    return regra(valor, hoje or date.today()) if regra else valor
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/test_configuracoes.py -v`
Expected: todos passam.

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/configuracoes.py backend/tests/test_configuracoes.py
git commit -m "feat(configuracoes): validação e normalização por chave"
```

---

### Task 3: Rotas — admin, validação, histórico

**Files:**
- Modify: `backend/app/models/configuracoes.py`
- Modify: `backend/app/schemas/configuracoes.py`
- Modify: `backend/app/api/endpoints/configuracoes.py`
- Test: `backend/tests/test_configuracoes.py` (acrescentar)

**Interfaces:**
- Consumes: `normalizar`, `ValorInvalido` (Task 2); fixtures `configs`, `admin`, `comum`, `client`.
- Produces: `PUT /configuracoes/{chave}` → `{id, chave, valor}` com `valor` normalizado (admin; 403 comum; 401 sem token; 422 inválido); `POST /configuracoes/` idem; `GET /configuracoes/historico?limite=N` → `[{id, chave, valor_anterior, valor_novo, alterado_por, alterado_em}]`.

- [ ] **Step 1: Write the failing test** — acrescentar:

```python
# ------------------------------------------------------------------ rotas

def _historico(engine):
    with engine.connect() as conn:
        return conn.execute(text(
            "SELECT chave, valor_anterior, valor_novo, alterado_por"
            "  FROM tiny.configuracoes_historico ORDER BY id"
        )).all()


def test_comum_nao_altera(client, configs, comum):
    r = client.put("/configuracoes/META", json={"valor": "1"}, headers=comum.headers)
    assert r.status_code == 403
    assert _valor(configs, "META") == SEMENTE["META"]


def test_sem_token_nao_altera(client, configs):
    assert client.put("/configuracoes/META", json={"valor": "1"}).status_code == 401


def test_comum_nao_cria(client, configs, comum):
    r = client.post("/configuracoes/", json={"chave": "X", "valor": "1"}, headers=comum.headers)
    assert r.status_code == 403


def test_comum_continua_lendo(client, configs, comum):
    r = client.get("/configuracoes/", headers=comum.headers)
    assert r.status_code == 200
    assert {c["chave"] for c in r.json()} >= {"META", "TRIMESTRE_APURACAO"}


def test_admin_altera_normaliza_e_registra(client, configs, admin):
    r = client.put("/configuracoes/META", json={"valor": "13.000.000,00"}, headers=admin.headers)
    assert r.status_code == 200
    assert r.json()["valor"] == "13000000.00"
    assert _valor(configs, "META") == "13000000.00"
    assert _historico(configs) == [("META", "12666666.72", "13000000.00", "chefe")]


def test_valor_invalido_e_422_e_nao_registra(client, configs, admin):
    r = client.put("/configuracoes/TRIMESTRE_APURACAO", json={"valor": "10,11,12"},
                   headers=admin.headers)
    assert r.status_code == 422
    assert "trimestre" in r.json()["detail"]
    assert _valor(configs, "TRIMESTRE_APURACAO") == "auto"
    assert _historico(configs) == []


def test_mesmo_valor_nao_gera_historico(client, configs, admin):
    for _ in range(2):
        r = client.put("/configuracoes/ANIMACAO_META", json={"valor": "true"},
                       headers=admin.headers)
        assert r.status_code == 200
    assert _historico(configs) == []


def test_meta_igual_em_outro_formato_nao_gera_historico(client, configs, admin):
    r = client.put("/configuracoes/META", json={"valor": "R$ 12.666.666,72"},
                   headers=admin.headers)
    assert r.status_code == 200
    assert _historico(configs) == []


def test_criar_registra_valor_anterior_nulo(client, configs, admin):
    r = client.post("/configuracoes/", json={"chave": "NOVA", "valor": "x"}, headers=admin.headers)
    assert r.status_code == 200
    assert _historico(configs) == [("NOVA", None, "x", "chefe")]


def test_historico_so_admin_mais_recente_primeiro_e_limitado(client, configs, admin, comum):
    for valor in ("2026-T1", "2026-T2", "2026-T3"):
        client.put("/configuracoes/TRIMESTRE_APURACAO", json={"valor": valor},
                   headers=admin.headers)

    assert client.get("/configuracoes/historico", headers=comum.headers).status_code == 403

    r = client.get("/configuracoes/historico?limite=2", headers=admin.headers)
    assert r.status_code == 200
    assert [h["valor_novo"] for h in r.json()] == ["2026-T3", "2026-T2"]
    assert r.json()[0]["alterado_por"] == "chefe"
    assert client.get("/configuracoes/historico?limite=0",
                      headers=admin.headers).status_code == 422
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/test_configuracoes.py -v`
Expected: FAIL — `test_comum_nao_altera` recebe 200; `/configuracoes/historico` cai em `GET /{chave}` e devolve 404.

- [ ] **Step 3: Implement**

`backend/app/models/configuracoes.py` (substituir o arquivo):

```python
from sqlalchemy import BigInteger, Column, DateTime, Integer, String, Text, func

from app.models.database import Base


class Configuracao(Base):
    __tablename__ = "configuracoes"
    __table_args__ = {"schema": "tiny"}

    id = Column(Integer, primary_key=True, index=True)
    chave = Column(String, unique=True, nullable=False, index=True)
    valor = Column(String, nullable=False)


class ConfiguracaoHistorico(Base):
    """Uma alteração de configuração. Criada pela migração 002."""

    __tablename__ = "configuracoes_historico"
    __table_args__ = {"schema": "tiny"}

    id = Column(BigInteger, primary_key=True)
    chave = Column(Text, nullable=False)
    valor_anterior = Column(Text, nullable=True)
    valor_novo = Column(Text, nullable=False)
    alterado_por = Column(Text, nullable=False)
    alterado_em = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
```

`backend/app/schemas/configuracoes.py` — acrescentar ao fim:

```python
from datetime import datetime
from typing import Optional


class HistoricoConfiguracao(BaseModel):
    id: int
    chave: str
    valor_anterior: Optional[str]
    valor_novo: str
    alterado_por: str
    alterado_em: datetime

    model_config = {"from_attributes": True}
```

`backend/app/api/endpoints/configuracoes.py` (substituir o arquivo):

```python
from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.configuracoes import ValorInvalido, normalizar
from app.core.security import exigir_admin
from app.models.configuracoes import Configuracao as ConfiguracaoModel
from app.models.configuracoes import ConfiguracaoHistorico
from app.models.database import SessionLocal
from app.models.usuario import Usuario
from app.schemas.configuracoes import (
    Configuracao,
    ConfiguracaoCreate,
    ConfiguracaoUpdate,
    HistoricoConfiguracao,
)

router = APIRouter(prefix="/configuracoes", tags=["Configurações"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _normalizar_ou_422(chave: str, valor: str) -> str:
    try:
        return normalizar(chave, valor, date.today())
    except ValorInvalido as erro:
        raise HTTPException(status_code=422, detail=str(erro))


@router.get("/", response_model=List[Configuracao])
def listar_configuracoes(db: Session = Depends(get_db)):
    return db.query(ConfiguracaoModel).all()


# Antes de GET /{chave}: senão o FastAPI lê "historico" como nome de chave.
@router.get("/historico", response_model=List[HistoricoConfiguracao])
def listar_historico(
    limite: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(exigir_admin),
):
    return (
        db.query(ConfiguracaoHistorico)
        .order_by(ConfiguracaoHistorico.alterado_em.desc(), ConfiguracaoHistorico.id.desc())
        .limit(limite)
        .all()
    )


@router.get("/{chave}", response_model=Configuracao)
def obter_configuracao(chave: str, db: Session = Depends(get_db)):
    config = db.query(ConfiguracaoModel).filter_by(chave=chave).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuração não encontrada")
    return config


@router.put("/{chave}", response_model=Configuracao)
def atualizar_configuracao(
    chave: str,
    dados: ConfiguracaoUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(exigir_admin),
):
    config = db.query(ConfiguracaoModel).filter_by(chave=chave).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuração não encontrada")
    valor = _normalizar_ou_422(chave, dados.valor)
    # Mesmo valor não é alteração: o switch clicado duas vezes não polui o histórico.
    if valor != config.valor:
        db.add(ConfiguracaoHistorico(
            chave=chave, valor_anterior=config.valor, valor_novo=valor,
            alterado_por=usuario.username,
        ))
        config.valor = valor
        db.commit()  # alteração e histórico na mesma transação
        db.refresh(config)
    return config


@router.post("/", response_model=Configuracao)
def criar_configuracao(
    dados: ConfiguracaoCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(exigir_admin),
):
    existente = db.query(ConfiguracaoModel).filter_by(chave=dados.chave).first()
    if existente:
        raise HTTPException(status_code=400, detail="Chave já existente")
    valor = _normalizar_ou_422(dados.chave, dados.valor)
    nova = ConfiguracaoModel(chave=dados.chave, valor=valor)
    db.add(nova)
    db.add(ConfiguracaoHistorico(
        chave=dados.chave, valor_anterior=None, valor_novo=valor,
        alterado_por=usuario.username,
    ))
    db.commit()
    db.refresh(nova)
    return nova
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest -q`
Expected: suíte inteira verde (as rotas antigas de configurações não tinham teste; nada mais deve mudar).

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/configuracoes.py backend/app/schemas/configuracoes.py backend/app/api/endpoints/configuracoes.py backend/tests/test_configuracoes.py
git commit -m "feat(configuracoes): escrita só para admin, validada e com histórico"
```

---

### Task 4: `trimestreEmApuracao` e os rótulos de trimestre

**Files:**
- Create: `frontend/src/pages/dashboard/trimestre.ts`
- Test: `frontend/src/pages/dashboard/trimestre.test.ts`
- Modify: `frontend/src/pages/dashboard/ProjecaoFechamento.tsx` (usar `MESES_CURTOS` daqui)

**Interfaces:**
- Produces:
  - `type NumeroDoTrimestre = 1 | 2 | 3 | 4`
  - `interface TrimestreEmApuracao { ano: number; trimestre: NumeroDoTrimestre; meses: number[]; fixado: boolean }`
  - `trimestreEmApuracao(valor: string | undefined, hoje: Date): TrimestreEmApuracao`
  - `valorDoTrimestre(ano: number, trimestre: NumeroDoTrimestre): string` → `"2026-T3"`
  - `nomeDoTrimestre(t: Pick<TrimestreEmApuracao, "ano" | "trimestre">): string` → `"3º trimestre de 2026"`
  - `mesesPorExtenso(meses: number[]): string` → `"jul, ago, set"`
  - `MESES_CURTOS: readonly string[]` (jan…dez)

- [ ] **Step 1: Write the failing test** — `frontend/src/pages/dashboard/trimestre.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  mesesPorExtenso,
  nomeDoTrimestre,
  trimestreEmApuracao,
  valorDoTrimestre,
} from "./trimestre";

/**
 * Qual trimestre o painel mede. "auto" segue o calendário; "AAAA-TN" fixa um —
 * com ano, para que fixar o T4 no dia 2 de janeiro mostre o T4 que acabou, e
 * não o T4 vazio do ano novo.
 */
describe("trimestre em apuração", () => {
  it.each([
    [new Date(2026, 0, 1), 1, [1, 2, 3]],
    [new Date(2026, 2, 31), 1, [1, 2, 3]],
    [new Date(2026, 3, 1), 2, [4, 5, 6]],
    [new Date(2026, 8, 30), 3, [7, 8, 9]],
    [new Date(2026, 9, 1), 4, [10, 11, 12]],
    [new Date(2026, 11, 31), 4, [10, 11, 12]],
  ])("auto em %s é o %iº trimestre", (hoje, trimestre, meses) => {
    expect(trimestreEmApuracao("auto", hoje as Date)).toEqual({
      ano: 2026,
      trimestre,
      meses,
      fixado: false,
    });
  });

  it("fixado usa o ano e o trimestre gravados, não os de hoje", () => {
    expect(trimestreEmApuracao("2026-T4", new Date(2027, 0, 2))).toEqual({
      ano: 2026,
      trimestre: 4,
      meses: [10, 11, 12],
      fixado: true,
    });
  });

  it("aceita t minúsculo e espaço em volta", () => {
    expect(trimestreEmApuracao(" 2026-t3 ", new Date(2026, 9, 1)).trimestre).toBe(3);
  });

  it.each([undefined, "", "10,11,12", "2026-T5", "lixo"])(
    "valor %j cai no automático — o painel nunca fica sem trimestre",
    (valor) => {
      const t = trimestreEmApuracao(valor, new Date(2026, 9, 1));
      expect(t.fixado).toBe(false);
      expect(t.trimestre).toBe(4);
    },
  );

  it("monta o valor gravado e os rótulos da tela", () => {
    expect(valorDoTrimestre(2026, 3)).toBe("2026-T3");
    expect(nomeDoTrimestre({ ano: 2026, trimestre: 4 })).toBe("4º trimestre de 2026");
    expect(mesesPorExtenso([10, 11, 12])).toBe("out, nov, dez");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/dashboard/trimestre.test.ts`
Expected: FAIL — `Failed to resolve import "./trimestre"`.

- [ ] **Step 3: Write minimal implementation** — `frontend/src/pages/dashboard/trimestre.ts`:

```ts
/** Qual trimestre o painel da meta mede.
 *
 * A configuração TRIMESTRE_APURACAO vale "auto" (o trimestre do calendário em
 * que hoje está) ou "AAAA-TN" (um trimestre fixado — para olhar o fechamento
 * de um que já acabou). O ano faz parte do valor porque, sem ele, fixar o T4 no
 * dia 2 de janeiro mostraria o T4 vazio do ano novo.
 *
 * Valor ausente ou inválido vale "auto": o painel nunca fica sem trimestre. Quem
 * impede valor inválido de ser gravado é o backend.
 */

export type NumeroDoTrimestre = 1 | 2 | 3 | 4;

export interface TrimestreEmApuracao {
  ano: number;
  trimestre: NumeroDoTrimestre;
  /** Os três meses, 1-based: [7, 8, 9]. */
  meses: number[];
  /** true quando a configuração fixa um trimestre em vez de seguir o calendário. */
  fixado: boolean;
}

export const MESES_CURTOS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
] as const;

const FIXADO = /^(\d{4})-T([1-4])$/i;

function mesesDe(trimestre: NumeroDoTrimestre): number[] {
  const primeiro = (trimestre - 1) * 3 + 1;
  return [primeiro, primeiro + 1, primeiro + 2];
}

export function trimestreEmApuracao(
  valor: string | undefined,
  hoje: Date,
): TrimestreEmApuracao {
  const fixado = valor?.trim().match(FIXADO);
  if (fixado) {
    const trimestre = Number(fixado[2]) as NumeroDoTrimestre;
    return { ano: Number(fixado[1]), trimestre, meses: mesesDe(trimestre), fixado: true };
  }
  const trimestre = (Math.floor(hoje.getMonth() / 3) + 1) as NumeroDoTrimestre;
  return { ano: hoje.getFullYear(), trimestre, meses: mesesDe(trimestre), fixado: false };
}

export function valorDoTrimestre(ano: number, trimestre: NumeroDoTrimestre): string {
  return `${ano}-T${trimestre}`;
}

export function nomeDoTrimestre({
  ano,
  trimestre,
}: Pick<TrimestreEmApuracao, "ano" | "trimestre">): string {
  return `${trimestre}º trimestre de ${ano}`;
}

export function mesesPorExtenso(meses: number[]): string {
  return meses.map((m) => MESES_CURTOS[m - 1]).join(", ");
}
```

Em `frontend/src/pages/dashboard/ProjecaoFechamento.tsx`: apagar a constante local `MESES_CURTOS` e acrescentar `import { MESES_CURTOS } from "./trimestre";`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx prettier --write src/pages/dashboard/trimestre.ts src/pages/dashboard/trimestre.test.ts src/pages/dashboard/ProjecaoFechamento.tsx && npx vitest run src/pages/dashboard src/pages/Dashboard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/dashboard/trimestre.ts frontend/src/pages/dashboard/trimestre.test.ts frontend/src/pages/dashboard/ProjecaoFechamento.tsx
git commit -m "feat(meta): trimestre em apuração automático ou fixado com ano"
```

---

### Task 5: Projeção com o ano do trimestre

**Files:**
- Modify: `frontend/src/pages/dashboard/metaTrimestral.ts`
- Test: `frontend/src/pages/dashboard/metaTrimestral.test.ts`

**Interfaces:**
- Produces: `EntradaDaProjecao.ano?: number` — o ano do trimestre (padrão: `hoje.getFullYear()`). Trimestre de ano anterior ao de `hoje` = inteiro decorrido; de ano posterior = não começado. `anoAnterior` do resultado passa a ser `ano - 1`.

- [ ] **Step 1: Write the failing test** — acrescentar a `metaTrimestral.test.ts`:

```ts
describe("projeção de fechamento — trimestre de outro ano", () => {
  it("trimestre do ano passado conta como encerrado: projeção é o realizado", () => {
    // 2026-T4 fixado, olhado em 02/01/2027.
    const projecao = projecaoDeFechamento({
      realizado: 3_100_000,
      meses: [10, 11, 12],
      ano: 2026,
      hoje: new Date(2027, 0, 2),
      totaisAnoAnterior: Array<number>(12).fill(300_000),
    });

    expect(projecao.diasDecorridos).toBe(92);
    expect(projecao.diasTotais).toBe(92);
    expect(projecao.projetado).toBeCloseTo(3_100_000, 2);
    expect(projecao.anoAnterior).toBe(2025);
  });

  it("trimestre de ano que ainda não chegou não tem projeção", () => {
    const projecao = projecaoDeFechamento({
      realizado: 0,
      meses: [1, 2, 3],
      ano: 2027,
      hoje: new Date(2026, 11, 20),
    });

    expect(projecao.disponivel).toBe(false);
  });

  it("conta fevereiro pelo ano do trimestre, não pelo de hoje", () => {
    const projecao = projecaoDeFechamento({
      realizado: 1,
      meses: [1, 2, 3],
      ano: 2028,
      hoje: new Date(2029, 5, 1),
    });

    expect(projecao.diasTotais).toBe(91); // 2028 é bissexto
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/dashboard/metaTrimestral.test.ts`
Expected: FAIL — o primeiro teste dá `diasDecorridos` 0 (outubro de 2027 ainda não chegou na conta só por mês).

- [ ] **Step 3: Implement** — em `metaTrimestral.ts`:

Na interface `EntradaDaProjecao`, acrescentar depois de `meses`:

```ts
  /** O ano do trimestre. Padrão: o de `hoje`. Um trimestre fixado em
   *  Configurações pode ser de outro ano — o T4 olhado em janeiro. */
  ano?: number;
```

Na desestruturação de `projecaoDeFechamento`, acrescentar `ano: anoDoTrimestre,` e trocar o começo da função:

```ts
  const ano = anoDoTrimestre ?? hoje.getFullYear();
  // Trimestre de ano já passado conta como inteiro decorrido (13 = depois de
  // dezembro); de ano que não chegou, como não começado (0 = antes de janeiro).
  const mesDeHoje =
    ano < hoje.getFullYear()
      ? 13
      : ano > hoje.getFullYear()
        ? 0
        : hoje.getMonth() + 1;
  const anoAnterior = ano - 1;
```

(o resto da função já usa `ano` para os dias do mês e `mesDeHoje` para decorrido/restante.)

Apagar `mesesDoTrimestre` de `metaTrimestral.ts` e o seu bloco `describe("meses do trimestre", …)` do teste — quem decide os meses agora é `trimestreEmApuracao` (Task 4); o `Dashboard` deixa de importá-la na Task 7. **Atenção:** até a Task 7 o `Dashboard.tsx` ainda importa `mesesDoTrimestre`; para manter o build verde entre commits, faça essa remoção **na Task 7**, não aqui.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/dashboard/metaTrimestral.test.ts`
Expected: PASS (todos, inclusive os antigos — `ano` ausente mantém o comportamento).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/dashboard/metaTrimestral.ts frontend/src/pages/dashboard/metaTrimestral.test.ts
git commit -m "feat(meta): projeção aceita trimestre de outro ano"
```

---

### Task 6: DashboardContext pelo trimestre em apuração

**Files:**
- Modify: `frontend/src/context/DashboardContext.tsx`
- Test: `frontend/src/context/DashboardContext.test.tsx`

**Interfaces:**
- Consumes: `trimestreEmApuracao`, `TrimestreEmApuracao` (Task 4).
- Produces: no contexto, `trimestre: TrimestreEmApuracao` (novo) e `totaisAnoDoTrimestre: number[]` (**renomeia** `totaisAnoCorrente`); `totaisAnoAnterior` passa a ser o ano **do trimestre** − 1. `totalAno` e `serieMensal` continuam sendo do ano corrente.

- [ ] **Step 1: Write the failing test** — em `DashboardContext.test.tsx`:

Trocar a semente do mock para `atual: [{ id: 1, chave: "TRIMESTRE_APURACAO", valor: "2026-T3" }]`, e o teste `"usa MESES_ANALISE para o trimestre em apuração"` para `"usa TRIMESTRE_APURACAO para o trimestre em apuração"` (mesmo corpo). Acrescentar ao `Espiao`:

```tsx
      <p data-testid="trimestre">{`${trimestre.ano}-T${trimestre.trimestre}`}</p>
```

(com `trimestre` vindo de `useDashboard()`), e os testes:

```tsx
  it("trimestre fixado em outro ano busca o ano dele e o anterior a ele", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2027, 0, 2));
    estadoConfiguracoes.atual = [
      { id: 1, chave: "TRIMESTRE_APURACAO", valor: "2026-T4" },
    ];
    fetchFaturamentoMensal.mockImplementation(async (ano: number) =>
      dozeMeses(ano === 2026 ? { 10: 1, 11: 2, 12: 3 } : {}),
    );

    render(
      <DashboardProvider>
        <Espiao />
      </DashboardProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("totalTrimestre")).toHaveTextContent("6"),
    );
    expect(screen.getByTestId("trimestre")).toHaveTextContent("2026-T4");
    const anosBuscados = fetchFaturamentoMensal.mock.calls.map((c) => c[0]);
    expect(new Set(anosBuscados)).toEqual(new Set([2027, 2026, 2025]));
    vi.useRealTimers();
  });

  it("sem a chave, segue o trimestre do calendário", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 1));
    estadoConfiguracoes.atual = [];
    fetchFaturamentoMensal.mockResolvedValue(dozeMeses());

    render(
      <DashboardProvider>
        <Espiao />
      </DashboardProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("trimestre")).toHaveTextContent("2026-T4"),
    );
    vi.useRealTimers();
  });
```

Conferir antes como `fetchFaturamentoMensal` é chamado (o primeiro argumento é o ano? ver `totaisDoAno` no contexto) e ajustar o `mockImplementation` à assinatura real. Se o `beforeEach` não restaura `estadoConfiguracoes.atual`, acrescentar a restauração para a semente `2026-T3`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/context/DashboardContext.test.tsx`
Expected: FAIL — `trimestre` indefinido no contexto.

- [ ] **Step 3: Implement** — em `DashboardContext.tsx`:

1. `import { trimestreEmApuracao, type TrimestreEmApuracao } from "../pages/dashboard/trimestre";`
2. Na interface: trocar a doc do `dados` para `/** Os meses do trimestre em apuração (TRIMESTRE_APURACAO). */`; renomear `totaisAnoCorrente` → `totaisAnoDoTrimestre` com a doc `/** Faturamento de cada mês do ANO DO TRIMESTRE, índice 0 = janeiro. Dele a projeção tira o crescimento acumulado dos meses antes do trimestre. */`; trocar a doc de `totaisAnoAnterior` para dizer "o ano anterior ao **do trimestre**"; acrescentar `/** Qual trimestre está em apuração — do calendário ou fixado. */ trimestre: TrimestreEmApuracao;`.
3. Default do contexto: `totaisAnoDoTrimestre: []`, `trimestre: trimestreEmApuracao(undefined, new Date())`.
4. Estado: renomear o `useState` de `totaisAnoCorrente`; acrescentar `const [trimestre, setTrimestre] = useState(() => trimestreEmApuracao(undefined, new Date()));`.
5. Em `carregar`: apagar `getArray` e o parse de `MESES_ANALISE` (e o comentário dele); depois de `const anoAtual = hoje.getFullYear();`:

```ts
      const doTrimestre = trimestreEmApuracao(
        configuracoes.find((c) => c.chave === "TRIMESTRE_APURACAO")?.valor,
        hoje,
      );
```

   No `try` do ano corrente, trocar `totaisDoAnoCorrente = totais;` e o `mesesEmApuracao = meses.map(...)` por:

```ts
        // Trimestre fixado em outro ano (o T4 olhado em janeiro) precisa do
        // ano dele; no caso comum é o mesmo ano e a mesma requisição.
        totaisDoAnoDoTrimestre =
          doTrimestre.ano === anoAtual ? totais : await totaisDoAno(doTrimestre.ano);
        mesesEmApuracao = doTrimestre.meses.map((mes) => ({
          mes: rotuloDoMes(mes, doTrimestre.ano),
          total: totaisDoAnoDoTrimestre[mes - 1] ?? 0,
        }));
```

   (renomear a variável local `totaisDoAnoCorrente` → `totaisDoAnoDoTrimestre`.) Trocar `totaisDoAno(anoAtual - 1)` por `totaisDoAno(doTrimestre.ano - 1)`. Ao fim: `setTotaisAnoDoTrimestre(totaisDoAnoDoTrimestre); setTrimestre(doTrimestre);` e expor `totaisAnoDoTrimestre` e `trimestre` no `value` do provider.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/context`
Expected: PASS. (`Dashboard.tsx` ainda lê `totaisAnoCorrente` — `tsc` vai acusar; corrigido na Task 7, que é commitada junto. **Não** commitar esta task sozinha se `tsc` falhar: siga direto para a Task 7 e faça um commit só das duas.)

---

### Task 7: Dashboard pelo trimestre do contexto, com aviso de fixado

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/pages/dashboard/metaTrimestral.ts` (+ test) — remover `mesesDoTrimestre`
- Test: `frontend/src/pages/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `trimestre`, `totaisAnoDoTrimestre` do contexto (Task 6); `nomeDoTrimestre` (Task 4); `ano` da projeção (Task 5).

- [ ] **Step 1: Write the failing test** — em `Dashboard.test.tsx`:

1. No `estadoDashboard`: trocar `totaisAnoCorrente` por `totaisAnoDoTrimestre: [] as number[]` e acrescentar `trimestre: { ano: 2026, trimestre: 3 as 1 | 2 | 3 | 4, meses: [] as number[], fixado: false }`.
2. No `Cenario`: trocar `totaisAnoCorrente` por `totaisAnoDoTrimestre`; acrescentar `fixado?: boolean`. Manter `meses?: string` (doc: "meses do trimestre, ex. "6,7,8" — vira `trimestre.meses` no contexto mockado").
3. Em `montar`: parar de empurrar `MESES_ANALISE` em `configuracoes`; montar

```ts
    trimestre: {
      ano: new Date().getFullYear(),
      trimestre: 3,
      meses: meses ? meses.split(",").map((m) => Number(m.trim())) : [],
      fixado,
    },
```

   no `estadoDashboard.atual` (com `fixado = false` no default da desestruturação), e trocar `totaisAnoCorrente` → `totaisAnoDoTrimestre` em todo o arquivo (inclusive o teste "no dia 1o do trimestre…").
4. Novo teste:

```tsx
  it("avisa quando o trimestre está fixado em Configurações", () => {
    pararORelogioEm(2026, 10, 1);
    montar({ meta: "12000000", meses: "7,8,9", fixado: true });

    expect(
      screen.getByText(
        "Trimestre fixado em Configurações: 3º trimestre de 2026. O painel não está seguindo o calendário.",
      ),
    ).toBeInTheDocument();
  });

  it("não avisa nada com o trimestre automático", () => {
    pararORelogioEm(2026, 10, 1);
    montar({ meta: "12000000", meses: "10,11,12" });

    expect(screen.queryByText(/Trimestre fixado/)).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/Dashboard.test.tsx`
Expected: FAIL — aviso ausente.

- [ ] **Step 3: Implement** — em `Dashboard.tsx`:

1. Desestruturar `trimestre` e `totaisAnoDoTrimestre` (no lugar de `totaisAnoCorrente`) de `useDashboard()`.
2. Apagar o `mesesConfig` e o import de `mesesDoTrimestre`; a projeção fica:

```ts
  // O trimestre vem do contexto — o mesmo que somou o `total`.
  const projecao = projecaoDeFechamento({
    realizado: total,
    meses: trimestre.meses,
    ano: trimestre.ano,
    hoje: new Date(),
    totaisAnoAnterior: totaisAnoAnterior ?? [],
    totaisAnoCorrente: totaisAnoDoTrimestre ?? [],
  });
```

3. Logo abaixo do `<CabecalhoMeta …/>` no JSX (antes do conteúdo da meta), renderizar:

```tsx
        {trimestre.fixado && (
          <Alert variant="warning">
            {`Trimestre fixado em Configurações: ${nomeDoTrimestre(trimestre)}. O painel não está seguindo o calendário.`}
          </Alert>
        )}
```

   com `import { Alert } from "../design-system/ui/feedback";` e `import { nomeDoTrimestre } from "./dashboard/trimestre";`. Conferir onde o `CabecalhoMeta` é renderizado e manter o espaçamento do contêiner (o mesmo `gap`/`space-y` dos irmãos).

4. Em `metaTrimestral.ts`: apagar `mesesDoTrimestre` (e o comentário dele); em `metaTrimestral.test.ts`: apagar o `describe("meses do trimestre", …)` e o import.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run && npx tsc -b --noEmit && rm -f tsconfig.tsbuildinfo && npx prettier --check src`
Expected: tudo verde; `grep -rn "MESES_ANALISE\|mesesDoTrimestre\|totaisAnoCorrente" src` sem resultado.

- [ ] **Step 5: Commit (Tasks 6 + 7)**

```bash
git add frontend/src/context/DashboardContext.tsx frontend/src/context/DashboardContext.test.tsx frontend/src/pages/Dashboard.tsx frontend/src/pages/Dashboard.test.tsx frontend/src/pages/dashboard/metaTrimestral.ts frontend/src/pages/dashboard/metaTrimestral.test.ts
git commit -m "feat(meta): painel segue TRIMESTRE_APURACAO e avisa quando está fixado"
```

---

### Task 8: Serviços e contexto de configurações

**Files:**
- Modify: `frontend/src/services/notasapi.ts`
- Modify: `frontend/src/context/ConfiguracoesContext.tsx`
- Create: `frontend/src/context/ConfiguracoesContext.test.tsx`

**Interfaces:**
- Produces:
  - `updateConfiguracao(chave, valor): Promise<Configuracao>` (antes `Promise<unknown>`)
  - `interface HistoricoConfiguracao { id: number; chave: string; valor_anterior: string | null; valor_novo: string; alterado_por: string; alterado_em: string }` (exportada de `notasapi.ts`)
  - `fetchHistoricoConfiguracoes(limite = 20): Promise<HistoricoConfiguracao[]>`
  - `editarConfiguracao` grava no estado o `valor` **devolvido pelo backend** e **propaga** o erro (rejeita) sem mexer no estado.

- [ ] **Step 1: Write the failing test** — `frontend/src/context/ConfiguracoesContext.test.tsx`:

```tsx
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchConfiguracoes: vi.fn(),
  updateConfiguracao: vi.fn(),
  createConfiguracao: vi.fn(),
}));
vi.mock("../services/notasapi", () => api);

import { ConfiguracoesProvider, useConfiguracoes } from "./ConfiguracoesContext";

let editar: (chave: string, valor: string) => Promise<void>;

function Espiao() {
  const ctx = useConfiguracoes();
  editar = ctx.editarConfiguracao;
  return <p data-testid="meta">{ctx.configuracoes.find((c) => c.chave === "META")?.valor}</p>;
}

describe("ConfiguracoesContext", () => {
  beforeEach(() => {
    api.fetchConfiguracoes.mockResolvedValue([{ id: 1, chave: "META", valor: "1.00" }]);
  });

  it("guarda o valor normalizado que o backend devolveu, não o digitado", async () => {
    api.updateConfiguracao.mockResolvedValue({ id: 1, chave: "META", valor: "13000000.00" });
    render(<ConfiguracoesProvider><Espiao /></ConfiguracoesProvider>);
    await waitFor(() => expect(screen.getByTestId("meta")).toHaveTextContent("1.00"));

    await act(() => editar("META", "13.000.000,00"));

    expect(screen.getByTestId("meta")).toHaveTextContent("13000000.00");
  });

  it("erro do backend rejeita e não mexe no estado", async () => {
    api.updateConfiguracao.mockRejectedValue(new Error("422"));
    render(<ConfiguracoesProvider><Espiao /></ConfiguracoesProvider>);
    await waitFor(() => expect(screen.getByTestId("meta")).toHaveTextContent("1.00"));

    await expect(act(() => editar("META", "x"))).rejects.toThrow("422");
    expect(screen.getByTestId("meta")).toHaveTextContent("1.00");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/context/ConfiguracoesContext.test.tsx`
Expected: FAIL no primeiro — mostra `13.000.000,00` (o digitado).

- [ ] **Step 3: Implement**

Em `notasapi.ts`, substituir `updateConfiguracao` e acrescentar depois de `createConfiguracao`:

```ts
/** Devolve a configuração como ficou gravada: o backend normaliza o valor
 *  (a META digitada "13.000.000,00" volta "13000000.00"). */
export const updateConfiguracao = async (
  chave: string,
  valor: string,
): Promise<Configuracao> => {
  const response = await api.put<Configuracao>(`/configuracoes/${chave}`, { valor });
  return response.data;
};
```

```ts
export interface HistoricoConfiguracao {
  id: number;
  chave: string;
  /** null quando a chave foi criada. */
  valor_anterior: string | null;
  valor_novo: string;
  alterado_por: string;
  /** ISO 8601, com fuso. */
  alterado_em: string;
}

/** As últimas alterações de configuração, mais recente primeiro. Só admin. */
export const fetchHistoricoConfiguracoes = async (
  limite = 20,
): Promise<HistoricoConfiguracao[]> => {
  const response = await api.get<HistoricoConfiguracao[]>(
    "/configuracoes/historico",
    { params: { limite } },
  );
  return response.data;
};
```

Em `ConfiguracoesContext.tsx`, `editarConfiguracao`:

```ts
  // O estado recebe o valor que o backend GRAVOU (normalizado), não o digitado.
  // Erro sobe para quem chamou — a página mostra a mensagem.
  const editarConfiguracao = async (chave: string, valor: string) => {
    const gravada = await updateConfiguracao(chave, valor);
    setConfiguracoes((prev) =>
      prev.map((c) => (c.chave === chave ? { ...c, valor: gravada.valor } : c)),
    );
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx prettier --write src/context/ConfiguracoesContext.test.tsx src/services/notasapi.ts src/context/ConfiguracoesContext.tsx && npx vitest run src/context`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/notasapi.ts frontend/src/context/ConfiguracoesContext.tsx frontend/src/context/ConfiguracoesContext.test.tsx
git commit -m "feat(configuracoes): contexto guarda o valor normalizado e busca o histórico"
```

---

### Task 9: Página — Meta, Trimestre e Comemoração

**Files:**
- Create: `frontend/src/pages/configuracoes/useSalvarConfiguracao.ts`
- Create: `frontend/src/pages/configuracoes/SecaoMeta.tsx`
- Create: `frontend/src/pages/configuracoes/SecaoTrimestre.tsx`
- Create: `frontend/src/pages/configuracoes/SecaoComemoracao.tsx`
- Create: `frontend/src/pages/configuracoes/chaves.ts`
- Modify: `frontend/src/pages/Configuracoes.tsx`
- Test: `frontend/src/pages/Configuracoes.test.tsx`

**Interfaces:**
- Consumes: `useConfiguracoes().editarConfiguracao` (Task 8); `degrausDaMeta`, `parseValor` (`metaTrimestral.ts`); `trimestreEmApuracao`, `valorDoTrimestre`, `nomeDoTrimestre`, `mesesPorExtenso` (Task 4).
- Produces:
  - `useSalvarConfiguracao(chave: string, aoSalvar?: () => void): { salvar(valor: string): Promise<boolean>; salvando: boolean; erro: string | null }`
  - `mensagemDeErro(erro: unknown): string`
  - `CHAVES_DO_PAINEL: ReadonlySet<string>` = META, TRIMESTRE_APURACAO, ANIMACAO_META, MESES_ANALISE
  - Cada seção recebe `{ valor: string | undefined; aoSalvar: () => void }`.

- [ ] **Step 1: Write the failing test** — em `Configuracoes.test.tsx`, manter os testes de permissão/carregamento e o do switch (o switch continua com `role="switch"` e "Ativada"/"Desativada"); acrescentar no topo `vi.mock("../services/notasapi", () => ({ fetchHistoricoConfiguracoes: vi.fn(async () => []) }));` e os testes:

```tsx
const SEMENTE: Configuracao[] = [
  { id: 1, chave: "META", valor: "12666666.72" },
  { id: 2, chave: "TRIMESTRE_APURACAO", valor: "auto" },
  { id: 3, chave: "ANIMACAO_META", valor: "true" },
];

describe("Configuracoes — meta anual", () => {
  it("mostra a meta em reais e os degraus do trimestre", () => {
    renderConfiguracoes({ config: { configuracoes: SEMENTE } });
    expect(screen.getByLabelText("Meta anual (R$)")).toHaveValue("12.666.666,72");
    expect(screen.getByText("R$ 3.166.666,68")).toBeInTheDocument(); // ÷4
  });

  it("recalcula os degraus enquanto se digita, inclusive com R$", () => {
    renderConfiguracoes({ config: { configuracoes: SEMENTE } });
    fireEvent.change(screen.getByLabelText("Meta anual (R$)"), {
      target: { value: "R$ 12.000.000,00" },
    });
    expect(screen.getByText("R$ 3.000.000,00")).toBeInTheDocument(); // trimestre
    expect(screen.getByText("R$ 4.200.000,00")).toBeInTheDocument(); // 100% de PL
  });

  it("salva o que foi digitado", async () => {
    const { configValue } = renderConfiguracoes({ config: { configuracoes: SEMENTE } });
    fireEvent.change(screen.getByLabelText("Meta anual (R$)"), {
      target: { value: "13.000.000,00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar meta" }));
    await waitFor(() =>
      expect(configValue.editarConfiguracao).toHaveBeenCalledWith("META", "13.000.000,00"),
    );
  });

  it("erro do backend aparece e o campo mantém o digitado", async () => {
    const editarConfiguracao = vi.fn(async () => {
      throw { response: { status: 422, data: { detail: "A META precisa ser um valor em reais maior que zero." } } };
    });
    renderConfiguracoes({ config: { configuracoes: SEMENTE, editarConfiguracao } });
    fireEvent.change(screen.getByLabelText("Meta anual (R$)"), { target: { value: "0,01" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar meta" }));

    expect(
      await screen.findByText("A META precisa ser um valor em reais maior que zero."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Meta anual (R$)")).toHaveValue("0,01");
  });

  it("403 vira uma frase, não um código", async () => {
    const editarConfiguracao = vi.fn(async () => {
      throw { response: { status: 403, data: { detail: "Acesso restrito a administradores." } } };
    });
    renderConfiguracoes({ config: { configuracoes: SEMENTE, editarConfiguracao } });
    fireEvent.change(screen.getByLabelText("Meta anual (R$)"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar meta" }));
    expect(
      await screen.findByText("Só administradores podem alterar configurações."),
    ).toBeInTheDocument();
  });
});

describe("Configuracoes — trimestre em apuração", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 1));
  });
  afterEach(() => vi.useRealTimers());

  it("no automático, diz qual trimestre está valendo", () => {
    renderConfiguracoes({ config: { configuracoes: SEMENTE } });
    expect(screen.getByText("Agora: 4º trimestre de 2026 · out, nov, dez")).toBeInTheDocument();
  });

  it("fixar grava ano e trimestre", async () => {
    const { configValue } = renderConfiguracoes({ config: { configuracoes: SEMENTE } });
    fireEvent.click(screen.getByLabelText("Fixar um trimestre"));
    fireEvent.change(screen.getByLabelText("Ano"), { target: { value: "2026" } });
    fireEvent.change(screen.getByLabelText("Trimestre"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar trimestre" }));
    await waitFor(() =>
      expect(configValue.editarConfiguracao).toHaveBeenCalledWith("TRIMESTRE_APURACAO", "2026-T3"),
    );
  });

  it("voltar para o automático grava auto", async () => {
    const config = SEMENTE.map((c) =>
      c.chave === "TRIMESTRE_APURACAO" ? { ...c, valor: "2026-T3" } : c,
    );
    const { configValue } = renderConfiguracoes({ config: { configuracoes: config } });
    fireEvent.click(screen.getByLabelText("Automático (segue o calendário)"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar trimestre" }));
    await waitFor(() =>
      expect(configValue.editarConfiguracao).toHaveBeenCalledWith("TRIMESTRE_APURACAO", "auto"),
    );
  });
});
```

(importar `waitFor`, `beforeEach`, `afterEach` no topo.) Conferir no `Radio.tsx` como o `RadioGroup` liga rótulo a input (`getByLabelText` precisa do `<label htmlFor>` ou do `<label>` envolvendo); se não ligar, usar `getByRole("radio", { name: … })`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/Configuracoes.test.tsx`
Expected: FAIL — `Unable to find a label with the text of: Meta anual (R$)`.

- [ ] **Step 3: Implement**

`frontend/src/pages/configuracoes/chaves.ts`:

```ts
/** As chaves que a página trata em seção própria. Qualquer outra cai em
 *  "Usadas por outros sistemas".
 *
 *  MESES_ANALISE está aqui só para não aparecer como "de outro sistema" entre o
 *  deploy e a migração 003, que a apaga. Depois da 003, pode sair da lista. */
export const CHAVES_DO_PAINEL: ReadonlySet<string> = new Set([
  "META",
  "TRIMESTRE_APURACAO",
  "ANIMACAO_META",
  "MESES_ANALISE",
]);
```

`frontend/src/pages/configuracoes/useSalvarConfiguracao.ts`:

```ts
import { useState } from "react";

import { useConfiguracoes } from "../../context/ConfiguracoesContext";

/** A frase que a tela mostra quando gravar falha. O 422 traz a mensagem do
 *  backend pronta, em português; o resto vira frase, não código. */
export function mensagemDeErro(erro: unknown): string {
  const resposta = (erro as { response?: { status?: number; data?: { detail?: unknown } } })
    ?.response;
  if (resposta?.status === 403) return "Só administradores podem alterar configurações.";
  if (typeof resposta?.data?.detail === "string") return resposta.data.detail;
  return "Não foi possível salvar. Confira a conexão e tente de novo.";
}

/** Salva uma chave e guarda o erro para a seção mostrar. Devolve true quando
 *  gravou — a seção decide se fecha a edição. */
export function useSalvarConfiguracao(chave: string, aoSalvar?: () => void) {
  const { editarConfiguracao } = useConfiguracoes();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(valor: string): Promise<boolean> {
    setSalvando(true);
    setErro(null);
    try {
      await editarConfiguracao(chave, valor);
      aoSalvar?.();
      return true;
    } catch (e) {
      setErro(mensagemDeErro(e));
      return false;
    } finally {
      setSalvando(false);
    }
  }

  return { salvar, salvando, erro };
}
```

`frontend/src/pages/configuracoes/SecaoMeta.tsx`:

```tsx
import { useEffect, useState } from "react";

import { Alert } from "../../design-system/ui/feedback";
import { Button } from "../../design-system/ui/core/Button";
import { Card } from "../../design-system/ui/core/Card";
import { Input } from "../../design-system/ui/forms/Input";
import { degrausDaMeta, parseValor } from "../dashboard/metaTrimestral";
import { useSalvarConfiguracao } from "./useSalvarConfiguracao";

function emReais(valor: number): string {
  return `R$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "12666666.72" → "12.666.666,72": o campo mostra a meta como se lê. */
function comoSeDigita(valor: string | undefined): string {
  return parseValor(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export interface SecaoProps {
  valor: string | undefined;
  aoSalvar: () => void;
}

/** A META é ANUAL; o painel mede o trimestre. A prévia faz a divisão por 4 à
 *  vista, para ninguém gravar a meta do trimestre achando que é a do ano. */
export function SecaoMeta({ valor, aoSalvar }: SecaoProps) {
  const [rascunho, setRascunho] = useState(() => comoSeDigita(valor));
  const { salvar, salvando, erro } = useSalvarConfiguracao("META", aoSalvar);
  useEffect(() => setRascunho(comoSeDigita(valor)), [valor]);

  const degraus = degrausDaMeta(rascunho.replace("R$", ""));
  const mudou = parseValor(rascunho.replace("R$", "")) !== parseValor(valor);

  return (
    <Card padding="lg">
      <h2 className="text-lg font-semibold text-conteudo-heading">Meta anual</h2>
      <p className="mt-1 text-sm text-conteudo-muted">
        A meta do ANO. O painel divide por 4 e mede o trimestre contra três
        degraus de bonificação.
      </p>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Input
            label="Meta anual (R$)"
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            inputMode="decimal"
            spellCheck={false}
            className="font-mono"
            error={erro ?? undefined}
          />
          <div>
            <Button
              variant="primary"
              size="sm"
              disabled={!mudou || salvando}
              onClick={() => salvar(rascunho)}
            >
              Salvar meta
            </Button>
          </div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-conteudo-muted">Meta do trimestre (÷4)</dt>
          <dd className="font-mono text-conteudo">{emReais(degraus.trimestre)}</dd>
          <dt className="text-conteudo-muted">55% de PL (90%)</dt>
          <dd className="font-mono text-conteudo">{emReais(degraus.degrau55)}</dd>
          <dt className="text-conteudo-muted">85% de PL (120%)</dt>
          <dd className="font-mono text-conteudo">{emReais(degraus.degrau85)}</dd>
          <dt className="text-conteudo-muted">100% de PL (140%)</dt>
          <dd className="font-mono text-conteudo">{emReais(degraus.degrau100)}</dd>
        </dl>
      </div>
    </Card>
  );
}
```

(O `Input` com `error` já mostra a mensagem abaixo do campo — conferir em `Input.tsx` que o texto do `error` é renderizado; se não for, renderizar `{erro && <Alert variant="danger">{erro}</Alert>}` abaixo. Remover o import de `Alert` se não usar.)

`frontend/src/pages/configuracoes/SecaoTrimestre.tsx`:

```tsx
import { useEffect, useState } from "react";

import { Alert } from "../../design-system/ui/feedback";
import { Button } from "../../design-system/ui/core/Button";
import { Card } from "../../design-system/ui/core/Card";
import { RadioGroup } from "../../design-system/ui/forms/Radio";
import { Select } from "../../design-system/ui/forms/Select";
import {
  mesesPorExtenso,
  nomeDoTrimestre,
  trimestreEmApuracao,
  valorDoTrimestre,
  type NumeroDoTrimestre,
} from "../dashboard/trimestre";
import type { SecaoProps } from "./SecaoMeta";
import { useSalvarConfiguracao } from "./useSalvarConfiguracao";

const AUTO = "auto";
const FIXAR = "fixar";

/** Automático por padrão; fixar é exceção — olhar o fechamento de um trimestre
 *  que já acabou. O painel avisa enquanto estiver fixado. */
export function SecaoTrimestre({ valor, aoSalvar }: SecaoProps) {
  const hoje = new Date();
  const gravado = trimestreEmApuracao(valor, hoje);
  const calendario = trimestreEmApuracao(AUTO, hoje);

  const [modo, setModo] = useState(gravado.fixado ? FIXAR : AUTO);
  const [ano, setAno] = useState(String(gravado.ano));
  const [trimestre, setTrimestre] = useState(String(gravado.trimestre));
  const { salvar, salvando, erro } = useSalvarConfiguracao("TRIMESTRE_APURACAO", aoSalvar);

  useEffect(() => {
    setModo(gravado.fixado ? FIXAR : AUTO);
    setAno(String(gravado.ano));
    setTrimestre(String(gravado.trimestre));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  const anoAtual = hoje.getFullYear();
  const anos = [anoAtual - 1, anoAtual].map((a) => ({ value: String(a), label: String(a) }));
  const trimestres = [1, 2, 3, 4].map((t) => ({ value: String(t), label: `${t}º trimestre` }));

  const novoValor =
    modo === AUTO ? AUTO : valorDoTrimestre(Number(ano), Number(trimestre) as NumeroDoTrimestre);

  return (
    <Card padding="lg">
      <h2 className="text-lg font-semibold text-conteudo-heading">Trimestre em apuração</h2>
      <p className="mt-1 text-sm text-conteudo-muted">
        Qual trimestre o painel da meta mede.
      </p>
      <div className="mt-4 flex flex-col gap-4">
        <RadioGroup
          name="trimestre-apuracao"
          value={modo}
          onChange={setModo}
          options={[
            {
              value: AUTO,
              label: "Automático (segue o calendário)",
              hint: `Agora: ${nomeDoTrimestre(calendario)} · ${mesesPorExtenso(calendario.meses)}`,
            },
            {
              value: FIXAR,
              label: "Fixar um trimestre",
              hint: "Para olhar o fechamento de um trimestre que já acabou.",
            },
          ]}
        />
        {modo === FIXAR && (
          <div className="flex flex-wrap gap-4">
            <Select label="Ano" options={anos} value={ano} onChange={(e) => setAno(e.target.value)} />
            <Select
              label="Trimestre"
              options={trimestres}
              value={trimestre}
              onChange={(e) => setTrimestre(e.target.value)}
            />
          </div>
        )}
        {erro && <Alert variant="danger">{erro}</Alert>}
        <div>
          <Button
            variant="primary"
            size="sm"
            disabled={salvando || novoValor === (valor ?? AUTO)}
            onClick={() => salvar(novoValor)}
          >
            Salvar trimestre
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

(O teste espera o texto exato "Agora: 4º trimestre de 2026 · out, nov, dez"; se o `hint` do `RadioGroup` não renderizar como nó de texto próprio, mostrar essa linha num `<p>` abaixo do grupo.)

`frontend/src/pages/configuracoes/SecaoComemoracao.tsx`:

```tsx
import { Alert } from "../../design-system/ui/feedback";
import { Card } from "../../design-system/ui/core/Card";
import { Switch } from "../../design-system/ui/forms/Switch";
import type { SecaoProps } from "./SecaoMeta";
import { useSalvarConfiguracao } from "./useSalvarConfiguracao";

export function SecaoComemoracao({ valor, aoSalvar }: SecaoProps) {
  const { salvar, erro } = useSalvarConfiguracao("ANIMACAO_META", aoSalvar);
  const ligada = valor === "true";

  return (
    <Card padding="lg">
      <h2 className="text-lg font-semibold text-conteudo-heading">Comemoração</h2>
      <p className="mt-1 text-sm text-conteudo-muted">
        Confete no painel quando o trimestre passa de um degrau.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <Switch
          checked={ligada}
          onChange={(marcado) => salvar(marcado ? "true" : "false")}
          label={ligada ? "Ativada" : "Desativada"}
        />
        {erro && <Alert variant="danger">{erro}</Alert>}
      </div>
    </Card>
  );
}
```

Conferir em `useComemoracaoMeta.ts` o que a animação faz e ajustar a frase da descrição à verdade.

`frontend/src/pages/Configuracoes.tsx` — manter os três retornos antecipados (verificando permissões / acesso negado / carregando) e trocar o retorno principal por:

```tsx
  const valorDe = (chave: string) => configuracoes.find((c) => c.chave === chave)?.valor;

  return (
    <div className="flex flex-col gap-6 p-6">
      <Card padding="lg">
        <h1 className="mb-2 text-3xl font-bold text-conteudo-heading">Configurações</h1>
        <p className="text-conteudo-muted">Os parâmetros do painel da meta.</p>
      </Card>
      <SecaoMeta valor={valorDe("META")} aoSalvar={recarregarHistorico} />
      <SecaoTrimestre valor={valorDe("TRIMESTRE_APURACAO")} aoSalvar={recarregarHistorico} />
      <SecaoComemoracao valor={valorDe("ANIMACAO_META")} aoSalvar={recarregarHistorico} />
    </div>
  );
```

com `const [versaoHistorico, setVersaoHistorico] = useState(0); const recarregarHistorico = () => setVersaoHistorico((v) => v + 1);` (o `versaoHistorico` é consumido na Task 10). Apagar `editandoId`, `novoValor`, `iniciarEdicao`, `cancelarEdicao`, `salvarEdicao` e os imports que sobrarem. Os hooks (`useState`) ficam **antes** dos retornos antecipados.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx prettier --write src/pages/configuracoes src/pages/Configuracoes.tsx src/pages/Configuracoes.test.tsx && npx vitest run src/pages/Configuracoes.test.tsx && npx tsc -b --noEmit; rm -f tsconfig.tsbuildinfo`
Expected: PASS. (Se `tsc` reclamar de `versaoHistorico` sem uso, deixe a Task 10 consumi-lo antes do commit, ou prefixe com `_` provisoriamente.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/configuracoes frontend/src/pages/Configuracoes.tsx frontend/src/pages/Configuracoes.test.tsx
git commit -m "feat(configuracoes): seções de meta, trimestre e comemoração"
```

---

### Task 10: Página — Outros sistemas e Histórico

**Files:**
- Create: `frontend/src/pages/configuracoes/SecaoOutrosSistemas.tsx`
- Create: `frontend/src/pages/configuracoes/SecaoHistorico.tsx`
- Modify: `frontend/src/pages/Configuracoes.tsx`
- Test: `frontend/src/pages/Configuracoes.test.tsx`

**Interfaces:**
- Consumes: `CHAVES_DO_PAINEL`, `useSalvarConfiguracao` (Task 9); `fetchHistoricoConfiguracoes`, `HistoricoConfiguracao` (Task 8).
- Produces: `SecaoOutrosSistemas({ configuracoes, aoSalvar })`, `SecaoHistorico({ versao })`.

- [ ] **Step 1: Write the failing test** — trocar o mock do topo por um que o teste controla:

```tsx
const fetchHistoricoConfiguracoes = vi.hoisted(() => vi.fn(async () => [] as unknown[]));
vi.mock("../services/notasapi", () => ({ fetchHistoricoConfiguracoes }));
```

e acrescentar:

```tsx
describe("Configuracoes — outros sistemas", () => {
  it("lista as chaves que o painel não usa, com quem as lê", () => {
    renderConfiguracoes({
      config: {
        configuracoes: [
          ...SEMENTE,
          { id: 4, chave: "CFOP_VALIDOS", valor: "6102,5102" },
        ],
      },
    });
    expect(screen.getByText("Usadas por outros sistemas")).toBeInTheDocument();
    expect(screen.getByText("CFOP_VALIDOS")).toBeInTheDocument();
    expect(screen.getByText(/Lida pelo HS\.OS/)).toBeInTheDocument();
  });

  it("some quando só há chaves do painel — inclusive a MESES_ANALISE aposentada", () => {
    renderConfiguracoes({
      config: {
        configuracoes: [...SEMENTE, { id: 5, chave: "MESES_ANALISE", valor: "10,11,12" }],
      },
    });
    expect(screen.queryByText("Usadas por outros sistemas")).not.toBeInTheDocument();
  });

  it("edita uma chave de outro sistema como texto", async () => {
    const { configValue } = renderConfiguracoes({
      config: { configuracoes: [...SEMENTE, { id: 4, chave: "CFOP_VALIDOS", valor: "6102" }] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Editar CFOP_VALIDOS" }));
    fireEvent.change(screen.getByLabelText("CFOP_VALIDOS"), { target: { value: "6102,7102" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(configValue.editarConfiguracao).toHaveBeenCalledWith("CFOP_VALIDOS", "6102,7102"),
    );
  });
});

describe("Configuracoes — histórico", () => {
  it("mostra as últimas alterações", async () => {
    fetchHistoricoConfiguracoes.mockResolvedValue([
      {
        id: 1,
        chave: "META",
        valor_anterior: "12000000.00",
        valor_novo: "12666666.72",
        alterado_por: "chefe",
        alterado_em: "2026-10-01T14:30:00-03:00",
      },
    ]);
    renderConfiguracoes({ config: { configuracoes: SEMENTE } });
    expect(await screen.findByText("chefe")).toBeInTheDocument();
    expect(screen.getByText("12000000.00 → 12666666.72")).toBeInTheDocument();
  });

  it("recarrega depois de salvar", async () => {
    fetchHistoricoConfiguracoes.mockResolvedValue([]);
    renderConfiguracoes({ config: { configuracoes: SEMENTE } });
    await waitFor(() => expect(fetchHistoricoConfiguracoes).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(fetchHistoricoConfiguracoes).toHaveBeenCalledTimes(2));
  });

  it("sem alteração registrada, diz isso", async () => {
    fetchHistoricoConfiguracoes.mockResolvedValue([]);
    renderConfiguracoes({ config: { configuracoes: SEMENTE } });
    expect(await screen.findByText("Nenhuma alteração registrada ainda.")).toBeInTheDocument();
  });
});
```

(Acrescentar `beforeEach(() => fetchHistoricoConfiguracoes.mockReset().mockResolvedValue([]))` no topo dos `describe` que dependem da contagem.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/Configuracoes.test.tsx`
Expected: FAIL — "Usadas por outros sistemas" ausente.

- [ ] **Step 3: Implement**

`frontend/src/pages/configuracoes/SecaoOutrosSistemas.tsx`:

```tsx
import { useState } from "react";

import { Alert } from "../../design-system/ui/feedback";
import { Button } from "../../design-system/ui/core/Button";
import { Card } from "../../design-system/ui/core/Card";
import { Input } from "../../design-system/ui/forms/Input";
import { CHAVES_DO_PAINEL } from "./chaves";
import { useSalvarConfiguracao } from "./useSalvarConfiguracao";

/** Quem lê cada chave que o painel não usa. Chave sem nota aparece sem nota. */
const QUEM_LE: Record<string, string> = {
  CFOP_VALIDOS:
    "Lida pelo HS.OS (relatório de compradores). O painel usa a régua do dbt.",
  MARCADORES_INVALIDOS:
    "Lida pelo HS.OS (relatório de compradores). O painel usa a régua do dbt.",
};

interface Configuracao {
  id: number;
  chave: string;
  valor: string;
}

function LinhaEditavel({ cfg, aoSalvar }: { cfg: Configuracao; aoSalvar: () => void }) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(cfg.valor);
  const { salvar, salvando, erro } = useSalvarConfiguracao(cfg.chave, aoSalvar);

  return (
    <div className="flex flex-col gap-2 border-b border-borda py-4 last:border-b-0">
      {editando ? (
        <Input
          label={cfg.chave}
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          spellCheck={false}
          className="font-mono"
        />
      ) : (
        <>
          <p className="text-sm font-semibold text-conteudo-muted">{cfg.chave}</p>
          <p className="whitespace-pre-line break-words font-mono text-sm text-conteudo">
            {cfg.valor}
          </p>
        </>
      )}
      {QUEM_LE[cfg.chave] && <p className="text-xs text-conteudo-faint">{QUEM_LE[cfg.chave]}</p>}
      {erro && <Alert variant="danger">{erro}</Alert>}
      <div className="flex gap-2">
        {editando ? (
          <>
            <Button
              variant="success"
              size="sm"
              disabled={salvando}
              onClick={async () => {
                if (await salvar(rascunho)) setEditando(false);
              }}
            >
              Salvar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setRascunho(cfg.valor);
                setEditando(false);
              }}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            aria-label={`Editar ${cfg.chave}`}
            onClick={() => {
              setRascunho(cfg.valor);
              setEditando(true);
            }}
          >
            Editar
          </Button>
        )}
      </div>
    </div>
  );
}

/** Chaves que estão no banco mas não são do painel. Some quando não há nenhuma. */
export function SecaoOutrosSistemas({
  configuracoes,
  aoSalvar,
}: {
  configuracoes: Configuracao[];
  aoSalvar: () => void;
}) {
  const outras = configuracoes.filter((c) => !CHAVES_DO_PAINEL.has(c.chave));
  if (outras.length === 0) return null;

  return (
    <Card padding="lg">
      <h2 className="text-lg font-semibold text-conteudo-heading">Usadas por outros sistemas</h2>
      <p className="mt-1 text-sm text-conteudo-muted">
        Ficam nesta tabela, mas o painel não as lê. Mudar aqui afeta quem as usa.
      </p>
      <div className="mt-2">
        {outras.map((cfg) => (
          <LinhaEditavel key={cfg.id} cfg={cfg} aoSalvar={aoSalvar} />
        ))}
      </div>
    </Card>
  );
}
```

`frontend/src/pages/configuracoes/SecaoHistorico.tsx`:

```tsx
import { useEffect, useState } from "react";

import { Card } from "../../design-system/ui/core/Card";
import {
  fetchHistoricoConfiguracoes,
  type HistoricoConfiguracao,
} from "../../services/notasapi";

function quando(instante: string): string {
  return new Date(instante).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** As últimas 20 alterações. `versao` muda a cada gravação da página — é o
 *  sinal para buscar de novo. */
export function SecaoHistorico({ versao }: { versao: number }) {
  const [linhas, setLinhas] = useState<HistoricoConfiguracao[] | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetchHistoricoConfiguracoes(20)
      .then((h) => vivo && (setLinhas(h), setFalhou(false)))
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
    };
  }, [versao]);

  return (
    <Card padding="lg">
      <h2 className="text-lg font-semibold text-conteudo-heading">Histórico</h2>
      {falhou ? (
        <p className="mt-2 text-sm text-conteudo-muted">Não foi possível carregar o histórico.</p>
      ) : linhas === null ? (
        <p className="mt-2 text-sm text-conteudo-muted">Carregando…</p>
      ) : linhas.length === 0 ? (
        <p className="mt-2 text-sm text-conteudo-muted">Nenhuma alteração registrada ainda.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-conteudo-faint">
              <tr>
                <th className="py-2 pr-4">Quando</th>
                <th className="py-2 pr-4">Quem</th>
                <th className="py-2 pr-4">Chave</th>
                <th className="py-2">Alteração</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((h) => (
                <tr key={h.id} className="border-t border-borda">
                  <td className="py-2 pr-4 whitespace-nowrap text-conteudo-muted">{quando(h.alterado_em)}</td>
                  <td className="py-2 pr-4 text-conteudo">{h.alterado_por}</td>
                  <td className="py-2 pr-4 font-mono text-conteudo">{h.chave}</td>
                  <td className="py-2 font-mono break-all text-conteudo">
                    {`${h.valor_anterior ?? "(criada)"} → ${h.valor_novo}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
```

Em `Configuracoes.tsx`, depois de `<SecaoComemoracao …/>`:

```tsx
      <SecaoOutrosSistemas configuracoes={configuracoes} aoSalvar={recarregarHistorico} />
      <SecaoHistorico versao={versaoHistorico} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx prettier --write src/pages/configuracoes src/pages/Configuracoes.tsx src/pages/Configuracoes.test.tsx && npx vitest run && npx tsc -b --noEmit && rm -f tsconfig.tsbuildinfo && npx eslint src/pages/configuracoes src/pages/Configuracoes.tsx`
Expected: suíte inteira verde, sem erro de tipo ou lint.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/configuracoes frontend/src/pages/Configuracoes.tsx frontend/src/pages/Configuracoes.test.tsx
git commit -m "feat(configuracoes): seções de outros sistemas e histórico"
```

---

### Task 11: Documentação e verificação final

**Files:**
- Modify: `backend/README.md` — seção de migrations do `tiny`: `scripts/migrar_tiny.sh` e a ordem 002 → deploy → 003.
- Modify: `backend/CLAUDE.md` — na linha "Mudança de DDL vira SQL manual em `migrations/`", acrescentar "rodado por `scripts/migrar_tiny.sh <arquivo>`".

- [ ] **Step 1: Escrever a doc** — no `backend/README.md`, na seção que fala de `migrations/` (procurar por `001_add_cancelada_column`), acrescentar:

```markdown
### Migrations do schema `tiny`

SQL manual em `migrations/`, rodado no Konsole com o superusuário do cadastro central:

    bash scripts/migrar_tiny.sh 002_configuracoes_historico.sql

Ordem da entrega de Configurações (out/2026): `002` → deploy do backend e do front → `003`.
A `002` cria `tiny.configuracoes_historico` (o backend novo grava nela em todo `PUT`) e a
chave `TRIMESTRE_APURACAO`; a `003` apaga `MESES_ANALISE`, que o front antigo ainda lê.
```

- [ ] **Step 2: Verificação completa**

Run:
```bash
cd backend && .venv/bin/pytest -q && cd ../frontend && npx vitest run && npx tsc -b --noEmit && rm -f tsconfig.tsbuildinfo && npx prettier --check src && cd .. && scripts/varrer.sh
```
Expected: tudo verde; `varrer.sh` → `OK: nada encontrado`.

- [ ] **Step 3: Commit**

```bash
git add backend/README.md backend/CLAUDE.md
git commit -m "docs(configuracoes): migrations do tiny e a ordem de deploy"
```

- [ ] **Step 4: Entregar ao Erick (não executar)** — push só com o ok dele. Passo a passo para ele:
  1. Konsole: `cd ~/github/DataCore/backend && bash scripts/migrar_tiny.sh 002_configuracoes_historico.sql`
  2. EasyPanel: Implantar `datacore-api` e `datacore-sistema`.
  3. Abrir Configurações como admin, alternar a comemoração duas vezes → duas linhas no histórico (prova de permissão da tabela).
  4. Konsole: `bash scripts/migrar_tiny.sh 003_aposentar_meses_analise.sql`
  5. Entregar a seção 4 da spec à sessão do HS.OS (`cl HS.OS`).
