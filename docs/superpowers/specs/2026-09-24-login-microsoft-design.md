# Login com Microsoft (Entra ID) — design

**Data:** 2026-09-24 · **Escopo:** `backend/` e `frontend/`.

## Objetivo

Hoje o DataCoreHS só entra com usuário e senha do próprio sistema. O objetivo é
**somar** um botão "Entrar com Microsoft", como já existe no GestorHS, no TaskHS e
no CRM, sem tirar o login por senha.

**Sucesso =** quem tem usuário no DataCore com e-mail `@healthsafetytech.com`
cadastrado entra clicando no botão, com o mesmo papel e o mesmo token de 8 h do
login por senha. Quem não tem usuário recebe uma mensagem clara e não entra. O login
por senha continua funcionando igual.

### Pré-requisitos já feitos (24/09/2026)

- E-mails corporativos gravados em 26 dos 28 usuários de `auth.usuarios`, cruzados
  com o TaskHS. `alex` e `fortipam` ficam sem e-mail e entram só por senha. O
  `rickelme` (admin, TI) foi cadastrado.
- Registro de aplicativo próprio do DataCore no Entra (single tenant), com as
  redirect URIs de produção e local e um client secret. Os valores estão no
  `backend/.env` local; em produção vão para o ambiente do `datacore-api` no
  EasyPanel.

## Fora do escopo

- **Criar usuário no primeiro acesso.** Quem não tem `Usuario` com o e-mail não
  entra. O controle de acesso continua num lugar só (a tela de usuários), e o tenant
  inteiro não ganha acesso aos dados do Tiny.
- **Desligar o login por senha.**
- **Sair da conta Microsoft junto no logout.** "Sair" limpa só a sessão do DataCore.
- **Guardar o token da Microsoft.** Ele é usado no callback para ler o e-mail e
  descartado.

## Fluxo

```
Login  ──(navegação)──▶ GET /auth/microsoft
                          gera state, grava cookie sso_state
                          302 → login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize
Microsoft ─────────────▶ GET /auth/microsoft/callback?code&state
                          confere state com o cookie
                          troca code por token → GET graph.microsoft.com/v1.0/me
                          e-mail normalizado → Usuario por email
                          criar_token(usuario) → grava ticket (60 s)
                          302 → {FRONTEND_URL}/auth/callback?ticket=<opaco>
Front /auth/callback ──▶ POST /auth/sso/exchange {ticket}
                          ← TokenSaida (o mesmo do /auth/login)
                          → entrarComToken → /me → /inicio
```

Qualquer falha no callback vira `302 → {FRONTEND_URL}/login?erro_sso=<código>`.

## Backend

### Rotas (em `app/api/endpoints/auth.py`, sem dependência de token)

| Rota | O que faz |
|---|---|
| `GET /auth/microsoft` | Gera `state` (`secrets.token_urlsafe(32)`), grava no cookie `sso_state` e redireciona para a autorização da Microsoft (`scope=openid email profile User.Read`, `response_mode=query`). Com o SSO desligado, redireciona para `/login?erro_sso=sso_desligado`; sem `FRONTEND_URL` não há para onde mandar, e responde 404. |
| `GET /auth/microsoft/callback` | Valida `state`, troca `code`, lê o e-mail, acha o usuário, emite o ticket e redireciona para o front. Sempre apaga o cookie `sso_state`. |
| `POST /auth/sso/exchange` | Corpo `{"ticket": str}`. Resgata o ticket e devolve `TokenSaida` (`access_token`, `token_type`, `role`, `username`, `user_id`). Ticket inexistente, vencido ou já usado: `400 "Link de acesso inválido ou expirado."`. |
| `GET /auth/sso/status` | `{"ativo": bool}` — o front mostra o botão só com `true`. |

Os endpoints são `def` (síncronos), como os demais do `auth.py`.

### Cookie `sso_state`

`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/auth/microsoft`, `Max-Age=600`. `Lax`
basta: a volta da Microsoft é navegação de topo com GET, e nela o cookie vai junto.

A comparação é `secrets.compare_digest(state.encode(), cookie.encode())`. Sobre
`str`, o `compare_digest` levanta `TypeError` com caractere não ASCII, e o `state`
vem da query string — seria um 500 esperando acontecer. Cookie ausente, `state`
ausente ou diferentes → `erro_sso=state_invalido`.

O `state` impede login CSRF: sem ele, alguém com conta poderia mandar um link que
faz outra pessoa entrar na conta dele.

### Microsoft (`app/core/microsoft.py`, novo)

- `url_de_autorizacao(state) -> str`
- `trocar_code_por_token(code) -> str` — `POST .../oauth2/v2.0/token` com
  `grant_type=authorization_code`, `client_id`, `client_secret`, `code`,
  `redirect_uri`. Devolve o `access_token`.
- `email_do_usuario(access_token) -> str | None` — `GET /v1.0/me`; usa `mail` e,
  se vier nulo, `userPrincipalName`.

HTTP com `requests` (já é dependência), `timeout=10`. Erro de rede ou resposta
não-2xx levanta `ErroMicrosoft`, que o callback converte em
`erro_sso=falha_microsoft` e registra no log `app.auth` (sem o `code` e sem token).

### E-mail é a chave

O e-mail do Graph passa pelo mesmo `_normalizar_email` do cadastro (`strip` +
`lower`) e a busca é `Usuario.email == email`. O índice único parcial de
`auth.usuarios.email` garante no máximo um usuário. E-mail nulo, inválido ou sem
usuário → `erro_sso=usuario_nao_encontrado`.

### Ticket (`app/core/sso_tickets.py`, novo)

Tabela `auth.sso_tickets` (migration Alembic `0002`):

| coluna | tipo |
|---|---|
| `ticket` | `text` PK — `secrets.token_urlsafe(32)` |
| `access_token` | `text NOT NULL` |
| `expira_em` | `timestamptz NOT NULL` — agora + 60 s |

SQL direto com `text()`. A tabela tem também um modelo ORM (`app/models/sso_ticket.py`),
só para o `alembic check` do `test_migrations.py` não acusar a tabela como sobra.

- `emitir(db, access_token) -> str` — insere e devolve o ticket.
- `resgatar(db, ticket) -> str | None` — na mesma transação:
  `DELETE FROM auth.sso_tickets WHERE expira_em <= now()` e
  `DELETE ... WHERE ticket = :t AND expira_em > now() RETURNING access_token`.
  O `DELETE ... RETURNING` é atômico: duas trocas simultâneas do mesmo ticket, só
  uma recebe o token.

O ticket fica no Postgres, e não em memória como no GestorHS, para funcionar com
qualquer número de workers ou réplicas. Em memória, dois processos fazem o login
falhar em metade das tentativas sem nada no log.

A migration dá `SELECT, INSERT, DELETE ON auth.sso_tickets` ao `AUTH_APP_DB_USER`,
no mesmo padrão da `0001`.

### Por que um ticket, e não o token na URL

O callback não pode mandar o JWT na query string: ele entraria no histórico do
navegador, no log do proxy e no `Referer`. O ticket é opaco, de uso único e vale
60 s, e o front o troca por `POST`. O `code` da Microsoft e o `ticket` ainda
aparecem no log de acesso do proxy, mas os dois são de uso único e de vida curta.

### Configuração (`app/core/config.py`)

`MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_REDIRECT_URI`,
`FRONTEND_URL`, todos `str = ""`, e a property `sso_ativo`, que é `True` só com
os cinco preenchidos. Sem eles a API sobe normal e o SSO fica desligado. Entram
também no `.env.example`, vazios.

### Códigos de `erro_sso`

| código | quando |
|---|---|
| `sso_desligado` | alguma das cinco variáveis vazia |
| `cancelado` | a Microsoft devolveu `error=access_denied` (a pessoa cancelou) |
| `state_invalido` | cookie ou `state` ausente, ou diferentes |
| `falha_microsoft` | outro `error` da Microsoft, `code` ausente, falha na troca ou no Graph |
| `usuario_nao_encontrado` | e-mail vazio, inválido ou sem usuário no DataCore |

### O que não muda

`POST /auth/login`, a gestão de usuários e o `usuario_do_token`, que lê o papel do
banco a cada requisição. **Excluir o usuário no DataCore continua sendo o que corta
o acesso.** Desativar a conta no Entra só impede logins novos: um token já emitido
vale até vencer (até 8 h).

## Frontend

### `context/AuthContext.tsx`

O trecho depois do `POST /login` (gravar `access_token`, buscar `/me`, gravar `id`,
`username`, `role` e atualizar o estado) vira `entrarComToken(token)`, exposto no
contexto. O `login(username, password)` passa a chamá-la. Uma única cópia da lógica
de sessão.

### `pages/Login.tsx`

- Abaixo do formulário, um divisor "ou" e o botão "Entrar com Microsoft" (logo da
  Microsoft em SVG inline, `Button` do design system). O painel continua escuro nos
  dois temas.
- O botão aparece só se `GET /auth/sso/status` responder `ativo: true`. Falha na
  chamada → botão escondido; o login por senha segue normal.
- Clicar faz `window.location.assign(<base da auth>/microsoft)`. É navegação, não
  `fetch`: é redirect entre domínios.
- Com `?erro_sso=` na URL, mostra a mensagem no mesmo lugar do erro de senha e
  limpa o parâmetro com `history.replaceState`:
  - `usuario_nao_encontrado` → "Sua conta Microsoft não tem acesso ao DataCore.
    Fale com o administrador."
  - `cancelado` → "Login com Microsoft cancelado."
  - demais → "Não foi possível entrar com a Microsoft. Tente de novo ou use usuário
    e senha."

### `pages/AuthCallback.tsx` (novo), rota `/auth/callback`

Sem layout, como o `/login` (entra em `noLayoutRoutes`). Ao montar:

1. Lê `ticket` da URL e tira da barra na hora (`history.replaceState`).
2. `POST /sso/exchange` → `entrarComToken(access_token)` → `/inicio`.
3. Sem ticket ou com erro: "Link de acesso inválido ou expirado." e o botão
   "Voltar para o login".

Tem que rodar uma vez só: o `StrictMode` monta duas vezes em dev, e a segunda troca
do mesmo ticket falharia. Guarda com `useRef`.

### Serviço

`services/api.ts` ganha `trocarTicket(ticket)`, `ssoAtivo()` e a constante com a
URL de `/microsoft`, todos sobre a mesma base da autenticação (`VITE_API_URL` ou
`…/auth`).

O nginx já devolve `index.html` para qualquer rota (`try_files $uri /index.html`):
`/auth/callback` não pede mudança de infra.

## Testes

**Backend (pytest, Postgres descartável do `docker-compose.test.yml`)**, com a
Microsoft simulada (`monkeypatch` em `app.core.microsoft`):

- `/auth/microsoft`: redireciona com `state` e grava o cookie; com SSO desligado,
  `erro_sso=sso_desligado`.
- callback: `state` diferente, ausente, cookie ausente e `state` com acento → sempre
  `state_invalido`, nunca 500; `error=access_denied` → `cancelado`; falha na troca →
  `falha_microsoft`; e-mail sem usuário → `usuario_nao_encontrado`; e-mail com
  maiúsculas acha o usuário cadastrado em minúsculas; caminho feliz → 302 para o
  front com `ticket`, e o cookie é apagado.
- exchange: ticket válido devolve o token de um usuário que `/auth/me` aceita;
  segunda troca → 400; ticket vencido → 400; duas trocas concorrentes → exatamente
  uma com sucesso.
- `/auth/sso/status` com e sem configuração.
- migration `0002`: sobe, desce e dá os grants (em `test_migrations.py`).

**Frontend (vitest):** botão escondido com SSO desligado e com falha no status;
visível com SSO ativo; mensagens de cada `erro_sso`; callback feliz leva a
`/inicio`; callback com ticket inválido mostra o erro; troca feita uma vez só;
`login` com senha segue funcionando depois da extração do `entrarComToken`.

**Na mão, no fim:** entrar em produção com uma conta Microsoft real.

## Implantação

1. **Migration `0002`** — o Erick roda no Konsole, da pasta `backend/`:
   `AUTH_APP_DB_USER=<usuário do DATABASE_URL de produção> bash scripts/migrar.sh`.
   Tem que vir antes do deploy da API: sem a tabela, o callback falha.
2. **`datacore-api`** — as cinco variáveis no ambiente do EasyPanel, "Implantar".
3. **`datacore-sistema`** — "Implantar".

Nessa ordem nada quebra no meio: sem o front novo ninguém vê o botão; sem as
variáveis, `/sso/status` responde desligado e o front esconde o botão.

## Arquivos

| Arquivo | Mudança |
|---|---|
| `backend/alembic/versions/0002_sso_tickets.py` | criar |
| `backend/app/core/config.py` | cinco variáveis + `sso_ativo` |
| `backend/app/core/microsoft.py` | criar |
| `backend/app/core/sso_tickets.py` | criar |
| `backend/app/models/sso_ticket.py` | criar (modelo para o `alembic check`) |
| `backend/app/api/endpoints/auth.py` | quatro rotas |
| `backend/app/schemas/auth.py` | `TicketEntrada`, `SsoStatus` |
| `backend/.env.example` | bloco do SSO |
| `backend/tests/test_sso.py` | criar |
| `backend/tests/test_migrations.py` | casos da `0002` |
| `frontend/src/context/AuthContext.tsx` | `entrarComToken` |
| `frontend/src/services/api.ts` | `trocarTicket`, `ssoAtivo`, URL do `/microsoft` |
| `frontend/src/pages/Login.tsx` | botão, divisor, `erro_sso` |
| `frontend/src/pages/AuthCallback.tsx` | criar |
| `frontend/src/router.tsx`, `frontend/src/App.tsx` | rota `/auth/callback` sem layout |
| testes do front ao lado de cada arquivo | criar/atualizar |
