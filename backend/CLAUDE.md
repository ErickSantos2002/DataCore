# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

API REST (FastAPI + SQLAlchemy) que **expõe em leitura** os dados do Tiny ERP já
gravados no PostgreSQL, mais a importação de NFS-e do Recife. Consumida pelo
DataCoreHS e por dashboards. Código e comentários em português.

## Comandos

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload            # dev · http://localhost:8000/docs
docker compose up -d --build   # na RAIZ do repo: backend + frontend de dev
python testar_importacao_nfse.py         # exercita POST /notas_servico/importar
pip install -r requirements-dev.txt
docker compose -f docker-compose.test.yml up -d --wait   # Postgres dos testes (porta 55432)
pytest                                    # suíte (só o módulo de auth por enquanto)
AUTH_APP_DB_USER=<usuario_app> bash scripts/migrar.sh     # migrations do schema auth (Konsole, superusuário)
.venv/bin/python scripts/copiar_usuarios_authapi.py   # copia usuários do authapi (Konsole, uma vez)
```

Precisa de `.env` (ver `.env.example`) com `DATABASE_URL` apontando pro banco real e
`SECRET_KEY` (≥32 caracteres).
A suíte (`tests/`) cobre autenticação, migrations e o script de cópia, e roda
contra o Postgres de `docker-compose.test.yml`, nunca contra o `datacore`. As
rotas de dados antigas não têm teste. `testar_importacao_nfse.py` continua sendo
script manual contra uma API rodando.

Para inspecionar o banco fora da API, usar o cadastro central de bancos
(`bancos.consultar("datacore", sql)`), não montar conexão na mão.

## Arquitetura

**O app não é dono do schema.** As tabelas do schema `tiny` são populadas por um
processo externo de sincronia com o Tiny ERP; aqui só há `declarative_base()` sem
`create_all`. Consequências práticas:

- Modelo novo = espelhar coluna que **já existe** no banco. Confira antes de escrever.
- Mudança de DDL vira SQL manual em `migrations/` (ex.: `001_add_cancelada_column.sql`),
  rodado à mão no Postgres. Não há Alembic para o `tiny`.
- Nomes de coluna no banco são em português com acento e são mapeados explicitamente:
  `numero_nfse = Column("nº_da_nota_fiscal_eletrônica", ...)` em `models/nota_servico.py`.
  Nunca renomeie o primeiro argumento do `Column`.
- Todo modelo carrega `__table_args__ = {"schema": "tiny"}`.

**Exceção: o schema `auth` é do app.** Os usuários e papéis do DataCoreHS
(`auth.usuarios`, `auth.papeis`) são versionados com **Alembic** (`alembic/`),
cujo `env.py` só enxerga o `auth`. O `migrations/` segue como SQL manual,
histórico do `tiny`. A migration roda pelo `scripts/migrar.sh` no Konsole, nunca
no startup.

**Camadas:** `models/` (SQLAlchemy) → `schemas/` (Pydantic, `from_attributes=True`) →
`api/endpoints/` (um `APIRouter` por recurso, com `prefix` e `tags`) → `main.py`.
Endpoint novo exige três passos: criar `api/endpoints/x.py` expondo `router`,
reexportar em `api/endpoints/__init__.py`, e `app.include_router(endpoints.x, dependencies=PROTEGIDO)` em
`main.py` (routers de dados). Cada arquivo de endpoint redefine sua própria `get_db()` — é o padrão
vigente nos 12 arquivos; siga-o em vez de introduzir um módulo compartilhado.

**Regras de faturamento vivem em `app/core/faturamento.py`.** CFOPs de venda,
`SITUACAO_EMITIDA` e a lista de marcadores ruins são fonte única — `nota_fiscal.py` e
`centro_custo.py` importam de lá. Já houve bug real de cópias divergentes (comparação
sem `lower()` deixava "NF cancelada" entrar no faturamento); não reimplemente o filtro
localmente. A lista `MARCADORES_RUINS` é comparada em minúsculo, então mantenha as
entradas todas em minúsculo.

**NFS-e — dois serviços, um contrato.** `nfse_recife_nacional.py`
(`NFSeRecifeNacionalService`) é o caminho ativo: ADN nacional via GET paginado por NSU
com mTLS, XML gzip+base64 no leiaute `sped.fazenda.gov.br/nfse`. `nfse_recife.py`
(SOAP/ABRASF na prefeitura) é o legado, que parou de receber notas do Emissor Nacional,
mas continua exportado em `services/__init__.py`. Os dois devolvem `consultar_nfse()`
com **exatamente as mesmas chaves de dicionário** — o endpoint de importação faz
`setattr` genérico em cima delas, então renomear uma chave quebra a gravação em silêncio.
`NFSE_IMPORTACAO.md` documenta o endpoint e o agendamento no N8N.

Certificados vêm por caminho local (`NFSE_CERT_PATH`/`NFSE_KEY_PATH`) ou por base64
(`NFSE_CERT_BASE64`/`NFSE_KEY_BASE64`, usado em produção/Easypanel, que
`Settings.get_cert_paths()` materializa em arquivo temporário).

## Pontos de atenção

- **Autenticação JWT (`core/security.py`), rotas em `/auth`.** Substitui o
  authapi para o DataCoreHS (o authapi segue de pé pro HealthScore). As rotas de
  dados passam por `exigir_usuario` via `PROTEGIDO` no `main.py`; router novo
  **precisa** entrar com `dependencies=PROTEGIDO` (há teste que falha se não
  entrar). `AUTH_OBRIGATORIA=false` deixa passar anônimo com `WARNING` no log;
  `true` bloqueia. Senha e e-mail são definidos só por admin.
- O `Dockerfile` copia apenas `app/` e `requirements.txt`; `migrations/` e os scripts da
  raiz não entram na imagem.
- Produção é o serviço `datacore-api` do EasyPanel, que builda `backend/` com o `Dockerfile` desta pasta.
- Mensagens de commit em português, imperativo, descrevendo o efeito
  ("Corrige filtro de marcadores no faturamento de vendas").

## Vizinhos

- `../analytics/` é o dbt (serviço `datacore-dbt`).
- `../deploy/` tem os timers do systemd e os scripts que rodam os jobs na VPS.
- `../frontend/` é o painel que consome estas rotas.
