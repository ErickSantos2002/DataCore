# Item 5 da Fase 4 — o `useIsMobile` vira hook

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para implementar task a task. Os passos usam
> caixa (`- [ ]`) para acompanhamento.

**Objetivo:** as quatro cópias de `useIsMobile` deixam de existir. `Produtos`, que
não pergunta nada sobre a largura da janela, só apaga; `Clientes`, `Estoque` e
`Vendas` passam a consumir `src/hooks/useIsMobile.ts`. As quatro leituras inline
de `window.innerWidth` — uma em `Clientes`, três em `Vendas` — morrem junto, e o
primeiro render deixa de mentir em celular.

**Atenção a uma correção que o pre-flight scan fez neste plano.** A primeira
versão mandava apagar o hook de `Vendas` junto com o de `Produtos`, porque o lint
acusa as duas com `'isMobile' is assigned a value but never used`. Isso estava
errado: `Vendas.tsx:824-827` lê `window.innerWidth` **três vezes** dentro do
`YAxis` do gráfico. A tela usa a informação, só que por fora do hook e sem reagir
a `resize`. `Vendas` **adota**; só `Produtos` apaga.

**Arquitetura:** hook em `src/hooks/`, ao lado de `usePaginacao.ts` e
`useCliqueFora.ts`, com o breakpoint como constante nomeada. Escuta `resize`,
como as cópias — **não** `matchMedia`. O hook **nasce com `useState(false)`**,
igual às cópias, para que a caracterização passe sem edição; o estado inicial
correto entra depois, em commit próprio, com plantação.

**Stack:** React 18, TypeScript, Vitest + Testing Library (jsdom), Tailwind
3.4.17.

**Spec:** `docs/superpowers/specs/2026-09-08-fase-4-useismobile-design.md`

## Restrições globais

- Código, comentários e mensagem de commit em **português do Brasil**. Commit em
  conventional commits e **sem acento** na mensagem. Comentários no código
  **podem e devem** ter acento.
- **Não existe alias `@/` neste repositório.** Importar por caminho relativo. O
  exemplo do `CLAUDE.md` induz ao erro e quebra o `tsc`.
- Baseline de entrada: **1482 testes / 104 arquivos**, zero pulados; lint em
  **103 problemas**; `tsc --noEmit` limpo.
- **O lint tem de CAIR de 103 para 101**, e não pode subir em nenhuma task. É o
  único item da Fase 4 com número previsto antes de começar. Cai em dois
  momentos: **102 ao fim da Task 2** (`Produtos` apaga) e **101 ao fim da Task 5**
  (`Vendas` passa a usar o `isMobile` que já declara).
- A suíte tem de passar em `TZ=UTC` **e** em `TZ=America/Sao_Paulo`.
- Comentário no código explica **por quê**, com o defeito concreto que a decisão
  evitou.
- Não fazer `push` nem merge. O checkpoint é humano.

## Estrutura de arquivos

| Arquivo                                | Responsabilidade                                                  |
| -------------------------------------- | ----------------------------------------------------------------- |
| `src/hooks/useIsMobile.ts`             | **Criar.** O hook e a constante do breakpoint.                    |
| `src/hooks/useIsMobile.test.ts`        | **Criar.** Teste unitário do hook.                                |
| `src/pages/Clientes.mobile.test.tsx`   | **Criar.** Caracterização do que `isMobile` controla em Clientes. |
| `src/pages/Estoque.mobile.test.tsx`    | **Criar.** Caracterização do que `isMobile` controla em Estoque.  |
| `src/pages/Produtos.tsx:91-102,108`    | **Modificar.** Apaga a cópia morta.                               |
| `src/pages/Vendas.mobile.test.tsx`     | **Criar.** Caracterização do que `isMobile` controla em Vendas.   |
| `src/pages/Vendas.tsx:100-111,824-827` | **Modificar.** Adota o hook e mata as três leituras inline.       |
| `src/pages/Clientes.tsx:72-81,830`     | **Modificar.** Adota o hook e mata o `isMobileW`.                 |
| `src/pages/Estoque.tsx:71-85`          | **Modificar.** Adota o hook.                                      |
| `src/test/guarda-usemobile.test.ts`    | **Criar.** Impede a próxima cópia, hook ou leitura solta.         |

## Ordem, e por que ela é essa

A Task 1 escreve a rede, que hoje é **zero**, para as três telas que usam a
informação — inclusive `Vendas`, onde ela caracteriza o **defeito**: o gráfico
que não acompanha o `resize`. A Task 2 apaga a cópia morta de `Produtos`, sozinha,
porque o critério dela é diferente de todas: o lint tem de cair.

As Tasks 3 e 4 extraem e adotam, com o hook nascendo igual às cópias. A Task 5
mata as quatro leituras inline — uma em `Clientes`, três em `Vendas` — e é a
única do plano em que **editar um teste é o certo**, porque a asserção que
registrava o defeito passa a registrar o acerto. A Task 6 corrige o primeiro
render. A 7 tranca, a 8 fecha a Fase 4.

**O lint cai em dois momentos, não um:** 103 → 102 na Task 2, quando `Produtos`
apaga; 102 → 101 na Task 5, quando `Vendas` finalmente usa o `isMobile` que
declara desde sempre.

---

### Task 1: A rede, que hoje não existe

`grep -rln "isMobile\|innerWidth"` nos testes devolve **nenhum**. Nada observa
este comportamento. E tudo que `isMobile` controla está dentro do recharts, que
os testes mockam com `() => null` — um teste copiado do molde existente não veria
nada.

**Arquivos:**

- Criar/Test: `src/pages/Clientes.mobile.test.tsx`
- Criar/Test: `src/pages/Estoque.mobile.test.tsx`
- Criar/Test: `src/pages/Vendas.mobile.test.tsx`

**Interfaces:**

- Consome: nada.
- Produz: as constantes `DISTRIBUICAO`/`SITUACAO` não existem aqui; cada arquivo
  é independente. A Task 5 volta a `Clientes.mobile.test.tsx` e a
  `Vendas.mobile.test.tsx`.

- [ ] **Passo 1: escrever `src/pages/Clientes.mobile.test.tsx`**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Clientes from "./Clientes";

/**
 * Caracterização do que `isMobile` controla em Clientes, antes de a cópia local
 * virar `src/hooks/useIsMobile.ts` (item 5 da Fase 4).
 *
 * Por que este arquivo tem um dublê de recharts diferente dos outros testes de
 * Clientes: nos demais o `ResponsiveContainer` é `<div>{children}</div>`, que
 * joga fora as props. Aqui a prop `height` É o que se quer observar — ela vale
 * 420 em celular e 300 no resto —, então o dublê a expõe num atributo. Com o
 * dublê comum, este teste passaria verde sem provar nada.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const CLIENTES_ENRIQUECIDOS = [
  {
    id: 1,
    nome: "Alfa Mineração",
    cpf_cnpj: "11.222.333/0001-44",
    email: "contato@alfa.com",
    fone: "81999990000",
    totalComprado: 1000,
    numeroCompras: 1,
    ultimaCompra: new Date("2026-01-10"),
    status: "ativo" as const,
    ticketMedio: 1000,
  },
];

const NOTAS = [
  {
    id: 1,
    numero: 1001,
    data_emissao: "2026-01-10",
    valor_nota: 1000,
    valor_produtos: 1000,
    cliente: { id: 1, nome: "Alfa Mineração", cpf_cnpj: "11.222.333/0001-44" },
    nome_vendedor: "Vendedor A",
    tipo: null,
    itens: [
      {
        codigo: "P1",
        descricao: "Bafômetro Phoebus",
        quantidade: "2",
        valor_total: "1000",
      },
    ],
    observacoes: null,
  },
];

vi.mock("../context/DataContext", () => ({
  useData: () => ({
    notas: NOTAS,
    clientes: CLIENTES_ENRIQUECIDOS,
    carregando: false,
  }),
}));

vi.mock("recharts", () => {
  const semDesenho = () => null;
  return {
    // Expõe `height` — é a prop que `isMobile` controla, e o dublê dos outros
    // arquivos a descartaria.
    ResponsiveContainer: ({
      children,
      height,
    }: {
      children?: ReactNode;
      height?: number;
    }) => (
      <div data-testid="grafico" data-height={String(height)}>
        {children}
      </div>
    ),
    BarChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    LineChart: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    PieChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
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

/** A jsdom fixa `innerWidth` em 1024. A propriedade é gravável, então o teste
 *  ajusta e dispara o `resize` à mão. **Restaurar é obrigatório**: `innerWidth`
 *  é global, e um teste que o deixa em 375 contamina todos os seguintes do
 *  arquivo de um jeito difícil de rastrear. */
const LARGURA_ORIGINAL = window.innerWidth;

function redimensionarPara(largura: number) {
  Object.defineProperty(window, "innerWidth", {
    value: largura,
    writable: true,
    configurable: true,
  });
  fireEvent(window, new Event("resize"));
}

afterEach(() => {
  Object.defineProperty(window, "innerWidth", {
    value: LARGURA_ORIGINAL,
    writable: true,
    configurable: true,
  });
});

describe("Clientes — o que muda em tela pequena", () => {
  it("o grafico e mais alto em celular do que no desktop", () => {
    render(<Clientes />);
    // 1024 na jsdom: desktop.
    expect(screen.getAllByTestId("grafico")[0]).toHaveAttribute(
      "data-height",
      "300",
    );

    redimensionarPara(375);

    expect(screen.getAllByTestId("grafico")[0]).toHaveAttribute(
      "data-height",
      "420",
    );
  });

  it("voltar para o desktop devolve a altura menor", () => {
    render(<Clientes />);
    redimensionarPara(375);
    expect(screen.getAllByTestId("grafico")[0]).toHaveAttribute(
      "data-height",
      "420",
    );

    redimensionarPara(1024);

    expect(screen.getAllByTestId("grafico")[0]).toHaveAttribute(
      "data-height",
      "300",
    );
  });

  it("639 e celular e 640 nao — o limite e exclusivo", () => {
    render(<Clientes />);

    redimensionarPara(639);
    expect(screen.getAllByTestId("grafico")[0]).toHaveAttribute(
      "data-height",
      "420",
    );

    redimensionarPara(640);
    expect(screen.getAllByTestId("grafico")[0]).toHaveAttribute(
      "data-height",
      "300",
    );
  });
});
```

**Se `getAllByTestId("grafico")[0]` não for o gráfico certo**, use
`screen.debug()` para ver quantos `ResponsiveContainer` a tela monta e ajuste o
índice. O contrato que importa é: **estreitar a janela aumenta a altura de 300
para 420**.

- [ ] **Passo 2: rodar e ver passar**

Roda: `npx vitest run src/pages/Clientes.mobile.test.tsx`
Esperado: **PASS**, 3 testes. É caracterização — o comportamento já existe.

- [ ] **Passo 3: escrever `src/pages/Estoque.mobile.test.tsx`**

**Não mexa no `Estoque.popover.test.tsx`.** O dublê de `Tooltip` dele devolve um
fragment (`<>...</>`), e envolvê-lo num `<div>` para publicar uma prop
acrescentaria um nó à árvore de um arquivo com **seis testes já passando** —
inclusive um que sobe `parentElement` duas vezes. Arquivo novo custa menos e é
simétrico ao do `Clientes`.

O `Estoque` tem o mesmo `<ResponsiveContainer height={isMobile ? 420 : 300}>` na
linha 588, então o alvo é o mesmo:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Estoque from "./Estoque";

/**
 * Caracterização do que `isMobile` controla em Estoque, antes de a cópia local
 * virar `src/hooks/useIsMobile.ts` (item 5 da Fase 4).
 *
 * Arquivo separado do `Estoque.popover.test.tsx` de propósito: lá o dublê de
 * `Tooltip` devolve um fragment, e publicar uma prop exigiria envolvê-lo num
 * elemento — o que muda a árvore que os testes de lá percorrem, um deles
 * subindo `parentElement` duas vezes. Aqui o dublê expõe o `height` do
 * `ResponsiveContainer`, que é a prop que `isMobile` controla.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const PRODUTOS_ESTOQUE = [
  {
    id: 1,
    nome: "Bafômetro Phoebus",
    codigo: "1.163",
    unidade: "UN",
    preco: 250,
    saldo: 10,
    situacao: "A" as const,
  },
];

vi.mock("../context/EstoqueContext", () => ({
  useEstoque: () => ({
    produtos: PRODUTOS_ESTOQUE,
    carregando: false,
    atualizarProdutos: vi.fn(),
  }),
}));

vi.mock("recharts", () => {
  const semDesenho = () => null;
  return {
    ResponsiveContainer: ({
      children,
      height,
    }: {
      children?: ReactNode;
      height?: number;
    }) => (
      <div data-testid="grafico" data-height={String(height)}>
        {children}
      </div>
    ),
    BarChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    LineChart: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    PieChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
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

const LARGURA_ORIGINAL = window.innerWidth;

function redimensionarPara(largura: number) {
  Object.defineProperty(window, "innerWidth", {
    value: largura,
    writable: true,
    configurable: true,
  });
  fireEvent(window, new Event("resize"));
}

afterEach(() => {
  Object.defineProperty(window, "innerWidth", {
    value: LARGURA_ORIGINAL,
    writable: true,
    configurable: true,
  });
});

describe("Estoque — o que muda em tela pequena", () => {
  it("o grafico e mais alto em celular do que no desktop", () => {
    render(<Estoque />);
    expect(screen.getAllByTestId("grafico")[0]).toHaveAttribute(
      "data-height",
      "300",
    );

    redimensionarPara(375);

    expect(screen.getAllByTestId("grafico")[0]).toHaveAttribute(
      "data-height",
      "420",
    );
  });

  it("639 e celular e 640 nao — o limite e exclusivo", () => {
    render(<Estoque />);

    redimensionarPara(639);
    expect(screen.getAllByTestId("grafico")[0]).toHaveAttribute(
      "data-height",
      "420",
    );

    redimensionarPara(640);
    expect(screen.getAllByTestId("grafico")[0]).toHaveAttribute(
      "data-height",
      "300",
    );
  });
});
```

**O `Estoque` monta vários `ResponsiveContainer`** (o de barras mais os dois de
pizza). Se o índice `[0]` não for o que tem `height` variável, use
`screen.debug()` e ajuste — só um deles usa `isMobile`, os das pizzas são fixos
em 300.

- [ ] **Passo 4: escrever `src/pages/Vendas.mobile.test.tsx`**

`Vendas` é diferente das outras duas: ela **não** usa `isMobile`, e sim três
`window.innerWidth` soltos em `Vendas.tsx:824-827`, dentro do `YAxis`. O que se
caracteriza aqui é justamente **que o gráfico não acompanha o `resize`** — porque
a Task 5 vai mudar isso, e o teste é o que torna a mudança visível.

Copie o molde do `Estoque.mobile.test.tsx` do passo 3 (os mesmos `redimensionarPara`
e `afterEach`), trocando os mocks pelos de `Vendas` — veja quais em
`src/pages/Vendas.multiselect.test.tsx`, que já monta a tela. O dublê expõe o
`YAxis`, que é onde as três leituras vivem:

```tsx
    YAxis: ({ width, tick }: { width?: number; tick?: { fontSize?: number } }) => (
      <div data-testid="eixo-y" data-width={String(width)} data-fonte={String(tick?.fontSize)} />
    ),
```

E o teste:

```tsx
it("hoje o eixo NAO acompanha o resize — as tres leituras sao do render", () => {
  render(<Vendas />);
  const eixo = () => screen.getAllByTestId("eixo-y")[0];
  expect(eixo()).toHaveAttribute("data-width", "140");

  redimensionarPara(375);

  // Caracterização do defeito, não do acerto: as três leituras de
  // `window.innerWidth` em Vendas.tsx:824-827 são avaliadas no render do
  // gráfico e nada as faz recalcular. A task 5 troca por `isMobile` e este
  // teste passa a afirmar o contrário.
  expect(eixo()).toHaveAttribute("data-width", "140");
});

it("montando ja estreito, o eixo sai compacto", () => {
  redimensionarPara(375);
  render(<Vendas />);

  // Provando que 80 é alcançável: a leitura acontece no render, então a
  // largura sai certa quando a janela já está estreita na montagem. É a
  // assimetria que a task 5 elimina.
  expect(screen.getAllByTestId("eixo-y")[0]).toHaveAttribute(
    "data-width",
    "80",
  );
});
```

**Se o segundo teste falhar**, o `redimensionarPara` antes do `render` não está
surtindo efeito — confira se o `Object.defineProperty` roda antes de `render` e
use `screen.debug()`. O contrato é: **montar estreito dá 80; estreitar depois de
montado não muda nada** — e é essa segunda metade que a Task 5 conserta.

- [ ] **Passo 5: rodar os três arquivos novos**

```bash
npx vitest run src/pages/Clientes.mobile.test.tsx \
               src/pages/Estoque.mobile.test.tsx \
               src/pages/Vendas.mobile.test.tsx
```

Esperado: **PASS** — 3 no primeiro, 2 no segundo, 2 no terceiro.

- [ ] **Passo 6: provar que os testes enxergam (plantação)**

Em `src/pages/Clientes.tsx:75`, troque o comparador para nunca dar verdadeiro:

```tsx
const onResize = () => setIsMobile(false);
```

Roda: `npx vitest run src/pages/Clientes.mobile.test.tsx`
Esperado: **FAIL** nos três — a altura fica em 300 mesmo a 375px.

Reverta: `git checkout src/pages/Clientes.tsx`

Repita em `src/pages/Estoque.tsx:76` — lá o handler é multi-linha e a atribuição
tem o comentário do emoji na mesma linha. Troque para:

```tsx
setIsMobile(false); // 🔹 abaixo de 640px = mobile
```

Roda: `npx vitest run src/pages/Estoque.mobile.test.tsx`
Esperado: **FAIL** nos dois. Reverta com `git checkout src/pages/Estoque.tsx`.

**Sem esta prova a task não está entregue.** Cole as duas saídas no relatório.

- [ ] **Passo 7: `tsc`, lint e commit**

Roda: `npx tsc --noEmit` → sem saída
Roda: `npm run lint 2>&1 | tail -3` → **103 ou menos**

```bash
git add src/pages/Clientes.mobile.test.tsx src/pages/Estoque.mobile.test.tsx
git commit -m "test(mobile): caracteriza o que muda em tela pequena antes de extrair"
```

---

### Task 2: Apagar o código morto

**Esta task é a única do plano com um número exigido: o lint tem de cair 2.**

`Produtos` declara o hook e nunca usa o valor. O lint acusa —
`'isMobile' is assigned a value but never used` em `Produtos.tsx:108` — e esse
aviso faz parte dos 103.

**Só `Produtos` entra nesta task.** `Vendas` tem o mesmo aviso de lint e **não**
deve ser apagada: ela lê `window.innerWidth` três vezes nas linhas 824-827, então
usa a informação por fora do hook. Ela adota na Task 4. Se você se pegar apagando
o `useIsMobile` de `Vendas`, pare — o aviso de lint dela some por outro caminho.

**Arquivos:**

- Modificar: `src/pages/Produtos.tsx:91-102` e `:108`

**Interfaces:**

- Consome: nada.
- Produz: nada.

- [ ] **Passo 1: anotar o lint de antes**

Roda: `npm run lint 2>&1 | grep -c "isMobile"`
Esperado: **2**.

Roda: `npm run lint 2>&1 | grep problems`
Anote o número — é o ponto de partida (103).

- [ ] **Passo 2: apagar de `Produtos`**

Apague o bloco inteiro das linhas 91-102:

```tsx
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
};
```

E apague a linha 108, dentro do componente:

```tsx
const isMobile = useIsMobile();
```

Deixe a linha em branco que a cercava sem duplicar.

- [ ] **Passo 3: limpar os imports que ficarem órfãos**

`useState` e `useEffect` podem ter ficado sem uso em `Produtos.tsx` — **ou não**,
porque a tela tem outros. **Confira no arquivo real** e no lint; não presuma
nenhum dos dois casos.

**Não toque em `Vendas.tsx` nesta task.**

- [ ] **Passo 4: rodar tudo e conferir o número**

```bash
npx tsc --noEmit
npm run lint 2>&1 | grep problems
npm test 2>&1 | grep -E "Test Files|Tests "
```

Esperado:

- `tsc` sem saída
- lint em **102** — cai exatamente 1 nesta task. O outro ponto cai na Task 4,
  quando `Vendas` passar a usar o `isMobile` que hoje ignora. Se continuar em 103,
  a cópia não foi apagada de verdade.
- suíte verde, zero pulados, com os testes que a Task 1 acrescentou

Roda: `npm run lint 2>&1 | grep -c "isMobile"` → **1** (só o de `Vendas`, que a
Task 4 resolve)

- [ ] **Passo 5: commitar**

```bash
git add src/pages/Produtos.tsx
git commit -m "refactor(produtos): apaga o useIsMobile que a tela nunca usou"
```

---

### Task 3: O hook, nascendo igual às cópias

**Arquivos:**

- Criar: `src/hooks/useIsMobile.ts`
- Criar/Test: `src/hooks/useIsMobile.test.ts`

**Interfaces:**

- Consome: nada.
- Produz: `useIsMobile(): boolean` e a constante `LARGURA_DE_CELULAR = 640` — as Tasks 4 e 5 importam o hook; a constante é exportada para o teste e para quem precisar do mesmo limite.

- [ ] **Passo 1: escrever o teste**

```ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LARGURA_DE_CELULAR, useIsMobile } from "./useIsMobile";

const LARGURA_ORIGINAL = window.innerWidth;

function definirLargura(largura: number) {
  Object.defineProperty(window, "innerWidth", {
    value: largura,
    writable: true,
    configurable: true,
  });
}

/** `innerWidth` é global: um teste que o deixa em 375 contamina os seguintes. */
afterEach(() => definirLargura(LARGURA_ORIGINAL));

describe("useIsMobile", () => {
  it("diz que nao e celular numa janela larga", () => {
    definirLargura(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("passa a dizer que e celular quando a janela encolhe", () => {
    definirLargura(1024);
    const { result } = renderHook(() => useIsMobile());

    act(() => {
      definirLargura(375);
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toBe(true);
  });

  it("o limite e exclusivo: abaixo dele e celular, nele nao", () => {
    definirLargura(1024);
    const { result } = renderHook(() => useIsMobile());

    act(() => {
      definirLargura(LARGURA_DE_CELULAR - 1);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(true);

    act(() => {
      definirLargura(LARGURA_DE_CELULAR);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(false);
  });

  it("desregistra o listener ao desmontar", () => {
    definirLargura(1024);
    const tirarListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useIsMobile());

    unmount();

    // Espiar o `removeEventListener` é o único jeito de provar isto. A forma
    // óbvia — desmontar, disparar `resize` e afirmar que `result.current`
    // continua `false` — **não prova nada**: depois do `unmount` o React
    // descarta em silêncio qualquer `setState` de um fiber desmontado, então
    // aquela asserção passa com ou sem o cleanup. Foi assim que a primeira
    // versão deste teste nasceu vazia.
    expect(tirarListener).toHaveBeenCalledWith("resize", expect.any(Function));

    tirarListener.mockRestore();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Roda: `npx vitest run src/hooks/useIsMobile.test.ts`
Esperado: **FAIL** — `Failed to resolve import "./useIsMobile"`.

- [ ] **Passo 3: escrever o hook, com o defeito do primeiro render**

```ts
import { useEffect, useState } from "react";

/** O `sm` do Tailwind. Estava cravado como `640` em cinco lugares — quatro
 *  cópias deste hook e mais um `window.innerWidth < 640` solto dentro do
 *  tooltip de `Clientes` —, sempre como literal sem nome. Se um dia divergir do
 *  `tailwind.config.js`, é por aqui que alguém descobre. */
export const LARGURA_DE_CELULAR = 640;

/**
 * Responde se a janela está em largura de celular, e reage a `resize`.
 *
 * Nasceu do item 5 da Fase 4, que achou QUATRO cópias disto — `Clientes`,
 * `Estoque`, `Produtos` e `Vendas` — funcionalmente idênticas. Ao contrário do
 * `useCliqueFora`, aqui as cópias não discordavam entre si: o defeito estava no
 * uso.
 *
 * `Produtos` e `Vendas` declaravam o hook e nunca liam o valor, e o lint acusava
 * as duas do mesmo jeito — mas o problema delas era diferente. `Produtos` não
 * perguntava nada sobre a largura da janela; `Vendas` perguntava três vezes, com
 * `window.innerWidth` solto dentro do gráfico, sem reagir a `resize`. `Clientes`
 * fazia o mesmo, uma vez. **A variável não usada era o sintoma; a pergunta era
 * quem precisa da resposta.**
 *
 * **Começa em `false`, e isso é defeito conhecido.** Em celular o primeiro
 * render é sempre o de desktop, e só o efeito corrige. Está assim de propósito
 * até a task 6 deste plano: as quatro cópias faziam igual, e o hook precisa
 * nascer idêntico a elas para a caracterização passar sem edição.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const aoRedimensionar = () =>
      setIsMobile(window.innerWidth < LARGURA_DE_CELULAR);
    aoRedimensionar();
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);

  return isMobile;
}
```

**Não "conserte" o `useState(false)` aqui.** A task 6 o faz, com plantação.

- [ ] **Passo 4: rodar e ver passar**

Roda: `npx vitest run src/hooks/useIsMobile.test.ts`
Esperado: **PASS**, 4 testes.

- [ ] **Passo 5: commitar**

```bash
git add src/hooks/useIsMobile.ts src/hooks/useIsMobile.test.ts
git commit -m "feat(hooks): useIsMobile nasce com o comportamento das quatro copias"
```

---

### Task 4: `Clientes`, `Estoque` e `Vendas` adotam

**Arquivos:**

- Modificar: `src/pages/Clientes.tsx:72-81` e a chamada
- Modificar: `src/pages/Estoque.tsx:71-85` e a chamada
- Modificar: `src/pages/Vendas.tsx:100-111` (a chamada da linha 123 **fica**)

**Interfaces:**

- Consome: `useIsMobile()` da Task 3.
- Produz: nada.

- [ ] **Passo 1: `Clientes` adota**

Apague o bloco das linhas 72-81:

```tsx
const useIsMobile = () => {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
};
```

Acrescente o import — `Clientes.tsx` está em `src/pages/`, então é **um** nível:

```tsx
import { useIsMobile } from "../hooks/useIsMobile";
```

A chamada `const isMobile = useIsMobile();` dentro do componente **fica como
está** — o nome do hook é o mesmo, só a origem muda.

**Não mexa no `isMobileW` da linha ~830 nesta task.** Ele é a Task 5, separada de
propósito.

- [ ] **Passo 2: `Estoque` adota**

Apague o bloco das linhas 71-85 (o de `Estoque` tem o emoji `🔹` no comentário e
some junto), acrescente o mesmo import de um nível, e deixe a chamada.

- [ ] **Passo 3: `Vendas` adota**

Apague o bloco das linhas 100-111 (o de `Vendas` tem o comentário
`// roda na montagem` na chamada de `handleResize()`) e acrescente o mesmo import
de um nível.

**A chamada `const isMobile = useIsMobile();` da linha 123 fica** — ela hoje
existe e não é usada, e é justamente ela que passa a ter uso na Task 5. Não a
apague por parecer órfã: o aviso de lint dela é o segundo dos dois que este item
promete derrubar, e ele some quando a Task 5 trocar as três leituras inline.

**Cuidado:** em `Vendas` a linha 123 vem depois da função `parseData`, não
imediatamente depois de `useData()`.

**Não mexa nas linhas 824-827 nesta task.** São a Task 5.

- [ ] **Passo 4: limpar imports órfãos**

`useState`/`useEffect` (ou `React.useState` em `Clientes`) podem ter ficado sem
uso. **Confira no arquivo real e no lint**, nos três.

- [ ] **Passo 5: os testes têm de passar SEM EDIÇÃO**

```bash
npx vitest run src/pages/Clientes.mobile.test.tsx \
               src/pages/Clientes.multiselect.test.tsx \
               src/pages/Clientes.paginacao.test.tsx \
               src/pages/Clientes.periodo.test.tsx \
               src/pages/Estoque.mobile.test.tsx \
               src/pages/Estoque.popover.test.tsx \
               src/pages/Estoque.multiselect.test.tsx \
               src/pages/Estoque.paginacao.test.tsx \
               src/pages/Vendas.mobile.test.tsx \
               src/pages/Vendas.multiselect.test.tsx \
               src/pages/Vendas.paginacao.test.tsx \
               src/pages/Vendas.periodo.test.tsx
```

Esperado: **PASS em todos, sem uma edição.** É a prova de que a extração foi
inerte.

**Uma exceção prevista:** o teste de `Vendas.mobile.test.tsx` que a Task 1
escreveu para caracterizar as três leituras inline **continua passando aqui**,
porque elas ainda estão lá — a Task 5 é que as troca. Se ele falhar nesta task,
você mexeu nas linhas 824-827 sem querer.

Se algum outro falhar, **não edite o teste** — a adoção está errada. Se concluir
que o teste é que está errado, pare e reporte BLOCKED.

- [ ] **Passo 6: `tsc`, lint e commit**

Roda: `npx tsc --noEmit` → sem saída
Roda: `npm run lint 2>&1 | grep problems` → **102** (ainda não caiu o segundo; a
Task 5 o derruba)

```bash
git add src/pages/Clientes.tsx src/pages/Estoque.tsx src/pages/Vendas.tsx
git commit -m "refactor(telas): o isMobile das tres telas vem de hooks/useIsMobile"
```

---

### Task 5: As quatro leituras inline morrem

`Clientes.tsx:830` tem `const isMobileW = window.innerWidth < 640;` dentro do
`content` do tooltip — com o `isMobile` do hook no escopo, usado a sessenta
linhas dali. Mesma pergunta, duas respostas, no mesmo componente. E a de baixo
não reage a `resize`: é lida no instante em que o tooltip renderiza.

**Arquivos:**

- Modificar: `src/pages/Clientes.tsx` (a linha do `isMobileW` e os dois usos)
- Modificar/Test: `src/pages/Clientes.mobile.test.tsx`

- [ ] **Passo 1: escrever o teste que falha**

O tooltip só renderiza quando o dublê chama o `content`. O dublê do passo 1 da
Task 1 usa `Tooltip: semDesenho`, então **troque-o** para chamar o `content`,
como o `Estoque.popover.test.tsx` faz:

```tsx
    Tooltip: ({ content }: { content?: (p: never) => ReactNode }) =>
      content
        ? content({
            active: true,
            payload: [{ payload: { nomeCompleto: "Alfa Mineração", valor: 1000 } }],
          } as never)
        : null,
```

E acrescente ao `describe`:

```tsx
it("a largura do tooltip acompanha o resize, como o resto da tela", () => {
  render(<Clientes />);
  const tooltip = () => screen.getByText("Alfa Mineração").closest("div")!;
  expect(tooltip()).toHaveStyle({ maxWidth: "280px" });

  redimensionarPara(375);

  // Antes desta task o valor saía de um `window.innerWidth` lido no render do
  // tooltip, e não do `isMobile` do hook: a tela toda reagia ao resize e só
  // esta caixa ficava para trás.
  expect(tooltip()).toHaveStyle({ maxWidth: "220px" });
});
```

- [ ] **Passo 2: rodar e ver o teste novo**

Roda: `npx vitest run src/pages/Clientes.mobile.test.tsx`

**Atenção:** este teste pode **passar** já antes da correção, porque o tooltip
remonta a cada render e acaba lendo o `innerWidth` novo. Se passar, o teste não
prova a diferença — e nesse caso **diga isso no relatório** e ajuste: force o
cenário em que o tooltip **não** remonta, ou troque o alvo para uma asserção que
distinga de fato. Se não conseguir, registre no relatório que a correção é de
consistência e não tem teste que a distinga, e siga — mas não invente um teste
que passa dos dois jeitos.

- [ ] **Passo 3: matar o `isMobileW`**

Apague a linha:

```tsx
const isMobileW = window.innerWidth < 640;
```

e troque os dois usos (`maxWidth: isMobileW ? 220 : 280` e
`fontSize: isMobileW ? "12px" : "13px"`) por `isMobile`.

- [ ] **Passo 4: matar as três leituras de `Vendas`**

`Vendas.tsx:824-827`, dentro do `YAxis` do gráfico. A tela tem `isMobile` no
escopo desde a linha 123 e o ignora três vezes:

```tsx
                  width={window.innerWidth < 640 ? 80 : 140} // 🔥 mais compacto no mobile
                  tick={{ fontSize: window.innerWidth < 640 ? 9 : 12 }}
                  tickFormatter={(name: string) =>
                    window.innerWidth < 640
                      ? name.length > 8 ? `${name.substring(0, 8)}...` : name
                      : name.length > 15 ? `${name.substring(0, 15)}...` : name
                  }
```

Troque as três por `isMobile`. **Isto muda comportamento, e é para mudar:** hoje
as três são lidas no render do gráfico e não reagem a `resize` — quem estreita a
janela vê o eixo continuar com 140px e a fonte em 12. Depois, o gráfico acompanha.

O teste de `Vendas.mobile.test.tsx` que a Task 1 escreveu para caracterizar isso
**tem de mudar de resultado aqui**: ele registrava que o eixo não acompanhava.
Atualize-o para afirmar que agora acompanha, e **diga no relatório** qual asserção
mudou e por quê — é a única task deste plano em que editar um teste é o certo, e
por isso ela exige justificativa escrita.

- [ ] **Passo 5: rodar e conferir o número do lint**

```bash
npx vitest run src/pages/Clientes.mobile.test.tsx src/pages/Vendas.mobile.test.tsx
npx tsc --noEmit
npm run lint 2>&1 | grep problems
npm run lint 2>&1 | grep -c "isMobile"
```

Esperado: PASS; `tsc` limpo; **lint em 101** — os dois pontos prometidos caíram; e
o `grep -c "isMobile"` em **0**, porque `Vendas` passou a usar o valor.

- [ ] **Passo 6: commitar**

Dois commits, um por tela — as duas correções são independentes:

```bash
git add src/pages/Clientes.tsx src/pages/Clientes.mobile.test.tsx
git commit -m "fix(clientes): a largura do tooltip sai do mesmo isMobile da tela"

git add src/pages/Vendas.tsx src/pages/Vendas.mobile.test.tsx
git commit -m "fix(vendas): o eixo do grafico passa a acompanhar o resize"
```

---

### Task 6: O primeiro render deixa de mentir

Defeito 3 da spec. As quatro cópias começavam em `false`, então em celular o
primeiro render era sempre o de desktop: o gráfico monta com 300px e salta para
420, junto com a fonte dos eixos e a largura do tooltip. No `Estoque` muda também
o `trigger` do popover, então por um instante a tela responde ao gesto errado.

**Arquivos:**

- Modificar: `src/hooks/useIsMobile.ts`
- Modificar/Test: `src/hooks/useIsMobile.test.ts`

- [ ] **Passo 1: escrever o teste que falha**

```ts
it("ja nasce sabendo, sem esperar o efeito", () => {
  definirLargura(375);
  const { result } = renderHook(() => useIsMobile());

  // Sem `act` e sem disparar `resize`: o valor tem de estar certo no PRIMEIRO
  // render. Com `useState(false)` isto falha, porque o efeito só corrige
  // depois da montagem — e é esse intervalo que faz o grafico saltar de 300
  // para 420 em celular.
  expect(result.current).toBe(true);
});
```

- [ ] **Passo 2: rodar e ver falhar**

Roda: `npx vitest run src/hooks/useIsMobile.test.ts`
Esperado: **FAIL** — `expected false to be true`.

Se este teste **passar** antes da correção, o `renderHook` já está processando o
efeito antes de você ler `result.current`. Nesse caso, troque o alvo: renderize
um componente que registre os valores de cada render num array e afirme que o
**primeiro** já é `true`. Não siga com um teste que passa dos dois jeitos.

- [ ] **Passo 3: corrigir o estado inicial**

Troque:

```ts
const [isMobile, setIsMobile] = useState(false);
```

por:

```ts
const [isMobile, setIsMobile] = useState(
  () => window.innerWidth < LARGURA_DE_CELULAR,
);
```

E atualize o docblock: apague o parágrafo que diz que o hook **começa em `false`
de propósito até a task 6** e escreva no lugar por que o inicializador existe —
o salto de 300 para 420 que ele evita — e por que é seguro aqui: `src/main.tsx`
usa `createRoot` puro, sem hidratação, e não há SSR no `vite.config.ts`, então
`window` existe no primeiro render. **Registre também que num projeto com SSR
esta linha quebraria o build do servidor**, que é a razão de o padrão
`useState(false)` existir no mundo.

- [ ] **Passo 4: rodar e ver passar**

Roda: `npx vitest run src/hooks/useIsMobile.test.ts`
Esperado: **PASS**, 5 testes.

- [ ] **Passo 5: a suíte inteira, nos dois fusos**

```bash
TZ=UTC npm test 2>&1 | tail -4
TZ=America/Sao_Paulo npm test 2>&1 | tail -4
```

Esperado: verde nos dois, zero pulados.

**Se algum teste de tela quebrar aqui, leia com cuidado antes de mexer.** Um
teste que montava assumindo `isMobile === false` no primeiro render passa a ver
o valor certo. Isso é o comportamento desejado; o teste é que estava apoiado no
defeito. Nesse caso **conserte o teste**, e registre no relatório qual era e por
que ele dependia do valor errado.

- [ ] **Passo 6: commitar**

```bash
git add src/hooks/useIsMobile.ts src/hooks/useIsMobile.test.ts
git commit -m "fix(usemobile): o primeiro render ja sabe se e celular"
```

---

### Task 7: O guarda

**Arquivos:**

- Criar/Test: `src/test/guarda-usemobile.test.ts`

- [ ] **Passo 1: escrever o guarda**

```ts
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guarda de repositório do `useIsMobile`.
 *
 * O item 5 da Fase 4 achou QUATRO cópias deste hook e mais uma quinta resposta
 * inline — `const isMobileW = window.innerWidth < 640` dentro do tooltip de
 * `Clientes`, na mesma tela que já tinha o hook no escopo. Foi assim que a
 * quinta nasceu, e é essa porta que este guarda fecha: qualquer leitura de
 * `window.innerWidth` fora do dono é cópia nova, seja hook ou linha solta.
 */

const arquivosDeCodigo = readdirSync("src", {
  recursive: true,
  encoding: "utf8",
})
  .filter(
    (c) =>
      /\.tsx?$/.test(c) && !c.endsWith(".test.tsx") && !c.endsWith(".test.ts"),
  )
  .map((c) => `src/${c}`);

/** O único arquivo que pode ler a largura da janela. */
const DONO = "src/hooks/useIsMobile.ts";

/** Linha que só CITA `innerWidth` em comentário não é infração — o próprio
 *  docblock do dono e o desta spec falam do defeito para explicar o que
 *  deixaram de ter. Acusar o comentário faria alguém apagá-lo para o teste
 *  passar, e o repositório perderia a explicação. */
function leiturasEm(caminho: string): string[] {
  const achados: string[] = [];
  readFileSync(caminho, "utf8")
    .split("\n")
    .forEach((linha, i) => {
      const semEspaco = linha.trim();
      const eComentario =
        semEspaco.startsWith("//") ||
        semEspaco.startsWith("*") ||
        semEspaco.startsWith("/*");
      if (eComentario) return;
      if (/window\.innerWidth/.test(linha)) {
        achados.push(`${i + 1}: ${semEspaco}`);
      }
    });
  return achados;
}

describe("guarda do useIsMobile", () => {
  it("so o useIsMobile le window.innerWidth", () => {
    const infratores: string[] = [];
    for (const caminho of arquivosDeCodigo) {
      if (caminho === DONO) continue;
      for (const achado of leiturasEm(caminho)) {
        infratores.push(`${caminho}: ${achado}`);
      }
    }
    expect(infratores).toEqual([]);
  });

  it("o dono le a largura em codigo, e nao so em comentario", () => {
    // Usa a MESMA função que varre os outros arquivos, e não uma busca de
    // substring no texto cru: no item 6 esse atalho deixou passar quem
    // comentasse a linha protegida, e custou um fix round.
    expect(leiturasEm(DONO).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Passo 2: rodar e ver passar**

Roda: `npx vitest run src/test/guarda-usemobile.test.ts`
Esperado: **PASS**, 2 testes.

Se o primeiro falhar, leia os infratores: sobrou adoção por fazer, ou apareceu um
arquivo que este plano não previu. **Não acrescente exceção** — nessa família de
guardas, lista de isenção só encolhe.

- [ ] **Passo 3: plantação dupla**

1. Acrescente `const x = window.innerWidth < 640;` em qualquer ponto de
   `src/pages/Clientes.tsx`. Roda o guarda → **FAIL** no primeiro teste,
   apontando o arquivo. Reverta: `git checkout src/pages/Clientes.tsx`
2. **Comente** a linha do `window.innerWidth` em `src/hooks/useIsMobile.ts`
   (prefixe com `//`). Roda o guarda → **FAIL** no segundo teste. Reverta.

A segunda metade é a lição do item 6: lá o teste equivalente usava substring
crua e **não** falhava com a linha comentada. Aqui tem de falhar. Cole as duas
saídas.

- [ ] **Passo 4: suíte nos dois fusos e commit**

```bash
TZ=UTC npm test 2>&1 | tail -4
TZ=America/Sao_Paulo npm test 2>&1 | tail -4
npx tsc --noEmit
npm run lint 2>&1 | grep problems
```

```bash
git add src/test/guarda-usemobile.test.ts
git commit -m "test(guarda): trava a sexta copia do useIsMobile"
```

---

### Task 8: Fechar a Fase 4 na documentação

**Arquivos:**

- Modificar: `docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md`

- [ ] **Passo 1: medir, antes de os commits desta task entrarem**

```bash
git log --oneline $(git merge-base main HEAD)..HEAD | wc -l
git diff --stat $(git merge-base main HEAD)..HEAD | tail -1
npm test 2>&1 | grep -E "Test Files|Tests "
npm run lint 2>&1 | grep problems
grep -rn "window.innerWidth" src --include=*.ts --include=*.tsx | grep -v ".test."
grep -rn "const useIsMobile" src/pages/
ls src/test/guarda-*.test.ts | wc -l
```

Os dois `grep` do meio têm de devolver **só o hook** e **nada**,
respectivamente.

**Atenção:** esta branch nasceu de `fase-4-clique-fora`, não da `main`. Se o item
6 ainda não foi mergeado, `git merge-base main HEAD` aponta para antes dele e a
medição inclui os dois itens. **Meça também contra o início desta branch** e
registre os dois números, dizendo qual é qual:

```bash
git diff --stat fase-4-clique-fora..HEAD | tail -1
```

- [ ] **Passo 2: escrever a seção**

Acrescente `### Item 5 da Fase 4 — o useIsMobile fechado (08/09/2026)` depois da
seção do item 6, no molde das anteriores. Precisa registrar:

- que o item **não era o que o documento dizia** — "quatro cópias de doze linhas"
  e "extração mecânica sem defeito escondido" estavam incompletos: duas das
  quatro telas não usavam o valor, e o lint já acusava isso;
- que a resposta certa nessas duas foi **apagar, não extrair**;
- a quinta implementação inline do `Clientes`, e que ela não reagia a `resize`;
- o primeiro render que mentia, com o salto de 300 para 420 que ele causava;
- **o número do lint**, que era previsto antes de começar — o primeiro item da
  fase com essa propriedade.

- [ ] **Passo 3: fechar a Fase 4 na tabela**

Na tabela "Onde tudo está": **Fase 4 passa a 6 de 6 — fechada.** A linha deixa de
listar pendência.

Acrescente o que a fase entregou somada: `MultiSelect`, `Pagination`,
`baixarPlanilha`, `periodo`, `useCliqueFora` e `useIsMobile` — e que as seis
telas da Fase 3 chegam agora sem bloco duplicado para carregar.

- [ ] **Passo 4: apontar a Fase 3, com a fila remedida**

A Fase 3 volta a ser a frente, por **Produtos** (990 linhas, 87 `dark:`, 126
usos de paleta crua). Registre que a remedição de 08/09 confirmou a fila de
agosto — Produtos a menor, Vendas a maior —, o que já está escrito na seção do
item 6 e agora vira a próxima ação.

- [ ] **Passo 5: commitar**

```bash
git add docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md
git commit -m "docs: fecha o item 5 e a Fase 4 inteira"
```

---

## Como se sabe que terminou

- `grep -rn "window.innerWidth" src` fora de teste devolve **só**
  `src/hooks/useIsMobile.ts`
- `grep -rn "const useIsMobile" src/pages/` devolve **zero**
- **Lint em 101 ou menos** — caiu pelo menos 2, como previsto antes de começar
- `guarda-usemobile` verde, provado por plantação dupla, e a asserção sobre o
  dono falha com a linha **comentada** (a lição do item 6)
- Os testes de `Clientes` e `Estoque` que já existiam passaram sem edição na
  Task 4
- Suíte verde em `TZ=UTC` e `TZ=America/Sao_Paulo`, zero pulados
- `tsc --noEmit` limpo
- **Fase 4 fechada, 6 de 6**
- **Nada de `push`, nada de merge** — o checkpoint é humano
