# Fase 4, item 1 — o `MultiSelect` vira primitivo

> **Para quem executa:** use `superpowers:subagent-driven-development` ou
> `superpowers:executing-plans` para tocar tarefa a tarefa. Os passos usam
> caixa (`- [ ]`) para marcar progresso.

**Objetivo:** tirar as 737 linhas de `MultiSelect` copiadas em seis telas e
pôr um primitivo no lugar, sem mudar o que qualquer uma das seis faz hoje.

**Arquitetura:** o primitivo nasce no design system com a API superset —
`opcoes: { valor, rotulo }[]`, que cobre os dois formatos de hoje. As quatro
buscas divergentes viram **estratégias nomeadas**, passadas por prop, do mesmo
jeito que o `DialetoDeContas` carregou as divergências das gêmeas. Cada tela
passa a sua estratégia e continua se comportando como antes. Unificar as
quatro numa só é a fase de divergências, depois — e é ela que apaga a prop.

**Tecnologias:** React 19, TypeScript, Vitest + Testing Library, Tailwind 3
com as classes de token do design system.

**Spec:** `docs/superpowers/specs/2026-09-01-fase-4-blocos-comuns-design.md`

## Restrições globais

- Código, comentário, interface e mensagem de commit em **português do Brasil**.
- Commits em conventional commits, **sem acento** na mensagem.
- O primitivo é do design system: **sem `dark:` e sem paleta crua**; só classes
  de token (`bg-surface`, `text-conteudo`, `border-borda`, `ring-focus`).
- Primitivo não usa `style={{}}` para aparência, não faz hover por estado de
  React e é interativo com `focus-visible:ring-2`. Os guardas em
  `src/test/guarda-*.test.ts` cobram isso.
- Ícone é componente do `lucide-react`, nunca emoji ou caractere.
- A suíte não regride e o lint não sobe: baseline **1295 testes / 76 arquivos**,
  lint **135**, `tsc` limpo.
- As seis telas continuam em `PENDENTES_FASE_3`. **Esta fase não migra tela.**

## A única mudança de comportamento autorizada

Hoje o `MultiSelect` é declarado **dentro** do componente de cada página. Isso
o recria a cada render do pai, e o React trata cada render como um tipo novo:
desmonta e remonta. Consequência observável: **marcar um checkbox fecha o
dropdown e apaga o que foi digitado na busca**, porque marcar chama `onChange`,
que muda o estado do pai, que recria o componente.

Extrair o primitivo acaba com isso — não há como preservar, e ninguém quer.
Então este é o único teste de caracterização que muda quando a tela troca de
implementação, e a mudança está autorizada aqui. Todo o resto passa **sem uma
edição**; se precisar de outra, a unificação mudou algo que não devia.

## Estrutura de arquivos

**Criar**

- `src/design-system/ui/forms/MultiSelect.tsx` — o primitivo.
- `src/design-system/ui/forms/buscaDeMultiSelect.ts` — as quatro estratégias,
  puras e testáveis sozinhas.
- `src/design-system/ui/forms/MultiSelect.test.tsx` — teste do primitivo.
- `src/design-system/ui/forms/buscaDeMultiSelect.test.ts` — teste das buscas.
- `src/pages/Produtos.multiselect.test.tsx` e um por tela (seis no total) —
  caracterização do bloco onde ele vive.

**Modificar**

- `src/design-system/ui/forms/index.ts` — exporta o primitivo.
- As seis telas: apagam a cópia e consomem o primitivo.

---

### Task 1: caracterizar o `MultiSelect` de Produtos

É o molde dos outros cinco. Produtos é o caso mais simples: `options: string[]`
e busca só por texto.

**Arquivos:**

- Criar: `src/pages/Produtos.multiselect.test.tsx`

**Interfaces:**

- Produz: o molde de teste que as tasks 2–6 seguem — abrir pelo botão do
  placeholder, digitar em "Pesquisar...", ler os `checkbox` por nome.

- [ ] **Passo 1: escrever o teste que falha**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Produtos from "./Produtos";

/**
 * Caracterização do MultiSelect COMO ELE VIVE em Produtos.
 *
 * Não é a tela: é o bloco. O que se fixa aqui é o contrato que a extração
 * para primitivo tem de preservar — o que o botão diz, o que a busca acha,
 * o que marcar faz e o que "Limpar seleção" limpa.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const NOTAS = [
  {
    id: 1,
    data_emissao: "2026-01-10",
    valor_nota: 1000,
    cliente: { nome: "Alfa Mineração", cpf_cnpj: "11.222.333/0001-44" },
    nome_vendedor: "Vendedor A",
    itens: [
      {
        codigo: "P1",
        descricao: "Bafômetro Phoebus",
        quantidade: "2",
        valor_total: "1000",
      },
    ],
  },
  {
    id: 2,
    data_emissao: "2026-02-10",
    valor_nota: 500,
    cliente: { nome: "Beta Logística", cpf_cnpj: "55.666.777/0001-88" },
    nome_vendedor: "Vendedor B",
    itens: [
      {
        codigo: "P2",
        descricao: "Tubo descartável",
        quantidade: "10",
        valor_total: "500",
      },
    ],
  },
];

vi.mock("../context/DataContext", () => ({
  useData: () => ({ notas: NOTAS, carregando: false }),
}));

/** Abre o dropdown de um filtro pelo texto do botão fechado. */
function abrir(placeholder: string) {
  fireEvent.click(screen.getByRole("button", { name: placeholder }));
}

describe("MultiSelect em Produtos", () => {
  it("o botão fechado mostra o placeholder e, depois, quantos foram escolhidos", () => {
    render(<Produtos />);

    abrir("Todas as empresas");
    fireEvent.click(screen.getByRole("checkbox", { name: /Alfa Mineração/ }));

    expect(
      screen.getByRole("button", { name: "1 selecionado(s)" }),
    ).toBeInTheDocument();
  });

  it("a busca filtra a lista por texto", () => {
    render(<Produtos />);
    abrir("Todas as empresas");

    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
      target: { value: "beta" },
    });

    expect(
      screen.getByRole("checkbox", { name: /Beta Logística/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: /Alfa/ }),
    ).not.toBeInTheDocument();
  });

  it("sem resultado, diz que não achou", () => {
    render(<Produtos />);
    abrir("Todas as empresas");

    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
      target: { value: "gama" },
    });

    expect(screen.getByText("Nenhum resultado encontrado")).toBeInTheDocument();
  });

  // ── DEFEITO PRESERVADO ───────────────────────────────────────────────────
  // Produtos NÃO acha pelo CNPJ digitado sem pontuação; Vendas e Vendedores
  // acham. É uma das quatro buscas divergentes que a fase seguinte unifica.
  // Fica fixado para que a unificação seja decisão, e não efeito colateral.
  it("não acha pelo CNPJ sem pontuação (defeito preservado)", () => {
    render(<Produtos />);
    abrir("Todas as empresas");

    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
      target: { value: "11222333" },
    });

    expect(screen.getByText("Nenhum resultado encontrado")).toBeInTheDocument();
  });

  it("marcar de novo desmarca, e 'Limpar seleção' zera tudo", () => {
    render(<Produtos />);
    abrir("Todas as empresas");
    fireEvent.click(screen.getByRole("checkbox", { name: /Alfa Mineração/ }));

    abrir("1 selecionado(s)");
    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));

    expect(
      screen.getByRole("button", { name: "Todas as empresas" }),
    ).toBeInTheDocument();
  });

  it("clicar fora fecha o dropdown", () => {
    render(<Produtos />);
    abrir("Todas as empresas");
    expect(screen.getByPlaceholderText("Pesquisar...")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(
      screen.queryByPlaceholderText("Pesquisar..."),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar pelo motivo certo**

Rodar: `npx vitest run src/pages/Produtos.multiselect.test.tsx`

Esperado: falha. O texto exato do placeholder ("Todas as empresas") é chute —
ler o valor real em `src/pages/Produtos.tsx` e corrigir o teste até ele passar
**contra o código de hoje**. Caracterização que não passa no código atual não
caracterizou nada.

- [ ] **Passo 3: ajustar os seletores até passar contra o código atual**

Rodar: `npx vitest run src/pages/Produtos.multiselect.test.tsx`
Esperado: PASS, seis testes.

- [ ] **Passo 4: provar que o teste enxerga**

Plantar, em `src/pages/Produtos.tsx`, dentro do `MultiSelect`:
`return optionLower.includes(searchLower);` → `return true;`

Rodar de novo. Esperado: falham "a busca filtra a lista por texto" e "sem
resultado, diz que não achou". Reverter a plantação.

- [ ] **Passo 5: commit**

```bash
git add src/pages/Produtos.multiselect.test.tsx
git commit -m "test(produtos): caracteriza o MultiSelect antes de extrair"
```

---

### Task 2: caracterizar em Serviços

Serviços busca por texto **e por número**, normalizando a opção inteira.

**Arquivos:**

- Criar: `src/pages/Servicos.multiselect.test.tsx`

**Interfaces:**

- Consome: o molde da Task 1.
- Produz: o comportamento "acha por número" que a estratégia
  `buscaPorTextoOuNumero` (Task 7) tem de reproduzir.

- [ ] **Passo 1: escrever o teste**

Mesmo molde da Task 1 — ler `src/pages/Servicos.tsx` para os textos de
placeholder e o contexto que a tela consome — mais o teste que separa Serviços
de Produtos:

```tsx
it("acha pelo número digitado sem pontuação", () => {
  render(<Servicos />);
  abrir("Todos os clientes");

  fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
    target: { value: "11222333" },
  });

  expect(
    screen.getByRole("checkbox", { name: /Alfa Mineração/ }),
  ).toBeInTheDocument();
});
```

- [ ] **Passo 2: rodar até passar contra o código de hoje**

Rodar: `npx vitest run src/pages/Servicos.multiselect.test.tsx`

- [ ] **Passo 3: provar que enxerga**

Plantar: no filtro de Serviços, apagar as duas linhas do `optionNumerico` e
`searchNumerico` e devolver só `optionLower.includes(searchLower)`. Esperado:
falha "acha pelo número digitado sem pontuação". Reverter.

- [ ] **Passo 4: commit**

```bash
git add src/pages/Servicos.multiselect.test.tsx
git commit -m "test(servicos): caracteriza o MultiSelect antes de extrair"
```

---

### Task 3: caracterizar em Vendedores

Vendedores extrai o CNPJ **dos parênteses** e só normaliza o termo quando ele é
todo dígito — é a terceira das quatro buscas.

**Arquivos:**

- Criar: `src/pages/Vendedores.multiselect.test.tsx`

- [ ] **Passo 1: escrever o teste**

Molde da Task 1, mais os dois que separam Vendedores de Serviços:

```tsx
it("acha pelo CNPJ que está entre parênteses, digitado sem pontuação", () => {
  render(<Vendedores />);
  abrir("Todas as empresas");

  fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
    target: { value: "11222333" },
  });

  expect(
    screen.getByRole("checkbox", { name: /Alfa Mineração/ }),
  ).toBeInTheDocument();
});

it("termo com letra não vira busca numérica", () => {
  // A normalização só acontece quando o termo é todo dígito: "a11" procura
  // o texto "a11", e não o número 11.
  render(<Vendedores />);
  abrir("Todas as empresas");

  fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
    target: { value: "a11" },
  });

  expect(screen.getByText("Nenhum resultado encontrado")).toBeInTheDocument();
});
```

- [ ] **Passo 2: rodar até passar contra o código de hoje**
- [ ] **Passo 3: provar que enxerga** — trocar `/^\d+$/.test(searchTerm)` por
      `true`; esperado: falha "termo com letra não vira busca numérica".
- [ ] **Passo 4: commit**

```bash
git add src/pages/Vendedores.multiselect.test.tsx
git commit -m "test(vendedores): caracteriza o MultiSelect antes de extrair"
```

---

### Task 4: caracterizar em Estoque

Estoque é o primeiro com `options: { value, label }[]`, e busca só pelo
`label`.

**Arquivos:**

- Criar: `src/pages/Estoque.multiselect.test.tsx`

- [ ] **Passo 1: escrever o teste**

Molde da Task 1, com dois acréscimos:

```tsx
it("o checkbox mostra o rótulo, e o que é guardado é o código", () => {
  // A opção é um par: o texto que aparece é o `label`, e o que entra em
  // `selected` é o `value`. Confundir os dois filtra pelo texto errado.
  render(<Estoque />);
  abrir("Todos os produtos");

  fireEvent.click(screen.getByRole("checkbox", { name: /Bafômetro Phoebus/ }));

  expect(
    screen.getByRole("button", { name: "1 selecionado(s)" }),
  ).toBeInTheDocument();
});

// ── DEFEITO PRESERVADO ───────────────────────────────────────────────────
// Estoque, como Produtos, não acha por número.
it("não acha pelo código digitado como número (defeito preservado)", () => {
  render(<Estoque />);
  abrir("Todos os produtos");

  fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
    target: { value: "1" },
  });

  expect(screen.getByText("Nenhum resultado encontrado")).toBeInTheDocument();
});
```

- [ ] **Passo 2: rodar até passar contra o código de hoje**
- [ ] **Passo 3: provar que enxerga** — trocar `option.label.toLowerCase()` por
      `option.value.toLowerCase()`; esperado: falha o teste do rótulo.
- [ ] **Passo 4: commit**

```bash
git add src/pages/Estoque.multiselect.test.tsx
git commit -m "test(estoque): caracteriza o MultiSelect antes de extrair"
```

---

### Task 5: caracterizar em Clientes

Clientes é a quarta busca: casa `label`, casa `value` cru **e** casa número no
`value`.

**Arquivos:**

- Criar: `src/pages/Clientes.multiselect.test.tsx`

- [ ] **Passo 1: escrever o teste**

Molde da Task 1, mais:

```tsx
it("acha pelo rótulo, pelo valor cru e pelo número do valor", () => {
  render(<Clientes />);

  for (const [termo, achado] of [
    ["alfa", true],
    ["11.222", true],
    ["11222333", true],
    ["zeta", false],
  ] as const) {
    abrir("Todos os clientes");
    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
      target: { value: termo },
    });
    const achou = screen.queryByRole("checkbox", { name: /Alfa Mineração/ });
    expect(Boolean(achou)).toBe(achado);
    fireEvent.mouseDown(document.body);
  }
});
```

- [ ] **Passo 2: rodar até passar contra o código de hoje**
- [ ] **Passo 3: provar que enxerga** — apagar a terceira condição
      (`valueNormalizado.includes(searchNormalizado)`); esperado: falha o caso
      `"11222333"`.
- [ ] **Passo 4: commit**

```bash
git add src/pages/Clientes.multiselect.test.tsx
git commit -m "test(clientes): caracteriza o MultiSelect antes de extrair"
```

---

### Task 6: caracterizar em Vendas

Vendas usa a mesma busca de Vendedores. O teste existe assim mesmo: são dois
arquivos que a fase de divergências vai comparar, e "é igual ao outro" não é
coisa que se afirme sem teste.

**Arquivos:**

- Criar: `src/pages/Vendas.multiselect.test.tsx`

- [ ] **Passo 1: escrever o teste** — molde da Task 1 mais os dois testes de
      CNPJ da Task 3. Vendas tem os mesmos três filtros de Produtos: "Todas as
      empresas", "Todos os produtos" e "Todos os vendedores"; o de empresa é o
      que carrega CNPJ.
- [ ] **Passo 2: rodar até passar contra o código de hoje**
- [ ] **Passo 3: provar que enxerga** — mesma plantação da Task 3.
- [ ] **Passo 4: commit**

```bash
git add src/pages/Vendas.multiselect.test.tsx
git commit -m "test(vendas): caracteriza o MultiSelect antes de extrair"
```

---

### Task 7: as quatro estratégias de busca, puras

Antes do componente, a parte que decide o que a busca acha. Pura, sem React,
testável sozinha — é onde moram as quatro divergências.

**Arquivos:**

- Criar: `src/design-system/ui/forms/buscaDeMultiSelect.ts`
- Criar: `src/design-system/ui/forms/buscaDeMultiSelect.test.ts`

**Interfaces:**

- Produz:
  - `interface OpcaoDeMultiSelect { valor: string; rotulo: string }`
  - `type EstrategiaDeBusca = (opcao: OpcaoDeMultiSelect, termo: string) => boolean`
  - `buscaPorTexto`, `buscaPorTextoOuNumero`, `buscaPorCnpjEntreParenteses`,
    `buscaPorRotuloValorOuNumero` — todas `EstrategiaDeBusca`
  - `deTextos(textos: string[]): OpcaoDeMultiSelect[]`

- [ ] **Passo 1: escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";

import {
  buscaPorCnpjEntreParenteses,
  buscaPorRotuloValorOuNumero,
  buscaPorTexto,
  buscaPorTextoOuNumero,
  deTextos,
} from "./buscaDeMultiSelect";

const ALFA = {
  valor: "Alfa Mineração (11.222.333/0001-44)",
  rotulo: "Alfa Mineração (11.222.333/0001-44)",
};
const PRODUTO = { valor: "P1", rotulo: "Bafômetro Phoebus" };

describe("deTextos", () => {
  it("transforma texto solto em par, com valor igual ao rótulo", () => {
    expect(deTextos(["Alfa", "Beta"])).toEqual([
      { valor: "Alfa", rotulo: "Alfa" },
      { valor: "Beta", rotulo: "Beta" },
    ]);
  });
});

describe("buscaPorTexto", () => {
  it("acha pelo rótulo, sem diferenciar maiúscula", () => {
    expect(buscaPorTexto(ALFA, "alfa")).toBe(true);
    expect(buscaPorTexto(PRODUTO, "phoebus")).toBe(true);
  });

  it("não acha por número", () => {
    // É o comportamento de Produtos e Estoque hoje.
    expect(buscaPorTexto(ALFA, "11222333")).toBe(false);
  });

  it("termo vazio acha tudo", () => {
    expect(buscaPorTexto(ALFA, "")).toBe(true);
  });
});

describe("buscaPorTextoOuNumero", () => {
  it("acha por texto e também pelos dígitos do rótulo", () => {
    expect(buscaPorTextoOuNumero(ALFA, "alfa")).toBe(true);
    expect(buscaPorTextoOuNumero(ALFA, "11222333")).toBe(true);
  });
});

describe("buscaPorCnpjEntreParenteses", () => {
  it("acha pelo que está entre parênteses, sem pontuação", () => {
    expect(buscaPorCnpjEntreParenteses(ALFA, "11222333")).toBe(true);
  });

  it("termo com letra não vira busca numérica", () => {
    expect(buscaPorCnpjEntreParenteses(ALFA, "a11")).toBe(false);
  });

  it("opção sem parênteses não quebra", () => {
    expect(buscaPorCnpjEntreParenteses(PRODUTO, "1")).toBe(false);
  });
});

describe("buscaPorRotuloValorOuNumero", () => {
  it("acha pelo rótulo, pelo valor cru e pelos dígitos do valor", () => {
    const cliente = { valor: "11.222.333/0001-44", rotulo: "Alfa Mineração" };
    expect(buscaPorRotuloValorOuNumero(cliente, "alfa")).toBe(true);
    expect(buscaPorRotuloValorOuNumero(cliente, "11.222")).toBe(true);
    expect(buscaPorRotuloValorOuNumero(cliente, "11222333")).toBe(true);
    expect(buscaPorRotuloValorOuNumero(cliente, "zeta")).toBe(false);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/design-system/ui/forms/buscaDeMultiSelect.test.ts`
Esperado: FAIL, "Failed to resolve import".

- [ ] **Passo 3: implementar**

```ts
/**
 * As quatro maneiras de casar o termo digitado com uma opção do MultiSelect.
 *
 * Quatro, e não uma, porque as seis telas divergiram: o mesmo componente foi
 * copiado e cada cópia ganhou um pedaço de busca que as outras não ganharam.
 * Elas existem aqui nomeadas para que a extração do primitivo preserve o
 * comportamento de cada tela — unificar as quatro é a fase seguinte, e é ela
 * que apaga este arquivo.
 */

export interface OpcaoDeMultiSelect {
  /** O que entra na seleção. */
  valor: string;
  /** O que a pessoa lê. */
  rotulo: string;
}

export type EstrategiaDeBusca = (
  opcao: OpcaoDeMultiSelect,
  termo: string,
) => boolean;

/** Texto solto vira par com valor igual ao rótulo. */
export function deTextos(textos: string[]): OpcaoDeMultiSelect[] {
  return textos.map((texto) => ({ valor: texto, rotulo: texto }));
}

const soDigitos = (texto: string) => texto.replace(/\D/g, "");

/** Produtos e Estoque: só o rótulo, sem diferenciar maiúscula. */
export const buscaPorTexto: EstrategiaDeBusca = (opcao, termo) =>
  opcao.rotulo.toLowerCase().includes(termo.toLowerCase());

/** Serviços: o rótulo, ou os dígitos do rótulo contra os dígitos do termo. */
export const buscaPorTextoOuNumero: EstrategiaDeBusca = (opcao, termo) => {
  if (buscaPorTexto(opcao, termo)) return true;
  const digitosDoTermo = soDigitos(termo);
  return (
    digitosDoTermo.length > 0 &&
    soDigitos(opcao.rotulo).includes(digitosDoTermo)
  );
};

/**
 * Vendedores e Vendas: o rótulo, ou o CNPJ que está entre parênteses.
 *
 * Só normaliza quando o termo é TODO dígito: "a11" procura o texto "a11", e
 * não o número 11.
 */
export const buscaPorCnpjEntreParenteses: EstrategiaDeBusca = (
  opcao,
  termo,
) => {
  if (buscaPorTexto(opcao, termo)) return true;
  if (!/^\d+$/.test(termo)) return false;
  const entreParenteses = opcao.rotulo.match(/\((.*?)\)/);
  if (!entreParenteses) return false;
  return soDigitos(entreParenteses[1]).includes(soDigitos(termo));
};

/** Clientes: rótulo, valor cru, ou os dígitos do valor. */
export const buscaPorRotuloValorOuNumero: EstrategiaDeBusca = (
  opcao,
  termo,
) => {
  const termoMinusculo = termo.toLowerCase();
  if (opcao.rotulo.toLowerCase().includes(termoMinusculo)) return true;
  if (opcao.valor.toLowerCase().includes(termoMinusculo)) return true;
  const digitosDoTermo = soDigitos(termo);
  return (
    digitosDoTermo.length > 0 && soDigitos(opcao.valor).includes(digitosDoTermo)
  );
};
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/design-system/ui/forms/buscaDeMultiSelect.test.ts`
Esperado: PASS.

- [ ] **Passo 5: commit**

```bash
git add src/design-system/ui/forms/buscaDeMultiSelect.ts src/design-system/ui/forms/buscaDeMultiSelect.test.ts
git commit -m "feat(ds): as quatro buscas do MultiSelect, puras e nomeadas"
```

---

### Task 8: o primitivo `MultiSelect`

**Arquivos:**

- Criar: `src/design-system/ui/forms/MultiSelect.tsx`
- Criar: `src/design-system/ui/forms/MultiSelect.test.tsx`
- Modificar: `src/design-system/ui/forms/index.ts`

**Interfaces:**

- Consome: `OpcaoDeMultiSelect`, `EstrategiaDeBusca`, `buscaPorTexto` da Task 7.
- Produz: `<MultiSelect opcoes selecionados onChange placeholder buscarPor? />`,
  com `buscarPor` valendo `buscaPorTexto` por padrão.

- [ ] **Passo 1: escrever o teste que falha**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MultiSelect } from "./MultiSelect";
import { buscaPorCnpjEntreParenteses, deTextos } from "./buscaDeMultiSelect";

const OPCOES = deTextos([
  "Alfa Mineração (11.222.333/0001-44)",
  "Beta Logística (55.666.777/0001-88)",
]);

describe("MultiSelect", () => {
  it("fechado, mostra o placeholder; com escolha, mostra a contagem", () => {
    const { rerender } = render(
      <MultiSelect
        opcoes={OPCOES}
        selecionados={[]}
        onChange={vi.fn()}
        placeholder="Todas as empresas"
      />,
    );
    expect(
      screen.getByRole("button", { name: "Todas as empresas" }),
    ).toBeInTheDocument();

    rerender(
      <MultiSelect
        opcoes={OPCOES}
        selecionados={[OPCOES[0].valor]}
        onChange={vi.fn()}
        placeholder="Todas as empresas"
      />,
    );
    expect(
      screen.getByRole("button", { name: "1 selecionado(s)" }),
    ).toBeInTheDocument();
  });

  it("marcar acrescenta e marcar de novo tira", () => {
    const onChange = vi.fn();
    render(
      <MultiSelect
        opcoes={OPCOES}
        selecionados={[]}
        onChange={onChange}
        placeholder="Empresas"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Empresas" }));

    fireEvent.click(screen.getByRole("checkbox", { name: /Alfa/ }));
    expect(onChange).toHaveBeenCalledWith([OPCOES[0].valor]);
  });

  it("o dropdown NÃO fecha ao marcar — é o que a cópia fazia e ninguém queria", () => {
    // Nas telas o componente era declarado dentro da página, então marcar
    // recriava o componente e o dropdown fechava, apagando a busca. Fora da
    // página, o estado sobrevive.
    const onChange = vi.fn();
    const { rerender } = render(
      <MultiSelect
        opcoes={OPCOES}
        selecionados={[]}
        onChange={onChange}
        placeholder="Empresas"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Empresas" }));
    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
      target: { value: "alfa" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Alfa/ }));

    rerender(
      <MultiSelect
        opcoes={OPCOES}
        selecionados={[OPCOES[0].valor]}
        onChange={onChange}
        placeholder="Empresas"
      />,
    );

    expect(screen.getByPlaceholderText("Pesquisar...")).toHaveValue("alfa");
  });

  it("a estratégia de busca é escolhida por quem usa", () => {
    render(
      <MultiSelect
        opcoes={OPCOES}
        selecionados={[]}
        onChange={vi.fn()}
        placeholder="Empresas"
        buscarPor={buscaPorCnpjEntreParenteses}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Empresas" }));

    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
      target: { value: "11222333" },
    });

    expect(screen.getByRole("checkbox", { name: /Alfa/ })).toBeInTheDocument();
  });

  it("sem resultado, diz que não achou", () => {
    render(
      <MultiSelect
        opcoes={OPCOES}
        selecionados={[]}
        onChange={vi.fn()}
        placeholder="Empresas"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Empresas" }));

    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
      target: { value: "gama" },
    });

    expect(screen.getByText("Nenhum resultado encontrado")).toBeInTheDocument();
  });

  it("'Limpar seleção' devolve lista vazia", () => {
    const onChange = vi.fn();
    render(
      <MultiSelect
        opcoes={OPCOES}
        selecionados={[OPCOES[0].valor]}
        onChange={onChange}
        placeholder="Empresas"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "1 selecionado(s)" }));

    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("clicar fora fecha", () => {
    render(
      <MultiSelect
        opcoes={OPCOES}
        selecionados={[]}
        onChange={vi.fn()}
        placeholder="Empresas"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Empresas" }));

    fireEvent.mouseDown(document.body);

    expect(
      screen.queryByPlaceholderText("Pesquisar..."),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/design-system/ui/forms/MultiSelect.test.tsx`
Esperado: FAIL, "Failed to resolve import".

- [ ] **Passo 3: implementar o primitivo**

Portar a cópia de `src/pages/Produtos.tsx:454-575` trocando:

- `options: string[]` → `opcoes: OpcaoDeMultiSelect[]`
- `selected`/`onChange` → `selecionados`/`onChange`, operando em `valor`
- o `filter` interno → `opcoes.filter((opcao) => buscarPor(opcao, termo))`
- **todas** as classes: `bg-white dark:bg-surface` → `bg-surface`,
  `border-gray-300 dark:border-gray-600` → `border-borda`,
  `text-gray-700 dark:text-gray-300` → `text-conteudo`,
  `focus:ring-2 focus:ring-blue-500` → `focus-visible:ring-2 focus-visible:ring-focus`,
  `hover:bg-blue-100 dark:hover:bg-gray-700` → `hover:bg-surface-elevated`,
  `z-10` → `z-dropdown`
- apagar o `normalizar` morto que a cópia de Produtos carrega

- [ ] **Passo 4: rodar e ver passar, e os guardas junto**

Rodar: `npx vitest run src/design-system src/test`
Esperado: PASS. Os guardas de cor, de primitivo e de ícone cobrem o arquivo
novo — se algum reclamar, a classe crua ficou para trás.

- [ ] **Passo 5: exportar no barrel**

Em `src/design-system/ui/forms/index.ts`, acrescentar:

```ts
export * from "./MultiSelect";
export * from "./buscaDeMultiSelect";
```

- [ ] **Passo 6: commit**

```bash
git add src/design-system/ui/forms/
git commit -m "feat(ds): MultiSelect vira primitivo, com a busca por estrategia"
```

---

### Os filtros de cada tela, medidos

Quantos `MultiSelect` cada tela tem e com que placeholder — o executor troca
todos, não só o primeiro:

| Tela       | Filtros                                                         |
| ---------- | --------------------------------------------------------------- |
| Produtos   | "Todas as empresas", "Todos os produtos", "Todos os vendedores" |
| Serviços   | "Todos os clientes", "Todas as cidades", "Todos os tipos"       |
| Vendedores | "Todas as empresas", "Todos os produtos"                        |
| Estoque    | "Todos os produtos"                                             |
| Clientes   | "Todos os clientes", "Todos os produtos", "Todos os vendedores" |
| Vendas     | "Todas as empresas", "Todos os produtos", "Todos os vendedores" |

---

### Task 9: Produtos passa a consumir o primitivo

A partir daqui o critério é um só: **o teste de caracterização daquela tela
passa sem uma edição** — exceto o do dropdown que fecha ao marcar, autorizado
no topo deste plano.

**Arquivos:**

- Modificar: `src/pages/Produtos.tsx` (apaga `454-575`, importa o primitivo)
- Modificar: `src/pages/Produtos.multiselect.test.tsx` (só o teste autorizado)

**Interfaces:**

- Consome: `MultiSelect`, `deTextos`, `buscaPorTexto` das tasks 7 e 8.

- [ ] **Passo 1: trocar a cópia pelo primitivo**

Apagar `const MultiSelect = ...` de dentro do componente e, nos três usos,
trocar `options={lista}` por `opcoes={deTextos(lista)}` e `selected` por
`selecionados`. A estratégia é a padrão, então `buscarPor` não é passado.

- [ ] **Passo 2: rodar a caracterização**

Rodar: `npx vitest run src/pages/Produtos.multiselect.test.tsx`
Esperado: passam todos, menos "clicar fora fecha o dropdown" caso ele dependa
do remount. Se falhar **qualquer outro**, a unificação mudou comportamento:
parar, entender, e não seguir editando o teste para caber.

- [ ] **Passo 3: ajustar só o teste autorizado**

Se o teste do dropdown mudar de comportamento, reescrevê-lo para o novo, com
o comentário explicando que a cópia fechava por remount e o primitivo não.

- [ ] **Passo 4: suíte inteira, lint e tsc**

Rodar: `npm test && npm run lint && npx tsc --noEmit`
Esperado: 1295+ testes, lint ≤ 135, tsc limpo.

- [ ] **Passo 5: commit**

```bash
git add src/pages/Produtos.tsx src/pages/Produtos.multiselect.test.tsx
git commit -m "refactor(produtos): consome o MultiSelect do design system"
```

---

### Task 10: Serviços passa a consumir o primitivo

**Arquivos:**

- Modificar: `src/pages/Servicos.tsx` (apaga a cópia do `MultiSelect`)
- Modificar: `src/pages/Servicos.multiselect.test.tsx` (só o teste autorizado)

**Interfaces:**

- Consome: `MultiSelect`, `deTextos` e as estratégias das tasks 7 e 8.
- Nesta tela: **opções** — `deTextos(lista)` nos três filtros. **Busca** — `buscaPorTextoOuNumero` no filtro de clientes; os outros dois ficam no padrão.

- [ ] **Passo 1: trocar a cópia pelo primitivo**, em todos os filtros da tela
      (ver a tabela "Os filtros de cada tela, medidos", acima).
- [ ] **Passo 2: rodar a caracterização** —
      `npx vitest run src/pages/Servicos.multiselect.test.tsx`. Passa tudo
      menos, talvez, o do dropdown. **Qualquer outra falha significa que a
      unificação mudou comportamento: parar e entender, não editar o teste.**
- [ ] **Passo 3: ajustar só o teste do dropdown**, se ele mudar, com o
      comentário explicando que a cópia fechava por remount e o primitivo não.
- [ ] **Passo 4: suíte, lint e tsc** — `npm test && npm run lint && npx tsc --noEmit`.
- [ ] **Passo 5: commit**

```bash
git add src/pages/Servicos.tsx src/pages/Servicos.multiselect.test.tsx
git commit -m "refactor(servicos): consome o MultiSelect do design system"
```

---

### Task 11: Vendedores passa a consumir o primitivo

**Arquivos:**

- Modificar: `src/pages/Vendedores.tsx` (apaga a cópia do `MultiSelect`)
- Modificar: `src/pages/Vendedores.multiselect.test.tsx` (só o teste autorizado)

**Interfaces:**

- Consome: `MultiSelect`, `deTextos` e as estratégias das tasks 7 e 8.
- Nesta tela: **opções** — `deTextos(lista)` nos dois filtros. **Busca** — `buscaPorCnpjEntreParenteses` no filtro de empresas; o de produtos fica no padrão.

- [ ] **Passo 1: trocar a cópia pelo primitivo**, em todos os filtros da tela
      (ver a tabela "Os filtros de cada tela, medidos", acima).
- [ ] **Passo 2: rodar a caracterização** —
      `npx vitest run src/pages/Vendedores.multiselect.test.tsx`. Passa tudo
      menos, talvez, o do dropdown. **Qualquer outra falha significa que a
      unificação mudou comportamento: parar e entender, não editar o teste.**
- [ ] **Passo 3: ajustar só o teste do dropdown**, se ele mudar, com o
      comentário explicando que a cópia fechava por remount e o primitivo não.
- [ ] **Passo 4: suíte, lint e tsc** — `npm test && npm run lint && npx tsc --noEmit`.
- [ ] **Passo 5: commit**

```bash
git add src/pages/Vendedores.tsx src/pages/Vendedores.multiselect.test.tsx
git commit -m "refactor(vendedores): consome o MultiSelect do design system"
```

---

### Task 12: Estoque passa a consumir o primitivo

**Arquivos:**

- Modificar: `src/pages/Estoque.tsx` (apaga a cópia do `MultiSelect`)
- Modificar: `src/pages/Estoque.multiselect.test.tsx` (só o teste autorizado)

**Interfaces:**

- Consome: `MultiSelect`, `deTextos` e as estratégias das tasks 7 e 8.
- Nesta tela: **opções** — a lista já é par — trocar `{ value, label }` por `{ valor: o.value, rotulo: o.label }`. **Busca** — padrão, sem passar `buscarPor`.

- [ ] **Passo 1: trocar a cópia pelo primitivo**, em todos os filtros da tela
      (ver a tabela "Os filtros de cada tela, medidos", acima).
- [ ] **Passo 2: rodar a caracterização** —
      `npx vitest run src/pages/Estoque.multiselect.test.tsx`. Passa tudo
      menos, talvez, o do dropdown. **Qualquer outra falha significa que a
      unificação mudou comportamento: parar e entender, não editar o teste.**
- [ ] **Passo 3: ajustar só o teste do dropdown**, se ele mudar, com o
      comentário explicando que a cópia fechava por remount e o primitivo não.
- [ ] **Passo 4: suíte, lint e tsc** — `npm test && npm run lint && npx tsc --noEmit`.
- [ ] **Passo 5: commit**

```bash
git add src/pages/Estoque.tsx src/pages/Estoque.multiselect.test.tsx
git commit -m "refactor(estoque): consome o MultiSelect do design system"
```

---

### Task 13: Clientes passa a consumir o primitivo

**Arquivos:**

- Modificar: `src/pages/Clientes.tsx` (apaga a cópia do `MultiSelect`)
- Modificar: `src/pages/Clientes.multiselect.test.tsx` (só o teste autorizado)

**Interfaces:**

- Consome: `MultiSelect`, `deTextos` e as estratégias das tasks 7 e 8.
- Nesta tela: **opções** — a lista já é par — mesma troca de nomes do Estoque. **Busca** — `buscaPorRotuloValorOuNumero` no filtro de clientes; os outros dois no padrão.

- [ ] **Passo 1: trocar a cópia pelo primitivo**, em todos os filtros da tela
      (ver a tabela "Os filtros de cada tela, medidos", acima).
- [ ] **Passo 2: rodar a caracterização** —
      `npx vitest run src/pages/Clientes.multiselect.test.tsx`. Passa tudo
      menos, talvez, o do dropdown. **Qualquer outra falha significa que a
      unificação mudou comportamento: parar e entender, não editar o teste.**
- [ ] **Passo 3: ajustar só o teste do dropdown**, se ele mudar, com o
      comentário explicando que a cópia fechava por remount e o primitivo não.
- [ ] **Passo 4: suíte, lint e tsc** — `npm test && npm run lint && npx tsc --noEmit`.
- [ ] **Passo 5: commit**

```bash
git add src/pages/Clientes.tsx src/pages/Clientes.multiselect.test.tsx
git commit -m "refactor(clientes): consome o MultiSelect do design system"
```

---

### Task 14: Vendas passa a consumir o primitivo

**Arquivos:**

- Modificar: `src/pages/Vendas.tsx` (apaga a cópia do `MultiSelect`)
- Modificar: `src/pages/Vendas.multiselect.test.tsx` (só o teste autorizado)

**Interfaces:**

- Consome: `MultiSelect`, `deTextos` e as estratégias das tasks 7 e 8.
- Nesta tela: **opções** — `deTextos(lista)` nos três filtros. **Busca** — `buscaPorCnpjEntreParenteses` no filtro de empresas; os outros dois no padrão.

- [ ] **Passo 1: trocar a cópia pelo primitivo**, em todos os filtros da tela
      (ver a tabela "Os filtros de cada tela, medidos", acima).
- [ ] **Passo 2: rodar a caracterização** —
      `npx vitest run src/pages/Vendas.multiselect.test.tsx`. Passa tudo
      menos, talvez, o do dropdown. **Qualquer outra falha significa que a
      unificação mudou comportamento: parar e entender, não editar o teste.**
- [ ] **Passo 3: ajustar só o teste do dropdown**, se ele mudar, com o
      comentário explicando que a cópia fechava por remount e o primitivo não.
- [ ] **Passo 4: suíte, lint e tsc** — `npm test && npm run lint && npx tsc --noEmit`.
- [ ] **Passo 5: commit**

```bash
git add src/pages/Vendas.tsx src/pages/Vendas.multiselect.test.tsx
git commit -m "refactor(vendas): consome o MultiSelect do design system"
```

---

### Task 15: fechar a conta

**Arquivos:**

- Criar: `docs/superpowers/2026-09-01-multiselect-divergencias.md`

- [ ] **Passo 1: conferir que nenhuma cópia sobrou**

Rodar: `grep -rn "const MultiSelect" src/pages/`
Esperado: nada.

- [ ] **Passo 2: medir o que saiu**

Rodar: `git diff --stat main..HEAD -- src/pages/`
Esperado: por volta de 737 linhas a menos nas seis telas.

- [ ] **Passo 3: escrever a lista de divergências**

Um documento curto com as quatro buscas, qual tela usa cada uma, e a pergunta
que a fase seguinte responde: **unificar tudo na busca mais rica** — rótulo,
valor e dígitos — significa que Produtos e Estoque passam a achar por número,
o que hoje não fazem. É melhoria, e é decisão do Erick.

- [ ] **Passo 4: commit**

```bash
git add docs/superpowers/2026-09-01-multiselect-divergencias.md
git commit -m "docs: as quatro buscas divergentes do MultiSelect, para decidir"
```

---

## Depois deste plano

Os outros cinco itens da Fase 4 — adotar o `Pagination`, extrair a exportação
para Excel, o preset de período, o `useIsMobile` e o clique fora — ganham
planos próprios. São menores e mais mecânicos, e nenhum tem a decisão de API
que este tinha.
