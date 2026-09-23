# Fase 3 — Produtos migra para o design system

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para implementar task a task. Os passos usam
> caixa (`- [ ]`) para acompanhamento.

**Objetivo:** `src/pages/Produtos.tsx` sai de 975 linhas para uma casca de ~70,
com a conta pura em `pages/produtos/produtos.ts` e cinco componentes por
responsabilidade. Os 87 `dark:`, os 126 usos de paleta crua e os 21 hexadecimais
somem, e a tela sai do `PENDENTES_FASE_3`.

**Arquitetura:** espelha `pages/contas/` e `pages/dashboard/`, que são o padrão
provado em seis telas. Os hexadecimais morrem via `src/design-system/chartTheme.ts`,
que já existe e já é consumido pelo `GraficosDeContas.tsx`.

**Stack:** React 18, TypeScript, Vitest + Testing Library (jsdom), Tailwind
3.4.17, recharts.

**Governa:** `docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md`
— a receita de 7 passos está no `CLAUDE.md`; o checklist de 10 itens está na
seção "Checklist de tela migrada" do spec.

## Restrições globais

- Código, comentários, interface e mensagem de commit em **português do Brasil**.
  Conventional commits e **sem acento** na mensagem. Comentários no código
  **podem e devem** ter acento.
- **Não existe alias `@/` neste repositório.** Importar por caminho relativo.
- Baseline de entrada: **1500 testes / 109 arquivos**, zero pulados; lint em
  **101 problemas**; `tsc --noEmit` limpo. A suíte tem de passar em `TZ=UTC` **e**
  em `TZ=America/Sao_Paulo`.
- **O lint tem de CAIR, e dá para prever quanto.** `Produtos.tsx` responde hoje
  por **oito avisos de variável ou import não usados** — `PieChart`, `Pie`,
  `Cell`, `Legend` e `Calendar` (imports que sobraram), `Nota` (tipo),
  `CORES_GRAFICO` (array morto) e `notasIds` (dentro do agregador). A migração
  apaga todos: **101 → 93 ou menos**. Sobram na tela dois `Unexpected any`
  (linha 341) e um erro `set-state-in-effect` (linha 117), que é o item 10 da
  lista de "Em aberto" e **não** é escopo desta migração.
- Interface em português, **sentence case, sem emoji**; frase de erro completa
  com ponto final.
- `focus-visible` com anel de 2px, **nunca** `focus`.
- Comentário no código explica **por quê**, com o defeito concreto que a decisão
  evitou.
- **Falha de rede é `Alert variant="danger"` no fluxo da página, não Toast.**
- Não fazer `push` nem merge. O checkpoint é humano.

## Estrutura de arquivos

| Arquivo                                     | Responsabilidade                                           |
| ------------------------------------------- | ---------------------------------------------------------- |
| `src/pages/produtos/produtos.ts`            | **Criar.** A conta pura, sem React.                        |
| `src/pages/produtos/produtos.test.ts`       | **Criar.** Teste da conta pura.                            |
| `src/pages/produtos/CabecalhoProdutos.tsx`  | **Criar.** Título e subtítulo.                             |
| `src/pages/produtos/FiltrosDeProdutos.tsx`  | **Criar.** Os seis filtros.                                |
| `src/pages/produtos/KpisDeProdutos.tsx`     | **Criar.** Os quatro cartões.                              |
| `src/pages/produtos/GraficosDeProdutos.tsx` | **Criar.** Os dois gráficos.                               |
| `src/pages/produtos/TabelaDeProdutos.tsx`   | **Criar.** Busca, exportação, tabela, paginação.           |
| `src/pages/Produtos.kpis.test.tsx`          | **Criar.** Caracterização dos KPIs.                        |
| `src/pages/Produtos.tabela.test.tsx`        | **Criar.** Caracterização da tabela.                       |
| `src/pages/Produtos.tsx`                    | **Modificar.** Vira casca.                                 |
| `src/test/guarda-cores.test.ts`             | **Modificar.** Tirar `Produtos.tsx` do `PENDENTES_FASE_3`. |
| `.prettierignore`                           | **Modificar.** Abrir exceção para a tela.                  |

## O mapa da tela de hoje

Os comentários da própria tela já marcam as fronteiras. Use-os:

| Linhas  | Bloco                                | Vai para                            |
| ------- | ------------------------------------ | ----------------------------------- |
| 122-151 | listas únicas para os filtros        | fica na casca (alimenta os filtros) |
| 153-179 | `notasFiltradas`                     | `produtos.ts`                       |
| 180-228 | `produtosAgregados`                  | `produtos.ts`                       |
| 229-257 | `kpis`                               | `produtos.ts`                       |
| 258-313 | `dadosEvolucao`                      | `produtos.ts`                       |
| 314-324 | `rankingProdutosValor`               | `produtos.ts`                       |
| 325-373 | `produtosTabela` (busca + ordenação) | `produtos.ts`                       |
| 434-449 | cabeçalho                            | `CabecalhoProdutos.tsx`             |
| 450-550 | filtros                              | `FiltrosDeProdutos.tsx`             |
| 551-625 | KPIs (4 cartões)                     | `KpisDeProdutos.tsx`                |
| 626-750 | gráficos (2)                         | `GraficosDeProdutos.tsx`            |
| 751-975 | tabela                               | `TabelaDeProdutos.tsx`              |

## Ordem, e por que ela é essa

A receita do repo é dura no ponto 1: **teste de caracterização antes de mover uma
linha**, observando a tela renderizada — nunca exportando função só para testar.
`Produtos` tem três arquivos de teste (`multiselect`, `paginacao`, `periodo`),
mas **nenhum cobre KPIs, gráficos ou o corpo da tabela**. As Tasks 1 e 2 escrevem
essa rede.

Depois disso: a conta pura sai primeiro (Task 3), porque é o que os componentes
vão consumir; os componentes saem um a um (Tasks 4 a 8); a casca fecha (Task 9);
e só então a limpeza de tokens (Task 10), que é o que permite sair do
`PENDENTES_FASE_3`.

**Extrair e limpar são passos separados**, pela mesma razão que valeu nos itens 5
e 6 da Fase 4: se um teste de caracterização ficar vermelho, tem de dar para
saber se foi a extração ou a troca de classe.

## Mudança de rumo, decidida em 09/09 durante a execução

**Separados sim, mas na mesma task.** A ordem original mandava extrair os cinco
componentes e só limpar as classes no fim, na Task 10. Isso esbarrou numa regra
dura do repositório: o `guarda-cores` não aceita arquivo novo com paleta crua, e
cada componente extraído nascia sujo — obrigando a **acrescentar** linha ao
`PENDENTES_FASE_3`, cuja regra é que ele _só encolhe_.

Com a ordem original a lista chegaria a **onze** entradas antes de voltar a
cinco. Agora cada task que extrai um componente **também o limpa, em commit
próprio, antes de fechar**. A lista nunca passa de +1, e mover e limpar
continuam em commits separados — que é a garantia que importa.

As Tasks 4 e 5 já tinham rodado quando isso foi decidido, então a **Task 6 abre
com a limpeza retroativa** do `CabecalhoProdutos` e do `FiltrosDeProdutos`.

**Consequência para a Task 10:** ela deixa de ser "limpar tudo" e passa a ser
"limpar o que sobrou na casca e fechar a lista".

---

### Task 1: Caracterização dos KPIs

**Arquivos:**

- Criar/Test: `src/pages/Produtos.kpis.test.tsx`

**Interfaces:**

- Consome: nada.
- Produz: os dublês e o molde que a Task 2 reaproveita.

- [ ] **Passo 1: montar o arquivo a partir do molde que já funciona**

`src/pages/Produtos.multiselect.test.tsx` já monta a tela com sucesso. **Copie os
mocks dele** (`useAuth`, `DataContext`, `recharts`) em vez de inventar — eles já
resolvem a montagem.

Os quatro KPIs estão em `Produtos.tsx:551-625`: total de produtos vendidos,
faturamento total, ticket médio por produto, e produto mais vendido.

Escreva testes que afirmem os quatro **a partir de notas conhecidas**, montadas
no próprio arquivo. Duas notas com itens de códigos diferentes bastam para que
cada número seja distinguível: se todos os KPIs saíssem do mesmo valor, o teste
não distinguiria uma troca entre eles.

**Regra da receita, e ela vale aqui:** observe a **tela renderizada**
(`screen.getByText`), não a função. Nada de exportar `kpis` só para testar.

- [ ] **Passo 2: rodar e ver passar**

Roda: `npx vitest run src/pages/Produtos.kpis.test.tsx`
Esperado: **PASS**. É caracterização — o comportamento já existe.

- [ ] **Passo 3: provar que os testes enxergam (plantação)**

Em `Produtos.tsx`, dentro do `useMemo` dos KPIs (linha ~229), troque o
`totalProdutosVendidos` para devolver `0` fixo.

Roda: `npx vitest run src/pages/Produtos.kpis.test.tsx`
Esperado: **FAIL** no teste do total, e **só nele** — se os quatro falharem
juntos, os testes não estão distinguindo os KPIs entre si, e é isso que o passo 1
pedia para evitar.

Reverta: `git checkout src/pages/Produtos.tsx`

**Sem esta prova a task não está entregue.** Cole a saída no relatório.

- [ ] **Passo 4: `tsc`, lint e commit**

```bash
npx tsc --noEmit
npm run lint 2>&1 | grep problems   # 101 ou menos
git add src/pages/Produtos.kpis.test.tsx
git commit -m "test(produtos): caracteriza os quatro KPIs antes de migrar"
```

---

### Task 2: Caracterização da tabela

**Arquivos:**

- Criar/Test: `src/pages/Produtos.tabela.test.tsx`

**Interfaces:**

- Consome: o molde de mocks da Task 1.
- Produz: nada que outra task importe.

- [ ] **Passo 1: escrever os testes**

A tabela está em `Produtos.tsx:751-975`. Ela tem seis colunas (código, produto,
quantidade, valor total, valor médio, número de vendas), campo de pesquisa,
ordenação por coluna e paginação.

A paginação **já tem cobertura** em `Produtos.paginacao.test.tsx` — não repita.
Cubra o que não tem:

1. **As seis colunas mostram o valor certo** para um produto conhecido.
2. **A pesquisa filtra** — digitar parte da descrição reduz as linhas.
3. **A ordenação inverte** — clicar no cabeçalho de quantidade ordena; clicar de
   novo inverte.
4. **O estado vazio aparece com frase completa** — é item do checklist de 10.
   **Provoque a lista vazia por um caminho que NÃO seja a pesquisa**: o filtro de
   data serve (os dois `input[type="date"]` já estão renderizados; basta um
   intervalo fora do range das notas). Se você usar a busca, este teste fica
   acoplado ao de pesquisa e uma plantação no filtro derruba os dois — e o passo
   3 exige isolamento.

- [ ] **Passo 2: rodar e ver passar**

Roda: `npx vitest run src/pages/Produtos.tabela.test.tsx`
Esperado: **PASS**.

- [ ] **Passo 3: plantação, uma por comportamento**

Prove cada um separadamente, revertendo entre eles:

- **Colunas:** troque o `valorMedio` da tabela por `0` fixo → só o teste de
  colunas falha.
- **Pesquisa:** faça o filtro de busca devolver a lista inteira → só o de
  pesquisa falha.
- **Ordenação:** faça `alternarOrdenacao` não fazer nada → só o de ordenação
  falha.

Se uma plantação derrubar mais de um teste, os testes estão acoplados demais —
ajuste antes de seguir. Cole as três saídas.

Reverta com `git checkout src/pages/Produtos.tsx` depois de cada uma.

- [ ] **Passo 4: `tsc`, lint e commit**

```bash
npx tsc --noEmit
npm run lint 2>&1 | grep problems
git add src/pages/Produtos.tabela.test.tsx
git commit -m "test(produtos): caracteriza colunas, busca e ordenacao da tabela"
```

---

### Task 3: A conta pura sai para `produtos.ts`

**Arquivos:**

- Criar: `src/pages/produtos/produtos.ts`
- Criar/Test: `src/pages/produtos/produtos.test.ts`
- Modificar: `src/pages/Produtos.tsx` (passa a importar)

**Interfaces:**

- Consome: nada.
- Produz — as Tasks 4 a 9 importam estas funções, com estes nomes:
  - `filtrarNotas(notas, filtros): Nota[]`
  - `agregarProdutos(notas, filtroProduto): ProdutoAgregado[]`
  - `calcularKpis(agregados): KpisDeProduto`
  - `evolucaoPorMes(notas, filtroProduto): PontoDeEvolucao[]`
  - `rankingPorValor(agregados, limite): ProdutoAgregado[]`
  - `ordenarEBuscar(agregados, pesquisa, ordenacao): ProdutoAgregado[]`

  Os tipos `ProdutoAgregado`, `KpisDeProduto` e `PontoDeEvolucao` são exportados
  do mesmo arquivo.

- [ ] **Passo 1: mover, sem reescrever**

Tire os seis `useMemo` de `Produtos.tsx` (linhas 153-373, conforme o mapa acima) e
transforme cada um numa função pura em `produtos.ts`. **Mover é mover:** a lógica
sai igual, só perde o `useMemo` em volta e ganha os parâmetros que antes vinham do
escopo.

Em `Produtos.tsx`, os `useMemo` passam a chamar as funções:

```tsx
const produtosAgregados = useMemo(
  () => agregarProdutos(notasFiltradas, filtroProduto),
  [notasFiltradas, filtroProduto],
);
```

**Mantenha os `useMemo` na tela** — eles não são detalhe de organização: o
`usePaginacao` volta para a página 1 quando a lista muda de identidade, e uma
lista remontada a cada render estoura em "Too many re-renders". O contrato está
documentado no docblock do `usePaginacao.ts`.

- [ ] **Passo 2: os testes de caracterização passam sem edição**

```bash
npx vitest run src/pages/Produtos.kpis.test.tsx \
               src/pages/Produtos.tabela.test.tsx \
               src/pages/Produtos.multiselect.test.tsx \
               src/pages/Produtos.paginacao.test.tsx \
               src/pages/Produtos.periodo.test.tsx
```

Esperado: **PASS em todos, sem uma edição.** É a prova de que a extração foi
inerte.

Se algum falhar, **não edite o teste** — a extração mudou comportamento. Se
concluir que o teste é que está errado, pare e reporte BLOCKED.

- [ ] **Passo 3: teste da conta pura**

Agora que as funções são puras, elas merecem teste direto — **além** da
caracterização, não no lugar dela. Escreva `produtos.test.ts` cobrindo as bordas
que a tela não exercita facilmente:

- `agregarProdutos` com item **sem código** (a tela pula: `if (!item.codigo) return`)
- `calcularKpis` com lista **vazia** (o `ticketMedio` divide por zero — hoje
  devolve `0` por causa da guarda `totalProdutosVendidos > 0`)
- `calcularKpis` com empate na quantidade (qual produto ganha o "mais vendido")
- `ordenarEBuscar` com pesquisa que não acha nada

- [ ] **Passo 4: rodar tudo e commitar**

```bash
npx vitest run src/pages/produtos/produtos.test.ts
npx tsc --noEmit
npm run lint 2>&1 | grep problems
git add src/pages/produtos/ src/pages/Produtos.tsx
git commit -m "refactor(produtos): a conta pura sai para pages/produtos/produtos.ts"
```

---

### Task 4: `CabecalhoProdutos`

**Arquivos:**

- Criar: `src/pages/produtos/CabecalhoProdutos.tsx`
- Modificar: `src/pages/Produtos.tsx:434-449`

**Interfaces:**

- Consome: nada de `produtos.ts`.
- Produz: `<CabecalhoProdutos />` — sem props, se o bloco não tiver estado; com as
  props que o bloco de fato usa, se tiver.

- [ ] **Passo 1: mover o bloco**

Leia `src/pages/contas/CabecalhoContas.tsx` e `src/pages/locacao/CabecalhoLocacao.tsx`
antes — o formato do cabeçalho já está estabelecido em duas telas.

Mova as linhas 434-449 **como estão**, incluindo `dark:` e paleta crua. A limpeza
é a Task 10.

- [ ] **Passo 2: os cinco arquivos de teste passam sem edição**

Mesmo comando do passo 2 da Task 3. Esperado: **PASS, sem edição.**

- [ ] **Passo 3: `tsc`, lint e commit**

```bash
npx tsc --noEmit
npm run lint 2>&1 | grep problems
git add src/pages/produtos/CabecalhoProdutos.tsx src/pages/Produtos.tsx
git commit -m "refactor(produtos): o cabecalho vira componente"
```

---

### Task 5: `FiltrosDeProdutos`

**Arquivos:**

- Criar: `src/pages/produtos/FiltrosDeProdutos.tsx`
- Modificar: `src/pages/Produtos.tsx:450-550`

**Interfaces:**

- Consome: `PRESETS_DE_PERIODO` de `src/lib/periodo.ts`, que a tela já usa.
- Produz: `<FiltrosDeProdutos />` com as props que o bloco precisa — as listas
  únicas (empresas, vendedores, produtos), os valores selecionados e os
  `onChange`. Leia `src/pages/contas/FiltrosDeContas.tsx` para o formato.

- [ ] **Passo 1: mover o bloco**

São seis filtros: empresas, vendedores, produtos (os três são `MultiSelect`),
preset de período, data início e data fim.

**Cuidado com um detalhe que já quebrou teste neste repo:** `Produtos` tem dois
campos com o placeholder "Pesquisar..." — o do dropdown do `MultiSelect` e o da
tabela. O `Produtos.multiselect.test.tsx` escopa a busca pelo container do filtro
por causa disso. Mover o bloco não pode mudar a árvore de forma que quebre esse
escopo.

- [ ] **Passo 2: os cinco arquivos de teste passam sem edição**

Esperado: **PASS, sem edição.** Este é o passo em que o detalhe acima aparece, se
tiver aparecido.

- [ ] **Passo 3: `tsc`, lint e commit**

```bash
git add src/pages/produtos/FiltrosDeProdutos.tsx src/pages/Produtos.tsx
git commit -m "refactor(produtos): os filtros viram componente"
```

---

### Task 6: `KpisDeProdutos`

**Arquivos:**

- Criar: `src/pages/produtos/KpisDeProdutos.tsx`
- Modificar: `src/pages/Produtos.tsx:551-625`

**Interfaces:**

- Consome: o tipo `KpisDeProduto` de `produtos.ts`.
- Produz: `<KpisDeProdutos kpis={kpis} />`.

- [ ] **Passo 1: mover os quatro cartões**

Leia `src/pages/contas/KpisDeContas.tsx` antes — o formato de cartão de KPI já
está estabelecido.

- [ ] **Passo 2: `Produtos.kpis.test.tsx` passa sem edição**

Esperado: **PASS, sem edição** — este é o teste que a Task 1 escreveu exatamente
para este momento.

- [ ] **Passo 3: `tsc`, lint e commit**

```bash
git add src/pages/produtos/KpisDeProdutos.tsx src/pages/Produtos.tsx
git commit -m "refactor(produtos): os KPIs viram componente"
```

---

### Task 7: `GraficosDeProdutos`, e os 21 hexadecimais morrem

**Esta é a task com mais risco do plano**, porque troca mecanismo de cor além de
mover código.

**Arquivos:**

- Criar: `src/pages/produtos/GraficosDeProdutos.tsx`
- Modificar: `src/pages/Produtos.tsx:626-750`, `:69-78` (`CORES`) e `:80-89` (`CORES_GRAFICO`, morto)

**Interfaces:**

- Consome: `chartTheme` e `corDaSerie` de `src/design-system/chartTheme`; os tipos
  `PontoDeEvolucao` e `ProdutoAgregado` de `produtos.ts`.
- Produz: `<GraficosDeProdutos evolucao={...} ranking={...} />`.

- [ ] **Passo 1: mover os dois gráficos, ainda com os hexadecimais**

Mova as linhas 626-750 como estão. **Não troque cor ainda** — mover e trocar
mecanismo no mesmo commit torna impossível saber qual dos dois quebrou.

- [ ] **Passo 2: os testes passam sem edição**

Esperado: **PASS, sem edição.**

- [ ] **Passo 3: commitar a mudança inerte**

```bash
git add src/pages/produtos/GraficosDeProdutos.tsx src/pages/Produtos.tsx
git commit -m "refactor(produtos): os graficos viram componente"
```

- [ ] **Passo 4: agora sim, trocar os hexadecimais por `chartTheme`**

**Leia `src/pages/contas/GraficosDeContas.tsx` primeiro** — ele já faz exatamente
isto, e o docblock do `chartTheme.ts` explica por quê: _"o recharts recebe cor por
prop, não por classe, e prop não enxerga classe do Tailwind"_.

Os 21 hexadecimais estão em três lugares, e **um deles é código morto**:

- **`CORES` (linhas 69-78)** — objeto com oito cores nomeadas (`azul`, `verde`,
  `roxo`, `laranja`, `vermelho`, `amarelo`, `rosa`, `cyan`). Dessas oito, **só
  `CORES.laranja` é consumida**, uma vez, no `<Bar>` da linha 745. Vira
  `corDaSerie(SERIE_ACAO)`.
- **`CORES_GRAFICO` (linhas 80-89)** — array que referencia as oito cores do
  objeto acima e **nunca é usado**. O lint já acusa:
  `80:7 warning 'CORES_GRAFICO' is assigned a value but never used`. **Apague**;
  não converta.
- **os tooltips customizados** dos dois gráficos → `chartTheme.tooltip`, e as
  cores de eixo e grade → `chartTheme.axis` e `chartTheme.grid`.

Com o `CORES_GRAFICO` apagado e o `CORES` inteiro substituído, as duas constantes
somem do arquivo.

Siga o padrão de `GraficosDeContas.tsx`, que dá nome aos índices da rampa:

```tsx
/** Índices da rampa de séries do `chartTheme`, com nome em vez de número. */
const SERIE_ACAO = 0;
```

- [ ] **Passo 5: conferir que sumiram**

Roda: `grep -c '#[0-9a-fA-F]\{3,8\}' src/pages/produtos/GraficosDeProdutos.tsx src/pages/Produtos.tsx`
Esperado: **0 nos dois**.

Roda os testes de novo — esperado **PASS, sem edição**. O `chartTheme` tem
reserva justamente para a jsdom, onde os tokens não carregam.

- [ ] **Passo 6: commitar a troca de cor, em separado**

```bash
git add src/pages/produtos/GraficosDeProdutos.tsx src/pages/Produtos.tsx
git commit -m "fix(produtos): as cores do grafico saem do chartTheme, nao de hex"
```

---

### Task 8: `TabelaDeProdutos`

**Arquivos:**

- Criar: `src/pages/produtos/TabelaDeProdutos.tsx`
- Modificar: `src/pages/Produtos.tsx:751-975`

**Interfaces:**

- Consome: `Pagination`, `TableEmpty` do design system (a tela já os importa);
  `ProdutoAgregado` de `produtos.ts`; `baixarPlanilha` de `src/lib/planilha.ts`,
  que a tela já usa para exportar.
- Produz: `<TabelaDeProdutos produtos={...} pesquisa={...} ordenacao={...} ... />`.

- [ ] **Passo 1: mover o bloco**

Leia `src/pages/contas/TabelaDeContas.tsx` antes.

É o maior bloco (225 linhas) e inclui o campo de pesquisa, o botão de exportação,
a tabela de seis colunas e o rodapé de paginação.

- [ ] **Passo 2: os testes passam sem edição**

Esperado: **PASS, sem edição** — inclusive `Produtos.tabela.test.tsx` e
`Produtos.paginacao.test.tsx`.

- [ ] **Passo 3: `tsc`, lint e commit**

```bash
git add src/pages/produtos/TabelaDeProdutos.tsx src/pages/Produtos.tsx
git commit -m "refactor(produtos): a tabela vira componente"
```

---

### Task 9: A casca

**Arquivos:**

- Modificar: `src/pages/Produtos.tsx`

- [ ] **Passo 1: medir o que sobrou**

Roda: `wc -l src/pages/Produtos.tsx`

O alvo da receita é **~70 linhas**. Se estiver muito acima, sobrou lógica que
devia ter ido para `produtos.ts` ou marcação que devia ter ido para um
componente. **Diga no relatório quantas linhas ficaram e o que são**, em vez de
forçar o número.

- [ ] **Passo 2: limpar o que ficou órfão**

Imports que já não são usados, tipos que migraram para `produtos.ts`, comentários
que descrevem código que saiu. **Confira no lint**, que acusa variável e import
não usados.

- [ ] **Passo 3: a suíte inteira, nos dois fusos**

```bash
TZ=UTC npm test 2>&1 | tail -4
TZ=America/Sao_Paulo npm test 2>&1 | tail -4
npx tsc --noEmit
npm run lint 2>&1 | grep problems
```

Esperado: verde nos dois, zero pulados, `tsc` limpo, lint em **101 ou menos** —
o número só cai de verdade na Task 10, que apaga os imports órfãos.

- [ ] **Passo 4: commitar**

```bash
git add src/pages/Produtos.tsx
git commit -m "refactor(produtos): a tela vira casca"
```

---

### Task 10: Fechar a lista

**Encolheu pela mudança de rumo de 09/09.** As Tasks 6 a 9 já limparam cada
componente logo depois de extraí-lo, e a Task 6 fez a limpeza retroativa do
cabeçalho e dos filtros. O que sobra aqui é a **casca** (`Produtos.tsx`) e o
fechamento da lista.

**O critério mudou junto:** o `PENDENTES_FASE_3` tem de voltar a **cinco**
entradas — `Clientes`, `Estoque`, `Servicos`, `Vendas` e `Vendedores`. Nenhum
arquivo de `src/pages/produtos/` pode sobrar nela, e `src/pages/Produtos.tsx`
também sai.

**Arquivos:**

- Modificar: os cinco componentes em `src/pages/produtos/` e `src/pages/Produtos.tsx`
- Modificar: `src/test/guarda-cores.test.ts` (a lista `PENDENTES_FASE_3`)

- [ ] **Passo 1: entender o que substituir**

Leia a seção "Design system — as regras que os testes cobram" do `CLAUDE.md` e
um componente já migrado (`src/pages/contas/TabelaDeContas.tsx`) para ver os
tokens em uso: `bg-surface`, `text-conteudo`, `text-conteudo-muted`,
`text-action`, `bg-tint-*`, `border-borda`.

**A regra que mais morde:** classe de token **não** aceita modificador de
opacidade (`bg-surface/40`). O Tailwind não aplica alfa sobre `var()` com
hexadecimal, e a regra simplesmente não é gerada — o elemento cai na regra do
outro tema. Há guarda para isso.

- [ ] **Passo 2: substituir, arquivo a arquivo**

Para cada um dos seis arquivos: troque paleta crua por token, e **apague o
`dark:`** onde o token já responde ao tema. Um token que sai de `var(--...)` já
muda com o tema — o `dark:` vira ruído e, pior, pode brigar com o token.

Rode os testes depois de **cada arquivo**, não no fim. Se um quebrar, você sabe
qual foi.

- [ ] **Passo 3: conferir que zeraram**

```bash
grep -c "dark:" src/pages/Produtos.tsx src/pages/produtos/*.tsx
grep -cE '\b(text|bg|border|ring|from|to|via|divide|placeholder)-(gray|red|green|yellow|indigo|purple|pink|orange|teal|cyan|emerald|amber|rose|lime|violet|fuchsia|sky|stone|neutral|zinc)-[0-9]{2,3}' src/pages/Produtos.tsx src/pages/produtos/*.tsx
```

Esperado: **0 em todos**.

- [ ] **Passo 4: tirar do `PENDENTES_FASE_3`**

Em `src/test/guarda-cores.test.ts`, apague a linha `"src/pages/Produtos.tsx"` da
lista.

**O guarda tem duas travas, e a segunda é a que importa aqui:** um arquivo **na**
lista que já esteja limpo **também** faz o guarda falhar, para a lista não
apodrecer com isenção vitalícia. Ou seja, se você limpou e não apagou a linha, o
guarda acusa.

**Nunca acrescente linha a essa lista.** Ela só encolhe.

- [ ] **Passo 5: a suíte inteira, nos dois fusos**

Esperado: verde, zero pulados. O `guarda-cores` tem de passar **sem** a linha do
`Produtos`.

- [ ] **Passo 6: commitar**

```bash
git add src/pages/produtos/ src/pages/Produtos.tsx src/test/guarda-cores.test.ts
git commit -m "feat(produtos): a tela adota os tokens e sai do PENDENTES_FASE_3"
```

---

### Task 11: O checklist de 10 itens, respondido um a um

A receita exige responder o checklist **item a item**, não em bloco. Cada resposta
é "sim, e aqui está onde" ou "não, e este é o motivo".

**Arquivos:**

- Modificar: os arquivos que o checklist apontar.

- [ ] **Passo 1: responder, com evidência**

| #   | Item                                           | Como verificar                                           |
| --- | ---------------------------------------------- | -------------------------------------------------------- |
| 1   | Nenhum hexadecimal cravado no JSX              | `grep -c '#[0-9a-fA-F]\{3,8\}'` nos seis arquivos → 0    |
| 2   | Nenhum `dark:` onde existe token equivalente   | `grep -c "dark:"` → 0                                    |
| 3   | Azul de ação é `--action`, não o azul da marca | procurar `text-action`/`bg-action` nos botões            |
| 4   | Botão primário: um por bloco de decisão        | contar os botões primários por bloco                     |
| 5   | Texto abaixo de 12px: nenhum                   | procurar `text-[10px]`, `text-[11px]`, `fontSize: 10/11` |
| 6   | Estado vazio com frase completa e ação         | conferir o `TableEmpty` da tabela                        |
| 7   | Ícone é componente, não emoji nem caractere    | `grep` por emoji nos seis arquivos                       |
| 8   | Contagem de paginação em frase                 | o `Pagination` do design system já faz                   |
| 9   | `focus-visible` com anel de 2px, não `focus`   | `grep -c "focus:"` → 0; `focus-visible:ring-2` presente  |
| 10  | Nada animando em laço fora spinner             | procurar `animate-` que não seja de carregamento         |

- [ ] **Passo 2: corrigir o que falhar**

Cada correção em commit próprio, com o número do item na mensagem.

- [ ] **Passo 3: escrever as dez respostas no relatório**

Uma linha por item. **Item que não se aplica também é resposta** — diga por quê.

---

### Task 12: Tirar do `.prettierignore` e formatar

**Em commit próprio**, como a receita manda — a formatação mexe em todas as linhas
e afogaria qualquer outra mudança no diff.

**Arquivos:**

- Modificar: `.prettierignore`
- Modificar: os seis arquivos (só formatação)

- [ ] **Passo 1: abrir a exceção**

O `.prettierignore` ignora `src/pages/*` inteiro e abre exceção com `!`. Siga o
padrão que já existe ali para o financeiro:

```
!src/pages/produtos
!src/pages/Produtos.tsx
```

**Leia o comentário que já está no arquivo** sobre o padrão precisar ser
`src/pages/*` e não `src/pages` — ele explica uma pegadinha do glob.

- [ ] **Passo 2: formatar**

```bash
npx prettier --write src/pages/Produtos.tsx src/pages/produtos/
```

- [ ] **Passo 3: a suíte inteira**

A formatação não pode mudar comportamento. Esperado: verde nos dois fusos, zero
pulados.

Roda: `npx vitest run src/test/prettierignore.test.ts` — há um teste que trava o
conteúdo do `.prettierignore`; se ele falhar, leia o que ele cobra.

- [ ] **Passo 4: commitar**

```bash
git add .prettierignore src/pages/Produtos.tsx src/pages/produtos/
git commit -m "style(produtos): tira a tela do prettierignore e formata"
```

---

### Task 13: Fechar a tela na documentação

**Arquivos:**

- Modificar: `docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md`

- [ ] **Passo 1: medir, antes dos commits desta task**

```bash
git log --oneline main..HEAD | wc -l
git diff --stat main..HEAD | tail -1
wc -l src/pages/Produtos.tsx src/pages/produtos/*
npm test 2>&1 | grep -E "Test Files|Tests "
npm run lint 2>&1 | grep problems
```

- [ ] **Passo 2: escrever a seção**

No molde das telas anteriores: o que a tela tinha, o que virou, os defeitos
achados no caminho, e os números.

Atualize a contagem da Fase 3: passa a **7 de 12**. As que faltam são Clientes,
Estoque, Serviços, Vendas e Vendedores — **cinco**, e a lista tem de bater com o
`PENDENTES_FASE_3` do `guarda-cores`.

- [ ] **Passo 3: commitar**

```bash
git add docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md
git commit -m "docs: fecha a migracao de Produtos - Fase 3 em 7 de 12"
```

---

## Como se sabe que terminou

- `wc -l src/pages/Produtos.tsx` perto de **70**
- `grep -c "dark:"` nos seis arquivos → **0**
- `grep` de paleta crua nos seis arquivos → **0**
- `grep -c '#[0-9a-fA-F]\{3,8\}'` nos seis arquivos → **0**
- `Produtos.tsx` **não** está mais no `PENDENTES_FASE_3`, e o `guarda-cores` passa
- Os cinco arquivos de teste que já existiam passaram **sem edição** em cada
  extração
- O checklist de 10 itens respondido **um a um**, por escrito
- `Produtos` fora do `.prettierignore`, formatado, em commit próprio
- Suíte verde em `TZ=UTC` e `TZ=America/Sao_Paulo`, zero pulados
- Lint **caiu para 93 ou menos** — os oito avisos de variável e import não usados
  que `Produtos.tsx` carregava foram apagados pela migração. `tsc --noEmit` limpo
- **Fase 3 em 7 de 12**
- **Conferência no navegador nos dois temas** — incluindo vazio, carregando e
  erro. É passo 6 da receita e **nenhum teste unitário o substitui**; fica para o
  checkpoint humano.
- **Nada de `push`, nada de merge**
