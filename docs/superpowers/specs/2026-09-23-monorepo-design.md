# DataCore — front e back num repositório só

Data: 2026-09-23 · Status: aprovado em conversa, aguardando revisão da spec

## Objetivo

Juntar o **DataCoreHS** (front, React + TypeScript) e o **tiny-integrador** (back,
FastAPI, mais o dbt e os jobs) num repositório novo e **público**,
`ErickSantos2002/DataCore`, no mesmo formato dos projetos recentes da HS (TaskHS,
GestorHS, Grana): `frontend/` e `backend/` na raiz.

Sucesso significa:

- os três serviços do EasyPanel (`datacore-sistema`, `datacore-api`, `datacore-dbt`)
  publicam a partir do DataCore, sem mudança de comportamento em produção;
- as suítes passam no repo novo com os mesmos baselines de antes;
- os dois repos antigos ficam privados e arquivados, e somem do `~/github`.

## Decisões

| Tema | Decisão | Por quê |
|---|---|---|
| Histórico | **Começa do zero**: um commit inicial com o estado atual | Os repos antigos têm vazamentos no histórico que não serão limpos; o repo novo nasce sem eles |
| Visibilidade | DataCore **público**; DataCoreHS e tiny-integrador ficam **privados** | Decisão do Erick |
| Estrutura | 4 pastas na raiz: `frontend/`, `backend/`, `analytics/`, `deploy/` | O dbt já é serviço próprio no EasyPanel, com Dockerfile próprio; `deploy/` serve API e dbt |
| Escopo | Mudança + integração mínima | Mover sem refatorar; unificar código fica pra depois, com o sistema estável no repo novo |
| Execução na VPS | Claude pelo MCP do EasyPanel, **Erick aprovando cada chamada** | A VPS é produção da HS inteira |
| Sessão de execução | Aberta dentro do repo novo (`cl DataCore`) | Regra de território: escrevo no repo onde a sessão foi aberta |

## 1. Conteúdo do repositório

### Origem do snapshot

Sai do que está **no GitHub**, não da cópia local, via `git archive` — só entra o que é
versionado (`node_modules`, `dist`, `.env*`, `brag-output/`, `traefik/acme.json` ficam de
fora sem esforço):

| Repo | Ref | SHA (23/09/2026) |
|---|---|---|
| DataCoreHS | `origin/main` | `a19b1e2f` |
| tiny-integrador | `origin/main` | `b18e726` |

Conferido em 23/09: a branch local `chore/arquivos-soltos` já está contida em
`origin/main`, e `origin/extrator-notas-tiny` não tem commit fora do main. Se algum dos
dois `origin/main` andar antes da publicação, o snapshot é refeito do SHA novo.

### Mapa de pastas

```
DataCore/
├── frontend/     DataCoreHS inteiro (inclui docs/superpowers do design system)
├── backend/      tiny-integrador sem analytics/ e deploy/:
│                 app/, alembic/, alembic.ini, migrations/, tests/, scripts/,
│                 testar_*.py, requirements*.txt, pytest.ini, docker-compose.test.yml,
│                 NFSE_IMPORTACAO.md, README.md, docs/superpowers, .env.example
├── analytics/    tiny-integrador/analytics/ (serviço datacore-dbt)
├── deploy/       tiny-integrador/deploy/ (systemd + rodar-job.sh / rodar-dbt.sh)
├── docs/         specs e planos do próprio monorepo
├── CLAUDE.md
├── README.md
├── .gitignore
└── docker-compose.yml   (dev)
```

### Integração mínima

- **`Dockerfile` com D maiúsculo** em `frontend/` e `backend/`. Os três serviços do
  EasyPanel pedem `build.file: "Dockerfile"`; os repos antigos têm `dockerfile`. O
  `analytics/Dockerfile` já está certo.
- **Composes antigos saem.** Os `docker-compose.yml` de DataCoreHS e tiny-integrador
  sobem Traefik e não refletem o deploy real (EasyPanel). Saem junto os `traefik/`
  que só serviam a eles. **Fica** o `frontend/traefik/nginx.conf` (o Dockerfile do
  front copia dele; pode mudar de pasta desde que o Dockerfile acompanhe) e o
  `backend/docker-compose.test.yml` (Postgres dos testes, porta 55432).
- **`docker-compose.yml` de dev na raiz** sobe `backend` (porta 8000, `env_file:
  backend/.env`) e `frontend` (vite em 5174 com `VITE_API_URL` e `VITE_NOTAS_URL`
  apontando pro backend local). Sem Traefik, sem banco: o backend usa o
  `DATABASE_URL` do `.env`, como hoje.
- **`CLAUDE.md` em três níveis e versionado** (como TaskHS, GestorHS, HS.OS; o
  DataCoreHS ignorava):
  - raiz: mapa das 4 pastas, quais serviços do EasyPanel saem de qual path, regras
    transversais (repo público → varrer antes do push, nunca `git add -A`; bancos pelo
    cadastro `bancos`);
  - `frontend/CLAUDE.md` e `backend/CLAUDE.md`: o conteúdo atual de cada repo, com os
    caminhos ajustados.
  - O `analytics/` já tem README próprio e não ganha CLAUDE.md.
  - `SETUP-CLAUDE.md` **continua fora do versionamento** (já teve string de conexão).
- **Referências a caminho** atualizadas: `tiny-integrador/...` e `DataCoreHS/...` em
  `deploy/*.sh`, `CLAUDE.md`, READMEs e no comentário de cabeçalho do
  `analytics/Dockerfile`.
- **`.gitignore` da raiz** complementa os de `frontend/`, `backend/` e `analytics/`,
  que continuam valendo dentro de cada pasta (cobre `.env*` exceto
  `.env.example`, `node_modules/`, `dist/`, `.venv/`, `brag-output/`, `acme.json`,
  `SETUP-CLAUDE.md`, `.claude/` local).

### Varredura antes do primeiro push (obrigatória — repo público)

Rodar sobre o **working tree inteiro que vai no commit**, `.md` incluído:

1. o valor literal da senha vazada e de qualquer senha conhecida dos bancos HS;
2. padrões de credencial: `postgres(ql)?://[^ ]*:[^ ]*@`, `password\s*[:=]`,
   `SECRET_KEY\s*=`, `BEGIN .*PRIVATE KEY`, tokens `sk-`/`ghp_`/`re_`;
3. IPs das VPS da HS (lista na memória do Claude, não aqui) — avaliar caso a caso;
4. CPF/CNPJ reais e nomes de pessoa com dado financeiro (lição do fechamento de
   comissão em testes);
5. arquivos que não deveriam estar lá: `.env` (sem `.example`), `.xlsx`, `.jsonl`,
   `acme.json`, `*.pem`, `*.key`.

As seeds do dbt (`analytics/seeds/*.csv`) foram conferidas: só ids e decisões, sem
dado de pessoa. Achado da varredura é removido/substituído antes do commit, nunca
depois.

Commit: `git add` por caminho explícito das 4 pastas + arquivos da raiz. Mensagem cita
os dois repos de origem e os SHAs do snapshot.

## 2. Troca em produção

### Estado atual (lido da VPS em 23/09/2026)

| Serviço (projeto `erick`) | Origem hoje | Origem depois | build |
|---|---|---|---|
| `datacore-dbt` | tiny-integrador · `main` · `/analytics/` | DataCore · `main` · `/analytics/` | Dockerfile |
| `datacore-api` | tiny-integrador · `main` · `/` | DataCore · `main` · `/backend/` | Dockerfile |
| `datacore-sistema` | DataCoreHS · `main` · `/` | DataCore · `main` · `/frontend/` | Dockerfile |

Todos com `autoDeploy: false`. Muda **só a origem** (repo e path). Env, domínio,
volume e réplicas não são tocados. `datacore-banco`, `datacore-contas` e
`datacore-contas-api` estão fora do escopo.

Os timers do systemd (`tiny-extrator-*.timer`, `datacore-dbt.timer`) chamam as cópias
em `/opt/datacore-jobs/`, que resolvem o container pelo **prefixo** do nome
(`erick_datacore-api`, `erick_datacore-dbt`). Não dependem do repo nem mudam com o
redeploy.

### Ordem

1. **Congelar** DataCoreHS e tiny-integrador: nenhum commit do snapshot até o passo 5.
2. **Publicar** o DataCore (após a varredura).
3. **Um serviço por vez, do menor risco pro maior:** `datacore-dbt` → `datacore-api` →
   `datacore-sistema`. Para cada um: trocar a origem pelo MCP (Erick aprova), clicar
   "Implantar" pelo MCP (Erick aprova), conferir antes de seguir:
   - **dbt:** container `erick_datacore-dbt.*` de pé com imagem nova;
     `dbt debug` dentro dele passa (só conecta e valida o projeto; o `dbt build`
     real fica com o timer, que é conferido no passo 6).
   - **api:** `GET https://tinyapi.healthsafetytech.com/` e `/docs` respondem; login do
     DataCoreHS em produção funciona.
   - **sistema:** a página do DataCore em produção carrega (domínio lido do EasyPanel na
     execução), login funciona, uma tela de dados abre.
4. **Rollback** de um serviço: voltar a origem dele pro repo antigo e reimplantar. Só
   funciona enquanto os repos antigos estão públicos — por isso o passo 5 vem por
   último.
5. **Com os três verdes:** Erick deixa DataCoreHS e tiny-integrador **privados e
   arquivados** no GitHub.
6. **Na primeira madrugada seguinte**, conferir que os timers rodaram
   (`systemctl list-timers`, logs do `tiny-extrator@` e `datacore-dbt`) e que o painel
   de avisos não acusou falha.

Antes de qualquer mutação, a execução usa `search_procedures` pra obter o nome e o schema
exatos da procedure de troca de origem e de deploy — nada de nome chutado.

## 3. Máquina local e sessões

- Clone em `~/github/DataCore`. Arquivos não versionados copiados à mão, **sem
  commitar**:
  - `DataCoreHS/.env`, `.env.local` → `frontend/`
  - `.env` do tiny-integrador, se existir → `backend/`
  - `.claude/` de cada repo → `frontend/.claude/` / `backend/.claude/` (ou raiz, se
    for configuração de sessão).
- Dependências recriadas: `backend/.venv` (com o `bancos` via `.pth`, como nas outras
  venvs) e `frontend/node_modules`. Mesma coisa pro `analytics/` se ele tiver venv
  local.
- **Prova de que nada quebrou** (baselines de 22–23/09):
  - front: `TZ=UTC npm test && TZ=America/Sao_Paulo npm test` → 2027 testes / 160
    arquivos; `npm run lint` → 9 avisos, 0 erros; `tsc` limpo; `prettier --check .`
    limpo; `npm run build` ok;
  - back: `pytest` verde contra o `docker-compose.test.yml`;
  - `docker build` de `frontend/`, `backend/` e `analytics/` a partir do repo novo.
- Depois da troca: `~/github/DataCoreHS` e `~/github/tiny-integrador` vão pra
  `~/github-arquivo/`. Isso tira os dois do `cl` e do Meta+C.
- **Memória do Claude:** atualizar as memórias que citam DataCoreHS/tiny-integrador
  pro caminho novo.
- **Vault:** uma nota curta de decisão em `_inbox/` (skill `nota-obsidian`). As 10
  notas que citam os repos antigos ficam como estão, porque são histórico.

## Fora do escopo

- Unificar `VITE_API_URL` / `VITE_NOTAS_URL` (a auth já mora no tinyapi em `/auth`).
- CI (nenhum dos dois repos tem hoje).
- Qualquer refactor de código, tipos compartilhados, renomear serviços do EasyPanel.
- Limpar o histórico dos repos antigos.

## Riscos

| Risco | Mitigação |
|---|---|
| Vazamento no repo público novo | Varredura obrigatória antes do push; `git add` por caminho |
| Commit nos repos antigos durante a troca | Congelamento; refazer snapshot se o `origin/main` andar |
| Build diferente por path/Dockerfile | `docker build` local das 3 pastas antes; troca serviço a serviço |
| Rollback impossível | Repos antigos só ficam privados depois dos três verdes |
| Job da madrugada quebrar | Timers independem do repo; conferência na manhã seguinte |
