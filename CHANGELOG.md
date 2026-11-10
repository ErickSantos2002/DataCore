# Changelog

O que mudou no DataCore, do mais novo para o mais antigo. Deploy é manual pelo
EasyPanel: a data é a do código em `main`, não a de quando foi ao ar.

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
  algum dashboard externo as usa com outro usuário, leva 403.
- Teste que garante `PROTEGIDO` em toda rota de dados voltou a checar de verdade: no
  FastAPI 0.141 ele só enxergava `/` e passava vazio.
- **Env nova no EasyPanel:** `HSOS_AGENTE_CHAVE_PUBLICA`, o PEM de
  `GET https://hsosapi.healthsafetytech.com/agente/chave-publica` (numa linha, `\n`
  literal). Sem ela, todo token de agente leva 401.
- `requirements.txt`: `PyJWT[crypto]` (o EdDSA precisa do `cryptography`).
