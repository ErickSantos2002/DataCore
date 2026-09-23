# Usuários do DataCoreHS no banco `datacore` — design

**Data:** 2026-09-23 · **Escopo desta spec:** backend (tiny-integrador). O front
(DataCoreHS) é etapa posterior, em sessão própria.

## Objetivo

O DataCoreHS faz login pelo `authapi` (repo `login-hs`), que tem banco próprio. A
decisão é **aposentar o authapi no DataCoreHS**: os usuários do DataCore passam a
morar no `datacore`, e o tiny-integrador (`tinyapi`) passa a autenticar e a
proteger todas as suas rotas.

O authapi **continua de pé** — o HealthScore ainda usa, e a migração dele é outro
trabalho.

Junto vêm:

- um sistema de migrations de verdade (Alembic), restrito ao que o app é dono;
- o campo `email` em todo usuário, preparando um futuro login via Microsoft;
- o fechamento das rotas abertas que o authapi tem (ver nota do vault
  `_inbox/Rotas-Abertas-Do-Authapi.md`), que não são reproduzidas aqui.

**Sucesso =** o DataCoreHS consegue logar no tinyapi com as mesmas contas e
senhas de hoje, os ids de usuário são preservados, e com `AUTH_OBRIGATORIA=true`
nenhuma rota de dados responde sem token válido.

## Fora do escopo

- Login via Microsoft (só o campo `email` fica pronto).
- Corrigir as rotas abertas do próprio authapi (segue servindo o HealthScore).
- Testes das rotas de dados já existentes.
- Mudanças no front — listadas no fim como insumo da próxima etapa.

## 1. Dados

Schema novo **`auth`** no banco `datacore`, separado do `tiny` (que é populado
pelo processo externo de sincronia) e dos schemas do dbt.

```
auth.papeis
  id    serial PK
  nome  text NOT NULL UNIQUE           -- 'admin', 'financeiro', 'servicos', ...

auth.usuarios
  id          serial PK
  username    text NOT NULL UNIQUE     -- sempre gravado em minúsculo
  email       text NULL                -- gravado em minúsculo
  senha_hash  text NOT NULL            -- bcrypt ($2b$)
  papel_id    int  NOT NULL REFERENCES auth.papeis(id)
  criado_em   timestamptz NOT NULL DEFAULT now()

índice único parcial: auth.usuarios (email) WHERE email IS NOT NULL
```

- `email` é opcional agora e preenchido depois pelo admin. É único quando
  preenchido. O login continua por `username`.
- Os **ids são preservados** na cópia: `/financeiro` e `/locacao` no front liberam
  pelos ids 1, 3 e 4. Ids trocados dariam acesso a outra pessoa.
- Depois da cópia, as bases do authapi e do `datacore` seguem independentes:
  mudança num lado não reflete no outro.

## 2. Migrations (Alembic)

- `alembic.ini` e `alembic/` na raiz do repo.
- `env.py` enxerga **só o schema `auth`** (`include_schemas=True` + filtro
  `include_object` por schema), e a tabela de controle fica em
  `auth.alembic_version` (`version_table_schema="auth"`). O Alembic nunca toca
  `tiny`, `silver`, `gold`, `operacao`, `snapshots` nem os schemas `dbt_*`.
- URL de conexão: `ALEMBIC_DATABASE_URL` se definida, senão `DATABASE_URL`.
- **Revisão 0001:** `CREATE SCHEMA IF NOT EXISTS auth`, as duas tabelas, o índice
  parcial de e-mail e os grants para o usuário da aplicação:
  `USAGE` no schema, `SELECT, INSERT, UPDATE, DELETE` nas tabelas, `USAGE, SELECT`
  nas sequences. O nome do usuário vem da variável **`AUTH_APP_DB_USER`**
  (obrigatória na migration; falha com mensagem clara se ausente).
- O usuário de **leitura** do cadastro de bancos não recebe grant no `auth`, mas
  **enxerga o schema mesmo assim**: ele tem `pg_read_all_data`, que vale para todo
  schema, inclusive os criados depois. Decisão de 23/09/2026: aceitar — são hashes
  bcrypt (custo 10–12). Restringir exigiria trocar o `pg_read_all_data` por grants
  por schema no `~/projetos/bancos`.
- **Quem roda:** DDL exige superusuário, e o Claude não lê `admin.toml`. Um script
  `scripts/migrar.sh` que o Erick roda no Konsole monta `ALEMBIC_DATABASE_URL` a
  partir de `~/.config/bancos/admin.toml` (entrada `datacore`) e executa
  `alembic upgrade head`. A aplicação **não** migra no startup.
- `migrations/001_add_cancelada_column.sql` permanece como histórico (já aplicado),
  com um `migrations/README.md` curto dizendo que o SQL manual vale só pro `tiny`
  e que o `auth` é do Alembic.

## 3. Cópia dos usuários

Script avulso `scripts/copiar_usuarios_authapi.py`, rodado pelo Erick no Konsole:

1. Recebe a URL do banco do authapi (colada; ele não está no cadastro) e usa a
   URL admin do `datacore` via `admin.toml`.
2. Copia `roles(id, name)` → `auth.papeis(id, nome)` e
   `users(id, username, password_hash, role_id, created_at)` →
   `auth.usuarios(id, username, senha_hash, papel_id, criado_em)`, com
   `email = NULL`. Usernames normalizados para minúsculo.
3. `INSERT ... ON CONFLICT (id) DO NOTHING` — idempotente, pode rodar de novo.
4. Ajusta as sequences: `setval` para `max(id)` de cada tabela.
5. Imprime quantos papéis e usuários copiou e quais pulou.

## 4. Autenticação

**Dependências:** `PyJWT` (no lugar de `python-jose`) e `bcrypt` direto (no lugar
de `passlib`). Hashes `$2b$` gerados pelo authapi continuam válidos. Entram
também `alembic` e, para testes, `pytest` e `httpx`.

**Configuração nova em `Settings`:**

| Variável | Padrão | Uso |
|---|---|---|
| `SECRET_KEY` | — (obrigatória) | assina os JWT. **Diferente** da do authapi |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | validade do token (8 h, um dia de trabalho; era 30 no desenho original) |
| `AUTH_OBRIGATORIA` | `false` | liga o bloqueio das rotas de dados |

A `SECRET_KEY` precisa ser diferente da do authapi: se fosse igual, um token do
authapi valeria no tinyapi e, como os ids dos dois bancos divergem com o tempo,
um usuário novo do HealthScore poderia herdar a identidade de outro no DataCore.

**Token:** JWT HS256 com `sub` (username), `user_id`, `role` e `exp`. A cada
requisição o token é validado (assinatura + expiração) e o **usuário é buscado no
banco**. O papel usado nas checagens é o do banco, não o do token, então exclusão
ou rebaixamento valem na hora.

**Organização:** modelos `models/usuario.py` e `models/papel.py`
(`__table_args__ = {"schema": "auth"}`), schemas Pydantic em `schemas/auth.py`,
rotas em `api/endpoints/auth.py` (com a própria `get_db()`, no padrão vigente), e
hash, JWT e dependências em `core/security.py`, que hoje é só um stub.

## 5. Rotas de autenticação

Prefixo **`/auth`**. O front só troca a base URL da instância `authApi`; os
caminhos são os mesmos do authapi.

| Rota | Permissão | Observação |
|---|---|---|
| `POST /auth/login` | público | resposta igual à do authapi: `access_token`, `token_type`, `role`, `username`, `user_id` |
| `GET /auth/me` | logado | |
| `GET /auth/roles` | logado | |
| `GET /auth/users` | admin | |
| `GET /auth/users/{id}` | admin ou o próprio | no authapi era aberta |
| `POST /auth/register` | admin | no authapi era aberta; `role_name` opcional, padrão `comum`; aceita `email` |
| `PUT /auth/users/{id}` | **só admin** | username, senha, papel, e-mail. No authapi era aberta |
| `DELETE /auth/users/{id}` | admin, não a si mesmo | |

- **Só o admin define senha.** Não há troca de senha pelo próprio usuário.
- O e-mail também é só do admin: se cada um definisse o próprio, alguém poderia
  pôr o e-mail de outra pessoa e herdar a conta Microsoft dela no futuro.
- **Contrato de saída** dos usuários: igual ao `UserOut` do authapi
  (`id`, `username`, `created_at`, `role: {id, name}`) **mais `email`**. Os nomes
  do JSON seguem o authapi, e os nomes das colunas seguem o português do banco.
- Login compara username sem diferenciar maiúsculas.

## 6. Proteção das rotas de dados

- Dependência única `exigir_usuario` em `core/security.py`, aplicada no `main.py`
  via `include_router(..., dependencies=[Depends(exigir_usuario)])` em cada router
  de dados. Os arquivos de endpoint existentes não mudam.
- **`AUTH_OBRIGATORIA=false` (transição):** token válido passa normalmente. Sem
  token ou com token inválido também passa, mas registra `WARNING` no log com
  método, caminho e IP de origem. Esse log serve para achar clientes esquecidos.
- **`AUTH_OBRIGATORIA=true`:** sem token válido → `401`.
- Sempre públicos: `/`, `/docs`, `/redoc`, `/openapi.json` e `POST /auth/login`.
- O Swagger ganha esquema de segurança Bearer (botão **Authorize**).

## 7. Erros

| Código | Quando |
|---|---|
| `401` | token ausente/inválido/expirado (com `WWW-Authenticate: Bearer`); login com usuário ou senha errados |
| `403` | papel não permite a ação |
| `404` | usuário não encontrado |
| `400` | username ou e-mail já em uso; papel inexistente; admin excluindo a si mesmo |

Mantém `400` (não `409`) e as mensagens do authapi onde existiam, para o front
não mudar o tratamento de erro.

## 8. Testes

- `pytest` + TestClient contra **Postgres local em container** (padrão
  `~/projetos/postgres-teste`), nunca contra o `datacore`. URL por
  `TEST_DATABASE_URL`.
- A fixture de sessão aplica `alembic upgrade head` no banco vazio, e com isso a
  migration também fica testada.
- Cobertura:
  - login: acerto, senha errada, username com maiúscula;
  - login com hash `$2b$` real no formato do authapi, provando que a senha
    copiada funciona;
  - cada linha da tabela de permissões da seção 5, como admin, como comum e
    anônimo;
  - username e e-mail duplicados → `400`;
  - token de usuário excluído → `401`; papel rebaixado vale na hora;
  - rota de dados com `AUTH_OBRIGATORIA=false`: anônimo passa e gera warning;
    com `true`: anônimo leva `401` e logado passa;
  - rotas públicas continuam públicas.
- O script de cópia é testado com dois bancos no mesmo container (origem com
  tabelas `users`/`roles` no formato do authapi): ids preservados, sequences
  ajustadas, segunda execução não duplica.

## 9. Implantação

1. Deploy do backend com `SECRET_KEY` nova e `AUTH_OBRIGATORIA=false` no EasyPanel.
   Nada muda para quem usa o DataCore.
2. Erick roda no Konsole `scripts/migrar.sh` (com `AUTH_APP_DB_USER`) e depois
   `scripts/copiar_usuarios_authapi.py`.
3. Conferência pelo Swagger — só depois do passo 2 (migrar.sh + cópia): antes
   disso o schema `auth` não existe e `/auth/*` devolve 500. Login com conta
   real, `/auth/me`, `/auth/users`.
4. **Etapa do front** (sessão no DataCoreHS).
5. Acompanhar os warnings de acesso anônimo. Log limpo → `AUTH_OBRIGATORIA=true`
   no EasyPanel.
6. Atualizar o `CLAUDE.md` do repo (a API passa a ter autenticação e há Alembic no
   `auth`), o `.env.example` e a nota do DataCoreHS no vault.

O passo 1 é reversível removendo o deploy. O passo 2 só adiciona um schema novo,
sem tocar em dado existente. O passo 5 se desfaz voltando a flag.

## Insumo para a etapa do front (DataCoreHS)

- A instância `authApi` passa a apontar para `https://tinyapi.healthsafetytech.com/auth`.
- Remover a troca de senha pelo próprio usuário. Só o admin define senha, na
  edição de usuário.
- Cadastro e edição de usuário (admin) ganham o campo `email`.
- O token passa a ser do tinyapi. O interceptor atual já manda `Bearer` para as
  duas instâncias.
