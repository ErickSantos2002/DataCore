# Fase 4, item 3 — a exportação para Excel vira `src/lib/planilha.ts`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fazer com que `json_to_sheet`, `book_new`, `book_append_sheet` e
`writeFile` apareçam uma vez só no repositório, e com que o nome do arquivo
exportado pare de sair em UTC nas sete telas que hoje erram.

**Architecture:** três movimentos. **M1** sobe `diaLocal` para `src/lib/datas.ts`,
onde ela já devia estar, e apaga a cópia de `AbaComissao`. **M2** extrai
`baixarPlanilha` **sem tocar no nome do arquivo** — os quatro testes que já
afirmam sobre exportação são o critério de aceitação. **M3** conserta o UTC nas
sete, tela a tela, com plantação.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest + Testing Library (jsdom),
biblioteca `xlsx` (SheetJS).

**Spec:** `docs/superpowers/specs/2026-09-03-fase-4-planilha-design.md`

## Global Constraints

- Código, comentários, interface e mensagem de commit em **português do Brasil**.
- Commits em conventional commits, **sem acento** na mensagem.
- **Importar por caminho relativo**, nunca por `@/`. O `CLAUDE.md` traz
  `"@/design-system/ui"` como exemplo, mas **esse alias não existe**: o
  `tsconfig.json` não tem `paths` e o `src/` tem zero ocorrências. O Vite
  resolveria e o `tsc --noEmit` quebraria.
- Baseline que não pode regredir: **1426 testes / 92 arquivos**, lint **119**,
  `tsc --noEmit` limpo. O lint não pode subir.
- A suíte tem de passar com `TZ=UTC` **e** `TZ=America/Sao_Paulo`.
- As seis telas não migradas continuam em `PENDENTES_FASE_3` — este item **não**
  migra tela; paleta crua e `dark:` remanescentes não são escopo.
- **Não fazer `git push`.** O repositório está à frente do `origin/main` de
  propósito.
- Comentário no código explica **por que**, com o defeito concreto que a decisão
  evitou. É o estilo do repositório.

## Estrutura de arquivos

**Criar:**

| Arquivo                    | Responsabilidade                                           |
| -------------------------- | ---------------------------------------------------------- |
| `src/lib/planilha.ts`      | o esqueleto do `xlsx`: monta o livro, anexa as abas, baixa |
| `src/lib/planilha.test.ts` | teste do esqueleto, incluindo o caso de duas abas          |

**Modificar:**

| Arquivo                                                                | O quê                                          |
| ---------------------------------------------------------------------- | ---------------------------------------------- |
| `src/lib/datas.ts`                                                     | ganha `diaLocal`                               |
| `src/lib/datas.test.ts`                                                | ganha o teste de `diaLocal`, com virada de dia |
| `src/pages/contas/contas.ts`                                           | deixa de declarar `diaLocal`, passa a importar |
| `src/pages/financeiro/AbaComissao.tsx`                                 | apaga `dataDeHoje`, usa `diaLocal`; duas abas  |
| `src/pages/contas/TelaDeContas.tsx`                                    | consome `baixarPlanilha`                       |
| `src/pages/locacao/notasDeLocacao.ts`                                  | `nomeDoArquivo` passa a usar `diaLocal`        |
| `src/pages/Locacao.tsx`                                                | consome `baixarPlanilha`                       |
| `src/pages/{Clientes,Estoque,Produtos,Servicos,Vendas,Vendedores}.tsx` | idem, e o conserto do UTC                      |
| `src/pages/Locacao.test.tsx`                                           | **uma edição autorizada** (M3)                 |
| `src/pages/locacao/notasDeLocacao.test.ts`                             | **uma edição autorizada** (M3)                 |

## As nove exportações, medidas

**Errar uma destas é errar a task.** Cada linha é o estado de hoje.

| #   | Arquivo                      | Linhas                  | Aba                         | Nome do arquivo hoje                       | UTC?    |
| --- | ---------------------------- | ----------------------- | --------------------------- | ------------------------------------------ | ------- |
| 1   | `Clientes.tsx`               | `dadosExport`           | `"Clientes"`                | `` `clientes_${…}.xlsx` ``                 | **sim** |
| 2   | `Estoque.tsx`                | `dadosExport`           | `"Estoque"`                 | `` `estoque_${…}.xlsx` ``                  | **sim** |
| 3   | `Produtos.tsx`               | `dadosExport`           | `"Produtos"`                | `` `produtos_${…}.xlsx` ``                 | **sim** |
| 4   | `Servicos.tsx`               | `dadosExport`           | `"Serviços"`                | `` `servicos_${…}.xlsx` ``                 | **sim** |
| 5   | `Vendas.tsx`                 | `dadosExport`           | `"Vendas"`                  | `` `vendas_${…}.xlsx` ``                   | **sim** |
| 6   | `Vendedores.tsx`             | `dadosExport`           | `"Minhas Vendas"`           | `` `vendas_${vendedorLogado}_${…}.xlsx` `` | **sim** |
| 7   | `locacao/notasDeLocacao.ts`  | `linhasDaPlanilha(...)` | `ABA_DA_PLANILHA`           | `nomeDoArquivo()`                          | **sim** |
| 8   | `contas/TelaDeContas.tsx`    | `linhasDaPlanilha(...)` | `configuracao.planilha.aba` | `nomeDoArquivo(prefixo, new Date())`       | não     |
| 9   | `financeiro/AbaComissao.tsx` | duas listas             | `"Vendas"` e `"Serviço"`    | `` `comissao-${dataDeHoje()}.xlsx` ``      | não     |

`${…}` é sempre `new Date().toISOString().split('T')[0]` nas seis primeiras.

**Duas exceções de forma, e as duas mudam o desenho:**

- **`AbaComissao` monta duas abas no mesmo arquivo** — é o único caso que
  exercita a lista com mais de um elemento.
- **`Vendedores` mexe na folha depois de montada** — define `ws['!cols']` com
  nove larguras e varre as células das colunas `E` e `F` pondo `t: "n"` e
  `z: "#,##0.00"`. É a única das nove que faz isso, e o motivo de existir o
  `ajustar` opcional.

## A rede que já existe

Quatro arquivos de teste mockam o módulo `xlsx` e capturam o que foi mandado
para ele. **Eles são o critério de aceitação do M2** e não podem ser editados lá:

| Teste                                       | Captura                               |
| ------------------------------------------- | ------------------------------------- |
| `src/pages/Locacao.test.tsx`                | `{ linhas, aba, arquivo }`            |
| `src/pages/ContasPagar.test.tsx`            | idem                                  |
| `src/pages/ContasReceber.test.tsx`          | idem                                  |
| `src/pages/financeiro/AbaComissao.test.tsx` | `{ abas: [{nome, linhas}], arquivo }` |

O mock é de **módulo** (`vi.mock("xlsx", ...)`), então ele intercepta a chamada
venha ela da tela ou de `src/lib/planilha.ts`. É por isso que a extração pode
acontecer sem tocar nesses arquivos.

---

### Task 1: `diaLocal` sobe para `src/lib/datas.ts`

**Files:**

- Modify: `src/lib/datas.ts`
- Test: `src/lib/datas.test.ts`

**Interfaces:**

- Consumes: nada.
- Produces:

```ts
export function diaLocal(instante: Date): string; // "YYYY-MM-DD" no fuso local
```

As Tasks 2, 4 e 6 a 12 importam de `../lib/datas` ou `../../lib/datas`.

**Por que primeiro:** o M3 depende dela, e movê-la sozinha mantém o movimento
sem comportamento novo.

- [ ] **Passo 1: escrever os testes que falham**

Acrescentar a `src/lib/datas.test.ts`:

```ts
describe("diaLocal", () => {
  it("devolve o dia do calendario no fuso local", () => {
    expect(diaLocal(new Date("2026-08-28T12:00:00Z"))).toBe("2026-08-28");
  });

  it("as 23h locais ainda sao o mesmo dia, nao o seguinte", () => {
    // O defeito que esta funcao existe para evitar. O instante e construido em
    // hora LOCAL de proposito: assim a asserção vale em qualquer fuso, e o
    // teste nao precisa saber em qual esta rodando. Em Sao Paulo, este mesmo
    // instante e 02h de 29/08 em UTC — e `toISOString()` devolveria o dia
    // errado.
    const vinteETresHoras = new Date(2026, 7, 28, 23, 0, 0);
    expect(diaLocal(vinteETresHoras)).toBe("2026-08-28");
  });

  it("preenche mes e dia com zero a esquerda", () => {
    expect(diaLocal(new Date(2026, 0, 5, 12, 0, 0))).toBe("2026-01-05");
  });
});
```

Os três instantes são construídos em **hora local** (`new Date(ano, mes, dia,
hora, ...)`), nunca por string ISO. É o que faz a asserção valer nos dois fusos
sem o teste precisar consultar `process.env.TZ` — a propriedade que se afirma é
"o dia local de um instante local", e ela não muda de fuso para fuso.

Acrescentar `diaLocal` ao import de `./datas` no topo do arquivo.

- [ ] **Passo 2: rodar e ver falhar pelo motivo certo**

Run: `npx vitest run src/lib/datas.test.ts`
Expected: FAIL — `diaLocal is not a function` (ou erro de import).

- [ ] **Passo 3: implementar**

Acrescentar a `src/lib/datas.ts`:

```ts
/**
 * O dia do calendário de um instante, no fuso de quem está olhando.
 *
 * Existe porque `toISOString().split("T")[0]` devolve o dia em **UTC**: às 23h
 * de 28/08 em São Paulo já são 02h de 29/08 em UTC, e o nome do arquivo
 * exportado saía com a data do dia seguinte. O defeito foi corrigido em Contas
 * na Fase 1 e reencontrado em mais seis telas no item 3 da Fase 4.
 *
 * Veio de `pages/contas/contas.ts`, onde nasceu, e subiu para cá quando
 * apareceu a segunda cópia (`dataDeHoje`, em `financeiro/AbaComissao.tsx`).
 */
export function diaLocal(instante: Date): string {
  const ano = instante.getFullYear();
  const mes = String(instante.getMonth() + 1).padStart(2, "0");
  const dia = String(instante.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
```

- [ ] **Passo 4: rodar e ver passar, nos dois fusos**

```bash
TZ=UTC npx vitest run src/lib/datas.test.ts
TZ=America/Sao_Paulo npx vitest run src/lib/datas.test.ts
```

Expected: PASS nos dois.

- [ ] **Passo 5: provar que os testes enxergam**

Trocar o corpo por `return instante.toISOString().split("T")[0];` e rodar com
`TZ=America/Sao_Paulo`. Esperado: **falha o teste das 23h**. Reverter.

Rodando com `TZ=UTC` essa mesma plantação **passa** — em UTC as duas
implementações concordam. Isso não é falha do teste: é a demonstração de que o
defeito só aparece em fuso negativo, que é exatamente onde a empresa está.

Sem essa prova a task não está entregue — é exatamente o defeito que a função
existe para evitar.

- [ ] **Passo 6: suíte inteira, lint e tsc**

```bash
npm test && npm run lint && npx tsc --noEmit
```

Expected: 92 arquivos, 1426 + 3 = **1429 testes**, lint ≤ 119, `tsc` limpo.

- [ ] **Passo 7: commit**

```bash
git add src/lib/datas.ts src/lib/datas.test.ts
git commit -m "feat(lib): diaLocal sobe para lib/datas com teste de virada de dia"
```

---

### Task 2: os dois donos antigos passam a importar `diaLocal`

**Files:**

- Modify: `src/pages/contas/contas.ts` (apagar a declaração em `:258`, importar)
- Modify: `src/pages/financeiro/AbaComissao.tsx` (apagar `dataDeHoje` em `:34`)

**Interfaces:**

- Consumes: `diaLocal` de `src/lib/datas.ts` (Task 1).
- Produces: `diaLocal` e `dataDeHoje` não existem mais fora de `src/lib/datas.ts`.

**Cuidado:** `contas.ts` usa `diaLocal` em **dois** lugares — `:286` (o intervalo
do preset de período) e `:656` (o nome do arquivo). Os dois continuam
funcionando; só a declaração sai.

`contas.ts` **exporta** `diaLocal` hoje? Confira com
`grep -n "export function diaLocal" src/pages/contas/contas.ts`. Se exportar e
houver quem importe de lá, aponte esses imports para `../../lib/datas` também.

- [ ] **Passo 1: trocar em `contas.ts`**

Apagar a declaração de `diaLocal` e acrescentar ao import de datas no topo:

```ts
import { diaLocal } from "../../lib/datas";
```

Se o arquivo ainda não importa de `lib/datas`, criar a linha. **Caminho
relativo — o alias `@/` não existe.**

- [ ] **Passo 2: trocar em `AbaComissao.tsx`**

Apagar a função `dataDeHoje` inteira (linhas 34-39) e trocar o uso:

```ts
XLSX.writeFile(livro, `comissao-${diaLocal(new Date())}.xlsx`);
```

Import:

```ts
import { diaLocal } from "../../lib/datas";
```

- [ ] **Passo 3: rodar os testes dos dois consumidores**

```bash
npx vitest run src/pages/contas/ src/pages/financeiro/ src/pages/ContasPagar.test.tsx src/pages/ContasReceber.test.tsx
```

Expected: PASS **sem editar nenhum teste**. `diaLocal` e `dataDeHoje` tinham
corpos equivalentes, então nada de comportamento muda. Se algum teste quebrar,
os corpos não eram equivalentes — **pare e reporte a diferença**.

- [ ] **Passo 4: conferir que as cópias sumiram**

```bash
grep -rn "function diaLocal\|function dataDeHoje" src/
```

Expected: só `src/lib/datas.ts`.

- [ ] **Passo 5: suíte inteira, lint e tsc**

```bash
npm test && npm run lint && npx tsc --noEmit
```

Expected: 92 arquivos, **1429 testes**, lint ≤ 119, `tsc` limpo.

- [ ] **Passo 6: commit**

```bash
git add src/pages/contas/contas.ts src/pages/financeiro/AbaComissao.tsx
git commit -m "refactor(datas): contas e comissao consomem o diaLocal de lib"
```

---

### Task 3: `baixarPlanilha` — o esqueleto, sozinho

**Files:**

- Create: `src/lib/planilha.ts`
- Test: `src/lib/planilha.test.ts`

**Interfaces:**

- Consumes: nada.
- Produces:

```ts
export interface AbaDePlanilha {
  nome: string;
  linhas: Record<string, unknown>[];
  ajustar?: (folha: XLSX.WorkSheet) => void;
}

export function baixarPlanilha(abas: AbaDePlanilha[], arquivo: string): void;
```

As Tasks 4 a 12 chamam exatamente isso.

**A ordem das chamadas ao `xlsx` importa** e não é detalhe: os quatro testes que
já existem capturam `json_to_sheet`, `book_new`, `book_append_sheet` e
`writeFile`. A função tem de chamar as quatro, na ordem, com os mesmos
argumentos que as telas passam hoje.

- [ ] **Passo 1: escrever os testes que falham**

```ts
import { describe, expect, it, vi } from "vitest";

import { baixarPlanilha } from "./planilha";

/** O que a exportação mandou para o `xlsx`, sem tocar em disco. */
const capturado = vi.hoisted(() => ({
  abas: [] as { nome: string; linhas: Record<string, unknown>[] }[],
  arquivo: "",
}));

vi.mock("xlsx", () => ({
  utils: {
    json_to_sheet: (linhas: Record<string, unknown>[]) => ({ linhas }),
    book_new: () => ({ livro: true }),
    book_append_sheet: (
      _livro: unknown,
      folha: { linhas: Record<string, unknown>[] },
      nome: string,
    ) => {
      capturado.abas.push({ nome, linhas: folha.linhas });
    },
  },
  writeFile: (_livro: unknown, nome: string) => {
    capturado.arquivo = nome;
  },
}));

function limpar() {
  capturado.abas = [];
  capturado.arquivo = "";
}

describe("baixarPlanilha", () => {
  it("monta uma aba e batiza o arquivo", () => {
    limpar();
    baixarPlanilha(
      [{ nome: "Produtos", linhas: [{ Código: "P1", Produto: "Bafômetro" }] }],
      "produtos_2026-08-28.xlsx",
    );

    expect(capturado.abas).toEqual([
      { nome: "Produtos", linhas: [{ Código: "P1", Produto: "Bafômetro" }] },
    ]);
    expect(capturado.arquivo).toBe("produtos_2026-08-28.xlsx");
  });

  it("monta duas abas no mesmo arquivo, na ordem em que vieram", () => {
    // O caso de `financeiro/AbaComissao.tsx`, a unica das nove que exporta
    // duas abas. Sem este teste a lista de abas nasceria com um caminho sem
    // rede — e seria a chamadora mais complicada a descobrir o defeito.
    limpar();
    baixarPlanilha(
      [
        { nome: "Vendas", linhas: [{ Vendedor: "Ana" }] },
        { nome: "Serviço", linhas: [{ Vendedor: "Bruno" }] },
      ],
      "comissao-2026-08-28.xlsx",
    );

    expect(capturado.abas.map((a) => a.nome)).toEqual(["Vendas", "Serviço"]);
    expect(capturado.abas[1].linhas).toEqual([{ Vendedor: "Bruno" }]);
  });

  it("chama o ajustar da aba com a folha montada", () => {
    // A excecao de `Vendedores.tsx`, que define largura de coluna e formato
    // contabil DEPOIS que a folha existe.
    limpar();
    const vistas: unknown[] = [];
    baixarPlanilha(
      [
        {
          nome: "Minhas Vendas",
          linhas: [{ Valor: 10 }],
          ajustar: (folha) => vistas.push(folha),
        },
      ],
      "vendas_ana_2026-08-28.xlsx",
    );

    expect(vistas).toHaveLength(1);
    expect(vistas[0]).toEqual({ linhas: [{ Valor: 10 }] });
  });

  it("sem ajustar, nao quebra", () => {
    limpar();
    expect(() =>
      baixarPlanilha([{ nome: "Vazia", linhas: [] }], "vazia.xlsx"),
    ).not.toThrow();
    expect(capturado.arquivo).toBe("vazia.xlsx");
  });
});
```

- [ ] **Passo 2: rodar e ver falhar pelo motivo certo**

Run: `npx vitest run src/lib/planilha.test.ts`
Expected: FAIL — `Failed to resolve import "./planilha"`.

- [ ] **Passo 3: implementar**

```ts
import * as XLSX from "xlsx";

/** Uma aba do arquivo, com as linhas já montadas por quem chama. */
export interface AbaDePlanilha {
  /** O nome que aparece na guia, dentro do Excel. */
  nome: string;
  /** Uma linha por objeto; as chaves viram os cabeçalhos das colunas. */
  linhas: Record<string, unknown>[];
  /**
   * Ajuste na folha depois de montada — largura de coluna, formato de célula.
   *
   * **Hoje só `pages/Vendedores.tsx` usa**, e é por causa dela que existe: ela
   * define `!cols` com nove larguras e põe `t: "n"` e `z: "#,##0.00"` nas
   * colunas de valor, para saírem como número contábil em vez de texto. Se
   * aparecer uma segunda chamadora, pergunte se aquilo não devia ser o padrão
   * das nove em vez de exceção de uma.
   */
  ajustar?: (folha: XLSX.WorkSheet) => void;
}

/**
 * Monta um arquivo `.xlsx` com as abas dadas e dispara o download.
 *
 * Existe para que `json_to_sheet`, `book_new`, `book_append_sheet` e
 * `writeFile` apareçam **uma vez** no repositório. Antes do item 3 da Fase 4
 * eram nove cópias do mesmo esqueleto de quatro linhas, e sete delas montavam
 * o nome do arquivo em UTC — o defeito que fazia quem exportava depois das 21h
 * arquivar com a data do dia seguinte.
 *
 * **Não sabe nada de domínio.** Não formata número, não escolhe coluna, não
 * decide o nome do arquivo. As `linhas` chegam prontas e o `arquivo` chega
 * pronto; quem monta o nome usa `diaLocal` de `lib/datas`.
 */
export function baixarPlanilha(abas: AbaDePlanilha[], arquivo: string): void {
  const livro = XLSX.utils.book_new();

  for (const aba of abas) {
    const folha = XLSX.utils.json_to_sheet(aba.linhas);
    aba.ajustar?.(folha);
    XLSX.utils.book_append_sheet(livro, folha, aba.nome);
  }

  XLSX.writeFile(livro, arquivo);
}
```

**O `ajustar` roda antes do `book_append_sheet`**, porque é assim que
`Vendedores.tsx` faz hoje: ela mexe em `ws` depois de anexar, mas como `ws` é o
mesmo objeto, o efeito é idêntico e a ordem aqui é a mais previsível.

- [ ] **Passo 4: rodar e ver passar**

Run: `npx vitest run src/lib/planilha.test.ts`
Expected: PASS, 4 testes.

- [ ] **Passo 5: provar que os testes enxergam**

Trocar `aba.ajustar?.(folha)` por nada (apagar a linha) e rodar: falha "chama o
ajustar da aba com a folha montada". Reverter.

Depois inverter o laço (`[...abas].reverse()`) e rodar: falha o teste das duas
abas, que afirma a ordem. Reverter.

- [ ] **Passo 6: suíte inteira, lint e tsc**

```bash
npm test && npm run lint && npx tsc --noEmit
```

Expected: **93 arquivos**, 1429 + 4 = **1433 testes**, lint ≤ 119, `tsc` limpo.

- [ ] **Passo 7: commit**

```bash
git add src/lib/planilha.ts src/lib/planilha.test.ts
git commit -m "feat(lib): baixarPlanilha concentra o esqueleto do xlsx"
```

---

### Task 4: as três telas com teste passam a consumir `baixarPlanilha`

**Files:**

- Modify: `src/pages/contas/TelaDeContas.tsx`
- Modify: `src/pages/Locacao.tsx`
- Modify: `src/pages/financeiro/AbaComissao.tsx`
- Test: `Locacao.test.tsx`, `ContasPagar.test.tsx`, `ContasReceber.test.tsx`,
  `financeiro/AbaComissao.test.tsx` — **nenhum pode ser editado**

**Interfaces:**

- Consumes: `baixarPlanilha` e `AbaDePlanilha` (Task 3).
- Produces: o molde que as Tasks 5 a 10 repetem.

**Estas três primeiro, e o motivo é a rede.** São as únicas cujo comportamento
de exportação já está fixado em teste. Se a extração muda alguma coisa, é aqui
que aparece — antes de tocar nas seis que não têm rede nenhuma.

**O critério é duro: os quatro arquivos de teste passam sem UMA edição.** Se
algum falhar, a extração alterou comportamento: **pare e reporte o quê**, não
ajuste o teste.

- [ ] **Passo 1: `TelaDeContas.tsx`**

Trocar o corpo do `exportar`:

```tsx
const exportar = useCallback(() => {
  const linhas = linhasDaPlanilha(daTabela, dialeto, configuracao.planilha);
  baixarPlanilha(
    [{ nome: configuracao.planilha.aba, linhas }],
    nomeDoArquivo(configuracao.planilha.prefixoDoArquivo, new Date()),
  );
}, [daTabela, dialeto, configuracao.planilha]);
```

Import: `import { baixarPlanilha } from "../../lib/planilha";`
Apagar o import de `XLSX` se ele ficar sem uso no arquivo.

- [ ] **Passo 2: `Locacao.tsx`**

```tsx
baixarPlanilha(
  [{ nome: ABA_DA_PLANILHA, linhas: linhasDaPlanilha(notasTabela) }],
  nomeDoArquivo(),
);
```

Import: `import { baixarPlanilha } from "../lib/planilha";`
**Não** toque em `nomeDoArquivo` — o UTC dela é a Task 11.

- [ ] **Passo 3: `AbaComissao.tsx`, que tem duas abas**

```tsx
baixarPlanilha(
  [
    {
      nome: "Vendas",
      linhas: fechamentoDeVendas.linhas.map((linha) => ({
        Vendedor: linha.nome,
        "Total faturado": linha.total,
        "Alíquota inbound": linha.aliquotas.inbound,
        "Alíquota recompra": linha.aliquotas.recompra,
        "Alíquota outbound": linha.aliquotas.outbound,
        Comissão: linha.comissao,
        Bônus: linha.bonus,
        Rateio: linha.rateio,
        Recebe: linha.recebe,
        "Pelo mínimo garantido": linha.peloRateio ? "sim" : "não",
      })),
    },
    {
      nome: "Serviço",
      linhas: fechamentoDeServico.linhas.map((linha) => ({
        Pessoa: linha.nome,
        "% do papel": linha.percentual,
        Valor: linha.valor,
      })),
    },
  ],
  `comissao-${diaLocal(new Date())}.xlsx`,
);
```

As duas montagens acima são **cópia verbatim** do que hoje vai para
`json_to_sheet` nas linhas 102 e 118 — confira uma a uma contra o original.
Nenhum nome de coluna muda; se você reescrever e errar um acento, o cabeçalho
da planilha sai diferente e o teste de `AbaComissao` pega.

- [ ] **Passo 4: rodar os quatro testes da rede**

```bash
npx vitest run src/pages/Locacao.test.tsx src/pages/ContasPagar.test.tsx src/pages/ContasReceber.test.tsx src/pages/financeiro/AbaComissao.test.tsx
```

Expected: PASS, **sem editar nenhum deles**. É o critério de aceitação do M2.

- [ ] **Passo 5: suíte inteira, lint e tsc**

```bash
npm test && npm run lint && npx tsc --noEmit
```

Expected: 93 arquivos, **1433 testes**, lint ≤ 119, `tsc` limpo.

- [ ] **Passo 6: commit, um por arquivo**

```bash
git add src/pages/contas/TelaDeContas.tsx
git commit -m "refactor(contas): consome o baixarPlanilha de lib"
```

E assim para `Locacao.tsx` e `AbaComissao.tsx`.

---

### Task 5: Produtos consome `baixarPlanilha`

**Files:**

- Modify: `src/pages/Produtos.tsx`

**Interfaces:**

- Consumes: `baixarPlanilha` (Task 3), o molde da Task 4.
- Produces: o molde que as Tasks 6 a 10 repetem nas telas sem rede.

**Atenção: esta tela não tem teste de exportação.** As Tasks 5 a 10 mexem em
código sem rede, e é por isso que elas vêm **depois** da Task 4 — o molde já foi
validado onde havia teste.

- [ ] **Passo 1: trocar as quatro linhas**

No lugar de:

```tsx
const ws = XLSX.utils.json_to_sheet(dadosExport);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Produtos");
XLSX.writeFile(wb, `produtos_${new Date().toISOString().split("T")[0]}.xlsx`);
```

pôr:

```tsx
baixarPlanilha(
  [{ nome: "Produtos", linhas: dadosExport }],
  `produtos_${new Date().toISOString().split("T")[0]}.xlsx`,
);
```

**O nome do arquivo continua em UTC de propósito** — o conserto é a Task 11.
Este movimento só troca o esqueleto.

Import: `import { baixarPlanilha } from "../lib/planilha";`
Apagar o import de `XLSX` se ficar sem uso.

- [ ] **Passo 2: conferir que a tela ainda compila e a suíte não regride**

```bash
npx vitest run src/pages/Produtos.paginacao.test.tsx src/pages/Produtos.multiselect.test.tsx
npx tsc --noEmit
```

Expected: PASS. Esses testes não olham exportação, mas pegam quebra de render.

- [ ] **Passo 3: suíte inteira e lint**

```bash
npm test && npm run lint
```

Expected: 93 arquivos, 1433 testes, lint ≤ 119.

- [ ] **Passo 4: commit**

```bash
git add src/pages/Produtos.tsx
git commit -m "refactor(produtos): consome o baixarPlanilha de lib"
```

---

### Task 6: Clientes, Estoque, Serviços e Vendas consomem `baixarPlanilha`

**Files:**

- Modify: `src/pages/Clientes.tsx`
- Modify: `src/pages/Estoque.tsx`
- Modify: `src/pages/Servicos.tsx`
- Modify: `src/pages/Vendas.tsx`

**Interfaces:**

- Consumes: `baixarPlanilha` (Task 3), o molde da Task 5.
- Produces: das nove, só `Vendedores` fica sem trocar.

Mesmo movimento da Task 5, quatro vezes. **Os valores por tela:**

| Tela     | Aba          | Nome do arquivo (mantido como está)                             |
| -------- | ------------ | --------------------------------------------------------------- |
| Clientes | `"Clientes"` | `` `clientes_${new Date().toISOString().split("T")[0]}.xlsx` `` |
| Estoque  | `"Estoque"`  | `` `estoque_${new Date().toISOString().split("T")[0]}.xlsx` ``  |
| Serviços | `"Serviços"` | `` `servicos_${new Date().toISOString().split("T")[0]}.xlsx` `` |
| Vendas   | `"Vendas"`   | `` `vendas_${new Date().toISOString().split("T")[0]}.xlsx` ``   |

A lista é `dadosExport` nas quatro.

- [ ] **Passo 1: em cada uma, trocar as quatro linhas**

```tsx
baixarPlanilha(
  [{ nome: "<a aba daquela tela>", linhas: dadosExport }],
  `<o nome daquela tela>`,
);
```

Import: `import { baixarPlanilha } from "../lib/planilha";`
Apagar o import de `XLSX` de cada uma se ficar sem uso.

- [ ] **Passo 2: conferir cada tela**

```bash
npx vitest run src/pages/Clientes.paginacao.test.tsx src/pages/Estoque.paginacao.test.tsx src/pages/Servicos.paginacao.test.tsx src/pages/Vendas.paginacao.test.tsx
npx tsc --noEmit
```

- [ ] **Passo 3: suíte inteira e lint**

```bash
npm test && npm run lint
```

- [ ] **Passo 4: commit, um por tela**

```bash
git add src/pages/Clientes.tsx
git commit -m "refactor(clientes): consome o baixarPlanilha de lib"
```

E assim para Estoque, Servicos e Vendas.

---

### Task 7: Vendedores consome `baixarPlanilha` com `ajustar`

**Files:**

- Modify: `src/pages/Vendedores.tsx` (a exportação começa por volta de `:436`)

**Interfaces:**

- Consumes: `baixarPlanilha` e `AbaDePlanilha.ajustar` (Task 3).
- Produces: `json_to_sheet`, `book_new` e `book_append_sheet` deixam de existir
  em `src/pages/`.

**Esta é a exceção do plano.** Vendedores é a única das nove que mexe na folha
depois de montada, e é a única chamadora do `ajustar`.

- [ ] **Passo 1: trocar, movendo a formatação para o `ajustar`**

O que existe hoje (larguras + laço formatando as colunas E e F) vira o corpo do
`ajustar`, **sem reescrever a lógica**:

```tsx
baixarPlanilha(
  [
    {
      nome: "Minhas Vendas",
      linhas: dadosExport,
      // Largura de coluna e formato contabil nas colunas de valor. So esta
      // tela faz isso entre as nove; sem o `t`/`z` o valor sai como texto
      // e o Excel nao soma a coluna.
      ajustar: (folha) => {
        folha["!cols"] = [
          { wch: 10 },
          { wch: 12 },
          { wch: 40 },
          { wch: 18 },
          { wch: 15 },
          { wch: 15 },
          { wch: 15 },
          { wch: 20 },
          { wch: 50 },
        ];
        for (const celula in folha) {
          if (celula[0] === "E" || celula[0] === "F") {
            const alvo = folha[celula];
            if (alvo && typeof alvo.v === "number") {
              alvo.t = "n";
              alvo.z = "#,##0.00";
            }
          }
        }
      },
    },
  ],
  `vendas_${vendedorLogado}_${new Date().toISOString().split("T")[0]}.xlsx`,
);
```

As nove larguras e o laço são **cópia do que está lá** — confira uma a uma
contra o original antes de commitar. Se você reescrever e errar uma largura,
nenhum teste pega.

- [ ] **Passo 2: conferir que o esqueleto sumiu das telas**

```bash
grep -rn "json_to_sheet\|book_new\|book_append_sheet" src/pages/
```

Expected: **nenhuma saída** fora de arquivos de teste que mockam o `xlsx`.

```bash
grep -rn "XLSX.writeFile" src/
```

Expected: só `src/lib/planilha.ts`.

- [ ] **Passo 3: suíte inteira, lint e tsc**

```bash
npm test && npm run lint && npx tsc --noEmit
```

Expected: 93 arquivos, 1433 testes, lint ≤ 119, `tsc` limpo.

- [ ] **Passo 4: commit**

```bash
git add src/pages/Vendedores.tsx
git commit -m "refactor(vendedores): consome o baixarPlanilha com ajustar"
```

---

### Task 8: o conserto do UTC nas seis telas sem rede

**Files:**

- Modify: `src/pages/{Clientes,Estoque,Produtos,Servicos,Vendas,Vendedores}.tsx`

**Interfaces:**

- Consumes: `diaLocal` (Task 1), `baixarPlanilha` (Task 3).
- Produces: `toISOString` não aparece mais em `src/pages/`.

**Aqui o comportamento muda de propósito**, e é o conserto que dá sentido ao
item: quem exporta depois das 21h para de arquivar com a data do dia seguinte.

**Estas seis não têm teste de exportação.** Criar seis arquivos de teste de tela
só para isso seria caro e frágil; o comportamento **já está coberto** pelo teste
de `diaLocal` (Task 1) e pelo de `baixarPlanilha` (Task 3). O que esta task
precisa provar é que cada tela **passou a chamar** `diaLocal` — e isso o
`grep` do Passo 2 prova.

- [ ] **Passo 1: em cada uma das seis, trocar a expressão do nome**

```tsx
// antes
`produtos_${new Date().toISOString().split("T")[0]}.xlsx`
// depois
`produtos_${diaLocal(new Date())}.xlsx`;
```

Import em cada uma: `import { diaLocal } from "../lib/datas";`

Os seis prefixos, para não trocar por engano: `clientes_`, `estoque_`,
`produtos_`, `servicos_`, `vendas_` e — em Vendedores —
`` `vendas_${vendedorLogado}_` ``.

- [ ] **Passo 2: conferir que o UTC sumiu**

```bash
grep -rn "toISOString" src/pages/
```

Expected: **nenhuma saída**. Se sobrar alguma, ou é uma tela esquecida ou é uso
legítimo fora de nome de arquivo — reporte qual, não apague no escuro.

- [ ] **Passo 3: suíte inteira nos dois fusos, lint e tsc**

```bash
TZ=UTC npm test && TZ=America/Sao_Paulo npm test && npm run lint && npx tsc --noEmit
```

Expected: 93 arquivos, 1433 testes, verdes nos dois; lint ≤ 119.

- [ ] **Passo 4: commit, um por tela**

```bash
git add src/pages/Produtos.tsx
git commit -m "fix(produtos): nome do arquivo exportado sai no fuso local"
```

E assim para as outras cinco.

---

### Task 9: o conserto do UTC em Locação, com as duas edições autorizadas

**Files:**

- Modify: `src/pages/locacao/notasDeLocacao.ts` (`nomeDoArquivo`, `:209`)
- Test: `src/pages/locacao/notasDeLocacao.test.ts:93` — **edição autorizada 1**
- Test: `src/pages/Locacao.test.tsx:545` — **edição autorizada 2**
- Create: `src/test/guarda-planilha.test.ts` — o guarda que trava os dois defeitos

**Interfaces:**

- Consumes: `diaLocal` (Task 1).
- Produces: nenhuma geração de nome de arquivo usa `toISOString` no repositório.

**Por que esta tela é uma task própria.** Locação é migrada e **tem** teste — e
os testes dela pregam o defeito. Consertar exige editá-los, e as duas edições
estão escritas aqui, antes de começar, para não serem inventadas depois.

- [ ] **Passo 1: edição autorizada 1 — o teste unitário passa a enxergar**

Em `src/pages/locacao/notasDeLocacao.test.ts:93`:

```ts
it("o arquivo se chama locacao_ mais o dia local", () => {
  // O instante anterior deste teste era "2026-08-28T12:00:00Z" — meio-dia,
  // que cai no mesmo dia em Sao Paulo e em UTC, e por isso nunca exercitou a
  // virada. Um teste de data que escolhe o meio-dia nao testa fuso.
  //
  // Este e construido em hora LOCAL, entao a asserção vale nos dois fusos: o
  // dia local de um instante local e sempre o mesmo dia.
  const vinteETresHoras = new Date(2026, 7, 28, 23, 0, 0);
  expect(nomeDoArquivo(vinteETresHoras)).toBe("locacao_2026-08-28.xlsx");
});
```

- [ ] **Passo 2: rodar e ver falhar — a prova de que o teste deixou de ser cego**

Run: `TZ=America/Sao_Paulo npx vitest run src/pages/locacao/notasDeLocacao.test.ts`
Expected: **FAIL** — recebe `locacao_2026-08-29.xlsx`, esperava
`locacao_2026-08-28.xlsx`. É o defeito, visto pela primeira vez.

**Se ele passar com `TZ=America/Sao_Paulo`, pare** e reporte: ou o `TZ` não
chegou ao vitest, ou o instante não exercita a virada.

Com `TZ=UTC` esse mesmo teste **passa** contra o código velho, porque em UTC as
duas implementações concordam. É esperado, e é o motivo de a suíte rodar nos
dois fusos.

- [ ] **Passo 3: consertar `nomeDoArquivo`**

```ts
export function nomeDoArquivo(hoje: Date = new Date()): string {
  return `locacao_${diaLocal(hoje)}.xlsx`;
}
```

Import: `import { diaLocal } from "../../lib/datas";`

- [ ] **Passo 4: rodar e ver passar nos dois fusos**

```bash
TZ=UTC npx vitest run src/pages/locacao/notasDeLocacao.test.ts
TZ=America/Sao_Paulo npx vitest run src/pages/locacao/notasDeLocacao.test.ts
```

- [ ] **Passo 5: edição autorizada 2 — o teste de tela para de replicar o defeito**

Em `src/pages/Locacao.test.tsx:545`:

```tsx
// Antes, este teste calculava a data esperada com o mesmo
// `new Date().toISOString()` que a tela usava — concordava com a tela por
// construcao, certa ou errada. Agora afirma o dia local, que e o
// comportamento que a tela deve ter.
const hoje = diaLocal(new Date());
expect(planilha.arquivo).toBe(`locacao_${hoje}.xlsx`);
```

Import: `import { diaLocal } from "../lib/datas";`

- [ ] **Passo 6: suíte inteira nos dois fusos, lint e tsc**

```bash
TZ=UTC npm test && TZ=America/Sao_Paulo npm test && npm run lint && npx tsc --noEmit
```

Expected: 93 arquivos, 1433 testes, verdes nos dois.

- [ ] **Passo 7: conferir o critério final do spec**

```bash
grep -rn "toISOString" src/
```

Expected: nenhuma geração de nome de arquivo. Se aparecer `toISOString` em
outro contexto (data para API, por exemplo), tudo bem — reporte onde.

- [ ] **Passo 7b: o guarda que trava os dois defeitos, para sempre**

Criar `src/test/guarda-planilha.test.ts`, no estilo da família de guardas que já
existe em `src/test/` (`guarda-cores`, `guarda-alert`, `guarda-primitivos`…):

```ts
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const arquivosDeCodigo = readdirSync("src", {
  recursive: true,
  encoding: "utf8",
})
  .filter(
    (c) =>
      /\.tsx?$/.test(c) && !c.endsWith(".test.tsx") && !c.endsWith(".test.ts"),
  )
  .map((c) => `src/${c}`);

describe("guarda de planilha", () => {
  it("o esqueleto do xlsx so existe em src/lib/planilha.ts", () => {
    // Eram nove copias de `json_to_sheet` + `book_new` + `book_append_sheet` +
    // `writeFile`, e sete delas montavam o nome do arquivo em UTC. Concentrar
    // o esqueleto so vale se ele nao voltar a se espalhar: a decima copia
    // nasceria com o mesmo defeito, porque quem copia copia inteiro.
    const infratores: string[] = [];
    for (const caminho of arquivosDeCodigo) {
      if (caminho === "src/lib/planilha.ts") continue;
      const conteudo = readFileSync(caminho, "utf8");
      conteudo.split("\n").forEach((linha, i) => {
        if (
          /json_to_sheet|book_new|book_append_sheet|XLSX\.writeFile/.test(linha)
        ) {
          infratores.push(`${caminho}:${i + 1}`);
        }
      });
    }
    expect(infratores).toEqual([]);
  });

  it("nenhum nome de arquivo exportado sai de toISOString", () => {
    // `toISOString()` devolve UTC: as 23h de 28/08 em Sao Paulo ja sao 02h de
    // 29/08 em UTC, e quem exportava a noite arquivava com a data do dia
    // seguinte. O dia local sai de `diaLocal`, em src/lib/datas.ts.
    //
    // O guarda pula linha de COMENTARIO de proposito: varios arquivos de
    // `pages/` citam `toISOString` justamente para explicar o defeito que
    // deixaram de ter, e acusar esses comentarios seria acusar codigo certo —
    // um guarda que acusa codigo certo e desligado.
    const infratores: string[] = [];
    for (const caminho of arquivosDeCodigo) {
      if (!caminho.startsWith("src/pages/")) continue;
      const conteudo = readFileSync(caminho, "utf8");
      conteudo.split("\n").forEach((linha, i) => {
        const semEspaco = linha.trim();
        const eComentario =
          semEspaco.startsWith("//") ||
          semEspaco.startsWith("*") ||
          semEspaco.startsWith("/*");
        if (!eComentario && /toISOString\s*\(/.test(linha)) {
          infratores.push(`${caminho}:${i + 1}`);
        }
      });
    }
    expect(infratores).toEqual([]);
  });
});
```

Rodar: `npx vitest run src/test/guarda-planilha.test.ts` — os dois têm de passar
**agora**, e só agora: antes da Task 7 o primeiro falharia, e antes desta task o
segundo falharia.

**Confira que o guarda não acusa comentário.** Estes quatro arquivos citam
`toISOString` em comentário, explicando o defeito que deixaram de ter, e **não**
podem aparecer como infratores: `pages/contas/contas.ts:257` e `:637`,
`pages/contas/contas.test.ts:291`, `pages/ContasPagar.test.tsx:1270` e
`pages/ContasReceber.test.tsx:1112`. Se algum aparecer, o filtro de comentário
está errado — conserte o filtro, **nunca** o comentário.

Provar que enxergam: reintroduzir `toISOString` em `Produtos.tsx` (na expressão
do nome do arquivo) e rodar — o segundo teste falha apontando a linha. Reverter.

- [ ] **Passo 8: commit**

```bash
git add src/pages/locacao/notasDeLocacao.ts src/pages/locacao/notasDeLocacao.test.ts src/pages/Locacao.test.tsx src/test/guarda-planilha.test.ts
git commit -m "fix(locacao): nome do arquivo exportado sai no fuso local"
```

---

### Task 10: fechar a conta

**Files:**

- Modify: `docs/superpowers/2026-09-01-multiselect-divergencias.md`
- Modify: `docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md`

- [ ] **Passo 1: conferir os critérios do spec, um a um**

Percorrer "Como se sabe que terminou" de
`docs/superpowers/specs/2026-09-03-fase-4-planilha-design.md` e responder cada
linha **com o comando que a prova**:

```bash
grep -rn "json_to_sheet\|book_new\|book_append_sheet" src/   # so lib/planilha.ts e mocks de teste
grep -rn "XLSX.writeFile" src/                                # so lib/planilha.ts
grep -rn "toISOString" src/pages/                             # vazio
grep -rn "function diaLocal\|function dataDeHoje" src/        # so lib/datas.ts
TZ=UTC npm test && TZ=America/Sao_Paulo npm test && npm run lint && npx tsc --noEmit
```

Se algum critério **não** se cumprir, **pare e reporte qual** — não escreva que
fechou o que não fechou.

- [ ] **Passo 2: medir o que saiu**

```bash
git diff --shortstat $(git merge-base main HEAD)..HEAD
git diff --shortstat $(git merge-base main HEAD)..HEAD -- src/
```

Anotar os dois recortes **com rótulo**, e a contagem de commits com
`git rev-list --count $(git merge-base main HEAD)..HEAD` — medida da **mesma**
base, para os números não virem de recortes diferentes.

- [ ] **Passo 3: registrar no documento de divergências**

Acrescentar um item novo, no estilo do documento (ele numera itens e distingue
o que está fixado em teste do que não está), registrando:

- que o defeito de UTC no nome do arquivo foi encontrado em **sete** dos nove
  arquivos e corrigido nos sete;
- que **Locação era tela migrada com teste, e o teste pregava o defeito** — um
  por replicar `toISOString` e outro por escolher meio-dia como instante;
- a lição: **um teste de data que escolhe o meio-dia não testa fuso**;
- que `ajustar` existe para uma chamadora só (`Vendedores`), e que uma segunda
  chamadora é sinal de que aquilo devia ser padrão.

Incluir o item novo no **parágrafo de abertura** que classifica os itens — o
documento indexa os seus, e um item fora do índice não é achado por quem lê só
a introdução.

- [ ] **Passo 4: atualizar o spec que governa**

Na seção de estado de
`docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md`,
registrar o item 3 da Fase 4 como feito, **acrescentando** sem reescrever.

- [ ] **Passo 5: commit**

```bash
git add docs/
git commit -m "docs: fecha o item 3 da Fase 4 - a exportacao vira lib/planilha"
```

---

## Depois deste plano

Sobram três itens da Fase 4: o preset de período — que já encontra `diaLocal`
em `lib/datas.ts`, onde precisa dele —, o `useIsMobile` (quatro cópias de doze
linhas) e o clique fora (três implementações, uma delas diferente das outras).
Nenhum tem defeito de correção conhecido; são duplicação pura.
