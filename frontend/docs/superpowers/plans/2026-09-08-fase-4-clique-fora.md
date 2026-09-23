# Item 6 da Fase 4 — o clique fora vira `useCliqueFora`

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para implementar task a task. Os passos usam
> caixa (`- [ ]`) para acompanhamento.

**Objetivo:** as três implementações de clique fora (`MultiSelect`,
`SearchSelect` e os dois popovers do `Estoque`) passam a consumir um hook
único, `src/hooks/useCliqueFora.ts`, e os dois defeitos que a divergência entre
elas denunciava morrem na adoção.

**Arquitetura:** o hook registra `mousedown` e `touchstart` em `document`
enquanto `ativo` for verdadeiro, e chama `aoFechar` quando o alvo do evento
está fora de `ref`. Uma ref por chamada — o Estoque chama duas vezes, uma por
popover. O hook **nasce com o defeito** (só `mousedown`, sempre registrado)
para que a extração seja provadamente inerte; as duas correções entram depois,
cada uma em commit próprio com plantação.

**Stack:** React 18, TypeScript, Vitest + Testing Library (jsdom), Tailwind
3.4.17.

**Spec:** `docs/superpowers/specs/2026-09-08-fase-4-clique-fora-design.md`

## Restrições globais

- Código, comentários, interface e mensagem de commit em **português do
  Brasil**. Commit em conventional commits e **sem acento** na mensagem.
- **Não existe alias `@/` neste repositório.** Importar por caminho relativo
  (`../../hooks/useCliqueFora`). O exemplo do `CLAUDE.md` induz ao erro e
  quebra o `tsc`.
- Baseline a não regredir: **1464 testes / 101 arquivos**, lint em **103
  problemas** (não pode subir), `tsc --noEmit` limpo.
- A suíte tem de passar em `TZ=UTC` **e** em `TZ=America/Sao_Paulo`.
- Comentário no código explica **por que**, com o defeito concreto que a
  decisão evitou. É o estilo do repo.
- Não fazer `push`. O repositório está à frente do `origin` de propósito.
- Uma tela = uma branch = um checkpoint humano.

## Estrutura de arquivos

| Arquivo                                             | Responsabilidade                                                     |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| `src/hooks/useCliqueFora.ts`                        | **Criar.** O hook, e o docblock que explica os dois defeitos.        |
| `src/hooks/useCliqueFora.test.ts`                   | **Criar.** Teste unitário do hook.                                   |
| `src/design-system/ui/forms/SearchSelect.test.tsx`  | **Modificar.** Ganha a caracterização de clique fora que não existe. |
| `src/pages/Estoque.popover.test.tsx`                | **Criar.** Caracterização dos dois popovers de pizza.                |
| `src/design-system/ui/forms/MultiSelect.tsx:91-99`  | **Modificar.** Adota o hook.                                         |
| `src/design-system/ui/forms/SearchSelect.tsx:75-84` | **Modificar.** Adota o hook.                                         |
| `src/pages/Estoque.tsx:109-131`                     | **Modificar.** Adota o hook (duas chamadas) e ganha `Escape`.        |
| `src/test/guarda-clique-fora.test.ts`               | **Criar.** Impede a quarta implementação.                            |

## Ordem, e por que ela é essa

As tasks 1 e 2 escrevem a rede que falta **antes** de qualquer linha se mover.
A task 3 cria o hook já com o defeito. As tasks 4-6 adotam, e são o momento em
que os testes existentes provam que nada mudou. Só então as tasks 7-9 corrigem,
uma correção por task. A 10 tranca.

---

### Task 1: Caracterização do clique fora no `SearchSelect`

O `SearchSelect` tem quatro testes e **nenhum** cobre clique fora. Sem isto, a
task 5 mexe num arquivo sem rede.

**Arquivos:**

- Modificar/Test: `src/design-system/ui/forms/SearchSelect.test.tsx`

**Interfaces:**

- Consome: nada.
- Produz: nada que outra task importe.

- [ ] **Passo 1: escrever o teste que falta**

Acrescentar ao final do `describe("SearchSelect", ...)`, antes do `});` que o
fecha. Note o `fireEvent` no import — o arquivo hoje importa só `render` e
`screen`:

```tsx
it("clicar fora fecha a lista", async () => {
  render(<SearchSelect label="Cliente" options={CLIENTES} searchable />);
  await userEvent.click(screen.getByLabelText("Cliente"));
  expect(screen.getByRole("listbox")).toBeInTheDocument();

  // `mouseDown`, e não `click`: o componente fecha no `mousedown` do
  // documento. `fireEvent.click` não dispara `mousedown`, entao o teste
  // passaria mesmo com o listener removido.
  fireEvent.mouseDown(document.body);

  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});
```

E trocar a primeira linha do arquivo para incluir `fireEvent`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
```

- [ ] **Passo 2: rodar e ver passar**

Roda: `npx vitest run src/design-system/ui/forms/SearchSelect.test.tsx`
Esperado: **PASS**, 5 testes. Ele passa porque o comportamento já existe — é
caracterização, não TDD.

- [ ] **Passo 3: provar que o teste enxerga (plantação)**

Em `src/design-system/ui/forms/SearchSelect.tsx:82`, comentar a linha do
listener:

```tsx
// document.addEventListener("mousedown", aoClicarFora);
```

Roda: `npx vitest run src/design-system/ui/forms/SearchSelect.test.tsx`
Esperado: **FAIL** em "clicar fora fecha a lista", com o `listbox` ainda no
documento.

**Sem esta prova a task não está entregue.**

- [ ] **Passo 4: reverter a plantação**

Roda: `git checkout src/design-system/ui/forms/SearchSelect.tsx`
Roda: `npx vitest run src/design-system/ui/forms/SearchSelect.test.tsx`
Esperado: **PASS**, 5 testes.

- [ ] **Passo 5: commitar**

```bash
git add src/design-system/ui/forms/SearchSelect.test.tsx
git commit -m "test(searchselect): caracteriza o clique fora antes de extrair"
```

---

### Task 2: Caracterização dos dois popovers do `Estoque`

Os popovers de pizza são `Tooltip` do recharts controlados por
`showPizzaDistribuicao` / `showPizzaSituacao`. O mock padrão do repo troca
`Tooltip` por `() => null`, então **o popover nunca renderiza** e um teste
copiado do molde existente não veria nada. Este arquivo precisa de um dublê que
honre `content` e exponha o `onClick` do `PieChart`.

**Arquivos:**

- Criar/Test: `src/pages/Estoque.popover.test.tsx`

**Interfaces:**

- Consome: nada.
- Produz: nada que outra task importe.

- [ ] **Passo 1: escrever o arquivo de teste inteiro**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import Estoque from "./Estoque";

/**
 * Caracterização dos DOIS popovers de pizza de Estoque, antes de o clique
 * fora virar `useCliqueFora` (item 6 da Fase 4).
 *
 * Por que este arquivo tem um dublê de recharts diferente dos outros: nos
 * demais testes de Estoque o `Tooltip` é `() => null`, porque nenhum deles
 * olha para gráfico. Aqui o popover É o `Tooltip` — trocá-lo por `null`
 * apagaria justamente o que se quer observar, e o teste passaria verde sem
 * provar nada. O dublê abaixo chama `content` com `active: true`, que é o
 * que o recharts faz quando o ponteiro está sobre uma fatia; o `content` de
 * Estoque devolve `null` sozinho quando o popover está fechado — é ele quem
 * decide, e é essa decisão que o teste observa.
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
  {
    id: 2,
    nome: "Tubo descartável",
    codigo: "P2",
    unidade: "UN",
    preco: 5,
    saldo: 100,
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

/** O payload que o recharts entregaria ao `content` de uma fatia. Traz os
 *  campos que os DOIS popovers leem: `fullName`/`value` no de distribuição,
 *  `name`/`value`/`percent` no de situação. Um `percent` ausente faria
 *  `(percent * 100).toFixed(0)` estourar dentro do componente. */
const FATIA = {
  payload: [
    {
      payload: {
        fullName: "Bafômetro Phoebus",
        name: "Ativo",
        value: 2500,
        percent: 0.5,
      },
    },
  ],
};

vi.mock("recharts", () => {
  const semDesenho = () => null;
  return {
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    BarChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    LineChart: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    // Expõe o `onClick` que abre o popover no tap. O `data-testid` é costura
    // de teste deliberada: o dublê não reproduz a árvore do recharts, então
    // alcançar o nó por CSS seria alcançar um detalhe do próprio dublê.
    PieChart: ({
      children,
      onClick,
    }: {
      children?: ReactNode;
      onClick?: () => void;
    }) => (
      <div data-testid="pie-chart" onClick={onClick}>
        {children}
      </div>
    ),
    // Chama `content` como o recharts chamaria com o ponteiro sobre a fatia.
    Tooltip: ({
      content,
    }: {
      content?: (p: typeof FATIA & { active: boolean }) => ReactNode;
    }) => (content ? <>{content({ active: true, ...FATIA })}</> : null),
    Bar: semDesenho,
    Line: semDesenho,
    Pie: semDesenho,
    Cell: semDesenho,
    XAxis: semDesenho,
    YAxis: semDesenho,
    CartesianGrid: semDesenho,
    Legend: semDesenho,
  };
});

/** Os dois `PieChart`, na ordem de montagem: [0] é "Distribuição de Valor em
 *  Estoque", [1] é "Situação dos Produtos". */
const DISTRIBUICAO = 0;
const SITUACAO = 1;

describe("Estoque — popovers de pizza", () => {
  it("o popover de distribuicao abre no clique e fecha ao clicar fora", () => {
    render(<Estoque />);
    expect(screen.queryByText("valor: R$ 2.500,00")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByTestId("pie-chart")[DISTRIBUICAO]);
    expect(screen.getByText("valor: R$ 2.500,00")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("valor: R$ 2.500,00")).not.toBeInTheDocument();
  });

  it("o popover de situacao abre no clique e fecha ao clicar fora", () => {
    render(<Estoque />);
    expect(screen.queryByText("Quantidade: 2500")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByTestId("pie-chart")[SITUACAO]);
    expect(screen.getByText("Quantidade: 2500")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Quantidade: 2500")).not.toBeInTheDocument();
  });

  it("tocar fora TAMBEM fecha — o Estoque e a unica das tres que ja acerta", () => {
    render(<Estoque />);
    fireEvent.click(screen.getAllByTestId("pie-chart")[SITUACAO]);
    expect(screen.getByText("Quantidade: 2500")).toBeInTheDocument();

    fireEvent.touchStart(document.body);
    expect(screen.queryByText("Quantidade: 2500")).not.toBeInTheDocument();
  });
});
```

- [ ] **Passo 2: rodar e conferir a ordem dos dois gráficos**

Roda: `npx vitest run src/pages/Estoque.popover.test.tsx`
Esperado: **PASS**, 3 testes.

**Se os dois primeiros falharem trocados** — o de distribuição achando
"Quantidade" e vice-versa —, `DISTRIBUICAO` e `SITUACAO` estão invertidos:
a tela monta "Situação dos Produtos" antes. Troque os dois números e rode de
novo. É a única coisa que este passo pode precisar ajustar.

Se algum texto não aparecer de jeito nenhum, imprima a árvore com
`screen.debug()`: o provável é o `content` do popover estar lendo um campo que
o `FATIA` não traz. O contrato que importa é **clicar no `PieChart` abre,
`mouseDown` no body fecha**.

- [ ] **Passo 3: provar que os testes enxergam (plantação)**

Em `src/pages/Estoque.tsx:124`, comentar a linha do `mousedown`:

```tsx
// document.addEventListener("mousedown", onDocClick);
```

Roda: `npx vitest run src/pages/Estoque.popover.test.tsx`
Esperado: **FAIL** nos dois primeiros testes (o do `touchStart` segue passando,
porque o listener de toque continua registrado — e isso é a prova de que os
dois eventos são observados em separado).

- [ ] **Passo 4: reverter e confirmar**

Roda: `git checkout src/pages/Estoque.tsx`
Roda: `npx vitest run src/pages/Estoque.popover.test.tsx`
Esperado: **PASS**, 3 testes.

- [ ] **Passo 5: commitar**

```bash
git add src/pages/Estoque.popover.test.tsx
git commit -m "test(estoque): caracteriza os dois popovers de pizza antes de extrair"
```

---

### Task 3: O hook, nascendo com o defeito

**Arquivos:**

- Criar: `src/hooks/useCliqueFora.ts`
- Criar/Test: `src/hooks/useCliqueFora.test.ts`

**Interfaces:**

- Consome: nada.
- Produz: `useCliqueFora(ref: RefObject<HTMLElement | null>, aoFechar: () => void, ativo: boolean): void` — as tasks 4, 5 e 6 importam esta assinatura. O terceiro parâmetro **existe desde já e é ignorado** até a task 8; ver o passo 3.

- [ ] **Passo 1: escrever o teste do hook**

```ts
import { fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCliqueFora } from "./useCliqueFora";

/** Monta um elemento no documento e devolve a ref que o aponta.
 *
 *  O elemento fica no `body` até o fim do arquivo: o `cleanup()` de
 *  `src/test/setup.ts` só desmonta o que o Testing Library renderizou, e este
 *  aqui foi posto à mão. Não atrapalha porque cada teste cria o seu e as
 *  asserções olham para `aoFechar`, não para o DOM. */
function refPara(elemento: HTMLElement) {
  document.body.appendChild(elemento);
  return { current: elemento };
}

describe("useCliqueFora", () => {
  it("chama aoFechar quando o mousedown cai fora da ref", () => {
    const dentro = document.createElement("div");
    const aoFechar = vi.fn();
    renderHook(() => useCliqueFora(refPara(dentro), aoFechar, true));

    fireEvent.mouseDown(document.body);

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("NAO chama aoFechar quando o mousedown cai dentro da ref", () => {
    const dentro = document.createElement("div");
    const filho = document.createElement("button");
    dentro.appendChild(filho);
    const aoFechar = vi.fn();
    renderHook(() => useCliqueFora(refPara(dentro), aoFechar, true));

    fireEvent.mouseDown(filho);

    expect(aoFechar).not.toHaveBeenCalled();
  });

  it("desregistra o listener ao desmontar", () => {
    const dentro = document.createElement("div");
    const aoFechar = vi.fn();
    const { unmount } = renderHook(() =>
      useCliqueFora(refPara(dentro), aoFechar, true),
    );

    unmount();
    fireEvent.mouseDown(document.body);

    expect(aoFechar).not.toHaveBeenCalled();
  });

  it("nao quebra quando a ref ainda esta vazia", () => {
    const aoFechar = vi.fn();
    renderHook(() => useCliqueFora({ current: null }, aoFechar, true));

    expect(() => fireEvent.mouseDown(document.body)).not.toThrow();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Roda: `npx vitest run src/hooks/useCliqueFora.test.ts`
Esperado: **FAIL** — `Failed to resolve import "./useCliqueFora"`.

- [ ] **Passo 3: escrever o hook, deliberadamente incompleto**

```ts
import { useEffect, type RefObject } from "react";

/**
 * Fecha um painel quando o clique acontece fora dele.
 *
 * Nasceu do item 6 da Fase 4, que achou TRÊS implementações disto —
 * `MultiSelect`, `SearchSelect` e os dois popovers de `Estoque` — e nenhuma
 * inteira: cada uma acertava o que as outras erravam.
 *
 * **Uma ref por chamada, e não uma lista.** `Estoque` chama duas vezes, uma
 * por popover. Com uma lista, a semântica ficaria ambígua: o alvo dentro de
 * uma ref deveria impedir o fechamento DA OUTRA? Hoje não impede — cada
 * popover é avaliado contra a própria ref —, e uma ref por chamada diz isso
 * sem precisar de `if` duplo.
 *
 * `ativo` é o `aberto` de quem chama. **Ele ainda não faz nada** — entra em
 * vigor na task 8 deste plano. Está na assinatura desde já para que as três
 * adoções (tasks 4, 5 e 6) não precisem ser reescritas depois.
 */
export function useCliqueFora(
  ref: RefObject<HTMLElement | null>,
  aoFechar: () => void,
  ativo: boolean,
): void {
  void ativo;

  useEffect(() => {
    function aoClicarFora(evento: Event) {
      const alvo = evento.target as Node | null;
      if (!alvo) return;
      if (ref.current && !ref.current.contains(alvo)) {
        aoFechar();
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  });
}
```

**Sobre o `useEffect` sem array de dependências:** é deliberado e temporário.
As três implementações de origem usam `[]`, e com `[]` o `aoFechar` congelaria
no primeiro render — o `MultiSelect` passa uma função nova a cada render. Sem
array, o listener é reassinado a cada render, que é caro mas correto. A task 8
troca isto por `[ref, aoFechar, ativo]` com `aoFechar` estabilizado pelo
chamador. Não "consertar" aqui: a task 8 tem a plantação que prova a troca.

- [ ] **Passo 4: rodar e ver passar**

Roda: `npx vitest run src/hooks/useCliqueFora.test.ts`
Esperado: **PASS**, 4 testes.

- [ ] **Passo 5: commitar**

```bash
git add src/hooks/useCliqueFora.ts src/hooks/useCliqueFora.test.ts
git commit -m "feat(hooks): useCliqueFora nasce com o comportamento das tres copias"
```

---

### Task 4: `MultiSelect` adota o hook

**Arquivos:**

- Modificar: `src/design-system/ui/forms/MultiSelect.tsx:91-99`

**Interfaces:**

- Consome: `useCliqueFora(ref, aoFechar, ativo)` da task 3.
- Produz: nada.

- [ ] **Passo 1: trocar o `useEffect` pela chamada do hook**

Apagar o bloco inteiro das linhas 91-99:

```tsx
useEffect(() => {
  function aoClicarFora(evento: MouseEvent) {
    if (
      containerRef.current &&
      !containerRef.current.contains(evento.target as Node)
    ) {
      setAberto(false);
    }
  }
  document.addEventListener("mousedown", aoClicarFora);
  return () => document.removeEventListener("mousedown", aoClicarFora);
}, []);
```

e pôr no lugar:

```tsx
useCliqueFora(containerRef, () => setAberto(false), aberto);
```

Acrescentar o import:

```tsx
import { useCliqueFora } from "../../../hooks/useCliqueFora";
```

**Confira o número de `../`.** O arquivo está em
`src/design-system/ui/forms/`, então são **três** níveis até `src/`. Não use
`@/` — o alias não existe neste repositório.

Se o `useEffect` ficar sem nenhum outro uso no arquivo, tire-o do import do
React; se ainda houver outro, deixe. Rode o lint para saber.

- [ ] **Passo 2: rodar os SETE arquivos que cobrem o `MultiSelect`**

```bash
npx vitest run \
  src/design-system/ui/forms/MultiSelect.test.tsx \
  src/pages/Clientes.multiselect.test.tsx \
  src/pages/Estoque.multiselect.test.tsx \
  src/pages/Produtos.multiselect.test.tsx \
  src/pages/Servicos.multiselect.test.tsx \
  src/pages/Vendas.multiselect.test.tsx \
  src/pages/contas/FiltrosDeContas.multiselect.test.tsx
```

Esperado: **PASS, sem uma única edição em nenhum deles.** É esta a prova de que
a extração foi inerte — o mesmo critério que fechou o item 3, quando os quatro
arquivos que mockavam o `xlsx` passaram intocados.

Se algum falhar, **não edite o teste**. A extração está errada; conserte o
hook ou a adoção.

- [ ] **Passo 3: `tsc` e lint**

Roda: `npx tsc --noEmit`
Esperado: sem saída.

Roda: `npm run lint 2>&1 | tail -3`
Esperado: **103 problemas ou menos.** Não pode subir.

- [ ] **Passo 4: commitar**

```bash
git add src/design-system/ui/forms/MultiSelect.tsx
git commit -m "refactor(multiselect): o clique fora vem de useCliqueFora"
```

---

### Task 5: `SearchSelect` adota o hook

**Arquivos:**

- Modificar: `src/design-system/ui/forms/SearchSelect.tsx:75-84`

**Interfaces:**

- Consome: `useCliqueFora(ref, aoFechar, ativo)` da task 3.
- Produz: nada.

- [ ] **Passo 1: trocar o `useEffect` pela chamada do hook**

Apagar as linhas 75-84:

```tsx
useEffect(() => {
  if (!aberto) return;
  function aoClicarFora(evento: MouseEvent) {
    if (!containerRef.current?.contains(evento.target as Node)) {
      fechar();
    }
  }
  document.addEventListener("mousedown", aoClicarFora);
  return () => document.removeEventListener("mousedown", aoClicarFora);
}, [aberto]);
```

e pôr no lugar:

```tsx
useCliqueFora(containerRef, fechar, aberto);
```

Import:

```tsx
import { useCliqueFora } from "../../../hooks/useCliqueFora";
```

**Atenção a uma diferença real:** o `SearchSelect` é hoje o único que guarda
`if (!aberto) return`. Como o `ativo` do hook ainda é inerte (task 3), esta
troca **muda o comportamento dele**: o listener passa a ficar registrado com a
lista fechada. É regressão consciente e de vida curta — a task 8 devolve o
comportamento a todos os três de uma vez, e é lá que ele fica provado por
teste. Nenhum teste observa isso hoje, então nada fica vermelho.

- [ ] **Passo 2: rodar o teste do `SearchSelect`**

Roda: `npx vitest run src/design-system/ui/forms/SearchSelect.test.tsx`
Esperado: **PASS**, 5 testes — incluindo o que a task 1 escreveu, sem edição.

- [ ] **Passo 3: `tsc` e lint**

Roda: `npx tsc --noEmit`
Esperado: sem saída.

Roda: `npm run lint 2>&1 | tail -3`
Esperado: 103 ou menos.

- [ ] **Passo 4: commitar**

```bash
git add src/design-system/ui/forms/SearchSelect.tsx
git commit -m "refactor(searchselect): o clique fora vem de useCliqueFora"
```

---

### Task 6: `Estoque` adota o hook, duas vezes

**Arquivos:**

- Modificar: `src/pages/Estoque.tsx:108-131`

**Interfaces:**

- Consome: `useCliqueFora(ref, aoFechar, ativo)` da task 3.
- Produz: nada.

- [ ] **Passo 1: trocar o `useEffect` pelas duas chamadas**

Apagar o bloco das linhas 108-131 (o comentário
`// fecha tooltip ao clicar fora`, o `useEffect`, o `onDocClick` e os quatro
`addEventListener`/`removeEventListener`) e pôr no lugar:

```tsx
// Uma chamada por popover: cada um é avaliado contra a própria ref, que é
// o que o `onDocClick` daqui já fazia com dois `if` dentro de um handler só.
useCliqueFora(
  pizzaDistribRef,
  () => setShowPizzaDistribuicao(false),
  showPizzaDistribuicao,
);
useCliqueFora(
  pizzaSituacaoRef,
  () => setShowPizzaSituacao(false),
  showPizzaSituacao,
);
```

Import:

```tsx
import { useCliqueFora } from "../hooks/useCliqueFora";
```

**Aqui são dois `../`** — `src/pages/` está a um nível de `src/`.

**Esta task remove o `touchstart` do Estoque.** É consciente: o Estoque era o
único dos três que o tinha, e a task 7 o devolve — para os três de uma vez.
O terceiro teste da task 2 (`tocar fora TAMBEM fecha`) **vai ficar vermelho
neste ponto e é assim que tem de ser**.

- [ ] **Passo 2: rodar os testes do Estoque**

```bash
npx vitest run src/pages/Estoque.popover.test.tsx \
               src/pages/Estoque.multiselect.test.tsx \
               src/pages/Estoque.paginacao.test.tsx
```

Esperado: os dois primeiros testes de `Estoque.popover` **passam**; o terceiro
(`tocar fora TAMBEM fecha`) **falha**. Os outros dois arquivos passam inteiros.

Confirme que a falha é exatamente essa e só essa. Qualquer outra falha é
defeito da adoção.

- [ ] **Passo 3: marcar a falha esperada**

Para não deixar a suíte vermelha entre dois commits, marque o teste como
`it.skip` com o motivo, e a task 7 o reativa:

```tsx
  // Vermelho de propósito entre as tasks 6 e 7: a adoção do hook tirou o
  // `touchstart` que só o Estoque tinha, e a task 7 o devolve para os três.
  it.skip("tocar fora TAMBEM fecha — o Estoque e a unica das tres que ja acerta", () => {
```

- [ ] **Passo 4: `tsc`, lint e suíte inteira**

Roda: `npx tsc --noEmit`
Esperado: sem saída.

Roda: `npm run lint 2>&1 | tail -3`
Esperado: 103 ou menos.

Roda: `npm test 2>&1 | tail -5`
Esperado: **tudo verde**, com 1 teste pulado.

- [ ] **Passo 5: commitar**

```bash
git add src/pages/Estoque.tsx src/pages/Estoque.popover.test.tsx
git commit -m "refactor(estoque): os dois popovers vem de useCliqueFora"
```

---

### Task 7: O `touchstart` — a correção que dá sentido ao item

Este é o defeito 1 da spec: em `MultiSelect` e `SearchSelect`, tocar fora não
fecha o dropdown. O `MultiSelect` é consumido por sete arquivos, então é
defeito de sete telas.

**Arquivos:**

- Modificar: `src/hooks/useCliqueFora.ts`
- Modificar/Test: `src/hooks/useCliqueFora.test.ts`
- Modificar/Test: `src/design-system/ui/forms/MultiSelect.test.tsx`
- Modificar/Test: `src/pages/Estoque.popover.test.tsx` (reativar o `it.skip`)

- [ ] **Passo 1: escrever os testes que falham**

No `src/hooks/useCliqueFora.test.ts`, acrescentar dentro do `describe`:

```ts
it("chama aoFechar quando o touchstart cai fora da ref", () => {
  const dentro = document.createElement("div");
  const aoFechar = vi.fn();
  renderHook(() => useCliqueFora(refPara(dentro), aoFechar, true));

  fireEvent.touchStart(document.body);

  expect(aoFechar).toHaveBeenCalledTimes(1);
});

it("NAO chama aoFechar quando o touchstart cai dentro da ref", () => {
  const dentro = document.createElement("div");
  const filho = document.createElement("button");
  dentro.appendChild(filho);
  const aoFechar = vi.fn();
  renderHook(() => useCliqueFora(refPara(dentro), aoFechar, true));

  fireEvent.touchStart(filho);

  expect(aoFechar).not.toHaveBeenCalled();
});
```

No `src/design-system/ui/forms/MultiSelect.test.tsx`, acrescentar ao final do
`describe`:

```tsx
it("tocar fora fecha — no celular, mousedown nao vem", () => {
  render(
    <MultiSelect
      rotulo="Produto"
      opcoes={OPCOES}
      selecionados={[]}
      onChange={vi.fn()}
      placeholder="Empresas"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Produto Empresas" }));
  expect(screen.getByPlaceholderText("Pesquisar...")).toBeInTheDocument();

  fireEvent.touchStart(document.body);

  expect(screen.queryByPlaceholderText("Pesquisar...")).not.toBeInTheDocument();
});
```

E em `src/pages/Estoque.popover.test.tsx`, tirar o `.skip` e o comentário que
o explicava.

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/hooks/useCliqueFora.test.ts \
               src/design-system/ui/forms/MultiSelect.test.tsx \
               src/pages/Estoque.popover.test.tsx
```

Esperado: **FAIL** nos três testes novos/reativados — `aoFechar` não foi
chamado, o painel continua aberto, o popover continua no documento.

- [ ] **Passo 3: acrescentar o `touchstart` ao hook**

Em `src/hooks/useCliqueFora.ts`, dentro do `useEffect`, trocar as duas linhas
de registro por:

```ts
document.addEventListener("mousedown", aoClicarFora);
// `touchstart` também: em toque o navegador dispara touchstart → touchend
// → um `click` sintetizado, e `mousedown` não vem. Sem esta linha, tocar
// fora não fechava o dropdown em nenhuma das sete telas que usam o
// `MultiSelect` — o painel ficava por cima do conteúdo até a pessoa tocar
// no gatilho de novo. `passive: true` porque o handler não chama
// `preventDefault`, e sem a flag o navegador segura a rolagem esperando
// para ver se ele chamaria.
document.addEventListener("touchstart", aoClicarFora, { passive: true });
return () => {
  document.removeEventListener("mousedown", aoClicarFora);
  document.removeEventListener("touchstart", aoClicarFora);
};
```

E atualizar o docblock do hook: onde ele diz que nasceu com o comportamento
das três cópias, dizer que o `touchstart` já entrou.

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/hooks/useCliqueFora.test.ts \
               src/design-system/ui/forms/MultiSelect.test.tsx \
               src/pages/Estoque.popover.test.tsx
```

Esperado: **PASS** em todos, e o teste reativado do Estoque volta a passar sem
edição — o `touchstart` que ele tinha perdido na task 6 voltou pelo hook.

- [ ] **Passo 5: suíte inteira, nos dois fusos**

```bash
TZ=UTC npm test 2>&1 | tail -4
TZ=America/Sao_Paulo npm test 2>&1 | tail -4
```

Esperado: verde nos dois, **nenhum teste pulado**.

- [ ] **Passo 6: commitar**

```bash
git add src/hooks/useCliqueFora.ts src/hooks/useCliqueFora.test.ts \
        src/design-system/ui/forms/MultiSelect.test.tsx \
        src/pages/Estoque.popover.test.tsx
git commit -m "fix(clique-fora): tocar fora fecha o dropdown no celular"
```

---

### Task 8: O `ativo` passa a valer

Defeito 2 da spec: o listener fica registrado com o painel fechado. Cinco telas
montam três `MultiSelect` cada; como no máximo um painel fica aberto por vez,
pelo menos dois handlers sempre rodam `contains` à toa a cada `mousedown` da
página.

**Arquivos:**

- Modificar: `src/hooks/useCliqueFora.ts`
- Modificar/Test: `src/hooks/useCliqueFora.test.ts`

- [ ] **Passo 1: escrever o teste que falha**

```ts
it("nao registra listener nenhum enquanto ativo for falso", () => {
  const dentro = document.createElement("div");
  const aoFechar = vi.fn();
  const registrar = vi.spyOn(document, "addEventListener");

  renderHook(() => useCliqueFora(refPara(dentro), aoFechar, false));

  const registrados = registrar.mock.calls.map(([evento]) => evento);
  expect(registrados).not.toContain("mousedown");
  expect(registrados).not.toContain("touchstart");

  fireEvent.mouseDown(document.body);
  expect(aoFechar).not.toHaveBeenCalled();

  registrar.mockRestore();
});
```

- [ ] **Passo 2: rodar e ver falhar**

Roda: `npx vitest run src/hooks/useCliqueFora.test.ts`
Esperado: **FAIL** — `registrados` contém `"mousedown"`, e `aoFechar` foi
chamado.

- [ ] **Passo 3: fazer o `ativo` valer, e fechar o array de dependências**

Substituir o corpo do hook por:

```ts
export function useCliqueFora(
  ref: RefObject<HTMLElement | null>,
  aoFechar: () => void,
  ativo: boolean,
): void {
  // `aoFechar` guardado em ref para que o efeito não dependa dele: os
  // chamadores passam arrow inline (`() => setAberto(false)`), que é função
  // nova a cada render. Com ela no array, o listener seria desregistrado e
  // registrado de novo a cada render — que é o que a primeira versão deste
  // hook fazia, sem array nenhum.
  const aoFecharRef = useRef(aoFechar);
  useEffect(() => {
    aoFecharRef.current = aoFechar;
  });

  useEffect(() => {
    if (!ativo) return;

    function aoClicarFora(evento: Event) {
      const alvo = evento.target as Node | null;
      if (!alvo) return;
      if (ref.current && !ref.current.contains(alvo)) {
        aoFecharRef.current();
      }
    }

    document.addEventListener("mousedown", aoClicarFora);
    // `touchstart` também: em toque o navegador dispara touchstart → touchend
    // → um `click` sintetizado, e `mousedown` não vem. Sem esta linha, tocar
    // fora não fechava o dropdown em nenhuma das sete telas que usam o
    // `MultiSelect`. `passive: true` porque o handler não chama
    // `preventDefault`.
    document.addEventListener("touchstart", aoClicarFora, { passive: true });
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("touchstart", aoClicarFora);
    };
  }, [ativo, ref]);
}
```

Trocar o import para `import { useEffect, useRef, type RefObject } from "react";`
e apagar o `void ativo;` e o parágrafo do docblock que dizia que `ativo` ainda
não fazia nada.

- [ ] **Passo 4: rodar e ver passar**

Roda: `npx vitest run src/hooks/useCliqueFora.test.ts`
Esperado: **PASS**, 7 testes.

- [ ] **Passo 5: rodar tudo que consome o hook**

```bash
npx vitest run src/design-system/ui/forms/MultiSelect.test.tsx \
               src/design-system/ui/forms/SearchSelect.test.tsx \
               src/pages/Estoque.popover.test.tsx \
               src/pages/Clientes.multiselect.test.tsx \
               src/pages/Estoque.multiselect.test.tsx \
               src/pages/Produtos.multiselect.test.tsx \
               src/pages/Servicos.multiselect.test.tsx \
               src/pages/Vendas.multiselect.test.tsx \
               src/pages/contas/FiltrosDeContas.multiselect.test.tsx
```

Esperado: **PASS** em todos, sem edição.

- [ ] **Passo 6: commitar**

```bash
git add src/hooks/useCliqueFora.ts src/hooks/useCliqueFora.test.ts
git commit -m "perf(clique-fora): o listener so existe enquanto o painel esta aberto"
```

---

### Task 9: `Escape` fecha os popovers do Estoque

O único ponto em que o `Escape` falta. Os dois primitivos já tratam, por
`onKeyDown` no container, e é a forma certa — não mexer neles.

**Arquivos:**

- Modificar: `src/pages/Estoque.tsx`
- Modificar/Test: `src/pages/Estoque.popover.test.tsx`

- [ ] **Passo 1: escrever os testes que falham**

Em `src/pages/Estoque.popover.test.tsx`, dentro do `describe`:

```tsx
/** O container com `ref={pizza*Ref}` e `className="relative"` — é ele que
 *  leva o `onKeyDown`. No dublê a árvore é
 *  `div.relative > div (ResponsiveContainer) > div[data-testid=pie-chart]`,
 *  então o container é o avô do gráfico. */
function containerDo(indice: number) {
  return screen.getAllByTestId("pie-chart")[indice].parentElement!
    .parentElement!;
}

it("Escape fecha o popover de distribuicao", () => {
  render(<Estoque />);
  fireEvent.click(screen.getAllByTestId("pie-chart")[DISTRIBUICAO]);
  expect(screen.getByText("valor: R$ 2.500,00")).toBeInTheDocument();

  fireEvent.keyDown(containerDo(DISTRIBUICAO), { key: "Escape" });

  expect(screen.queryByText("valor: R$ 2.500,00")).not.toBeInTheDocument();
});

it("Escape fecha o popover de situacao", () => {
  render(<Estoque />);
  fireEvent.click(screen.getAllByTestId("pie-chart")[SITUACAO]);
  expect(screen.getByText("Quantidade: 2500")).toBeInTheDocument();

  fireEvent.keyDown(containerDo(SITUACAO), { key: "Escape" });

  expect(screen.queryByText("Quantidade: 2500")).not.toBeInTheDocument();
});
```

A função `containerDo` vai **fora** do `describe`, junto das constantes
`DISTRIBUICAO` e `SITUACAO` que a task 2 criou. Se a contagem de
`parentElement` não bater, confira a árvore com `screen.debug()` — ela depende
de quantos níveis o dublê do `ResponsiveContainer` acrescenta.

- [ ] **Passo 2: rodar e ver falhar**

Roda: `npx vitest run src/pages/Estoque.popover.test.tsx`
Esperado: **FAIL** nos dois — o popover continua no documento.

- [ ] **Passo 3: acrescentar o `onKeyDown` nos dois containers**

No container do primeiro popover (`Estoque.tsx`, a `div` com
`ref={pizzaDistribRef}`), acrescentar `tabIndex` e `onKeyDown`:

```tsx
              <div
                ref={pizzaDistribRef}
                tabIndex={-1}
                onKeyDown={(e) => e.key === "Escape" && setShowPizzaDistribuicao(false)}
                onMouseLeave={() => setShowPizzaDistribuicao(false)}
                className="relative"
              >
```

E no segundo (`ref={pizzaSituacaoRef}`):

```tsx
              <div
                ref={pizzaSituacaoRef}
                tabIndex={-1}
                onKeyDown={(e) => e.key === "Escape" && setShowPizzaSituacao(false)}
                onMouseLeave={() => setShowPizzaSituacao(false)}
                className="relative"
              >
```

O `tabIndex={-1}` faz a `div` poder receber foco por programa sem entrar na
ordem de tabulação — sem ele, o `keydown` só chegaria se o foco estivesse num
filho focável, e o gráfico não tem nenhum.

- [ ] **Passo 4: rodar e ver passar**

Roda: `npx vitest run src/pages/Estoque.popover.test.tsx`
Esperado: **PASS**, 5 testes.

- [ ] **Passo 5: `tsc`, lint e suíte**

Roda: `npx tsc --noEmit` → sem saída
Roda: `npm run lint 2>&1 | tail -3` → 103 ou menos
Roda: `npm test 2>&1 | tail -4` → verde

- [ ] **Passo 6: commitar**

```bash
git add src/pages/Estoque.tsx src/pages/Estoque.popover.test.tsx
git commit -m "fix(estoque): Escape fecha os dois popovers de pizza"
```

---

### Task 10: O guarda

Impede a quarta implementação de nascer, que é exatamente a porta por onde as
três entraram.

**Arquivos:**

- Criar/Test: `src/test/guarda-clique-fora.test.ts`

- [ ] **Passo 1: escrever o guarda**

```ts
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guarda de repositório do clique fora.
 *
 * O item 6 da Fase 4 achou TRÊS implementações de "fecha quando clica fora",
 * e nenhuma inteira: só o `Estoque` escutava `touchstart` (sem ele, tocar
 * fora não fechava o dropdown em sete telas), e só o `SearchSelect`
 * desmontava o listener com o painel fechado. As três entraram pela mesma
 * porta — alguém copiou uma tela que já tinha uma — e é essa porta que este
 * guarda fecha.
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

/** O único arquivo que pode registrar clique/toque no documento. */
const DONO = "src/hooks/useCliqueFora.ts";

/** Linha que só CITA o evento em comentário não é infração — vários arquivos
 *  explicam o defeito justamente para dizer o que deixaram de ter, e acusar
 *  o comentário faria alguém apagá-lo para o teste passar. */
function registrosEm(caminho: string): string[] {
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
      if (/addEventListener\(\s*["'](mousedown|touchstart)["']/.test(linha)) {
        achados.push(`${i + 1}: ${semEspaco}`);
      }
    });
  return achados;
}

describe("guarda do clique fora", () => {
  it("so o useCliqueFora registra mousedown ou touchstart no documento", () => {
    const infratores: string[] = [];
    for (const caminho of arquivosDeCodigo) {
      if (caminho === DONO) continue;
      for (const achado of registrosEm(caminho)) {
        infratores.push(`${caminho}: ${achado}`);
      }
    }
    expect(infratores).toEqual([]);
  });

  it("o dono registra os DOIS eventos — o touchstart e o defeito que o item corrigiu", () => {
    const fonte = readFileSync(DONO, "utf8");
    expect(fonte).toContain('addEventListener("mousedown"');
    expect(fonte).toContain('addEventListener("touchstart"');
  });
});
```

- [ ] **Passo 2: rodar e ver passar**

Roda: `npx vitest run src/test/guarda-clique-fora.test.ts`
Esperado: **PASS**, 2 testes.

Se o primeiro falhar, leia os infratores: ou sobrou uma adoção por fazer, ou
apareceu um arquivo que este plano não previu. **Não acrescente exceção** —
o guarda está certo.

- [ ] **Passo 3: provar que o guarda enxerga (plantação dupla)**

Primeiro: em `src/pages/Estoque.tsx`, acrescentar uma linha solta dentro de
qualquer `useEffect`:

```tsx
document.addEventListener("mousedown", () => {});
```

Roda: `npx vitest run src/test/guarda-clique-fora.test.ts`
Esperado: **FAIL** no primeiro teste, apontando `src/pages/Estoque.tsx`.

Reverter: `git checkout src/pages/Estoque.tsx`

Segundo: em `src/hooks/useCliqueFora.ts`, comentar a linha do `touchstart`.

Roda: `npx vitest run src/test/guarda-clique-fora.test.ts`
Esperado: **FAIL** no segundo teste.

Reverter: `git checkout src/hooks/useCliqueFora.ts`

- [ ] **Passo 4: suíte inteira nos dois fusos**

```bash
TZ=UTC npm test 2>&1 | tail -4
TZ=America/Sao_Paulo npm test 2>&1 | tail -4
npx tsc --noEmit
npm run lint 2>&1 | tail -3
```

Esperado: verde nos dois fusos, `tsc` sem saída, lint em 103 ou menos.

- [ ] **Passo 5: commitar**

```bash
git add src/test/guarda-clique-fora.test.ts
git commit -m "test(guarda): trava a quarta implementacao de clique fora"
```

---

### Task 11: Fechar o item na documentação

**Arquivos:**

- Modificar: `docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md`

- [ ] **Passo 1: medir de verdade, antes de escrever**

```bash
git log --oneline $(git merge-base main HEAD)..HEAD | wc -l
git diff --stat $(git merge-base main HEAD)..HEAD | tail -1
npm test 2>&1 | grep -E "Test Files|Tests  "
npm run lint 2>&1 | tail -2
grep -rn 'addEventListener("mousedown"' src --include=*.ts --include=*.tsx | grep -v ".test."
```

**Meça antes de os commits desta task entrarem** — é o cuidado que faltou no
item 3 e teve de ser emendado.

- [ ] **Passo 2: escrever a seção do item 6**

Acrescentar `### Item 6 da Fase 4 — o clique fora fechado (08/09/2026)` depois
da seção do item 4, no molde das anteriores: o que se repetia, os dois
defeitos, a investigação do `Escape` que não confirmou nada, e os números
medidos no passo 1.

Atualizar a tabela "Onde tudo está": Fase 4 passa a **5 de 6**, e o que falta é
só o `useIsMobile`.

Acrescentar à conferência no navegador o quarto item: **abrir um filtro no
celular e tocar fora** — a jsdom sintetiza `touchstart` sem `TouchEvent` real,
então nenhum teste deste plano prova comportamento de navegador.

- [ ] **Passo 3: commitar**

```bash
git add docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md
git commit -m "docs: fecha o item 6 da Fase 4 - o clique fora vira useCliqueFora"
```

---

## Como se sabe que terminou

- `grep -rn 'addEventListener("mousedown"' src` (fora de teste) devolve **só**
  `src/hooks/useCliqueFora.ts`
- `guarda-clique-fora` verde, provado por plantação dupla
- Os sete arquivos que já cobriam o `MultiSelect` passaram **sem edição** na
  task 4
- `SearchSelect` e os dois popovers do Estoque têm caracterização própria
- Suíte verde em `TZ=UTC` e `TZ=America/Sao_Paulo`, sem teste pulado
- Lint **não subiu** de 103; `tsc --noEmit` limpo
- A conferência no navegador ganhou o quarto item registrado
- **Nada de `push`** — o checkpoint é humano
