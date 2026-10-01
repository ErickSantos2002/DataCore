# Configurações — permissão, histórico, trimestre automático e página nova

Data: 01/10/2026 · Status: aprovado em conversa, aguardando revisão da spec

## Por quê

A página Configurações é uma lista crua de chave/valor com um botão Editar. Ela:

- mostra `META` como `12666666.72`, sem dizer que é a meta **anual** (a tela divide por 4);
- obriga alguém a lembrar de trocar `MESES_ANALISE` a cada virada de trimestre, em
  texto livre sem validação — e a lista de meses não tem ano;
- exibe `CFOP_VALIDOS` e `MARCADORES_INVALIDOS` como se mexessem no painel, quando o
  painel não as lê mais (a régua está no dbt). Quem lê é o **HS.OS**;
- engole erro de gravação (a promessa rejeita e nada aparece na tela);
- não guarda quem mudou o quê.

E o backend aceita `PUT /configuracoes/{chave}` de **qualquer usuário logado**: só o
front barra o não-admin.

## Escopo

Neste repo, em três entregas com teste e commit próprios: **1** backend, **2**
trimestre, **3** página. A parte **4** (HS.OS) é outro repo — aqui fica só a spec
para a sessão de lá.

Fora do escopo: configurações hoje fixas no código de outras telas.

## 1. Backend — permissão, validação, histórico

**Permissão.** `PUT /configuracoes/{chave}` e `POST /configuracoes/` passam a
depender de `exigir_admin` (`app/core/security.py`). `GET` continua com o
`PROTEGIDO` do roteador: todo usuário logado lê, porque o painel precisa.

**Validação por chave**, num módulo próprio (`app/core/configuracoes.py`), chamada
pelo `PUT` e pelo `POST`. Chave conhecida com valor inválido → **422** com
`detail` em português, que o front mostra como veio.

| Chave | Aceita | Grava como |
|---|---|---|
| `META` | número > 0 em qualquer dos três formatos de hoje (`12666666.72`, `12.666.666,72`, `12666666,72`) | `12666666.72` — ponto decimal, sem milhar |
| `TRIMESTRE_APURACAO` | `auto`, ou `AAAA-TN` com N de 1 a 4 e ano entre 2020 e o ano corrente + 1 | o mesmo texto, `T` maiúsculo |
| `ANIMACAO_META` | `true` / `false` | o mesmo |
| qualquer outra | texto livre | o mesmo |

O parse da META segue o `parseValor` do front (`metaTrimestral.ts`), com os mesmos
três casos nos testes.

**Histórico.** Tabela nova:

```sql
CREATE TABLE tiny.configuracoes_historico (
    id             bigserial PRIMARY KEY,
    chave          text        NOT NULL,
    valor_anterior text,                    -- NULL quando a chave foi criada
    valor_novo     text        NOT NULL,
    alterado_por   text        NOT NULL,    -- username de quem alterou (o e-mail é opcional em auth.usuarios)
    alterado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON tiny.configuracoes_historico (alterado_em DESC);
```

O `PUT` e o `POST` gravam a linha do histórico **na mesma transação** da alteração:
não existe mudança sem registro. Gravar o mesmo valor que já está lá não gera
linha (nem altera nada) — o switch da comemoração clicado duas vezes não polui o
histórico.

`GET /configuracoes/historico?limite=20` — só admin, mais recente primeiro,
`limite` entre 1 e 100. A rota é declarada **antes** de `GET /{chave}`, senão o
FastAPI a captura como a chave `historico`.

**DDL.** Duas migrations SQL, rodadas à mão no Konsole com o superusuário (o
`tiny` não tem Alembic), pelo `scripts/migrar_tiny.sh`:

- `002_configuracoes_historico.sql` — cria a tabela e a chave
  `TRIMESTRE_APURACAO = 'auto'`. Roda **antes** do deploy: o backend novo grava
  histórico em todo `PUT`, e o front antigo ignora a chave nova.
- `003_aposentar_meses_analise.sql` — apaga `MESES_ANALISE`. Roda **depois** do
  deploy do front: o front antigo sem ela ficaria sem trimestre.

As permissões da tabela nova copiam as da `tiny.configuracoes`: quem pode
`UPDATE` lá ganha `SELECT`/`INSERT` aqui (e `USAGE` na sequência); quem só lê lá,
só lê aqui. Assim o script não precisa saber o nome dos usuários.

**Testes** (pytest, `backend/tests/`): não-admin recebe 403 no `PUT`/`POST`; cada
regra da tabela de validação; META normalizada nos três formatos; histórico
gravado com valor anterior e autor; mesmo valor não gera linha; rota de histórico
só para admin, ordenada e limitada.

## 2. Trimestre automático, com exceção

`MESES_ANALISE` (lista de meses sem ano) dá lugar a **`TRIMESTRE_APURACAO`**:

- `auto` — o trimestre do calendário em que `hoje` está. É o padrão.
- `2026-T3` — trimestre fixado. Serve para olhar o fechamento de um trimestre já
  encerrado (ex.: o T3 no dia 1º de outubro, ou o T4 no dia 2 de janeiro — por
  isso o ano faz parte do valor).

Uma função só decide, em `frontend/src/pages/dashboard/trimestre.ts`:

```ts
interface TrimestreEmApuracao {
  ano: number;
  trimestre: 1 | 2 | 3 | 4;
  meses: number[];          // [7, 8, 9]
  fixado: boolean;          // true quando a configuração não é "auto"
}
function trimestreEmApuracao(valor: string | undefined, hoje: Date): TrimestreEmApuracao
```

Valor ausente, vazio ou inválido vale `auto` — o painel nunca fica sem trimestre.

Quem passa a usar:

- **`DashboardContext`** — busca `totaisDoAno(ano)` do trimestre (não mais sempre o
  ano corrente) e `totaisDoAno(ano - 1)` para a forma sazonal. O `totalAno` e o
  gráfico mês a mês continuam sendo do ano **corrente**: com um trimestre de ano
  passado fixado, são duas requisições do ano do trimestre e uma do corrente.
- **`Dashboard`** — tira os meses da mesma função (some o `mesesDoTrimestre`
  paralelo). Para a projeção, um trimestre fixado já encerrado mostra o próprio
  realizado — a regra já existe em `projecaoDeFechamento`. O `hoje` passado à
  projeção continua sendo a data real; o ano que ela usa para dias e ano anterior
  passa a vir do trimestre (a função ganha `ano` na entrada).
- Com `fixado`, o cabeçalho da meta mostra um aviso: "Trimestre fixado em
  Configurações: 3º de 2026. O painel não está seguindo o calendário."

A `002` cria `TRIMESTRE_APURACAO = 'auto'`; a `003` apaga `MESES_ANALISE`. ⚠️ A skill
`faturamento` do **HS.OS** lê `MESES_ANALISE` num SQL dentro de `SKILL.md` (achado na
revisão final — a varredura de 01/10 só olhou código): a `003` espera também a parte 4.

**Ordem de deploy:** `002` → deploy do backend e do front → skill do HS.OS sem `MESES_ANALISE` (parte 4) → `003`. O front novo
trata a ausência de `TRIMESTRE_APURACAO` como `auto`; o **antigo** sem
`MESES_ANALISE` ficaria sem meses.

**Projeção com trimestre fixado de outro ano.** `projecaoDeFechamento` ganha `ano`
na entrada. Trimestre de ano anterior ao de `hoje` conta como inteiro decorrido
(projeção = realizado); de ano posterior, como não começado (`disponivel: false`).

**Testes** (vitest): `auto` em cada trimestre e nas viradas (31/03 → 01/04,
31/12 → 01/01); valor fixado com e sem ano corrente; inválido cai em `auto`;
contexto busca o ano do trimestre fixado; aviso aparece só quando fixado. Os
testes que hoje montam `MESES_ANALISE` passam a montar `TRIMESTRE_APURACAO`.

## 3. A página

Seções com nome e explicação no lugar da lista de chaves. Cada seção é um
componente em `frontend/src/pages/configuracoes/`, a página só os empilha.

- **Meta anual** — campo em R$ (aceita os formatos com vírgula ou ponto). Ao lado,
  enquanto se digita: a meta do trimestre (÷4) e os três degraus, 55% / 85% / 100%
  de PL (90% / 120% / 140%), pela `degrausDaMeta` que o painel já usa.
- **Trimestre em apuração** — "Automático" mostrando qual é ("4º trimestre de
  2026 · out, nov, dez"), ou "Fixar" com ano e trimestre.
- **Comemoração** — o switch de hoje.
- **Usadas por outros sistemas** — toda chave que a página não reconhece, com
  edição livre como hoje. Hoje: `CFOP_VALIDOS` e `MARCADORES_INVALIDOS`, com a nota
  "lida pelo HS.OS — o painel usa a régua do dbt". Some sozinha quando não houver
  chave desconhecida.
- **Histórico** — as últimas 20 alterações: quando, quem, chave, de → para.

Erro ao salvar (o 422 do backend, rede, 403) aparece na seção que salvou, com o
texto do backend; o campo continua aberto com o que foi digitado.

**Testes** (vitest + Testing Library): cada seção salva o valor certo; degraus
recalculam ao digitar; erro do backend aparece e não fecha a edição; seção de
outros sistemas lista só chave desconhecida e some sem ela; histórico renderiza;
não-admin continua vendo "Acesso negado".

## 4. HS.OS — régua única (outro repo, `cl HS.OS`)

`HS.OS/backend/app/relatorios/compradores.py` monta a régua de venda lendo
`CFOP_VALIDOS` e `MARCADORES_INVALIDOS` de `tiny.configuracoes`. A régua oficial é
a do dbt (`analytics/models/silver/vendas.sql` → `gold.fato_vendas`).

Diferenças que a migração tem que enfrentar, e não esconder:

1. **CFOP da nota × CFOP do item.** O HS.OS tira o CFOP da `natureza_operacao` da
   nota; o dbt usa o CFOP **do item** (`5102/6102/5108/6108/7102`) — inclusive
   exportação, que a configuração não tem.
2. **Marcadores.** O dbt classifica por `stg_marcadores`; o HS.OS faz `LIKE` contra
   a lista da chave.
3. **Devolução.** O HS.OS só abate devolução (1202/2202) cuja venda de origem ainda
   conta na régua. Isso continua no HS.OS — a pergunta passa a ser "a origem está
   em `gold.fato_vendas`?".
4. **Âncora.** Os testes de lá fixam 217 Phoebus em 2025 (e 137 empresas / 757
   unidades na apuração de 30/09). Rodar as duas réguas lado a lado e explicar
   cada diferença antes de trocar — a skill `faturamento` do HS.OS documenta a
   mesma régua e muda junto.

5. **`MESES_ANALISE`.** `backend/skills/faturamento/SKILL.md` (seção da meta, ~linha
   105–125) monta `meses AS (SELECT ... WHERE chave='MESES_ANALISE')` e faz cross join.
   Sem a chave, o agente responde realizado = 0 sem erro. Trocar por `TRIMESTRE_APURACAO`
   (`auto` = trimestre do calendário; `AAAA-TN` = fixado) **antes** da migração `003`
   do DataCore. A META agora é sempre gravada como `12666666.72`, então o
   `valor::numeric/4` de lá para de depender do formato.

Depois disso no ar: `DELETE FROM tiny.configuracoes WHERE chave IN ('CFOP_VALIDOS',
'MARCADORES_INVALIDOS')`, por script no Konsole.

## Riscos

- **`003` antes do front** deixa o painel antigo sem trimestre; **backend antes da
  `002`** faz todo `PUT` falhar (tabela de histórico ausente). A ordem está na parte 2.
- **Permissão do histórico**: sem o `GRANT`, o `PUT` falha inteiro (mesma
  transação). O script concede e o teste de fumaça pós-migração é um `PUT` real
  da `ANIMACAO_META` pela página.
