# Inadimplência — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** página `/inadimplencia` com a aba Cobrança (lista de empresas devedoras, modal com títulos e registro de cobrança) e a aba Indicadores (taxa de inadimplência mensal, anual e total), com o controle de cobrança gravado no banco e atualizado sozinho a cada carga de contas.

**Architecture:** três tabelas novas em `tiny` (migração SQL rodada pelo Erick), consultas agregadas no banco em `app/core/inadimplencia.py`, regras de escrita e sincronização em `app/services/cobranca.py` (chamada no fim do job `extrair_contas`), roteador `/inadimplencia` restrito a admin e financeiro. No front, `pages/Inadimplencia.tsx` + `pages/inadimplencia/`, no mesmo desenho de `pages/contas/`.

**Tech Stack:** FastAPI + SQLAlchemy `text()` + Postgres 18; pytest com o Postgres de `docker-compose.test.yml`; React + TypeScript + Tailwind + design system próprio; Vitest + Testing Library; Recharts.

**Spec:** `docs/superpowers/specs/2026-10-09-inadimplencia-design.md` — ler antes de começar.

## Global Constraints

- Código, comentários, interface e mensagem de commit em **português do Brasil**.
- **Repo público:** nada de nome de cliente, CNPJ real, valor real, senha, IP ou string de conexão — nem em teste, nem em `.md`. Fixtures usam empresas fictícias ("Alfa Ltda", CNPJ `11.111.111/0001-11`). Antes de todo push: `bash scripts/varrer.sh`. `git add` por caminho, nunca `-A`.
- Bancos da empresa só por `bancos.consultar("datacore", sql)` (leitura). Nunca ler `.env` nem `admin.toml`.
- SQL em `text()`: **nunca** o cast `::` — sempre `CAST(x AS tipo)` (os dois-pontos viram bind param). Vale dentro de comentário também.
- A imagem do backend roda **Python 3.11**: nada de f-string com aspas iguais aninhadas ou backslash dentro da expressão.
- `CARENCIA_DIAS = 30`. Base = `tiny.contas_receber` com `excluida_na_origem_em IS NULL` e situação fora de `SITUACOES_CANCELADAS`. Quitada = situação em `QUITADAS_A_RECEBER`. Em aberto = não quitada.
- Empresa = 8 primeiros dígitos de CNPJ de 14 dígitos; CPF de 11 dígitos inteiro; senão `nome:` + `lower(trim(cliente_nome))`.
- Status: `sem_contato, em_contato, respondeu, promessa, quebrada, negociacao, contestado, juridico, perda, pago`. Só o sistema põe `sem_contato`, `quebrada`, `pago`.
- `tiny.cobranca_eventos` só recebe INSERT.
- Todas as rotas `/inadimplencia` exigem papel `admin` ou `financeiro` **no backend**.
- Testes de backend rodam de `backend/` com o Postgres de teste no ar: `docker compose -f docker-compose.test.yml up -d --wait` e `.venv/bin/pytest`. Testes de front rodam de `frontend/`: `npx vitest run`.

## Review Focus

1. **Empresa com o mesmo CNPJ escrito de jeitos diferentes** (`11.111.111/0001-11` e `11111111000111`) tem de cair numa empresa só e numa filial só — teste em Task 2.
2. **Mês corrente e mês que acabou de fechar**: o mês cujo `último dia + 30 > hoje` tem de vir `em_apuracao = true` e nunca entrar em "último mês fechado" nem na média de 12 meses — teste em Task 2.
3. **Sincronização rodando duas vezes seguidas** (timer + botão "Atualizar dados agora") não pode abrir ciclo duplicado nem duplicar evento de "promessa quebrada" — teste em Task 3.
4. **Usuário `vendas`/`comum` chamando a API direto** (sem passar pela tela) leva 403 em leitura e escrita — teste em Task 4.
5. **Gravação que falha no modal** (rede, 422) mostra a mensagem do backend dentro do modal e não perde o que foi digitado — teste em Task 9.

---

## Mapa de arquivos

**Backend (`backend/`)**

| Arquivo | Responsabilidade |
|---|---|
| `migrations/013_cobranca.sql` (novo) | as três tabelas, índices e permissões |
| `app/core/inadimplencia.py` (novo) | constantes, CTE base, consultas de leitura (resumo, empresas, detalhe, títulos, indicadores) e seus modelos Pydantic |
| `app/services/cobranca.py` (novo) | escrita: `sincronizar`, `registrar_evento`, `gravar_observacao` |
| `app/core/security.py` | + `exigir_papeis(*papeis)` |
| `app/api/endpoints/inadimplencia.py` (novo) | o roteador `/inadimplencia` |
| `app/api/endpoints/__init__.py`, `app/main.py` | registrar o roteador |
| `app/jobs/extrair_contas.py` | chamar `sincronizar` no fim da carga |
| `tests/semente_contas.py` (novo) | fixture que cria `tiny.contas_receber` e insere títulos |
| `tests/test_inadimplencia_migracao.py`, `tests/test_inadimplencia_consultas.py`, `tests/test_cobranca_sincronizar.py`, `tests/test_inadimplencia_api.py` (novos) | testes |

**Frontend (`frontend/src/`)**

| Arquivo | Responsabilidade |
|---|---|
| `services/inadimplencia.ts` (novo) | tipos e chamadas HTTP |
| `pages/inadimplencia/inadimplencia.ts` (novo) | regra pura: rótulos e cores de status, faixas, `diasDeAtraso`, `haQuantosDias`, linhas da planilha |
| `pages/inadimplencia/useInadimplencia.ts` (novo) | hooks de busca (padrão de `pages/contas/useContas.ts`) |
| `pages/Inadimplencia.tsx` (novo) | a página: cabeçalho + abas |
| `pages/inadimplencia/AbaCobranca.tsx` (novo) | cards, barra de faixas, filtros, lista |
| `pages/inadimplencia/TabelaDeEmpresas.tsx` (novo) | a lista, no padrão de `TabelaDeContas` |
| `pages/inadimplencia/ModalDaEmpresa.tsx` (novo) | o modal: cabeçalho, observação, abas |
| `pages/inadimplencia/TitulosDaEmpresa.tsx` (novo) | aba Títulos do modal |
| `pages/inadimplencia/LinhaDoTempo.tsx` (novo) | aba Cobrança do modal |
| `pages/inadimplencia/FormularioDeContato.tsx` (novo) | o formulário "Registrar contato" |
| `pages/inadimplencia/AbaIndicadores.tsx` (novo) | cards, gráfico mensal, anual, "como ler" |
| `pages/inadimplencia/servidorFalso.ts` (novo) | dublê do serviço para os testes de tela |
| `pages/contas/TabelaDeContas.tsx` | exportar `SeloDeSituacao` |
| `auth/permissoes.ts`, `router.tsx`, `components/Sidebar.tsx` | rota, guarda e menu |
| `pages/Inadimplencia.test.tsx`, `pages/inadimplencia/inadimplencia.test.ts` (novos), `auth/permissoes.test.ts`, `auth/acesso-atual.test.tsx`, `components/Sidebar.test.tsx` | testes |

---

### Task 1: Migração `013_cobranca.sql`

**Files:**
- Create: `backend/migrations/013_cobranca.sql`
- Create: `backend/tests/test_inadimplencia_migracao.py`

**Interfaces:**
- Produces: tabelas `tiny.cobranca_ciclos`, `tiny.cobranca_eventos`, `tiny.cobranca_empresas` com as colunas abaixo (Tasks 3–5 escrevem nelas pelos nomes exatos).

- [ ] **Step 1: Escrever o teste que falha**

```python
"""Migração 013: tabelas da cobrança, idempotência e permissões.

Roda o mesmo SQL que vai para o Konsole, por cima de um `tiny.configuracoes` com a
permissão que a aplicação tem em produção — a 013 copia as permissões de lá.
"""
from pathlib import Path

import pytest
from sqlalchemy import text

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"


def rodar_migracao(engine, arquivo):
    bruta = engine.raw_connection()
    try:
        with bruta.cursor() as cur:
            cur.execute((MIGRATIONS / arquivo).read_text())
        bruta.commit()
    finally:
        bruta.close()


@pytest.fixture(scope="module", autouse=True)
def base(engine):
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS tiny.cobranca_eventos, tiny.cobranca_ciclos, tiny.cobranca_empresas"))
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS tiny.configuracoes ("
            " id serial PRIMARY KEY, chave varchar NOT NULL UNIQUE, valor varchar NOT NULL)"
        ))
        conn.execute(text("GRANT SELECT, UPDATE, INSERT ON tiny.configuracoes TO app_teste"))
    rodar_migracao(engine, "013_cobranca.sql")


def test_cria_as_tres_tabelas(engine):
    with engine.connect() as conn:
        nomes = set(conn.execute(text(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'tiny'"
        )).scalars())
    assert {"cobranca_ciclos", "cobranca_eventos", "cobranca_empresas"} <= nomes


def test_e_idempotente(engine):
    rodar_migracao(engine, "013_cobranca.sql")


def test_um_ciclo_aberto_por_empresa(engine):
    from sqlalchemy.exc import IntegrityError

    with engine.begin() as conn:
        conn.execute(text("TRUNCATE tiny.cobranca_eventos, tiny.cobranca_ciclos RESTART IDENTITY CASCADE"))
        conn.execute(text("INSERT INTO tiny.cobranca_ciclos (empresa, status, aberto_por) VALUES ('11111111', 'sem_contato', 'sistema')"))
    with pytest.raises(IntegrityError):
        with engine.begin() as conn:
            conn.execute(text("INSERT INTO tiny.cobranca_ciclos (empresa, status, aberto_por) VALUES ('11111111', 'em_contato', 'x')"))
    with engine.begin() as conn:  # depois de encerrado, abre outro
        conn.execute(text("UPDATE tiny.cobranca_ciclos SET encerrado_em = now()"))
        conn.execute(text("INSERT INTO tiny.cobranca_ciclos (empresa, status, aberto_por) VALUES ('11111111', 'em_contato', 'x')"))


def test_quem_escreve_em_configuracoes_escreve_na_cobranca_mas_nao_apaga_evento(engine):
    with engine.connect() as conn:
        p = conn.execute(text(
            "SELECT has_table_privilege('app_teste', 'tiny.cobranca_ciclos', 'INSERT'),"
            "       has_table_privilege('app_teste', 'tiny.cobranca_ciclos', 'UPDATE'),"
            "       has_table_privilege('app_teste', 'tiny.cobranca_eventos', 'INSERT'),"
            "       has_table_privilege('app_teste', 'tiny.cobranca_eventos', 'UPDATE'),"
            "       has_table_privilege('app_teste', 'tiny.cobranca_eventos', 'DELETE'),"
            "       has_table_privilege('app_teste', 'tiny.cobranca_empresas', 'DELETE')"
        )).one()
    assert p == (True, True, True, False, False, True)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && .venv/bin/pytest tests/test_inadimplencia_migracao.py -v`
Expected: FAIL — `FileNotFoundError: .../013_cobranca.sql`

- [ ] **Step 3: Escrever a migração**

```sql
-- Cobrança da inadimplência: ciclos, linha do tempo e observação fixa por empresa.
-- Roda ANTES do deploy do backend novo.
-- Uso (Konsole, superusuário): bash backend/scripts/migrar_tiny.sh 013_cobranca.sql
-- Spec: docs/superpowers/specs/2026-10-09-inadimplencia-design.md

CREATE TABLE IF NOT EXISTS tiny.cobranca_ciclos (
    id                 bigserial PRIMARY KEY,
    empresa            text        NOT NULL,
    status             text        NOT NULL,
    promessa_data      date,
    promessa_valor     numeric(14,2),
    promessa_condicoes text,
    aberto_em          timestamptz NOT NULL DEFAULT now(),
    aberto_por         text        NOT NULL,
    encerrado_em       timestamptz,
    ultimo_contato_em  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS cobranca_ciclos_um_aberto
    ON tiny.cobranca_ciclos (empresa) WHERE encerrado_em IS NULL;

CREATE TABLE IF NOT EXISTS tiny.cobranca_eventos (
    id                 bigserial PRIMARY KEY,
    ciclo_id           bigint      NOT NULL REFERENCES tiny.cobranca_ciclos(id),
    ocorrido_em        timestamptz NOT NULL,
    registrado_em      timestamptz NOT NULL DEFAULT now(),
    registrado_por     text        NOT NULL,
    tipo               text        NOT NULL,
    canal              text,
    filial_cnpj        text,
    status_anterior    text,
    status_novo        text,
    promessa_data      date,
    promessa_valor     numeric(14,2),
    promessa_condicoes text,
    anotacao           text,
    valor_inadimplente numeric(14,2)
);
CREATE INDEX IF NOT EXISTS cobranca_eventos_ciclo
    ON tiny.cobranca_eventos (ciclo_id, ocorrido_em DESC);

CREATE TABLE IF NOT EXISTS tiny.cobranca_empresas (
    empresa      text PRIMARY KEY,
    observacao   text        NOT NULL,
    alterado_por text        NOT NULL,
    alterado_em  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tiny.cobranca_ciclos IS
    'Uma cobrança de uma empresa (raiz do CNPJ), do primeiro atraso até a dívida acabar.';
COMMENT ON TABLE tiny.cobranca_eventos IS
    'Linha do tempo da cobrança. Só INSERT: nada é editado nem apagado.';
COMMENT ON TABLE tiny.cobranca_empresas IS
    'Observação fixa por empresa — vale para todos os ciclos dela.';

-- As permissões copiam as de tiny.configuracoes, como na 002: quem escreve lá escreve
-- aqui; quem só lê lá só lê aqui. Evento não tem UPDATE nem DELETE para ninguém.
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT rolname FROM pg_roles
         WHERE NOT rolsuper AND rolname NOT LIKE 'pg\_%'
    LOOP
        IF has_table_privilege(r.rolname, 'tiny.configuracoes', 'UPDATE') THEN
            EXECUTE format('GRANT SELECT, INSERT, UPDATE ON tiny.cobranca_ciclos TO %I', r.rolname);
            EXECUTE format('GRANT SELECT, INSERT ON tiny.cobranca_eventos TO %I', r.rolname);
            EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON tiny.cobranca_empresas TO %I', r.rolname);
            EXECUTE format('GRANT USAGE ON SEQUENCE tiny.cobranca_ciclos_id_seq, tiny.cobranca_eventos_id_seq TO %I', r.rolname);
        ELSIF has_table_privilege(r.rolname, 'tiny.configuracoes', 'SELECT') THEN
            EXECUTE format('GRANT SELECT ON tiny.cobranca_ciclos, tiny.cobranca_eventos, tiny.cobranca_empresas TO %I', r.rolname);
        END IF;
    END LOOP;
END $$;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && .venv/bin/pytest tests/test_inadimplencia_migracao.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/migrations/013_cobranca.sql backend/tests/test_inadimplencia_migracao.py
git commit -m "feat(inadimplencia): migracao 013 com as tabelas da cobranca"
```

---

### Task 2: Consultas de leitura — `app/core/inadimplencia.py`

**Files:**
- Create: `backend/tests/semente_contas.py`
- Create: `backend/app/core/inadimplencia.py`
- Create: `backend/tests/test_inadimplencia_consultas.py`

**Interfaces:**
- Consumes: `QUITADAS_A_RECEBER`, `SITUACOES_CANCELADAS`, `SITUACOES_QUE_NAO_VENCEM`, `COLUNAS_DA_TELA`, `ContaDaTela` de `app.core.contas_agregado`; tabelas da Task 1.
- Produces (usados pelas Tasks 3–5):
  - `CARENCIA_DIAS: int = 30`
  - `FAIXAS: dict[str, tuple[int, int | None]]` — `{"atraso": (1, 30), "31_60": (31, 60), "61_90": (61, 90), "90_mais": (91, None)}`
  - `ORDENACOES_DE_EMPRESAS: dict[str, str]`
  - `params_base(hoje: date) -> dict`
  - `SQL_BASE: str` — abre `WITH` e define as CTEs `titulos`, `t` (com `empresa`, `doc`, `em_aberto`, `atraso`) e `empresas` (`empresa, nome, filiais, cnpj_unico, titulos, valor_vencido, valor_inadimplente, maior_atraso`)
  - `documento_exibido(empresa: str, filiais: int, cnpj_unico: str | None) -> str | None`
  - `resumo(db, hoje) -> ResumoDeInadimplencia`
  - `pagina_de_empresas(db, hoje, *, busca, status, faixa, incluir_atraso, ordenar_por, direcao, limite, offset) -> PaginaDeEmpresas`
  - `detalhe_da_empresa(db, hoje, empresa) -> DetalheDaEmpresa | None`
  - `titulos_da_empresa(db, hoje, empresa) -> list[ContaDaTela]`
  - `indicadores(db, hoje) -> Indicadores`
  - `filiais_da_empresa(db, empresa) -> set[str]` (dígitos dos CNPJs que já apareceram em qualquer título da empresa)
  - `valores_da_empresa(db, hoje, empresa) -> dict | None` (`valor_vencido`, `valor_inadimplente`, `maior_atraso`)

- [ ] **Step 1: Escrever a semente de teste**

`backend/tests/semente_contas.py`:

```python
"""Uma `tiny.contas_receber` mínima para os testes de inadimplência.

Só as colunas que as consultas leem, com os tipos de produção. Empresas fictícias —
o repo é público.
"""
from datetime import date, timedelta
from itertools import count

import pytest
from sqlalchemy import text

_ids = count(1)

DDL = """
CREATE TABLE tiny.contas_receber (
    id bigserial PRIMARY KEY,
    id_tiny bigint UNIQUE NOT NULL,
    data date NOT NULL,
    vencimento date NOT NULL,
    valor numeric(15,2) NOT NULL,
    saldo numeric(15,2) NOT NULL,
    situacao varchar(500),
    liquidacao date,
    categoria varchar(500),
    nro_documento varchar(500),
    historico varchar(500),
    forma_pagamento varchar(500),
    portador varchar(500),
    ocorrencia char(1) NOT NULL DEFAULT 'U',
    cliente_nome varchar(500) NOT NULL,
    cliente_cpf_cnpj varchar(500),
    cliente_cidade varchar(500),
    cliente_uf varchar(500),
    cliente_fone varchar(500),
    cliente_email varchar(500),
    excluida_na_origem_em timestamp
)
"""


@pytest.fixture(scope="module")
def tabela_contas(engine):
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS tiny.contas_receber"))
        conn.execute(text(DDL))
        conn.execute(text("GRANT SELECT ON tiny.contas_receber TO app_teste"))
    return engine


@pytest.fixture
def contas(tabela_contas):
    """`contas(...)` insere um título; os dias são relativos a HOJE."""
    with tabela_contas.begin() as conn:
        conn.execute(text("TRUNCATE tiny.contas_receber RESTART IDENTITY"))

    def _inserir(*, nome="Alfa Ltda", doc="11.111.111/0001-11", venceu_ha=40,
                 valor=1000, saldo=None, situacao="aberto", pago_dias_depois=None,
                 emissao_ha=None, excluida=False, hoje=None):
        hoje = hoje or date.today()
        vencimento = hoje - timedelta(days=venceu_ha)
        liquidacao = None
        if pago_dias_depois is not None:
            situacao = "pago"
            liquidacao = vencimento + timedelta(days=pago_dias_depois)
        if saldo is None:
            saldo = 0 if situacao == "pago" else valor
        i = next(_ids)
        with tabela_contas.begin() as conn:
            conn.execute(text(
                "INSERT INTO tiny.contas_receber (id_tiny, data, vencimento, valor, saldo, situacao,"
                " liquidacao, cliente_nome, cliente_cpf_cnpj, cliente_fone, cliente_email,"
                " excluida_na_origem_em)"
                " VALUES (:i, :e, :v, :valor, :saldo, :s, :l, :n, :d, '(11) 0000-0000',"
                " 'financeiro@exemplo.com', :x)"
            ), {"i": 100000 + i, "e": vencimento - timedelta(days=emissao_ha or 10),
                "v": vencimento, "valor": valor, "saldo": saldo, "s": situacao,
                "l": liquidacao, "n": nome, "d": doc,
                "x": date.today() if excluida else None})
    return _inserir
```

- [ ] **Step 2: Escrever os testes das consultas (falham)**

`backend/tests/test_inadimplencia_consultas.py`:

```python
from datetime import date, timedelta

import pytest
from sqlalchemy.orm import Session

from sqlalchemy import text

from tests.semente_contas import contas, tabela_contas  # noqa: F401
from tests.test_inadimplencia_migracao import rodar_migracao

HOJE = date.today()


@pytest.fixture(scope="module", autouse=True)
def tabelas_de_cobranca(engine):
    # As consultas fazem LEFT JOIN nas tabelas da cobrança: o módulo não pode depender
    # da ordem em que o pytest roda os arquivos.
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS tiny.configuracoes ("
            " id serial PRIMARY KEY, chave varchar NOT NULL UNIQUE, valor varchar NOT NULL)"))
    rodar_migracao(engine, "013_cobranca.sql")
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE tiny.cobranca_eventos, tiny.cobranca_ciclos, tiny.cobranca_empresas RESTART IDENTITY CASCADE"))


@pytest.fixture
def db(engine):
    with Session(engine) as sessao:
        yield sessao


def _pagina(db, **kw):
    from app.core.inadimplencia import pagina_de_empresas

    padrao = dict(busca=None, status=None, faixa=None, incluir_atraso=False,
                  ordenar_por="valor", direcao="desc", limite=15, offset=0)
    padrao.update(kw)
    return pagina_de_empresas(db, HOJE, **padrao)


def test_filiais_e_grafias_do_mesmo_cnpj_viram_uma_empresa(db, contas):
    contas(nome="Alfa Ltda - Cidade A", doc="11.111.111/0001-11", venceu_ha=40, valor=100)
    contas(nome="ALFA LTDA", doc="11111111000111", venceu_ha=50, valor=200)
    contas(nome="Alfa Ltda - Cidade B", doc="11.111.111/0002-02", venceu_ha=60, valor=300)
    p = _pagina(db)
    assert p.total == 1
    e = p.itens[0]
    assert e.empresa == "11111111"
    assert e.filiais == 2
    assert e.titulos == 3
    assert e.valor_devido == 600
    assert e.maior_atraso == 60
    assert e.documento == "11.111.111 · 2 filiais"


def test_uma_filial_so_mostra_o_cnpj_completo(db, contas):
    contas(doc="11111111000111", venceu_ha=40)
    assert _pagina(db).itens[0].documento == "11.111.111/0001-11"


def test_cpf_e_documento_vazio(db, contas):
    contas(nome="Pessoa Física", doc="00000000191", venceu_ha=40)
    contas(nome=" Sem Documento ", doc="", venceu_ha=40)
    chaves = {e.empresa for e in _pagina(db).itens}
    assert chaves == {"00000000191", "nome:sem documento"}


def test_cancelada_excluida_e_quitada_nao_entram(db, contas):
    contas(situacao="cancelada", venceu_ha=40)
    contas(excluida=True, venceu_ha=40)
    contas(pago_dias_depois=2, venceu_ha=40)
    assert _pagina(db).total == 0


def test_so_atraso_fica_fora_a_menos_que_peca(db, contas):
    contas(venceu_ha=10)
    assert _pagina(db).total == 0
    assert _pagina(db, incluir_atraso=True).total == 1


def test_carencia_de_30_dias_e_inclusiva_no_atraso(db, contas):
    from app.core.inadimplencia import resumo

    contas(venceu_ha=30, valor=100)   # ainda atraso
    contas(venceu_ha=31, valor=200)   # inadimplente
    r = resumo(db, HOJE)
    assert r.em_atraso == 100
    assert r.inadimplente == 200
    assert r.total_vencido == 300


def test_faixa_filtra_por_titulo_na_faixa(db, contas):
    contas(doc="11111111000111", venceu_ha=40)
    contas(doc="22222222000122", venceu_ha=100)
    assert {e.empresa for e in _pagina(db, faixa="31_60").itens} == {"11111111"}
    assert {e.empresa for e in _pagina(db, faixa="90_mais").itens} == {"22222222"}


def test_busca_por_nome_e_por_cnpj_com_e_sem_pontuacao(db, contas):
    contas(nome="Alfa Ltda", doc="11111111000111", venceu_ha=40)
    contas(nome="Beta SA", doc="22222222000122", venceu_ha=40)
    assert [e.nome for e in _pagina(db, busca="beta").itens] == ["Beta SA"]
    assert [e.nome for e in _pagina(db, busca="22.222.222").itens] == ["Beta SA"]
    assert [e.nome for e in _pagina(db, busca="22222222").itens] == ["Beta SA"]


def test_status_sem_ciclo_e_sem_contato(db, contas):
    contas(venceu_ha=40)
    assert _pagina(db).itens[0].status == "sem_contato"
    assert _pagina(db, status=["sem_contato"]).total == 1
    assert _pagina(db, status=["promessa"]).total == 0


def test_resumo_faixas_e_carteira(db, contas):
    from app.core.inadimplencia import resumo

    contas(doc="11111111000111", venceu_ha=10, valor=100)
    contas(doc="11111111000111", venceu_ha=45, valor=200)
    contas(doc="22222222000122", venceu_ha=-5, valor=700)   # a vencer
    r = resumo(db, HOJE)
    assert r.total_a_receber == 1000
    assert r.inadimplencia_carteira == pytest.approx(0.2)
    faixas = {f.faixa: (f.titulos, f.empresas, f.valor) for f in r.faixas}
    assert faixas["atraso"] == (1, 1, 100)
    assert faixas["31_60"] == (1, 1, 200)
    assert faixas["90_mais"] == (0, 0, 0)


def test_safra_conta_pago_depois_de_30_dias_e_nao_conta_pago_em_dia(db, contas):
    from app.core.inadimplencia import indicadores

    contas(venceu_ha=200, valor=100, pago_dias_depois=5)    # em dia
    contas(venceu_ha=200, valor=300, pago_dias_depois=31)   # inadimplente, pago depois
    contas(venceu_ha=200, valor=600)                         # inadimplente, em aberto
    i = indicadores(db, HOJE)
    assert i.total.valor == 1000
    assert i.total.inadimplente == 900
    assert i.total.taxa == pytest.approx(0.9)


def test_titulo_ainda_nao_maduro_fica_fora_da_safra(db, contas):
    from app.core.inadimplencia import indicadores

    contas(venceu_ha=29, valor=100)
    assert indicadores(db, HOJE).total.valor == 0


def test_mes_em_apuracao_nao_entra_no_ultimo_fechado_nem_na_media(db, contas):
    from app.core.inadimplencia import indicadores

    # um título maduro no mês passado: o mês passado só fecha 30 dias depois do fim dele
    inicio_mes = HOJE.replace(day=1)
    fim_mes_passado = inicio_mes - timedelta(days=1)
    contas(venceu_ha=(HOJE - fim_mes_passado.replace(day=1)).days, valor=100)
    contas(venceu_ha=400, valor=100)  # mês velho, fechado
    i = indicadores(db, HOJE)
    passado = [m for m in i.mensal if m.mes == fim_mes_passado.strftime("%Y-%m")]
    if passado:  # só existe se o título já está maduro
        assert passado[0].em_apuracao == (fim_mes_passado + timedelta(days=30) > HOJE)
    assert i.ultimo_fechado is not None
    assert not i.ultimo_fechado.em_apuracao


def test_recuperado(db, contas):
    from app.core.inadimplencia import resumo

    contas(venceu_ha=200, valor=300, pago_dias_depois=40)  # atrasou e pagou
    contas(venceu_ha=200, valor=100)                        # atrasou e não pagou
    r = resumo(db, HOJE)
    assert r.recuperado == pytest.approx(0.75)


def test_titulos_da_empresa_traz_vencidos_e_a_vencer_no_formato_da_tela(db, contas):
    from app.core.inadimplencia import titulos_da_empresa

    contas(doc="11111111000111", venceu_ha=40)
    contas(doc="11111111000222", venceu_ha=-10)
    contas(doc="22222222000122", venceu_ha=40)
    t = titulos_da_empresa(db, HOJE, "11111111")
    assert len(t) == 2
    assert {c.vencida for c in t} == {True, False}


def test_detalhe(db, contas):
    from app.core.inadimplencia import detalhe_da_empresa

    contas(nome="Alfa - A", doc="11111111000111", venceu_ha=40, valor=100)
    contas(nome="Alfa - B", doc="11111111000222", venceu_ha=50, valor=200)
    d = detalhe_da_empresa(db, HOJE, "11111111")
    assert d.valor_devido == 300
    assert [f.cnpj for f in d.filiais] == ["11111111000222", "11111111000111"]
    assert d.telefone == "(11) 0000-0000"
    assert d.ciclo is None and d.eventos == []
    assert detalhe_da_empresa(db, HOJE, "99999999") is None
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && .venv/bin/pytest tests/test_inadimplencia_consultas.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.core.inadimplencia'`

- [ ] **Step 4: Implementar `app/core/inadimplencia.py`**

```python
"""Inadimplência: as consultas de leitura da página, somadas no banco.

Spec: docs/superpowers/specs/2026-10-09-inadimplencia-design.md

As definições — empresa, faixas, carência e taxa de safra — moram aqui e em nenhum
outro lugar. A tela recebe tudo somado, como em `contas_agregado.py` (item 9.4).
"""
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.contas_agregado import (
    COLUNAS_DA_TELA,
    QUITADAS_A_RECEBER,
    SITUACOES_CANCELADAS,
    SITUACOES_QUE_NAO_VENCEM,
    ContaDaTela,
)

#: Até aqui é atraso; depois, inadimplência. Decisão do Erick (padrão de mercado).
CARENCIA_DIAS = 30

#: As faixas de atraso, em dias, inclusivas. `None` é sem teto.
FAIXAS = {"atraso": (1, 30), "31_60": (31, 60), "61_90": (61, 90), "90_mais": (91, None)}

#: Desde quando a série anual começa — antes disso a base tem pouco volume.
ANO_INICIAL = 2019
#: Quantos meses a série mensal mostra.
MESES_NA_SERIE = 24


def params_base(hoje: date) -> dict:
    return {
        "hoje": hoje,
        "quitadas": QUITADAS_A_RECEBER,
        "canceladas": SITUACOES_CANCELADAS,
        "carencia": CARENCIA_DIAS,
    }


# A chave da empresa: raiz do CNPJ (8 dígitos), CPF inteiro, ou o nome normalizado.
# `CAST` e nunca o cast com dois-pontos — ver o aviso em `contas_agregado._clausulas`.
SQL_BASE = """
WITH titulos AS (
    SELECT id, data AS emissao, vencimento, liquidacao, situacao,
           cliente_nome, cliente_cpf_cnpj, cliente_fone, cliente_email,
           COALESCE(valor, 0) AS valor,
           COALESCE(saldo, 0) AS saldo,
           regexp_replace(COALESCE(cliente_cpf_cnpj, ''), '[^0-9]', '', 'g') AS doc,
           lower(COALESCE(situacao, '')) = ANY(CAST(:quitadas AS text[])) AS quitada
    FROM tiny.contas_receber
    WHERE excluida_na_origem_em IS NULL
      AND lower(COALESCE(situacao, '')) <> ALL(CAST(:canceladas AS text[]))
),
t AS (
    SELECT *,
           CASE WHEN length(doc) = 14 THEN left(doc, 8)
                WHEN length(doc) = 11 THEN doc
                ELSE 'nome' || chr(58) || lower(trim(COALESCE(cliente_nome, '')))
           END AS empresa,
           NOT quitada AS em_aberto,
           CASE WHEN NOT quitada AND vencimento < CAST(:hoje AS date)
                THEN CAST(:hoje AS date) - vencimento ELSE 0 END AS atraso
    FROM titulos
),
empresas AS (
    SELECT empresa,
           (array_agg(cliente_nome ORDER BY emissao DESC, id DESC)
               FILTER (WHERE em_aberto))[1]                          AS nome,
           count(DISTINCT doc) FILTER (WHERE atraso > 0)             AS filiais,
           min(cliente_cpf_cnpj) FILTER (WHERE atraso > 0)           AS cnpj_unico,
           count(*) FILTER (WHERE atraso > 0)                        AS titulos,
           COALESCE(sum(saldo) FILTER (WHERE atraso > 0), 0)         AS valor_vencido,
           COALESCE(sum(saldo) FILTER (WHERE atraso > CAST(:carencia AS int)), 0)
                                                                      AS valor_inadimplente,
           COALESCE(max(atraso), 0)                                  AS maior_atraso
    FROM t
    GROUP BY empresa
    HAVING count(*) FILTER (WHERE atraso > 0) > 0
)
"""
# `chr(58)` é o dois-pontos: escrito literal dentro de `text()` ele vira bind param.


def documento_exibido(empresa: str, filiais: int, cnpj_unico: Optional[str]) -> Optional[str]:
    """O que vai embaixo do nome: o CNPJ completo se for uma filial só, senão a raiz."""
    if empresa.startswith("nome:"):
        return None
    if len(empresa) == 11:  # CPF
        d = empresa
        return f"{d[0:3]}.{d[3:6]}.{d[6:9]}-{d[9:11]}"
    if filiais <= 1 and cnpj_unico:
        d = "".join(c for c in cnpj_unico if c.isdigit())
        if len(d) == 14:
            return f"{d[0:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:14]}"
        return cnpj_unico
    raiz = f"{empresa[0:2]}.{empresa[2:5]}.{empresa[5:8]}"
    return f"{raiz} · {filiais} filiais"


# ─────────────────────────────────────────────────────────────── resumo

class Faixa(BaseModel):
    faixa: str
    titulos: int
    empresas: int
    valor: float


class ResumoDeInadimplencia(BaseModel):
    total_a_receber: float
    total_vencido: float
    em_atraso: float
    inadimplente: float
    inadimplencia_carteira: float
    recuperado: Optional[float]
    titulos_vencidos: int
    titulos_inadimplentes: int
    empresas_inadimplentes: int
    faixas: List[Faixa]
    sem_contato: int
    promessas_7_dias: int
    promessas_quebradas: int
    em_negociacao: int


SQL_RESUMO = """
SELECT
    COALESCE(sum(saldo) FILTER (WHERE em_aberto), 0)                         AS total_a_receber,
    COALESCE(sum(saldo) FILTER (WHERE atraso > 0), 0)                        AS total_vencido,
    COALESCE(sum(saldo) FILTER (WHERE atraso BETWEEN 1 AND CAST(:carencia AS int)), 0) AS em_atraso,
    COALESCE(sum(saldo) FILTER (WHERE atraso > CAST(:carencia AS int)), 0)   AS inadimplente,
    count(*) FILTER (WHERE atraso > 0)                                       AS titulos_vencidos,
    count(*) FILTER (WHERE atraso > CAST(:carencia AS int))                  AS titulos_inadimplentes,
    count(DISTINCT empresa) FILTER (WHERE atraso > CAST(:carencia AS int))   AS empresas_inadimplentes,
    -- a safra inteira: o que passou de 30 dias sem pagar, na história
    COALESCE(sum(CASE WHEN em_aberto THEN saldo
                      WHEN liquidacao > vencimento + CAST(:carencia AS int) THEN valor
                      ELSE 0 END)
             FILTER (WHERE vencimento + CAST(:carencia AS int) <= CAST(:hoje AS date)), 0)
                                                                              AS safra_inadimplente
FROM t
"""

SQL_FAIXA = """
SELECT count(*) AS titulos, count(DISTINCT empresa) AS empresas, COALESCE(sum(saldo), 0) AS valor
FROM t
WHERE atraso >= CAST(:lo AS int) AND (CAST(:hi AS int) IS NULL OR atraso <= CAST(:hi AS int))
"""

SQL_CONTAGEM_COBRANCA = """
SELECT
    count(*) FILTER (WHERE e.valor_inadimplente > 0
                     AND COALESCE(c.status, 'sem_contato') = 'sem_contato')    AS sem_contato,
    count(*) FILTER (WHERE c.status = 'promessa'
                     AND c.promessa_data BETWEEN CAST(:hoje AS date)
                                             AND CAST(:hoje AS date) + 7)      AS promessas_7_dias,
    count(*) FILTER (WHERE c.status = 'quebrada')                              AS promessas_quebradas,
    count(*) FILTER (WHERE c.status = 'negociacao')                            AS em_negociacao
FROM empresas e
LEFT JOIN tiny.cobranca_ciclos c ON c.empresa = e.empresa AND c.encerrado_em IS NULL
"""


def resumo(db: Session, hoje: date) -> ResumoDeInadimplencia:
    p = params_base(hoje)
    linha = db.execute(text(SQL_BASE + SQL_RESUMO), p).mappings().one()
    cobranca = db.execute(text(SQL_BASE + SQL_CONTAGEM_COBRANCA), p).mappings().one()

    faixas = []
    for nome, (lo, hi) in FAIXAS.items():
        f = db.execute(text(SQL_BASE + SQL_FAIXA), {**p, "lo": lo, "hi": hi}).mappings().one()
        faixas.append(Faixa(faixa=nome, titulos=f["titulos"], empresas=f["empresas"],
                            valor=float(f["valor"])))

    total = float(linha["total_a_receber"])
    inad = float(linha["inadimplente"])
    safra = float(linha["safra_inadimplente"])
    return ResumoDeInadimplencia(
        total_a_receber=total,
        total_vencido=float(linha["total_vencido"]),
        em_atraso=float(linha["em_atraso"]),
        inadimplente=inad,
        inadimplencia_carteira=(inad / total) if total else 0.0,
        recuperado=(1 - inad / safra) if safra else None,
        titulos_vencidos=linha["titulos_vencidos"],
        titulos_inadimplentes=linha["titulos_inadimplentes"],
        empresas_inadimplentes=linha["empresas_inadimplentes"],
        faixas=faixas,
        **{k: int(v) for k, v in cobranca.items()},
    )


# ─────────────────────────────────────────────────────────────── lista

class EmpresaDaLista(BaseModel):
    empresa: str
    nome: str
    documento: Optional[str]
    filiais: int
    titulos: int
    valor_devido: float
    valor_inadimplente: float
    maior_atraso: int
    status: Optional[str]
    proxima_data: Optional[date]
    ultimo_contato: Optional[datetime]


class PaginaDeEmpresas(BaseModel):
    itens: List[EmpresaDaLista]
    total: int
    limite: int
    offset: int


# Ordenação por lista fechada: o ORDER BY não aceita bind param.
ORDENACOES_DE_EMPRESAS = {
    "valor": "valor_vencido {d}, empresa",
    "maior_atraso": "maior_atraso {d}, valor_vencido DESC",
    "titulos": "titulos {d}, valor_vencido DESC",
    "nome": "nome {d}, empresa",
    "status": "status {d} NULLS LAST, valor_vencido DESC",
    "proxima_data": "proxima_data {d} NULLS LAST, valor_vencido DESC",
    "ultimo_contato": "ultimo_contato {d} NULLS FIRST, valor_vencido DESC",
}

SQL_LISTA = """
, lista AS (
    SELECT e.*,
           COALESCE(c.status, CASE WHEN e.valor_inadimplente > 0 THEN 'sem_contato' END) AS status,
           c.promessa_data      AS proxima_data,
           c.ultimo_contato_em  AS ultimo_contato
    FROM empresas e
    LEFT JOIN tiny.cobranca_ciclos c ON c.empresa = e.empresa AND c.encerrado_em IS NULL
    WHERE (CAST(:incluir_atraso AS boolean) OR e.valor_inadimplente > 0)
      AND (CAST(:status AS text[]) IS NULL
           OR COALESCE(c.status, CASE WHEN e.valor_inadimplente > 0 THEN 'sem_contato' END)
              = ANY(CAST(:status AS text[])))
      AND (CAST(:faixa_lo AS int) IS NULL OR EXISTS (
            SELECT 1 FROM t WHERE t.empresa = e.empresa
               AND t.atraso >= CAST(:faixa_lo AS int)
               AND (CAST(:faixa_hi AS int) IS NULL OR t.atraso <= CAST(:faixa_hi AS int))))
      AND (CAST(:busca AS text) IS NULL
           OR lower(e.nome) LIKE '%' || lower(CAST(:busca AS text)) || '%'
           OR (length(regexp_replace(CAST(:busca AS text), '[^0-9]', '', 'g')) >= 3
               AND EXISTS (SELECT 1 FROM t WHERE t.empresa = e.empresa
                   AND t.doc LIKE '%' || regexp_replace(CAST(:busca AS text), '[^0-9]', '', 'g') || '%')))
)
"""


def pagina_de_empresas(db: Session, hoje: date, *, busca: Optional[str], status: Optional[List[str]],
                       faixa: Optional[str], incluir_atraso: bool, ordenar_por: str, direcao: str,
                       limite: int, offset: int) -> PaginaDeEmpresas:
    lo, hi = FAIXAS[faixa] if faixa else (None, None)
    p = {**params_base(hoje), "busca": (busca or "").strip() or None, "status": status or None,
         "faixa_lo": lo, "faixa_hi": hi, "incluir_atraso": incluir_atraso}
    total = db.execute(text(SQL_BASE + SQL_LISTA + "SELECT count(*) FROM lista"), p).scalar_one()
    ordem = ORDENACOES_DE_EMPRESAS[ordenar_por].format(d=direcao.upper())
    linhas = db.execute(
        text(SQL_BASE + SQL_LISTA + f"SELECT * FROM lista ORDER BY {ordem} LIMIT :limite OFFSET :offset"),
        {**p, "limite": limite, "offset": offset},
    ).mappings()
    itens = [
        EmpresaDaLista(
            empresa=l["empresa"], nome=l["nome"] or "",
            documento=documento_exibido(l["empresa"], l["filiais"], l["cnpj_unico"]),
            filiais=l["filiais"], titulos=l["titulos"], valor_devido=float(l["valor_vencido"]),
            valor_inadimplente=float(l["valor_inadimplente"]), maior_atraso=l["maior_atraso"],
            status=l["status"], proxima_data=l["proxima_data"], ultimo_contato=l["ultimo_contato"],
        )
        for l in linhas
    ]
    return PaginaDeEmpresas(itens=itens, total=total, limite=limite, offset=offset)


# ─────────────────────────────────────────────────────────────── detalhe

class Filial(BaseModel):
    cnpj: str
    nome: str
    titulos: int
    valor_vencido: float


class Ciclo(BaseModel):
    id: int
    status: str
    promessa_data: Optional[date]
    promessa_valor: Optional[float]
    promessa_condicoes: Optional[str]
    aberto_em: datetime
    aberto_por: str
    encerrado_em: Optional[datetime]
    ultimo_contato_em: Optional[datetime]


class Evento(BaseModel):
    id: int
    ciclo_id: int
    ocorrido_em: datetime
    registrado_em: datetime
    registrado_por: str
    tipo: str
    canal: Optional[str]
    filial_cnpj: Optional[str]
    status_anterior: Optional[str]
    status_novo: Optional[str]
    promessa_data: Optional[date]
    promessa_valor: Optional[float]
    promessa_condicoes: Optional[str]
    anotacao: Optional[str]
    valor_inadimplente: Optional[float]


class DetalheDaEmpresa(BaseModel):
    empresa: str
    nome: str
    documento: Optional[str]
    valor_devido: float
    valor_inadimplente: float
    maior_atraso: int
    telefone: Optional[str]
    email: Optional[str]
    observacao: Optional[str]
    observacao_por: Optional[str]
    observacao_em: Optional[datetime]
    filiais: List[Filial]
    ciclo: Optional[Ciclo]
    ciclos_anteriores: List[Ciclo]
    eventos: List[Evento]


def valores_da_empresa(db: Session, hoje: date, empresa: str) -> Optional[dict]:
    linha = db.execute(
        text(SQL_BASE + "SELECT * FROM empresas WHERE empresa = :empresa"),
        {**params_base(hoje), "empresa": empresa},
    ).mappings().first()
    return dict(linha) if linha else None


def filiais_da_empresa(db: Session, empresa: str) -> set:
    linhas = db.execute(
        text(SQL_BASE + "SELECT DISTINCT doc FROM t WHERE empresa = :empresa AND doc <> ''"),
        {**params_base(date.today()), "empresa": empresa},
    ).scalars()
    return set(linhas)


def detalhe_da_empresa(db: Session, hoje: date, empresa: str) -> Optional[DetalheDaEmpresa]:
    p = {**params_base(hoje), "empresa": empresa}
    valores = valores_da_empresa(db, hoje, empresa)
    ciclos = [Ciclo(**dict(c)) for c in db.execute(text(
        "SELECT id, status, promessa_data, promessa_valor, promessa_condicoes, aberto_em,"
        " aberto_por, encerrado_em, ultimo_contato_em"
        " FROM tiny.cobranca_ciclos WHERE empresa = :empresa ORDER BY aberto_em DESC"
    ), p).mappings()]
    if valores is None and not any(c.encerrado_em is None for c in ciclos):
        return None

    filiais = [Filial(cnpj=f["doc"], nome=f["nome"], titulos=f["titulos"],
                      valor_vencido=float(f["valor"])) for f in db.execute(text(SQL_BASE + """
        SELECT doc, (array_agg(cliente_nome ORDER BY emissao DESC, id DESC))[1] AS nome,
               count(*) AS titulos, COALESCE(sum(saldo), 0) AS valor
        FROM t WHERE empresa = :empresa AND atraso > 0
        GROUP BY doc ORDER BY valor DESC, doc
    """), p).mappings()]
    contato = db.execute(text(SQL_BASE + """
        SELECT cliente_fone, cliente_email FROM t WHERE empresa = :empresa
        ORDER BY emissao DESC, id DESC LIMIT 1
    """), p).mappings().first() or {}
    obs = db.execute(text(
        "SELECT observacao, alterado_por, alterado_em FROM tiny.cobranca_empresas WHERE empresa = :empresa"
    ), p).mappings().first() or {}
    eventos = [Evento(**dict(e)) for e in db.execute(text("""
        SELECT ev.* FROM tiny.cobranca_eventos ev
        JOIN tiny.cobranca_ciclos c ON c.id = ev.ciclo_id
        WHERE c.empresa = :empresa
        ORDER BY ev.ocorrido_em DESC, ev.id DESC
    """), p).mappings()]

    v = valores or {"nome": "", "filiais": 0, "cnpj_unico": None, "valor_vencido": 0,
                    "valor_inadimplente": 0, "maior_atraso": 0}
    if not v["nome"]:
        v["nome"] = db.execute(text(SQL_BASE + """
            SELECT cliente_nome FROM t WHERE empresa = :empresa ORDER BY emissao DESC, id DESC LIMIT 1
        """), p).scalar() or empresa
    aberto = next((c for c in ciclos if c.encerrado_em is None), None)
    return DetalheDaEmpresa(
        empresa=empresa, nome=v["nome"],
        documento=documento_exibido(empresa, v["filiais"], v["cnpj_unico"]),
        valor_devido=float(v["valor_vencido"]), valor_inadimplente=float(v["valor_inadimplente"]),
        maior_atraso=v["maior_atraso"],
        telefone=contato.get("cliente_fone"), email=contato.get("cliente_email"),
        observacao=obs.get("observacao"), observacao_por=obs.get("alterado_por"),
        observacao_em=obs.get("alterado_em"),
        filiais=filiais, ciclo=aberto,
        ciclos_anteriores=[c for c in ciclos if c.encerrado_em is not None],
        eventos=eventos,
    )


def titulos_da_empresa(db: Session, hoje: date, empresa: str) -> List[ContaDaTela]:
    """Os títulos em aberto da empresa, vencidos e a vencer, no formato da tela de Contas."""
    p = {**params_base(hoje), "empresa": empresa, "nao_vencem": SITUACOES_QUE_NAO_VENCEM}
    sql = (SQL_BASE + "SELECT " + COLUNAS_DA_TELA.format(campo_emissao="data")
           + ", forma_pagamento, portador FROM tiny.contas_receber"
           " WHERE id IN (SELECT id FROM t WHERE empresa = :empresa AND em_aberto)"
           " ORDER BY vencimento, id")
    return [ContaDaTela(**dict(l)) for l in db.execute(text(sql), p).mappings()]


# ─────────────────────────────────────────────────────────────── indicadores

class PontoDeTaxa(BaseModel):
    valor: float
    inadimplente: float
    titulos: int
    titulos_inadimplentes: int
    taxa: Optional[float]


class MesDeTaxa(PontoDeTaxa):
    mes: str            # "AAAA-MM"
    em_apuracao: bool


class AnoDeTaxa(PontoDeTaxa):
    ano: int
    ano_corrente: bool


class Indicadores(BaseModel):
    mensal: List[MesDeTaxa]
    anual: List[AnoDeTaxa]
    total: PontoDeTaxa
    desde: Optional[date]
    ultimo_fechado: Optional[MesDeTaxa]
    media_12_meses: Optional[float]


SQL_MADUROS = """
, maduros AS (
    SELECT vencimento, valor,
           CASE WHEN em_aberto THEN saldo
                WHEN liquidacao > vencimento + CAST(:carencia AS int) THEN valor
                ELSE 0 END AS inad
    FROM t
    WHERE vencimento + CAST(:carencia AS int) <= CAST(:hoje AS date)
)
"""
_SOMAS = ("COALESCE(sum(valor), 0) AS valor, COALESCE(sum(inad), 0) AS inadimplente,"
          " count(*) AS titulos, count(*) FILTER (WHERE inad > 0) AS titulos_inadimplentes")


def _taxa(l) -> dict:
    valor = float(l["valor"])
    inad = float(l["inadimplente"])
    return {"valor": valor, "inadimplente": inad, "titulos": l["titulos"],
            "titulos_inadimplentes": l["titulos_inadimplentes"],
            "taxa": (inad / valor) if valor else None}


def indicadores(db: Session, hoje: date) -> Indicadores:
    p = params_base(hoje)
    primeiro = date(hoje.year, hoje.month, 1)
    ano, mes = primeiro.year, primeiro.month - (MESES_NA_SERIE - 1)
    while mes <= 0:
        mes += 12
        ano -= 1
    p["inicio_serie"] = date(ano, mes, 1)
    p["ano_inicial"] = ANO_INICIAL

    mensal = []
    for l in db.execute(text(SQL_BASE + SQL_MADUROS + f"""
        SELECT to_char(vencimento, 'YYYY-MM') AS mes,
               (date_trunc('month', vencimento) + interval '1 month' - interval '1 day'
                + CAST(:carencia AS int) * interval '1 day') > CAST(:hoje AS date) AS em_apuracao,
               {_SOMAS}
        FROM maduros WHERE vencimento >= CAST(:inicio_serie AS date)
        GROUP BY 1, 2 ORDER BY 1
    """), p).mappings():
        mensal.append(MesDeTaxa(mes=l["mes"], em_apuracao=l["em_apuracao"], **_taxa(l)))

    anual = [AnoDeTaxa(ano=l["ano"], ano_corrente=l["ano"] == hoje.year, **_taxa(l))
             for l in db.execute(text(SQL_BASE + SQL_MADUROS + f"""
        SELECT CAST(EXTRACT(YEAR FROM vencimento) AS int) AS ano, {_SOMAS}
        FROM maduros WHERE EXTRACT(YEAR FROM vencimento) >= :ano_inicial
        GROUP BY 1 ORDER BY 1
    """), p).mappings()]

    tot = db.execute(text(SQL_BASE + SQL_MADUROS + f"SELECT min(vencimento) AS desde, {_SOMAS} FROM maduros"),
                     p).mappings().one()

    fechados = [m for m in mensal if not m.em_apuracao]
    ultimos = fechados[-12:]
    soma_v = sum(m.valor for m in ultimos)
    return Indicadores(
        mensal=mensal, anual=anual, total=PontoDeTaxa(**_taxa(tot)), desde=tot["desde"],
        ultimo_fechado=fechados[-1] if fechados else None,
        media_12_meses=(sum(m.inadimplente for m in ultimos) / soma_v) if soma_v else None,
    )
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && .venv/bin/pytest tests/test_inadimplencia_consultas.py -v`
Expected: todos passam. Se `test_mes_em_apuracao...` falhar só por causa do dia do mês em que rodar, ajuste a semente — não a regra.

- [ ] **Step 6: Commit**

```bash
git add backend/app/core/inadimplencia.py backend/tests/semente_contas.py backend/tests/test_inadimplencia_consultas.py
git commit -m "feat(inadimplencia): consultas de empresas, resumo, titulos e taxa de safra"
```

---

### Task 3: Escrita e sincronização — `app/services/cobranca.py`

**Files:**
- Create: `backend/app/services/cobranca.py`
- Modify: `backend/app/jobs/extrair_contas.py` (função `_carregar`, antes do `finally: db.close()`)
- Create: `backend/tests/test_cobranca_sincronizar.py`

**Interfaces:**
- Consumes: `SQL_BASE`, `params_base`, `valores_da_empresa`, `filiais_da_empresa`, `detalhe_da_empresa`, `CARENCIA_DIAS` (Task 2).
- Produces:
  - `STATUS_DO_SISTEMA = {"sem_contato", "quebrada", "pago"}`
  - `STATUS_MANUAIS = {"em_contato", "respondeu", "promessa", "negociacao", "contestado", "juridico", "perda"}`
  - `CANAIS = {"telefone", "email", "whatsapp", "presencial", "outro"}`
  - `class ErroDeCobranca(Exception)` com `.status_code: int` (404 ou 422) e mensagem em português
  - `sincronizar(db: Session, hoje: date) -> dict[str, int]` — chaves `abertos`, `pagos`, `quebradas`; **não** faz commit
  - `registrar_evento(db, hoje, empresa: str, dados: NovoEvento, usuario: str) -> None`; **não** faz commit
  - `gravar_observacao(db, empresa: str, texto: str, usuario: str) -> None`; **não** faz commit
  - `class Promessa(BaseModel)`: `data: date`, `valor: float | None`, `condicoes: str | None`
  - `class NovoEvento(BaseModel)`: `ocorrido_em: datetime`, `canal: str | None`, `filial_cnpj: str | None`, `status_novo: str | None`, `promessa: Promessa | None`, `anotacao: str | None` (máx. 4.000)

- [ ] **Step 1: Escrever os testes que falham**

`backend/tests/test_cobranca_sincronizar.py`:

```python
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from tests.semente_contas import contas, tabela_contas  # noqa: F401
from tests.test_inadimplencia_migracao import rodar_migracao

HOJE = date.today()
AGORA = datetime.now(timezone.utc)


@pytest.fixture(scope="module", autouse=True)
def tabelas(engine):
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS tiny.configuracoes ("
            " id serial PRIMARY KEY, chave varchar NOT NULL UNIQUE, valor varchar NOT NULL)"))
    rodar_migracao(engine, "013_cobranca.sql")


@pytest.fixture
def db(engine):
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE tiny.cobranca_eventos, tiny.cobranca_ciclos, tiny.cobranca_empresas RESTART IDENTITY CASCADE"))
    with Session(engine) as sessao:
        yield sessao


def _ciclos(db):
    return db.execute(text("SELECT empresa, status, encerrado_em IS NOT NULL AS fechado FROM tiny.cobranca_ciclos ORDER BY id")).all()


def _eventos(db):
    return db.execute(text("SELECT tipo, status_anterior, status_novo, registrado_por FROM tiny.cobranca_eventos ORDER BY id")).all()


def test_abre_ciclo_so_para_inadimplente(db, contas):
    from app.services.cobranca import sincronizar

    contas(doc="11111111000111", venceu_ha=40)
    contas(doc="22222222000122", venceu_ha=10)
    assert sincronizar(db, HOJE) == {"abertos": 1, "pagos": 0, "quebradas": 0}
    assert _ciclos(db) == [("11111111", "sem_contato", False)]
    assert _eventos(db) == [("sistema", None, "sem_contato", "sistema")]


def test_e_idempotente(db, contas):
    from app.services.cobranca import sincronizar

    contas(venceu_ha=40)
    sincronizar(db, HOJE)
    assert sincronizar(db, HOJE) == {"abertos": 0, "pagos": 0, "quebradas": 0}
    assert len(_ciclos(db)) == 1 and len(_eventos(db)) == 1


def test_fecha_como_pago_quando_nao_ha_mais_vencido(db, contas, engine):
    from app.services.cobranca import sincronizar

    contas(venceu_ha=40)
    sincronizar(db, HOJE)
    with engine.begin() as conn:
        conn.execute(text("UPDATE tiny.contas_receber SET situacao = 'pago', saldo = 0, liquidacao = CURRENT_DATE"))
    assert sincronizar(db, HOJE)["pagos"] == 1
    assert _ciclos(db) == [("11111111", "pago", True)]


def test_nao_fecha_enquanto_houver_titulo_em_atraso(db, contas, engine):
    from app.services.cobranca import sincronizar

    contas(venceu_ha=40)
    contas(venceu_ha=5)
    sincronizar(db, HOJE)
    with engine.begin() as conn:
        conn.execute(text("UPDATE tiny.contas_receber SET situacao = 'pago', saldo = 0 WHERE vencimento < CURRENT_DATE - 30"))
    assert sincronizar(db, HOJE)["pagos"] == 0


def test_quebra_promessa_vencida_uma_vez_so(db, contas):
    from app.services.cobranca import NovoEvento, Promessa, registrar_evento, sincronizar

    contas(venceu_ha=40)
    sincronizar(db, HOJE)
    registrar_evento(db, HOJE, "11111111", NovoEvento(
        ocorrido_em=AGORA, canal="telefone", status_novo="promessa",
        promessa=Promessa(data=HOJE)), "erick")
    amanha = HOJE + timedelta(days=1)
    assert sincronizar(db, amanha)["quebradas"] == 1
    assert sincronizar(db, amanha)["quebradas"] == 0
    assert _ciclos(db)[0][1] == "quebrada"


def test_reabre_ciclo_novo_depois_de_pago(db, contas, engine):
    from app.services.cobranca import sincronizar

    contas(venceu_ha=40)
    sincronizar(db, HOJE)
    with engine.begin() as conn:
        conn.execute(text("UPDATE tiny.contas_receber SET situacao = 'pago', saldo = 0"))
    sincronizar(db, HOJE)
    contas(venceu_ha=35)
    assert sincronizar(db, HOJE)["abertos"] == 1
    assert [c[2] for c in _ciclos(db)] == [True, False]


def test_registrar_contato_abre_ciclo_para_empresa_so_em_atraso(db, contas):
    from app.services.cobranca import NovoEvento, registrar_evento

    contas(venceu_ha=10)
    registrar_evento(db, HOJE, "11111111", NovoEvento(ocorrido_em=AGORA, canal="email"), "erick")
    assert _ciclos(db) == [("11111111", "em_contato", False)]


def test_contato_tira_de_sem_contato_e_atualiza_ultimo_contato(db, contas):
    from app.services.cobranca import NovoEvento, registrar_evento, sincronizar

    contas(venceu_ha=40)
    sincronizar(db, HOJE)
    registrar_evento(db, HOJE, "11111111", NovoEvento(ocorrido_em=AGORA, canal="whatsapp",
                                                      anotacao="Falei com o financeiro"), "erick")
    status, ultimo = db.execute(text("SELECT status, ultimo_contato_em FROM tiny.cobranca_ciclos")).one()
    assert status == "em_contato" and ultimo is not None


@pytest.mark.parametrize("dados, mensagem", [
    ({"status_novo": "pago"}, "sistema"),
    ({"status_novo": "inventado"}, "desconhecido"),
    ({"status_novo": "promessa"}, "data"),
    ({"status_novo": "promessa", "promessa": {"data": "2000-01-01"}}, "passou"),
    ({"canal": "telefone", "promessa": {"data": "2999-01-01"}}, "Promessa de pagamento"),
    ({"canal": "pombo"}, "canal"),
    ({}, "canal ou um status"),
    ({"canal": "telefone", "filial_cnpj": "22222222000122"}, "filial"),
    ({"canal": "telefone", "ocorrido_em": "2999-01-01T00:00:00Z"}, "futuro"),
    ({"canal": "telefone", "anotacao": "x" * 4001}, "4.000"),
])
def test_validacao(db, contas, dados, mensagem):
    from pydantic import ValidationError
    from app.services.cobranca import ErroDeCobranca, NovoEvento, registrar_evento

    contas(venceu_ha=40)
    try:
        evento = NovoEvento(**{"ocorrido_em": AGORA, **dados})
    except ValidationError as erro:
        assert mensagem in str(erro)
        return
    with pytest.raises(ErroDeCobranca) as erro:
        registrar_evento(db, HOJE, "11111111", evento, "erick")
    assert erro.value.status_code == 422
    assert mensagem in str(erro.value)


def test_empresa_inexistente_e_404(db, contas):
    from app.services.cobranca import ErroDeCobranca, NovoEvento, registrar_evento

    with pytest.raises(ErroDeCobranca) as erro:
        registrar_evento(db, HOJE, "99999999", NovoEvento(ocorrido_em=AGORA, canal="telefone"), "erick")
    assert erro.value.status_code == 404


def test_observacao_grava_apaga_e_registra_evento(db, contas):
    from app.services.cobranca import gravar_observacao, sincronizar

    contas(venceu_ha=40)
    sincronizar(db, HOJE)
    gravar_observacao(db, "11111111", "Só boleto por e-mail", "erick")
    gravar_observacao(db, "11111111", "Pagam dia 10", "erick")
    assert db.execute(text("SELECT observacao FROM tiny.cobranca_empresas")).scalar() == "Pagam dia 10"
    anot = db.execute(text("SELECT anotacao FROM tiny.cobranca_eventos WHERE tipo = 'observacao' ORDER BY id")).scalars().all()
    assert anot[-1] == "Antes: Só boleto por e-mail"
    gravar_observacao(db, "11111111", "  ", "erick")
    assert db.execute(text("SELECT count(*) FROM tiny.cobranca_empresas")).scalar() == 0
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && .venv/bin/pytest tests/test_cobranca_sincronizar.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.cobranca'`

- [ ] **Step 3: Implementar `app/services/cobranca.py`**

```python
"""Cobrança da inadimplência: o que o financeiro registra e o que o sistema faz sozinho.

Nenhuma função aqui faz commit — quem chama decide (a rota, ou o job de contas).
Spec: docs/superpowers/specs/2026-10-09-inadimplencia-design.md
"""
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.inadimplencia import (
    SQL_BASE,
    filiais_da_empresa,
    params_base,
    valores_da_empresa,
)

STATUS_DO_SISTEMA = {"sem_contato", "quebrada", "pago"}
STATUS_MANUAIS = {"em_contato", "respondeu", "promessa", "negociacao", "contestado", "juridico", "perda"}
CANAIS = {"telefone", "email", "whatsapp", "presencial", "outro"}
SISTEMA = "sistema"


class ErroDeCobranca(Exception):
    def __init__(self, mensagem: str, status_code: int = 422):
        super().__init__(mensagem)
        self.status_code = status_code


class Promessa(BaseModel):
    data: date
    valor: Optional[float] = Field(None, gt=0)
    condicoes: Optional[str] = Field(None, max_length=1000)


class NovoEvento(BaseModel):
    ocorrido_em: datetime
    canal: Optional[str] = None
    filial_cnpj: Optional[str] = None
    status_novo: Optional[str] = None
    promessa: Optional[Promessa] = None
    anotacao: Optional[str] = None

    @field_validator("anotacao")
    @classmethod
    def _tamanho(cls, v):
        if v is None:
            return None
        if len(v) > 4000:
            raise ValueError("A anotação passa de 4.000 caracteres.")
        return v.strip() or None


def _evento(db, ciclo_id, *, por, tipo, ocorrido_em=None, valor=None, **campos):
    db.execute(text("""
        INSERT INTO tiny.cobranca_eventos
            (ciclo_id, ocorrido_em, registrado_por, tipo, canal, filial_cnpj, status_anterior,
             status_novo, promessa_data, promessa_valor, promessa_condicoes, anotacao,
             valor_inadimplente)
        VALUES (:ciclo, :quando, :por, :tipo, :canal, :filial, :antes, :novo, :pd, :pv, :pc,
                :anotacao, :valor)
    """), {
        "ciclo": ciclo_id, "quando": ocorrido_em or datetime.now(timezone.utc), "por": por,
        "tipo": tipo, "canal": campos.get("canal"), "filial": campos.get("filial_cnpj"),
        "antes": campos.get("status_anterior"), "novo": campos.get("status_novo"),
        "pd": campos.get("promessa_data"), "pv": campos.get("promessa_valor"),
        "pc": campos.get("promessa_condicoes"), "anotacao": campos.get("anotacao"),
        "valor": valor,
    })


def _ciclo_aberto(db, empresa):
    return db.execute(text(
        "SELECT * FROM tiny.cobranca_ciclos WHERE empresa = :e AND encerrado_em IS NULL FOR UPDATE"
    ), {"e": empresa}).mappings().first()


def _abrir_ciclo(db, empresa, status, por):
    return db.execute(text(
        "INSERT INTO tiny.cobranca_ciclos (empresa, status, aberto_por) VALUES (:e, :s, :p) RETURNING id"
    ), {"e": empresa, "s": status, "p": por}).scalar_one()


def sincronizar(db: Session, hoje: date) -> dict:
    """Abre, fecha e quebra promessa — idempotente. Ordem: abre, fecha, quebra."""
    p = params_base(hoje)
    contagem = {"abertos": 0, "pagos": 0, "quebradas": 0}

    novos = db.execute(text(SQL_BASE + """
        SELECT e.empresa, e.valor_inadimplente, e.maior_atraso FROM empresas e
        WHERE e.valor_inadimplente > 0
          AND NOT EXISTS (SELECT 1 FROM tiny.cobranca_ciclos c
                          WHERE c.empresa = e.empresa AND c.encerrado_em IS NULL)
    """), p).mappings().all()
    for n in novos:
        ciclo = _abrir_ciclo(db, n["empresa"], "sem_contato", SISTEMA)
        _evento(db, ciclo, por=SISTEMA, tipo="sistema", status_novo="sem_contato",
                anotacao=f"Cobrança aberta: título com {n['maior_atraso']} dias de atraso.",
                valor=n["valor_inadimplente"])
        contagem["abertos"] += 1

    quitados = db.execute(text(SQL_BASE + """
        SELECT c.id, c.status FROM tiny.cobranca_ciclos c
        WHERE c.encerrado_em IS NULL
          AND NOT EXISTS (SELECT 1 FROM empresas e WHERE e.empresa = c.empresa)
    """), p).mappings().all()
    for c in quitados:
        db.execute(text(
            "UPDATE tiny.cobranca_ciclos SET status = 'pago', encerrado_em = now() WHERE id = :id"
        ), {"id": c["id"]})
        _evento(db, c["id"], por=SISTEMA, tipo="sistema", status_anterior=c["status"],
                status_novo="pago", anotacao="Sem títulos vencidos no Tiny.", valor=0)
        contagem["pagos"] += 1

    quebradas = db.execute(text("""
        SELECT id, empresa, promessa_data, promessa_valor FROM tiny.cobranca_ciclos
        WHERE encerrado_em IS NULL AND status = 'promessa' AND promessa_data < CAST(:hoje AS date)
    """), p).mappings().all()
    for c in quebradas:
        valores = valores_da_empresa(db, hoje, c["empresa"]) or {}
        db.execute(text("UPDATE tiny.cobranca_ciclos SET status = 'quebrada' WHERE id = :id"), {"id": c["id"]})
        _evento(db, c["id"], por=SISTEMA, tipo="sistema", status_anterior="promessa",
                status_novo="quebrada", promessa_data=c["promessa_data"],
                promessa_valor=c["promessa_valor"],
                anotacao=f"Promessa para {c['promessa_data']:%d/%m/%Y} venceu sem pagamento no Tiny.",
                valor=valores.get("valor_inadimplente"))
        contagem["quebradas"] += 1
    return contagem


def registrar_evento(db: Session, hoje: date, empresa: str, dados: NovoEvento, usuario: str) -> None:
    ciclo = _ciclo_aberto(db, empresa)
    valores = valores_da_empresa(db, hoje, empresa)
    if valores is None and ciclo is None:
        raise ErroDeCobranca("Empresa sem título vencido em aberto.", 404)

    novo = dados.status_novo
    if novo in STATUS_DO_SISTEMA:
        raise ErroDeCobranca("Este status é posto pelo sistema, não à mão.")
    if novo is not None and novo not in STATUS_MANUAIS:
        raise ErroDeCobranca(f"Status desconhecido: {novo}.")
    if dados.canal is not None and dados.canal not in CANAIS:
        raise ErroDeCobranca(f"canal inválido: {dados.canal}.")
    if dados.canal is None and novo is None:
        raise ErroDeCobranca("Informe um canal ou um status.")
    if novo == "promessa" and dados.promessa is None:
        raise ErroDeCobranca("Promessa de pagamento precisa de data.")
    if dados.promessa is not None and novo != "promessa":
        raise ErroDeCobranca("Data prometida só com o status Promessa de pagamento.")
    if dados.promessa is not None and dados.promessa.data < hoje:
        raise ErroDeCobranca("A data prometida já passou.")
    if dados.ocorrido_em > datetime.now(timezone.utc) + timedelta(minutes=5):
        raise ErroDeCobranca("A data do contato está no futuro.")
    filial = "".join(c for c in (dados.filial_cnpj or "") if c.isdigit()) or None
    if filial is not None and filial not in filiais_da_empresa(db, empresa):
        raise ErroDeCobranca("Este CNPJ não é filial desta empresa.")

    if ciclo is None:
        id_ciclo = _abrir_ciclo(db, empresa, novo or "em_contato", usuario)
        anterior = None
    else:
        id_ciclo = ciclo["id"]
        anterior = ciclo["status"]

    if novo is None and dados.canal is not None and anterior in (None, "sem_contato"):
        novo = "em_contato"
    status = novo or anterior

    promessa = dados.promessa
    manter_promessa = status in ("promessa", "quebrada") and promessa is None and ciclo is not None
    db.execute(text("""
        UPDATE tiny.cobranca_ciclos SET
            status = :status,
            promessa_data = :pd, promessa_valor = :pv, promessa_condicoes = :pc,
            ultimo_contato_em = CASE WHEN CAST(:contato AS boolean)
                                     THEN GREATEST(ultimo_contato_em, CAST(:quando AS timestamptz))
                                     ELSE ultimo_contato_em END
        WHERE id = :id
    """), {
        "id": id_ciclo, "status": status, "contato": dados.canal is not None,
        "quando": dados.ocorrido_em,
        "pd": promessa.data if promessa else (ciclo["promessa_data"] if manter_promessa else None),
        "pv": promessa.valor if promessa else (ciclo["promessa_valor"] if manter_promessa else None),
        "pc": promessa.condicoes if promessa else (ciclo["promessa_condicoes"] if manter_promessa else None),
    })
    _evento(db, id_ciclo, por=usuario, tipo="contato" if dados.canal else "status",
            ocorrido_em=dados.ocorrido_em, canal=dados.canal, filial_cnpj=filial,
            status_anterior=anterior if novo else None, status_novo=novo,
            promessa_data=promessa.data if promessa else None,
            promessa_valor=promessa.valor if promessa else None,
            promessa_condicoes=promessa.condicoes if promessa else None,
            anotacao=dados.anotacao,
            valor=(valores or {}).get("valor_inadimplente"))


def gravar_observacao(db: Session, empresa: str, texto: str, usuario: str) -> None:
    texto = (texto or "").strip()
    if len(texto) > 4000:
        raise ErroDeCobranca("A observação passa de 4.000 caracteres.")
    antes = db.execute(text("SELECT observacao FROM tiny.cobranca_empresas WHERE empresa = :e"),
                       {"e": empresa}).scalar()
    if texto:
        db.execute(text("""
            INSERT INTO tiny.cobranca_empresas (empresa, observacao, alterado_por) VALUES (:e, :t, :u)
            ON CONFLICT (empresa) DO UPDATE SET observacao = :t, alterado_por = :u, alterado_em = now()
        """), {"e": empresa, "t": texto, "u": usuario})
    else:
        db.execute(text("DELETE FROM tiny.cobranca_empresas WHERE empresa = :e"), {"e": empresa})
    ciclo = _ciclo_aberto(db, empresa)
    if ciclo is not None and antes:
        _evento(db, ciclo["id"], por=usuario, tipo="observacao", anotacao=f"Antes: {antes}")
    elif ciclo is not None:
        _evento(db, ciclo["id"], por=usuario, tipo="observacao", anotacao="Observação criada.")
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && .venv/bin/pytest tests/test_cobranca_sincronizar.py -v`
Expected: todos passam.

- [ ] **Step 5: Ligar a sincronização no job `extrair_contas`**

Em `backend/app/jobs/extrair_contas.py`, adicionar o import no topo:

```python
from datetime import date

from app.services.cobranca import sincronizar as sincronizar_cobranca
```

E em `_carregar`, logo depois do `for tipo in tipos:` (ainda dentro do `try`, antes do `finally: db.close()`):

```python
        # A cobrança se acerta depois de cada carga de contas a receber: abre ciclo para
        # quem passou de 30 dias, fecha quem pagou, quebra promessa vencida. Falha aqui
        # NÃO derruba a carga — ela alimenta o sistema inteiro; a cobrança se acerta na
        # próxima, e o motivo fica no detalhe da execução (tela de Importações).
        if "receber" in tipos and not args.dry_run:
            try:
                mudancas = sincronizar_cobranca(db, date.today())
                db.commit()
                for acao, quantas in mudancas.items():
                    tudo[f"cobrança: {acao}"] = quantas
            except Exception as erro:  # noqa: BLE001
                db.rollback()
                logger.exception("sincronização da cobrança falhou")
                registro.detalhe = f"Sincronização da cobrança falhou: {erro}"
```

Conferir que `args.dry_run` existe em `montar_argumentos` (existe: o log já usa `args.dry_run`).

- [ ] **Step 6: Rodar a suíte do backend**

Run: `cd backend && .venv/bin/pytest -q`
Expected: tudo passa.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/cobranca.py backend/app/jobs/extrair_contas.py backend/tests/test_cobranca_sincronizar.py
git commit -m "feat(inadimplencia): registro de cobranca e sincronizacao no fim da carga de contas"
```

---

### Task 4: `exigir_papeis` e as rotas de leitura

**Files:**
- Modify: `backend/app/core/security.py` (depois de `exigir_admin`)
- Create: `backend/app/api/endpoints/inadimplencia.py`
- Modify: `backend/app/api/endpoints/__init__.py`, `backend/app/main.py`
- Create: `backend/tests/test_inadimplencia_api.py`

**Interfaces:**
- Consumes: tudo de `app.core.inadimplencia` (Task 2).
- Produces: `exigir_papeis(*papeis: str) -> Callable` (dependência FastAPI que devolve `Usuario`); rotas `GET /inadimplencia/resumo`, `/empresas`, `/empresas/{empresa}`, `/empresas/{empresa}/titulos`, `/indicadores` com os modelos de resposta da Task 2.

- [ ] **Step 1: Testes que falham**

`backend/tests/test_inadimplencia_api.py`:

```python
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from sqlalchemy import text

from tests.semente_contas import contas, tabela_contas  # noqa: F401
from tests.test_inadimplencia_migracao import rodar_migracao


@pytest.fixture(scope="module", autouse=True)
def tabelas(engine):
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS tiny.configuracoes ("
            " id serial PRIMARY KEY, chave varchar NOT NULL UNIQUE, valor varchar NOT NULL)"))
        conn.execute(text("GRANT SELECT, UPDATE, INSERT ON tiny.configuracoes TO app_teste"))
    rodar_migracao(engine, "013_cobranca.sql")


@pytest.fixture(autouse=True)
def limpa(engine):
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE tiny.cobranca_eventos, tiny.cobranca_ciclos, tiny.cobranca_empresas RESTART IDENTITY CASCADE"))


@pytest.fixture
def financeiro(criar_usuario, login):
    uid = criar_usuario("ana", papel="financeiro")
    return SimpleNamespace(id=uid, headers=login("ana"))


ROTAS_GET = ["/inadimplencia/resumo", "/inadimplencia/empresas", "/inadimplencia/indicadores",
             "/inadimplencia/empresas/11111111", "/inadimplencia/empresas/11111111/titulos"]


@pytest.mark.parametrize("rota", ROTAS_GET)
def test_papel_comum_leva_403(client, comum, contas, rota):
    contas(venceu_ha=40)
    assert client.get(rota, headers=comum.headers).status_code == 403


@pytest.mark.parametrize("rota", ROTAS_GET)
def test_sem_token_leva_401(client, rota):
    assert client.get(rota).status_code == 401


@pytest.mark.parametrize("rota", ROTAS_GET)
def test_financeiro_e_admin_leem(client, financeiro, admin, contas, rota):
    contas(venceu_ha=40)
    assert client.get(rota, headers=financeiro.headers).status_code == 200
    assert client.get(rota, headers=admin.headers).status_code == 200


def test_lista_filtra_e_ordena(client, financeiro, contas):
    contas(nome="Alfa", doc="11111111000111", venceu_ha=40, valor=100)
    contas(nome="Beta", doc="22222222000122", venceu_ha=100, valor=50)
    r = client.get("/inadimplencia/empresas", params={"ordenar_por": "maior_atraso", "direcao": "desc"},
                   headers=financeiro.headers).json()
    assert [e["nome"] for e in r["itens"]] == ["Beta", "Alfa"]
    r = client.get("/inadimplencia/empresas", params={"faixa": "31_60"}, headers=financeiro.headers).json()
    assert [e["nome"] for e in r["itens"]] == ["Alfa"]


@pytest.mark.parametrize("params", [{"ordenar_por": "x"}, {"direcao": "lado"}, {"faixa": "x"},
                                    {"status": "inventado"}])
def test_parametros_invalidos_422(client, financeiro, params):
    assert client.get("/inadimplencia/empresas", params=params, headers=financeiro.headers).status_code == 422


def test_empresa_inexistente_404(client, financeiro, contas):
    assert client.get("/inadimplencia/empresas/99999999", headers=financeiro.headers).status_code == 404
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && .venv/bin/pytest tests/test_inadimplencia_api.py -v`
Expected: FAIL — 404 nas rotas (roteador não existe).

- [ ] **Step 3: `exigir_papeis` em `app/core/security.py`**

Logo depois de `exigir_admin`:

```python
def exigir_papeis(*papeis: str):
    """Dependência que deixa passar só os papéis listados — a regra no backend, não só no menu.

    Uso: `usuario: Usuario = Depends(exigir_papeis("admin", "financeiro"))`.
    """
    permitidos = set(papeis)

    def _exigir(usuario: Usuario = Depends(usuario_atual)) -> Usuario:
        if usuario.papel.nome not in permitidos:
            raise HTTPException(status_code=403, detail="Acesso restrito ao financeiro.")
        return usuario

    return _exigir
```

- [ ] **Step 4: O roteador `app/api/endpoints/inadimplencia.py`**

```python
"""Inadimplência: a página de cobrança e indicadores do financeiro.

Todas as rotas exigem admin ou financeiro NO BACKEND — a tela também esconde, mas a
regra não pode morar só nela. Spec: docs/superpowers/specs/2026-10-09-inadimplencia-design.md
"""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core import inadimplencia as consultas
from app.core.contas_agregado import ContaDaTela
from app.core.paginacao import limite_query, offset_query
from app.core.security import exigir_papeis
from app.models.database import SessionLocal
from app.models.usuario import Usuario
from app.services import cobranca

router = APIRouter(prefix="/inadimplencia", tags=["Inadimplência"])
FINANCEIRO = exigir_papeis("admin", "financeiro")
TODOS_OS_STATUS = cobranca.STATUS_DO_SISTEMA | cobranca.STATUS_MANUAIS


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/resumo", response_model=consultas.ResumoDeInadimplencia)
def resumo(db: Session = Depends(get_db), _u: Usuario = Depends(FINANCEIRO)):
    return consultas.resumo(db, date.today())


@router.get("/empresas", response_model=consultas.PaginaDeEmpresas)
def empresas(
    busca: Optional[str] = Query(None, max_length=120),
    status: Optional[List[str]] = Query(None),
    faixa: Optional[str] = Query(None),
    incluir_atraso: bool = Query(False),
    ordenar_por: str = Query("valor"),
    direcao: str = Query("desc", pattern="^(asc|desc)$"),
    limite: int = limite_query(),
    offset: int = offset_query(),
    db: Session = Depends(get_db),
    _u: Usuario = Depends(FINANCEIRO),
):
    if ordenar_por not in consultas.ORDENACOES_DE_EMPRESAS:
        raise HTTPException(422, f"`ordenar_por` deve ser um de: {', '.join(consultas.ORDENACOES_DE_EMPRESAS)}.")
    if faixa is not None and faixa not in consultas.FAIXAS:
        raise HTTPException(422, f"`faixa` deve ser uma de: {', '.join(consultas.FAIXAS)}.")
    if status and not set(status) <= TODOS_OS_STATUS:
        raise HTTPException(422, "Status desconhecido no filtro.")
    return consultas.pagina_de_empresas(
        db, date.today(), busca=busca, status=status, faixa=faixa, incluir_atraso=incluir_atraso,
        ordenar_por=ordenar_por, direcao=direcao, limite=limite, offset=offset)


@router.get("/empresas/{empresa}", response_model=consultas.DetalheDaEmpresa)
def detalhe(empresa: str, db: Session = Depends(get_db), _u: Usuario = Depends(FINANCEIRO)):
    d = consultas.detalhe_da_empresa(db, date.today(), empresa)
    if d is None:
        raise HTTPException(404, "Empresa sem título vencido em aberto.")
    return d


@router.get("/empresas/{empresa}/titulos", response_model=List[ContaDaTela])
def titulos(empresa: str, db: Session = Depends(get_db), _u: Usuario = Depends(FINANCEIRO)):
    return consultas.titulos_da_empresa(db, date.today(), empresa)


@router.get("/indicadores", response_model=consultas.Indicadores)
def indicadores(db: Session = Depends(get_db), _u: Usuario = Depends(FINANCEIRO)):
    return consultas.indicadores(db, date.today())
```

Conferir em `app/core/paginacao.py` que `limite_query` e `offset_query` existem com esses nomes (o `contas_receber.py` os importa de lá).

- [ ] **Step 5: Registrar o roteador**

Em `app/api/endpoints/__init__.py`, ao lado dos outros: `from .inadimplencia import router as inadimplencia`.
Em `app/main.py`, depois de `contas_receber`: `app.include_router(endpoints.inadimplencia, dependencies=PROTEGIDO)`.

- [ ] **Step 6: Rodar e ver passar**

Run: `cd backend && .venv/bin/pytest tests/test_inadimplencia_api.py -v`
Expected: todos passam. Se o caso "sem token leva 401" der 200/403, é porque `AUTH_OBRIGATORIA=false` nos testes — `exigir_papeis` usa `usuario_atual`, que sempre exige token; deve dar 401.

- [ ] **Step 7: Commit**

```bash
git add backend/app/core/security.py backend/app/api/endpoints/inadimplencia.py backend/app/api/endpoints/__init__.py backend/app/main.py backend/tests/test_inadimplencia_api.py
git commit -m "feat(inadimplencia): rotas de leitura restritas a admin e financeiro"
```

---

### Task 5: Rotas de escrita

**Files:**
- Modify: `backend/app/api/endpoints/inadimplencia.py`
- Modify: `backend/tests/test_inadimplencia_api.py`

**Interfaces:**
- Consumes: `cobranca.registrar_evento`, `cobranca.gravar_observacao`, `cobranca.NovoEvento`, `cobranca.ErroDeCobranca` (Task 3).
- Produces: `POST /inadimplencia/empresas/{empresa}/eventos` (corpo `NovoEvento`, resposta `DetalheDaEmpresa`) e `PUT /inadimplencia/empresas/{empresa}/observacao` (corpo `{"texto": str}`, resposta `DetalheDaEmpresa`).

- [ ] **Step 1: Testes que falham** (acrescentar ao arquivo)

```python
def _contato(**extra):
    return {"ocorrido_em": datetime.now(timezone.utc).isoformat(), "canal": "telefone", **extra}


def test_comum_nao_escreve(client, comum, contas):
    contas(venceu_ha=40)
    assert client.post("/inadimplencia/empresas/11111111/eventos", json=_contato(),
                       headers=comum.headers).status_code == 403
    assert client.put("/inadimplencia/empresas/11111111/observacao", json={"texto": "x"},
                      headers=comum.headers).status_code == 403


def test_registra_contato_com_promessa_e_grava_quem(client, financeiro, contas, engine):
    from datetime import date, timedelta

    contas(venceu_ha=40)
    r = client.post("/inadimplencia/empresas/11111111/eventos", headers=financeiro.headers, json=_contato(
        status_novo="promessa", anotacao="Paga na sexta",
        promessa={"data": (date.today() + timedelta(days=3)).isoformat(), "valor": 500}))
    assert r.status_code == 200, r.text
    corpo = r.json()
    assert corpo["ciclo"]["status"] == "promessa"
    assert corpo["eventos"][0]["registrado_por"] == "ana"
    assert corpo["eventos"][0]["anotacao"] == "Paga na sexta"


def test_erro_de_regra_vira_422_com_mensagem(client, financeiro, contas):
    contas(venceu_ha=40)
    r = client.post("/inadimplencia/empresas/11111111/eventos", headers=financeiro.headers,
                    json=_contato(status_novo="pago"))
    assert r.status_code == 422
    assert "sistema" in r.json()["detail"]


def test_observacao(client, financeiro, contas):
    contas(venceu_ha=40)
    r = client.put("/inadimplencia/empresas/11111111/observacao", json={"texto": "Só boleto"},
                   headers=financeiro.headers)
    assert r.status_code == 200
    assert r.json()["observacao"] == "Só boleto"
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && .venv/bin/pytest tests/test_inadimplencia_api.py -v -k "escreve or contato or regra or observacao"`
Expected: FAIL — 405 Method Not Allowed.

- [ ] **Step 3: Implementar** (acrescentar ao roteador)

```python
from pydantic import BaseModel, Field


class TextoDaObservacao(BaseModel):
    texto: str = Field("", max_length=4000)


def _detalhe_ou_404(db, empresa):
    d = consultas.detalhe_da_empresa(db, date.today(), empresa)
    if d is None:
        raise HTTPException(404, "Empresa sem título vencido em aberto.")
    return d


@router.post("/empresas/{empresa}/eventos", response_model=consultas.DetalheDaEmpresa)
def registrar_evento(empresa: str, dados: cobranca.NovoEvento, db: Session = Depends(get_db),
                     usuario: Usuario = Depends(FINANCEIRO)):
    try:
        cobranca.registrar_evento(db, date.today(), empresa, dados, usuario.username)
        db.commit()
    except cobranca.ErroDeCobranca as erro:
        db.rollback()
        raise HTTPException(erro.status_code, str(erro))
    return _detalhe_ou_404(db, empresa)


@router.put("/empresas/{empresa}/observacao", response_model=consultas.DetalheDaEmpresa)
def gravar_observacao(empresa: str, dados: TextoDaObservacao, db: Session = Depends(get_db),
                      usuario: Usuario = Depends(FINANCEIRO)):
    _detalhe_ou_404(db, empresa)
    try:
        cobranca.gravar_observacao(db, empresa, dados.texto, usuario.username)
        db.commit()
    except cobranca.ErroDeCobranca as erro:
        db.rollback()
        raise HTTPException(erro.status_code, str(erro))
    return _detalhe_ou_404(db, empresa)
```

(Mover `from pydantic import BaseModel, Field` para o topo do arquivo com os outros imports.)

- [ ] **Step 4: Rodar a suíte do backend**

Run: `cd backend && .venv/bin/pytest -q`
Expected: tudo passa.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/endpoints/inadimplencia.py backend/tests/test_inadimplencia_api.py
git commit -m "feat(inadimplencia): rotas de registrar contato e observacao"
```

---

### Task 6: Front — serviço, regra pura, rota, menu e o esqueleto da página

**Files:**
- Create: `frontend/src/services/inadimplencia.ts`
- Create: `frontend/src/pages/inadimplencia/inadimplencia.ts`, `frontend/src/pages/inadimplencia/inadimplencia.test.ts`
- Create: `frontend/src/pages/inadimplencia/useInadimplencia.ts`
- Create: `frontend/src/pages/Inadimplencia.tsx`
- Modify: `frontend/src/auth/permissoes.ts`, `frontend/src/router.tsx`, `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/auth/permissoes.test.ts`, `frontend/src/auth/acesso-atual.test.tsx`, `frontend/src/components/Sidebar.test.tsx` (onde listam as rotas/itens, acrescentar `/inadimplencia` — rodar os testes primeiro para ver o que exigem)

**Interfaces:**
- Consumes: as rotas das Tasks 4–5.
- Produces (usados nas Tasks 7–10):
  - tipos `ResumoDeInadimplencia`, `EmpresaDaLista`, `PaginaDeEmpresas`, `DetalheDaEmpresa`, `Filial`, `Ciclo`, `Evento`, `Indicadores`, `MesDeTaxa`, `AnoDeTaxa`, `PontoDeTaxa`, `NovoEvento`, `FiltrosDeEmpresas` — mesmos campos dos modelos Pydantic da Task 2/3, datas como `string`
  - funções `fetchResumo()`, `fetchEmpresas(params)`, `fetchDetalhe(empresa)`, `fetchTitulos(empresa): Promise<ContaDaTela[]>`, `fetchIndicadores()`, `registrarEvento(empresa, dados)`, `gravarObservacao(empresa, texto)` (as duas últimas devolvem `DetalheDaEmpresa`)
  - em `inadimplencia.ts`: `STATUS` (`Record<CodigoDeStatus, {rotulo, variante: BadgeProps["variant"]}>`), `STATUS_MANUAIS`, `CANAIS`, `FAIXAS` (`{chave, rotulo, cor}[]`), `diasDeAtraso(vencimento, hoje)`, `haQuantosDias(iso, agora)`, `formatarPercentual(v)`, `nomeDoMes("AAAA-MM")`, `linhasDaPlanilhaDeEmpresas(empresas)`, `mensagemDeErro(falha)`

- [ ] **Step 1: Testes da regra pura (falham)**

`frontend/src/pages/inadimplencia/inadimplencia.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  STATUS,
  diasDeAtraso,
  formatarPercentual,
  haQuantosDias,
  linhasDaPlanilhaDeEmpresas,
  mensagemDeErro,
  nomeDoMes,
} from "./inadimplencia";

const HOJE = new Date(2026, 9, 9, 15, 0);

describe("inadimplência — regra pura", () => {
  it("dias de atraso contam do vencimento até hoje, sem hora; a vencer é 0", () => {
    expect(diasDeAtraso("2026-10-08", HOJE)).toBe(1);
    expect(diasDeAtraso("2026-09-08", HOJE)).toBe(31);
    expect(diasDeAtraso("2026-10-09", HOJE)).toBe(0);
    expect(diasDeAtraso("2026-10-20", HOJE)).toBe(0);
  });

  it("há quantos dias: hoje, ontem, N dias, nunca", () => {
    expect(haQuantosDias(null, HOJE)).toBe("nunca");
    expect(haQuantosDias("2026-10-09T10:00:00Z", HOJE)).toBe("hoje");
    expect(haQuantosDias("2026-10-08T10:00:00Z", HOJE)).toBe("ontem");
    expect(haQuantosDias("2026-09-27T10:00:00Z", HOJE)).toBe("há 12 dias");
  });

  it("percentual com uma casa, vírgula, e travessão quando não há taxa", () => {
    expect(formatarPercentual(0.158)).toBe("15,8%");
    expect(formatarPercentual(null)).toBe("—");
  });

  it("nome do mês curto", () => {
    expect(nomeDoMes("2026-03")).toBe("mar/26");
  });

  it("todo status tem rótulo e cor", () => {
    for (const s of Object.values(STATUS)) {
      expect(s.rotulo).toBeTruthy();
      expect(s.variante).toBeTruthy();
    }
  });

  it("planilha: dinheiro como número, status pelo rótulo", () => {
    const [linha] = linhasDaPlanilhaDeEmpresas([
      {
        empresa: "11111111", nome: "Alfa", documento: "11.111.111/0001-11", filiais: 1,
        titulos: 2, valor_devido: 300, valor_inadimplente: 200, maior_atraso: 45,
        status: "promessa", proxima_data: "2026-10-15", ultimo_contato: null,
      },
    ]);
    expect(linha).toEqual({
      Empresa: "Alfa", "CNPJ/CPF": "11.111.111/0001-11", Filiais: 1, Títulos: 2,
      "Valor devido": 300, "Valor inadimplente": 200, "Maior atraso (dias)": 45,
      Status: "Promessa de pagamento", "Próxima data": "15/10/2026", "Último contato": "",
    });
  });

  it("mensagem de erro: o detail do backend, senão uma frase padrão", () => {
    expect(mensagemDeErro({ response: { data: { detail: "A data prometida já passou." } } }))
      .toBe("A data prometida já passou.");
    expect(mensagemDeErro(new Error("x"))).toBe("Não foi possível gravar. Tente de novo.");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/pages/inadimplencia/inadimplencia.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: `services/inadimplencia.ts`**

```ts
import type { ContaDaTela, Params } from "./notasapi";
import { criarHttp } from "./http";

/**
 * As chamadas da página de Inadimplência. Arquivo próprio, como `operacao.ts`: o
 * backend é o mesmo (`VITE_NOTAS_URL`), o assunto é outro.
 */
const baseURL =
  import.meta.env.VITE_NOTAS_URL || "https://tinyapi.healthsafetytech.com";
const api = criarHttp(baseURL);

export type CodigoDeStatus =
  | "sem_contato" | "em_contato" | "respondeu" | "promessa" | "quebrada"
  | "negociacao" | "contestado" | "juridico" | "perda" | "pago";

export type ChaveDeFaixa = "atraso" | "31_60" | "61_90" | "90_mais";

export interface Faixa { faixa: ChaveDeFaixa; titulos: number; empresas: number; valor: number }

export interface ResumoDeInadimplencia {
  total_a_receber: number;
  total_vencido: number;
  em_atraso: number;
  inadimplente: number;
  inadimplencia_carteira: number;
  recuperado: number | null;
  titulos_vencidos: number;
  titulos_inadimplentes: number;
  empresas_inadimplentes: number;
  faixas: Faixa[];
  sem_contato: number;
  promessas_7_dias: number;
  promessas_quebradas: number;
  em_negociacao: number;
}

export interface EmpresaDaLista {
  empresa: string;
  nome: string;
  documento: string | null;
  filiais: number;
  titulos: number;
  valor_devido: number;
  valor_inadimplente: number;
  maior_atraso: number;
  status: CodigoDeStatus | null;
  proxima_data: string | null;
  ultimo_contato: string | null;
}

export interface PaginaDeEmpresas { itens: EmpresaDaLista[]; total: number; limite: number; offset: number }

export interface FiltrosDeEmpresas extends Params {
  busca?: string;
  status?: CodigoDeStatus[];
  faixa?: ChaveDeFaixa;
  incluir_atraso?: boolean;
  ordenar_por?: string;
  direcao?: "asc" | "desc";
  limite?: number;
  offset?: number;
}

export interface Filial { cnpj: string; nome: string; titulos: number; valor_vencido: number }

export interface Ciclo {
  id: number;
  status: CodigoDeStatus;
  promessa_data: string | null;
  promessa_valor: number | null;
  promessa_condicoes: string | null;
  aberto_em: string;
  aberto_por: string;
  encerrado_em: string | null;
  ultimo_contato_em: string | null;
}

export interface Evento {
  id: number;
  ciclo_id: number;
  ocorrido_em: string;
  registrado_em: string;
  registrado_por: string;
  tipo: "contato" | "status" | "observacao" | "sistema";
  canal: string | null;
  filial_cnpj: string | null;
  status_anterior: CodigoDeStatus | null;
  status_novo: CodigoDeStatus | null;
  promessa_data: string | null;
  promessa_valor: number | null;
  promessa_condicoes: string | null;
  anotacao: string | null;
  valor_inadimplente: number | null;
}

export interface DetalheDaEmpresa {
  empresa: string;
  nome: string;
  documento: string | null;
  valor_devido: number;
  valor_inadimplente: number;
  maior_atraso: number;
  telefone: string | null;
  email: string | null;
  observacao: string | null;
  observacao_por: string | null;
  observacao_em: string | null;
  filiais: Filial[];
  ciclo: Ciclo | null;
  ciclos_anteriores: Ciclo[];
  eventos: Evento[];
}

export interface PontoDeTaxa {
  valor: number;
  inadimplente: number;
  titulos: number;
  titulos_inadimplentes: number;
  taxa: number | null;
}
export interface MesDeTaxa extends PontoDeTaxa { mes: string; em_apuracao: boolean }
export interface AnoDeTaxa extends PontoDeTaxa { ano: number; ano_corrente: boolean }
export interface Indicadores {
  mensal: MesDeTaxa[];
  anual: AnoDeTaxa[];
  total: PontoDeTaxa;
  desde: string | null;
  ultimo_fechado: MesDeTaxa | null;
  media_12_meses: number | null;
}

export interface NovoEvento {
  ocorrido_em: string;
  canal?: string | null;
  filial_cnpj?: string | null;
  status_novo?: CodigoDeStatus | null;
  promessa?: { data: string; valor?: number | null; condicoes?: string | null } | null;
  anotacao?: string | null;
}

const url = (empresa: string) => `/inadimplencia/empresas/${encodeURIComponent(empresa)}`;

export const fetchResumo = async () =>
  (await api.get<ResumoDeInadimplencia>("/inadimplencia/resumo")).data;
export const fetchEmpresas = async (params: FiltrosDeEmpresas) =>
  (await api.get<PaginaDeEmpresas>("/inadimplencia/empresas", { params })).data;
export const fetchDetalhe = async (empresa: string) =>
  (await api.get<DetalheDaEmpresa>(url(empresa))).data;
export const fetchTitulos = async (empresa: string) =>
  (await api.get<ContaDaTela[]>(`${url(empresa)}/titulos`)).data;
export const fetchIndicadores = async () =>
  (await api.get<Indicadores>("/inadimplencia/indicadores")).data;
export const registrarEvento = async (empresa: string, dados: NovoEvento) =>
  (await api.post<DetalheDaEmpresa>(`${url(empresa)}/eventos`, dados)).data;
export const gravarObservacao = async (empresa: string, texto: string) =>
  (await api.put<DetalheDaEmpresa>(`${url(empresa)}/observacao`, { texto })).data;
```

Conferir em `services/notasapi.ts` como `Params` serializa listas (o `situacao=a&situacao=b` das contas) — `status` precisa sair repetido do mesmo jeito.

- [ ] **Step 4: `pages/inadimplencia/inadimplencia.ts`**

```ts
import type { BadgeProps } from "../../design-system/ui/core/Badge";
import { dataDeCalendario } from "../../lib/datas";
import type { ChaveDeFaixa, CodigoDeStatus, EmpresaDaLista } from "../../services/inadimplencia";

/**
 * A regra da página de Inadimplência que não depende de desenho. Os números vêm
 * somados do backend (`core/inadimplencia.py`); aqui ficam rótulo, cor e formato.
 */

export const STATUS: Record<CodigoDeStatus, { rotulo: string; variante: NonNullable<BadgeProps["variant"]> }> = {
  sem_contato: { rotulo: "Sem contato", variante: "muted" },
  em_contato: { rotulo: "Em contato", variante: "info" },
  respondeu: { rotulo: "Respondeu", variante: "info" },
  promessa: { rotulo: "Promessa de pagamento", variante: "primary" },
  quebrada: { rotulo: "Promessa quebrada", variante: "danger" },
  negociacao: { rotulo: "Em negociação", variante: "warning" },
  contestado: { rotulo: "Contestado", variante: "warning" },
  juridico: { rotulo: "Jurídico / Protesto", variante: "danger" },
  perda: { rotulo: "Perda", variante: "secondary" },
  pago: { rotulo: "Pago", variante: "success" },
};

/** Os que o financeiro escolhe — os outros três só o sistema põe. */
export const STATUS_MANUAIS: CodigoDeStatus[] = [
  "em_contato", "respondeu", "promessa", "negociacao", "contestado", "juridico", "perda",
];

export const CANAIS = [
  { value: "telefone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "presencial", label: "Presencial" },
  { value: "outro", label: "Outro" },
];

/** As quatro faixas, na ordem da barra. Âmbar é atraso; vermelho escurece com a idade. */
export const FAIXAS: { chave: ChaveDeFaixa; rotulo: string; cor: string; tipo: string }[] = [
  { chave: "atraso", rotulo: "1–30 dias", cor: "var(--color-warning-500)", tipo: "Atraso" },
  { chave: "31_60", rotulo: "31–60 dias", cor: "var(--color-danger-400)", tipo: "Inadimplente" },
  { chave: "61_90", rotulo: "61–90 dias", cor: "var(--color-danger-600)", tipo: "Inadimplente" },
  { chave: "90_mais", rotulo: "Mais de 90 dias", cor: "var(--color-danger-700)", tipo: "Inadimplente" },
];

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIA = 86_400_000;

function meiaNoite(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function diasDeAtraso(vencimento: string | null, hoje: Date): number {
  if (!vencimento) return 0;
  const [a, m, d] = vencimento.slice(0, 10).split("-").map(Number);
  const dias = Math.round((meiaNoite(hoje) - new Date(a, m - 1, d).getTime()) / DIA);
  return Math.max(0, dias);
}

export function haQuantosDias(iso: string | null, agora: Date): string {
  if (!iso) return "nunca";
  const dias = Math.round((meiaNoite(agora) - meiaNoite(new Date(iso))) / DIA);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

export function formatarPercentual(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function nomeDoMes(mes: string): string {
  const [a, m] = mes.split("-");
  return `${MESES[Number(m) - 1]}/${a.slice(2)}`;
}

export function linhasDaPlanilhaDeEmpresas(empresas: EmpresaDaLista[]): Record<string, unknown>[] {
  return empresas.map((e) => ({
    Empresa: e.nome,
    "CNPJ/CPF": e.documento ?? "",
    Filiais: e.filiais,
    Títulos: e.titulos,
    "Valor devido": e.valor_devido,
    "Valor inadimplente": e.valor_inadimplente,
    "Maior atraso (dias)": e.maior_atraso,
    Status: e.status ? STATUS[e.status].rotulo : "",
    "Próxima data": e.proxima_data ? dataDeCalendario(e.proxima_data) : "",
    "Último contato": e.ultimo_contato ? dataDeCalendario(e.ultimo_contato) : "",
  }));
}

export function mensagemDeErro(falha: unknown): string {
  const detalhe = (falha as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detalhe === "string" ? detalhe : "Não foi possível gravar. Tente de novo.";
}
```

`BadgeProps` vem direto de `core/Badge.tsx` porque o `index.ts` do design system só reexporta o componente. Conferir também se `dataDeCalendario` aceita ISO com hora (`2026-10-09T10:00:00Z`) — a planilha de Contas documenta que aceita.

- [ ] **Step 5: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/pages/inadimplencia/inadimplencia.test.ts`
Expected: PASS

- [ ] **Step 6: Hooks `useInadimplencia.ts`** — o padrão de `pages/contas/useContas.ts` (estado guarda a chave do pedido; "carregando" é derivado; erro zera em vez de manter número velho):

```ts
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchDetalhe, fetchEmpresas, fetchIndicadores, fetchResumo, fetchTitulos,
  type DetalheDaEmpresa, type FiltrosDeEmpresas, type Indicadores,
  type PaginaDeEmpresas, type ResumoDeInadimplencia,
} from "../../services/inadimplencia";
import type { ContaDaTela } from "../../services/notasapi";

/** Busca por chave: troca a chave, busca de novo; `recarregar` força. */
function useBusca<T>(chave: string | null, buscar: () => Promise<T>, mensagem: string) {
  const [estado, setEstado] = useState<{ chave: string; dado: T | null; erro: string | null } | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (chave === null) return;
    let vivo = true;
    buscar()
      .then((dado) => vivo && setEstado({ chave, dado, erro: null }))
      .catch((falha) => {
        console.error(mensagem, falha);
        if (vivo) setEstado({ chave, dado: null, erro: mensagem });
      });
    return () => { vivo = false; };
    // `buscar` muda a cada render; quem decide a busca é a chave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, versao]);

  return {
    dado: estado?.chave === chave ? estado.dado : null,
    carregando: chave !== null && estado?.chave !== chave,
    erro: estado?.chave === chave ? estado.erro : null,
    recarregar: useCallback(() => setVersao((v) => v + 1), []),
  };
}

export function useResumo() {
  return useBusca<ResumoDeInadimplencia>("resumo", fetchResumo, "Não foi possível carregar a inadimplência.");
}

export function useEmpresas(filtros: FiltrosDeEmpresas) {
  const chave = useMemo(() => JSON.stringify(filtros), [filtros]);
  return useBusca<PaginaDeEmpresas>(chave, () => fetchEmpresas(JSON.parse(chave)), "Não foi possível carregar a lista.");
}

export function useDetalhe(empresa: string | null) {
  return useBusca<DetalheDaEmpresa>(empresa, () => fetchDetalhe(empresa!), "Não foi possível carregar a empresa.");
}

export function useTitulos(empresa: string | null) {
  return useBusca<ContaDaTela[]>(empresa, () => fetchTitulos(empresa!), "Não foi possível carregar os títulos.");
}

export function useIndicadores(ativo: boolean) {
  return useBusca<Indicadores>(ativo ? "indicadores" : null, fetchIndicadores, "Não foi possível carregar os indicadores.");
}

/** Todas as empresas do filtro, página a página — só para a planilha. */
export async function todasAsEmpresas(filtros: FiltrosDeEmpresas) {
  const todas: PaginaDeEmpresas["itens"] = [];
  for (let offset = 0; ; offset += 1000) {
    const r = await fetchEmpresas({ ...filtros, limite: 1000, offset });
    todas.push(...r.itens);
    if (offset + 1000 >= r.total) return todas;
  }
}
```

`LIMITE_MAXIMO` de `backend/app/core/paginacao.py` é 1000 — o laço usa exatamente esse teto.

- [ ] **Step 7: Permissão, rota e menu**

`auth/permissoes.ts`, depois de `/contas-receber`:

```ts
  // Inadimplência: nome de cliente, valor devido e conversa de cobrança. A API
  // também barra (exigir_papeis) — esta linha só decide o menu e o guarda.
  "/inadimplencia": { tipo: "papeis", papeis: ["admin", "financeiro"] },
```

`router.tsx`: `const Inadimplencia = lazy(() => import("./pages/Inadimplencia"));` junto dos outros `lazy`, e a rota logo depois de `/contas-receber`, igual a ela:

```tsx
      <Route
        path="/inadimplencia"
        element={
          <ProtectedRoute>
            <RequirePermissao rota="/inadimplencia">
              <Inadimplencia />
            </RequirePermissao>
          </ProtectedRoute>
        }
      />
```

`components/Sidebar.tsx`, no grupo Financeiro, depois de "Contas a receber":

```tsx
        { label: "Inadimplência", path: "/inadimplencia", icon: "alert" },
```

Conferir em `design-system/ui/core/Icon.tsx` (`ICON_PATHS`) qual nome de alerta existe; se nenhum servir, usar o `AlertTriangle` do `lucide-react` como o item "Locação" faz com `KeyRound`.

- [ ] **Step 8: Esqueleto da página `pages/Inadimplencia.tsx`**

```tsx
import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../design-system/ui";
import { useAuth } from "../hooks/useAuth";
import { CabecalhoContas } from "./contas/CabecalhoContas";
import { AbaCobranca } from "./inadimplencia/AbaCobranca";
import { AbaIndicadores } from "./inadimplencia/AbaIndicadores";

/**
 * Inadimplência — a cobrança do dia a dia e o indicador para acompanhar.
 * Spec: docs/superpowers/specs/2026-10-09-inadimplencia-design.md
 */
export default function Inadimplencia() {
  const { user } = useAuth();
  const [aba, setAba] = useState("cobranca");
  return (
    <div className="min-h-screen bg-surface-base p-6 transition-colors md:h-full md:min-h-0">
      <div className="flex flex-col gap-6">
        <CabecalhoContas
          titulo="Inadimplência"
          descricao="Quem está devendo, a cobrança de cada empresa e se a inadimplência está melhorando ou piorando."
          usuario={user}
        />
        <Tabs value={aba} onChange={setAba}>
          <TabsList>
            <TabsTrigger value="cobranca">Cobrança</TabsTrigger>
            <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
          </TabsList>
          <TabsContent value="cobranca" className="mt-6"><AbaCobranca /></TabsContent>
          <TabsContent value="indicadores" className="mt-6"><AbaIndicadores ativo={aba === "indicadores"} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
```

Nesta Task, `AbaCobranca` e `AbaIndicadores` nascem como componentes que só desenham `<p>Em construção</p>` — as Tasks 7 e 10 os preenchem. Conferir as props de `CabecalhoContas` no arquivo (o uso acima é o de `TelaDeContas`).

- [ ] **Step 9: Testes de permissão e menu**

Run: `cd frontend && npx vitest run src/auth src/components/Sidebar.test.tsx`
Ajustar os testes que enumeram rotas/itens para incluir `/inadimplencia` com admin e financeiro liberados e `vendas`/`servicos` barrados — o mesmo formato das linhas de `/contas-receber`.
Expected: PASS

- [ ] **Step 10: Typecheck e commit**

Run: `cd frontend && npx tsc -b --noEmit 2>&1 | grep -v Radio.test` (o erro em `Radio.test.tsx` já existia)
Expected: nenhuma linha.

```bash
git add frontend/src/services/inadimplencia.ts frontend/src/pages/inadimplencia frontend/src/pages/Inadimplencia.tsx frontend/src/auth/permissoes.ts frontend/src/router.tsx frontend/src/components/Sidebar.tsx frontend/src/auth/permissoes.test.ts frontend/src/auth/acesso-atual.test.tsx frontend/src/components/Sidebar.test.tsx
git commit -m "feat(inadimplencia): rota, menu, servico e esqueleto da pagina"
```

---

### Task 7: Front — aba Cobrança: cards, faixas, filtros e a lista

**Files:**
- Create: `frontend/src/pages/inadimplencia/servidorFalso.ts`
- Create: `frontend/src/pages/inadimplencia/TabelaDeEmpresas.tsx`
- Modify: `frontend/src/pages/inadimplencia/AbaCobranca.tsx`
- Create: `frontend/src/pages/Inadimplencia.test.tsx`

**Interfaces:**
- Consumes: serviço, hooks e regra da Task 6; `KpiCard`, `FilterBar`, `MultiSelect`, `Select`, `Switch`/`Checkbox`, `Card`, `CardTitle`, `Input`, `Table*`, `Pagination`, `Badge`, `Button` do design system; `baixarPlanilha` de `lib/planilha`; `formatarMoeda` de `pages/contas/contas`; `ariaSort` de `lib/ariaSort`.
- Produces: `<TabelaDeEmpresas empresas total pagina onPagina pesquisa onPesquisar ordenacao onOrdenar onExportar onAbrir />`; `AbaCobranca` abre o modal com `empresaAberta: string | null` (o modal entra na Task 8).

- [ ] **Step 1: Servidor falso**

`servidorFalso.ts` — um objeto mutável que os testes configuram e um `vi.mock` usa:

```ts
import type {
  DetalheDaEmpresa, EmpresaDaLista, FiltrosDeEmpresas, Indicadores, NovoEvento, ResumoDeInadimplencia,
} from "../../services/inadimplencia";
import type { ContaDaTela } from "../../services/notasapi";

/** Dublê do backend da Inadimplência para os testes de tela. Não prova SQL — prova desenho. */
export function criarServidorDeInadimplencia() {
  const estado = {
    modo: "ok" as "ok" | "falha" | "pendente",
    resumo: null as ResumoDeInadimplencia | null,
    empresas: [] as EmpresaDaLista[],
    detalhes: {} as Record<string, DetalheDaEmpresa>,
    titulos: {} as Record<string, ContaDaTela[]>,
    indicadores: null as Indicadores | null,
    pedidos: [] as FiltrosDeEmpresas[],
    eventos: [] as { empresa: string; dados: NovoEvento }[],
    observacoes: [] as { empresa: string; texto: string }[],
    erroDeGravacao: null as string | null,
  };
  const responder = <T,>(valor: () => T): Promise<T> => {
    if (estado.modo === "falha") return Promise.reject(new Error("500"));
    if (estado.modo === "pendente") return new Promise<T>(() => {});
    return Promise.resolve(valor());
  };
  const recusar = () =>
    Promise.reject({ response: { data: { detail: estado.erroDeGravacao } } });

  const servico = {
    fetchResumo: () => responder(() => estado.resumo!),
    fetchEmpresas: (f: FiltrosDeEmpresas) => responder(() => {
      estado.pedidos.push(f);
      let lista = [...estado.empresas];
      if (f.busca) lista = lista.filter((e) => e.nome.toLowerCase().includes(f.busca!.toLowerCase()));
      if (f.status?.length) lista = lista.filter((e) => e.status && f.status!.includes(e.status));
      const offset = f.offset ?? 0;
      return { itens: lista.slice(offset, offset + (f.limite ?? 15)), total: lista.length,
               limite: f.limite ?? 15, offset };
    }),
    fetchDetalhe: (e: string) => responder(() => estado.detalhes[e]),
    fetchTitulos: (e: string) => responder(() => estado.titulos[e] ?? []),
    fetchIndicadores: () => responder(() => estado.indicadores!),
    registrarEvento: (empresa: string, dados: NovoEvento) => {
      if (estado.erroDeGravacao) return recusar();
      estado.eventos.push({ empresa, dados });
      return Promise.resolve(estado.detalhes[empresa]);
    },
    gravarObservacao: (empresa: string, texto: string) => {
      if (estado.erroDeGravacao) return recusar();
      estado.observacoes.push({ empresa, texto });
      return Promise.resolve({ ...estado.detalhes[empresa], observacao: texto || null });
    },
  };
  return { estado, servico };
}
```

- [ ] **Step 2: Testes de tela (falham)**

`pages/Inadimplencia.test.tsx` — cabeçalho com mocks no padrão de `ContasReceber.test.tsx` (`vi.hoisted`, `Molde` com `AuthContext`, `vi.mock("xlsx")` e `vi.mock("recharts")` copiados de lá):

```tsx
import type { ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Inadimplencia from "./Inadimplencia";
import { AuthContext } from "../context/AuthContext";
import type { EmpresaDaLista, ResumoDeInadimplencia } from "../services/inadimplencia";

const falso = vi.hoisted(() => ({ atual: null as null | ReturnType<typeof import("./inadimplencia/servidorFalso").criarServidorDeInadimplencia> }));

vi.mock("../services/inadimplencia", async () => {
  const { criarServidorDeInadimplencia } = await import("./inadimplencia/servidorFalso");
  falso.atual = criarServidorDeInadimplencia();
  return falso.atual.servico;
});

const planilha = vi.hoisted(() => ({ linhas: [] as unknown[] }));
vi.mock("../lib/planilha", () => ({
  baixarPlanilha: (abas: { linhas: unknown[] }[]) => { planilha.linhas = abas[0].linhas; },
}));

function Molde({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={{ user: { id: 1, username: "ana", role: "financeiro" }, token: "t",
      loading: false, login: vi.fn(), entrarComToken: vi.fn(), logout: vi.fn(), error: null }}>
      {children}
    </AuthContext.Provider>
  );
}

const RESUMO: ResumoDeInadimplencia = {
  total_a_receber: 10000, total_vencido: 4000, em_atraso: 1000, inadimplente: 3000,
  inadimplencia_carteira: 0.3, recuperado: 0.8, titulos_vencidos: 12, titulos_inadimplentes: 8,
  empresas_inadimplentes: 3,
  faixas: [
    { faixa: "atraso", titulos: 4, empresas: 2, valor: 1000 },
    { faixa: "31_60", titulos: 3, empresas: 2, valor: 1500 },
    { faixa: "61_90", titulos: 1, empresas: 1, valor: 500 },
    { faixa: "90_mais", titulos: 4, empresas: 1, valor: 1000 },
  ],
  sem_contato: 2, promessas_7_dias: 1, promessas_quebradas: 0, em_negociacao: 0,
};

function empresa(campos: Partial<EmpresaDaLista> & { empresa: string; nome: string }): EmpresaDaLista {
  return { documento: "11.111.111/0001-11", filiais: 1, titulos: 1, valor_devido: 100,
           valor_inadimplente: 100, maior_atraso: 40, status: "sem_contato", proxima_data: null,
           ultimo_contato: null, ...campos };
}

const EMPRESAS = [
  empresa({ empresa: "11111111", nome: "Alfa Ltda", valor_devido: 2000, maior_atraso: 95, status: "promessa", proxima_data: "2026-10-15", ultimo_contato: "2026-10-01T10:00:00Z" }),
  empresa({ empresa: "22222222", nome: "Beta SA", documento: "22.222.222 · 3 filiais", filiais: 3, titulos: 5, valor_devido: 1500, maior_atraso: 45 }),
];

async function assentar() { await act(async () => { await Promise.resolve(); }); }

async function montar() {
  render(<Inadimplencia />, { wrapper: Molde });
  await assentar();
  await assentar();
}

beforeEach(() => {
  const e = falso.atual!.estado;
  Object.assign(e, { modo: "ok", resumo: RESUMO, empresas: EMPRESAS, pedidos: [], eventos: [],
                     observacoes: [], erroDeGravacao: null });
});

describe("Inadimplência — aba Cobrança", () => {
  it("mostra os cards do resumo", async () => {
    await montar();
    expect(screen.getByText("Inadimplente (mais de 30 dias)")).toBeInTheDocument();
    expect(screen.getByText("30,0%")).toBeInTheDocument();
    expect(screen.getByText("80,0%")).toBeInTheDocument();
  });

  it("a lista mostra nome, CNPJ, status e próxima data, como a tabela de Contas", async () => {
    await montar();
    const linhas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(linhas).toHaveLength(2);
    expect(within(linhas[0]).getByText("Alfa Ltda")).toBeInTheDocument();
    expect(within(linhas[0]).getByText("11.111.111/0001-11")).toBeInTheDocument();
    expect(within(linhas[0]).getByText("Promessa de pagamento")).toBeInTheDocument();
    expect(within(linhas[0]).getByText("15/10/2026")).toBeInTheDocument();
    expect(within(linhas[1]).getByText("22.222.222 · 3 filiais")).toBeInTheDocument();
    expect(within(linhas[1]).getByText("nunca")).toBeInTheDocument();
  });

  it("clicar numa faixa filtra a lista por ela", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /61–90 dias/ }));
    await assentar();
    expect(falso.atual!.estado.pedidos.at(-1)?.faixa).toBe("61_90");
  });

  it("buscar volta para a página 1 e manda a busca", async () => {
    await montar();
    fireEvent.change(screen.getByLabelText("Pesquisar empresas"), { target: { value: "beta" } });
    await assentar();
    const ultimo = falso.atual!.estado.pedidos.at(-1)!;
    expect(ultimo.busca).toBe("beta");
    expect(ultimo.offset).toBe(0);
  });

  it("ordenar pelo cabeçalho pede a ordenação ao servidor", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /Maior atraso/ }));
    await assentar();
    expect(falso.atual!.estado.pedidos.at(-1)?.ordenar_por).toBe("maior_atraso");
  });

  it("exportar leva todas as empresas do filtro", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /Exportar/ }));
    await assentar();
    expect(planilha.linhas).toHaveLength(2);
  });

  it("falha de carregamento avisa em bloco", async () => {
    falso.atual!.estado.modo = "falha";
    await montar();
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar");
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/pages/Inadimplencia.test.tsx`
Expected: FAIL — os textos não existem (abas ainda "Em construção").

- [ ] **Step 4: `TabelaDeEmpresas.tsx`** — mesmo esqueleto de `pages/contas/TabelaDeContas.tsx` (copiar o cabeçalho do card com busca e exportar, o `<button>` dentro do `<th>` com `ChevronUp/ChevronDown` e `aria-sort`, o `Pagination` com `itemLabel="empresas"`). As colunas:

```tsx
import { ChevronDown, ChevronUp, Download, Search } from "lucide-react";

import {
  Badge, Button, Card, CardTitle, Input, Pagination, Table, TableBody, TableCell,
  TableEmpty, TableHead, TableHeaderCell, TableRow,
} from "../../design-system/ui";
import { ariaSort } from "../../lib/ariaSort";
import { dataDeCalendario } from "../../lib/datas";
import type { EmpresaDaLista } from "../../services/inadimplencia";
import { ITENS_POR_PAGINA, formatarMoeda, type Ordenacao } from "../contas/contas";
import { STATUS, haQuantosDias } from "./inadimplencia";

const COLUNAS = [
  { campo: "nome", rotulo: "Empresa" },
  { campo: "titulos", rotulo: "Títulos" },
  { campo: "valor", rotulo: "Valor devido" },
  { campo: "maior_atraso", rotulo: "Maior atraso" },
  { campo: "status", rotulo: "Status" },
  { campo: "proxima_data", rotulo: "Próxima data" },
  { campo: "ultimo_contato", rotulo: "Último contato" },
] as const;

export interface TabelaDeEmpresasProps {
  empresas: EmpresaDaLista[];
  total: number;
  pagina: number;
  onPagina: (p: number) => void;
  pesquisa: string;
  onPesquisar: (t: string) => void;
  ordenacao: Ordenacao;
  onOrdenar: (campo: string) => void;
  onExportar: () => void;
  onAbrir: (empresa: string) => void;
  hoje: Date;
}

function SeloDeAtraso({ dias }: { dias: number }) {
  const variante = dias > 90 ? "danger" : dias > 30 ? "danger" : "warning";
  return <Badge variant={variante}>{dias} dias</Badge>;
}

export function TabelaDeEmpresas(props: TabelaDeEmpresasProps) {
  const { empresas, total, pagina, onPagina, pesquisa, onPesquisar, ordenacao, onOrdenar, onExportar, onAbrir, hoje } = props;
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  return (
    <Card padding="none">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borda p-4">
        <CardTitle>Empresas devedoras</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Pesquisar nome ou CNPJ..."
              aria-label="Pesquisar empresas"
              value={pesquisa}
              onChange={(e) => onPesquisar(e.target.value)}
              icon={<Search className="h-4 w-4" strokeWidth={2} aria-hidden="true" />}
            />
          </div>
          <Button variant="secondary" onClick={onExportar} disabled={total === 0}>
            <Download className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Exportar planilha
          </Button>
        </div>
      </div>
      <Table>
        <TableHead>
          <TableRow>
            {COLUNAS.map((c) => (
              <TableHeaderCell key={c.campo} aria-sort={ariaSort(ordenacao.campo === c.campo, ordenacao.direcao)}>
                <button type="button" onClick={() => onOrdenar(c.campo)} className="inline-flex items-center gap-1">
                  {c.rotulo}
                  {ordenacao.campo === c.campo ? (
                    ordenacao.direcao === "asc"
                      ? <ChevronUp className="h-3 w-3" aria-hidden="true" />
                      : <ChevronDown className="h-3 w-3" aria-hidden="true" />
                  ) : null}
                </button>
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {empresas.length === 0 ? (
            <TableEmpty colSpan={COLUNAS.length}>Nenhuma empresa encontrada.</TableEmpty>
          ) : empresas.map((e) => (
            <TableRow key={e.empresa} clickable onClick={() => onAbrir(e.empresa)}>
              <TableCell className="min-w-[220px]">
                <p className="font-medium">{e.nome}</p>
                {e.documento ? <p className="font-mono text-xs text-conteudo-muted">{e.documento}</p> : null}
              </TableCell>
              <TableCell className="font-mono">{e.titulos}</TableCell>
              <TableCell className="whitespace-nowrap font-mono font-semibold text-action">{formatarMoeda(e.valor_devido)}</TableCell>
              <TableCell><SeloDeAtraso dias={e.maior_atraso} /></TableCell>
              <TableCell>{e.status ? <Badge variant={STATUS[e.status].variante}>{STATUS[e.status].rotulo}</Badge> : "—"}</TableCell>
              <TableCell className={`whitespace-nowrap font-mono text-xs ${e.proxima_data && e.proxima_data < hojeIso ? "text-danger" : ""}`}>
                {e.proxima_data ? dataDeCalendario(e.proxima_data) : "—"}
              </TableCell>
              <TableCell muted className="whitespace-nowrap text-xs">{haQuantosDias(e.ultimo_contato, hoje)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {total > 0 ? (
        <div className="border-t border-borda p-4">
          <Pagination page={pagina} pageSize={ITENS_POR_PAGINA} total={total} onPageChange={onPagina} itemLabel="empresas" />
        </div>
      ) : null}
    </Card>
  );
}
```

Antes de escrever, abrir `TabelaDeContas.tsx` e copiar **exatamente** as classes do `<button>` de cabeçalho e as props de `TableEmpty`/`Button` que ela usa — o trecho acima mostra a estrutura, as classes têm de bater com as de lá. A célula de valor usa `text-action` como a coluna Valor de Contas.

- [ ] **Step 5: `AbaCobranca.tsx`**

```tsx
import { useCallback, useMemo, useState } from "react";

import { Alert, FilterBar, KpiCard, MultiSelect, Spinner, Switch } from "../../design-system/ui";
import { baixarPlanilha } from "../../lib/planilha";
import type { ChaveDeFaixa, CodigoDeStatus } from "../../services/inadimplencia";
import { ITENS_POR_PAGINA, formatarMoeda, nomeDoArquivo, proximaOrdenacao, type Ordenacao } from "../contas/contas";
import { FAIXAS, STATUS, formatarPercentual, linhasDaPlanilhaDeEmpresas } from "./inadimplencia";
import { ModalDaEmpresa } from "./ModalDaEmpresa";
import { TabelaDeEmpresas } from "./TabelaDeEmpresas";
import { todasAsEmpresas, useEmpresas, useResumo } from "./useInadimplencia";

const ORDENACAO_INICIAL: Ordenacao = { campo: "valor", direcao: "desc" };

export function AbaCobranca() {
  const resumo = useResumo();
  const [status, setStatus] = useState<CodigoDeStatus[]>([]);
  const [faixa, setFaixa] = useState<ChaveDeFaixa | null>(null);
  const [incluirAtraso, setIncluirAtraso] = useState(false);
  const [pesquisa, setPesquisa] = useState("");
  const [pagina, setPagina] = useState(1);
  const [ordenacao, setOrdenacao] = useState(ORDENACAO_INICIAL);
  const [aberta, setAberta] = useState<string | null>(null);
  const hoje = useMemo(() => new Date(), []);

  const filtros = useMemo(() => ({
    busca: pesquisa.trim() || undefined,
    status: status.length ? status : undefined,
    faixa: faixa ?? undefined,
    incluir_atraso: incluirAtraso || faixa === "atraso" || undefined,
    ordenar_por: ordenacao.campo,
    direcao: ordenacao.direcao,
    limite: ITENS_POR_PAGINA,
    offset: (pagina - 1) * ITENS_POR_PAGINA,
  }), [pesquisa, status, faixa, incluirAtraso, ordenacao, pagina]);
  const lista = useEmpresas(filtros);

  const mudou = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPagina(1); };

  const exportar = useCallback(async () => {
    try {
      const { limite: _l, offset: _o, ...semPagina } = filtros;
      const linhas = linhasDaPlanilhaDeEmpresas(await todasAsEmpresas(semPagina));
      baixarPlanilha([{ nome: "Inadimplência", linhas }], nomeDoArquivo("inadimplencia", new Date()));
    } catch (falha) {
      console.error("Erro ao exportar a inadimplência:", falha);
    }
  }, [filtros]);

  const r = resumo.dado;
  if (resumo.carregando) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  return (
    <div className="flex flex-col gap-6">
      {resumo.erro || lista.erro ? <Alert variant="danger">{resumo.erro ?? lista.erro}</Alert> : null}

      {r ? (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
            <KpiCard label="Total vencido não pago" value={formatarMoeda(r.total_vencido)} tone="acao" note={`${r.titulos_vencidos} títulos`} />
            <KpiCard label="Em atraso (até 30 dias)" value={formatarMoeda(r.em_atraso)} tone="alerta" />
            <KpiCard label="Inadimplente (mais de 30 dias)" value={formatarMoeda(r.inadimplente)} tone="perigo" note={`${r.titulos_inadimplentes} títulos · ${r.empresas_inadimplentes} empresas`} />
            <KpiCard label="Inadimplência da carteira" value={formatarPercentual(r.inadimplencia_carteira)} tone="perigo" note={`do total a receber (${formatarMoeda(r.total_a_receber)})`} />
            <KpiCard label="Recuperado depois do atraso" value={formatarPercentual(r.recuperado)} tone="positivo" note="do que passou de 30 dias, quanto entrou depois" />
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {([
              ["Sem contato", r.sem_contato, "sem_contato"],
              ["Promessas nos próximos 7 dias", r.promessas_7_dias, "promessa"],
              ["Promessas quebradas", r.promessas_quebradas, "quebrada"],
              ["Em negociação", r.em_negociacao, "negociacao"],
            ] as const).map(([rotulo, n, s]) => (
              <button key={s} type="button" className="text-left" onClick={() => mudou(setStatus)([s])} aria-label={`Filtrar: ${rotulo}`}>
                <KpiCard label={rotulo} value={n} tone={s === "quebrada" && n > 0 ? "perigo" : "neutro"} />
              </button>
            ))}
          </div>

          <BarraDeFaixas faixas={r.faixas} total={r.total_vencido} ativa={faixa}
            onEscolher={(f) => mudou(setFaixa)(faixa === f ? null : f)} />
        </>
      ) : null}

      <FilterBar>
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
          <MultiSelect
            rotulo="Status"
            opcoes={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.rotulo }))}
            selecionados={status}
            onChange={(v) => mudou(setStatus)(v as CodigoDeStatus[])}
            placeholder="Todos"
          />
          <Switch
            label="Incluir empresas só em atraso (1–30 dias)"
            checked={incluirAtraso}
            onChange={(e) => mudou(setIncluirAtraso)(e.target.checked)}
          />
        </div>
      </FilterBar>

      <TabelaDeEmpresas
        empresas={lista.dado?.itens ?? []}
        total={lista.dado?.total ?? 0}
        pagina={pagina}
        onPagina={setPagina}
        pesquisa={pesquisa}
        onPesquisar={mudou(setPesquisa)}
        ordenacao={ordenacao}
        onOrdenar={(c) => { setOrdenacao((a) => proximaOrdenacao(a, c)); setPagina(1); }}
        onExportar={exportar}
        onAbrir={setAberta}
        hoje={hoje}
      />

      <ModalDaEmpresa empresa={aberta} onFechar={() => setAberta(null)} onGravou={() => { resumo.recarregar(); lista.recarregar(); }} />
    </div>
  );
}

function BarraDeFaixas({ faixas, total, ativa, onEscolher }: {
  faixas: { faixa: ChaveDeFaixa; titulos: number; empresas: number; valor: number }[];
  total: number;
  ativa: ChaveDeFaixa | null;
  onEscolher: (f: ChaveDeFaixa) => void;
}) {
  const por = new Map(faixas.map((f) => [f.faixa, f]));
  return (
    <div className="rounded-xl border border-borda bg-surface p-5">
      <h2 className="text-base font-semibold text-conteudo-heading">Por tempo de atraso</h2>
      <p className="mb-3 text-xs text-conteudo-muted">
        Até 30 dias é <b>atraso</b> — costuma ser pago. Depois de 30 dias é <b>inadimplência</b>. Clique numa faixa para filtrar a lista.
      </p>
      <div className="mb-4 flex h-8 overflow-hidden rounded-lg" aria-hidden="true">
        {FAIXAS.map((f) => {
          const v = por.get(f.chave)?.valor ?? 0;
          return v > 0 ? <div key={f.chave} style={{ width: `${(v / total) * 100}%`, background: f.cor }} /> : null;
        })}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {FAIXAS.map((f) => {
          const d = por.get(f.chave);
          return (
            <button key={f.chave} type="button" aria-pressed={ativa === f.chave} onClick={() => onEscolher(f.chave)}
              className={`rounded-lg border p-3 text-left transition-colors ${ativa === f.chave ? "border-action bg-action-tint" : "border-borda hover:bg-surface-elevated"}`}>
              <span className="flex items-center gap-2 text-xs font-semibold">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: f.cor }} />{f.rotulo}
              </span>
              <span className="mt-1 block font-mono text-base font-bold text-conteudo-heading">{formatarMoeda(d?.valor ?? 0)}</span>
              <span className="block text-xs text-conteudo-muted">{d?.titulos ?? 0} títulos · {d?.empresas ?? 0} empresas</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

Para a Task 7 passar sozinha, criar `ModalDaEmpresa.tsx` mínimo: `export function ModalDaEmpresa(_: { empresa: string | null; onFechar: () => void; onGravou: () => void }) { return null; }` — a Task 8 o substitui. Conferir as props reais de `Switch` (se não tiver `label`, usar `Checkbox`) e de `MultiSelect`/`deTextos` em `FiltrosDeContas.tsx`.

- [ ] **Step 6: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/pages/Inadimplencia.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/inadimplencia frontend/src/pages/Inadimplencia.test.tsx
git commit -m "feat(inadimplencia): aba Cobranca com cards, faixas e lista de empresas"
```

---

### Task 8: Front — modal da empresa: cabeçalho, observação, Títulos e linha do tempo

**Files:**
- Modify: `frontend/src/pages/contas/TabelaDeContas.tsx` (exportar `SeloDeSituacao`)
- Modify: `frontend/src/pages/inadimplencia/ModalDaEmpresa.tsx`
- Create: `frontend/src/pages/inadimplencia/TitulosDaEmpresa.tsx`, `frontend/src/pages/inadimplencia/LinhaDoTempo.tsx`
- Modify: `frontend/src/pages/Inadimplencia.test.tsx`

**Interfaces:**
- Consumes: `useDetalhe`, `useTitulos`, `gravarObservacao`, `mensagemDeErro`, `STATUS`, `CANAIS`, `diasDeAtraso`; `Modal`, `Tabs*`, `Textarea`, `Button`, `Badge`, `Table*` do design system; `SeloDeSituacao`, `colunasDeContas` de `TabelaDeContas`.
- Produces: `<ModalDaEmpresa empresa onFechar onGravou />` com um slot para o formulário da Task 9 (`<FormularioDeContato>` entra lá).

- [ ] **Step 1: Testes (falham)** — acrescentar ao `Inadimplencia.test.tsx` uma semente de detalhe e títulos:

```tsx
import type { DetalheDaEmpresa } from "../services/inadimplencia";
import type { ContaDaTela } from "../services/notasapi";

const DETALHE: DetalheDaEmpresa = {
  empresa: "11111111", nome: "Alfa Ltda", documento: "11.111.111 · 2 filiais", valor_devido: 2000,
  valor_inadimplente: 1500, maior_atraso: 95, telefone: "(11) 0000-0000", email: "fin@alfa.exemplo",
  observacao: "Só boleto por e-mail", observacao_por: "ana", observacao_em: "2026-10-01T10:00:00Z",
  filiais: [
    { cnpj: "11111111000111", nome: "Alfa Ltda - A", titulos: 1, valor_vencido: 1500 },
    { cnpj: "11111111000222", nome: "Alfa Ltda - B", titulos: 1, valor_vencido: 500 },
  ],
  ciclo: { id: 1, status: "promessa", promessa_data: "2026-10-15", promessa_valor: 1000,
           promessa_condicoes: "Metade agora", aberto_em: "2026-09-01T00:00:00Z", aberto_por: "sistema",
           encerrado_em: null, ultimo_contato_em: "2026-10-01T10:00:00Z" },
  ciclos_anteriores: [],
  eventos: [
    { id: 2, ciclo_id: 1, ocorrido_em: "2026-10-01T10:00:00Z", registrado_em: "2026-10-01T10:05:00Z",
      registrado_por: "ana", tipo: "contato", canal: "telefone", filial_cnpj: "11111111000111",
      status_anterior: "sem_contato", status_novo: "promessa", promessa_data: "2026-10-15",
      promessa_valor: 1000, promessa_condicoes: "Metade agora", anotacao: "Falei com a Joana",
      valor_inadimplente: 1500 },
    { id: 1, ciclo_id: 1, ocorrido_em: "2026-09-01T00:00:00Z", registrado_em: "2026-09-01T00:00:00Z",
      registrado_por: "sistema", tipo: "sistema", canal: null, filial_cnpj: null, status_anterior: null,
      status_novo: "sem_contato", promessa_data: null, promessa_valor: null, promessa_condicoes: null,
      anotacao: "Cobrança aberta: título com 31 dias de atraso.", valor_inadimplente: 1500 },
  ],
};

function titulo(c: Partial<ContaDaTela> & { id: number }): ContaDaTela {
  return { id_tiny: c.id, emissao: "2026-06-01", vencimento: "2026-07-01", situacao: "aberto",
           categoria: "Serviços", cliente_nome: "Alfa Ltda - A", cliente_cpf_cnpj: "11.111.111/0001-11",
           cliente_cidade: null, cliente_uf: null, nro_documento: null, historico: null, liquidacao: null,
           valor: 1500, saldo: 1500, quitada: false, vencida: true, forma_pagamento: null,
           portador: null, ocorrencia: null, ...c };
}

describe("Inadimplência — modal da empresa", () => {
  beforeEach(() => {
    falso.atual!.estado.detalhes = { "11111111": DETALHE };
    falso.atual!.estado.titulos = { "11111111": [
      titulo({ id: 1 }),
      titulo({ id: 2, cliente_nome: "Alfa Ltda - B", cliente_cpf_cnpj: "11.111.111/0002-22", saldo: 500, valor: 500 }),
      titulo({ id: 3, vencimento: "2099-01-01", vencida: false }),
    ] };
  });

  async function abrir() {
    await montar();
    fireEvent.click(screen.getByText("Alfa Ltda"));
    await assentar(); await assentar();
    return screen.getByRole("dialog");
  }

  it("abre com cabeçalho, contato do Tiny e observação", async () => {
    const modal = await abrir();
    expect(within(modal).getByText("11.111.111 · 2 filiais")).toBeInTheDocument();
    expect(within(modal).getByText("(11) 0000-0000")).toBeInTheDocument();
    expect(within(modal).getByText("Só boleto por e-mail")).toBeInTheDocument();
  });

  it("aba Títulos agrupa por filial com subtotal e põe os a vencer por último", async () => {
    const modal = await abrir();
    const grupos = within(modal).getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(grupos[0]).toMatch(/Alfa Ltda - A/);
    expect(grupos.at(-1)).toMatch(/A vencer/);
    expect(within(modal).getAllByText(/Vencida/).length).toBeGreaterThan(0);
  });

  it("aba Cobrança mostra a linha do tempo, do mais novo ao mais velho", async () => {
    const modal = await abrir();
    fireEvent.click(within(modal).getByRole("tab", { name: "Cobrança" }));
    const itens = within(modal).getAllByRole("listitem");
    expect(itens[0]).toHaveTextContent("Falei com a Joana");
    expect(itens[0]).toHaveTextContent("ana");
    expect(itens[1]).toHaveTextContent("Sistema");
  });

  it("editar a observação grava e mostra a nova", async () => {
    const modal = await abrir();
    fireEvent.click(within(modal).getByRole("button", { name: "Editar observação" }));
    fireEvent.change(within(modal).getByLabelText("Observação"), { target: { value: "Pagam dia 10" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Salvar observação" }));
    await assentar();
    expect(falso.atual!.estado.observacoes).toEqual([{ empresa: "11111111", texto: "Pagam dia 10" }]);
    expect(within(modal).getByText("Pagam dia 10")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/pages/Inadimplencia.test.tsx -t "modal"`
Expected: FAIL — não há `dialog`.

- [ ] **Step 3: Exportar `SeloDeSituacao`** — em `TabelaDeContas.tsx`, trocar `function SeloDeSituacao` por `export function SeloDeSituacao`. Nada mais muda lá.

- [ ] **Step 4: `TitulosDaEmpresa.tsx`**

```tsx
import { Badge, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../../design-system/ui";
import { dataDeCalendario } from "../../lib/datas";
import type { ContaDaTela } from "../../services/notasapi";
import { formatarMoeda } from "../contas/contas";
import { SeloDeSituacao } from "../contas/TabelaDeContas";
import { diasDeAtraso } from "./inadimplencia";

const DIALETO = { chaveQuitado: "recebido" };
const CABECALHO = ["ID Tiny", "Vencimento", "Emissão", "Cliente", "Categoria", "Valor", "Saldo", "Situação", "Atraso"];

/**
 * Os títulos em aberto da empresa, agrupados por filial, com as colunas da tabela
 * de Contas a Receber e mais o Atraso. Os a vencer vão juntos no fim, à parte.
 */
export function TitulosDaEmpresa({ titulos, hoje }: { titulos: ContaDaTela[]; hoje: Date }) {
  const vencidos = titulos.filter((t) => diasDeAtraso(t.vencimento, hoje) > 0);
  const aVencer = titulos.filter((t) => diasDeAtraso(t.vencimento, hoje) === 0);
  const porFilial = new Map<string, ContaDaTela[]>();
  for (const t of vencidos) {
    const chave = t.cliente_cpf_cnpj ?? t.cliente_nome ?? "";
    porFilial.set(chave, [...(porFilial.get(chave) ?? []), t]);
  }
  const grupos = [...porFilial.values()].sort(
    (a, b) => b.reduce((s, t) => s + t.saldo, 0) - a.reduce((s, t) => s + t.saldo, 0),
  );

  if (titulos.length === 0) return <p className="py-8 text-center text-conteudo-muted">Nenhum título em aberto.</p>;
  return (
    <div className="flex flex-col gap-6">
      {grupos.map((g) => (
        <Grupo key={g[0].cliente_cpf_cnpj ?? g[0].cliente_nome} titulo={`${g[0].cliente_nome} · ${g[0].cliente_cpf_cnpj ?? ""}`} titulos={g} hoje={hoje} />
      ))}
      {aVencer.length ? <Grupo titulo="A vencer" titulos={aVencer} hoje={hoje} /> : null}
    </div>
  );
}

function Grupo({ titulo, titulos, hoje }: { titulo: string; titulos: ContaDaTela[]; hoje: Date }) {
  const subtotal = titulos.reduce((s, t) => s + t.saldo, 0);
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-semibold text-conteudo-heading">{titulo}</h3>
        <span className="font-mono text-sm font-semibold">{formatarMoeda(subtotal)}</span>
      </div>
      <Table>
        <TableHead>
          <TableRow>{CABECALHO.map((c) => <TableHeaderCell key={c}>{c}</TableHeaderCell>)}</TableRow>
        </TableHead>
        <TableBody>
          {titulos.map((t) => {
            const dias = diasDeAtraso(t.vencimento, hoje);
            return (
              <TableRow key={t.id}>
                <TableCell muted className="font-mono text-xs">{t.id_tiny}</TableCell>
                <TableCell muted className="whitespace-nowrap font-mono text-xs">{dataDeCalendario(t.vencimento)}</TableCell>
                <TableCell muted className="whitespace-nowrap font-mono text-xs">{dataDeCalendario(t.emissao)}</TableCell>
                <TableCell className="min-w-[180px]">
                  <p className="font-medium">{t.cliente_nome}</p>
                  {t.cliente_cpf_cnpj ? <p className="font-mono text-xs text-conteudo-muted">{t.cliente_cpf_cnpj}</p> : null}
                </TableCell>
                <TableCell muted>{t.categoria ?? "-"}</TableCell>
                <TableCell className="whitespace-nowrap font-mono font-semibold text-action">{formatarMoeda(t.valor)}</TableCell>
                <TableCell className="whitespace-nowrap font-mono font-semibold">{formatarMoeda(t.saldo)}</TableCell>
                <TableCell><SeloDeSituacao conta={t} dialeto={DIALETO} /></TableCell>
                <TableCell>{dias > 0 ? <Badge variant={dias > 30 ? "danger" : "warning"}>{dias} dias</Badge> : "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
```

- [ ] **Step 5: `LinhaDoTempo.tsx`**

```tsx
import { Badge } from "../../design-system/ui";
import { dataDeCalendario } from "../../lib/datas";
import type { Ciclo, Evento } from "../../services/inadimplencia";
import { formatarMoeda } from "../contas/contas";
import { CANAIS, STATUS } from "./inadimplencia";

const CANAL = Object.fromEntries(CANAIS.map((c) => [c.value, c.label]));

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function ItemDaLinha({ e }: { e: Evento }) {
  const quem = e.registrado_por === "sistema" ? "Sistema" : e.registrado_por;
  return (
    <li className="border-l-2 border-borda pl-4">
      <p className="text-xs text-conteudo-muted">
        {dataDeCalendario(e.ocorrido_em)} {hora(e.ocorrido_em)} · <b>{quem}</b>
        {e.canal ? ` · ${CANAL[e.canal] ?? e.canal}` : ""}
        {e.filial_cnpj ? ` · filial ${e.filial_cnpj}` : ""}
      </p>
      {e.status_novo ? (
        <p className="mt-1 flex flex-wrap items-center gap-1 text-sm">
          {e.status_anterior ? <><Badge variant="muted">{STATUS[e.status_anterior].rotulo}</Badge>→</> : null}
          <Badge variant={STATUS[e.status_novo].variante}>{STATUS[e.status_novo].rotulo}</Badge>
          {e.promessa_data ? <span>para {dataDeCalendario(e.promessa_data)}{e.promessa_valor ? ` · ${formatarMoeda(e.promessa_valor)}` : ""}</span> : null}
        </p>
      ) : null}
      {e.promessa_condicoes ? <p className="mt-1 text-sm italic">{e.promessa_condicoes}</p> : null}
      {e.anotacao ? <p className="mt-1 whitespace-pre-wrap text-sm">{e.anotacao}</p> : null}
    </li>
  );
}

export function LinhaDoTempo({ eventos, ciclo, anteriores }: { eventos: Evento[]; ciclo: Ciclo | null; anteriores: Ciclo[] }) {
  const doAberto = eventos.filter((e) => e.ciclo_id === ciclo?.id);
  return (
    <div className="flex flex-col gap-6">
      {doAberto.length === 0 ? <p className="text-conteudo-muted">Nenhum registro de cobrança ainda.</p> : (
        <ul className="flex flex-col gap-4">{doAberto.map((e) => <ItemDaLinha key={e.id} e={e} />)}</ul>
      )}
      {anteriores.map((c) => (
        <details key={c.id} className="rounded-lg border border-borda p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Cobrança de {dataDeCalendario(c.aberto_em)} a {c.encerrado_em ? dataDeCalendario(c.encerrado_em) : "—"} · {STATUS[c.status].rotulo}
          </summary>
          <ul className="mt-3 flex flex-col gap-4">
            {eventos.filter((e) => e.ciclo_id === c.id).map((e) => <ItemDaLinha key={e.id} e={e} />)}
          </ul>
        </details>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: `ModalDaEmpresa.tsx`**

```tsx
import { useEffect, useMemo, useState } from "react";

import { Badge, Button, Modal, Spinner, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from "../../design-system/ui";
import { gravarObservacao, type DetalheDaEmpresa } from "../../services/inadimplencia";
import { formatarMoeda } from "../contas/contas";
import { FormularioDeContato } from "./FormularioDeContato";
import { LinhaDoTempo } from "./LinhaDoTempo";
import { STATUS, mensagemDeErro } from "./inadimplencia";
import { TitulosDaEmpresa } from "./TitulosDaEmpresa";
import { useDetalhe, useTitulos } from "./useInadimplencia";

export function ModalDaEmpresa({ empresa, onFechar, onGravou }: {
  empresa: string | null;
  onFechar: () => void;
  onGravou: () => void;
}) {
  const detalhe = useDetalhe(empresa);
  const titulos = useTitulos(empresa);
  const [atual, setAtual] = useState<DetalheDaEmpresa | null>(null);
  const [aba, setAba] = useState("titulos");
  const [registrando, setRegistrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const hoje = useMemo(() => new Date(), []);

  useEffect(() => { setAtual(detalhe.dado); }, [detalhe.dado]);
  useEffect(() => { setAba("titulos"); setRegistrando(false); setErro(null); }, [empresa]);

  const gravou = (novo: DetalheDaEmpresa) => { setAtual(novo); setErro(null); onGravou(); };
  const d = atual;

  return (
    <Modal open={empresa !== null} onClose={onFechar} size="2xl" title={d?.nome ?? "Empresa"} erro={erro ?? detalhe.erro}>
      {!d ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              {d.documento ? <p className="font-mono text-xs text-conteudo-muted">{d.documento}</p> : null}
              <p className="mt-1 text-sm">
                Devendo <b className="font-mono">{formatarMoeda(d.valor_devido)}</b> · maior atraso <b>{d.maior_atraso} dias</b>
              </p>
              <p className="mt-1 text-xs text-conteudo-muted">
                {d.telefone ? <span>{d.telefone}</span> : null}
                {d.telefone && d.email ? " · " : null}
                {d.email ? <a href={`mailto:${d.email}`}>{d.email}</a> : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {d.ciclo ? <Badge variant={STATUS[d.ciclo.status].variante}>{STATUS[d.ciclo.status].rotulo}</Badge> : null}
              <Button onClick={() => { setRegistrando(true); setAba("cobranca"); }}>Registrar contato</Button>
            </div>
          </div>

          <Observacao detalhe={d} onGravou={gravou} onErro={setErro} />

          <Tabs value={aba} onChange={setAba}>
            <TabsList>
              <TabsTrigger value="titulos">Títulos</TabsTrigger>
              <TabsTrigger value="cobranca">Cobrança</TabsTrigger>
            </TabsList>
            <TabsContent value="titulos" className="mt-4">
              {titulos.dado ? <TitulosDaEmpresa titulos={titulos.dado} hoje={hoje} /> : <Spinner />}
            </TabsContent>
            <TabsContent value="cobranca" className="mt-4 flex flex-col gap-6">
              {registrando ? (
                <FormularioDeContato detalhe={d} onGravou={(n) => { gravou(n); setRegistrando(false); }}
                  onErro={setErro} onCancelar={() => setRegistrando(false)} />
              ) : null}
              <LinhaDoTempo eventos={d.eventos} ciclo={d.ciclo} anteriores={d.ciclos_anteriores} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </Modal>
  );
}

function Observacao({ detalhe, onGravou, onErro }: {
  detalhe: DetalheDaEmpresa;
  onGravou: (d: DetalheDaEmpresa) => void;
  onErro: (m: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(detalhe.observacao ?? "");
  const [gravando, setGravando] = useState(false);

  const salvar = async () => {
    setGravando(true);
    try {
      onGravou(await gravarObservacao(detalhe.empresa, texto));
      setEditando(false);
    } catch (falha) {
      onErro(mensagemDeErro(falha));
    } finally {
      setGravando(false);
    }
  };

  if (editando) {
    return (
      <div className="flex flex-col gap-2">
        <Textarea label="Observação" value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={4000} />
        <div className="flex gap-2">
          <Button onClick={salvar} disabled={gravando}>Salvar observação</Button>
          <Button variant="secondary" onClick={() => { setTexto(detalhe.observacao ?? ""); setEditando(false); }}>Cancelar</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-borda bg-surface-elevated p-3">
      <p className="whitespace-pre-wrap text-sm">{detalhe.observacao || <span className="text-conteudo-muted">Sem observação.</span>}</p>
      <Button variant="ghost" size="sm" onClick={() => setEditando(true)} aria-label="Editar observação">Editar</Button>
    </div>
  );
}
```

Para a Task 8 passar sozinha, criar `FormularioDeContato.tsx` mínimo (`export function FormularioDeContato(_: {...}) { return null; }`) — a Task 9 o substitui. Conferir as variantes e tamanhos reais de `Button` (`ghost`/`sm` podem ter outro nome em `core/Button.tsx`).

- [ ] **Step 7: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/pages/Inadimplencia.test.tsx src/pages/ContasReceber.test.tsx src/pages/ContasPagar.test.tsx`
Expected: PASS (Contas junto, porque `TabelaDeContas` mudou).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/contas/TabelaDeContas.tsx frontend/src/pages/inadimplencia frontend/src/pages/Inadimplencia.test.tsx
git commit -m "feat(inadimplencia): modal da empresa com titulos por filial e linha do tempo"
```

---

### Task 9: Front — formulário "Registrar contato"

**Files:**
- Modify: `frontend/src/pages/inadimplencia/FormularioDeContato.tsx`
- Modify: `frontend/src/pages/Inadimplencia.test.tsx`

**Interfaces:**
- Consumes: `registrarEvento`, `NovoEvento`, `DetalheDaEmpresa`, `STATUS`, `STATUS_MANUAIS`, `CANAIS`, `mensagemDeErro`; `Input`, `Select`, `Textarea`, `Button`.
- Produces: `<FormularioDeContato detalhe onGravou onErro onCancelar />`.

- [ ] **Step 1: Testes (falham)** — dentro do `describe` do modal:

```tsx
  async function formulario() {
    const modal = await abrir();
    fireEvent.click(within(modal).getByRole("button", { name: "Registrar contato" }));
    return modal;
  }

  it("registra contato com promessa", async () => {
    const modal = await formulario();
    fireEvent.change(within(modal).getByLabelText("Canal"), { target: { value: "telefone" } });
    fireEvent.change(within(modal).getByLabelText("Novo status"), { target: { value: "promessa" } });
    fireEvent.change(within(modal).getByLabelText("Data prometida"), { target: { value: "2099-01-10" } });
    fireEvent.change(within(modal).getByLabelText("Valor prometido"), { target: { value: "1.500,50" } });
    fireEvent.change(within(modal).getByLabelText("Anotação"), { target: { value: "Falei com a Joana" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Gravar" }));
    await assentar();
    const [{ empresa, dados }] = falso.atual!.estado.eventos;
    expect(empresa).toBe("11111111");
    expect(dados).toMatchObject({ canal: "telefone", status_novo: "promessa", anotacao: "Falei com a Joana",
                                  promessa: { data: "2099-01-10", valor: 1500.5 } });
  });

  it("os campos da promessa só aparecem com o status Promessa", async () => {
    const modal = await formulario();
    expect(within(modal).queryByLabelText("Data prometida")).toBeNull();
    fireEvent.change(within(modal).getByLabelText("Novo status"), { target: { value: "promessa" } });
    expect(within(modal).getByLabelText("Data prometida")).toBeInTheDocument();
  });

  it("os status do sistema não são oferecidos", async () => {
    const modal = await formulario();
    const opcoes = within(within(modal).getByLabelText("Novo status")).getAllByRole("option").map((o) => o.textContent);
    expect(opcoes).not.toContain("Pago");
    expect(opcoes).not.toContain("Promessa quebrada");
    expect(opcoes).not.toContain("Sem contato");
  });

  it("sem canal nem status, não grava e avisa", async () => {
    const modal = await formulario();
    fireEvent.click(within(modal).getByRole("button", { name: "Gravar" }));
    await assentar();
    expect(falso.atual!.estado.eventos).toHaveLength(0);
    expect(within(modal).getByText("Escolha o canal do contato ou um novo status.")).toBeInTheDocument();
  });

  it("erro do backend aparece no modal e o que foi digitado fica", async () => {
    falso.atual!.estado.erroDeGravacao = "A data prometida já passou.";
    const modal = await formulario();
    fireEvent.change(within(modal).getByLabelText("Canal"), { target: { value: "email" } });
    fireEvent.change(within(modal).getByLabelText("Anotação"), { target: { value: "Texto longo" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Gravar" }));
    await assentar();
    expect(within(modal).getByRole("alert")).toHaveTextContent("A data prometida já passou.");
    expect(within(modal).getByLabelText("Anotação")).toHaveValue("Texto longo");
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/pages/Inadimplencia.test.tsx -t "registra|promessa|sistema|sem canal|erro do backend"`
Expected: FAIL — o formulário é `null`.

- [ ] **Step 3: Implementar `FormularioDeContato.tsx`**

```tsx
import { useState } from "react";

import { Button, Input, Select, Textarea } from "../../design-system/ui";
import { converterParaNumero } from "../../lib/dinheiro";
import { registrarEvento, type CodigoDeStatus, type DetalheDaEmpresa } from "../../services/inadimplencia";
import { CANAIS, STATUS, STATUS_MANUAIS, mensagemDeErro } from "./inadimplencia";

function agoraLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function FormularioDeContato({ detalhe, onGravou, onErro, onCancelar }: {
  detalhe: DetalheDaEmpresa;
  onGravou: (d: DetalheDaEmpresa) => void;
  onErro: (m: string) => void;
  onCancelar: () => void;
}) {
  const [quando, setQuando] = useState(agoraLocal);
  const [canal, setCanal] = useState("");
  const [filial, setFilial] = useState("");
  const [status, setStatus] = useState<CodigoDeStatus | "">("");
  const [data, setData] = useState("");
  const [valor, setValor] = useState("");
  const [condicoes, setCondicoes] = useState("");
  const [anotacao, setAnotacao] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);

  const gravar = async () => {
    if (!canal && !status) { setAviso("Escolha o canal do contato ou um novo status."); return; }
    if (status === "promessa" && !data) { setAviso("Informe a data prometida."); return; }
    setAviso(null);
    setGravando(true);
    try {
      onGravou(await registrarEvento(detalhe.empresa, {
        ocorrido_em: new Date(quando).toISOString(),
        canal: canal || null,
        filial_cnpj: filial || null,
        status_novo: status || null,
        promessa: status === "promessa"
          ? { data, valor: valor ? converterParaNumero(valor) : null, condicoes: condicoes.trim() || null }
          : null,
        anotacao: anotacao.trim() || null,
      }));
    } catch (falha) {
      onErro(mensagemDeErro(falha));
    } finally {
      setGravando(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-borda p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Quando" type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
        <Select label="Canal" placeholder="—" value={canal} onChange={(e) => setCanal(e.target.value)} options={CANAIS} />
        <Select label="Filial" placeholder="Empresa toda" value={filial} onChange={(e) => setFilial(e.target.value)}
          options={detalhe.filiais.map((f) => ({ value: f.cnpj, label: `${f.nome} · ${f.cnpj}` }))} />
        <Select label="Novo status" placeholder="Manter o atual" value={status}
          onChange={(e) => setStatus(e.target.value as CodigoDeStatus | "")}
          options={STATUS_MANUAIS.map((s) => ({ value: s, label: STATUS[s].rotulo }))} />
      </div>
      {status === "promessa" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input label="Data prometida" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          <Input label="Valor prometido" inputMode="decimal" placeholder="opcional" value={valor} onChange={(e) => setValor(e.target.value)} />
          <Input label="Condições" placeholder="ex.: metade agora, metade em 30 dias" value={condicoes} onChange={(e) => setCondicoes(e.target.value)} />
        </div>
      ) : null}
      <Textarea label="Anotação" rows={3} maxLength={4000} value={anotacao} onChange={(e) => setAnotacao(e.target.value)}
        placeholder="Com quem falou, o que ficou combinado..." />
      {aviso ? <p className="text-sm text-danger">{aviso}</p> : null}
      <div className="flex gap-2">
        <Button onClick={gravar} disabled={gravando}>Gravar</Button>
        <Button variant="secondary" onClick={onCancelar}>Cancelar</Button>
      </div>
    </div>
  );
}
```

Conferir: `converterParaNumero` existe em `lib/dinheiro.ts` (o `servidorFalso` de Contas usa) e devolve `1500.5` para `"1.500,50"`; `Select` aceita `placeholder` como primeira opção vazia (está no `SelectProps`).

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/pages/Inadimplencia.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/inadimplencia/FormularioDeContato.tsx frontend/src/pages/Inadimplencia.test.tsx
git commit -m "feat(inadimplencia): formulario de registrar contato e promessa"
```

---

### Task 10: Front — aba Indicadores

**Files:**
- Modify: `frontend/src/pages/inadimplencia/AbaIndicadores.tsx`
- Modify: `frontend/src/pages/Inadimplencia.test.tsx`

**Interfaces:**
- Consumes: `useIndicadores(ativo)`, `formatarPercentual`, `nomeDoMes`, `formatarMoeda`; `KpiCard`, `Card`, `CardTitle`, `ChartEmpty`; `recharts` (`ResponsiveContainer`, `BarChart`, `Bar`, `Cell`, `XAxis`, `YAxis`, `Tooltip`, `ReferenceLine`, `CartesianGrid`); `chartTheme` de `design-system/chartTheme`.
- Produces: `<AbaIndicadores ativo />`.

- [ ] **Step 1: Testes (falham)** — acrescentar ao `vi.mock("recharts")` copiado de Contas um `ReferenceLine: semDesenho`, e:

```tsx
import type { Indicadores } from "../services/inadimplencia";

const INDICADORES: Indicadores = {
  mensal: [
    { mes: "2026-07", em_apuracao: false, valor: 1000, inadimplente: 100, titulos: 10, titulos_inadimplentes: 1, taxa: 0.1 },
    { mes: "2026-08", em_apuracao: false, valor: 1000, inadimplente: 158, titulos: 10, titulos_inadimplentes: 2, taxa: 0.158 },
    { mes: "2026-09", em_apuracao: true, valor: 300, inadimplente: 120, titulos: 3, titulos_inadimplentes: 1, taxa: 0.4 },
  ],
  anual: [
    { ano: 2025, ano_corrente: false, valor: 10000, inadimplente: 840, titulos: 100, titulos_inadimplentes: 9, taxa: 0.084 },
    { ano: 2026, ano_corrente: true, valor: 7500, inadimplente: 742, titulos: 80, titulos_inadimplentes: 8, taxa: 0.099 },
  ],
  total: { valor: 51000, inadimplente: 3417, titulos: 900, titulos_inadimplentes: 80, taxa: 0.067 },
  desde: "2015-01-01",
  ultimo_fechado: { mes: "2026-08", em_apuracao: false, valor: 1000, inadimplente: 158, titulos: 10, titulos_inadimplentes: 2, taxa: 0.158 },
  media_12_meses: 0.129,
};

describe("Inadimplência — aba Indicadores", () => {
  beforeEach(() => { falso.atual!.estado.indicadores = INDICADORES; });

  async function abrirIndicadores() {
    await montar();
    fireEvent.click(screen.getByRole("tab", { name: "Indicadores" }));
    await assentar(); await assentar();
  }

  it("cards: último mês fechado, média de 12 meses, ano corrente e total", async () => {
    await abrirIndicadores();
    expect(screen.getByText("Último mês fechado (ago/26)")).toBeInTheDocument();
    expect(screen.getByText("15,8%")).toBeInTheDocument();
    expect(screen.getByText("12,9%")).toBeInTheDocument();
    expect(screen.getByText("Ano 2026 (até agora)")).toBeInTheDocument();
    expect(screen.getByText(/pior que 2025/)).toBeInTheDocument();
    expect(screen.getByText("Total — desde 2015")).toBeInTheDocument();
  });

  it("o mês em apuração aparece marcado e não como número fechado", async () => {
    await abrirIndicadores();
    expect(screen.getByText(/set\/26.*em apuração/)).toBeInTheDocument();
  });

  it("só busca os indicadores quando a aba é aberta", async () => {
    const espiao = vi.spyOn(falso.atual!.servico, "fetchIndicadores");
    await montar();
    expect(espiao).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "Indicadores" }));
    await assentar();
    expect(espiao).toHaveBeenCalledTimes(1);
  });
});
```

> Se o `vi.spyOn` não pegar a chamada porque o mock exporta o objeto `servico` por valor, trocar o `servico.fetchIndicadores` do servidor falso por `vi.fn(...)` na criação e conferir `toHaveBeenCalledTimes` direto nele.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/pages/Inadimplencia.test.tsx -t "Indicadores"`
Expected: FAIL

- [ ] **Step 3: Implementar `AbaIndicadores.tsx`**

```tsx
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Alert, Card, CardTitle, ChartEmpty, KpiCard, Spinner } from "../../design-system/ui";
import type { MesDeTaxa } from "../../services/inadimplencia";
import { formatarMoeda } from "../contas/contas";
import { formatarPercentual, nomeDoMes } from "./inadimplencia";
import { useIndicadores } from "./useInadimplencia";

/**
 * A taxa de safra: de tudo que venceu, quanto não foi pago em até 30 dias.
 * Mês em apuração = ainda tem vencimento que não completou 30 dias.
 */
export function AbaIndicadores({ ativo }: { ativo: boolean }) {
  const { dado: i, carregando, erro } = useIndicadores(ativo);
  if (carregando) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (erro || !i) return <Alert variant="danger">{erro ?? "Sem dados."}</Alert>;

  const anoAtual = i.anual.find((a) => a.ano_corrente);
  const anoAnterior = anoAtual ? i.anual.find((a) => a.ano === anoAtual.ano - 1) : undefined;
  const pior = anoAtual && anoAnterior && (anoAtual.taxa ?? 0) > (anoAnterior.taxa ?? 0);
  const dados = i.mensal.map((m) => ({ ...m, rotulo: nomeDoMes(m.mes), pct: (m.taxa ?? 0) * 100 }));
  const maxAno = Math.max(...i.anual.map((a) => a.taxa ?? 0), i.total.taxa ?? 0, 0.01);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
        {i.ultimo_fechado ? (
          <KpiCard label={`Último mês fechado (${nomeDoMes(i.ultimo_fechado.mes)})`} value={formatarPercentual(i.ultimo_fechado.taxa)} tone="perigo"
            note={`${formatarMoeda(i.ultimo_fechado.inadimplente)} de ${formatarMoeda(i.ultimo_fechado.valor)} que venceram`} />
        ) : null}
        <KpiCard label="Média dos últimos 12 meses" value={formatarPercentual(i.media_12_meses)} tone="acao" />
        {anoAtual ? (
          <KpiCard label={`Ano ${anoAtual.ano} (até agora)`} value={formatarPercentual(anoAtual.taxa)} tone="perigo"
            note={anoAnterior ? `${pior ? "▲ pior que" : "▼ melhor que"} ${anoAnterior.ano} (${formatarPercentual(anoAnterior.taxa)})` : undefined} />
        ) : null}
        <KpiCard label={`Total — desde ${i.desde?.slice(0, 4) ?? "—"}`} value={formatarPercentual(i.total.taxa)}
          note={`${formatarMoeda(i.total.inadimplente)} de ${formatarMoeda(i.total.valor)}`} />
      </div>

      <Card>
        <CardTitle>Taxa mensal</CardTitle>
        <p className="mb-4 text-xs text-conteudo-muted">
          Cada barra é um mês de <b>vencimento</b>: de tudo que venceu naquele mês, quanto não tinha sido pago 30 dias depois.
        </p>
        {dados.length === 0 ? <ChartEmpty /> : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="rotulo" />
                <YAxis tickFormatter={(v: number) => `${v}%`} />
                <Tooltip formatter={(_v, _n, p: { payload?: MesDeTaxa }) => p.payload
                  ? [`${formatarPercentual(p.payload.taxa)} · ${formatarMoeda(p.payload.inadimplente)} de ${formatarMoeda(p.payload.valor)}${p.payload.em_apuracao ? " (em apuração)" : ""}`, "Taxa"]
                  : ""} />
                {i.media_12_meses !== null ? <ReferenceLine y={i.media_12_meses * 100} strokeDasharray="6 4" stroke="var(--action)" label="média 12 meses" /> : null}
                <Bar dataKey="pct" radius={[3, 3, 0, 0]}>
                  {dados.map((m) => <Cell key={m.mes} fill={m.em_apuracao ? "var(--color-slate-300)" : "var(--color-danger-500)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <ul className="mt-2 text-xs text-conteudo-muted">
          {i.mensal.filter((m) => m.em_apuracao).map((m) => (
            <li key={m.mes}>{nomeDoMes(m.mes)} — em apuração: parte do que venceu ainda não completou 30 dias.</li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardTitle>Taxa anual</CardTitle>
          <div className="mt-3 flex flex-col gap-2">
            {[...i.anual.map((a) => ({ chave: String(a.ano), rotulo: a.ano_corrente ? `${a.ano} (até agora)` : String(a.ano), taxa: a.taxa, cor: "var(--color-danger-500)" })),
              { chave: "total", rotulo: "Total", taxa: i.total.taxa, cor: "var(--action)" }].map((l) => (
              <div key={l.chave} className="grid grid-cols-[110px_1fr_60px] items-center gap-3 text-sm">
                <span className="font-medium">{l.rotulo}</span>
                <span className="h-4 overflow-hidden rounded bg-surface-elevated">
                  <span className="block h-full rounded" style={{ width: `${((l.taxa ?? 0) / maxAno) * 100}%`, background: l.cor }} />
                </span>
                <span className="text-right font-mono font-semibold">{formatarPercentual(l.taxa)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>Como ler este número</CardTitle>
          {i.ultimo_fechado ? (
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <p><b>{formatarPercentual(i.ultimo_fechado.taxa)} em {nomeDoMes(i.ultimo_fechado.mes)}</b> quer dizer: de cada R$ 100 que venceram nesse mês, {formatarMoeda((i.ultimo_fechado.taxa ?? 0) * 100)} não tinham sido pagos 30 dias depois do vencimento.</p>
              <p>Conta mesmo quem pagou depois — o que se mede é se pagou dentro de 30 dias. Por isso um mês fechado não muda mais.</p>
              <p><b>Barra mais alta = mês pior.</b></p>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
```

Conferir em `GraficosDeContas.tsx` como o tema (`chartTheme`) é aplicado aos eixos e ao tooltip e repetir aqui — o trecho acima mostra a estrutura; as cores e fontes têm de vir do tema como nos outros gráficos.

- [ ] **Step 4: Rodar a suíte inteira do front, typecheck e lint**

Run: `cd frontend && npx vitest run && npx tsc -b --noEmit 2>&1 | grep -v Radio.test && npx eslint src/pages/inadimplencia src/pages/Inadimplencia.tsx src/pages/Inadimplencia.test.tsx src/services/inadimplencia.ts`
Expected: todos os testes passam; typecheck sem linhas; lint sem erro.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/inadimplencia/AbaIndicadores.tsx frontend/src/pages/Inadimplencia.test.tsx
git commit -m "feat(inadimplencia): aba Indicadores com taxa mensal, anual e total"
```

---

### Task 11: Conferência contra produção e deploy

**Files:** nenhum versionado (script de conferência no scratchpad).

- [ ] **Step 1: Conferir as consultas contra o banco de produção (somente leitura)**

Num script no scratchpad (`backend/.venv/bin/python`), criar um engine SQLAlchemy com `creator=lambda: bancos.conectar("datacore")` e chamar `resumo`, `pagina_de_empresas` (padrão) e `indicadores` com `date.today()`. As tabelas de cobrança ainda não existem em produção — antes da migração, rodar só `indicadores` e as partes do `resumo` sem `SQL_CONTAGEM_COBRANCA`, ou fazer a conferência completa depois do Step 2. Conferir:
- `total_vencido` = o total do filtro "Vencimento: Vencidas" de Contas a Receber;
- `total_a_receber` = o card "Total a Receber";
- `inadimplente` e as quatro faixas batem com as consultas avulsas de 09/10/2026 (diferença só pelo que mudou desde então);
- `indicadores.total.taxa` e a taxa anual de 2025 batem com as da conversa.
Anotar os números no relatório para o Erick — **não** no repo.

- [ ] **Step 2: Migração** — o Erick roda no Konsole: `bash ~/github/DataCore/backend/scripts/migrar_tiny.sh 013_cobranca.sql`. Conferir depois, pelo usuário de leitura, que as três tabelas existem.

- [ ] **Step 3: Push** — `bash scripts/varrer.sh` e `git push`.

- [ ] **Step 4: Deploy da API** — conferir que não há carga rodando (`operacao.execucoes_job` com `fim IS NULL` e início recente; as linhas órfãs de setembro não contam), deploy do `datacore-api` pelo MCP do EasyPanel, e conferir no `openapi.json` publicado que `/inadimplencia/resumo` existe.

- [ ] **Step 5: Deploy do front** — deploy do `datacore-sistema` (o MCP dá timeout mas conclui; não repetir) e conferir no bundle publicado que existe o chunk da página (`grep -l "Empresas devedoras"` nos assets).

- [ ] **Step 6: Primeira sincronização** — pedir ao Erick para clicar em "Atualizar dados agora" (ou esperar a carga das 7h) e conferir em `tiny.cobranca_ciclos` que abriu um ciclo por empresa inadimplente, e na tela de Importações que a execução trouxe `cobrança: abertos`.
