# Fase 0 — Fundação: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instalar os tokens do Design System H&S, o ferramental de teste e lint, e a ponte de paleta que faz o sistema inteiro adotar a cor da marca sem que nenhuma tela seja reescrita.

**Architecture:** Os tokens do DS entram como cópia fiel em `src/design-system/`, importados antes das diretivas do Tailwind. O `tailwind.config.js` ganha duas camadas: classes de token novas (`bg-action`, `bg-surface`, `text-conteudo`) apontando para `var(--...)`, e uma _ponte de paleta_ que redefine `blue-*`, `slate-*` e `darkBlue` para os valores da rampa do DS em hexadecimal literal — assim as 272 classes literais de azul e as 132 de slate que já existem no JSX passam a pintar a marca sem edição. Os 212 hexadecimais arbitrários dentro de classe, que configuração nenhuma alcança, são trocados por um codemod e travados por teste de guarda.

**Tech Stack:** React 19, Vite 7, TypeScript 5.8, Tailwind CSS 3.4.17, Vitest, React Testing Library, ESLint 9, Prettier 3.

**Spec:** `docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md`

## Global Constraints

- **Branch:** todo o trabalho em `ds/fase-0-fundacao`. Nada vai para `main`. Nenhum `git push` sem autorização explícita do Erick.
- **Módulos:** `package.json` **não** tem `"type": "module"`. Arquivos `.js` na raiz são CommonJS — `tailwind.config.js` e `postcss.config.js` usam `module.exports`. Config de ESLint precisa da extensão `.mjs` para usar `export default`.
- **Tailwind fica no v3** (3.4.17). Não introduzir sintaxe v4 (`@theme`, `@import "tailwindcss"`).
- **Nenhuma tela é reescrita nesta fase.** Se um passo exigir editar um arquivo em `src/pages/` ou `src/components/`, o passo está errado — exceto o codemod da Task 5, que é substituição mecânica de string.
- **Cor de ação:** `--action` = `#1a71a8` no claro, `#47a6e1` no escuro. O azul da marca `#1f89ca` (degrau 500) **nunca** carrega texto — 3,83:1 no branco.
- **Interface em português do Brasil. Nenhum emoji na interface.**
- **Projeto do Design System no Claude Design:** `Health & Safety Design System`, projectId `ef9f35f6-3af0-4651-9dee-45d08884432a`.
- Node 24.16 / npm 11 (via nvm).

---

### Task 1: Ferramental de teste — Vitest + React Testing Library

Nada nas tasks seguintes pode ser verificado sem isto. Vem primeiro.

**Files:**

- Modify: `package.json` (deps de dev e scripts)
- Modify: `vite.config.ts` (bloco `test`)
- Modify: `tsconfig.json` (tipos dos matchers)
- Create: `src/test/setup.ts`
- Test: `src/test/fumaca.test.tsx`

**Interfaces:**

- Consumes: nada.
- Produces: o comando `npm test` (executa `vitest run`), o ambiente `jsdom` e os matchers de `@testing-library/jest-dom`. Todas as tasks seguintes dependem disso.

- [ ] **Step 1: Escrever o teste de fumaça**

Criar `src/test/fumaca.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function Titulo() {
  return <h1>DataCoreHS</h1>;
}

describe("ferramental de teste", () => {
  it("renderiza um componente React e encontra o texto na tela", () => {
    render(<Titulo />);
    expect(
      screen.getByRole("heading", { name: "DataCoreHS" }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test`
Expected: FAIL — `npm error Missing script: "test"`. O script ainda não existe.

- [ ] **Step 3: Instalar as dependências**

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom
```

- [ ] **Step 4: Criar o arquivo de setup**

Criar `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Configurar o Vitest no `vite.config.ts`**

Adicionar a referência de tipos na **primeira linha** do arquivo e o bloco `test` dentro de `defineConfig`, depois de `build`:

```ts
/// <reference types="vitest/config" />
```

```ts
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
```

- [ ] **Step 6: Declarar os tipos dos matchers no `tsconfig.json`**

Em `compilerOptions`, adicionar:

```json
    "types": ["node", "@testing-library/jest-dom"],
```

`"node"` é obrigatório na lista. Declarar `types` explicitamente **desliga** a
inclusão automática de todo `@types/*` instalado — e os testes das Tasks 3, 5, 6
e 7 importam `node:fs`. Sem `"node"` ali, esses arquivos ficam vermelhos no
editor. O `vite-env.d.ts` na raiz continua fornecendo os tipos de
`import.meta.env` por referência tripla, então nada se perde.

- [ ] **Step 7: Adicionar os scripts no `package.json`**

Em `scripts`, adicionar:

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS — `1 passed`.

- [ ] **Step 9: Confirmar que o build não quebrou**

Run: `npm run build`
Expected: build conclui sem erro.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json src/test/
git commit -m "Adiciona Vitest e React Testing Library

O projeto nao tinha nenhum teste. A migracao para o design system vai
reescrever telas de mais de mil linhas com calculo fiscal dentro, e sem
rede de seguranca isso e aposta.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: ESLint + Prettier

**Files:**

- Create: `eslint.config.mjs`
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Modify: `package.json` (deps de dev e scripts)

**Interfaces:**

- Consumes: nada da Task 1.
- Produces: os comandos `npm run lint` e `npm run format`.

- [ ] **Step 1: Instalar as dependências**

`prettier` e `prettier-plugin-tailwindcss` já estão no `package.json` sem nenhuma configuração que os use. Faltam os do ESLint:

```bash
npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh globals
```

- [ ] **Step 2: Criar `eslint.config.mjs`**

Extensão `.mjs` é obrigatória: o `package.json` não tem `"type": "module"`, então um `eslint.config.js` com `export default` quebraria.

```js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "*.config.js"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
```

- [ ] **Step 3: Criar `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 80,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- [ ] **Step 4: Criar `.prettierignore`**

```
dist
node_modules
package-lock.json
src/design-system
```

`src/design-system` fica de fora de propósito: os arquivos de token são cópia fiel do Design System e reformatá-los faria o próximo sync divergir por espaço em branco.

- [ ] **Step 5: Adicionar os scripts no `package.json`**

```json
    "lint": "eslint .",
    "format": "prettier --write ."
```

- [ ] **Step 6: Rodar o lint e registrar a linha de base**

Run: `npm run lint`
Expected: o comando **executa** e imprime uma lista de problemas. O código é legado e vai acusar dezenas de avisos — isso é esperado e **não é para corrigir nesta task**. Anotar o total (`✖ N problems`) para citar no commit.

Se o comando falhar por erro de configuração (e não por achados de lint), aí sim há bug a corrigir.

- [ ] **Step 7: Rodar o Prettier apenas em conferência**

Run: `npx prettier --check src/test/`
Expected: PASS, ou uma lista de arquivos a formatar. **Não** rodar `npm run format` no `src/` inteiro nesta fase: reformatar 16.000 linhas destruiria o `git blame` e enterraria o diff das fases seguintes.

- [ ] **Step 8: Rodar os testes**

Run: `npm test`
Expected: PASS — 1 passed. Nada quebrou.

- [ ] **Step 9: Commit**

```bash
git add eslint.config.mjs .prettierrc.json .prettierignore package.json package-lock.json
git commit -m "Adiciona ESLint e Prettier

O prettier-plugin-tailwindcss ja estava instalado sem nenhuma configuracao
que o usasse. Linha de base do lint: N problemas, todos em codigo legado,
nenhum corrigido aqui - a limpeza acontece tela a tela na Fase 3.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

Substituir `N` pelo número anotado no Step 6.

---

### Task 3: Copiar os tokens do Design System

**Files:**

- Create: `src/design-system/styles.css`
- Create: `src/design-system/tokens/colors.css`
- Create: `src/design-system/tokens/typography.css`
- Create: `src/design-system/tokens/spacing.css`
- Create: `src/design-system/tokens/shape.css`
- Create: `src/design-system/tokens/motion.css`
- Create: `src/design-system/tokens/base.css`
- Create: `src/design-system/ORIGEM.md`
- Modify: `src/styles/index.css` (linha 1)
- Test: `src/design-system/tokens.test.ts`

**Interfaces:**

- Consumes: `npm test` da Task 1.
- Produces: as custom properties CSS que a Task 4 consome por nome — `--color-primary-50` a `--color-primary-900`, `--action`, `--action-hover`, `--action-tint`, `--bg-base`, `--surface`, `--surface-elevated`, `--border-color`, `--border-muted`, `--border-strong`, `--text-body`, `--text-heading`, `--text-muted`, `--text-faint`, `--color-success-500`, `--color-danger-500`, `--color-warning-500`, `--color-info-500`, `--font-sans`, `--font-mono`, `--radius-lg`, `--radius-xl`, `--radius-2xl`.

- [ ] **Step 1: Escrever o teste de guarda dos tokens**

Criar `src/design-system/tokens.test.ts`. Ele trava a cópia: se um sync futuro trouxer arquivo truncado ou renomear token, o teste acusa.

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ler = (caminho: string) => readFileSync(caminho, "utf8");

describe("tokens do design system", () => {
  it("styles.css importa os seis arquivos de token", () => {
    const css = ler("src/design-system/styles.css");
    for (const arquivo of [
      "colors",
      "typography",
      "spacing",
      "shape",
      "motion",
      "base",
    ]) {
      expect(css).toContain(`tokens/${arquivo}.css`);
    }
  });

  it("a rampa primaria sai do azul do logo", () => {
    const css = ler("src/design-system/tokens/colors.css");
    expect(css).toContain("--color-primary-500: #1f89ca");
    expect(css).toContain("--color-primary-600: #1a71a8");
  });

  it("a acao e o degrau 600 no claro e o 400 no escuro", () => {
    const css = ler("src/design-system/tokens/colors.css");
    expect(css).toContain("--action: var(--color-primary-600)");
    expect(css).toContain("--action: var(--color-primary-400)");
  });

  it("o tema escuro e navy, nao cinza-carvao", () => {
    const css = ler("src/design-system/tokens/colors.css");
    expect(css).toContain("--bg-base: #0d1b2a");
    expect(css).toContain("--surface: #132238");
    expect(css).toContain("--surface-elevated: #1a2f4a");
  });

  it("define a fonte e os raios que o tailwind.config consome", () => {
    const tipografia = ler("src/design-system/tokens/typography.css");
    const forma = ler("src/design-system/tokens/shape.css");
    expect(tipografia).toContain("--font-sans");
    expect(tipografia).toContain("--font-mono");
    expect(forma).toContain("--radius-lg");
    expect(forma).toContain("--radius-xl");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test`
Expected: FAIL — `ENOENT: no such file or directory, open 'src/design-system/styles.css'`.

- [ ] **Step 3: Baixar os sete arquivos do Claude Design**

Usar a ferramenta `DesignSync`, método `get_file`, com `projectId` `ef9f35f6-3af0-4651-9dee-45d08884432a`, para cada caminho abaixo, gravando o conteúdo **verbatim** no destino:

| Caminho no Design System | Destino no repo                           |
| ------------------------ | ----------------------------------------- |
| `styles.css`             | `src/design-system/styles.css`            |
| `tokens/colors.css`      | `src/design-system/tokens/colors.css`     |
| `tokens/typography.css`  | `src/design-system/tokens/typography.css` |
| `tokens/spacing.css`     | `src/design-system/tokens/spacing.css`    |
| `tokens/shape.css`       | `src/design-system/tokens/shape.css`      |
| `tokens/motion.css`      | `src/design-system/tokens/motion.css`     |
| `tokens/base.css`        | `src/design-system/tokens/base.css`       |

Não editar, não reformatar, não traduzir comentário. É cópia fiel — é isso que permite comparar com a origem num sync futuro.

Se a ferramenta `DesignSync` não estiver disponível na sessão, **parar e avisar o Erick**; não reescrever os tokens de memória.

- [ ] **Step 4: Verificar se os caminhos de `@import` batem**

Abrir `src/design-system/styles.css`. Ele importa os arquivos de `tokens/`. Como a pasta `tokens/` foi copiada para o mesmo nível, os caminhos relativos devem funcionar sem ajuste. Se o arquivo usar outra forma de caminho, ajustar **apenas o caminho**, e registrar o ajuste no `ORIGEM.md` do Step 6.

- [ ] **Step 5: Importar os tokens antes do Tailwind**

Em `src/styles/index.css`, a **primeira linha** do arquivo passa a ser:

```css
@import "../design-system/styles.css";
```

As três diretivas `@tailwind` continuam logo abaixo, na ordem em que já estão. A ordem importa: as custom properties precisam existir antes de o Tailwind gerar as utilidades que as consomem.

- [ ] **Step 6: Escrever o `ORIGEM.md`**

Criar `src/design-system/ORIGEM.md`:

```markdown
# Origem destes arquivos

Cópia fiel do design system publicado no Claude Design.

- **Projeto:** Health & Safety Design System
- **projectId:** `ef9f35f6-3af0-4651-9dee-45d08884432a`
- **Sincronizado em:** 2026-08-25
- **Arquivos copiados:** `styles.css` e `tokens/{colors,typography,spacing,shape,motion,base}.css`

## Regras

Estes arquivos **não são editados aqui**. Mudança de token acontece no projeto
do Claude Design e desce por novo sync. Editar localmente é o caminho conhecido
para os oito sistemas da H&S divergirem de novo — foi assim que se chegou a
quatro azuis diferentes.

`src/design-system` está no `.prettierignore` pelo mesmo motivo: reformatar faria
o próximo sync divergir por espaço em branco.

Os **primitivos** do design system (`Button`, `Card`, `Table`...) não estão aqui.
Eles são portados para `.tsx` + Tailwind na Fase 1, porque o original é escrito
com estilo inline e hover em JavaScript — o que não entrega `focus-visible`,
que o próprio checklist do design system exige. Ver a Decisão 4 do spec.

## Documento que governa

`docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md`
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS — 6 passed (1 de fumaça + 5 de token).

- [ ] **Step 8: Confirmar que o CSS ainda compila**

Run: `npm run build`
Expected: build conclui sem erro. Se o PostCSS reclamar de `@import`, verificar se a linha está mesmo antes das diretivas `@tailwind`.

- [ ] **Step 9: Commit**

```bash
git add src/design-system/ src/styles/index.css
git commit -m "Copia os tokens do Design System H&S

Copia fiel de styles.css e tokens/ do projeto publicado no Claude Design,
importados antes das diretivas do Tailwind. ORIGEM.md registra projectId e
data do sync, e a regra de nao editar localmente.

Nenhuma tela muda ainda: as custom properties existem mas nada as consome
ate o tailwind.config apontar para elas.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `tailwind.config.js` — classes de token e ponte de paleta

O coração da fase. Duas camadas num arquivo só.

**Files:**

- Modify: `tailwind.config.js` (substituição integral)
- Test: `src/test/tailwind-config.test.ts`

**Interfaces:**

- Consumes: as custom properties da Task 3.
- Produces: as classes `bg-action`, `bg-surface`, `bg-surface-base`, `bg-surface-elevated`, `border-borda`, `text-conteudo`, `text-conteudo-muted` e a rampa `primary-*`, todas consumidas pela Fase 1. Produz também a ponte: `blue-*`, `slate-700/800/900` e `darkBlue` remapeados.

- [ ] **Step 1: Escrever o teste da configuração**

Criar `src/test/tailwind-config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const config = require("../../tailwind.config.js");
const cores = config.theme.extend.colors;

describe("classes de token", () => {
  it("acao, superficie, borda e conteudo saem de custom property", () => {
    expect(cores.action.DEFAULT).toBe("var(--action)");
    expect(cores.surface.DEFAULT).toBe("var(--surface)");
    expect(cores.surface.base).toBe("var(--bg-base)");
    expect(cores.borda.DEFAULT).toBe("var(--border-color)");
    expect(cores.conteudo.DEFAULT).toBe("var(--text-body)");
  });

  it("a rampa primaria sai de custom property", () => {
    expect(cores.primary[600]).toBe("var(--color-primary-600)");
  });
});

describe("ponte de paleta", () => {
  it("blue-* aponta para a rampa do design system, em hexadecimal", () => {
    expect(cores.blue[600]).toBe("#1a71a8");
    expect(cores.blue[500]).toBe("#1f89ca");
    expect(cores.blue[400]).toBe("#47a6e1");
  });

  it("usa hexadecimal e nao var(), porque ha classes com opacidade", () => {
    // dark:bg-blue-900/40 existe no JSX. O Tailwind nao aplica alfa sobre
    // um var() que guarda hexadecimal - a classe sairia sem cor.
    for (const degrau of Object.values(cores.blue)) {
      expect(degrau).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("slate-700/800/900 apontam para as superficies escuras do DS", () => {
    expect(cores.slate[900]).toBe("#0d1b2a");
    expect(cores.slate[800]).toBe("#132238");
    expect(cores.slate[700]).toBe("#1a2f4a");
  });

  it("darkBlue sobrevive como alias depreciado", () => {
    expect(cores.darkBlue).toBe("#132238");
  });
});

describe("fonte e raio", () => {
  it("saem de custom property", () => {
    expect(config.theme.extend.fontFamily.sans).toContain("var(--font-sans)");
    expect(config.theme.extend.borderRadius.lg).toBe("var(--radius-lg)");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test`
Expected: FAIL — `Cannot read properties of undefined (reading 'DEFAULT')`. O config atual tem só `primary` e `darkBlue`.

- [ ] **Step 3: Substituir o `tailwind.config.js` inteiro**

Manter `module.exports` — o `package.json` não tem `"type": "module"`. O bloco de tokens vem do `guidelines/adocao.md` do design system; a ponte é adição desta fase.

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ── Camada 1: classes de token do Design System ──────────────
        // Reagem a troca de tema e a mudanca de token. É o que a Fase 1
        // em diante deve usar.
        primary: {
          DEFAULT: "var(--color-primary-500)",
          50: "var(--color-primary-50)",
          100: "var(--color-primary-100)",
          200: "var(--color-primary-200)",
          300: "var(--color-primary-300)",
          400: "var(--color-primary-400)",
          500: "var(--color-primary-500)",
          600: "var(--color-primary-600)",
          700: "var(--color-primary-700)",
          800: "var(--color-primary-800)",
          900: "var(--color-primary-900)",
        },
        action: {
          DEFAULT: "var(--action)",
          hover: "var(--action-hover)",
          tint: "var(--action-tint)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          base: "var(--bg-base)",
          elevated: "var(--surface-elevated)",
        },
        borda: {
          DEFAULT: "var(--border-color)",
          muted: "var(--border-muted)",
          strong: "var(--border-strong)",
        },
        conteudo: {
          DEFAULT: "var(--text-body)",
          heading: "var(--text-heading)",
          muted: "var(--text-muted)",
          faint: "var(--text-faint)",
        },
        success: "var(--color-success-500)",
        danger: "var(--color-danger-500)",
        warning: "var(--color-warning-500)",
        info: "var(--color-info-500)",

        // ── Camada 2: ponte de paleta (TEMPORARIA) ───────────────────
        // O JSX escreve cor literal: 272 classes de azul e 132 de slate.
        // Redefinir a paleta faz todas apontarem para a marca sem editar
        // nenhuma tela. Hexadecimal literal, e nao var(), porque existem
        // classes com modificador de opacidade (dark:bg-blue-900/40) e o
        // Tailwind nao aplica alfa sobre var() que guarda hexadecimal.
        //
        // Cada tela migrada na Fase 3 troca estas classes pelas de token
        // acima. Quando a ultima sair, este bloco inteiro e deletado.
        blue: {
          50: "#f1f9fe",
          100: "#dbeefa",
          200: "#b8ddf5",
          300: "#7bc0ea",
          400: "#47a6e1",
          500: "#1f89ca",
          600: "#1a71a8",
          700: "#155984",
          800: "#104565",
          900: "#0b3047",
        },
        // Usados exclusivamente sob o prefixo dark: (132 ocorrencias, zero
        // soltas), entao apontam direto para as superficies do tema escuro.
        slate: {
          700: "#1a2f4a", // --surface-elevated no escuro
          800: "#132238", // --surface no escuro
          900: "#0d1b2a", // --bg-base no escuro
        },
        // DEPRECIADO. 42 ocorrencias em 15 arquivos. Morre na Fase 3.
        darkBlue: "#132238",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      keyframes: {
        blinkLight: {
          "0%, 100%": { color: "#000000" },
          "50%": { color: "#dc2626" },
        },
        blinkDark: {
          "0%, 100%": { color: "#ffffff" },
          "50%": { color: "#dc2626" },
        },
      },
      animation: {
        blinkLight: "blinkLight 1s infinite",
        blinkDark: "blinkDark 1s infinite",
      },
    },
  },
  plugins: [],
};
```

O `safelist` some: as classes que ele protegia (`bg-white`, `dark:bg-darkBlue`, `dark:text-gray-200`, `dark:hover:bg-blue-700`) estão todas escritas por extenso no JSX, então o scanner do Tailwind as encontra sozinho. Os `keyframes` e `animation` de `blink*` ficam — são usados nas telas e não são assunto desta fase.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS — 13 passed (1 fumaça + 5 token + 7 config).

- [ ] **Step 5: Conferir a cor no CSS gerado**

Run: `npm run build`
Expected: build conclui. Depois, conferir a utilidade `bg-blue-600` no CSS gerado:

```bash
grep -o '\.bg-blue-600{[^}]*}' dist/assets/*.css
```

Expected: a regra sai com `26 113 168` — que é `#1a71a8`, o azul de ação do
design system — e **não** com `37 99 235`, que é o `#2563eb` antigo.

Duas armadilhas evitadas aqui. A primeira: o Tailwind v3 converte hexadecimal
para canais decimais no CSS gerado (`rgb(26 113 168 / var(--tw-bg-opacity))`),
para poder aplicar opacidade — procurar por `#1a71a8` no `dist` não acha nada.
A segunda: `#2563eb` **continua** existindo no CSS gerado, e deve continuar — é
o valor de `--color-info-600` nos tokens do design system. Procurar por ele solto
daria falso positivo. Por isso a conferência é na regra da classe, não no arquivo
inteiro.

- [ ] **Step 6: Conferir no navegador**

Run: `npm run dev`
Abrir `http://localhost:5174/login`, entrar, e percorrer Início, Dashboard e Vendas nos dois temas. O que se espera: azul da marca no lugar do azul antigo, tudo legível, nenhum elemento sumido ou branco-sobre-branco.

Se alguma classe `blue-*` estiver carregando sentido de _info_ (um aviso azul que não é ação), anotar arquivo e linha — **não corrigir agora**. Vira item da tela correspondente na Fase 3.

- [ ] **Step 7: Commit**

```bash
git add tailwind.config.js src/test/tailwind-config.test.ts
git commit -m "Aponta o Tailwind para os tokens e instala a ponte de paleta

Duas camadas. As classes de token novas (bg-action, bg-surface,
text-conteudo) saem de var() e reagem a tema. A ponte redefine blue-*,
slate-700/800/900 e darkBlue para os valores do design system em
hexadecimal literal, o que faz as 272 classes literais de azul e as 132 de
slate ja escritas no JSX pintarem a marca sem editar nenhuma tela.

Hexadecimal e nao var() na ponte: existem classes com modificador de
opacidade (dark:bg-blue-900/40) e o Tailwind nao aplica alfa sobre var()
que guarda hexadecimal.

O safelist sai - as classes que ele protegia estao escritas por extenso no
JSX e o scanner as encontra sozinho.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Codemod dos 212 hexadecimais arbitrários

Valor arbitrário dentro de classe (`dark:bg-[#0f172a]`) não responde a configuração. É o que sobra depois da ponte.

**Files:**

- Modify: todos os `src/**/*.tsx` que contenham `[#`, **exceto `src/pages/Login.tsx`**
- Modify: `src/styles/index.css` (a regra `.input-cc`)
- Test: `src/test/guarda-cores.test.ts`

**Exceção: `src/pages/Login.tsx` fica de fora.** Ele tem exatamente duas
ocorrências, as únicas do projeto **sem** o prefixo `dark:` — `bg-[#0a192f]` no
fundo cheio (linha 33) e `bg-[#0f172a]` no círculo do avatar (linha 41). São
fundo escuro deliberado nos dois temas: a tela de login é um painel escuro por
desenho, e o próprio design system registra login escuro como exceção
documentada. Convertê-las para `surface-base` deixaria o login branco no tema
claro. Ficam como estão e são resolvidas na Fase 1, que migra o Login como tela
piloto. São 210 conversões, não 212.

**Interfaces:**

- Consumes: as classes `surface` e `surface-base` da Task 4.
- Produces: nenhuma interface nova. Produz a garantia, travada por teste, de que não há hexadecimal arbitrário em classe.

- [ ] **Step 1: Escrever o teste de guarda**

Criar `src/test/guarda-cores.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Login.tsx e exceção documentada: as duas ocorrencias dele sao fundo escuro
// deliberado nos dois temas (painel de login), nao dark: por variante. Saem
// daqui quando a Fase 1 migrar a tela.
const EXCECOES = ["src/pages/Login.tsx"];

const arquivosDeInteresse = readdirSync("src", {
  recursive: true,
  encoding: "utf8",
})
  .filter((caminho) => /\.(tsx|css)$/.test(caminho))
  .map((caminho) => `src/${caminho}`)
  .filter((caminho) => !caminho.startsWith("src/design-system/"))
  .filter((caminho) => !EXCECOES.includes(caminho));

describe("guarda de cor", () => {
  it("nenhuma classe Tailwind carrega hexadecimal arbitrario", () => {
    const infratores: string[] = [];
    for (const caminho of arquivosDeInteresse) {
      const conteudo = readFileSync(caminho, "utf8");
      for (const achado of conteudo.match(/\[#[0-9a-fA-F]{3,8}\]/g) ?? []) {
        infratores.push(`${caminho}: ${achado}`);
      }
    }
    expect(infratores).toEqual([]);
  });
});
```

O teste ignora `src/design-system/` de propósito — aquilo é cópia fiel e não se edita. E casa só a forma entre colchetes: `fill="#0f172a"` num gráfico do recharts não é classe Tailwind e é assunto da Fase 3.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test`
Expected: FAIL — a lista de infratores traz 210 entradas (as duas do
`Login.tsx` não entram, pela exceção declarada no teste).

- [ ] **Step 3: Rodar o codemod**

Quatro substituições, preservando o prefixo do utilitário (`bg-`, `border-`, `text-`, `hover:bg-`...). Os dois hexadecimais mais escuros viram o fundo da página; os dois mais claros viram a superfície.

```bash
cd ~/github/DataCoreHS
FILES=$(grep -rl '\[#' --include='*.tsx' --include='*.css' src | grep -v '^src/design-system/' | grep -v '^src/pages/Login.tsx$')
perl -pi -e 's/\[#0f172a\]/surface-base/g;  # slate-900 -> --bg-base
             s/\[#0a192f\]/surface-base/g;  # navy proprio -> --bg-base
             s/\[#1e293b\]/surface/g;       # slate-800 -> --surface
             s/\[#1e3a8a\]/surface/g;       # darkBlue antigo -> --surface' $FILES
```

- [ ] **Step 4: Conferir o diff antes de aceitar**

Run: `git diff --stat` e depois `git diff src/styles/index.css`

Expected: só linhas de classe mudaram. A regra `.input-cc` em `src/styles/index.css` deve ter passado de `dark:bg-[#0f172a]` para `dark:bg-surface-base`. Nenhuma mudança fora de atributo `className` ou de `@apply`.

Se o `perl` tiver tocado uma string que não era classe (por exemplo um valor de cor de gráfico entre colchetes), reverter aquele arquivo com `git checkout -- <arquivo>` e tratá-lo à mão.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS — 14 passed. A lista de infratores está vazia.

- [ ] **Step 6: Conferir o tema escuro no navegador**

Run: `npm run dev`

Com o tema escuro ligado, percorrer Início, Dashboard, Vendas e Clientes. O fundo agora é o navy do design system (`#0d1b2a`), não mais o `#0f172a` antigo. O que se procura: card sem contraste contra o fundo, texto ilegível, campo de formulário que sumiu.

- [ ] **Step 7: Commit**

```bash
git add src/
git commit -m "Troca os 212 hexadecimais arbitrarios por classes de token

Valor arbitrario dentro de classe nao responde a configuracao: nem a ponte
de paleta nem qualquer mudanca no tailwind.config alcanca dark:bg-[#0f172a].
Substituicao mecanica preservando o prefixo do utilitario, revisada no diff.

[#0f172a] e [#0a192f] viraram surface-base; [#1e293b] e [#1e3a8a] viraram
surface. Alcanca tambem a regra .input-cc em src/styles/index.css.

O Login.tsx fica de fora: as duas ocorrencias dele sao as unicas sem prefixo
dark: no projeto, e sao fundo escuro deliberado nos dois temas. O teste de
guarda declara a excecao. A Fase 1 resolve quando migrar a tela.

Um teste de guarda impede que hexadecimal arbitrario volte ao codigo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Plus Jakarta Sans

**Files:**

- Modify: `index.html`
- Test: `src/test/fonte.test.ts`

**Interfaces:**

- Consumes: `--font-sans` de `src/design-system/tokens/typography.css` (Task 3) e o `fontFamily` do `tailwind.config.js` (Task 4).
- Produces: a família tipográfica carregada **cedo**, com preconnect.

**Atenção — a fonte já carrega depois da Task 3.** O `tokens/typography.css` do
design system abre com `@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans...")`
e o `tokens/base.css` já aplica `font-family: var(--font-sans)` no `body`. Ou
seja: ao fim da Task 3 o texto **já** está em Plus Jakarta Sans.

O que esta task entrega é velocidade, não a fonte. Pelo `@import` encadeado o
navegador só descobre o arquivo depois de buscar `index.css`, achar
`styles.css`, achar `typography.css` e então pedir a fonte — quatro idas ao
servidor em série, com texto invisível ou na fonte errada até o fim. O `<link>`
no `<head>` dispara o pedido imediatamente, e o `preconnect` abre a conexão TLS
com os dois hosts antes disso.

- [ ] **Step 1: Escrever o teste**

Criar `src/test/fonte.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Plus Jakarta Sans", () => {
  it("index.html carrega a fonte do Google Fonts com os pesos 300 a 800", () => {
    const html = readFileSync("index.html", "utf8");
    expect(html).toContain("fonts.googleapis.com");
    expect(html).toContain("Plus+Jakarta+Sans");
    expect(html).toContain("wght@300;400;500;600;700;800");
  });

  it("index.html faz preconnect nos dois hosts do Google Fonts", () => {
    const html = readFileSync("index.html", "utf8");
    expect(html).toContain(
      'rel="preconnect" href="https://fonts.googleapis.com"',
    );
    expect(html).toContain('rel="preconnect" href="https://fonts.gstatic.com"');
  });

  it("o token --font-sans nomeia a fonte", () => {
    const css = readFileSync("src/design-system/tokens/typography.css", "utf8");
    expect(css).toContain("Plus Jakarta Sans");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test`
Expected: FAIL nos dois primeiros casos — `index.html` ainda não carrega fonte nenhuma.

- [ ] **Step 3: Adicionar os links no `index.html`**

Dentro de `<head>`, **antes** da linha `<link rel="stylesheet" href="/src/styles/index.css" />`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
  rel="stylesheet"
/>
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS — 17 passed.

- [ ] **Step 5: Conferir no navegador**

Run: `npm run dev`

Na aba Elements, inspecionar o `<body>` e conferir que a `font-family` computada
traz `Plus Jakarta Sans` — isso já era verdade depois da Task 3.

O que se verifica aqui é a **ordem** dos pedidos. Na aba Network, com o filtro
`Font` e o cache desligado, o pedido a `fonts.gstatic.com` deve partir junto do
HTML, não depois da cadeia de CSS. Comparar a coluna de tempo de início do
arquivo de fonte com a do `index.css`: a fonte não pode começar depois.

- [ ] **Step 6: Commit**

```bash
git add index.html src/test/fonte.test.ts
git commit -m "Carrega Plus Jakarta Sans

A fonte oficial do design system, escolhida contra IBM Plex Sans e Source
Sans 3 na mesma tela. Substitui a pilha do sistema que o projeto usava.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Limpeza — dependências mortas e `.env.example`

**Files:**

- Modify: `package.json`
- Create: `.env.example`
- Test: `src/test/dependencias.test.ts`

**Interfaces:**

- Consumes: nada.
- Produces: nada. É higiene.

- [ ] **Step 1: Escrever o teste**

Criar `src/test/dependencias.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const todas = { ...pkg.dependencies, ...pkg.devDependencies };

describe("dependencias", () => {
  it("nao carrega pacotes do Tailwind v4 num projeto que constroi com o v3", () => {
    expect(todas["@tailwindcss/vite"]).toBeUndefined();
    expect(todas["@tailwindcss/postcss"]).toBeUndefined();
  });

  it("continua no Tailwind 3", () => {
    expect(todas.tailwindcss).toMatch(/^\^?3\./);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test`
Expected: FAIL — os dois pacotes v4 estão instalados.

- [ ] **Step 3: Remover as dependências mortas**

Quem constrói o CSS é o `tailwindcss@3.4.17` pelo `postcss.config.js`. Os pacotes v4 estão instalados e nenhum arquivo os importa.

```bash
npm uninstall @tailwindcss/vite @tailwindcss/postcss
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS — 19 passed.

- [ ] **Step 5: Confirmar que o build continua de pé**

Run: `npm run build`
Expected: build conclui sem erro. Esta é a verificação que importa — se o CSS gerado sumisse, o Tailwind dependia de um dos pacotes removidos.

- [ ] **Step 6: Criar o `.env.example`**

Só os **nomes** das variáveis. Nenhum valor de produção entra em arquivo versionado.

```bash
VITE_API_URL=
VITE_NOTAS_URL=
```

- [ ] **Step 7: Confirmar que o `.env` está ignorado**

Run: `git check-ignore -v .env`
Expected: imprime a regra do `.gitignore` que o cobre. Se **não** imprimir nada, o `.env` não está ignorado — adicionar `.env` ao `.gitignore` no mesmo commit e avisar o Erick, porque pode já ter sido versionado antes.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .env.example src/test/dependencias.test.ts
git commit -m "Remove dependencias mortas do Tailwind v4 e versiona .env.example

Quem constroi o CSS e o tailwindcss@3.4.17 pelo postcss.config.js.
@tailwindcss/vite e @tailwindcss/postcss estavam instalados sem que
nenhum arquivo os importasse.

.env.example versiona so os nomes das variaveis. As duas estao comentadas
no .env local, o que faz tudo cair no fallback cravado em services/api.ts -
confirmar com o Erick qual URL esta valendo em producao.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Verificação da fase

Sem commit. É o portão antes de declarar a Fase 0 pronta e abrir a Fase 1.

**Files:** nenhum.

- [ ] **Step 1: Suíte verde e build limpo**

```bash
npm test && npm run build
```

Expected: 19 testes passando, build sem erro.

- [ ] **Step 2: Percorrer as 18 rotas nos dois temas**

Run: `npm run dev` e visitar cada uma, no claro e no escuro:

`/login` · `/inicio` · `/dashboard` · `/clientes` · `/estoque` · `/servicos` · `/vendas` · `/locacao` · `/produtos` · `/vendedores` · `/usuarios` · `/configuracoes` · `/financeiro` · `/contas-pagar` · `/contas-receber` · `/` · uma URL inexistente (404) · e uma rota bloqueada para o papel logado.

Em cada uma, procurar: texto ilegível, elemento sumido, branco sobre branco, card sem contraste, botão que perdeu a cor.

- [ ] **Step 3: Confirmar que nenhuma tela foi reescrita**

```bash
git diff --stat main...HEAD -- src/pages src/components
```

Expected: as únicas linhas alteradas são as do codemod da Task 5 — troca de `[#hex]` por classe de token, nada mais. Se aparecer mudança de estrutura, lógica ou texto, algum passo saiu do escopo da fase.

- [ ] **Step 4: Registrar o que ficou para a Fase 3**

Juntar as anotações do Step 6 da Task 4 (classes `blue-*` que carregavam sentido de _info_) e do Step 6 da Task 5 (problemas de contraste no escuro) numa lista por tela, e anexá-la ao spec, na seção "Perguntas em aberto". Cada item vira trabalho da tela correspondente.

- [ ] **Step 5: Checkpoint com o Erick**

Mostrar o resultado nos dois temas e confirmar antes de abrir o plano da Fase 1. Nada de `git push` sem autorização.

---

## Cobertura do spec

| Entrega da Fase 0 no spec                         | Task      |
| ------------------------------------------------- | --------- |
| 1 · `src/design-system/` com tokens e `ORIGEM.md` | 3         |
| 2 · Import antes das diretivas `@tailwind`        | 3         |
| 3 · `tailwind.config.js` do `adocao.md`           | 4         |
| 4 · Ponte de paleta                               | 4         |
| 5 · Codemod dos hexadecimais arbitrários          | 5         |
| 6 · Plus Jakarta Sans                             | 6         |
| 7 · Tema escuro navy por token                    | 3 + 4 + 5 |
| 8 · Vitest + React Testing Library                | 1         |
| 9 · ESLint + Prettier                             | 2         |
| 10 · Limpeza de dependências e `.env.example`     | 7         |
| "Pronto quando" da fase                           | 8         |
