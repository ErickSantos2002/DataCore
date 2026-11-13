# Changelog

O que mudou no DataCore, do mais novo para o mais antigo. Deploy é manual pelo
EasyPanel: a data é a do código em `main`, não a de quando foi ao ar.

## 13/11/2026 — O que o Guardi alcança aqui (tela "Capacidade" do HS.OS)

**API (`datacore-api`)**

- Rota nova `GET /agente/capacidades`, só com token de agente (login normal → 404):
  devolve `{papel, rotas}` — o papel da pessoa para exibir e os pares
  `["GET", "<rota>"]` da lista do agente que o login dela consegue usar. O HS.OS
  cruza com os catálogos dele e mostra ao dono do Guardi o que ele pode pedir.
- Ao lado da lista do agente (`core/security.py`) agora fica declarado quem passa em
  cada rota (`QUEM_PASSA_NAS_ROTAS_DO_AGENTE`); a lista é a chave dessa tabela. Um
  teste percorre a lista e confere, papel a papel, que a rota declarada aberta passa e
  a fechada leva 403 — a tabela não diverge das rotas em silêncio.
- Inadimplência: o papel é conferido antes de abrir a conexão com o banco (mesmo
  resultado para quem chama).

## 12/11/2026 — Clientes liberados para o vendas

**API (`datacore-api`)**

- `GET /clientes/` e `GET /clientes/{id}` → admin, vendas, financeiro (antes admin,
  financeiro), o mesmo conjunto da página Clientes. Vale para login e token de agente:
  o Guardi de um SDR pediu um cliente do RS e levou 403. A restrição de 10/11 vinha só
  de a rota não ter tela, sem motivo próprio. `servicos` e `comum` seguem com 403.
- As outras rotas antigas da nota de 10/11 (`/notas_fiscais/`, `/notas_servico/`,
  `/itens_nota/`, `/enderecos_entrega/`) não mudam.

## 11/11/2026 — Notas de entrada no Gerenciamento Financeiro

Pedido do dono e do financeiro.

**API (`datacore-api`)**

- Rotas novas `/notas_entrada/resumo`, `/notas_entrada/pagina` e
  `/notas_entrada/{id}/itens`, para os usuários 1, 3 e 4 (o mesmo acesso da página
  Financeiro). As três entram na lista do token de agente (pedido do HS.OS): o
  Guardi de quem é desses usuários lê; o dos outros leva 403.
- Nota de entrada = nota com item de CFOP iniciado em 1, 2 ou 3. O `tipo_nota` do Tiny
  não serve (grava "N" até em compra). Batendo com o Tiny em 11/11: 340 notas e
  R$ 17.422.702,11 contra 341 e R$ 17.425.352,11, com as situações iguais.
- Tipos: compra (importação marcada à parte), devolução de venda, conserto/reparo e
  outras.
- ⚠️ As 39 notas de importação antigas apontam para um único cadastro sem CNPJ; o
  remetente real não está no banco, e elas aparecem como "Exterior — remetente não
  identificado".

**Painel (`datacore-sistema`)**

- A página Clientes volta a abrir para o papel vendas (desfaz a mudança de 01/10).
  O backend já liberava: a tela lê as rotas do comercial.
- Aba "Notas de Entrada" no Gerenciamento Financeiro: filtros de ano, situação e tipo;
  valor, quantidade, remetentes e importação; gráfico mês a mês; por tipo; maiores
  remetentes; tabela paginada com busca e ordenação, e os itens da nota num clique.

## 10/11/2026 — Papel nas rotas irmãs

**API (`datacore-api`)** — só login; o token de agente segue recusado nelas.

- `/centro_custo/config/` (ler e salvar) → usuários 1, 3 e 4, como o relatório que ela
  configura. Antes qualquer logado alterava.
- Listas `/contas_pagar/` e `/contas_receber/` → admin, financeiro, como os resumos.
- `PATCH /notas_fiscais/{id}/tipo` → admin, vendas, financeiro (tela Vendedores).
- Escritas de `/estoque/` (POST, PUT, DELETE) → só admin; nenhuma tela as usa.
- `/operacao/importacoes`, `/execucoes`, `/avisos` e `POST /notas_servico/importar` → só
  admin (tela Importações; o job de NFS-e roda no processo, não chama o endpoint).
- `/enderecos_entrega/`, `/formas_envio/`, `/marcadores/` → admin, financeiro; nenhuma
  tela as usa.
- Seguem só com login, porque o Dashboard (livre) as lê: `GET /configuracoes/` e
  `GET /operacao/atualizacao-manual`.

## 10/11/2026 — Iris e Guardis leem o DataCore

**API (`datacore-api`)**

- O **token de agente do HS.OS** (JWT EdDSA, `iss=hsos`, `aud=datacore`, `exp` ≤ 600 s)
  passa a valer em **GET** de uma lista fechada de rotas (`ROTAS_DO_AGENTE`): clientes,
  estoque, faturamento, notas fiscais e de serviço, itens de nota, resumo/página de
  contas a pagar e a receber, as cinco leituras da Inadimplência e o resumo de centro de
  custo. A Iris lê a régua da tela em vez de calcular "vencido" sozinha; os Guardis
  consultam o resto.
- O token vale como o usuário cujo **e-mail** está no `sub` (comparação em minúsculas),
  com o que o login dele já pode — nada a mais. Sem usuário, assinatura errada, `aud`
  errado ou vencido → 401.
- Fora da lista e em toda escrita (POST, PUT, PATCH, DELETE) → 403, inclusive `/auth`,
  `/configuracoes`, `/operacao` e os anexos da cobrança.
- **Papéis conferidos no backend** nessas rotas, espelhando a matriz do front, para
  login e agente: faturamento de vendas/filtros/resumo → admin, vendas, financeiro;
  serviços → admin, servicos, financeiro; contas a pagar/receber (resumo e página),
  clientes, notas fiscais e de serviço, itens de nota → admin, financeiro; locação e
  resumo de centro de custo → usuários 1, 3 e 4; estoque e faturamento mensal → livres.
  Antes só a Inadimplência conferia papel; o resto confiava no menu.
  ⚠️ Rotas antigas sem tela (`/clientes/`, `/notas_fiscais/`, `/notas_fiscais/vendas/`,
  `/notas_servico/`, `/itens_nota/`) passam a negar quem não é admin ou financeiro: se
  algum dashboard externo as usa com outro usuário, leva 403. (Em 12/11 `/clientes/`
  passou a abrir também para o vendas.)
- Teste que garante `PROTEGIDO` em toda rota de dados voltou a checar de verdade: no
  FastAPI 0.141 ele só enxergava `/` e passava vazio.
- **Env nova no EasyPanel:** `HSOS_AGENTE_CHAVE_PUBLICA`, o PEM de
  `GET https://hsosapi.healthsafetytech.com/agente/chave-publica` (numa linha, `\n`
  literal). Sem ela, todo token de agente leva 401.
- `requirements.txt`: `PyJWT[crypto]` (o EdDSA precisa do `cryptography`).
