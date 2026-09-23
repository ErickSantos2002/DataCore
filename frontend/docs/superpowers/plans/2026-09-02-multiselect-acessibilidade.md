# O MultiSelect absorve a peça de Contas, e a acessibilidade se decide de uma vez

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fundir `MultiSelectDeContas` no primitivo `MultiSelect`, dando ao primitivo o rótulo acessível que a peça velha já tinha e corrigindo o papel ARIA que ela errava.

**Architecture:** três movimentos, nesta ordem. Primeiro caracterizar os três filtros de Contas contra a peça velha — ela nunca teve teste, e essa caracterização vira o critério de aceitação do último movimento. Depois o primitivo alcança a peça velha em acessibilidade (`rotulo` obrigatório, `aria-labelledby`, `role="group"`, `Escape`), com as seis telas passando o rótulo e apagando o `<label>` que escrevem à mão. Só então Contas passa a consumir o primitivo e a peça velha é apagada. A acessibilidade vem **antes** da fusão de propósito: se viesse depois, Contas perderia o rótulo por um movimento inteiro e a caracterização recém-escrita quebraria.

**Tech Stack:** React 18 + TypeScript, Vitest + Testing Library, Tailwind com tokens do design system.

**Spec:** `docs/superpowers/specs/2026-09-02-multiselect-acessibilidade-design.md`

## Global Constraints

- Código, comentário, interface e nome de teste em **português do Brasil**.
- Mensagem de commit em conventional commits, **sem acento**.
- ⚠️ O repositório é **PÚBLICO**: nada de nome de pessoa, valor de remuneração, credencial ou IP de produção em código, teste, comentário ou mensagem de commit. Fixture usa nome fictício ("Vendedor A", "Alfa Mineração").
- O primitivo é do design system: **sem `dark:` e sem paleta crua**; só classes de token (`bg-surface`, `text-conteudo`, `border-borda`, `ring-focus`). Os guardas em `src/test/guarda-*.test.ts` cobram isso.
- Ícone é componente do `lucide-react`, nunca emoji ou caractere.
- **NÃO rodar `npm run format`.** `src/pages/*` está no `.prettierignore`; rodar o formatador reformata o arquivo inteiro e enterra a mudança num diff de centenas de linhas. Reformatação de linha sem motivo é achado.
- Nunca usar `git add -A`. Adicionar só os arquivos nominalmente.
- **Esta fase não migra tela.** As seis continuam em `PENDENTES_FASE_3` (`src/test/guarda-cores.test.ts`). O único código de página que se toca é o `<label>` do filtro e a chamada do `MultiSelect`.
- A suíte não regride e o lint não sobe. Baseline: **1357 testes / 84 arquivos**, lint **119 problemas**, `tsc --noEmit` limpo.
- **Não trocar o `<input type="checkbox">` cru pelo `Checkbox` do design system.** Ele esconde o campo dentro de um `<span>` intermediário e mudaria a árvore que os 41 testes de caracterização leem. É item da Fase 2.
- **Não introduzir `role="listbox"` nem `role="option"`** no `MultiSelect`. Um botão que abre um painel de checkboxes é disclosure, não listbox, e as opções são achadas por `getByRole("checkbox")` em 41 testes.

---

## Estrutura de arquivos

**Criar**

- `src/pages/contas/FiltrosDeContas.multiselect.test.tsx` — caracterização dos três filtros de Contas contra `MultiSelectDeContas` (Task 1).

**Modificar**

- `src/design-system/ui/forms/MultiSelect.tsx` — Escape (Task 2); `rotulo`, `aria-labelledby`, `role="group"`, `aria-label` na busca (Task 3).
- `src/design-system/ui/forms/MultiSelect.test.tsx` — testes do Escape (Task 2) e da acessibilidade (Task 3).
- `src/pages/{Produtos,Servicos,Vendedores,Estoque,Clientes,Vendas}.tsx` — passam `rotulo`, apagam o `<label>` (Task 3).
- `src/pages/{Produtos,Servicos,Vendedores,Estoque,Clientes,Vendas}.multiselect.test.tsx` — as 30 consultas ao gatilho (Task 3).
- `src/pages/contas/FiltrosDeContas.tsx` — consome o primitivo (Task 4).
- `docs/superpowers/2026-09-01-multiselect-divergencias.md` — item 7 resolvido (Task 5).

**Apagar**

- `src/pages/contas/MultiSelectDeContas.tsx` (Task 4).

---

## Os 15 usos e seus rótulos, medidos

O `rotulo` recebe **exatamente** o texto do `<label>` que sai. Não é ocasião de renomear.

| Tela       | rótulo              | placeholder           |
| ---------- | ------------------- | --------------------- |
| Produtos   | `Empresas`          | `Todas as empresas`   |
| Produtos   | `Vendedores`        | `Todos os vendedores` |
| Produtos   | `Produtos`          | `Todos os produtos`   |
| Serviços   | `Cliente (Tomador)` | `Todos os clientes`   |
| Serviços   | `Cidade do Serviço` | `Todas as cidades`    |
| Serviços   | `Tipo de Serviço`   | `Todos os tipos`      |
| Vendedores | `Empresas`          | `Todas as empresas`   |
| Vendedores | `Produtos`          | `Todos os produtos`   |
| Estoque    | `Produtos`          | `Todos os produtos`   |
| Clientes   | `Cliente`           | `Todos os clientes`   |
| Clientes   | `Vendedor`          | `Todos os vendedores` |
| Clientes   | `Produto`           | `Todos os produtos`   |
| Vendas     | `Empresas`          | `Todas as empresas`   |
| Vendas     | `Vendedores`        | `Todos os vendedores` |
| Vendas     | `Produtos`          | `Todos os produtos`   |

Em Vendedores o filtro rotulado `Empresas` é alimentado por `clientesUnicos`. **É como a tela é hoje; não consertar** — seria mudança de comportamento fora do escopo.

## As 30 consultas ao gatilho, por arquivo

Acrescentar `aria-labelledby` **muda o nome acessível do gatilho**. Medido com sonda: `"Todos os produtos"` deixa de casar e o nome vira `"Empresas Todos os produtos"` — rótulo, espaço, valor.

| Arquivo                           | consultas a atualizar |
| --------------------------------- | --------------------- |
| `Clientes.multiselect.test.tsx`   | 6                     |
| `Estoque.multiselect.test.tsx`    | 6                     |
| `Vendas.multiselect.test.tsx`     | 6                     |
| `Produtos.multiselect.test.tsx`   | 4                     |
| `Servicos.multiselect.test.tsx`   | 4                     |
| `Vendedores.multiselect.test.tsx` | 4                     |

Total **30**. As consultas a `getByRole("button", { name: "Limpar seleção" })` — uma por arquivo, seis ao todo — **não** são afetadas, porque aquele botão não tem `aria-labelledby`.

**Se uma falha aparecer fora dessa contagem, a mudança vazou para além do rótulo: parar e reportar.**

---

### Task 1: caracterizar os três filtros de Contas

`MultiSelectDeContas` não tem teste nenhum, e Contas é a tela de dinheiro. Esta caracterização é a rede que falta — e vira o critério de aceitação da Task 4.

`FiltrosDeContas` é um componente de props puras: renderiza direto, sem mock de contexto. Isso também evita a colisão que o comentário dele registra (as palavras "Situação" e "Categoria" aparecem no filtro e na coluna da tabela) — renderizando só a barra, a tabela não existe.

**Files:**

- Create: `src/pages/contas/FiltrosDeContas.multiselect.test.tsx`

**Interfaces:**

- Consome: `FiltrosDeContas` de `src/pages/contas/FiltrosDeContas.tsx`, com as props `{ rotuloDaContraparte: string; opcoes: { situacao: string[]; categoria: string[]; contraparte: string[] }; valores: { situacao: string[]; categoria: string[]; contraparte: string[]; dataInicio: string; dataFim: string }; preset: string; onSituacao; onCategoria; onContraparte; onPreset; onDataInicio; onDataFim }`.
- Produz: o arquivo de teste que a Task 4 tem que fazer passar **sem uma edição**.

- [ ] **Passo 1: escrever o teste**

Criar `src/pages/contas/FiltrosDeContas.multiselect.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FiltrosDeContas } from "./FiltrosDeContas";

/**
 * Caracterização dos três MultiSelect da barra de filtros de Contas, escrita
 * contra `MultiSelectDeContas` como ela é hoje — antes de ela ser fundida no
 * primitivo do design system.
 *
 * A peça velha nunca teve teste, e é ela que faz certo o que o primitivo faz
 * errado: liga o gatilho ao rótulo e ao valor por `aria-labelledby`, então o
 * nome acessível do botão é "Situação Todas", e não só "Todas". É por isso que
 * os helpers daqui compõem rótulo e valor.
 *
 * Este arquivo é o critério de aceitação da fusão: depois que Contas passar a
 * consumir o primitivo, ele tem que passar SEM UMA EDIÇÃO.
 */

const OPCOES = {
  situacao: ["Em aberto", "Quitado"],
  categoria: ["Servicos prestados", "Materiais"],
  contraparte: ["Alfa Mineração", "Beta Logística"],
};

const VALORES_VAZIOS = {
  situacao: [],
  categoria: [],
  contraparte: [],
  dataInicio: "",
  dataFim: "",
};

function montar(
  sobrescreve: Partial<Parameters<typeof FiltrosDeContas>[0]> = {},
) {
  const props = {
    rotuloDaContraparte: "Cliente",
    opcoes: OPCOES,
    valores: VALORES_VAZIOS,
    preset: "todos",
    onSituacao: vi.fn(),
    onCategoria: vi.fn(),
    onContraparte: vi.fn(),
    onPreset: vi.fn(),
    onDataInicio: vi.fn(),
    onDataFim: vi.fn(),
    ...sobrescreve,
  };
  render(<FiltrosDeContas {...props} />);
  return props;
}

/** O gatilho daquele filtro. O nome acessível é "<rótulo> <valor>". */
function gatilho(rotulo: string, valor: string) {
  return screen.getByRole("button", { name: `${rotulo} ${valor}` });
}

function abrir(rotulo: string, valor: string) {
  fireEvent.click(gatilho(rotulo, valor));
}

/** O painel daquele filtro — botão e painel são irmãos no mesmo container. */
function painel(rotulo: string, valor: string) {
  return gatilho(rotulo, valor).parentElement as HTMLElement;
}

describe("MultiSelect na barra de filtros de Contas", () => {
  it("o gatilho anuncia o rotulo junto com o estado", () => {
    montar();
    expect(gatilho("Situação", "Todas")).toBeInTheDocument();
    expect(gatilho("Categoria", "Todas")).toBeInTheDocument();
    expect(gatilho("Cliente", "Todos")).toBeInTheDocument();
  });

  it("com selecao, o gatilho troca o placeholder pela contagem", () => {
    montar({ valores: { ...VALORES_VAZIOS, situacao: ["Em aberto"] } });
    expect(gatilho("Situação", "1 selecionado(s)")).toBeInTheDocument();
  });

  it("o rotulo da contraparte muda com a tela", () => {
    montar({ rotuloDaContraparte: "Fornecedor" });
    expect(gatilho("Fornecedor", "Todos")).toBeInTheDocument();
  });

  it("abrir mostra as opcoes daquele filtro, e so daquele", () => {
    montar();
    abrir("Situação", "Todas");
    const dentro = within(painel("Situação", "Todas"));
    expect(
      dentro.getByRole("checkbox", { name: "Em aberto" }),
    ).toBeInTheDocument();
    expect(
      dentro.getByRole("checkbox", { name: "Quitado" }),
    ).toBeInTheDocument();
    expect(dentro.queryByRole("checkbox", { name: "Materiais" })).toBeNull();
  });

  it("a busca filtra a lista daquele filtro", () => {
    montar();
    abrir("Categoria", "Todas");
    const dentro = within(painel("Categoria", "Todas"));
    fireEvent.change(dentro.getByPlaceholderText("Pesquisar..."), {
      target: { value: "mater" },
    });
    expect(
      dentro.getByRole("checkbox", { name: "Materiais" }),
    ).toBeInTheDocument();
    expect(
      dentro.queryByRole("checkbox", { name: "Servicos prestados" }),
    ).toBeNull();
  });

  it("sem resultado, diz que nao achou", () => {
    montar();
    abrir("Categoria", "Todas");
    const dentro = within(painel("Categoria", "Todas"));
    fireEvent.change(dentro.getByPlaceholderText("Pesquisar..."), {
      target: { value: "zzz" },
    });
    expect(dentro.getByText("Nenhum resultado encontrado")).toBeInTheDocument();
  });

  it("marcar avisa o pai com o valor acrescentado", () => {
    const props = montar();
    abrir("Situação", "Todas");
    fireEvent.click(
      within(painel("Situação", "Todas")).getByRole("checkbox", {
        name: "Quitado",
      }),
    );
    expect(props.onSituacao).toHaveBeenCalledWith(["Quitado"]);
  });

  it("marcar de novo o que ja estava avisa o pai com o valor removido", () => {
    const props = montar({
      valores: { ...VALORES_VAZIOS, situacao: ["Quitado"] },
    });
    abrir("Situação", "1 selecionado(s)");
    fireEvent.click(
      within(painel("Situação", "1 selecionado(s)")).getByRole("checkbox", {
        name: "Quitado",
      }),
    );
    expect(props.onSituacao).toHaveBeenCalledWith([]);
  });

  it("'Limpar selecao' zera aquele filtro", () => {
    const props = montar({
      valores: { ...VALORES_VAZIOS, categoria: ["Materiais"] },
    });
    abrir("Categoria", "1 selecionado(s)");
    fireEvent.click(
      within(painel("Categoria", "1 selecionado(s)")).getByRole("button", {
        name: "Limpar seleção",
      }),
    );
    expect(props.onCategoria).toHaveBeenCalledWith([]);
  });

  it("clicar fora fecha o dropdown", () => {
    montar();
    abrir("Situação", "Todas");
    expect(
      within(painel("Situação", "Todas")).getByPlaceholderText("Pesquisar..."),
    ).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(
      within(painel("Situação", "Todas")).queryByPlaceholderText(
        "Pesquisar...",
      ),
    ).toBeNull();
  });
});
```

- [ ] **Passo 2: rodar e ajustar os seletores até passar contra o código de hoje**

Rodar: `npx vitest run src/pages/contas/FiltrosDeContas.multiselect.test.tsx`
Esperado: 10 passando.

Se algum falhar, o código de hoje é a verdade — **ajustar o teste, nunca o componente.** Esta task não muda uma linha de produção.

Um ponto provável de ajuste: o campo de busca de `MultiSelectDeContas` tem `aria-label={`Pesquisar em ${rotulo}`}` além do `placeholder="Pesquisar..."`. `getByPlaceholderText` não é afetado por `aria-label`, então deve funcionar como escrito; se não funcionar, usar `getByLabelText(`Pesquisar em ${rotulo}`)` e anotar a diferença no relatório.

- [ ] **Passo 3: provar que o teste enxerga**

Plantar, uma de cada vez, revertendo depois:

1. Em `src/pages/contas/MultiSelectDeContas.tsx`, trocar `aria-labelledby={`${idDoRotulo} ${idDoValor}`}` por `aria-labelledby={idDoValor}`.
   Esperado: os testes que compõem o nome caem. É a prova de que a caracterização mede o rótulo acessível, que é o ponto inteiro deste arquivo.
2. Trocar o `filter` da busca por `() => true`.
   Esperado: "a busca filtra a lista daquele filtro" e "sem resultado, diz que nao achou" caem.

**Reverter as duas e confirmar `git status --short` só com o arquivo novo.** Reportar quantos testes cada plantação derrubou.

- [ ] **Passo 4: suíte inteira, lint e tsc**

Rodar: `npm test && npm run lint && npx tsc --noEmit`
Esperado: 1367 testes (1357 + 10) / 85 arquivos, lint ≤ 119, tsc limpo.

- [ ] **Passo 5: commit**

```bash
git add src/pages/contas/FiltrosDeContas.multiselect.test.tsx
git commit -m "test(contas): caracteriza os tres MultiSelect antes de fundir"
```

---

### Task 2: o primitivo fecha com Escape

Independente do rótulo, e por isso vem sozinho: é a única parte do bloco de acessibilidade que não muda o nome acessível de nada, então não mexe em teste nenhum das seis telas.

**Files:**

- Modify: `src/design-system/ui/forms/MultiSelect.tsx`
- Modify: `src/design-system/ui/forms/MultiSelect.test.tsx`

**Interfaces:**

- Consome: nada novo.
- Produz: nenhuma mudança de API. `MultiSelectProps` continua igual.

- [ ] **Passo 1: escrever o teste que falha**

Acrescentar a `src/design-system/ui/forms/MultiSelect.test.tsx`:

```tsx
it("Escape fecha o painel e devolve o foco ao gatilho", () => {
  render(
    <MultiSelect
      opcoes={OPCOES}
      selecionados={[]}
      onChange={() => {}}
      placeholder="Todos"
    />,
  );
  const gatilho = screen.getByRole("button", { name: "Todos" });
  fireEvent.click(gatilho);
  expect(screen.getByPlaceholderText("Pesquisar...")).toBeInTheDocument();

  fireEvent.keyDown(gatilho, { key: "Escape" });

  expect(screen.queryByPlaceholderText("Pesquisar...")).toBeNull();
  expect(document.activeElement).toBe(gatilho);
});
```

- [ ] **Passo 2: rodar e ver falhar pelo motivo certo**

Rodar: `npx vitest run src/design-system/ui/forms/MultiSelect.test.tsx`
Esperado: FALHA — o painel continua aberto, porque nada escuta a tecla.

- [ ] **Passo 3: implementar**

Em `src/design-system/ui/forms/MultiSelect.tsx`, dar um ref ao gatilho e escutar a tecla no container:

```tsx
const containerRef = useRef<HTMLDivElement>(null);
const gatilhoRef = useRef<HTMLButtonElement>(null);

function aoTeclar(evento: React.KeyboardEvent<HTMLDivElement>) {
  if (evento.key === "Escape" && aberto) {
    setAberto(false);
    gatilhoRef.current?.focus();
  }
}
```

O container passa a ser:

```tsx
    <div className="relative" ref={containerRef} onKeyDown={aoTeclar}>
```

e o gatilho ganha `ref={gatilhoRef}`.

O `SearchSelect` da mesma pasta já faz assim (`SearchSelect.tsx`, `aoTeclar` no container) — seguir o padrão irmão, não inventar outro. Importar `type React` se o arquivo ainda não importar.

- [ ] **Passo 4: rodar e ver passar, e os guardas junto**

Rodar: `npx vitest run src/design-system/ui/forms/MultiSelect.test.tsx && npx vitest run src/test`
Esperado: o arquivo do primitivo passa inteiro; guardas do design system 35/10 verdes.

- [ ] **Passo 5: provar que o teste enxerga**

Trocar `evento.key === "Escape"` por `evento.key === "Enter"`, rodar, confirmar que o teste novo falha, e reverter. Reportar a saída.

- [ ] **Passo 6: suíte inteira, lint e tsc**

Rodar: `npm test && npm run lint && npx tsc --noEmit`
Esperado: 1368 testes / 85 arquivos, lint ≤ 119, tsc limpo.

- [ ] **Passo 7: commit**

```bash
git add src/design-system/ui/forms/MultiSelect.tsx src/design-system/ui/forms/MultiSelect.test.tsx
git commit -m "feat(ds): MultiSelect fecha com Escape e devolve o foco"
```

---

### Task 3: o `rotulo` obrigatório e o resto da acessibilidade

**É uma task só, e é atômica por construção:** `rotulo` obrigatório quebra os 15 call sites no mesmo instante em que é declarado, então o primitivo, as seis telas e as 30 consultas de teste andam juntos ou o `tsc` fica vermelho.

**Files:**

- Modify: `src/design-system/ui/forms/MultiSelect.tsx`
- Modify: `src/design-system/ui/forms/MultiSelect.test.tsx`
- Modify: `src/pages/Produtos.tsx`, `Servicos.tsx`, `Vendedores.tsx`, `Estoque.tsx`, `Clientes.tsx`, `Vendas.tsx`
- Modify: os seis `src/pages/*.multiselect.test.tsx`

**Interfaces:**

- Produz: `MultiSelectProps` ganha `rotulo: string` obrigatório, primeira prop. As demais não mudam. A Task 4 consome exatamente essa assinatura.

- [ ] **Passo 1: escrever os testes que falham**

Acrescentar a `src/design-system/ui/forms/MultiSelect.test.tsx` (o `rotulo` passa a ser obrigatório em todos os `render` do arquivo — acrescentar `rotulo="Produto"` aos existentes, que é edição autorizada por a prop ser nova e obrigatória):

```tsx
it("o nome acessivel do gatilho soma o rotulo e o estado", () => {
  render(
    <MultiSelect
      rotulo="Produto"
      opcoes={OPCOES}
      selecionados={[]}
      onChange={() => {}}
      placeholder="Todos"
    />,
  );
  // O rotulo sozinho SUBSTITUIRIA o estado se fosse `htmlFor`; `aria-labelledby`
  // com os dois ids soma as duas coisas, que e o que interessa a quem usa
  // leitor de tela: "Produto, Todos".
  expect(
    screen.getByRole("button", { name: "Produto Todos" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Todos" })).toBeNull();
});

it("o painel e um grupo rotulado, e nao um listbox", () => {
  render(
    <MultiSelect
      rotulo="Produto"
      opcoes={OPCOES}
      selecionados={[]}
      onChange={() => {}}
      placeholder="Todos"
    />,
  );
  const gatilho = screen.getByRole("button", { name: "Produto Todos" });
  fireEvent.click(gatilho);

  // Um botao que abre um painel de checkboxes e disclosure, nao listbox.
  // A peca de Contas prometia `aria-haspopup="listbox"` e entregava um <div>
  // com checkboxes dentro; a promessa nao e portada.
  expect(gatilho).not.toHaveAttribute("aria-haspopup");
  expect(screen.getByRole("group", { name: "Produto" })).toBeInTheDocument();
  expect(screen.queryByRole("listbox")).toBeNull();
});

it("o campo de busca diz em que campo se esta buscando", () => {
  render(
    <MultiSelect
      rotulo="Produto"
      opcoes={OPCOES}
      selecionados={[]}
      onChange={() => {}}
      placeholder="Todos"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Produto Todos" }));
  expect(screen.getByLabelText("Pesquisar em Produto")).toBeInTheDocument();
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/design-system/ui/forms/MultiSelect.test.tsx`
Esperado: FALHA de tipo no `tsc` e falha nos três testes novos — não existe `rotulo`.

- [ ] **Passo 3: implementar no primitivo**

Em `src/design-system/ui/forms/MultiSelect.tsx`:

1. `useId` entra no import do React.
2. A interface ganha a prop, como primeira:

```tsx
export interface MultiSelectProps {
  /** Rótulo do campo — "Empresas", "Situação", "Cliente (Tomador)". */
  rotulo: string;
  opcoes: OpcaoDeMultiSelect[];
  selecionados: string[];
  onChange: (selecionados: string[]) => void;
  placeholder: string;
  /** Como o termo digitado casa com uma opção. Ver `buscaDeMultiSelect.ts`. */
  buscarPor?: EstrategiaDeBusca;
}
```

3. Dentro do componente, os dois ids:

```tsx
// O gatilho é um `<button>`, não um campo de formulário. `<label for>` até é
// HTML válido apontando para um botão, mas ele SUBSTITUI o nome acessível:
// quem usa leitor de tela ouviria "Empresas" e perderia "3 selecionado(s)",
// que é o estado do filtro. `aria-labelledby` com os dois ids soma as duas
// coisas — "Empresas, 3 selecionado(s)".
const id = useId();
const idDoRotulo = `${id}-rotulo`;
const idDoValor = `${id}-valor`;
```

4. A raiz passa a ser a da peça velha, com o `<label>` como primeiro filho. **O botão e o painel continuam irmãos dentro dessa mesma `div`** — é disso que os `within(botao.parentElement!)` dos testes dependem:

```tsx
    <div className="relative flex flex-col gap-1.5" ref={containerRef} onKeyDown={aoTeclar}>
      <label id={idDoRotulo} className="text-sm font-medium text-conteudo">
        {rotulo}
      </label>

      <button
        type="button"
        ref={gatilhoRef}
        aria-expanded={aberto}
        aria-labelledby={`${idDoRotulo} ${idDoValor}`}
        onClick={() => setAberto((valor) => !valor)}
        className={[
          "w-full rounded-lg border bg-surface px-3 py-2 text-left transition-colors",
          "border-borda hover:bg-surface-elevated",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        ].join(" ")}
      >
        <span id={idDoValor} className="text-sm text-conteudo">
          {selecionados.length > 0 ? `${selecionados.length} selecionado(s)` : placeholder}
        </span>
      </button>
```

O `className` do gatilho é o que já está lá — está repetido acima só para o
bloco ser copiável inteiro. **Não mudar classe nenhuma nesta task.**

5. O campo de busca ganha o rótulo acessível:

```tsx
              aria-label={`Pesquisar em ${rotulo}`}
```

6. O painel ganha o papel — o `role="group"` vai no `<div>` que **envolve as opções**, não no painel inteiro, para não englobar a busca e o "Limpar seleção":

```tsx
<div role="group" aria-label={rotulo}>
  {opcoesFiltradas.length > 0 ? (
    opcoesFiltradas.map((opcao) => (
      <label
        key={opcao.valor}
        className="flex cursor-pointer items-center px-4 py-2 hover:bg-surface-elevated"
      >
        <input
          type="checkbox"
          checked={selecionados.includes(opcao.valor)}
          onChange={() => alternar(opcao.valor)}
          className="mr-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
        <span className="text-conteudo">{opcao.rotulo}</span>
      </label>
    ))
  ) : (
    <div className="px-4 py-2 text-conteudo-muted">
      Nenhum resultado encontrado
    </div>
  )}
</div>
```

O miolo é o que já existe, sem uma alteração — a mudança é só a `<div role="group">`
envolvendo. ⚠️ **O `<label>` continua envolvendo o `<input type="checkbox">` e o
texto, sem `htmlFor`.** É dessa associação implícita que sai o nome acessível que
41 testes usam para achar as opções; quebrá-la derruba as seis telas de uma vez.

**Não** acrescentar `aria-haspopup`. **Não** acrescentar `role="listbox"` nem `role="option"`.

- [ ] **Passo 4: rodar o teste do primitivo**

Rodar: `npx vitest run src/design-system/ui/forms/MultiSelect.test.tsx`
Esperado: passa inteiro, incluindo os três novos.

- [ ] **Passo 5: as seis telas passam o rótulo**

Em cada uma das seis, para cada `<MultiSelect>`: acrescentar `rotulo="<texto>"` como primeira prop e **apagar o `<label>` que fica logo acima**, usando a tabela "Os 15 usos e seus rótulos, medidos" deste plano.

⚠️ **O `<div>` que envolve o filtro FICA.** Ele é a célula do grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-6`); só o `<label>` interno sai. Apagar o `<div>` junto quebra o layout dos filtros.

Exemplo, em `src/pages/Produtos.tsx` — de:

```tsx
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Empresas
              </label>
              <MultiSelect
                opcoes={deTextos(empresasUnicas)}
```

para:

```tsx
            <div>
              <MultiSelect
                rotulo="Empresas"
                opcoes={deTextos(empresasUnicas)}
```

Depois de fazer as seis, conferir que nenhum `<label>` de MultiSelect sobrou:

Rodar: `grep -c 'text-gray-700 dark:text-gray-300' src/pages/{Produtos,Servicos,Vendedores,Estoque,Clientes,Vendas}.tsx`
Esperado: 15 ocorrências a menos que antes. Anotar o antes e o depois no relatório.

- [ ] **Passo 6: as 30 consultas ao gatilho**

Em cada um dos seis `*.multiselect.test.tsx`, o nome esperado do gatilho passa de `"<placeholder>"` para `"<rótulo> <placeholder>"`, e de `"1 selecionado(s)"` para `"<rótulo> 1 selecionado(s)"`.

O jeito mais seguro é mudar os helpers para receberem o rótulo. Em `Produtos.multiselect.test.tsx`, de:

```tsx
function abrir(placeholder: string) {
  fireEvent.click(screen.getByRole("button", { name: placeholder }));
}
```

para:

```tsx
function abrir(rotulo: string, valor: string) {
  fireEvent.click(screen.getByRole("button", { name: `${rotulo} ${valor}` }));
}
```

e o mesmo em `containerDoFiltro`. As consultas soltas no corpo dos testes passam a compor o nome do mesmo jeito.

**A contagem é o guarda:** Clientes 6, Estoque 6, Vendas 6, Produtos 4, Serviços 4, Vendedores 4 = **30**. As seis consultas a `"Limpar seleção"` **não** mudam.

**Se uma falha aparecer fora dessa contagem — em asserção que não é nome de gatilho —, a mudança vazou para além do rótulo: parar e reportar com o nome do teste e a saída, em vez de ajustar.**

- [ ] **Passo 7: provar que a mudança enxerga**

Trocar `aria-labelledby={`${idDoRotulo} ${idDoValor}`}` por `aria-labelledby={idDoValor}` no primitivo, rodar os seis arquivos de caracterização e confirmar que caem. Reverter.

Rodar: `npx vitest run src/pages`
Reportar quantos caíram.

- [ ] **Passo 8: suíte inteira, lint, tsc e guardas**

Rodar: `npm test && npm run lint && npx tsc --noEmit && npx vitest run src/test`
Esperado: 1371 testes / 85 arquivos, lint ≤ 119, tsc limpo, guardas 35/10.

- [ ] **Passo 9: commit**

```bash
git add src/design-system/ui/forms/MultiSelect.tsx src/design-system/ui/forms/MultiSelect.test.tsx src/pages/Produtos.tsx src/pages/Servicos.tsx src/pages/Vendedores.tsx src/pages/Estoque.tsx src/pages/Clientes.tsx src/pages/Vendas.tsx src/pages/Produtos.multiselect.test.tsx src/pages/Servicos.multiselect.test.tsx src/pages/Vendedores.multiselect.test.tsx src/pages/Estoque.multiselect.test.tsx src/pages/Clientes.multiselect.test.tsx src/pages/Vendas.multiselect.test.tsx
git commit -m "feat(ds): MultiSelect e dono do proprio rotulo acessivel"
```

---

### Task 4: Contas consome o primitivo, e a peça velha é apagada

**Files:**

- Modify: `src/pages/contas/FiltrosDeContas.tsx`
- Delete: `src/pages/contas/MultiSelectDeContas.tsx`

**Interfaces:**

- Consome: `MultiSelect` e `deTextos` de `../../design-system/ui`, com a assinatura que a Task 3 produziu.

- [ ] **Passo 1: trocar os três usos**

Em `src/pages/contas/FiltrosDeContas.tsx`, trocar o import de `MultiSelectDeContas` por `MultiSelect` e `deTextos` no import que já existe do design system, e nos três usos: `opcoes={deTextos(...)}` e `selecionadas` → `selecionados`. O `rotulo` e o `placeholder` continuam iguais.

De:

```tsx
<MultiSelectDeContas
  rotulo="Situação"
  opcoes={opcoes.situacao}
  selecionadas={valores.situacao}
  onChange={onSituacao}
  placeholder="Todas"
/>
```

para:

```tsx
<MultiSelect
  rotulo="Situação"
  opcoes={deTextos(opcoes.situacao)}
  selecionados={valores.situacao}
  onChange={onSituacao}
  placeholder="Todas"
/>
```

Idem para `Categoria` (placeholder "Todas") e para a contraparte (`rotulo={rotuloDaContraparte}`, placeholder "Todos").

**Não** passar `buscarPor`: a busca de Contas é a padrão (`buscaPorTexto`, casa pelo rótulo), e é o que a peça velha fazia — `opcoes.filter(o => o.toLowerCase().includes(busca.toLowerCase()))`. Conferir isso no código que vai apagar antes de trocar; **se divergir, parar e reportar** em vez de adaptar qualquer um dos lados.

- [ ] **Passo 2: rodar a caracterização da Task 1**

Rodar: `npx vitest run src/pages/contas/FiltrosDeContas.multiselect.test.tsx`
Esperado: **10 passando, sem uma edição no arquivo de teste.**

É o critério da task. Se algum falhar, a fusão mudou comportamento em Contas: **parar, entender e reportar**, não editar o teste para caber.

- [ ] **Passo 3: apagar a peça velha**

```bash
git rm src/pages/contas/MultiSelectDeContas.tsx
```

Conferir que ninguém mais a referencia:

Rodar: `grep -rn "MultiSelectDeContas" src/`
Esperado: nada.

- [ ] **Passo 4: conferir que não sobrou órfão**

Apagar um arquivo e trocar imports costuma deixar pendurado import não usado no consumidor.

Rodar: `npx eslint src/pages/contas/FiltrosDeContas.tsx`
Esperado: sem acusação de import ou variável não usada.

- [ ] **Passo 5: suíte inteira, lint e tsc**

Rodar: `npm test && npm run lint && npx tsc --noEmit`
Esperado: 1371 testes / 85 arquivos (a contagem não muda: nenhum teste foi acrescentado nem removido), lint **abaixo** de 119 — 156 linhas saíram do repositório —, tsc limpo.

- [ ] **Passo 6: commit**

```bash
git add src/pages/contas/FiltrosDeContas.tsx
git commit -m "refactor(contas): consome o MultiSelect do design system"
```

---

### Task 5: fechar a conta

**Files:**

- Modify: `docs/superpowers/2026-09-01-multiselect-divergencias.md`

- [ ] **Passo 1: conferir os critérios do spec, um por um**

```bash
grep -rn "MultiSelectDeContas" src/                      # esperado: nada
grep -rn "aria-haspopup" src/ --include=*.tsx | grep -v "\.test\."  # esperado: so SearchSelect.tsx
grep -rn "role=\"listbox\"\|role=\"option\"" src/design-system/ui/forms/MultiSelect.tsx  # esperado: nada
grep -c "text-gray-700 dark:text-gray-300" src/pages/Produtos.tsx src/pages/Servicos.tsx src/pages/Vendedores.tsx src/pages/Estoque.tsx src/pages/Clientes.tsx src/pages/Vendas.tsx  # 15 a menos que o antes anotado na Task 3
grep -rn "<MultiSelect" src/pages/*.tsx | wc -l                    # esperado: 15
```

Anotar cada resultado no relatório. Um critério que não se verifica por comando não está verificado.

- [ ] **Passo 2: medir o que saiu**

Rodar: `git diff --stat main..HEAD`
Anotar o saldo. Esperado: as 156 linhas de `MultiSelectDeContas.tsx` a menos, mais os 15 `<label>` das telas, contra o que o primitivo e os testes acrescentaram.

- [ ] **Passo 3: atualizar o documento de divergências**

O item 7 ("A sétima cópia, e o que ela tem que o primitivo não tem") deixou de ser pendência. Reescrevê-lo para registrar o que foi feito e o que foi decidido, mantendo o que continua valendo:

- a fusão aconteceu, e `MultiSelectDeContas` não existe mais;
- o primitivo passou a ser dono do rótulo, com `aria-labelledby` somando rótulo e estado;
- a semântica escolhida foi disclosure com `role="group"`, **não** listbox, e por quê — um painel de checkboxes não é uma lista de opções, e os 41 testes acham as opções por `getByRole("checkbox")`;
- o `aria-haspopup="listbox"` que a peça velha declarava sem entregar não foi portado;
- **o que continua aberto:** a casca compartilhada com o `SearchSelect`, que é a próxima conversa e não foi decidida aqui.

Não inflar: o item encolhe, porque virou histórico em vez de pendência.

- [ ] **Passo 4: commit**

```bash
git add docs/superpowers/2026-09-01-multiselect-divergencias.md
git commit -m "docs: o item 7 das divergencias virou historico"
```

---

## Depois deste plano

O `SearchSelect` e o `MultiSelect` passam a ser as duas peças de seleção com busca do design system, cada uma com o papel ARIA que de fato entrega. Se valer uma casca compartilhada entre as duas, é aí que a pergunta fica bem posta — com os dois lados já corretos.

Continuam esperando decisão, no documento de divergências: as quatro estratégias de busca, o ramo morto de Clientes, o helper `dePares`, as dívidas de teste e a conferência no navegador.
