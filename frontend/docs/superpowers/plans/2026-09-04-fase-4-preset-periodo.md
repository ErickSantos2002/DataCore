# O preset de período vira `src/lib/periodo.ts` — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** As cinco telas que ainda calculam o preset de período na mão passam a
consumir a função que Contas já usa, e a última fonte de `toISOString` em
`src/pages/` morre.

**Architecture:** `Periodo`, `periodoDoPreset` e `periodoDoMes` sobem de
`pages/contas/contas.ts` para `src/lib/periodo.ts`, junto com a lista de opções
que hoje vive em `FiltrosDeContas.tsx`. `periodoDoPreset` ganha o ramo `7dias`,
que as cinco telas têm e Contas não. Depois, uma tela por vez adota — teste de
período primeiro, visto falhar, depois a troca.

**Tech Stack:** React 18 + TypeScript, Vite, vitest + @testing-library/react
(jsdom), Tailwind 3.4.17.

**Spec:** `docs/superpowers/specs/2026-09-04-fase-4-preset-periodo-design.md`

## Global Constraints

- **O alias `@/` NÃO existe neste repositório.** Todo import é caminho relativo:
  `"../lib/periodo"` de dentro de `src/pages/`, `"./datas"` de dentro de
  `src/lib/`.
- **Código, comentário, interface e mensagem de commit em português do Brasil.**
  Commit em conventional commits, **sem acento** na mensagem.
- **A suíte roda nos dois fusos** e tem de passar nos dois:
  `TZ=UTC npm test && TZ=America/Sao_Paulo npm test`.
- **Baseline que não pode regredir:** 1437 testes / 94 arquivos, lint **118**
  problemas, `tsc --noEmit` limpo. O lint não pode subir.
- **Comentário explica POR QUE**, com o defeito concreto que a decisão evitou.
- **Não fazer `push`.** A branch é `fase-4-preset-periodo`, a partir da `main`.
- As cinco telas seguem em `PENDENTES_FASE_3`: **não** migrar aparência, não
  trocar o `<select>` cru por primitivo, não mexer em `dark:` nem em paleta.
- **Não tocar no filtro de data das cinco telas.** Ele está correto — a spec
  registra a investigação. Mexer nele é fora de escopo.

---

### Task 1: `src/lib/periodo.ts` nasce, e Contas passa a importar de lá

**Files:**

- Create: `src/lib/periodo.ts`
- Create: `src/lib/periodo.test.ts`
- Modify: `src/pages/contas/contas.ts` (remove `Periodo`, `periodoDoPreset`,
  `periodoDoMes`; importa de `../../lib/periodo`)
- Modify: `src/pages/contas/TelaDeContas.tsx:20-30` (import de `periodoDoPreset`)
- Modify: `src/pages/contas/contas.test.ts` (tira os casos que subiram)

**Interfaces:**

- Consumes: `diaLocal` de `src/lib/datas.ts`.
- Produces: `Periodo` (`{ inicio: string; fim: string }`),
  `periodoDoPreset(preset: string, agora: Date): Periodo | null`,
  `periodoDoMes(ano: number, indiceDoMes: number): Periodo`,
  `PRESETS_DE_PERIODO: { value: string; label: string }[]`.

Esta task **não muda comportamento de nenhuma tela**. É mudança de endereço mais
um ramo novo (`7dias`) que ainda não tem consumidor.

- [ ] **Passo 1: escrever o teste, já com o ramo novo**

Criar `src/lib/periodo.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { periodoDoMes, periodoDoPreset } from "./periodo";

/**
 * A conta dos presets de período, compartilhada por Contas e pelas cinco telas
 * que a adotaram na Fase 4.
 *
 * Os casos abaixo vieram de `pages/contas/contas.test.ts`, onde nasceram com a
 * Fase 3. Subiram junto com a função.
 */

const AGORA = new Date("2026-08-31T12:00:00Z");

describe("periodoDoPreset", () => {
  it("Todos limpa as duas pontas", () => {
    expect(periodoDoPreset("todos", AGORA)).toEqual({ inicio: "", fim: "" });
  });

  it("Personalizado não mexe em nada — devolve nulo", () => {
    expect(periodoDoPreset("custom", AGORA)).toBeNull();
  });

  it("Últimos 7 dias conta sete dias para trás", () => {
    // O único preset cujo comportamento NÃO muda para as cinco telas: elas já
    // faziam `setDate(hoje.getDate() - 7)` com o fim em hoje. O ramo nasce aqui
    // porque Contas não tinha esta opção, e sem ele a escolha cairia no
    // `default` e viraria "Todos" — silenciosamente.
    expect(periodoDoPreset("7dias", AGORA)).toEqual({
      inicio: "2026-08-24",
      fim: "2026-08-31",
    });
  });

  it("Últimos 30 dias conta 30 dias para trás", () => {
    expect(periodoDoPreset("30dias", AGORA)).toEqual({
      inicio: "2026-08-01",
      fim: "2026-08-31",
    });
  });

  it("Mês atual é o mês INTEIRO, do dia 1 ao último — e não até hoje", () => {
    expect(
      periodoDoPreset("mesAtual", new Date("2026-03-15T12:00:00Z")),
    ).toEqual({
      inicio: "2026-03-01",
      fim: "2026-03-31",
    });
    expect(
      periodoDoPreset("mesAtual", new Date("2026-02-10T12:00:00Z")),
    ).toEqual({
      inicio: "2026-02-01",
      fim: "2026-02-28",
    });
    expect(periodoDoPreset("mesAtual", AGORA)).toEqual({
      inicio: "2026-08-01",
      fim: "2026-08-31",
    });
  });

  it("Ano atual pega o ano inteiro", () => {
    expect(periodoDoPreset("anoAtual", AGORA)).toEqual({
      inicio: "2026-01-01",
      fim: "2026-12-31",
    });
  });

  it("na virada do dia, as duas pontas saem do dia LOCAL", () => {
    // 01/09 às 02h em Greenwich ainda é 31/08 às 23h em Brasília. Antes o
    // início vinha de `getFullYear`/`getMonth` (local) e o fim de
    // `toISOString` (UTC), e o "mês atual" atravessava a virada: 01/08 a
    // 01/09. Agora as duas pontas contam o mesmo dia — o do relógio de quem
    // olha a tela.
    const viradaDoMes = new Date("2026-09-01T02:00:00Z");
    const foraDoUtc = viradaDoMes.getTimezoneOffset() !== 0;

    expect(periodoDoPreset("mesAtual", viradaDoMes)).toEqual(
      foraDoUtc
        ? { inicio: "2026-08-01", fim: "2026-08-31" }
        : { inicio: "2026-09-01", fim: "2026-09-30" },
    );
    expect(periodoDoPreset("30dias", viradaDoMes)).toEqual(
      foraDoUtc
        ? { inicio: "2026-08-01", fim: "2026-08-31" }
        : { inicio: "2026-08-02", fim: "2026-09-01" },
    );
    expect(periodoDoPreset("7dias", viradaDoMes)).toEqual(
      foraDoUtc
        ? { inicio: "2026-08-24", fim: "2026-08-31" }
        : { inicio: "2026-08-25", fim: "2026-09-01" },
    );
  });

  it("na virada do ano, o ano atual é o ano LOCAL — e não o de Greenwich", () => {
    const viradaDoAno = new Date("2026-01-01T02:00:00Z");
    const foraDoUtc = viradaDoAno.getTimezoneOffset() !== 0;

    expect(periodoDoPreset("anoAtual", viradaDoAno)).toEqual(
      foraDoUtc
        ? { inicio: "2025-01-01", fim: "2025-12-31" }
        : { inicio: "2026-01-01", fim: "2026-12-31" },
    );
    expect(periodoDoPreset("mesAtual", viradaDoAno)).toEqual(
      foraDoUtc
        ? { inicio: "2025-12-01", fim: "2025-12-31" }
        : { inicio: "2026-01-01", fim: "2026-01-31" },
    );
  });
});

describe("periodoDoMes", () => {
  it("acerta o último dia do mês curto", () => {
    expect(periodoDoMes(2026, 1)).toEqual({
      inicio: "2026-02-01",
      fim: "2026-02-28",
    });
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/lib/periodo.test.ts`
Expected: **FAIL** — `Failed to resolve import "./periodo"`. O módulo não existe.

- [ ] **Passo 3: criar `src/lib/periodo.ts`**

```ts
import { diaLocal } from "./datas";

/**
 * Os presets de período, compartilhados por Contas e pelas cinco telas que os
 * adotaram na Fase 4.
 *
 * Moraram em `pages/contas/contas.ts` até 04/09/2026, quando cinco telas
 * passaram a precisar deles. Antes disso as cinco carregavam uma cópia do
 * cálculo, byte a byte idêntica entre si, que montava as datas em UTC — e por
 * isso "Ano atual" virava o ano passado na virada.
 */

export interface Periodo {
  inicio: string;
  fim: string;
}

/**
 * As seis opções do "Período Rápido", na ordem em que aparecem.
 *
 * Compartilhada para que o app inteiro ofereça o mesmo menu. Antes eram duas
 * listas: Contas sem "Últimos 7 dias", e as cinco telas sem "Mês atual" — e com
 * "Mês atual" como RÓTULO da chave `30dias`, que devolvia o mês corrente. O
 * rótulo mentia para quem lia o código.
 */
export const PRESETS_DE_PERIODO = [
  { value: "todos", label: "Todos" },
  { value: "7dias", label: "Últimos 7 dias" },
  { value: "30dias", label: "Últimos 30 dias" },
  { value: "mesAtual", label: "Mês atual" },
  { value: "anoAtual", label: "Ano atual" },
  { value: "custom", label: "Personalizado" },
];

/**
 * O intervalo que cada preset de período impõe às duas datas.
 *
 * `null` para "custom": o preset personalizado não mexe nas datas que a
 * pessoa digitou.
 *
 * As duas pontas saem do DIA LOCAL. Antes o início vinha de
 * `getFullYear`/`getMonth` (local) e o fim de `toISOString` (UTC), e perto da
 * meia-noite os dois discordavam: em Brasília, às 23h de 31/08, "Mês atual"
 * virava 01/08 a 01/09, e na virada do ano "Ano atual" virava o ano passado
 * inteiro (defeito 1.3).
 */
export function periodoDoPreset(preset: string, agora: Date): Periodo | null {
  if (preset === "custom") return null;

  const hoje = new Date(agora);

  switch (preset) {
    case "7dias": {
      const seteDiasAtras = new Date(hoje);
      seteDiasAtras.setDate(hoje.getDate() - 7);
      return { inicio: diaLocal(seteDiasAtras), fim: diaLocal(hoje) };
    }
    case "30dias": {
      const trintaDiasAtras = new Date(hoje);
      trintaDiasAtras.setDate(hoje.getDate() - 30);
      return { inicio: diaLocal(trintaDiasAtras), fim: diaLocal(hoje) };
    }
    // O mês INTEIRO, do dia 1 ao último. Terminava HOJE, e então uma conta
    // emitida dia 20 sumia do "mês atual" enquanto hoje fosse dia 15 — sem
    // que o rótulo dissesse que o preset não olha para a frente. "Ano atual"
    // sempre foi o ano inteiro; agora os dois combinam.
    case "mesAtual":
      return periodoDoMes(hoje.getFullYear(), hoje.getMonth());
    case "anoAtual":
      return {
        inicio: `${hoje.getFullYear()}-01-01`,
        fim: `${hoje.getFullYear()}-12-31`,
      };
    case "todos":
    default:
      return { inicio: "", fim: "" };
  }
}

/** O mês inteiro, para o preset e para o clique numa barra do gráfico mensal. */
export function periodoDoMes(ano: number, indiceDoMes: number): Periodo {
  const mes = String(indiceDoMes + 1).padStart(2, "0");
  const ultimoDia = new Date(ano, indiceDoMes + 1, 0).getDate();
  return { inicio: `${ano}-${mes}-01`, fim: `${ano}-${mes}-${ultimoDia}` };
}
```

- [ ] **Passo 4: rodar e ver passar nos dois fusos**

```bash
TZ=UTC npx vitest run src/lib/periodo.test.ts
TZ=America/Sao_Paulo npx vitest run src/lib/periodo.test.ts
```

Expected: PASS nos dois, 9 testes.

- [ ] **Passo 5: tirar as três de `contas.ts` e importar de `lib`**

Em `src/pages/contas/contas.ts`, **apagar** o bloco `export interface Periodo`
(linha ~245), `export function periodoDoPreset` (~262) e
`export function periodoDoMes` (~293), com os seus docblocks.

`periodoDoAno` e `periodoDaBarra` **ficam** — `periodoDaBarra` usa `periodoDoMes`
e `Periodo`, então passam a vir do import.

Trocar a linha 28:

```ts
import { dataDeCalendario, diaLocal } from "../../lib/datas";
```

por:

```ts
import { dataDeCalendario, diaLocal } from "../../lib/datas";
import { periodoDoMes, type Periodo } from "../../lib/periodo";
```

**Não** re-exportar. Conferido: fora de `contas.ts`, ninguém importa `Periodo`
nem `periodoDoMes` de `"./contas"` — `GraficosDeContas` traz `Evolucao` e os
pontos, `TabelaDeContas` traz `Ordenacao`, e só `TelaDeContas` traz
`periodoDoPreset` e `periodoDaBarra`. Um re-export aqui seria endereço morto.

- [ ] **Passo 6: `TelaDeContas.tsx` importa `periodoDoPreset` de `lib`**

Em `src/pages/contas/TelaDeContas.tsx`, tirar `periodoDoPreset,` da lista de
imports vinda de `"./contas"` (linha 25) e acrescentar, junto dos outros
imports de biblioteca:

```ts
import { periodoDoPreset } from "../../lib/periodo";
```

- [ ] **Passo 7: tirar de `contas.test.ts` os casos que subiram**

Em `src/pages/contas/contas.test.ts`, apagar o `describe` inteiro de
`periodoDoPreset` (os casos das linhas ~247 a ~325) e o de `periodoDoMes`, se
houver um separado. Tirar `periodoDoPreset` da lista de imports da linha ~22.

**Não apagar** os casos de `periodoDaBarra` nem de `periodoDoAno` — eles ficam.

- [ ] **Passo 8: suíte inteira nos dois fusos, lint e tsc**

```bash
TZ=UTC npm test && TZ=America/Sao_Paulo npm test && npm run lint && npx tsc --noEmit
```

Expected: verde nos dois. A contagem de arquivos sobe 1 (`lib/periodo.test.ts`);
a de testes fica perto de 1437, porque os casos mudaram de arquivo e um nasceu
(o `7dias`). Lint ≤ 118.

**Se `ContasReceber.test.tsx` ou `ContasPagar.test.tsx` falharem, pare e
reporte** — esta task não deveria tocar o comportamento de Contas.

- [ ] **Passo 9: commit**

```bash
git add src/lib/periodo.ts src/lib/periodo.test.ts src/pages/contas/contas.ts \
        src/pages/contas/contas.test.ts src/pages/contas/TelaDeContas.tsx
git commit -m "refactor(periodo): a conta dos presets sobe para lib/periodo"
```

---

### Task 2: `FiltrosDeContas` consome a lista compartilhada, e Contas ganha "Últimos 7 dias"

**Files:**

- Modify: `src/pages/contas/FiltrosDeContas.tsx:1-13`

**Interfaces:**

- Consumes: `PRESETS_DE_PERIODO` (Task 1).
- Produces: nenhuma lista de presets fora de `lib/periodo.ts`.

**Esta task muda a UI de Contas**, e é a única do plano que faz isso: as duas
telas de Contas ganham a opção "Últimos 7 dias", que as outras cinco já tinham.
É aditiva — nada some de lá.

- [ ] **Passo 1: trocar a lista local pelo import**

Em `src/pages/contas/FiltrosDeContas.tsx`, apagar o bloco:

```tsx
/** Os cinco presets do "Período Rápido", na ordem em que aparecem. */
const PRESETS = [
  { value: "todos", label: "Todos" },
  { value: "30dias", label: "Últimos 30 dias" },
  { value: "mesAtual", label: "Mês atual" },
  { value: "anoAtual", label: "Ano atual" },
  { value: "custom", label: "Personalizado" },
];
```

e acrescentar aos imports do topo:

```tsx
import { PRESETS_DE_PERIODO } from "../../lib/periodo";
```

Trocar o uso de `PRESETS` no JSX por `PRESETS_DE_PERIODO`. Rodar
`grep -n "PRESETS" src/pages/contas/FiltrosDeContas.tsx` e conferir que sobrou
só `PRESETS_DE_PERIODO`.

- [ ] **Passo 2: rodar os testes de Contas**

```bash
npx vitest run src/pages/ContasReceber.test.tsx src/pages/ContasPagar.test.tsx
```

Expected: PASS. Os testes escolhem o preset pelo **valor** (`escolherPreset("30dias")`),
não pela posição na lista, então acrescentar uma opção não os quebra.

**Se algum falhar por contagem de `<option>`, pare e reporte** — significaria
que existe um teste travando o número de opções, e ele precisa de decisão.

- [ ] **Passo 3: suíte inteira, lint e tsc**

```bash
TZ=UTC npm test && TZ=America/Sao_Paulo npm test && npm run lint && npx tsc --noEmit
```

- [ ] **Passo 4: commit**

```bash
git add src/pages/contas/FiltrosDeContas.tsx
git commit -m "feat(contas): o periodo rapido ganha os ultimos 7 dias"
```

---

## O molde do teste de período

As Tasks 3 a 7 criam cinco arquivos com **o mesmo corpo**, porque o preset não
depende do domínio de nenhuma tela — as datas esperadas são as mesmas nas cinco.
O molde está aqui, uma vez, e cada task diz o que trocar. Ele vale para toda
task que o cite, do mesmo jeito que as Global Constraints valem.

Cada arquivo tem duas partes:

**A. O cabeçalho de mocks** — `vi.mock` de `useAuth`, do contexto da tela e de
`recharts`, mais os fixtures. **Não se escreve do zero:** é cópia verbatim do
topo do `<Nome>.paginacao.test.tsx` **daquela mesma tela**, um arquivo que já
existe no repositório desde o item 2 desta fase. Copiar do começo até a linha ANTERIOR ao
primeiro `describe` — hoje L89 em Produtos, L105 em Clientes, L74 em Vendas,
L91 em Vendedores e L77 em Servicos.

**B. O corpo**, abaixo, trocando `<TELA>` pelo nome do componente:

```tsx
/**
 * O preset de período em <TELA>, depois da adoção do `periodoDoPreset`.
 *
 * O relógio é fixado em 15/03/2026 porque as asserções falam de "mês atual" e
 * "ano atual": sem relógio fixo o teste passaria hoje e falharia em abril.
 * Só o `Date` é falso — os timers de verdade continuam rodando.
 */
const HOJE = new Date("2026-03-15T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(HOJE);
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * O bloco de um filtro, achado pelo TEXTO do rótulo.
 *
 * Não dá para usar `getByLabelText`: as cinco telas não têm um único
 * `htmlFor` — os `<label>` são irmãos do campo, não estão associados a ele.
 * É lacuna de acessibilidade real, registrada no documento de divergências,
 * e consertá-la é mudança de markup numa tela que segue em PENDENTES_FASE_3.
 * Este é o mesmo contorno que `ContasPagar.test.tsx:435` usa.
 */
function blocoDoFiltro(rotulo: string): HTMLElement {
  const etiqueta = screen.getByText(rotulo);
  if (!etiqueta.parentElement) throw new Error(`filtro "${rotulo}" sem bloco`);
  return etiqueta.parentElement;
}

function campoData(rotulo: "Data Início" | "Data Fim"): HTMLInputElement {
  const campo = blocoDoFiltro(rotulo).querySelector("input");
  if (!campo) throw new Error(`campo "${rotulo}" nao existe`);
  return campo as HTMLInputElement;
}

function seletorDePreset(): HTMLSelectElement {
  const campo = blocoDoFiltro("Período Rápido").querySelector("select");
  if (!campo) throw new Error("seletor de preset nao existe");
  return campo as HTMLSelectElement;
}

function escolherPreset(valor: string): void {
  fireEvent.change(seletorDePreset(), { target: { value: valor } });
}

describe("preset de periodo em <TELA>", () => {
  it("oferece as seis opcoes, na ordem da lista compartilhada", () => {
    render(<TELA />);
    expect(Array.from(seletorDePreset().options).map((o) => o.value)).toEqual([
      "todos",
      "7dias",
      "30dias",
      "mesAtual",
      "anoAtual",
      "custom",
    ]);
  });

  it("Mes atual vai do dia 1 ao ULTIMO dia do mes, e nao ate hoje", () => {
    // Este é o caso que muda. Antes, "Mês atual" era o RÓTULO da chave
    // `30dias`, e devolvia 01/03 a 15/03 — o mês até hoje. Agora a chave
    // `mesAtual` existe e devolve o mês do calendário inteiro.
    render(<TELA />);
    escolherPreset("mesAtual");

    expect(campoData("Data Início")).toHaveValue("2026-03-01");
    expect(campoData("Data Fim")).toHaveValue("2026-03-31");
  });

  it("Ultimos 30 dias conta 30 dias para tras", () => {
    render(<TELA />);
    escolherPreset("30dias");

    expect(campoData("Data Início")).toHaveValue("2026-02-13");
    expect(campoData("Data Fim")).toHaveValue("2026-03-15");
  });

  it("Ultimos 7 dias nao mudou — e o unico preset que sobreviveu igual", () => {
    render(<TELA />);
    escolherPreset("7dias");

    expect(campoData("Data Início")).toHaveValue("2026-03-08");
    expect(campoData("Data Fim")).toHaveValue("2026-03-15");
  });

  it("Ano atual vai do 1 de janeiro ao 31 de dezembro", () => {
    // Antes terminava HOJE, porque o `switch` não sobrescrevia o `fim` que já
    // tinha sido inicializado com a data de hoje.
    render(<TELA />);
    escolherPreset("anoAtual");

    expect(campoData("Data Início")).toHaveValue("2026-01-01");
    expect(campoData("Data Fim")).toHaveValue("2026-12-31");
  });

  it("Todos limpa as duas datas", () => {
    render(<TELA />);
    escolherPreset("anoAtual");
    escolherPreset("todos");

    expect(campoData("Data Início")).toHaveValue("");
    expect(campoData("Data Fim")).toHaveValue("");
  });

  it("Personalizado nao mexe nas datas que ja estavam la", () => {
    render(<TELA />);
    escolherPreset("anoAtual");
    escolherPreset("custom");

    expect(campoData("Data Início")).toHaveValue("2026-01-01");
    expect(campoData("Data Fim")).toHaveValue("2026-12-31");
  });
});
```

Ajustar a linha de import do topo (a que vem do cabeçalho copiado) para trazer
`beforeEach`, `afterEach`, `render`, `fireEvent` e `screen`, se o arquivo de
paginação não os trouxer todos.

**Sobre os rótulos, já decidido no pré-voo:** as cinco telas têm **zero
`htmlFor`** — conferido com `grep -c htmlFor` nas cinco, dá 0 em todas. Por isso
o molde não usa `getByLabelText` em lugar nenhum, e sim a travessia por texto
acima. **Não** acrescentar `htmlFor`/`id` ao markup: é correção de
acessibilidade legítima, mas as cinco seguem em `PENDENTES_FASE_3` e este item
não migra aparência. A lacuna está registrada para a Task 8.

O `screen.getByText(rotulo)` pode achar mais de um nó se o texto do rótulo
aparecer também num cabeçalho ou opção. Se der `Found multiple elements`,
estreite com `within(...)` a partir do cartão de filtros da tela — **não**
troque o rótulo nem o markup.

**Os quatro casos que TÊM de falhar antes da troca**, em qualquer das cinco:
a lista de opções (ainda com cinco valores, sem `mesAtual`), `mesAtual` (cai no
`default` do `switch` velho e zera as datas), `30dias` (devolve `2026-03-01`, não
`2026-02-13`) e `anoAtual` (devolve fim `2026-03-15`, não `2026-12-31`). Se algum
desses quatro passar antes da troca, **pare e reporte** — o teste não está
exercitando a tela.

**O bloco que substitui o `useEffect`**, idêntico nas cinco:

```tsx
// O preset impõe as duas datas. A conta mora em `lib/periodo.ts`, a mesma
// que Contas usa: eram cinco cópias byte a byte idênticas deste bloco, e as
// cinco montavam a data com `toISOString` (UTC) — a partir das 21h de
// Brasília o "ano atual" virava o ano seguinte.
useEffect(() => {
  const periodo = periodoDoPreset(presetPeriodo, new Date());
  if (!periodo) return;
  setDataInicio(periodo.inicio);
  setDataFim(periodo.fim);
}, [presetPeriodo]);
```

O `if (!periodo) return` substitui o `if (presetPeriodo !== "custom")` do bloco
velho: `periodoDoPreset` devolve `null` para "custom", que é a mesma condição
escrita uma vez só.

**O bloco que substitui as `<option>`**, idêntico nas cinco:

```tsx
{
  PRESETS_DE_PERIODO.map((preset) => (
    <option key={preset.value} value={preset.value}>
      {preset.label}
    </option>
  ));
}
```

**O import**, idêntico nas cinco (todas estão em `src/pages/`):

```tsx
import { PRESETS_DE_PERIODO, periodoDoPreset } from "../lib/periodo";
```

---

### Task 3: Produtos adota — a primeira das cinco

**Files:**

- Create: `src/pages/Produtos.periodo.test.tsx`
- Modify: `src/pages/Produtos.tsx:124-155` (o `useEffect`), `:541-545` (o
  `<select>`), e os imports do topo

**Interfaces:**

- Consumes: `periodoDoPreset`, `PRESETS_DE_PERIODO` (Task 1).

**O comportamento muda de propósito.** "Mês atual" deixa de ser a chave `30dias`
e passa a ser o mês inteiro; "Ano atual" passa a ir até 31/12; e a tela ganha
"Últimos 30 dias" de verdade.

- [ ] **Passo 1: escrever o teste**

Criar `src/pages/Produtos.periodo.test.tsx` seguindo a seção **"O molde do teste
de período"** deste plano:

- **parte A**, o cabeçalho de mocks: cópia verbatim de
  `src/pages/Produtos.paginacao.test.tsx`, do começo até a linha ANTERIOR ao
  primeiro `describe` (hoje L89), que já traz
  o `vi.mock` de `useAuth`, os fixtures `ITENS` e `NOTAS`, o `vi.mock` de
  `DataContext` e o de `recharts`;
- **parte B**, o corpo do molde, com `<TELA>` trocado por `Produtos`.

- [ ] **Passo 2: rodar e ver falhar — a prova de que o teste enxerga**

Run: `npx vitest run src/pages/Produtos.periodo.test.tsx`
Expected: **FAIL** nos quatro casos que o molde nomeia.

- [ ] **Passo 3: trocar o `useEffect`**

Substituir o bloco inteiro das linhas 124-155 (do comentário
`// Gerenciador de presets de período` até o `}, [presetPeriodo]);`) pelo bloco
de dez linhas do molde.

- [ ] **Passo 4: trocar as `<option>` pela lista compartilhada**

Substituir as cinco `<option>` das linhas 541-545 pelo `map` do molde.

- [ ] **Passo 5: acrescentar o import do molde**

Junto dos outros imports relativos do topo de `Produtos.tsx`.

- [ ] **Passo 6: rodar e ver passar nos dois fusos**

```bash
TZ=UTC npx vitest run src/pages/Produtos.periodo.test.tsx
TZ=America/Sao_Paulo npx vitest run src/pages/Produtos.periodo.test.tsx
```

Expected: PASS nos dois, 7 testes.

- [ ] **Passo 7: conferir que os testes vizinhos de Produtos seguem verdes**

```bash
npx vitest run src/pages/Produtos.paginacao.test.tsx src/pages/Produtos.multiselect.test.tsx
```

Expected: PASS. Eles não escolhem preset, então a mudança não deveria alcançá-los.

- [ ] **Passo 8: suíte inteira, lint e tsc**

```bash
TZ=UTC npm test && TZ=America/Sao_Paulo npm test && npm run lint && npx tsc --noEmit
```

- [ ] **Passo 9: commit**

```bash
git add src/pages/Produtos.tsx src/pages/Produtos.periodo.test.tsx
git commit -m "refactor(produtos): o preset de periodo vem de lib/periodo"
```

---

### Task 4: Clientes adota

**Files:**

- Create: `src/pages/Clientes.periodo.test.tsx`
- Modify: `src/pages/Clientes.tsx:106-137` (o `useEffect`), `:655-659` (o
  `<select>`), e os imports do topo

**Interfaces:**

- Consumes: `periodoDoPreset`, `PRESETS_DE_PERIODO` (Task 1).

Segue a seção **"O molde do teste de período"**. O cabeçalho de mocks é **cópia
verbatim das linhas 1 a 96 de `src/pages/Clientes.paginacao.test.tsx`** (o
`vi.mock` de `useAuth`, os fixtures `CLIENTES_ENRIQUECIDOS` e `NOTAS`, o
`vi.mock` de `DataContext` e o de `recharts`).

- [ ] **Passo 1: escrever o teste**

Parte A: cópia verbatim do topo de `src/pages/Clientes.paginacao.test.tsx`, até
antes do `describe`. Parte B: o corpo do molde, com `<TELA>` trocado por
`Clientes`. Os sete casos e as mesmas datas — o preset não depende do domínio
da tela.

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/pages/Clientes.periodo.test.tsx`
Expected: **FAIL** nos quatro casos que o molde nomeia.

- [ ] **Passo 3: trocar o `useEffect`, o `<select>` e o import**

As linhas 106-137 viram o bloco de dez linhas do molde. As `<option>` de
655-659 viram o `map` do molde. O import é o do molde.

- [ ] **Passo 4: rodar nos dois fusos e conferir os vizinhos**

```bash
TZ=UTC npx vitest run src/pages/Clientes.periodo.test.tsx
TZ=America/Sao_Paulo npx vitest run src/pages/Clientes.periodo.test.tsx
npx vitest run src/pages/Clientes.paginacao.test.tsx src/pages/Clientes.multiselect.test.tsx
```

- [ ] **Passo 5: suíte inteira, lint e tsc**

```bash
TZ=UTC npm test && TZ=America/Sao_Paulo npm test && npm run lint && npx tsc --noEmit
```

- [ ] **Passo 6: commit**

```bash
git add src/pages/Clientes.tsx src/pages/Clientes.periodo.test.tsx
git commit -m "refactor(clientes): o preset de periodo vem de lib/periodo"
```

---

### Task 5: Vendas adota

**Files:**

- Create: `src/pages/Vendas.periodo.test.tsx`
- Modify: `src/pages/Vendas.tsx:140-171` (o `useEffect`), `:567-571` (o
  `<select>`), e os imports do topo

**Interfaces:**

- Consumes: `periodoDoPreset`, `PRESETS_DE_PERIODO` (Task 1).

Cabeçalho de mocks: **cópia verbatim do topo de
`src/pages/Vendas.paginacao.test.tsx`**, até antes do `describe`. Atenção:
`Vendas.tsx` também importa `fetchVendas` de `../services/notasapi`, então o
arquivo de paginação já mocka o serviço — copiar esse mock junto.

- [ ] **Passo 1: escrever o teste**

Parte A: cópia verbatim do topo de `src/pages/Vendas.paginacao.test.tsx`,
até antes do `describe`. Parte B: o corpo do molde, com `<TELA>` trocado por
`Vendas`.

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/pages/Vendas.periodo.test.tsx`
Expected: **FAIL** nos quatro casos que o molde nomeia.

- [ ] **Passo 3: trocar o `useEffect`, o `<select>` e o import**

O bloco de dez linhas do molde, o `map` do molde, o import do molde.

- [ ] **Passo 4: rodar nos dois fusos e conferir os vizinhos**

```bash
TZ=UTC npx vitest run src/pages/Vendas.periodo.test.tsx
TZ=America/Sao_Paulo npx vitest run src/pages/Vendas.periodo.test.tsx
npx vitest run src/pages/Vendas.paginacao.test.tsx src/pages/Vendas.multiselect.test.tsx
```

- [ ] **Passo 5: suíte inteira, lint e tsc**

```bash
TZ=UTC npm test && TZ=America/Sao_Paulo npm test && npm run lint && npx tsc --noEmit
```

- [ ] **Passo 6: commit**

```bash
git add src/pages/Vendas.tsx src/pages/Vendas.periodo.test.tsx
git commit -m "refactor(vendas): o preset de periodo vem de lib/periodo"
```

---

### Task 6: Vendedores adota

**Files:**

- Create: `src/pages/Vendedores.periodo.test.tsx`
- Modify: `src/pages/Vendedores.tsx:97-128` (o `useEffect`), `:548-552` (o
  `<select>`), e os imports do topo

**Interfaces:**

- Consumes: `periodoDoPreset`, `PRESETS_DE_PERIODO` (Task 1).

Cabeçalho de mocks: **cópia verbatim do topo de
`src/pages/Vendedores.paginacao.test.tsx`**. Atenção: `Vendedores.tsx` usa
`useToast` de `../components/ToastProvider` — se o arquivo de paginação mocka o
provider, copiar junto.

- [ ] **Passo 1: escrever o teste**

Parte A: cópia verbatim do topo de `src/pages/Vendedores.paginacao.test.tsx`,
até antes do `describe`. Parte B: o corpo do molde, com `<TELA>` trocado por
`Vendedores`.

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/pages/Vendedores.periodo.test.tsx`
Expected: **FAIL** nos quatro casos que o molde nomeia.

- [ ] **Passo 3: trocar o `useEffect`, o `<select>` e o import**

O bloco de dez linhas do molde, o `map` do molde, o import do molde.

- [ ] **Passo 4: rodar nos dois fusos e conferir os vizinhos**

```bash
TZ=UTC npx vitest run src/pages/Vendedores.periodo.test.tsx
TZ=America/Sao_Paulo npx vitest run src/pages/Vendedores.periodo.test.tsx
npx vitest run src/pages/Vendedores.paginacao.test.tsx src/pages/Vendedores.multiselect.test.tsx
```

- [ ] **Passo 5: suíte inteira, lint e tsc**

```bash
TZ=UTC npm test && TZ=America/Sao_Paulo npm test && npm run lint && npx tsc --noEmit
```

- [ ] **Passo 6: commit**

```bash
git add src/pages/Vendedores.tsx src/pages/Vendedores.periodo.test.tsx
git commit -m "refactor(vendedores): o preset de periodo vem de lib/periodo"
```

---

### Task 7: Serviços adota — a última, e a de contexto diferente

**Files:**

- Create: `src/pages/Servicos.periodo.test.tsx`
- Modify: `src/pages/Servicos.tsx:98-129` (o `useEffect`), `:542-546` (o
  `<select>`), e os imports do topo

**Interfaces:**

- Consumes: `periodoDoPreset`, `PRESETS_DE_PERIODO` (Task 1).
- Produces: nenhum `switch (presetPeriodo)` em `src/pages/`.

**Serviços é a única das cinco que não usa `DataContext`** — ela consome
`useServicos` de `../context/ServicosContext`. O cabeçalho de mocks é **cópia
verbatim do topo de `src/pages/Servicos.paginacao.test.tsx`**, que já mocka o
contexto certo.

- [ ] **Passo 1: escrever o teste**

Parte A: cópia verbatim do topo de `src/pages/Servicos.paginacao.test.tsx`,
até antes do `describe`. Parte B: o corpo do molde, com `<TELA>` trocado por
`Servicos`.

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/pages/Servicos.periodo.test.tsx`
Expected: **FAIL** nos quatro casos que o molde nomeia.

- [ ] **Passo 3: trocar o `useEffect`, o `<select>` e o import**

O bloco de dez linhas do molde, o `map` do molde, o import do molde.

**Não tocar nas linhas 175-187**, que são o filtro de data. Ele diverge das
outras quatro de propósito e está correto — a spec registra por quê.

- [ ] **Passo 4: rodar nos dois fusos e conferir os vizinhos**

```bash
TZ=UTC npx vitest run src/pages/Servicos.periodo.test.tsx
TZ=America/Sao_Paulo npx vitest run src/pages/Servicos.periodo.test.tsx
npx vitest run src/pages/Servicos.paginacao.test.tsx src/pages/Servicos.multiselect.test.tsx
```

- [ ] **Passo 5: conferir que o bloco morreu nas cinco**

```bash
grep -rn "switch (presetPeriodo)" src/pages/
grep -rn "Gerenciador de presets de período" src/pages/
```

Expected: **nenhuma saída** nos dois.

- [ ] **Passo 6: suíte inteira, lint e tsc**

```bash
TZ=UTC npm test && TZ=America/Sao_Paulo npm test && npm run lint && npx tsc --noEmit
```

- [ ] **Passo 7: commit**

```bash
git add src/pages/Servicos.tsx src/pages/Servicos.periodo.test.tsx
git commit -m "refactor(servicos): o preset de periodo vem de lib/periodo"
```

---

### Task 8: o `PENDENTES_UTC` zera, e a conta fecha nos documentos

**Files:**

- Modify: `src/test/guarda-planilha.test.ts`
- Modify: `docs/superpowers/2026-09-01-multiselect-divergencias.md`
- Modify: `docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md`

**Interfaces:**

- Consumes: o resultado das Tasks 3 a 7.

- [ ] **Passo 1: conferir que a lista ficou obsoleta**

Run: `npx vitest run src/test/guarda-planilha.test.ts`
Expected: **FAIL** no terceiro teste ("nenhuma entrada da lista de pendentes
esta obsoleta"), acusando as cinco entradas — porque as cinco telas ficaram
limpas. É o guarda funcionando: ele obriga a apagar as linhas.

- [ ] **Passo 2: esvaziar a lista e decidir o que sobra**

Em `src/test/guarda-planilha.test.ts`, esvaziar `PENDENTES_UTC`:

```ts
// A lista está VAZIA desde 04/09/2026, quando o item 4 da Fase 4 tirou o
// preset de período das cinco últimas telas. Ela fica — vazia, e não deletada
// — porque é a estrutura que o repositório usa para "infração conhecida com
// prazo": esvaziar prova que a dívida acabou, deletar apagaria a prova.
//
// Continua valendo a regra: a lista SÓ ENCOLHE, e nunca se acrescenta linha
// aqui para calar o guarda.
const PENDENTES_UTC: string[] = [];
```

O terceiro teste (`"nenhuma entrada da lista de pendentes esta obsoleta"`) passa
a iterar sobre uma lista vazia e fica trivialmente verde. **Mantê-lo**: ele volta
a ter trabalho no dia em que alguém acrescentar uma linha.

Atualizar o comentário do segundo teste, que hoje diz que as cinco da lista
"continuam isentas só pelo preset de período, e só até o próximo item da Fase 4"
— esse próximo item é este.

- [ ] **Passo 3: rodar o guarda e a suíte**

```bash
npx vitest run src/test/guarda-planilha.test.ts
TZ=UTC npm test && TZ=America/Sao_Paulo npm test && npm run lint && npx tsc --noEmit
```

Expected: os quatro testes do guarda verdes.

- [ ] **Passo 4: conferir os critérios do spec, um a um**

```bash
grep -rn "switch (presetPeriodo)" src/pages/                    # vazio
grep -rn "toISOString" src/pages/                                # so comentario
grep -rn "function periodoDoPreset\|function periodoDoMes" src/  # so lib/periodo.ts
grep -rn "label: \"Últimos 30 dias\"" src/                        # so lib/periodo.ts
git diff main..HEAD -- src/pages/Servicos.tsx | grep -c "dataInicio"  # 0 no filtro
```

Se algum não se cumprir, **pare e reporte qual** — não escreva que fechou o que
não fechou.

- [ ] **Passo 5: medir, da mesma base**

```bash
BASE=$(git merge-base main HEAD)
git rev-list --count $BASE..HEAD
git diff --shortstat $BASE..HEAD
git diff --shortstat $BASE..HEAD -- src/
```

Anotar os três com rótulo, e dizer que a medida é **anterior ao commit de
documentação** — foi o cuidado que faltou no item 3 e teve de ser emendado.

- [ ] **Passo 6: escrever o item 12 no documento de divergências**

Acrescentar em `docs/superpowers/2026-09-01-multiselect-divergencias.md`, no
estilo dele (numera itens, e o parágrafo de abertura indexa), registrando:

- que as cinco adotaram `periodoDoPreset`, e o que mudou para quem usa: "Mês
  atual" virou o mês inteiro, "Ano atual" vai até 31/12, e a chave `30dias`
  passou a se chamar pelo que faz;
- que Contas ganhou "Últimos 7 dias", aditivo;
- **a investigação do filtro que não deu em nada**, com a lição: verificar o
  mecanismo não é verificar o defeito. Um defeito só é defeito depois de alguém
  seguir o dado da API até a comparação;
- os três achados colaterais que ficaram fora: o filtro do `Servicos` divergir
  (e ser o mais robusto), o `toISOString()` dentro de `DataContext.tsx:75` num
  bloco que diz "sem UTC", e o `emissaoDe` de Contas não normalizar a data.

**Incluir o item novo no parágrafo de abertura** que classifica os itens.

- [ ] **Passo 7: atualizar o spec que governa**

Em `docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md`,
acrescentar a seção `### Item 4 da Fase 4 — o preset de período fechado
(04/09/2026)` antes de `### Em aberto`, **acrescentando sem reescrever**, no
molde da seção do item 3.

- [ ] **Passo 8: commit**

```bash
git add src/test/guarda-planilha.test.ts docs/
git commit -m "docs: fecha o item 4 da Fase 4 - o preset de periodo vira lib/periodo"
```

---

## Depois deste plano

Sobram dois itens da Fase 4: o `useIsMobile` (quatro cópias de doze linhas) e o
clique fora (três implementações, uma delas diferente das outras). Nenhum tem
defeito de correção conhecido — são duplicação pura. Depois deles a Fase 4 acaba
e a Fase 3 volta.

**Pendente de conferência humana no navegador**, acumulada desde o item 1: a
aparência do `MultiSelect` nas seis telas, o rodapé compacto que Contas herdou no
item 2, e agora o menu de período nas seis — nos dois temas. Este item é o
primeiro da fase cujo efeito é **visível para quem usa o filtro todo dia**, e a
conferência deixou de ser opcional.
