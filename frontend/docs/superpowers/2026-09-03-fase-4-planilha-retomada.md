# Onde o item 3 da Fase 4 parou, e como retomar

> **Encerrado em 04/09/2026.** As Tasks 8, 9 e 10 foram executadas e o item está
> fechado — nada aqui é mais pendência. O documento fica como registro do que a
> parada custou e de como a retomada funcionou; o resultado final está no item 11
> de `2026-09-01-multiselect-divergencias.md` e na seção "Item 3 da Fase 4" do
> spec que governa. Duas coisas que a retomada descobriu e que este documento
> não previa: os nomes de arquivo `.pdf` tinham o mesmo defeito de UTC (quatro
> ocorrências, uma delas fora de `src/pages/`), e o guarda precisou de uma trava
> **sem isenção** para não deixar o defeito voltar justamente nas telas que a
> lista de pendentes isenta.

Escrito em 03/09/2026, ao encerrar o dia com o plano na metade. Este documento é
**versionado de propósito**: o ledger da execução vive em `.superpowers/`, que é
ignorado pelo git e é apagado quando o plano termina. O que está aqui sobrevive.

## O estado exato

Branch **`fase-4-planilha`**, 16 commits a partir de `020b54c7`, árvore limpa.

|                |                                                                            |
| -------------- | -------------------------------------------------------------------------- |
| Suíte          | **1433 testes / 93 arquivos**, verdes em `TZ=UTC` e `TZ=America/Sao_Paulo` |
| Lint           | **118** (o baseline era 119 — caiu, um import morto de `XLSX` saiu)        |
| `tsc --noEmit` | limpo                                                                      |
| Merge          | **nada mergeado na `main`**                                                |
| Push           | **nada enviado ao `origin`**                                               |

Os documentos que governam:

- Spec: `docs/superpowers/specs/2026-09-03-fase-4-planilha-design.md`
- Plano: `docs/superpowers/plans/2026-09-03-fase-4-planilha.md`

## O que já está feito — Tasks 1 a 7, todas revisadas e aprovadas

**O objetivo central do item já foi alcançado.** `json_to_sheet`, `book_new`,
`book_append_sheet` e `writeFile` existem hoje em **um lugar só** no
repositório, e as nove telas que exportam planilha consomem `baixarPlanilha`.

- `diaLocal` mora em `src/lib/datas.ts`, com teste de virada de dia. As duas
  cópias — `diaLocal` em `contas/contas.ts` e `dataDeHoje` em
  `financeiro/AbaComissao.tsx` — não existem mais.
- `src/lib/planilha.ts` existe, com `baixarPlanilha(abas, arquivo)` e a
  interface `AbaDePlanilha`.
- As nove consomem: `contas/TelaDeContas.tsx`, `Locacao.tsx`,
  `financeiro/AbaComissao.tsx` (as três com rede), mais `Produtos`, `Clientes`,
  `Estoque`, `Servicos`, `Vendas` e `Vendedores`.

**A prova de que a extração não mudou comportamento:** os quatro arquivos de
teste que já mockavam o `xlsx` — `Locacao.test.tsx`, `ContasPagar.test.tsx`,
`ContasReceber.test.tsx` e `financeiro/AbaComissao.test.tsx` — passaram **sem
uma edição**, 303 asserções. Foi por isso que essas três telas vieram antes das
seis que não têm teste de exportação.

## O que falta — Tasks 8, 9 e 10

**Os briefs das Tasks 8 e 9 ainda não foram extraídos.** O plano tem o texto
completo das três.

**Task 8 — o conserto do UTC nas seis telas sem rede.** Em `Clientes`,
`Estoque`, `Produtos`, `Servicos`, `Vendas` e `Vendedores`, trocar
`new Date().toISOString().split("T")[0]` por `diaLocal(new Date())`, importando
de `"../lib/datas"` (caminho relativo — **o alias `@/` não existe neste
repositório**). Um commit por tela.

**Task 9 — Locação, que é o caso instrutivo.** `nomeDoArquivo` em
`locacao/notasDeLocacao.ts` passa a usar `diaLocal`. Exige **duas edições
autorizadas**, escritas no plano antes de começar, porque os testes de Locação
hoje **pregam o defeito**:

- `Locacao.test.tsx:545` calcula a data esperada com o mesmo `toISOString()` que
  a tela usa — concorda com a tela por construção, certa ou errada;
- `locacao/notasDeLocacao.test.ts:93` escolheu `12:00Z` como instante, que cai
  no mesmo dia nos dois fusos e por isso nunca exercitou a virada.

A Task 9 também cria `src/test/guarda-planilha.test.ts`, com o código já no
plano.

**Task 10 — fechar a conta** nos documentos de divergências e no spec que
governa a modernização.

## Como retomar

```bash
cl DataCoreHS
```

Depois, invocar `superpowers:subagent-driven-development` apontando para
`docs/superpowers/plans/2026-09-03-fase-4-planilha.md`, e **retomar na Task 8**.

Se o ledger em `.superpowers/sdd/2026-09-03-fase-4-planilha/progress.md` ainda
existir, ele é o mapa detalhado: tasks com linha `complete` estão feitas e não
devem ser redespachadas. Se não existir, este documento e o `git log` bastam.

## As decisões tomadas durante a execução

Seis, e as quatro primeiras mudam código. Estão aqui porque são o que um
revisor humano vai querer auditar, e porque nenhuma delas é óbvia a partir do
diff.

**1. O `ajustar` roda antes do `book_append_sheet`.** `Vendedores.tsx` mexia na
folha depois de anexá-la ao livro; a função nova muta antes. Decidido por
raciocínio e **depois provado**: `node_modules/xlsx/xlsx.js`, função
`book_append_sheet`, faz `wb.Sheets[nome] = ws` — atribuição de referência, sem
clonagem. O objeto é o mesmo, a ordem não importa.

**2. `LinhaDaPlanilha` virou `type`, e não ganhou índice de string.** O tipo não
passava como `Record<string, unknown>[]`, e a primeira solução foi acrescentar
`[coluna: string]: string | number` à interface — o que a abriria para qualquer
chave e mataria o travamento das sete colunas que o docblock promete. Alias de
tipo de objeto ganha índice de string implícito no TypeScript; interface não,
porque é aberta a _declaration merging_. Trocar a palavra-chave resolveu o `tsc`
sem abrir o tipo.

A justificativa original da mudança citava um precedente em `contas.ts` que
**não existe**: ela declara `Record<string, unknown>[]` direto, sem tipo nomeado.

**3. O plano ganhou `src/test/guarda-planilha.test.ts`.** O plano original
deixava a Task 8 mudar comportamento em seis telas apoiada só num `grep` que
ninguém roda de novo depois. O repositório já tem a família
`src/test/guarda-*.test.ts` para regra de repositório; o guarda novo trava duas
coisas: o esqueleto do `xlsx` só em `lib/planilha.ts`, e nenhum `toISOString` em
`src/pages/`.

**4. Esse guarda precisou ser corrigido antes de existir.** Como eu o escrevi
primeiro, ele varria `/toISOString/` por linha e acusaria os **quatro arquivos
que citam o defeito em comentário** — `contas.ts:257` e `:637`,
`contas.test.ts:291`, `ContasPagar.test.tsx:1270`, `ContasReceber.test.tsx:1112`.
Um guarda que acusa código certo é um guarda desligado, e o desfecho provável
seria alguém apagar o comentário para o teste passar — o repositório perderia a
explicação do defeito. O guarda agora pula linha de comentário e exige a forma
de chamada.

**5. Um commit agrupa dois arquivos.** `Locacao.tsx` e
`locacao/notasDeLocacao.ts` mudaram juntos, contra a regra de um commit por
arquivo, porque separá-los produziria um commit que não compila.

**6. Um docblock contava errado.** O de `diaLocal` dizia que o defeito foi
reencontrado em "seis telas"; são **sete** — as seis não migradas mais Locação,
que é a mais instrutiva das sete.

## O que este item ensinou, e que vale além dele

**Um teste de data que escolhe o meio-dia não testa fuso.** É o motivo de o
defeito de UTC ter sobrevivido em Locação mesmo com teste de caracterização: o
instante escolhido foi `12:00Z`, que em São Paulo é 09:00 do mesmo dia. O
instante tem de ser escolhido perto da virada — e construído em **hora local**
(`new Date(2026, 7, 28, 23, 0, 0)`), nunca por string ISO, para a asserção valer
nos dois fusos sem consultar `process.env.TZ`.

**Caracterização que prega o defeito está certa, e não basta.**
`Locacao.test.tsx:545` replica o `toISOString` da tela de propósito, com
comentário admitindo. Fixar o que existe é o método correto — o que faltou foi
o passo seguinte, que é decidir o defeito em vez de deixá-lo pregado.

## Notas relacionadas

- `docs/superpowers/specs/2026-09-03-fase-4-planilha-design.md` — o spec deste item
- `docs/superpowers/plans/2026-09-03-fase-4-planilha.md` — o plano, com o texto das Tasks 8 a 10
- `docs/superpowers/2026-09-01-multiselect-divergencias.md` — a lista do que espera decisão do Erick
- `docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md` — o spec que governa a modernização
