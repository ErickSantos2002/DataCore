# Fase 4, item 2 — as seis telas adotam o `Pagination` (plano de implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** apagar as seis paginações próprias de Clientes, Estoque, Produtos,
Serviços, Vendas e Vendedores, fazendo as seis consumirem o `Pagination` do
design system, o `TableEmpty` que ele pressupõe e um `usePaginacao` novo.

**Architecture:** quatro movimentos, na ordem do spec. **M0** ensina ao
primitivo a forma compacta de celular que só as seis têm hoje, para que a adoção
não perca comportamento. **M1** caracteriza o rodapé de cada tela como ele é
hoje. **M2** troca o markup pelo primitivo, e a caracterização do M1 tem de
passar sem edição fora de duas exceções escritas antes de começar. **M3**
conserta os dois defeitos que sobram, cada um com plantação.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest + Testing Library (jsdom),
Tailwind 3.4.17, design system em `src/design-system/`.

**Spec:** `docs/superpowers/specs/2026-09-03-fase-4-pagination-design.md`

## Global Constraints

- Código, comentários, interface e mensagem de commit em **português do Brasil**.
- Commits em conventional commits, **sem acento** na mensagem.
- Interface em sentence case, sem emoji; frase de erro completa com ponto final.
- `focus-visible` com anel de 2px, nunca `focus`. Todo primitivo interativo
  precisa de `focus-visible:ring-2` — há guarda que falha a suíte sem isso.
- **Nunca editar `src/design-system/tokens/` nem `styles.css`** (cópia verbatim).
- Nada de hexadecimal cravado, nada de modificador de opacidade em classe de
  token (`bg-surface/40`), nada de `style={{}}` para aparência em primitivo.
- As seis telas continuam em `PENDENTES_FASE_3` — **não** tirar linha da lista,
  este item não migra tela.
- A suíte tem de passar com `TZ=UTC` **e** `TZ=America/Sao_Paulo`.
- Baseline que não pode regredir: **1373 testes / 85 arquivos**, lint **119**,
  `tsc --noEmit` limpo. O lint não pode subir.
- **Não fazer `push`.** O repositório está à frente do `origin/main` de propósito.
- **Importar o design system por caminho relativo**, nunca por `@/`. O
  `CLAUDE.md` traz `import { Button } from "@/design-system/ui"` como exemplo,
  mas **esse alias não existe aqui**: o `tsconfig.json` não tem `paths` e o
  `src/` inteiro tem zero ocorrências de `@/` (conferido em 03/09/2026). O Vite
  resolveria e o `tsc --noEmit` quebraria. De `src/pages/` o caminho é
  `"../design-system/ui"`, que é o que `contas/TabelaDeContas.tsx` já usa.

## Estrutura de arquivos

**Criar:**

| Arquivo                                    | Responsabilidade                                              |
| ------------------------------------------ | ------------------------------------------------------------- |
| `src/hooks/usePaginacao.ts`                | estado da página, corte da lista e o reset ao trocar de lista |
| `src/hooks/usePaginacao.test.ts`           | teste do hook isolado                                         |
| `src/pages/<Tela>.paginacao.test.tsx` (×6) | caracterização do rodapé de cada tela                         |

**Modificar:**

| Arquivo                                                   | O quê                                  |
| --------------------------------------------------------- | -------------------------------------- |
| `src/design-system/ui/data/Pagination.tsx`                | ganha a forma compacta abaixo de `md`  |
| `src/design-system/ui/data/Pagination.test.tsx`           | testes da forma compacta               |
| `src/pages/Clientes.tsx`                                  | rodapé → primitivo; `TableEmpty`; hook |
| `src/pages/Estoque.tsx`                                   | idem                                   |
| `src/pages/Produtos.tsx`                                  | idem                                   |
| `src/pages/Servicos.tsx`                                  | idem                                   |
| `src/pages/Vendas.tsx`                                    | idem                                   |
| `src/pages/Vendedores.tsx`                                | idem                                   |
| `docs/superpowers/2026-09-01-multiselect-divergencias.md` | as divergências novas                  |

## A tabela que todas as tasks consultam

Os números por tela, medidos. **Errar um destes é errar a task inteira.**

| Tela       | `pageSize` | `itemLabel`  | `colSpan` | Lista da tabela  | Contexto mockado             |
| ---------- | ---------- | ------------ | --------- | ---------------- | ---------------------------- |
| Clientes   | 15         | _(default)_  | 5         | `clientesTabela` | `../context/DataContext`     |
| Estoque    | 15         | _(default)_  | 7         | `produtosTabela` | `../context/EstoqueContext`  |
| Produtos   | 10         | `"produtos"` | 6         | `produtosTabela` | `../context/DataContext`     |
| Serviços   | 15         | _(default)_  | 6         | `servicosTabela` | `../context/ServicosContext` |
| Vendas     | 10         | _(default)_  | 6         | `notasTabela`    | `../context/DataContext`     |
| Vendedores | 10         | _(default)_  | 7         | `notasTabela`    | `../context/DataContext`     |

O `colSpan` é a contagem de `<td>` de uma linha do corpo. **Não** use
`grep -c "<th"`: ele conta o `<thead>` junto e devolve um a mais.

Em **cinco** telas, uma entrada do fixture vira uma linha da tabela. Só
**Produtos** agrega: ele soma os `itens` das notas por `codigo`, então uma nota
com 12 itens de código distinto vira 12 linhas.

Nas seis, a lista da tabela é
`useMemo(..., [<listaFiltrada>, pesquisaTabela, ordenacao])` — conferido. É esse
`useMemo` que torna o reset por identidade seguro, e é ele que a Task 9 confere
uma a uma antes de plugar o hook.

---

### Task 1: o `Pagination` aprende a forma compacta de celular

**Files:**

- Modify: `src/design-system/ui/data/Pagination.tsx`
- Test: `src/design-system/ui/data/Pagination.test.tsx`

**Interfaces:**

- Consumes: nada — é o primeiro movimento.
- Produces: o `Pagination` passa a renderizar **dois** blocos de controle no
  DOM: o completo (`hidden md:flex`) e o compacto (`flex md:hidden`). Em jsdom
  **não há media query**, então **os dois existem na árvore ao mesmo tempo**.
  Toda task seguinte que consultar botão de paginação precisa saber disso.
  A `PaginationProps` **não muda** — nenhuma prop nova.

**Por que primeiro:** as seis telas têm rodapé compacto no celular e Contas, que
já consome o primitivo, não tem. Adotar antes de ensinar faria as seis trocarem
algo que funciona por uma linha de ~370px dentro de 360px.

- [ ] **Passo 1: escrever os testes que falham**

Acrescentar ao fim do `describe` existente em
`src/design-system/ui/data/Pagination.test.tsx`:

```tsx
/**
 * A forma compacta de celular.
 *
 * Em jsdom não há media query: `hidden md:flex` e `flex md:hidden` são só
 * classes, e os DOIS blocos existem na árvore. Por isso estes testes acham
 * os botões compactos pelo `aria-label`, e os do bloco completo pelo texto
 * "Anterior"/"Próxima" — misturar os dois é o erro fácil aqui.
 */
it("mostra a pagina atual entre dois botoes compactos", () => {
  render(
    <Pagination page={3} pageSize={10} total={84} onPageChange={() => {}} />,
  );

  expect(
    screen.getByRole("button", { name: "Página anterior" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Próxima página" }),
  ).toBeInTheDocument();
  expect(screen.getByTestId("pagina-atual-compacta")).toHaveTextContent("3");
});

it("os botoes compactos andam de pagina", () => {
  const aoTrocar = vi.fn();
  render(
    <Pagination page={3} pageSize={10} total={84} onPageChange={aoTrocar} />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
  expect(aoTrocar).toHaveBeenCalledWith(4);

  fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));
  expect(aoTrocar).toHaveBeenCalledWith(2);
});

it("os botoes compactos desabilitam nos extremos", () => {
  const { rerender } = render(
    <Pagination page={1} pageSize={10} total={84} onPageChange={() => {}} />,
  );
  expect(
    screen.getByRole("button", { name: "Página anterior" }),
  ).toBeDisabled();
  expect(screen.getByRole("button", { name: "Próxima página" })).toBeEnabled();

  rerender(
    <Pagination page={9} pageSize={10} total={84} onPageChange={() => {}} />,
  );
  expect(screen.getByRole("button", { name: "Página anterior" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
});

it("a frase de contagem aparece uma vez so, nao uma por forma", () => {
  // A frase é irmã dos dois blocos, não filha de um deles. Se alguém
  // duplicá-la para "arrumar" o layout do celular, o leitor de tela passa
  // a ouvir a contagem duas vezes.
  render(
    <Pagination page={1} pageSize={10} total={84} onPageChange={() => {}} />,
  );

  expect(screen.getAllByText("Mostrando 1 a 10 de 84 registros")).toHaveLength(
    1,
  );
});
```

Se `fireEvent` ou `vi` ainda não estiverem importados no arquivo, acrescentar
ao import existente do `@testing-library/react` e do `vitest`.

- [ ] **Passo 2: rodar e ver falhar pelo motivo certo**

Run: `npx vitest run src/design-system/ui/data/Pagination.test.tsx`
Expected: FAIL — `Unable to find an accessible element with the role "button"
and name "Página anterior"`. Os três primeiros falham por isso; o quarto
(a frase) já passa, porque a frase existe e é única hoje.

- [ ] **Passo 3: implementar**

Em `src/design-system/ui/data/Pagination.tsx`, trocar o `<div>` de controles
por dois blocos. O `<p>` da frase **não se mexe**.

O bloco que já existe ganha `hidden` e `md:flex` no lugar de `flex`:

```tsx
      <div className="hidden items-center gap-1.5 md:flex">
```

E, logo depois de fechar esse bloco, antes de fechar o `<div>` externo:

```tsx
{
  /*
        Forma compacta de celular.

        A janela de cinco números mais Anterior e Próxima passa de 370px e não
        cabe numa tela de 360px — envolvia em três linhas. As seis telas da
        Fase 4 já contornavam isso com um bloco próprio, copiado igual nas
        seis; o primitivo passa a resolver para todo mundo, e Contas ganha um
        rodapé de celular que nunca teve.

        Os rótulos visíveis continuam `<` e `>`, os mesmos das seis telas — a
        troca pelos tipográficos `‹` e `›` seria melhoria de tipografia no meio
        de uma unificação, e entraria como uma edição a mais na caracterização
        do M2. O nome acessível, esse sim, é frase inteira: `<` sozinho não diz
        nada em leitor de tela.
      */
}
<div className="flex items-center gap-2 md:hidden">
  <button
    type="button"
    aria-label="Página anterior"
    disabled={emPrimeira}
    onClick={() => onPageChange(page - 1)}
    className={[
      "rounded-lg border border-borda bg-surface px-3 py-1.5 text-sm font-medium text-conteudo transition-colors",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
      "disabled:cursor-not-allowed disabled:opacity-40",
    ].join(" ")}
  >
    {"<"}
  </button>
  <span
    data-testid="pagina-atual-compacta"
    className="rounded-lg border border-borda bg-surface px-3 py-1.5 text-sm font-medium text-conteudo"
  >
    {page}
  </span>
  <button
    type="button"
    aria-label="Próxima página"
    disabled={emUltima}
    onClick={() => onPageChange(page + 1)}
    className={[
      "rounded-lg border border-borda bg-surface px-3 py-1.5 text-sm font-medium text-conteudo transition-colors",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
      "disabled:cursor-not-allowed disabled:opacity-40",
    ].join(" ")}
  >
    {">"}
  </button>
</div>;
```

Acrescentar ao docblock do componente, depois do parágrafo que fala do
`TableEmpty`:

```
 * Abaixo de `md` a janela de números dá lugar a `<`, a página atual e `>` —
 * a forma completa não cabe em 360px. Os dois blocos existem no DOM e quem
 * escolhe é o CSS, então em jsdom **os dois são encontráveis**: teste que
 * procura "Anterior" acha o bloco completo, e o compacto responde por
 * `aria-label`.
```

- [ ] **Passo 4: rodar e ver passar, com os guardas junto**

Run: `npx vitest run src/design-system/ui/data/Pagination.test.tsx src/test/`
Expected: PASS. Os guardas importam aqui: os botões novos têm
`focus-visible:ring-2` e usam só classe de token, sem paleta crua nem
hexadecimal.

- [ ] **Passo 5: provar que os testes enxergam**

Trocar `md:hidden` por `hidden` no bloco compacto (some do DOM) e rodar de novo:
os três primeiros testes têm de falhar. Reverter.

Depois trocar `aria-label="Próxima página"` por `aria-label="Proxima pagina"` e
rodar: o teste de andar de página falha. Reverter.

Sem as duas quebras plantadas e revertidas, a task não está entregue.

- [ ] **Passo 6: suíte inteira, lint e tsc**

```bash
npm test && npm run lint && npx tsc --noEmit
```

Expected: 85 arquivos verdes (1373 + 4 = **1377 testes**), lint **≤ 119**,
`tsc` sem saída.

- [ ] **Passo 7: commit**

```bash
git add src/design-system/ui/data/Pagination.tsx src/design-system/ui/data/Pagination.test.tsx
git commit -m "feat(ds): Pagination ganha a forma compacta de celular"
```

---

### Task 2: caracterizar o rodapé de Produtos

**Files:**

- Create: `src/pages/Produtos.paginacao.test.tsx`
- Read (para copiar o preâmbulo de mocks): `src/pages/Produtos.multiselect.test.tsx:1-75`

**Interfaces:**

- Consumes: nada do código de produção — caracteriza o que já existe.
- Produces: o **molde** que as Tasks 3 a 7 repetem. E o critério de aceitação
  do M2: estes testes têm de passar depois da Task 8 sem edição, fora as duas
  exceções da Task 8.

**Por que Produtos primeiro:** é a única tela que agrega (itens de nota por
código), então é o fixture mais difícil. Resolvido aqui, os outros cinco são
1:1.

- [ ] **Passo 1: escrever o teste**

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Produtos from "./Produtos";

/**
 * Caracterização da PAGINAÇÃO COMO ELA VIVE em Produtos.
 *
 * Não é a tela, e não é o MultiSelect (esse tem arquivo próprio ao lado):
 * é o rodapé. O que se fixa aqui é o contrato que a adoção do `Pagination`
 * do design system tem de preservar — quantas linhas cabem numa página, o
 * que a frase de contagem diz, e o que os botões fazem nos extremos.
 *
 * Produtos AGREGA: `produtosAgregados` soma os `itens` das notas por
 * `codigo`, então uma nota com 12 itens de código distinto vira 12 linhas de
 * tabela. É por isso que o fixture é uma nota só.
 *
 * Página de 10 itens, 12 produtos: duas páginas, a segunda com 2.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const ITENS = Array.from({ length: 12 }, (_, i) => ({
  codigo: `P${String(i + 1).padStart(2, "0")}`,
  descricao: `Produto ${String(i + 1).padStart(2, "0")}`,
  quantidade: "1",
  valor_total: "100",
}));

const NOTAS = [
  {
    id: 1,
    data_emissao: "2026-01-10",
    valor_nota: 1200,
    cliente: { nome: "Alfa Mineração", cpf_cnpj: "11.222.333/0001-44" },
    nome_vendedor: "Vendedor A",
    itens: ITENS,
  },
];

vi.mock("../context/DataContext", () => ({
  useData: () => ({ notas: NOTAS, carregando: false }),
}));

vi.mock("recharts", () => {
  const semDesenho = () => null;
  return {
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    BarChart: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    LineChart: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    PieChart: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Bar: semDesenho,
    Line: semDesenho,
    Pie: semDesenho,
    Cell: semDesenho,
    XAxis: semDesenho,
    YAxis: semDesenho,
    Tooltip: semDesenho,
    CartesianGrid: semDesenho,
    Legend: semDesenho,
  };
});

/** As linhas de dado da tabela — o `<tbody>`, sem o cabeçalho. */
function linhasDaTabela(): HTMLElement[] {
  const corpo = document.querySelector("tbody");
  if (!corpo) throw new Error("tbody nao encontrado");
  return within(corpo as HTMLElement).queryAllByRole("row");
}

describe("paginacao em Produtos", () => {
  it("corta a tabela em 10 linhas por pagina", () => {
    render(<Produtos />);

    expect(linhasDaTabela()).toHaveLength(10);
    expect(screen.getByText("Produto 01")).toBeInTheDocument();
    expect(screen.queryByText("Produto 11")).not.toBeInTheDocument();
  });

  it("a frase de contagem diz o intervalo e o total", () => {
    render(<Produtos />);

    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 1 a 10 de 12 produtos",
    );
  });

  it("Proximo leva a segunda pagina, que tem o resto", () => {
    render(<Produtos />);

    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));

    expect(linhasDaTabela()).toHaveLength(2);
    expect(screen.getByText("Produto 11")).toBeInTheDocument();
    expect(screen.queryByText("Produto 01")).not.toBeInTheDocument();
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 11 a 12 de 12 produtos",
    );
  });

  it("Anterior volta para a primeira", () => {
    render(<Produtos />);

    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));

    expect(screen.getByText("Produto 01")).toBeInTheDocument();
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 1 a 10 de 12 produtos",
    );
  });

  it("os extremos desabilitam", () => {
    render(<Produtos />);

    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));

    expect(screen.getByRole("button", { name: "Próximo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
  });
});
```

- [ ] **Passo 2: rodar e ajustar os seletores até passar contra o código de hoje**

Run: `npx vitest run src/pages/Produtos.paginacao.test.tsx`

Este teste descreve o código **atual** e tem de passar sem tocar em produção.
Se falhar, o defeito está no teste. Dois tropeços prováveis, com a saída:

- **`Found multiple elements with the text: /Mostrando/`** — não deve
  acontecer hoje (a frase é única), mas se acontecer, escopar com
  `within(...)` no rodapé em vez de relaxar a query.
- **`Unable to find ... name "Próximo"`** — conferir o acento e a grafia:
  hoje as seis escrevem exatamente "Próximo".

**Não** ajustar o código de produção nesta task, em nenhuma hipótese.

- [ ] **Passo 3: provar que o teste enxerga**

Em `src/pages/Produtos.tsx:121`, trocar `useState(10)` por `useState(11)`.

Run: `npx vitest run src/pages/Produtos.paginacao.test.tsx`
Expected: FAIL nos testes de corte e de contagem.

Reverter. Rodar de novo e ver verde. **Sem essa prova a task não está entregue.**

- [ ] **Passo 4: suíte inteira, lint e tsc**

```bash
npm test && npm run lint && npx tsc --noEmit
```

Expected: **86 arquivos**, 1377 + 5 = **1382 testes**, lint ≤ 119, `tsc` limpo.

- [ ] **Passo 5: commit**

```bash
git add src/pages/Produtos.paginacao.test.tsx
git commit -m "test(produtos): caracteriza a paginacao antes de adotar o primitivo"
```

---

### Task 3: caracterizar o rodapé das outras cinco telas

**Files:**

- Create: `src/pages/Clientes.paginacao.test.tsx`
- Create: `src/pages/Estoque.paginacao.test.tsx`
- Create: `src/pages/Servicos.paginacao.test.tsx`
- Create: `src/pages/Vendas.paginacao.test.tsx`
- Create: `src/pages/Vendedores.paginacao.test.tsx`
- Read (preâmbulo de mocks de cada uma): `src/pages/<Tela>.multiselect.test.tsx`

**Interfaces:**

- Consumes: o molde da Task 2 — as cinco repetem a mesma estrutura de
  `describe`, o mesmo helper `linhasDaTabela()` e as mesmas cinco asserções.
- Produces: a rede completa das seis telas, que a Task 8 não pode editar.

**A diferença das cinco para Produtos:** nenhuma agrega. **Uma entrada do
fixture vira uma linha da tabela.** Então o fixture é uma lista de N entradas
do tipo que aquele contexto entrega, com N = `pageSize + 2`.

**Por tela, o que muda no molde da Task 2** (o resto é idêntico):

| Tela       | Mock do contexto                                                                                                           | Fixture     | `pageSize` | Frase esperada na 1ª página        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- | ---------------------------------- |
| Clientes   | `../context/DataContext` → `{ clientes, clientesEnriquecidos, notas, carregando: false }`                                  | 17 clientes | 15         | `Mostrando 1 a 15 de 17 registros` |
| Estoque    | `../context/EstoqueContext` → `{ produtos, carregando: false }`                                                            | 17 produtos | 15         | `Mostrando 1 a 15 de 17 registros` |
| Serviços   | `../context/ServicosContext` → `{ servicos, servicosEnriquecidos, carregando: false }`                                     | 17 serviços | 15         | `Mostrando 1 a 15 de 17 registros` |
| Vendas     | `../context/DataContext` → `{ notas, carregando: false }`                                                                  | 12 notas    | 10         | `Mostrando 1 a 10 de 12 registros` |
| Vendedores | `../context/DataContext` → `{ notas, notasVendedor, carregando: false, atualizarTipoNota: vi.fn(), vendedorLogado: null }` | 12 notas    | 10         | `Mostrando 1 a 10 de 12 registros` |

Nas cinco o substantivo é **"registros"**, não o nome da entidade — só Produtos
diz "produtos".

- [ ] **Passo 1: para cada uma das cinco, escrever o arquivo**

Copiar o preâmbulo de mocks do `<Tela>.multiselect.test.tsx` irmão **sem
alterá-lo** (é ele que já sabe a forma exata que aquele contexto entrega), e
trocar só o fixture por uma lista gerada com `Array.from`, com os campos que a
tela lê. Depois, o mesmo `describe` da Task 2, com a frase e o `pageSize` da
tabela acima.

O corpo do `describe`, idêntico ao da Task 2 a menos dos números — aqui na
versão de 15 por página, para as três primeiras telas:

```tsx
/** As linhas de dado da tabela — o `<tbody>`, sem o cabeçalho. */
function linhasDaTabela(): HTMLElement[] {
  const corpo = document.querySelector("tbody");
  if (!corpo) throw new Error("tbody nao encontrado");
  return within(corpo as HTMLElement).queryAllByRole("row");
}

describe("paginacao em <Tela>", () => {
  it("corta a tabela em 15 linhas por pagina", () => {
    render(<Tela />);
    expect(linhasDaTabela()).toHaveLength(15);
  });

  it("a frase de contagem diz o intervalo e o total", () => {
    render(<Tela />);
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 1 a 15 de 17 registros",
    );
  });

  it("Proximo leva a segunda pagina, que tem o resto", () => {
    render(<Tela />);
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(linhasDaTabela()).toHaveLength(2);
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 16 a 17 de 17 registros",
    );
  });

  it("Anterior volta para a primeira", () => {
    render(<Tela />);
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(linhasDaTabela()).toHaveLength(15);
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 1 a 15 de 17 registros",
    );
  });

  it("os extremos desabilitam", () => {
    render(<Tela />);
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByRole("button", { name: "Próximo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
  });
});
```

Para Vendas e Vendedores, os mesmos cinco `it` com 10/12 no lugar de 15/17, e
`Mostrando 11 a 12 de 12 registros` na segunda página.

- [ ] **Passo 2: rodar cada uma e ajustar os seletores até passar contra o código de hoje**

Run: `npx vitest run src/pages/<Tela>.paginacao.test.tsx`

Mesma regra da Task 2: o teste descreve o código atual. **Zero edição em
produção.** Se uma tela precisar de campo que o fixture não tem, o erro aparece
como `TypeError` dentro do `useMemo` da tela — acrescentar o campo ao fixture,
nunca mexer na tela.

- [ ] **Passo 3: provar que cada um dos cinco testes enxerga**

Para cada tela, trocar o `useState(15)` (ou `useState(10)`) do `itensPorPagina`
por um número diferente, rodar aquele arquivo, ver falhar, reverter.

São cinco plantações, uma por tela. Não vale plantar numa só e presumir as
outras — foi assim que a lista de divergências do MultiSelect ganhou o item 4.

- [ ] **Passo 4: suíte inteira, lint e tsc**

```bash
npm test && npm run lint && npx tsc --noEmit
```

Expected: **91 arquivos**, 1382 + 25 = **1407 testes**, lint ≤ 119, `tsc` limpo.

- [ ] **Passo 5: commit, um por tela**

O histórico do item 1 tem um commit por tela, e este segue o mesmo padrão:

```bash
git add src/pages/Clientes.paginacao.test.tsx
git commit -m "test(clientes): caracteriza a paginacao antes de adotar o primitivo"
```

E assim para Estoque, Servicos, Vendas e Vendedores.

---

### Task 4: `usePaginacao` — o hook, sozinho

**Files:**

- Create: `src/hooks/usePaginacao.ts`
- Test: `src/hooks/usePaginacao.test.ts`

**Interfaces:**

- Consumes: nada.
- Produces:

```ts
export function usePaginacao<T>(
  itens: T[],
  tamanhoDaPagina: number,
): {
  pagina: number; // 1-based
  setPagina: (pagina: number) => void;
  itensDaPagina: T[];
  total: number;
};
```

As Tasks 8 e 9 consomem exatamente esses quatro nomes.

**Por que agora e não junto da adoção:** o hook é peça nova com teste próprio.
Construí-lo aqui deixa a Task 8 sendo só troca de markup, e a Task 9 sendo só a
ligação — cada uma com um motivo só para quebrar.

- [ ] **Passo 1: escrever os testes que falham**

```ts
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePaginacao } from "./usePaginacao";

const LISTA = Array.from({ length: 12 }, (_, i) => `item ${i + 1}`);

describe("usePaginacao", () => {
  it("comeca na primeira pagina e corta pelo tamanho", () => {
    const { result } = renderHook(() => usePaginacao(LISTA, 10));

    expect(result.current.pagina).toBe(1);
    expect(result.current.total).toBe(12);
    expect(result.current.itensDaPagina).toHaveLength(10);
    expect(result.current.itensDaPagina[0]).toBe("item 1");
  });

  it("a ultima pagina traz o resto", () => {
    const { result } = renderHook(() => usePaginacao(LISTA, 10));

    act(() => result.current.setPagina(2));

    expect(result.current.itensDaPagina).toEqual(["item 11", "item 12"]);
  });

  it("volta para a primeira pagina quando a lista muda", () => {
    // O defeito que este hook existe para matar: filtrar de 84 itens para 20
    // deixava a pessoa na pagina 7, com a tabela em branco e o rodape
    // escrevendo "Mostrando 61 a 20 de 20 registros".
    const { result, rerender } = renderHook(
      ({ itens }) => usePaginacao(itens, 10),
      { initialProps: { itens: LISTA } },
    );

    act(() => result.current.setPagina(2));
    expect(result.current.pagina).toBe(2);

    rerender({ itens: LISTA.slice(0, 3) });

    expect(result.current.pagina).toBe(1);
    expect(result.current.itensDaPagina).toHaveLength(3);
  });

  it("nao reseta quando a lista e a MESMA referencia", () => {
    // Sem isto o hook resetaria a cada render e a paginacao ficaria presa
    // na pagina 1 — o defeito oposto, e pior, porque e silencioso.
    const { result, rerender } = renderHook(
      ({ itens }) => usePaginacao(itens, 10),
      { initialProps: { itens: LISTA } },
    );

    act(() => result.current.setPagina(2));
    rerender({ itens: LISTA });

    expect(result.current.pagina).toBe(2);
  });

  it("reseta tambem quando a lista nova tem o MESMO tamanho", () => {
    // Sem este teste, uma implementação com `[itens.length]` na dependência
    // passaria nos outros quatro e ainda assim estaria errada: filtrar pode
    // devolver a mesma quantidade de itens e ser outra lista. É a diferença
    // entre resetar por identidade (certo) e por tamanho (quase certo).
    const OUTRA = Array.from({ length: 12 }, (_, i) => `outro ${i + 1}`);
    const { result, rerender } = renderHook(
      ({ itens }) => usePaginacao(itens, 10),
      { initialProps: { itens: LISTA } },
    );

    act(() => result.current.setPagina(2));
    rerender({ itens: OUTRA });

    expect(result.current.pagina).toBe(1);
    expect(result.current.itensDaPagina[0]).toBe("outro 1");
  });

  it("lista vazia devolve total zero e nenhuma linha", () => {
    const { result } = renderHook(() => usePaginacao([], 10));

    expect(result.current.total).toBe(0);
    expect(result.current.itensDaPagina).toEqual([]);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar pelo motivo certo**

Run: `npx vitest run src/hooks/usePaginacao.test.ts`
Expected: FAIL — `Failed to resolve import "./usePaginacao"`.

- [ ] **Passo 3: implementar**

```ts
import { useEffect, useMemo, useState } from "react";

/**
 * Estado de paginação de uma listagem: a página atual, o corte da lista e o
 * total. Feito para casar com o `Pagination` do design system, que quer
 * `page`, `pageSize`, `total` e `onPageChange`.
 *
 * **Volta para a primeira página quando `itens` muda de referência.** É o
 * conserto de um defeito concreto que estava nas seis telas da Fase 4: quem
 * estava na página 7 de 84 produtos e filtrava para 20 continuava na 7 —
 * `slice(60, 70)` num array de 20 devolve nada, então a tabela ficava em
 * branco, e o rodapé escrevia "Mostrando 61 a 20 de 20 registros", com o
 * intervalo invertido. Pior: o botão Próxima comparava `7 === 2` e seguia
 * habilitado, levando à página 8.
 *
 * **O reset olha a identidade de `itens`, não o tamanho** — filtrar pode
 * devolver a mesma quantidade e ainda assim ser outra lista. Isso impõe um
 * contrato ao chamador: **`itens` precisa vir de um `useMemo`** cujas
 * dependências sejam os filtros. Uma lista remontada a cada render prenderia
 * a paginação na página 1, calada. Nas seis telas isso já era verdade antes
 * do hook existir — todas fazem
 * `useMemo(..., [<listaFiltrada>, pesquisaTabela, ordenacao])`.
 *
 * Resetar ao ordenar é intencional e não é efeito colateral: Contas já fazia
 * isso à mão desde `457e4176`, com nove `setPagina(1)` espalhados pelos
 * pontos de filtro e de ordenação. O hook generaliza a decisão em vez de
 * pedir que cada tela lembre dela.
 */
export function usePaginacao<T>(itens: T[], tamanhoDaPagina: number) {
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    setPagina(1);
  }, [itens]);

  const itensDaPagina = useMemo(() => {
    const inicio = (pagina - 1) * tamanhoDaPagina;
    return itens.slice(inicio, inicio + tamanhoDaPagina);
  }, [itens, pagina, tamanhoDaPagina]);

  return { pagina, setPagina, itensDaPagina, total: itens.length };
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `npx vitest run src/hooks/usePaginacao.test.ts`
Expected: PASS, 5 testes.

- [ ] **Passo 5: provar que os testes enxergam**

Duas plantações, uma por vez, revertendo cada uma:

1. Comentar o `useEffect` do reset. Esperado: falham "volta para a primeira
   pagina quando a lista muda" **e** "reseta tambem quando a lista nova tem o
   MESMO tamanho".
2. Trocar a dependência `[itens]` por `[itens.length]`. Esperado: falha **só**
   "reseta tambem quando a lista nova tem o MESMO tamanho" — e é exatamente
   para isso que esse teste existe.

A segunda plantação é a que importa: sem ela, uma implementação por tamanho
passaria nos outros quatro testes e o hook estaria quase certo, que aqui é o
mesmo que errado.

- [ ] **Passo 6: suíte inteira, lint e tsc**

```bash
npm test && npm run lint && npx tsc --noEmit
```

Expected: **92 arquivos**, 1407 + 6 = **1413 testes**, lint ≤ 119, `tsc` limpo.

`renderHook` está disponível: `@testing-library/react` aqui é **16.3.2**
(conferido em 03/09/2026), e o helper existe desde a 13.1. Não trocar a versão
de nada para fazer esta task passar.

- [ ] **Passo 7: commit**

```bash
git add src/hooks/usePaginacao.ts src/hooks/usePaginacao.test.ts
git commit -m "feat(hooks): usePaginacao com o reset ao trocar de lista"
```

---

### Task 5: Produtos adota o `Pagination`

**Files:**

- Modify: `src/pages/Produtos.tsx` — bloco do rodapé em `983-1086`, e o import
- Test: `src/pages/Produtos.paginacao.test.tsx` (**não editar**, fora as exceções)

**Interfaces:**

- Consumes: `Pagination` de `../design-system/ui` (Task 1), a caracterização da
  Task 2.
- Produces: o molde que a Task 6 repete nas outras cinco.

**As duas exceções autorizadas.** A caracterização da Task 2 passa sem edição,
**menos** nestes dois pontos, escritos no spec antes de começar:

1. `{ name: "Próximo" }` vira `{ name: "Próxima" }` — o rótulo passa a ser o do
   primitivo;
2. nada muda na frase de contagem para Produtos, porque 12 itens já dão duas
   páginas. **A segunda exceção só aparece nas telas cujo fixture couber numa
   página**, e nenhum dos seis fixtures cabe — todos usam `pageSize + 2`. Ou
   seja: **na prática, só a exceção 1 deve ser exercida.**

**Qualquer terceira edição na caracterização significa que a adoção mudou o que
não devia. Pare e reporte em vez de ajustar o teste.**

- [ ] **Passo 1: trocar o rodapé**

Em `src/pages/Produtos.tsx`, apagar o bloco inteiro `{totalPaginas > 1 && ( ...
)}` (linhas 983 a 1086 na medição) e pôr no lugar:

```tsx
{
  /*
            O `Pagination` do design system, e não as 104 linhas que estavam
            aqui. As que saíram escondiam a frase de contagem dentro do
            `{totalPaginas > 1 && ...}`: quem tinha 10 produtos ou menos não
            lia contagem nenhuma. É o mesmo defeito 1.7 que a Fase 1 corrigiu
            em Contas, e ele morre junto com o bloco.
          */
}
<div className="mt-4">
  <Pagination
    page={paginaAtual}
    pageSize={itensPorPagina}
    total={produtosTabela.length}
    itemLabel="produtos"
    onPageChange={setPaginaAtual}
  />
</div>;
```

Acrescentar ao import do design system no topo do arquivo (ou criar a linha se
a tela ainda não importa nada de lá):

```tsx
import { Pagination } from "../design-system/ui";
```

Depois disso, `totalPaginas` fica sem uso. **Apagar a linha** — o lint acusa
variável não usada e o baseline não pode subir.

- [ ] **Passo 2: rodar a caracterização e aplicar SÓ a exceção 1**

Run: `npx vitest run src/pages/Produtos.paginacao.test.tsx`
Expected: FAIL nos três testes que clicam em `{ name: "Próximo" }`.

Trocar `"Próximo"` por `"Próxima"` nessas ocorrências, e **só nelas**. Rodar de
novo: PASS, 5 testes.

Se algo além disso falhar, **parar** e reportar o quê — é o guarda desta fase.

- [ ] **Passo 3: rodar o arquivo de MultiSelect da mesma tela**

Run: `npx vitest run src/pages/Produtos.multiselect.test.tsx`
Expected: PASS sem edição. O rodapé não é o filtro; se este quebrou, a troca
vazou para fora do rodapé.

- [ ] **Passo 4: suíte inteira, lint e tsc**

```bash
npm test && npm run lint && npx tsc --noEmit
```

Expected: 92 arquivos, **1413 testes**, lint **abaixo** de 119 (saíram ~104
linhas de JSX), `tsc` limpo.

- [ ] **Passo 5: commit**

```bash
git add src/pages/Produtos.tsx src/pages/Produtos.paginacao.test.tsx
git commit -m "refactor(produtos): consome o Pagination do design system"
```

---

### Task 6: as outras cinco telas adotam o `Pagination`

**Files:**

- Modify: `src/pages/Clientes.tsx` (rodapé em `1147-1257`)
- Modify: `src/pages/Estoque.tsx` (`1138-1242`)
- Modify: `src/pages/Servicos.tsx` (`1025-1128`)
- Modify: `src/pages/Vendas.tsx` (`1175-1278`)
- Modify: `src/pages/Vendedores.tsx` (`1127-1225`)
- Test: os cinco `<Tela>.paginacao.test.tsx` (**não editar**, fora a exceção 1)

**Interfaces:**

- Consumes: o molde da Task 5, a caracterização da Task 3.
- Produces: `grep -rn "totalPaginas" src/pages/` passa a devolver zero.

As cinco usam o **default** de `itemLabel` — não passar a prop. Só Produtos
passa `"produtos"`.

- [ ] **Passo 1: para cada tela, trocar o rodapé**

Mesmo movimento da Task 5, com os nomes daquela tela. Em Clientes, por exemplo:

```tsx
{
  /*
            O `Pagination` do design system, e não as 111 linhas que estavam
            aqui. As que saíram escondiam a frase de contagem dentro do
            `{totalPaginas > 1 && ...}`: quem tinha 15 clientes ou menos não
            lia contagem nenhuma. É o mesmo defeito 1.7 que a Fase 1 corrigiu
            em Contas, e ele morre junto com o bloco.
          */
}
<div className="mt-4">
  <Pagination
    page={paginaAtual}
    pageSize={itensPorPagina}
    total={clientesTabela.length}
    onPageChange={setPaginaAtual}
  />
</div>;
```

Trocando `clientesTabela` por `produtosTabela` em Estoque, `servicosTabela` em
Serviços e `notasTabela` em Vendas e Vendedores. O import é o mesmo:

```tsx
import { Pagination } from "../design-system/ui";
```

E, nas cinco, apagar o `totalPaginas` que fica sem uso.

- [ ] **Passo 2: por tela, rodar a caracterização e aplicar SÓ a exceção 1**

Run: `npx vitest run src/pages/<Tela>.paginacao.test.tsx`

Trocar `"Próximo"` por `"Próxima"` nas ocorrências que falharem, e só nelas.
Qualquer outra falha: **parar e reportar**.

- [ ] **Passo 3: rodar o MultiSelect de cada uma**

Run: `npx vitest run src/pages/<Tela>.multiselect.test.tsx`
Expected: PASS sem edição, nas cinco.

- [ ] **Passo 4: conferir que não sobrou paginação própria**

```bash
grep -rn "totalPaginas" src/
```

Expected: **nenhuma saída.**

- [ ] **Passo 5: suíte inteira, lint e tsc**

```bash
npm test && npm run lint && npx tsc --noEmit
```

Expected: 92 arquivos, 1413 testes, lint **bem abaixo** de 119 (saíram ~523
linhas de JSX nas cinco), `tsc` limpo.

- [ ] **Passo 6: commit, um por tela**

```bash
git add src/pages/Clientes.tsx src/pages/Clientes.paginacao.test.tsx
git commit -m "refactor(clientes): consome o Pagination do design system"
```

E assim para Estoque, Servicos, Vendas e Vendedores.

---

### Task 7: `TableEmpty` nas seis telas

**Files:**

- Modify: os seis `src/pages/<Tela>.tsx`, no `<tbody>`
- Test: os seis `src/pages/<Tela>.paginacao.test.tsx`, um `it` novo em cada

**Interfaces:**

- Consumes: `TableEmpty` de `../design-system/ui`.
- Produces: com zero resultados, a tabela **diz** que está vazia.

**Por que é obrigatório e não enfeite:** o `Pagination` devolve `null` com
`total` zero. Sem `TableEmpty`, a tela fica literalmente muda no zero — o
cabeçalho da tabela e o nada embaixo. É a metade do contrato do primitivo que
cabe ao consumidor.

Este é o **primeiro conserto** — daqui em diante o comportamento muda de
propósito, e cada mudança vem com plantação.

- [ ] **Passo 1: escrever o teste que falha, em cada uma das seis**

Acrescentar ao `describe` de `<Tela>.paginacao.test.tsx`. Precisa de um render
com lista vazia, então o mock do contexto passa a poder devolver vazio. A forma
mais direta, sem mexer no mock de módulo: um segundo `describe` com o fixture
vazio num arquivo `<Tela>.vazio.test.tsx`? **Não** — em vez disso, usar a
pesquisa da própria tela para esvaziar a lista, que é o caminho real da pessoa:

```tsx
it("com filtro que nao casa nada, a tabela diz que esta vazia", () => {
  render(<Produtos />);

  fireEvent.change(screen.getByPlaceholderText("Pesquisar produto..."), {
    target: { value: "zzzzz-nao-existe" },
  });

  expect(linhasDaTabela()).toHaveLength(1);
  expect(screen.getByText("Nenhum resultado encontrado.")).toBeInTheDocument();
});
```

`linhasDaTabela()` devolve 1 porque o `TableEmpty` **é** um `<tr>`.

O placeholder da busca da tabela muda por tela: Produtos usa
`"Pesquisar produto..."`; as outras cinco usam `"Pesquisar..."` nas duas caixas,
então nelas **escopar pelo container da tabela** em vez de buscar global — o
mesmo cuidado que o teste de MultiSelect documenta. Conferir o placeholder real
de cada tela antes de escrever.

Conferir também o texto exato de `MENSAGEM_VAZIO_PADRAO` em
`src/design-system/ui/data/Table.tsx` e usar esse, não um inventado.

- [ ] **Passo 2: rodar e ver falhar pelo motivo certo**

Run: `npx vitest run src/pages/Produtos.paginacao.test.tsx`
Expected: FAIL — `linhasDaTabela()` devolve `0`, e o texto não existe. É o
defeito 2 do spec, visto de perto: hoje a tela não diz nada.

- [ ] **Passo 3: implementar nas seis**

No `<tbody>` de cada tela, envolver o `.map` existente. Em Produtos:

```tsx
              <tbody>
                {produtosPaginados.length === 0 ? (
                  <TableEmpty colSpan={6} />
                ) : (
                  produtosPaginados.map((produto, index) => (
                    /* ...as linhas como já estão, sem tocar... */
                  ))
                )}
              </tbody>
```

E o import:

```tsx
import { Pagination, TableEmpty } from "../design-system/ui";
```

`colSpan` por tela, da tabela no topo deste plano: Clientes 5, Estoque 7,
Produtos 6, Serviços 6, Vendas 6, Vendedores 7.

- [ ] **Passo 4: rodar e ver passar**

Run: `npm test`
Expected: 92 arquivos, 1413 + 6 = **1419 testes**, verdes.

- [ ] **Passo 5: provar que os seis testes enxergam**

Numa tela por vez, trocar `colSpan={6}` por `colSpan={1}` não quebra nada (o
teste não olha colSpan) — então a plantação certa é **outra**: trocar
`length === 0` por `length === -1`, que desliga o ramo. Rodar aquele arquivo,
ver falhar, reverter. Seis vezes.

- [ ] **Passo 6: lint e tsc**

```bash
npm run lint && npx tsc --noEmit
```

- [ ] **Passo 7: commit, um por tela**

```bash
git add src/pages/Produtos.tsx src/pages/Produtos.paginacao.test.tsx
git commit -m "fix(produtos): a tabela vazia passa a dizer que esta vazia"
```

---

### Task 8: conferir os seis `useMemo` antes de plugar o hook

**Files:**

- Read: os seis `src/pages/<Tela>.tsx`

**Interfaces:**

- Consumes: nada.
- Produces: a certeza de que a Task 9 é segura, ou a lista do que impede.

**Por que é task e não um passo:** é o segundo risco do spec. Se alguma das
seis remontar a lista a cada render, o hook prenderia a paginação na página 1 —
um defeito calado, pior que o que estamos consertando. A medição já viu que os
`useMemo` existem; ver que existem não é ver o que têm na dependência.

- [ ] **Passo 1: para cada tela, ler a declaração da lista da tabela**

```bash
grep -n "const clientesTabela = useMemo" -A 2 src/pages/Clientes.tsx
grep -n "const produtosTabela = useMemo" -A 2 src/pages/Estoque.tsx
grep -n "const produtosTabela = useMemo" -A 2 src/pages/Produtos.tsx
grep -n "const servicosTabela = useMemo" -A 2 src/pages/Servicos.tsx
grep -n "const notasTabela = useMemo" -A 2 src/pages/Vendas.tsx
grep -n "const notasTabela = useMemo" -A 2 src/pages/Vendedores.tsx
```

- [ ] **Passo 2: para cada uma, ler o array de dependências**

Achar a linha `}, [...]);` que fecha cada `useMemo` e conferir que ela lista
`[<listaFiltrada>, pesquisaTabela, ordenacao]`, e que `<listaFiltrada>` é
também um `useMemo` sobre os filtros.

Esperado, pela medição de 03/09: as seis batem. Se alguma **não** bater,
**parar** e reportar antes da Task 9 — o hook não é seguro naquela tela.

- [ ] **Passo 3: registrar o resultado**

Não há commit de código nesta task. O resultado vai na mensagem de conclusão:
"as seis conferidas, todas `useMemo` sobre os filtros" ou a lista das que não.

---

### Task 9: as seis consomem o `usePaginacao`

**Files:**

- Modify: os seis `src/pages/<Tela>.tsx`
- Test: os seis `src/pages/<Tela>.paginacao.test.tsx`, um `it` novo em cada

**Interfaces:**

- Consumes: `usePaginacao` (Task 4), a conferência da Task 8.
- Produces: `grep -rn "paginaAtual" src/pages/` devolve zero; nenhuma das seis
  declara `useState` de página nem `useMemo` de `slice`.

- [ ] **Passo 1: escrever o teste que falha, em cada uma das seis**

```tsx
it("filtrar volta para a primeira pagina", () => {
  // O defeito 3: quem estava na pagina 2 e filtrava continuava na 2, com a
  // tabela em branco e o rodape escrevendo um intervalo invertido — algo
  // como "Mostrando 11 a 3 de 3 produtos".
  render(<Produtos />);

  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(screen.getByText(/Mostrando/)).toHaveTextContent("Mostrando 11 a 12");

  fireEvent.change(screen.getByPlaceholderText("Pesquisar produto..."), {
    target: { value: "Produto 0" },
  });

  expect(screen.getByText(/Mostrando/)).toHaveTextContent("Mostrando 1 a ");
  expect(linhasDaTabela().length).toBeGreaterThan(0);
});
```

Ajustar o termo de busca e o placeholder por tela, de modo que o filtro deixe
**menos de uma página** de resultado — é aí que o defeito aparece.

- [ ] **Passo 2: rodar e ver falhar pelo motivo certo**

Run: `npx vitest run src/pages/Produtos.paginacao.test.tsx`
Expected: FAIL — a frase continua em "Mostrando 11 a ...", e `linhasDaTabela()`
devolve 1 (só o `TableEmpty` da Task 7), porque o `slice` corta fora da lista.

- [ ] **Passo 3: trocar o estado pelo hook, em cada tela**

Apagar, em Produtos:

```tsx
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(10);
  // ...
  const produtosPaginados = useMemo(() => { /* o slice */ }, [...]);
```

E pôr, logo depois da declaração de `produtosTabela`:

```tsx
const {
  pagina: paginaAtual,
  setPagina: setPaginaAtual,
  itensDaPagina: produtosPaginados,
  total: totalDeProdutos,
} = usePaginacao(produtosTabela, 10);
```

Import:

```tsx
import { usePaginacao } from "../hooks/usePaginacao";
```

E, no `Pagination`, `total={totalDeProdutos}` e `pageSize={10}` no lugar de
`produtosTabela.length` e `itensPorPagina`.

Renomear na desestruturação mantém o resto do JSX intocado — é o que faz esta
task ser pequena apesar de tocar seis arquivos.

Por tela, o tamanho é o da tabela no topo: 10 em Produtos, Vendas e
Vendedores; 15 em Clientes, Estoque e Serviços.

- [ ] **Passo 4: rodar e ver passar**

Run: `npm test`
Expected: 92 arquivos, 1419 + 6 = **1425 testes**, verdes.

- [ ] **Passo 5: conferir que o estado próprio sumiu**

```bash
grep -rn "itensPorPagina\|paginaAtual" src/pages/
```

Expected: só as ocorrências dentro da desestruturação do hook (`pagina:
paginaAtual`), nenhuma `useState`.

- [ ] **Passo 6: provar que os seis testes enxergam**

Numa tela por vez, trocar a dependência do `useEffect` do hook não serve — o
hook é compartilhado e quebraria as seis de uma vez, o que não prova nada sobre
cada tela. A plantação certa por tela é passar a lista **não memoizada**:
trocar `usePaginacao(produtosTabela, 10)` por
`usePaginacao([...produtosTabela], 10)`, que remonta a cada render. O teste de
paginação daquela tela tem de falhar (a paginação fica presa na 1). Reverter.

Seis vezes. É também a demonstração do contrato do docblock.

- [ ] **Passo 7: lint e tsc**

```bash
npm run lint && npx tsc --noEmit && TZ=UTC npm test && TZ=America/Sao_Paulo npm test
```

- [ ] **Passo 8: commit, um por tela**

```bash
git add src/pages/Produtos.tsx src/pages/Produtos.paginacao.test.tsx
git commit -m "fix(produtos): filtrar volta para a primeira pagina"
```

---

### Task 10: fechar a conta

**Files:**

- Modify: `docs/superpowers/2026-09-01-multiselect-divergencias.md`
- Modify: `docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md`

- [ ] **Passo 1: conferir os critérios do spec, um por um**

Percorrer a seção "Como se sabe que terminou" do
`2026-09-03-fase-4-pagination-design.md` e responder cada linha com o comando
que a prova, não com "feito":

```bash
grep -rn "totalPaginas" src/            # esperado: vazio
grep -rn "itensPorPagina" src/pages/    # esperado: vazio
npm test && npm run lint && npx tsc --noEmit
```

- [ ] **Passo 2: medir o que saiu**

```bash
git diff --stat main@{u}..HEAD -- src/pages/ 2>/dev/null || git diff --stat HEAD~12..HEAD -- src/pages/
```

Anotar as linhas removidas contra as acrescentadas nas seis telas, para o
documento — a previsão era ~627 de markup mais ~60 de estado.

- [ ] **Passo 3: registrar as divergências novas**

Acrescentar ao `2026-09-01-multiselect-divergencias.md` uma seção com as duas
que este item preservou de propósito e ainda pedem decisão:

- **tamanho de página**: 10 em Produtos, Vendas e Vendedores; 15 em Clientes,
  Estoque e Serviços — hoje fixado em teste nas seis;
- **substantivo da contagem**: "produtos" em Produtos, "registros" nas outras
  cinco e em Contas.

E o que ficou decidido: a forma compacta de celular subiu para o primitivo, e
Contas passou a herdá-la sem ter pedido — item para a conferência no navegador,
que segue pendente desde o item 1.

- [ ] **Passo 4: atualizar o spec que governa**

Na seção de estado do
`docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md`,
registrar o item 2 da Fase 4 como feito, com os números novos da suíte e do
lint.

- [ ] **Passo 5: commit**

```bash
git add docs/
git commit -m "docs: fecha o item 2 da Fase 4 - as seis adotam o Pagination"
```

---

## Depois deste plano

Sobram quatro itens da Fase 4: a exportação para Excel (nove arquivos), o preset
de período (cinco telas com o mesmo defeito), o `useIsMobile` (quatro cópias) e
o clique fora (três implementações, uma diferente das outras). Nenhum tem
primitivo pronto esperando, como este tinha.

E fica pendente, acumulada do item 1, a **conferência no navegador nos dois
temas** — agora com mais uma coisa para olhar: o rodapé compacto que Contas
ganhou sem pedir.
