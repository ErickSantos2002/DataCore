# Reaplicação da migração de Produtos sobre o `origin/main`

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA — usar
> superpowers:subagent-driven-development. Os passos são checkbox (`- [ ]`).

**Objetivo:** devolver a decomposição de `src/pages/Produtos.tsx` em
`src/pages/produtos/`, agora em cima da fonte de dados agregada que a outra
frente de trabalho colocou no `origin/main`, sem desfazer nada do que ela fez.

**Arquitetura:** a tela para de ler `useData()` (notas inteiras no navegador) e
passa a ler `useFiltrosComerciais()` + `useResumoComercial(recorte)` — a
agregação vem somada do Postgres. A decomposição em cinco componentes mais a
conta pura em `produtos.ts` continua valendo; o que muda é que boa parte da
conta pura **deixa de existir**, porque o banco passou a fazê-la.

**Spec:** `docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md`
(a receita da Fase 3 e o checklist de tela migrada).

**Plano original desta tela:** `docs/superpowers/plans/2026-09-08-fase-3-produtos.md`
— é dele que sai a decomposição que estamos reaplicando.

## Contexto: por que reaplicar em vez de mergear

O `main` local ficou 79 commits sem `push`. Uma sessão irmã, partindo de um
`origin/main` que nunca viu esse trabalho, reescreveu a fonte de dados de
Clientes, Produtos e Vendas. **O trabalho dela está pushado e é para ser
preservado** — não é candidato a `git revert`, `git checkout --theirs`, nem a
"volta a versão antiga que era melhor".

A boa notícia, medida antes de escrever este plano: a mudança dela em
`Produtos.tsx` é de 80 linhas somadas e 150 apagadas, e cai **exatamente** em
cima dos `useMemo` que a nossa migração extraiu. Do `// Ranking de produtos por
valor` (linha 256 da versão dela) para baixo, o arquivo dela é igual ao que a
nossa migração decompôs. Ou seja: KPIs, ranking, tabela, ordenação e exportação
sobrevivem intactos.

## Global Constraints

- Código, comentários e interface em **português do Brasil**.
- Commits em português, conventional commits, **sem acento** na mensagem.
- **Não existe alias `@/`** neste repositório — de `src/pages/` para a pasta
  irmã é `./produtos`, para `src/hooks` é `../hooks`.
- **Não reescrever histórico.** Nada de `git reset`, `commit --amend`,
  `rebase -i`. Errou um commit? Faz outro por cima.
- **Não fazer `push` nem merge.** Isso é decisão do Erick.
- A suíte tem de passar **nos dois fusos**: `TZ=UTC npm test` e
  `TZ=America/Sao_Paulo npm test`, zero pulados.
- `npx tsc --noEmit` limpo. O lint **não pode subir** (base: 58 problemas).
- **Mover é mover.** No commit que move código não se corrige nada. Defeito
  encontrado vira comentário `Achado ao mover (não corrigido)` e continua vivo.
- `PENDENTES_FASE_3` (em `src/test/guarda-cores.test.ts`) **só encolhe**.

---

### Task 1: A rede de segurança — caracterizar antes de mover uma linha

**Arquivos:**

- Criar: `src/pages/Produtos.kpis.test.tsx`
- Criar: `src/pages/Produtos.tabela.test.tsx`
- **Não tocar** em `src/pages/Produtos.tsx` (a não ser para plantar e reverter)

**Interfaces:**

- Consome: `criarHooksFalsos`, `resumoDeProdutos` de `./comercial/hooksFalsos`
- Produz: dois arquivos de teste que os passos seguintes usam como rede

Os dois arquivos já existem, escritos contra a fonte de dados antiga, em
`main:src/pages/Produtos.kpis.test.tsx` e `main:src/pages/Produtos.tabela.test.tsx`.
O trabalho aqui é trazê-los e trocar a falsificação.

- [ ] **Passo 1: Ler os três testes dela, que já usam a fonte nova**

`src/pages/Produtos.periodo.test.tsx`, `Produtos.paginacao.test.tsx` e
`Produtos.multiselect.test.tsx`. O cabeçalho de `vi.mock` deles é o padrão a
copiar. Ler também `src/pages/comercial/hooksFalsos.ts` inteiro — o docblock
explica por que se moca o **hook** e não a rede.

- [ ] **Passo 2: Trazer os nossos dois arquivos**

```bash
git checkout main -- src/pages/Produtos.kpis.test.tsx src/pages/Produtos.tabela.test.tsx
```

- [ ] **Passo 3: Trocar a falsificação nos dois**

Sai o mock do `DataContext`:

```ts
vi.mock("../context/DataContext", () => ({
  useData: () => ({ notas: NOTAS, carregando: false }),
}));
```

Entra o padrão dela:

```ts
vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { criarHooksFalsos, resumoDeProdutos } = await import(
    "./comercial/hooksFalsos"
  );
  return { ...real, ...criarHooksFalsos(NOTAS, resumoDeProdutos) };
});
```

Os fixtures `NOTAS` precisam ficar dentro de `vi.hoisted`, como nos dela — a
fábrica do `vi.mock` roda antes dos imports do arquivo.

- [ ] **Passo 4: Rodar e ajustar as asserções que a fonte nova mudou**

```bash
npx vitest run src/pages/Produtos.kpis.test.tsx src/pages/Produtos.tabela.test.tsx
```

Uma diferença **conhecida e legítima**: a agregação dela inclui item **sem
código** (a versão antiga descartava com `if (!item.codigo) return`). Se um
fixture tiver item sem código, a contagem muda. Ajustar a asserção ao
comportamento novo, com comentário dizendo que a mudança é dela e é proposital.

Qualquer outra divergência **não é para ajustar calado**: registrar no relatório.

- [ ] **Passo 5: Plantar, ver falhar, reverter — um por arquivo**

Sem esta prova a task não está entregue. Em `src/pages/Produtos.tsx`:

- para o `kpis.test`: trocar `valorMedio: p.quantidade > 0 ? p.valor / p.quantidade : 0`
  por `valorMedio: 0`. Rodar. **Tem de falhar.** Reverter com
  `git checkout -- src/pages/Produtos.tsx`.
- para o `tabela.test`: inverter a direção da ordenação inicial
  (`direcao: "desc"` → `"asc"`). Rodar. **Tem de falhar.** Reverter igual.

Se um deles passar com a quebra plantada, o teste não enxerga o que diz
enxergar — **conserte o teste**, não a plantação, e plante de novo.

- [ ] **Passo 6: Confirmar que a árvore está limpa fora dos dois testes**

```bash
git status --porcelain
```

Só os dois arquivos novos. Se `Produtos.tsx` aparecer, a reversão da plantação
falhou.

- [ ] **Passo 7: Commit**

```bash
git add src/pages/Produtos.kpis.test.tsx src/pages/Produtos.tabela.test.tsx
git commit -m "test(produtos): caracterizacao dos kpis e da tabela sobre a fonte agregada"
```

---

### Task 2: Mover — a decomposição em cima da fonte nova

**Arquivos:**

- Criar: `src/pages/produtos/` (cinco componentes + `produtos.ts` + `produtos.test.ts`)
- Modificar: `src/pages/Produtos.tsx` (920 linhas → casca de ~200)

**Interfaces:**

- Consome: `useFiltrosComerciais`, `useResumoComercial`, `RecorteComercial` de
  `./comercial/useComercial`; `useIsMobile` de `../hooks/useIsMobile`
- Produz: `src/pages/produtos/produtos.ts` com as funções listadas no Passo 3

> **De onde vem a decomposição — leia isto antes de digitar `git checkout`.**
> A pasta `src/pages/produtos/` existe na branch `main` em duas versões: a final,
> que **já tem quatro consertos embutidos**, e a de `79954c07`, imediatamente
> anterior a eles. **Use a de `79954c07`.** Trazer a final faria este commit
> mover e consertar ao mesmo tempo, e aí um teste vermelho não diria qual dos
> dois quebrou. Os consertos voltam na Task 3, um commit cada.

- [ ] **Passo 1: Trazer a decomposição no estado anterior aos consertos**

```bash
git checkout 79954c07 -- src/pages/produtos/
```

Traz os cinco componentes, o `produtos.ts` e o `produtos.test.ts`. Os cinco
componentes **não precisam de mudança**: recebem tudo por prop e não sabem de
onde o dado veio. Confirme lendo-os antes de assumir.

- [ ] **Passo 2: Podar de `produtos.ts` o que o banco passou a fazer**

Estas morrem, porque o Postgres passou a fazer a conta:

| Função                  | Quem faz agora                      |
| ----------------------- | ----------------------------------- |
| `opcoesDeFiltro(notas)` | `useFiltrosComerciais().opcoes`     |
| `filtrarNotas(...)`     | o `recorte` que vai para o servidor |
| `agregarProdutos(...)`  | `resumo.por_produto`                |

A interface `Nota` morre junto se ninguém mais a usar — confira com `grep` antes
de apagar.

`evolucaoPorMes` **não morre inteira**. Ela tem duas metades: a que percorre as
notas somando por mês morre; a que agrupa por ano acima de 24 meses
(`if (dadosMensais.length > 24)`) **fica**, porque o banco devolve mês a mês e o
agrupamento anual continua sendo decisão da tela.

- [ ] **Passo 3: Mover para `produtos.ts` as contas puras que nasceram na versão dela**

Ela escreveu estas contas soltas dentro do componente. Pela receita da Fase 3
elas são conta pura e moram no `.ts`. Ler `src/pages/Produtos.tsx` linhas
124-200 **na versão atual desta branch** e mover de lá — movendo, não
reescrevendo:

- `rotuloDoCliente(c)` e `rotuloDoProduto(p)` — os rótulos que o `MultiSelect`
  mostra e devolve.
- `indicesDeRotulo(opcoes)` — os dois `Map` (`idPorRotulo`, `chavePorRotulo`)
  que traduzem o rótulo escolhido de volta para o id/chave que o servidor quer.
- `recorteDeProdutos(filtros, indices)` — monta o `RecorteComercial`.
- `produtosDoResumo(porProduto)` — converte `resumo.por_produto` em
  `ProdutoAgregado[]`.
- `evolucaoDoResumo(evolucaoMensal)` — converte `resumo.evolucao_mensal` em
  `PontoDeEvolucao[]` **e aplica o agrupamento anual** que sobreviveu do Passo 2.

Sobrevivem sem uma edição: `calcularKpis`, `rankingPorValor`, `ordenarEBuscar`,
e os tipos `ProdutoAgregado`, `KpisDeProduto`, `PontoDeEvolucao`,
`OrdenacaoDeProdutos`.

- [ ] **Passo 4: Reescrever `Produtos.tsx` como casca**

A casca de referência é `79954c07:src/pages/Produtos.tsx` (198 linhas). A
diferença: onde ela lia `useData()` e chamava `opcoesDeFiltro`/`filtrarNotas`/
`agregarProdutos`, agora chama os hooks do Comercial e as funções do Passo 3.

Preservar, da versão atual desta branch, **sem reescrever**:

- os comentários que explicam por que a tabela pagina no navegador e por que a
  agregação passou a incluir item sem código;
- `const isMobile = useIsMobile()` e todos os consumos dele;
- o `carregando`, que agora vem de `useResumoComercial`.

Manter os `useMemo` na casca em volta das funções puras. O motivo está no
docblock de `src/hooks/usePaginacao.ts`: a lista precisa manter identidade entre
renders com os mesmos parâmetros, senão a paginação estoura em
"Too many re-renders".

- [ ] **Passo 5: Ajustar `produtos.test.ts` ao que sobrou**

Apagar os testes das funções que morreram; manter os das que sobreviveram;
escrever teste para as cinco que nasceram no Passo 3. **Cada função nova precisa
de um teste que falhe se ela for quebrada — plante e veja falhar.**

- [ ] **Passo 6: O portão desta task**

```bash
npx vitest run src/pages/Produtos.kpis.test.tsx src/pages/Produtos.tabela.test.tsx \
  src/pages/Produtos.periodo.test.tsx src/pages/Produtos.paginacao.test.tsx \
  src/pages/Produtos.multiselect.test.tsx src/pages/produtos/produtos.test.ts
```

**Os cinco arquivos de teste de tela têm de passar sem uma única edição.** Três
são da outra frente e dois são a rede que a Task 1 acabou de construir. Se algum
precisar de mudança para passar, a decomposição mudou comportamento — **pare e
reporte BLOCKED** em vez de editar o teste.

Em particular: os testes clicam no `<th>` para ordenar, porque é onde o
`onClick` mora nesta versão. Isso é o certo aqui e muda na Task 3.

- [ ] **Passo 7: `tsc` e a suíte inteira**

```bash
npx tsc --noEmit
TZ=UTC npm test 2>&1 | tail -4
TZ=America/Sao_Paulo npm test 2>&1 | tail -4
```

- [ ] **Passo 8: Commit**

```bash
git add src/pages/Produtos.tsx src/pages/produtos/
git commit -m "refactor(produtos): a tela vira casca sobre pages/produtos, lendo o resumo agregado"
```

---

### Task 3: Tapar os cinco buracos que a revisão achou na rede

**Arquivos:**

- Modificar: `src/pages/Produtos.tabela.test.tsx`, `src/pages/Produtos.kpis.test.tsx`
- Criar ou modificar: `src/pages/produtos/produtos.test.ts`

A revisão da Task 2 plantou 21 quebras. Reproduziu as dez que o implementador
declarou — todas falham como ele disse — e achou **cinco que passam verdes com o
código quebrado**. Esta task fecha esses cinco, e ela vem **antes** dos
consertos de propósito: a Task 4 mexe em `ordenarEBuscar` e na tabela, e mudar
comportamento com a rede furada nesses pontos é trabalhar às cegas.

Nenhum passo aqui muda código de produção. Se algum teste novo ficar vermelho,
você achou um defeito — **registre e pare**, não conserte.

- [ ] **Passo 1: Ninguém observa o recorte que sai para o servidor**

O buraco mais grave. `recorteDeProdutos` monta o que vira query no Postgres, e
plantar `vendedor: []`, `produto: []` ou `dataFim: ""` deixa os 45 testes verdes.
`Produtos.periodo.test.tsx` só afirma sobre o valor dentro do `<input>`, nunca
sobre o recorte que sai.

Cenário concreto que hoje passa despercebido: a pessoa escolhe "Ano atual", o
campo mostra 31/12/2026, mas a query sai sem `data_fim` — o Postgres devolve
tudo até o fim do histórico e os KPIs vêm inflados, com a suíte verde.

Cobrir em `produtos.test.ts`, com plantação para cada um dos cinco campos
(`clientes`, `vendedores`, `produtos`, `dataInicio`, `dataFim`).

- [ ] **Passo 2: `rankingPorValor` não tem teste nenhum**

Inverter o `sort` para ascendente deixa 45 verdes. Cenário: o gráfico rotulado
"Top 10 Produtos (Valor)" passa a desenhar os dez produtos **mais baratos**, com
o título intacto — a primeira barra vira o item de R$ 12,00 no lugar do de
R$ 480.000,00. Trocar `.slice(0, limite)` por `.slice(0, 1)` também passa verde.

Cobrir a ordem **e** o limite, cada um com plantação.

- [ ] **Passo 3: `ordenarEBuscar` só tem o ramo `quantidadeVendida` coberto**

Trocar o `case "valorTotal"` para ler `valorMedio` deixa 45 verdes. Cenário:
clicar em "Valor Total" ordena pelo preço unitário médio e sobe ao topo um item
de baixo giro.

Cobrir **cada `case` do `switch`**, um teste por campo, cada um com plantação.
Isto é pré-requisito da Task 4, que acrescenta o `case "codigo"`.

- [ ] **Passo 4: Os dois gráficos não são observados**

Plantar `dadosEvolucao → []` deixa 45 verdes. Cobrir que a evolução e o ranking
chegam ao componente de gráfico com o que se espera.

- [ ] **Passo 5: Seis comentários de teste apontam para código que não existe mais**

`Produtos.tabela.test.tsx` linhas 202, 278, 291, 310, 330 e
`Produtos.kpis.test.tsx` linha 7 citam `Produtos.tsx:551-625`, `740-833`,
`288-307`, `721-730`, `60-70` — o arquivo tem 247 linhas. O de `:310` cita
`filtrarNotas`, que foi apagada.

Cenário: quem for acrescentar o `case "codigo"` na Task 4 segue a citação de
`:291` até `Produtos.tsx:288` e cai fora do arquivo — o `switch` mora agora em
`produtos.ts`. Corrigir as seis citações para onde o código realmente está.

- [ ] **Passo 6: Provar que a rede fechou**

Replantar as **cinco** quebras que passavam verdes e ver cada uma falhar agora:
`vendedor: []` · `dataFim: ""` · `sort` invertido em `rankingPorValor` ·
`case "valorTotal"` lendo `valorMedio` · `dadosEvolucao → []`.

Se alguma ainda passar, o teste que você escreveu não enxerga o que diz.

- [ ] **Passo 7: Suíte e commit**

```bash
npx tsc --noEmit
TZ=UTC npm test 2>&1 | tail -4
TZ=America/Sao_Paulo npm test 2>&1 | tail -4
git add -A && git commit -m "test(produtos): a rede passa a ver o recorte, o ranking e a ordenacao"
```

---

### Task 4: Os cinco consertos, um commit cada

**Arquivos:**

- Modificar: `src/pages/produtos/TabelaDeProdutos.tsx`,
  `src/pages/produtos/GraficosDeProdutos.tsx`
- Modificar: `src/pages/Produtos.tabela.test.tsx` (as asserções de defeito preservado)

A migração original consertou quatro defeitos **depois** de mover, cada um em
commit próprio. Estamos refazendo isso. Os originais estão em
`92768748`, `4f5662fc`, `b8aa8f3b` e `7e32a2cf` — leia cada um com
`git show <hash>` antes de reimplementar, e reimplemente, não faça
`cherry-pick`: o arquivo em volta mudou.

Dois destes defeitos foram redescobertos e caracterizados como "defeito
preservado" pela Task 1 — as asserções que os fixam estão em
`Produtos.tabela.test.tsx`, e **é nesta task que elas viram asserções do
conserto**. Isso é legítimo aqui e só aqui.

**Para cada um dos quatro, nesta ordem:**

- [ ] **3.1 — A coluna "Código" não reordena** (original: `92768748`)

Falta o `case "codigo"` no `switch` de `ordenarEBuscar`. Corrigir, virar a
asserção de defeito preservado, plantar (tirar o `case` de novo), ver falhar,
reverter a plantação. Commit: `fix(produtos): coluna codigo agora reordena`

- [ ] **3.2 — O cabeçalho ordenável não alcança o teclado** (original: `4f5662fc`)

O `onClick` sai do `<TableHeaderCell>` e vai para um `<button type="button">`
por dentro, com `aria-label={`Ordenar por ${rotulo}`}` e `focus-visible:ring-2`
(nunca `focus:`). É o padrão de `TabelaDeContas.tsx:257-260` — leia lá.

**Este conserto muda a mecânica dos testes:** os cliques passam de
`<th>` para `getByRole("button", { name: "Ordenar por ..." })`. Ajustar os
testes é parte do conserto. O que eles **afirmam** não muda.

Plantar: devolver o `onClick` ao `<th>`. Ver falhar. Reverter.
Commit: `fix(produtos): cabecalho ordenavel ganha foco de teclado`

- [ ] **3.3 — "Exportar Excel" não desabilita com tabela vazia** (original: `b8aa8f3b`)

Corrigir, virar a asserção de defeito preservado, plantar, ver falhar, reverter.
Commit: `fix(produtos): exportar desabilita com tabela vazia`

- [ ] **3.4 — O eixo Y do ranking está em 11px** (original: `7e32a2cf`)

Sobe para 12px — item 5 do checklist de tela migrada (tamanho mínimo de fonte).
Em `GraficosDeProdutos.tsx`. Commit:
`fix(produtos): eixo Y do ranking sobe de 11px para 12px`

- [ ] **3.5 — Dois produtos sem código colidem na mesma `key` do React**

Achado novo, levantado na Task 2. **Não é defeito da nossa decomposição:** a
versão dela no `origin/main` tem exatamente o mesmo `key={produto.codigo}`
(linha 844) e o mesmo `codigo: p.codigo ?? ""` (linha 185). O defeito ficou
_vivo_ quando a agregação dela passou a incluir item sem código — que a versão
anterior descartava, e que ela documentou como 36 itens, 0,12% do valor.

O que acontece: todo item sem código vira `codigo: ""`, e o React recebe duas
linhas com `key=""`. Ele avisa no console e passa a reconciliar as duas linhas
como se fossem a mesma — reordenar a tabela pode embaralhar o conteúdo delas.

A chave que os distingue já existe e está sendo jogada fora: `p.chave` no
`resumo.por_produto` (é `'#' + descricao` quando não há código). Levar `chave`
para dentro de `ProdutoAgregado` e usá-la como `key` da `TableRow` — **sem**
mostrá-la em coluna nenhuma, que é dado interno.

Plantar: dois produtos sem código no fixture, e afirmar que as duas linhas
existem com o conteúdo certo depois de reordenar. Ver falhar com a `key` antiga.
Commit: `fix(produtos): produto sem codigo ganha key propria na tabela`

- [ ] **Passo final: suíte nos dois fusos, `tsc`, lint**

```bash
npx tsc --noEmit
TZ=UTC npm test 2>&1 | tail -4
TZ=America/Sao_Paulo npm test 2>&1 | tail -4
npm run lint 2>&1 | grep problems
```

---

### Task 5: A planilha vira conta pura, e a tela sai de `PENDENTES_FASE_3`

**Arquivos:**

- Modificar: `src/pages/produtos/produtos.ts`, `src/pages/Produtos.tsx`
- Modificar: `src/test/guarda-cores.test.ts`

- [ ] **Passo 1: `linhasDaPlanilha` vira conta pura** (original: `12c7f6a2`)

Hoje a modelagem da linha do Excel está solta na casca. Ela é conta pura e vai
para `produtos.ts`. Recebe o resultado de `ordenarEBuscar` **inteiro**, não a
página exibida: a paginação é só da tabela na tela, e quem exporta espera o
recorte filtrado e ordenado completo. Teste próprio, com plantação.

Commit: `refactor(produtos): a modelagem da planilha vira conta pura`

- [ ] **Passo 2: Conferir que não sobrou paleta crua nem `dark:`**

```bash
grep -n "dark:\|text-gray-\|bg-gray-\|text-slate-\|bg-slate-\|text-blue-\|bg-blue-" \
  src/pages/Produtos.tsx src/pages/produtos/*.tsx
```

Os componentes de `79954c07` já adotaram os tokens, então isto deve vir vazio.
Se não vier, trocar por classe de token (`bg-surface`, `text-conteudo`,
`text-conteudo-muted`, `border-borda`, `text-action`), **sem modificador de
opacidade** — `bg-surface/40` não gera regra e há guarda para isso. Sem
hexadecimal cravado; cor de gráfico vai por prop, via `chartTheme.ts`.

- [ ] **Passo 3: Conferir que a saída de `PENDENTES_FASE_3` já aconteceu**

A Task 2 **já apagou** `"src/pages/Produtos.tsx"` da lista em
`src/test/guarda-cores.test.ts` — não por escolha, mas porque o guarda tem
armadilha reversa e falha quando um arquivo listado já está limpo. Aqui é só
conferir que a linha não voltou e que a lista só encolheu. **Não acrescente
linha nenhuma** para calar guarda.

- [ ] **Passo 4: Suíte e commit**

```bash
npx vitest run src/test/
TZ=UTC npm test 2>&1 | tail -4
git add -A && git commit -m "refactor(produtos): a tela sai de PENDENTES_FASE_3"
```

---

### Task 6: O prettier, em commit próprio

Misturado com mudança de conteúdo, o diff fica ilegível — por isso é commit só
dele.

- [ ] **Passo 1: Tirar do `.prettierignore`**

Apagar as linhas de `src/pages/Produtos.tsx` e `src/pages/produtos/`, se
existirem.

- [ ] **Passo 2: Formatar**

```bash
npx prettier --write src/pages/Produtos.tsx src/pages/produtos/ \
  src/pages/Produtos.kpis.test.tsx src/pages/Produtos.tabela.test.tsx
```

- [ ] **Passo 3: Provar que só mudou espaço em branco**

```bash
git diff --stat
git diff -w --stat
```

O segundo tem de vir **vazio**. Se não vier, o prettier mudou conteúdo — pare e
reporte.

- [ ] **Passo 4: Suíte, lint, commit**

```bash
TZ=UTC npm test 2>&1 | tail -4
TZ=America/Sao_Paulo npm test 2>&1 | tail -4
npx tsc --noEmit
npm run lint 2>&1 | grep problems
git add -A && git commit -m "style(produtos): prettier na tela e nos componentes"
```
