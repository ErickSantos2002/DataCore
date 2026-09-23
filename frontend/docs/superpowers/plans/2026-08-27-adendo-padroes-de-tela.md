# Adendo — os padrões de tela que o design estabelece

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir os padrões de tela que se repetem nas doze telas da Fase 3, antes de a Fase 3 começar — para que elas consumam um padrão em vez de inventar doze.

**Architecture:** Estes componentes **não são port**. Não existe `.d.ts` no design system para eles: nasceram no design que o Erick fez no Claude Design, e a API é decisão nossa. Valem as mesmas regras dos primitivos portados — token, `focus-visible`, sem estilo inline de aparência, sem `blue-*`/`slate-*` — e os cinco guardas os avaliam.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS 3.4.17, Vitest, React Testing Library.

**Fonte:** `.superpowers/sdd/2026-08-25-fase-1-casca-primitivos/levantamento-design.md`, que extraiu a anatomia de cada padrão de `docs/DataCoreHS.html`.

## Global Constraints

- **Branch:** `ds/fase-1-primitivos`, a mesma da Fase 1. Nada em `main`, nenhum `git push`.
- **Não editar** `src/design-system/tokens/` nem `styles.css`.
- Estilo inline só para `width`/`height` vindos de dado.
- Nenhuma classe de token com modificador de opacidade.
- Interface em português do Brasil, sentence case, sem emoji. Frase de erro completa com ponto final.
- `focus-visible` com anel de 2px, nunca `focus`.
- Escala de sobreposição: `z-dropdown` < `z-overlay` < `z-tooltip` < `z-toast`.

## O design tem inconsistências — não copie as dele

O levantamento achou três lugares onde o design reimplementa o que a biblioteca já
resolve: ele **nunca** usa o `Progress` (refaz a barra com `div` em aging, faixas
de bonificação e progresso de meta), **nunca** usa o `TableEmpty`, e só usa `Tabs`
de verdade uma vez — no resto, refaz um segmented control à mão.

A regra deste adendo: **o design é fonte de padrão, não de implementação.** Onde
ele reimplementa algo que temos, use o que temos.

---

### Task 1: `Chip` e `KpiCard`

Os dois menores, sem dependência, e o `Chip` destrava a Task 3.

**Files:**

- Create: `src/design-system/ui/core/Chip.tsx`, `src/design-system/ui/data/KpiCard.tsx`
- Modify: os `index.ts` de `core/` e `data/`
- Test: `Chip.test.tsx`, `KpiCard.test.tsx` ao lado de cada

**`Chip`** — pílula usada como filtro aplicado e como visão salva. Duas variantes:

- `aplicado`: altura 26px, padding `0 10px`, `rounded-full`, fundo `bg-action-tint`,
  texto `text-action`, e um `×` que remove — o `×` é um `<button>` com
  `aria-label={"Remover filtro " + rótulo}` e `focus-visible`
- `salvo`: mesma pílula, sem fundo, com `border border-borda`, texto normal

Quando não há `onRemove`, o `×` não aparece.

**`KpiCard`** — cartão de indicador, três linhas de anatomia fixa:

- rótulo: 11px, `font-semibold`, caixa alta, `tracking-[0.1em]`, `text-conteudo-faint`
- valor: `font-mono`, `font-bold`, `whitespace-nowrap`, tamanho `clamp(16px, 2.1vw, 24px)`;
  cor por `tone`: `acao` (`text-action`), `positivo` (`text-success`),
  `alerta` (`text-on-tint-warning`), `perigo` (`text-on-tint-danger`),
  `neutro` (`text-conteudo-heading`, padrão)
- nota: 12px, `text-conteudo-muted`, contextualizando o número

Quando o valor é texto e não número (`"Produto Top"`), o tamanho cai para 16px fixo
e ganha truncamento com reticências — exponha isso por prop, não por adivinhação.

O cartão tem 116px de altura e vive numa faixa
`grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4` — a faixa é composição da
tela, não componente.

- [ ] Escrever os testes primeiro e confirmar que falham
- [ ] Portar os dois seguindo as medidas acima
- [ ] `npm test`, `npm run build`, `npm run lint` sem piorar
- [ ] Commit

---

### Task 2: `Drawer`

O achado mais reaproveitável do levantamento: aparece em Vendas, Locação e num
painel genérico compartilhado por Serviços, Clientes e as duas telas de Contas.

**Files:**

- Create: `src/design-system/ui/feedback/Drawer.tsx`
- Modify: `src/design-system/ui/feedback/index.ts`
- Test: `Drawer.test.tsx`

**Não é o `Modal`.** O `Modal` é centrado; este desliza da direita. Mas a mecânica
de acessibilidade é a mesma, e **já está resolvida no `Modal.tsx`**: prisão de foco
nas duas direções, devolução do foco ao fechar, `aria-labelledby` por `useId`,
`Esc` fecha, `role="dialog"` **no painel** e não no envolvente que inclui a cortina.
Leia o `Modal.tsx` e reaproveite o mecanismo — se compensar, extraia o que os dois
compartilham; se não, replique com o mesmo cuidado e diga por quê no relatório.

Anatomia, do levantamento:

- envolvente `fixed inset-0 z-overlay`; cortina `bg-overlay backdrop-blur-[4px]`,
  fecha ao clique
- painel: largura 420–460px, `max-w-[92vw]`, encostado à direita, altura total,
  `overflow-y-auto`, fundo `bg-surface`, borda esquerda 1px `border-borda`
- cabeçalho: identificador em `font-mono` caixa alta `text-conteudo-faint`,
  nome em `<h2>`, subtítulo em `font-mono text-conteudo-muted`, `Badge` de estado,
  e botão fechar de 32×32 com `Icon name="close"`
- corpo: grade de pares rótulo/valor em duas colunas
- rodapé: dois botões, sempre secundário à esquerda e ação à direita

**A animação de entrada** desliza da direita. Use os tokens de movimento
(`--duration-*`, `--ease-*`) e respeite `prefers-reduced-motion`, que o
`tokens/motion.css` já trata globalmente.

- [ ] Teste primeiro: prova que prende foco nas duas direções, que `Esc` fecha,
      que o foco volta ao gatilho, e que o `role="dialog"` está no painel
- [ ] Implementar
- [ ] `npm test`, build, lint
- [ ] Commit

---

### Task 3: `FilterBar`

O maior ganho de consistência: o padrão se repete em oito das doze telas grandes,
e hoje **não existe nada parecido** no código.

**Files:**

- Create: `src/design-system/ui/data/FilterBar.tsx`
- Modify: `src/design-system/ui/data/index.ts`
- Test: `FilterBar.test.tsx`

Anatomia, do levantamento:

- Um `Card` só. Primeira linha: campos em `flex items-end gap-3 flex-wrap`, com
  largura fixa por campo. Um bloco com `ml-auto` empurra ações para a direita
  quando sobra espaço.
- Separador `border-t`, e segunda linha com `pt-3.5 mt-3.5`:
  rótulo **"Aplicados"** (11px, caixa alta, `tracking-[0.1em]`, `text-conteudo-faint`)
  → `Chip` variante `aplicado` para cada filtro ativo, com `×`
  → botão de texto **"Limpar filtros"**
  → separador vertical de 1px por 18px
  → rótulo **"Visões"**
  → `Chip` variante `salvo` para cada visão

**A decisão de escopo, e ela importa:** o `FilterBar` **não** guarda estado nem
persiste visão. Ele recebe os filtros aplicados e as visões como propriedade, e
avisa por callback quando algo é removido, limpo ou escolhido. Quem decide onde a
visão é salva — memória, `localStorage`, banco — é a tela, na Fase 3. Um componente
de apresentação que grava em `localStorage` é o tipo de acoplamento que a Fase 2
vai ter de desfazer.

Os campos vêm como `children`, para a tela compor com `SearchSelect`, `Select` e
`Input` — o `FilterBar` não conhece os filtros de cada tela.

- [ ] Teste primeiro: prova que remove um filtro pelo `×`, que "Limpar filtros"
      avisa, que uma visão escolhida avisa, e que a segunda linha some quando não
      há nem filtro aplicado nem visão
- [ ] Implementar
- [ ] `npm test`, build, lint
- [ ] Commit

---

### Task 4: `RankedList` e `DataList`

Os dois "quase componentes" que o levantamento identificou como baratos.

**Files:**

- Create: `src/design-system/ui/data/RankedList.tsx`, `DataList.tsx`
- Modify: `src/design-system/ui/data/index.ts`
- Test: um ao lado de cada

**`RankedList`** — "Top produtos", "Top clientes", "Top vendedores", "Top
fornecedores". Repete em pelo menos seis telas com a mesma marcação: nome e valor
numa linha, e logo abaixo uma barra de 6px proporcional ao **maior valor da
lista**, com trilho `bg-action-tint` e preenchimento `bg-action`.

**Use o `Progress` que já existe** para a barra. O design a reimplementa com `div`,
mas isso é a inconsistência dele, não um requisito.

**`DataList`** — pares rótulo/valor com fundo alternado: "Resumo do Período",
"Comparativo Mensal", "Estatísticas do Estoque" e mais dois. Linhas com
`px-3 py-2.5 rounded-lg`, alternando `bg-surface-base` e transparente. **Não** usa
`Table` — não é dado tabular, é ficha.

- [ ] Testes primeiro
- [ ] Implementar
- [ ] `npm test`, build, lint
- [ ] Commit

---

## O que fica de fora, e por quê

- **Gráficos** — o design desenha barra, rosca e velocímetro em SVG à mão. O código
  já resolve gráfico com `recharts` e o `chartTheme.ts` da Fase 1, em nove telas.
  O desenho dele vale como referência de leiaute; a implementação, não.
- **Segmented control** — o design o refaz à mão em vários lugares e usa `Tabs` de
  verdade só uma vez. Use o `Tabs` que já existe.
- **Cartão de aging** — é um `KpiCard` com uma barra embaixo. Depois que o
  `KpiCard` e o `Progress` existirem, é composição de tela, não componente novo.
- **Estado vazio de tabela** — o `TableEmpty` já existe e o design simplesmente não
  o usa. Use o nosso.

## Depois

Estes seis componentes nasceram do design do DataCoreHS, mas o padrão não é dele:
os outros sete sistemas da H&S têm listagem com filtro e detalhe. **Vale propô-los
ao design system no Claude Design** — se o padrão nascer aqui e ficar aqui, a
divergência recomeça, que é exatamente o que este projeto inteiro existe para
evitar.
