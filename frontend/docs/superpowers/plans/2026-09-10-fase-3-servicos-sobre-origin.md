# Reaplicação da migração de Serviços sobre o `origin/main`

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA — usar
> superpowers:subagent-driven-development. Os passos são checkbox (`- [ ]`).

**Objetivo:** devolver a decomposição de `src/pages/Servicos.tsx` (909 linhas)
em `src/pages/servicos/`, agora sobre a fonte de dados agregada e paginada no
servidor que a outra frente colocou no `origin/main`, sem desfazer nada do que
ela fez — e consertar, em commit próprio, um defeito de data que está vivo hoje.

**Spec:** `docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md`

**Plano original desta tela:** a migração que estamos reaplicando está na branch
local `fase-3-servicos`. O ponto limpo, de onde a decomposição vem, é o commit
**`91bb7412`**.

## Contexto: o que mudou debaixo desta tela

A sessão irmã trocou a fonte de dados e foi mais longe aqui do que em Produtos:

1. **A tabela paginou no servidor.** `usePaginaDeServicos(recorte, pedido)`
   devolve `{ itens, total }` já buscados, pesquisados e ordenados pelo
   Postgres. Isso aposenta o nosso `ordenarEBuscar` **e** o `usePaginacao`
   nesta tela: a página vira estado próprio, com um efeito que volta para 1
   quando recorte, busca ou ordem mudam.
2. **A exportação virou assíncrona.** `todosOsServicos(recorte, pedido)` busca o
   recorte inteiro — não a página — e a tela ganhou estado `exportando`.

**A boa notícia, medida antes de escrever este plano:** o nosso
`TabelaDeServicos` já recebe `servicos` (a página), `total`, `pagina` e
`onPagina` por prop, e não sabe de onde vieram. O contrato dele **já é** o de
paginação no servidor. A única mudança real que ele precisa é refletir o
`exportando`.

## Global Constraints

- Código, comentários e interface em **português do Brasil**.
- Commits em português, conventional commits, **sem acento** na mensagem.
- **Não existe alias `@/`** — de `src/pages/` para a pasta irmã é `./servicos`.
- Ao citar código em comentário, use **arquivo + símbolo, sem número de linha**.
- **Não reescrever histórico.** Nada de `reset`, `amend`, `rebase`,
  `cherry-pick`. Errou? Commit por cima.
- **Não fazer `push` nem merge.**
- A suíte passa nos **dois fusos**: `TZ=UTC npm test` e
  `TZ=America/Sao_Paulo npm test`, zero pulados.
- `npx tsc --noEmit` limpo. Lint **não sobe** (base: 50 problemas).
- **Mover é mover.** No commit que move não se corrige nada; defeito vira
  comentário `Achado ao mover (não corrigido)` e continua vivo.
- `PENDENTES_FASE_3` (em `src/test/guarda-cores.test.ts`) **só encolhe**.

## O que aprendemos em Produtos, e que vale desde já aqui

A reaplicação de Produtos terminou com uma revisão que plantou 67 quebras — e
**19 passaram verdes**. Nenhuma era defeito de conta; eram todas buracos de
cobertura. Os padrões que escaparam lá, e que aqui têm de ser cobertos **desde a
Task 1**:

- **`within(linha).getByText(valor)` prova que o valor está na linha, não na
  célula certa.** Trocar duas colunas de lugar passava verde.
- **Troca simétrica entre dois campos escapa de qualquer asserção que só olhe o
  conjunto de valores presentes.** Mexer num lado falha; trocar os dois, não.
  Ao escrever teste, pergunte: _que troca simétrica ainda passaria por isso?_
- **Exportação verificada só por `Object.keys` e `toHaveLength` não verifica
  nada.** O conteúdo de cada coluna precisa ser afirmado.
- **Gráfico testado pelo que recebe não prova o que desenha.** Trocar o
  `dataKey` passava verde.
- **Comentário que promete cobertura inexistente é pior que ausência de
  cobertura**, porque impede o próximo revisor de plantar ali.

---

### Task 1: A rede de segurança, sobre a fonte nova

**Arquivos:**

- Criar: `src/pages/Servicos.kpis.test.tsx`, `src/pages/Servicos.tabela.test.tsx`
- **Não tocar** em `src/pages/Servicos.tsx` (a não ser para plantar e reverter)

Os dois já existem, escritos contra a fonte antiga, em
`fase-3-servicos:src/pages/Servicos.kpis.test.tsx` e
`fase-3-servicos:src/pages/Servicos.tabela.test.tsx`.

- [ ] **Passo 1: Ler o que já existe**

Os três testes dela (`Servicos.periodo`, `Servicos.paginacao`,
`Servicos.multiselect`) mostram o padrão de `vi.mock` a copiar. Ler também
`src/pages/servicos/hooksFalsos.ts` inteiro — a fábrica é
`criarHooksFalsosDeServicos(servicos)`.

- [ ] **Passo 2: Trazer os nossos dois**

```bash
git checkout fase-3-servicos -- src/pages/Servicos.kpis.test.tsx src/pages/Servicos.tabela.test.tsx
```

- [ ] **Passo 3: Trocar a falsificação**

Sai o mock de `../context/ServicosContext` (que **não existe mais** no
`origin/main`); entra o `vi.mock("./servicos/useServicos", ...)` no molde dos
três dela. Os fixtures ficam dentro de `vi.hoisted`.

- [ ] **Passo 4: Rodar, e ajustar só o que a fonte nova legitimamente mudou**

```bash
npx vitest run src/pages/Servicos.kpis.test.tsx src/pages/Servicos.tabela.test.tsx
```

A ordenação e a busca agora são do servidor: o falso as aplica. Se uma asserção
não puder ser mantida, **registre e reporte** em vez de reescrevê-la para algo
mais fácil.

- [ ] **Passo 5: Fechar os buracos que Produtos ensinou, já aqui**

Estes não estavam nos arquivos originais e entram agora, cada um com plantação:

- cada coluna da tabela prende **valor a rótulo** (troque duas de lugar e veja
  falhar);
- cada KPI prende **valor a rótulo** — e teste a troca **simétrica** entre dois
  deles, não só mexer em um.

- [ ] **Passo 6: Plantar, ver falhar, reverter — por arquivo**

A plantação abaixo é **sugestão, não fato**: se passar verde, ache outra que
derrube. Em `src/pages/Servicos.tsx`:

- para o `kpis.test`: troque `totalFaturado` e `ticketMedio` entre si;
- para o `tabela.test`: troque duas colunas de lugar.

Reverter com `git checkout -- src/pages/Servicos.tsx` e conferir
`git status --porcelain` limpo antes do commit.

- [ ] **Passo 7: Commit**

```bash
git add src/pages/Servicos.kpis.test.tsx src/pages/Servicos.tabela.test.tsx
git commit -m "test(servicos): caracterizacao dos kpis e da tabela sobre a fonte agregada"
```

---

### Task 2: Mover — a decomposição sobre a fonte nova

**Arquivos:**

- Criar: `src/pages/servicos/CabecalhoServicos.tsx`, `FiltrosDeServicos.tsx`,
  `KpisDeServicos.tsx`, `GraficosDeServicos.tsx`, `TabelaDeServicos.tsx`
- Criar: `src/pages/servicos/servicos.ts`, `servicos.test.ts`
- Modificar: `src/pages/Servicos.tsx` (909 → ~240 linhas)

> **De onde vem a decomposição.** A pasta existe na branch `fase-3-servicos` em
> duas versões: a final, que **já traz três consertos embutidos**, e a de
> **`91bb7412`**, imediatamente anterior a eles. **Use a de `91bb7412`.** Os
> consertos voltam na Task 4, um commit cada.
>
> ⚠️ A pasta `src/pages/servicos/` **já existe** no `origin/main`, com
> `useServicos.ts` e `hooksFalsos.ts` dela. Os nomes não colidem — mas **não
> apague nem sobrescreva** esses dois.

- [ ] **Passo 1: Trazer a decomposição do ponto limpo**

```bash
git checkout 91bb7412 -- src/pages/servicos/CabecalhoServicos.tsx \
  src/pages/servicos/FiltrosDeServicos.tsx src/pages/servicos/KpisDeServicos.tsx \
  src/pages/servicos/GraficosDeServicos.tsx src/pages/servicos/TabelaDeServicos.tsx \
  src/pages/servicos/servicos.ts src/pages/servicos/servicos.test.ts
```

Confirme com `git status` que `useServicos.ts` e `hooksFalsos.ts` **não** foram
tocados.

- [ ] **Passo 2: Podar de `servicos.ts` o que o banco assumiu**

| Função                  | Quem faz agora                                    |
| ----------------------- | ------------------------------------------------- |
| `opcoesDeFiltro`        | `resumo.opcoes`                                   |
| `filtrarServicos`       | o `recorte` que vai para o servidor               |
| `ordenarEBuscar`        | `usePaginaDeServicos` (busca e ordem no Postgres) |
| `rankingDeClientes`     | `resumo.por_cliente`                              |
| `distribuicaoPorCidade` | `resumo.por_cidade`                               |
| `calcularKpis`          | `resumo.kpis` (só a leitura do topo sobrevive)    |

`evolucaoPorMes` **não morre inteira**: a metade que percorre os serviços
somando por mês morre; a que agrupa por ano acima de 24 meses **fica**.

A interface `Servico` provavelmente sobrevive — a tabela ainda recebe linhas de
serviço, agora vindas da página do servidor. Confira com `grep` antes de decidir.

- [ ] **Passo 3: Mover para `servicos.ts` as contas puras da versão dela**

Ler `origin/main:src/pages/Servicos.tsx` e mover — movendo, não reescrevendo:

- `recorteDeServicos(filtros)` — monta o `RecorteDeServicos`;
- `kpisDoResumo(resumo)` — os quatro números do topo, incluindo o
  `topCliente` que sai de `resumo.por_cliente[0]`;
- `evolucaoDoResumo(evolucaoMensal)` — com o agrupamento anual do Passo 2;
- `rankingDoResumo(porCliente)` — o top 10, com o nome truncado em 20 caracteres;
- `cidadesDoResumo(porCidade)` — as dez maiores.

Sobrevivem sem edição: `formatarValorAbreviado`, `linhasDaPlanilha`,
`linhasDoPdf`, e os tipos.

- [ ] **Passo 4: Reescrever `Servicos.tsx` como casca**

Referência: `91bb7412:src/pages/Servicos.tsx` (227 linhas).

**Preservar da versão dela, sem reescrever:**

- o estado `paginaAtual` e o efeito que o devolve a 1 quando recorte, busca ou
  ordem mudam — **não** voltar a usar `usePaginacao` aqui;
- `todosOsServicos` na exportação, buscando o recorte inteiro e não a página;
- o estado `exportando` e o comentário que explica por que a exportação leva o
  recorte todo.

⚠️ **O `exportando` é estado MORTO na versão dela, e continua morto aqui.**
Verificado no `origin/main`: `const [exportando, setExportando] = useState(false)`
é declarado e escrito em quatro pontos, e **nunca lido** — não há feedback de
"Exportando…" nem proteção contra clique duplo enquanto o recorte inteiro é
buscado. Mover é mover: preserve o estado morto como está, com um comentário
`Achado ao mover (não corrigido)`. **Não** acrescente a prop `exportando` ao
`TabelaDeServicos` aqui — dar vida a ele é conserto, e conserto é da Task 3.

(Uma versão anterior deste plano mandava o contrário, dizendo que a prop era
preservação. Estava errado: a Task 1 verificou que não há comportamento a
preservar.)

- [ ] **Passo 5: Ajustar `servicos.test.ts` ao que sobrou**

Apagar os testes das funções que morreram; manter os das sobreviventes;
escrever teste **com plantação** para cada função nova do Passo 3.

- [ ] **Passo 6: O portão desta task**

```bash
npx vitest run src/pages/Servicos.kpis.test.tsx src/pages/Servicos.tabela.test.tsx \
  src/pages/Servicos.periodo.test.tsx src/pages/Servicos.paginacao.test.tsx \
  src/pages/Servicos.multiselect.test.tsx src/pages/servicos/servicos.test.ts
```

**Os cinco arquivos de teste de tela passam sem uma única edição.** Se algum
precisar de mudança, a decomposição mudou comportamento — **pare e reporte
BLOCKED**.

- [ ] **Passo 7: `tsc`, suíte nos dois fusos, commit**

```bash
npx tsc --noEmit
TZ=UTC npm test 2>&1 | tail -4
TZ=America/Sao_Paulo npm test 2>&1 | tail -4
git add src/pages/Servicos.tsx src/pages/servicos/
git commit -m "refactor(servicos): a tela vira casca sobre pages/servicos, lendo o resumo agregado"
```

---

### Task 3: Os quatro consertos, um commit cada

**Arquivos:** `src/pages/servicos/TabelaDeServicos.tsx`, `src/pages/servicos/servicos.ts`

Os originais estão em `f98e5bff`, `a26f2354` e `935b8ba3`. Ler cada um com
`git show` e **reimplementar** — não `cherry-pick`.

- [ ] **3.1 — O cabeçalho ordenável não alcança o teclado** (original: `f98e5bff`)

O `onClick` sai do `<th>` e vai para um `<button type="button">` por dentro, com
`aria-label={`Ordenar por ${rotulo}`}` e `focus-visible:ring-2`. Padrão em
`TabelaDeContas.tsx`.

Isso muda a **mecânica** dos testes (clique passa de `<th>` para
`getByRole("button", ...)`); o que eles afirmam não muda. **Escreva também um
teste de foco de verdade** — `getByRole("button")` aceitaria um
`<th role="button">`, que continua inalcançável; chame `focus()` e olhe o
`document.activeElement`.

Commit: `fix(servicos): cabecalho ordenavel ganha foco de teclado`

- [ ] **3.2 — Os botões de exportar não desabilitam com a tabela vazia**
      (original: `a26f2354`) — os **dois**, Excel e PDF.

Commit: `fix(servicos): botoes de exportar desabilitam com a tabela vazia`

- [ ] **3.3 — A data de emissão sai um dia atrás na Excel e no PDF**
      (original: `935b8ba3`)

**Este é um defeito vivo no `origin/main` agora, e sai de casa em documento.**
Em `origin/main:src/pages/Servicos.tsx`, a exportação faz
`new Date(s.data_emissao).toLocaleDateString('pt-BR')` em dois lugares (Excel e
PDF). `data_emissao` é `YYYY-MM-DD`, que o ECMAScript lê como meia-noite em
**UTC** — e a oeste de Greenwich isso ainda é o dia anterior. Verificado:

| Onde                                    | 2026-03-15 vira                 |
| --------------------------------------- | ------------------------------- |
| tabela na tela (`split("-").reverse()`) | 15/03/2026 ✅                   |
| Excel e PDF, em `TZ=America/Sao_Paulo`  | **14/03/2026** ❌               |
| qualquer um em `TZ=UTC`                 | 15/03/2026 — o defeito **some** |

O conserto é `dataDeCalendario`, de `src/lib/datas.ts`, que existe para isto.

⚠️ **O teste tem de falhar em `TZ=America/Sao_Paulo` e não pode depender do fuso
da máquina.** Em UTC ele passa com o defeito presente. Construa o instante em
hora local e escolha uma data cuja virada atravesse o fuso — meio-dia não testa
nada.

Commit: `fix(servicos): data de emissao sai do defeito de fuso, em dois lugares`

- [ ] **3.4 — O `exportando` não faz nada**

Achado na Task 1. Na versão dela o estado é escrito e nunca lido: quem clica em
"Exportar Excel" num recorte grande fica sem retorno nenhum enquanto todas as
páginas são buscadas do servidor, e pode clicar de novo, disparando a busca
inteira outra vez.

Dar vida a ele: `TabelaDeServicos` ganha a prop `exportando`, os dois botões
desabilitam enquanto ela é verdadeira, e o rótulo diz que está exportando.
Interface em português, sentence case, sem emoji.

Plantar: devolver a prop a `false` fixo. Ver falhar. Reverter.
Commit: `fix(servicos): exportar da retorno e nao aceita clique duplo`

- [ ] **Passo final: `tsc`, suíte nos dois fusos, lint**

---

### Task 4: A ordenação vira conta pura, e a tela sai de `PENDENTES_FASE_3`

- [ ] **Passo 1: `proximaOrdenacao` vira conta pura** (original: `7b94a53b`)

A regra de alternar a ordenação (mesmo campo inverte a direção; campo novo
começa em `desc`) sai da casca para `servicos.ts`, com teste e plantação.

Commit: `refactor(servicos): a regra de alternar ordenacao vira conta pura`

- [ ] **Passo 2: Limpar a paleta crua que sobrou na casca**

⚠️ **Este passo é trabalho, não conferência** — uma versão anterior deste plano
dizia que o `grep` viria vazio, e estava errada. O motivo: `91bb7412` é
justamente o commit que adota os tokens na casca **e** tira a tela do
`PENDENTES_FASE_3`, no mesmo commit. A Task 2 não podia usar a casca dele (o
arquivo ficaria limpo enquanto ainda listado, e a armadilha reversa do guarda
derruba a suíte), então trouxe o bloco de `91bb7412^` — idêntico ao do
`origin/main`, com a paleta crua.

```bash
grep -n "dark:\|text-gray-\|bg-gray-\|text-slate-\|bg-slate-\|text-blue-\|bg-blue-" \
  src/pages/Servicos.tsx src/pages/servicos/*.tsx
```

Sobraram três linhas na casca: o `<div>` do estado de carregando, o `<p>` da
frase dentro dele, e o `<div>` raiz. Trocar por classe de token
(`bg-surface-base`, `text-conteudo-muted`), **sem** modificador de opacidade —
`bg-surface/40` não gera regra e há guarda para isso.

`git show 91bb7412 -- src/pages/Servicos.tsx` mostra como aquela migração fez,
inclusive a troca do spinner cru pelo `Spinner` do design system.

- [ ] **Passo 3: Tirar da lista**

Apagar `"src/pages/Servicos.tsx"` de `PENDENTES_FASE_3` em
`src/test/guarda-cores.test.ts`. A lista **só encolhe**; o guarda tem armadilha
reversa e falha se um arquivo listado já estiver limpo.

- [ ] **Passo 4: Suíte e commit**

```bash
git add -A && git commit -m "refactor(servicos): a tela sai de PENDENTES_FASE_3"
```

---

### Task 5: O prettier, em commit próprio

- [ ] **Passo 1:** conferir se `.prettierignore` menciona a tela; se mencionar,
      apagar a linha.
- [ ] **Passo 2:** `npx prettier --write` na tela, na pasta e nos testes.
- [ ] **Passo 3:** `git diff -w --stat` tem de vir **vazio** — se não vier, o
      prettier mudou conteúdo: pare e reporte.
- [ ] **Passo 4:** suíte nos dois fusos, `tsc`, lint, e commit
      `style(servicos): prettier na tela e nos componentes`.
