# DataCoreHS — adoção do Design System H&S e modernização do front

Data: 2026-08-25 · Autor: Erick Santos (com Claude Code)

## Contexto

O DataCoreHS é o sistema de dados e notas fiscais da Health & Safety. Foi escrito
sem biblioteca de componentes: as telas são monolitos de Tailwind cru, com cor
decidida arquivo a arquivo. Em ago/2026 a H&S passou a ter um design system
próprio, publicado no Claude Design (projeto `Health & Safety Design System`,
`ef9f35f6-3af0-4651-9dee-45d08884432a`), que define tokens, primitivos e um guia
de adoção — `guidelines/adocao.md` — com uma linha específica para este sistema:

> **DataCoreHS** — já bate: layout header + sidebar, rotas por papel.
> Muda: rampa (`#2563EB` → marca), raio, `dark:` cravado em classe vira token,
> `lucide-react` continua para ícones.

O trabalho aqui é maior que a adoção visual: o sistema é antigo e carrega dívida
de arquitetura que seria irresponsável congelar por baixo de uma pele nova.

## Objetivo

Deixar o DataCoreHS no padrão do Design System H&S — visual, vocabulário e
componentes — e, no mesmo movimento, corrigir a dívida estrutural que a migração
tela a tela naturalmente expõe: permissões duplicadas, contexts globais, ausência
de code splitting e ausência total de testes.

## Não-objetivos

- **Não** é redesenho de produto. O layout e o fluxo de cada tela permanecem; muda
  a aparência, a consistência e a estrutura do código por trás.
- **Não** é mudança de backend. Nenhuma API é alterada. Onde uma correção depende
  do backend (ver Perguntas em aberto), a pergunta fica registrada, não resolvida.
- **Não** é publicação de pacote npm do design system. Ver Decisão 3.
- **Não** inclui os outros sete sistemas da H&S.

## Estado atual (medido em 2026-08-25)

Repositório: `~/github/DataCoreHS` · React 19 + Vite 7 + TypeScript 5.8 +
Tailwind 3.4.17 · 50 arquivos em `src/`, ~16.000 linhas.

| Sintoma                                                      | Número                                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Classes `dark:` no JSX                                       | 1.626                                                                                                        |
| Classes literais de azul (`bg-blue-600`, `text-blue-600`...) | 272                                                                                                          |
| Hexadecimais arbitrários em classe (`dark:bg-[#0f172a]`...)  | 212                                                                                                          |
| Usos de `bg-primary` / `text-primary` / `border-primary`     | **0**                                                                                                        |
| Hexadecimais cravados no JSX                                 | 528                                                                                                          |
| Páginas acima de 800 linhas                                  | 7 (Vendas 1554, Clientes 1387, Estoque 1362, Vendedores 1361, Servicos 1258, Produtos 1221, ContasPagar 839) |
| Contexts montados sempre, no `main.tsx`                      | 12                                                                                                           |
| Guardas de rota quase idênticos                              | 6                                                                                                            |
| Páginas com paginação escrita à mão                          | 11                                                                                                           |
| Páginas com tabela própria                                   | 10                                                                                                           |
| Páginas usando `recharts`                                    | 9                                                                                                            |
| Ícones carregados de `img.icons8.com`                        | 19                                                                                                           |
| `alert()` fazendo papel de feedback                          | 4                                                                                                            |
| Code splitting / `lazy`                                      | nenhum                                                                                                       |
| ESLint / Prettier config / testes / CI                       | nenhum                                                                                                       |

Achados que não são estilo:

1. **Permissão por ID de banco.** `router.tsx` libera `/locacao` e `/financeiro`
   com `[1, 3, 4].includes(user.id)`, e `Sidebar.tsx` repete o mesmo array para
   decidir se exibe o item de menu. Regra de negócio duplicada e presa a IDs.
2. **`services/api.ts:22`** — `updateUserPassword` usa `axios` cru em vez da
   instância `authApi`, então a troca de senha sai sem header `Authorization`.
3. **`.env` com `VITE_API_URL` e `VITE_NOTAS_URL` comentadas**, o que faz tudo
   cair no fallback `https://authapi.healthsafetytech.com` cravado no código.
4. **O token `primary` do Tailwind não é usado por ninguém.** As telas escrevem
   cor literal (`bg-blue-600`, `text-blue-600`, `hover:bg-blue-700`) — 272
   ocorrências. Trocar a rampa no `tailwind.config.js` sozinho não muda cor
   nenhuma na interface. `darkBlue`, ao contrário, é usado 42 vezes em 15
   arquivos, então removê-lo quebra o fundo escuro desses arquivos.
5. **212 hexadecimais arbitrários dentro de classe Tailwind**, dos quais 210 são
   convertidos e 2 ficam — ver a exceção do `Login.tsx` abaixo. — `[#0f172a]`
   163x, `[#1e293b]` 37x, `[#1e3a8a]` 6x, `[#0a192f]` 6x. Valor arbitrário não
   responde a configuração: nenhuma mudança no `tailwind.config.js` os alcança.
   Todos são fundo de tema escuro.
6. **Dependências mortas de Tailwind v4** (`@tailwindcss/vite`,
   `@tailwindcss/postcss`) instaladas num projeto que constrói com o v3 via
   `postcss.config.js`. Não há configuração dupla — é lixo de dependência.

## Decisões

**1 · Ordem: fundação → primitivos → transversal → telas.**
As 12 telas grandes são migradas uma única vez, já sobre a estrutura final.
A alternativa (telas antes do transversal) entrega repaginação mais cedo, mas
paga um segundo passe em cada tela quando providers e lazy mudarem.

**2 · Verificação por teste de caracterização.**
Vitest + React Testing Library entram na Fase 0. Antes de tocar em cada tela
grande, um teste fixa o comportamento atual — filtro, ordenação, cálculo,
paginação, abertura de modal. Migra-se com o teste passando. Sem isso, refatorar
1.554 linhas de tela fiscal é aposta, não engenharia.

**3 · O design system entra copiado para dentro do repo.**
`src/design-system/`, como o `adocao.md` instrui. Um pacote npm privado resolveria
a divergência de forma definitiva, mas exige repositório, build, versionamento e
registry autenticado antes da primeira linha útil. O risco conhecido — recopiar em
oito repos — é mitigado por `ORIGEM.md` registrando projectId, data do sync e
o que foi portado.

**4 · Tokens são copiados verbatim; primitivos são portados.**
Os primitivos do DS são escritos com `style={{...}}` inline e hover via
`useState`/`onMouseEnter`, porque precisam renderizar sozinhos no canvas do Claude
Design. Num app Tailwind isso custa `:hover` em CSS, `focus-visible`, responsivo e
sobrescrita por classe — e o próprio checklist do `adocao.md` exige
"`focus-visible` com anel de 2px, não `focus`", que a versão inline não entrega.
Portanto: `styles.css` e `tokens/` entram como cópia fiel; cada primitivo é
reescrito em `.tsx` + Tailwind preservando **exatamente** a API (`variant`, `size`,
`loading`, `icon`, `fullWidth`) e as medidas do original, com o `.d.ts` e o
`.prompt.md` de cada componente servindo de especificação.

**5 · Tailwind fica no v3.** As duas dependências v4 são removidas. O
`tailwind.config.js` pronto do `adocao.md` é formato v3.

**6 · Ponte de paleta na Fase 0.**
Como o token `primary` não é usado e a cor mora em classe literal, a Fase 0
redefine `blue-*` para a rampa primária do DS e `slate-*` para as superfícies
navy, dentro do `tailwind.config.js`. As 272 classes literais passam a apontar
para a marca sem que nenhum JSX seja tocado. O que a config não alcança —
`dark:bg-[#0f172a]` (160x) e o `dark:bg-dark` morto (40x) — é trocado por um
codemod mecânico. `darkBlue` sobrevive como alias depreciado do navy do DS e
morre tela a tela na Fase 3.

A ponte usa **hexadecimal literal** da rampa do DS, não `var()`: existem classes
com modificador de opacidade (`dark:bg-blue-900/40`) e o Tailwind não aplica alfa
sobre um `var()` que guarda hexadecimal — a classe sairia sem cor. Os tokens novos
(`bg-action`, `bg-surface`, `text-conteudo`) usam `var()` normalmente. A ponte é
andaime temporário e não precisa reagir a troca de token; as classes de token,
sim. A alternativa (adiar cor para a Fase 3) deixaria o
sistema meses com metade das telas em cada azul.

**7 · Trabalho em branch por fase, com checkpoint humano.** O sistema está em
produção (Docker + Traefik). Nada vai para `main` sem revisão explícita.

## Arquitetura alvo

```
src/
  design-system/          fronteira fechada — nada aqui importa do app
    styles.css            cópia verbatim do DS
    tokens/               colors · typography · spacing · shape · motion · base
    ui/                   primitivos portados para .tsx + Tailwind
      core/ forms/ data/ feedback/ navigation/
    chartTheme.ts         tema único de recharts derivado dos tokens
    ORIGEM.md             projectId, data do sync, o que foi portado e por quê
  auth/
    permissoes.ts         matriz rota → papéis, fonte única
  pages/<tela>/           cada tela grande vira pasta com seus componentes
  services/               instância axios única, tipada
```

Regra que governa o resto, herdada do DS: **nenhum hexadecimal cravado no JSX.**

Uma exceção, registrada: `src/pages/Login.tsx` mantém `bg-[#0a192f]` (linha 33) e
`bg-[#0f172a]` (linha 41). São as duas únicas ocorrências do projeto **sem** o
prefixo `dark:` — fundo escuro deliberado nos dois temas, e o design system
registra login escuro como exceção documentada. Convertê-las para token deixaria
o login branco no tema claro. O teste de guarda declara a exceção pelo nome do
arquivo; a Fase 1 a resolve ao migrar o Login como tela piloto. Por isso o
codemod da Fase 0 faz **210** conversões, não 212.

---

## Fase 0 — Fundação

Nenhuma tela é reescrita. A cor da marca, a fonte e o tema escuro mudam em tudo.

1. `src/design-system/` criado com `styles.css` + `tokens/` copiados do projeto do
   Claude Design, mais `ORIGEM.md`.
2. `src/styles/index.css` importa `design-system/styles.css` **antes** das
   diretivas `@tailwind`.
3. `tailwind.config.js` substituído pelo bloco do `adocao.md`: `primary` vira a
   rampa `#1F89CA`, entram `action`, `surface`, `borda` e `conteudo` como
   `var(--...)`. Sai o `safelist` de gambiarra.
4. **Ponte de paleta**, no mesmo config (Decisão 6): `blue-*` remapeado para a
   rampa primária do DS — `blue-600` cai em `--color-primary-600` (`#1A71A8`), o
   `--action` — e `slate-*` para as superfícies navy. `darkBlue` permanece como
   alias depreciado apontando para o navy do DS, com comentário dizendo que morre
   na Fase 3. Cada classe de azul é conferida no diff: onde `blue-*` estiver
   carregando sentido de _info_ e não de ação, vai para `--color-info-*`.
5. **Codemod** trocando os 212 hexadecimais arbitrários pelas classes de token,
   preservando o prefixo do utilitário: `[#0f172a]` e `[#0a192f]` viram
   `surface-base`, `[#1e293b]` e `[#1e3a8a]` viram `surface`. Alcança também o
   `.input-cc` em `src/styles/index.css`. É busca-e-troca mecânica, revisada no
   diff e travada por teste de guarda.
6. Plus Jakarta Sans (Google Fonts, pesos 300–800) e a pilha mono do DS.
7. Tema escuro passa a navy `#0D1B2A` por token. As 1.626 classes `dark:`
   continuam funcionando nesta fase — morrem tela a tela na Fase 3.
8. Vitest + React Testing Library + script `npm test`, com um teste de fumaça
   provando o setup.
9. ESLint + Prettier, usando o `prettier-plugin-tailwindcss` que já está no
   `package.json` sem configuração.
10. Limpeza: remover `@tailwindcss/vite` e `@tailwindcss/postcss`; versionar
    `.env.example` com as duas variáveis hoje comentadas.

**Pronto quando:** `npm run build` passa, `npm test` passa, o app sobe e as 18
rotas renderizam. O sistema inteiro está no azul da marca e no navy do DS, nos
dois temas; nenhum layout se move e nenhuma tela foi reescrita.

---

## Fase 1 — Casca e primitivos

**Primitivos portados** para `src/design-system/ui/`:

| Grupo         | Componentes                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `core/`       | `Button`, `Card` (+`CardHeader`, `CardTitle`, `CardBody`), `Badge`, `Icon`, `Spinner`, `Avatar`                          |
| `forms/`      | `Input`, `Textarea`, `Select`, `SearchSelect`, `Checkbox`, `Radio`, `Switch`                                             |
| `data/`       | `Table` (+ `TableHead`, `TableBody`, `TableRow`, `TableHeaderCell`, `TableCell`, `TableEmpty`), `Pagination`, `Progress` |
| `feedback/`   | `Alert`, `Modal` (+`ModalFooter`), `Toast` (+`ToastStack`), `Tooltip`                                                    |
| `navigation/` | `Tabs` (+`TabsList`, `TabsTrigger`, `TabsContent`), `AppShell`                                                           |

Ficam de fora por YAGNI, com o motivo registrado: `Rating` e `SlaChip` (conceitos
de HelpHS/ChamadosHS, inexistentes aqui), `Rotulo` e `Colchetes` (pele de console,
exceção documentada do ChamadosHS), `FileUpload` (nenhuma tela envia arquivo),
`StatusBadge`, `PriorityBadge` e `TagBadge` (codificam o domínio de chamados do
HelpHS — `open`, `awaiting_technical`, `resolved` — e um cadastro de etiquetas;
nenhum dos dois existe no DataCoreHS).

**Duas peças que o DS não fornece e este sistema exige:**

- **`AppShell`** — Header + Sidebar refeitos. Os 19 `<img>` de `img.icons8.com`
  viram `lucide-react`, já presente e usado em 15 arquivos. Sidebar 256px (72px
  recolhida), topbar 64px, item ativo com fundo `--action-tint`, texto `--action`
  e barra de 2px à esquerda, conforme o DS.
- **`chartTheme.ts`** — 9 páginas usam `recharts` e cada uma escolhe a própria
  cor. Um módulo único serve eixos, grade, tooltip e rampa de séries a partir dos
  tokens. Sem ele, a Fase 3 recria a divergência de cor nove vezes.

**Colisões de cascata a resolver aqui.** A Fase 0 copiou `tokens/base.css`, que
traz regras de elemento além das custom properties. Três delas estão mortas hoje,
confirmado lendo o CSS gerado:

- `body { background: var(--bg-base) }` perde para o `body` e o `.dark body` que
  `src/styles/index.css` já definia, e para o `<body class="bg-gray-100">` do
  `index.html`. O navy do design system não chega ao `body` real.
- `::-webkit-scrollbar` do design system (6px, translúcido) perde para as regras
  de scrollbar que o `index.css` já tinha (8px, `#4b5563`).
- `a { color: var(--text-link) }` perde para o preflight do próprio Tailwind
  (`a { color: inherit }`), porque `@tailwind base` vem depois do `@import` dos
  tokens — e tem de vir, senão as custom properties não existiriam a tempo.

Nada disso é visível hoje: os links do app são pintados por classe Tailwind, e o
fundo que aparece é o do `<div>` de altura total do `App.tsx`. Mas as três são
decisão do `AppShell`, não acidente para descobrir depois. O que **já** entrou em
vigor de `base.css`, sem nenhuma tela ser tocada: a família e o tamanho de fonte
do `body`, e a cor e a margem de `h1`–`h4`.

**Os papéis dos tokens estão invertidos, e o `AppShell` tem de desfazer isso.**
O codemod da Fase 0 mapeou por valor de cor, não por papel. O resultado, medido:

| Papel na tela                           | Classe que o app usa hoje | Valor     | Token cujo papel ele ocupa |
| --------------------------------------- | ------------------------- | --------- | -------------------------- |
| Fundo de página (40 ocorrências)        | `dark:bg-darkBlue`        | `#132238` | é o valor de `--surface`   |
| Card, header, sidebar (165 ocorrências) | `dark:bg-surface-base`    | `#0d1b2a` | é o `--bg-base`            |

O design system diz o contrário: `--bg-base` é _fundo da página_, `--surface` é
_card, painel, topbar_. Duas consequências.

A primeira já está na tela: card `#0d1b2a` sobre página `#132238` dá **1,09** de
contraste, contra 1,72 de antes da fase. O card quase deixou de se destacar, e a
elevação lê ao contrário — superfície mais escura que o fundo, debaixo de um
`shadow-sm`. Não é ilegibilidade: o texto está bem. É hierarquia perdida. O
conserto certo é o do design system, separar superfície por **borda de 1px**
(`--border-color`) e não por luminância — que é justamente o trabalho dos
primitivos, por isso não se corrige na Fase 0.

A segunda é uma armadilha. Se o `AppShell` arrumar o `body` do jeito óbvio —
`background: var(--bg-base)` — a página passa a `#0d1b2a`, **idêntica aos 165
elementos que a Fase 0 escreveu como `dark:bg-surface-base`**. Contraste 1,00:
todo card do sistema desaparece de uma vez, num único commit.

Portanto, **no mesmo movimento** em que o `AppShell` assumir o `body`, os 165
`dark:bg-surface-base` de card, header e sidebar têm de virar `bg-surface`, e os
40 `dark:bg-darkBlue` de fundo de página têm de virar `bg-surface-base`. Um sem o
outro quebra a tela.

**Telas piloto:** Login, Home, Configurações, NotFound, Bloqueio, EmConstrução.

**Pronto quando:** cada primitivo tem teste cobrindo variantes, `disabled`,
`loading` e o anel de `focus-visible`; as telas piloto passam o checklist do
`adocao.md`.

---

## Fase 2 — Estrutura transversal

Mexe em `router.tsx`, `main.tsx` e `services/`. Quase não toca em tela.

1. **`src/auth/permissoes.ts`** — matriz rota → papéis, fonte única. Substitui os
   6 guardas (`RequireAdmin`, `RequireVendas`, `RequireServicos`,
   `RequireVendedores`, `RequireContasPagar`, `RequireFinanceiro`) por um guarda
   parametrizado, e a Sidebar passa a derivar o menu da mesma matriz. Hoje é
   possível o menu exibir item que a rota bloqueia.
2. **Providers por rota** — os 12 contexts saem da pirâmide do `main.tsx` e montam
   no ramo de rota que os usa. Hoje quem abre o Login monta `EstoqueProvider`,
   `VendasProvider` e mais dez.
3. **`lazy` + `Suspense`** nas 18 rotas, para code splitting real.
4. **`services/` tipado**, numa instância `axios` única com o interceptor de
   token; corrige `updateUserPassword`.

**Pronto quando:** existe teste cobrindo cada papel contra cada rota — é a lógica
de negócio mais perigosa de todo o refactor — e o `build` mostra chunks separados.

---

## Fase 3 — As 12 telas grandes

Receita fixa, por tela:

1. Teste de caracterização fixando o comportamento atual.
2. Quebrar em componentes numa pasta própria (`pages/vendas/`: filtros, tabela,
   modais, export).
3. Trocar Tailwind cru pelos primitivos.
4. Zerar `dark:` e hexadecimal na tela.
5. Passar o checklist de 10 itens do `adocao.md`.

Uma tela = uma branch = um checkpoint humano.

| #    | Tela                                       | Linhas          | Por que nesta posição                                                          |
| ---- | ------------------------------------------ | --------------- | ------------------------------------------------------------------------------ |
| 1    | Dashboard                                  | 328             | Vitrine, e o UI kit `templates/datacorehs/` já a desenhou — referência literal |
| 2    | Locação                                    | 386             | Pequena; exercita tabela + export                                              |
| 3    | Usuários                                   | 457             | Firma o padrão de modal                                                        |
| 4–5  | ContasReceber · ContasPagar                | 802 · 839       | Gêmeas; migrar em par                                                          |
| 6    | Financeiro + CentroCustoTab + MetaTab      | 768 + 723 + 442 | Única tela com abas; firma o `Tabs`                                            |
| 7–10 | Produtos · Serviços · Vendedores · Estoque | 1221–1362       | Mesma anatomia: filtro + tabela + gráfico + export                             |
| 11   | Clientes                                   | 1387            | Idem, com dado enriquecido no context                                          |
| 12   | Vendas                                     | 1554            | Maior e mais crítica; vai por último, com o padrão provado 11 vezes            |

**Checklist de tela migrada** (do `adocao.md`):

- [ ] Nenhum hexadecimal cravado no JSX.
- [ ] Nenhum `dark:` por classe onde existe token semântico equivalente.
- [ ] Azul de ação é `--action` (`#1A71A8`), não o azul da marca.
- [ ] Botão primário: um por bloco de decisão.
- [ ] Texto abaixo de 12px: nenhum.
- [ ] Estado vazio com frase completa e ação, quando existe uma.
- [ ] Ícone é componente, não emoji nem caractere.
- [ ] Contagem de paginação em frase ("Mostrando 1 a 10 de 84 notas").
- [ ] `focus-visible` com anel de 2px, não `focus`.
- [ ] Nada animando em laço fora spinner.

---

## Achados do checkpoint da Fase 0

O passeio pelas 18 rotas nos dois temas foi feito em 2026-08-25 e **não encontrou
nenhuma quebra**: nada ilegível, nada sumido, nada branco sobre branco. O tema
claro, que a medição automática não conseguira cobrir, foi conferido e está
correto.

**O risco de "azul que significava aviso virou azul de marca" não se
materializou.** A tabela de riscos deste spec previa que a ponte de paleta
pudesse repintar de cor de ação algo que carregava sentido de _info_. Nenhum caso
foi encontrado. O risco está fechado; a linha correspondente da tabela de riscos
não precisa mais de mitigação.

O que a medição de contraste levantou vira trabalho de tela na Fase 3. São todos
**pré-existentes** — nenhum foi criado por esta fase:

| Achado                                                    | Medido | Onde                                    | Conserto na Fase 3                                                                |
| --------------------------------------------------------- | ------ | --------------------------------------- | --------------------------------------------------------------------------------- |
| `text-blue-600` sobre fundo escuro                        | 3,29:1 | Valores em KPI, várias telas            | Trocar por `text-action`, que no escuro inverte para `#47a6e1` e sobe para 6,64:1 |
| `text-red-600` sobre fundo escuro                         | 3,60:1 | Percentuais negativos e valores zerados | Usar `--color-danger-400` no escuro, como o design system determina               |
| Botão "Exportar Excel", texto branco sobre `bg-green-600` | 3,30:1 | Barra de ações das listagens            | Pareamento correto de cor semântica e texto                                       |

Para referência da Fase 3: `text-blue-600` no escuro já reprovava **antes** desta
fase, com 3,45:1. A ponte o levou a 3,38:1 — e, no tema claro, o melhorou de
5,17:1 para 5,29:1. A ponte não criou nenhum destes três.

## Defeitos encontrados no próprio Design System

O port dos primitivos revelou defeitos nos arquivos do design system publicado no
Claude Design. Eles foram contornados aqui, mas o conserto pertence à origem —
senão o próximo sistema da H&S a adotar a biblioteca tropeça no mesmo.

**`components/core/Icon.jsx` — rótulo e `aria-hidden` convivem.** O componente
crava `aria-hidden="true"` **antes** de espalhar `{...rest}`. Quem passa
`aria-label` fica com os dois atributos ao mesmo tempo: o ícone é rotulado e
escondido de uma vez, e o leitor de tela ignora o rótulo. É exatamente o caso que
a regra de iconografia do design system quer cobrir — _"ícone que é o único
conteúdo de um botão leva `aria-label`"_. No port do DataCoreHS o `aria-hidden`
passou a ser derivado: só é emitido quando não há `aria-label` nem
`aria-labelledby`.

**`components/core/Card.d.ts` — `CardHeaderProps` não compila.** A interface
estende `React.HTMLAttributes<HTMLDivElement>` e redeclara `title?: React.ReactNode`.
Mas `HTMLAttributes` já declara `title?: string`, o atributo nativo de tooltip do
HTML, e os dois tipos colidem: TypeScript recusa com TS2430. No port ficou
`Omit<React.HTMLAttributes<HTMLDivElement>, "title">`. Vale checar se outros
`.d.ts` da biblioteca repetem o padrão de redeclarar um atributo nativo.

**`components/forms/Select.jsx` — a seta traz cor cravada.** O chevron é uma
imagem de fundo em `data:image/svg+xml` com o cinza escrito em hexadecimal
(`%2394a3b8`). Cor enterrada em string não sai de token, não acompanha troca de
tema e nenhum teste de guarda a alcança. No port do DataCoreHS a seta virou o
componente `Icon`, que herda `currentColor`.

**`components/feedback/Alert.jsx` e `Toast.jsx` — nomes divergentes para a mesma
variante.** O `Alert` chama a variante de erro de `danger`; o `Toast` chama de
`error`. São componentes vizinhos, que aparecem na mesma tela. Cada port seguiu o
seu `.d.ts`, porque inventar consistência aqui criaria divergência com a origem —
mas a origem devia escolher um dos dois.

**Os `.d.ts` redeclaram nomes de atributo nativo do HTML, e isso quebra.** Não são
casos isolados: é padrão. Uma auditoria dos 21 arquivos encontrou sete que
redeclaram um nome que o HTML já usa sobre `extends *HTMLAttributes`. Dois não
compilam — `CardHeaderProps` (`title?: ReactNode` sobre `title?: string`) e
`TabsProps` (`onChange` próprio sobre `FormEventHandler`), ambos TS2430. Um
terceiro, `AlertProps`, passa **por coincidência**: declara `title?: string`, que
casa com o tipo nativo — se alguém trocar para `ReactNode` amanhã, quebra igual.

Isso é invisível no Claude Design porque lá os componentes são `.jsx` sem tipos:
os `.d.ts` nunca são compilados. Eles documentam uma API que só é testada quando
alguém porta para TypeScript.

**`components/forms/Input.jsx` e irmãos — `id` derivado do rótulo por slug.** O
original monta o `id` com `label.toLowerCase().replace(/\s+/g, "-")`. Dois campos
de mesmo rótulo na mesma tela colidem, e acento produz `id` inválido. No port o
`id` sai de `React.useId()`, com a prop `id` explícita tendo precedência.

## Achados da Fase 1 — o que a Fase 3 precisa saber

A Fase 1 portou os 21 primitivos e migrou seis telas piloto. O que ela aprendeu,
e que vale para as doze telas grandes:

**Portar não é traduzir estilo.** Todo componente interativo do design system
precisou de acréscimo de acessibilidade que o original não tinha: `focus-visible`
em tudo, teclado inteiro no `SearchSelect`, ordenação alcançável por teclado na
`Table`, prisão e devolução de foco no `Modal`, `aria-describedby` no `Tooltip`,
`role="tabpanel"` e navegação por seta no `Tabs`, nome acessível no `Progress`.
Cada um desses, se não tivesse sido feito aqui, iria multiplicado para as doze
telas.

**O teste de caracterização acha defeito que já estava lá.** Na Task 14, cinco de
nove asserções falharam contra o código **original**: os campos do `Login` não
tinham `<label>` e o interruptor do `Configuracoes` não tinha nome acessível. Não
era a migração quebrando — era defeito antigo que só aparece quando alguém
escreve um teste que pergunta pelo rótulo. Espere o mesmo nas telas grandes.

**Cuidado com token que reage ao tema em superfície que não reage.** O `Login` é
painel escuro nos dois temas. Usar `Input`, `Card` ou `Alert` ali produziria
texto de baixo contraste, porque `--on-tint-danger` é vermelho escuro no tema
claro. A regra: antes de trocar por primitivo, verifique se a superfície em volta
acompanha o tema.

**O critério de lint é "não subir", não "cair".** A Fase 1 fechou em 190, contra
a linha de base de 192. Mas quatro das seis telas piloto não reduziram nada,
porque já tinham zero achado — o ESLint não audita uso de cor nem de token. Quem
faz isso são os cinco testes de guarda.

**Texto de erro tem de casar com a condição que o produziu.** O `Bloqueio.tsx` é
devolvido por cinco guardas de rota, e nenhum é exclusivo de administrador —
aplicar ali a frase "restrita a administradores" faria a tela mentir. A condição
mora no `router.tsx`; leia antes de escrever a mensagem.

### Decisão pendente

O `Bloqueio.tsx` hoje mostra um texto genérico, correto para os cinco casos que o
produzem. A alternativa é ele receber a mensagem por prop, e cada guarda de rota
passar a sua. É decisão de produto, não defeito — e cabe naturalmente na Fase 2,
que unifica os guardas numa matriz de permissão.

## Defeitos encontrados no próprio Design System

Nenhuma trava o início. Cada uma é trazida de volta quando sua fase chegar.

1. **Papel do `RequireFinanceiro`** (Fase 2). Hoje libera por
   `[1, 3, 4].includes(user.id)`. Para virar papel, é preciso decidir qual — e a
   decisão muda quem enxerga Locação e Financeiro. Depende do Erick.
2. **`updateUserPassword` sem token** (Fase 2). O endpoint está aberto no backend,
   ou a função está quebrada? Verificar antes de "corrigir".
3. **Os 4 `alert()`** (Fase 3). Viram `Toast`; verificar caso a caso se algum é
   confirmação de ação destrutiva, que pede `Modal`.
4. **URLs de produção** (Fase 0). O `.env.example` versiona só os nomes das
   variáveis. A pergunta é outra: qual URL está de fato em uso em produção hoje,
   já que as duas linhas estão comentadas e tudo cai no fallback cravado em
   `services/api.ts`. Confirmar antes de mexer no `.env`.

## Riscos

| Risco                                                                    | Mitigação                                                                                      |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Regressão silenciosa em cálculo fiscal ao refatorar tela de 1.500 linhas | Teste de caracterização antes de cada tela (Decisão 2)                                         |
| Mudança de permissão liberar acesso indevido                             | Teste papel × rota na Fase 2, antes de qualquer tela grande                                    |
| Tokens divergirem de novo entre os 8 sistemas                            | `ORIGEM.md` com projectId e data; Decisão 3 revisitada quando o segundo sistema entrar na fila |
| Ponte de paleta pintar de azul-marca algo que significava _info_         | Conferência classe a classe no diff da Fase 0; `blue-*` semântico vai para `--color-info-*`    |
| Quebrar produção durante a migração                                      | Branch por fase e por tela; nada em `main` sem revisão                                         |

## Referências

- Design System: projeto `Health & Safety Design System` no Claude Design
  (`ef9f35f6-3af0-4651-9dee-45d08884432a`)
- `guidelines/adocao.md` — guia de adoção, `tailwind.config.js` e checklist
- `readme.md` do DS — fundamentos de conteúdo e visuais, decisões de marca
- `templates/datacorehs/` — UI kit que já recriou Dashboard e listagem de notas

---

## Achados da Fase 2

A fase entregou o que estava previsto — matriz de permissões, providers por rota,
code splitting, `services/` tipado. O que não estava previsto foi o que ela
encontrou pelo caminho.

### O menu mentia para dois papéis

O grupo "Comercial" da Sidebar aparecia para **qualquer** usuário: `mostrar: true`
fixo, sem consultar papel nenhum. Na prática, quem tinha papel `servicos` via
"Vendas", "Clientes", "Produtos" e "Vendedores" no menu e batia em "Acesso negado"
ao clicar; quem tinha papel `vendas` via "Serviços". Antes da sessão carregar, o
menu exibia 8 itens e depois se corrigia.

**Não era vazamento de acesso** — as rotas sempre bloquearam. Era menu levando a
beco sem saída. Sobreviveu tanto tempo porque `admin` e `financeiro` abrem o
Comercial inteiro, e são justamente as contas que mais se usa para testar.

Achado pelo teste de invariante da Task 4, que falhou em 12 dos 40 casos antes de
qualquer refatoração. Esse teste deriva as personas da própria matriz e lê o menu
renderizado sem enumerar item nenhum — papel novo na matriz ou item novo na
Sidebar entram na varredura sozinhos.

### `updateUserPassword` saía sem autenticação

`services/api.ts` usava `axios` cru em vez da instância com interceptor. Todas as
outras funções do arquivo usavam a instância corretamente; só essa escapou. A
requisição de troca de senha ia **sem cabeçalho `Authorization`**.

**Fica em aberto, e não se resolve no front:** ou a API estava recusando a troca
(funcionalidade quebrada em silêncio), ou estava aceitando troca de senha sem
autenticação (endpoint aberto). Precisa ser checado contra a API.

### O spec estava errado sobre o `services/`

O texto da Fase 2 pedia "uma instância `axios` única". Segui-lo quebraria o
sistema: são dois backends distintos, `VITE_API_URL` (`authapi`) e
`VITE_NOTAS_URL` (`tinyapi`). O que se compartilha é o **interceptor**, e a forma
certa é uma fábrica. Há teste travando isso — quem "unificar" no futuro quebra a
suíte.

### Correções de rota do próprio refactor

Duas decisões de implementação foram revertidas por mim depois de entregues, e
valem como registro de critério:

**O `import Bloqueio` que eu mandei mover.** Instruí subir o import da linha 41
para o topo do `router.tsx`. Depois da troca dos guardas, o arquivo não
referenciava mais `Bloqueio` — a instrução tinha ficado obsoleta no meio da
própria task. O executor apagou em vez de mover, e estava certo.

**O carregamento caseiro.** A Task 5 criou `src/paginas-lazy.tsx` em vez de usar
`React.lazy`, porque o teste de caracterização lê o DOM sem `await`. Era código de
produção moldado pela sincronicidade de um teste. A causa foi uma regra minha
escrita larga demais — "não edite `acesso-atual.test.tsx`" —, que existe para
impedir o **enfraquecimento** da rede de segurança, não para proibir um `await`.
Trocado pelo `React.lazy` depois, com prova de que nenhuma asserção mudou.

### Um buraco na cobertura dos guardas

O refactor removeu Tailwind cru com cor cravada (`text-gray-500`, `text-red-600`)
dos seis guardas, e **nenhuma ferramenta registrou**: o `router.tsx` não aparecia
no relatório do ESLint, e o `guarda-cores` da Fase 1 só acusa hexadecimal
arbitrário e opacidade sobre token. Classe de paleta crua do Tailwind passa pelos
dois. Vale estender o guarda antes da Fase 3, que vai mexer em 12 telas cheias
disso.

### Números

|                   | Antes da Fase 2              | Depois                        |
| ----------------- | ---------------------------- | ----------------------------- |
| Suíte             | 184 testes / 47 arquivos     | **489 / 55**                  |
| Lint              | 190 problemas                | **176**                       |
| `router.tsx`      | 255 linhas, 6 guardas dentro | **190 linhas, zero**          |
| Providers globais | 10                           | **2**                         |
| Build             | 1 chunk, 1.697 kB            | **41 chunks, entrada 305 kB** |

---

## Estado em 31/08/2026 — fim do domingo

**Fases 0, 1 e 2 fundidas na `main` local. Fase 3 com 5 das 12 telas.**
112 commits à frente do `origin/main`. **Nada empurrado.**

Suíte **1073 testes / 68 arquivos** (verdes também com `TZ=UTC` e
`TZ=America/Sao_Paulo`), lint **143** (baseline original 192), `tsc` limpo,
build em 6,4 s.

### Telas da Fase 3

| #    | Tela                                       | Estado                                          |
| ---- | ------------------------------------------ | ----------------------------------------------- |
| 1    | Dashboard (Meta do trimestre)              | **feita** — 330 → 110 linhas                    |
| 2    | Locação                                    | **feita** — 386 → 108 linhas                    |
| 3    | Usuários                                   | **feita** — 457 → 167; firmou o padrão de modal |
| 4–5  | ContasReceber · ContasPagar                | **feitas** — 802 → 73 e 839 → 65; unificadas    |
| 6    | Financeiro + CentroCustoTab + MetaTab      | próxima; única com abas                         |
| 7–10 | Produtos · Serviços · Vendedores · Estoque | mesma anatomia                                  |
| 11   | Clientes                                   | idem, com dado enriquecido                      |
| 12   | Vendas                                     | maior e mais crítica, por último                |

### A receita, provada em cinco telas

1. **Teste de caracterização antes de mover uma linha**, observando a tela
   renderizada — nunca exportando função só para testar.
2. **Provar que o teste enxerga**: plantar a quebra, ver falhar, reverter. Sem
   essa prova a task não está entregue.
3. Quebrar em componentes por responsabilidade, com a conta pura em arquivo
   próprio.
4. Zerar `dark:` e paleta crua; tirar a tela de `PENDENTES_FASE_3`.
5. Checklist de 10 itens respondido **um a um**, nunca em bloco.
6. Verificar no navegador nos dois temas, incluindo vazio, carregando e erro.
7. **Novo, a partir das gêmeas:** tirar a tela do `.prettierignore` e formatar,
   no seu próprio commit. Ver "Dívida do prettier" abaixo.

### O que as gêmeas acrescentaram à receita: separar unificar de corrigir

ContasReceber e ContasPagar tinham **83% das linhas idênticas** (277 divergentes
em 1641). Foram em duas fases, e a separação é o que deu a garantia:

- **Fase 1 — unificar sem mudar comportamento.** Critério de sucesso: os **231
  testes de caracterização passam sem UMA edição**. Passaram. É a prova de que a
  unificação não mexeu em nada — controle que as três telas anteriores não
  tiveram, porque nelas teste e refatoração vinham no mesmo fôlego.
- **Fase 1b — as 5 divergências acidentais**, cada uma com asserção mudada de
  propósito e autorizada uma a uma.
- **Fase 2 — os 18 defeitos**, cada um com plantação provando o comportamento
  novo.

Corrigir junto com unificar teria tornado impossível saber qual dos dois quebrou.

### O que ficou compartilhado

Cada tela virou uma casca de ~70 linhas sobre `src/pages/contas/`. As **duas
divergências de domínio viraram um `DialetoDeContas`** de três campos, em vez de
um `if` repetido em seis lugares:

|                     | Contas a Receber       | Contas a Pagar   |
| ------------------- | ---------------------- | ---------------- |
| `situacoesQuitadas` | `["recebido", "pago"]` | `["pago"]`       |
| `campoDaEmissao`    | `"data"`               | `"data_emissao"` |
| `chaveQuitado`      | `"recebido"`           | `"pago"`         |

`campoDaEmissao` guarda o **nome** do campo, não um acessador: a tabela precisa
do nome para ordenar, e antes o nome vivia na lista de colunas e o acessador no
dialeto — dava para filtrar por um campo e ordenar por outro sem ninguém ver.

Nasceram também `src/lib/datas.ts` (data de calendário, já usado por Locação e
Usuários), `src/lib/dinheiro.ts` e dois primitivos.

### Primitivos que as sete telas restantes herdam

- **`Modal` com prop `erro`** e a regra "monte o diálogo só quando aberto"
  (da tela 3).
- **`Pagination` retorna `null` com zero resultados** — paginar o nada não
  significa nada, e a tabela já diz que está vazia. **Pressupõe `TableEmpty` no
  consumidor**, e está no docblock: as seis listagens antigas têm paginação
  própria e precisam ganhar o estado vazio ao migrar.
- **`ChartEmpty`**, irmão do `TableEmpty`, com `height` obrigatório — um padrão
  acertaria num gráfico e erraria nos outros, e o cartão pularia de tamanho.
  **Não distingue lista vazia de falha de carregamento**, de propósito: o
  componente vê uma série vazia e não sabe a causa; quem sabe é a página, que já
  tem o `Alert` dizendo.
- **Padrão de erro de rede, decidido nas gêmeas e válido para as restantes:**
  `Alert variant="danger"` no fluxo da página, texto vindo do contexto — **não
  Toast**. Falha de carga é estado permanente até recarregar, e toast some em 4 s
  deixando a pessoa diante de uma tela vazia sem explicação. Toast fica para
  confirmação de ação que a pessoa acabou de tomar.

### Defeitos encontrados nas cinco telas

Nenhum era conhecido antes. Todos apareceram porque o teste veio primeiro. Os
das gêmeas estão detalhados em `docs/superpowers/2026-08-31-contas-achados.md`
(14 compartilhados, 4 de tela única, 5 divergências acidentais).

**Dashboard e Locação:**

- **Projeção da meta superestimava 12%** — extrapolação linear por dia ignorando
  que setembro vale 55% de julho. Diferença entre projetar 74% e 66% da meta,
  num painel que decide bonificação.
- **Datas da planilha de locação saíam um dia antes.** Toda planilha já emitida
  está errada.
- **Comparador de ordenação nunca devolvia 0**; **nota cancelada em selo verde**;
  **`setInterval` do confete nunca limpo**; **lista vazia com `<ul>` mudo**.

**Usuários:**

- **O `<select>` de perfil mostrava um papel e o POST gravava outro.**
- **`handleTrocarSenha` sem `try/catch`** — a promessa rejeitada derrubava a
  suíte inteira; era por isso que o caminho de falha não tinha teste.
- **`ModalTrocarSenha` não desmontava**: a senha de um usuário reaparecia no
  formulário de outro.
- **A troca de senha não tinha mínimo de caracteres** — dava para gravar senha
  vazia num usuário existente.

**Gêmeas — os quatro que mais importam:**

- **`"1.234"` virava R$ 1,23** no `converterParaNumero` de Contas a Receber —
  ponto de milhar lido como decimal. Agora em `src/lib/dinheiro.ts`.
- **Os presets misturavam mês local com dia em UTC.** Às 23h de 31/08, "Mês
  atual" virava 01/08 a 01/09; na virada do ano, "Ano atual" virava o ano
  anterior inteiro.
- **O nome do arquivo exportado saía em UTC** — quem exporta à noite arquiva com
  a data do dia seguinte.
- **"Vencida" apagava a situação real**, na tela e na planilha.

### Os KPIs de dinheiro: o que mudou e o que a conferência mostrou

`Total em Aberto` somava **saldo** e `Total Recebido/Pago` somava **valor
cheio** só das quitadas, então o que entrou numa conta parcial não aparecia em
lugar nenhum. Agora:

- `Total em Aberto` = saldo das não quitadas
- `Total Recebido/Pago` = `valor − saldo` de **todas**
- `aberto + quitado = faturado`, e a **Média Mensal Faturada** passou a ser uma
  grandeza real (o rótulo mudou junto)
- os três gráficos usam a mesma base, então o topo da tela fecha com o gráfico

**Conferido contra o banco de produção em 31/08/2026 (leitura):** nenhuma conta
quitada tem saldo sobrando (928 em contas_receber, 8.337 em contas_pagar, todas
zero), e **não existe pagamento parcial** (0 de 467 abertas e 0 de 226). Ou seja:
a correção está certa e blinda o caso, mas **hoje não muda nenhum número que
alguém esteja vendo errado**. A base também só tem `pago` e `aberto` — a palavra
`recebido` **nunca aparece**, então a divergência de domínio nº 1 é inerte na
prática.

**A suposição sobre `contas_receber.data` saiu do limbo:** 1.392 de 1.395 linhas
têm `data <= vencimento`, o que é comportamento de data de emissão. **Ficam 3
linhas com `data > vencimento`** — vale um olhar: ou é lançamento retroativo
normal, ou é sujeira.

### Conferência no navegador (31/08)

Feita com mock local servindo **dados reais** puxados do banco — a produção não
foi tocada. Sem `VITE_API_URL`/`VITE_NOTAS_URL` o app aponta para
`authapi`/`tinyapi` de produção, e dirigir modal de exclusão contra dado real não
é opção.

Os **dez KPIs das duas telas foram recalculados por fora, dos dados crus, e
batem à vírgula**. A coerência nova se confirma na tela: em Contas a Receber,
299.245,45 + 45.425,00 = 344.670,45, dividido por 4 meses de emissão = 86.167,61,
exatamente o que a tela mostra.

### Dívida do prettier

`.prettierignore` ignora `src/pages`, `src/components`, `src/context`,
`src/services` e `src/hooks` desde a Fase 0, para não destruir o `git blame` das
telas não migradas — e o próprio comentário do arquivo diz que **cada entrada sai
quando a tela correspondente migrar**. As cinco telas já migradas passaram batido,
e hoje estreitar `src/pages` reformataria **48 arquivos** de uma vez, incluindo os
de caracterização.

O prettier **não** está quebrado: tudo que nunca foi ignorado passa no `--check`,
e o `printWidth: 80` é real. A trava mecânica (`src/test/prettierignore.test.ts`)
protege só `src/design-system`, que é cópia sincronizada e não deve mesmo ser
formatada.

**A partir da tela 6, tirar do `.prettierignore` e formatar entra na receita**, em
commit próprio, para a dívida parar de crescer. As 48 já acumuladas são item à
parte.

### Fase 4 — os blocos que as seis telas repetem

Decidida em 01/09/2026, antes de retomar a Fase 3: as seis telas restantes
repetem 737 linhas de `MultiSelect`, mais paginação, exportação, preset de
período e `useIsMobile`. Extrair vira fase própria em vez de acontecer durante
cada migração, para a decisão de API ser tomada uma vez olhando os seis usos.
Ver `2026-09-01-fase-4-blocos-comuns-design.md`.

### Item 2 da Fase 4 — `Pagination` fechado (03/09/2026)

As seis telas que ainda rolavam a própria paginação — Clientes, Estoque,
Produtos, Serviços, Vendas e Vendedores — passaram a consumir o `Pagination`
do design system e o hook novo `src/hooks/usePaginacao.ts`, com `TableEmpty`
no `<tbody>`. O primitivo ganhou a forma compacta de celular que antes só
existia dentro das seis cópias, e Contas — a única consumidora até aqui —
herdou o rodapé compacto sem ter pedido.

Os três defeitos que a medição achou nas seis cópias morreram na adoção: a
frase de contagem, presa em `{totalPaginas > 1 && ...}`, sumia para quem tinha
uma página só; não havia estado vazio, e filtro sem resultado deixava a tabela
muda; e a página não voltava para a 1 ao filtrar — na página 7 de 84 produtos
filtrando para 20, o rodapé escrevia "Mostrando 61 a 20 de 20 registros", com
o intervalo invertido, e o botão Próxima seguia habilitado porque comparava
`7 === 2`.

As seis tiveram **229 inserções e 699 remoções** (líquido −470) contra a
previsão de ~687. A branch inteira, medida da base real
(`git merge-base main HEAD`), soma **19 arquivos, 1575 inserções, 714
remoções** em **31 commits**; só `src/` são **16 arquivos, 1438 inserções, 703
remoções** — a diferença são os documentos. Suíte em **1426 testes / 92
arquivos** (entrada: 1373/85), lint em **119** — idêntico ao baseline, não
subiu —, `tsc --noEmit` limpo.

Duas divergências foram preservadas de propósito (tamanho de página e
substantivo da contagem), e a forma compacta que Contas herdou de graça é item
novo para a conferência no navegador, que segue pendente desde o item 1 — ver
`2026-09-01-multiselect-divergencias.md`.

### Item 3 da Fase 4 — a exportação para Excel fechada (04/09/2026)

`json_to_sheet` + `book_new` + `book_append_sheet` + `writeFile` estavam
copiados em nove arquivos e hoje existem em um: `src/lib/planilha.ts`, com
`baixarPlanilha(abas, arquivo)`. As nove telas que exportam consomem. `diaLocal`
subiu para `src/lib/datas.ts`, ao lado de `dataDeCalendario`, e as duas cópias
que existiam — em `contas/contas.ts` e em `financeiro/AbaComissao.tsx` — sumiram.

A prova de que a extração não mudou comportamento: os quatro arquivos de teste
que já mockavam o `xlsx` passaram **sem uma edição**, 303 asserções. Foi por isso
que as três telas com teste vieram antes das seis sem.

**A cópia carregava um defeito, e foi ele que deu sentido ao item.** O nome do
arquivo saía de `toISOString()`, que devolve o dia em UTC: quem exportava depois
das 21h de Brasília arquivava com a data do dia seguinte. **Onze ocorrências, em
oito arquivos**, todas corrigidas — sete `.xlsx` e quatro `.pdf`, sendo que o
plano só previa os `.xlsx` e uma das ocorrências estava fora de `src/pages/`
(`components/SolicitacaoComprasModal.tsx`).

Locação é o caso a lembrar: era tela **migrada, com teste de caracterização**, e
o defeito atravessou a migração inteira porque os dois testes que tocavam o nome
do arquivo pregavam o defeito — um replicando o `toISOString()` da tela, outro
escolhendo `12:00Z` como instante. **Um teste de data que escolhe o meio-dia não
testa fuso.** O instante tem de ser construído em hora local, perto da virada.

`src/test/guarda-planilha.test.ts` trava os dois defeitos com quatro testes, os
quatro provados por plantio. O preset de período continua em UTC nas cinco telas
— é o item seguinte — e está isento por `PENDENTES_UTC`, lista que só encolhe.

A branch, medida da base real (`git merge-base main HEAD`) e **antes deste
documento entrar** (no commit `08c6b6a3`, o último de código), soma **21
arquivos, 718 inserções, 132 remoções** em **25 commits**; só `src/` são **19
arquivos, 487 inserções, 131 remoções** — a diferença são os documentos. Suíte em **1437 testes / 94 arquivos** (entrada:
1426/92), lint em **118** — caiu um contra o baseline de 119, não subiu —,
`tsc --noEmit` limpo, verde em `TZ=UTC` e `TZ=America/Sao_Paulo`.

O que sobrou pedindo decisão está em `2026-09-01-multiselect-divergencias.md`,
item 11.

### Item 4 da Fase 4 — o preset de período fechado (04/09/2026)

`periodoDoPreset`, `periodoDoMes`, `Periodo` e `PRESETS_DE_PERIODO` estavam
copiados em cinco telas (Produtos, Vendas, Vendedores, Serviços e Clientes) e
em `pages/contas/contas.ts`; hoje existem uma vez só, em `src/lib/periodo.ts`,
que as seis consomem. `diaLocal`, posto em `src/lib/datas.ts` pelo item 3
acima, é quem monta as duas pontas do período — antes elas saíam de
`hoje.toISOString()`, em UTC.

**A cópia carregava o mesmo defeito que o item 3 já tinha nomeado (1.3): o
rótulo mentia para quem lia o código.** Nas cinco telas, o rótulo "Mês atual"
ficava preso à chave `"30dias"`, que não calculava trinta dias — calculava do
dia 1 do mês até HOJE, nunca até o fim do mês; "Ano atual" ia de 1º de janeiro
até HOJE, nunca até 31/12. Depois da troca: "Mês atual" ganhou chave própria
(`mesAtual`) e cobre o mês inteiro; "Ano atual" vai até 31/12; e `"30dias"`
passou a ser, de fato, uma janela rolante de 30 dias — a única opção
genuinamente nova para quem usa as cinco telas. Contas ganhou "Últimos 7 dias",
que as cinco já tinham e ela não; foi a única mudança do lado de Contas.

**Uma investigação de defeito não confirmou nada, e o registro é o achado.**
Uma suspeita de que o filtro manual de data das cinco telas (distinto do
preset) comparasse hora local contra meia-noite UTC não se sustentou: as duas
telas que alimentam essa comparação (`DataContext.tsx`, `ServicosContext.tsx`)
já normalizam a data para `AAAA-MM-DD` antes de chegar à tela, então os dois
lados da comparação concordam. A lição documentada:
**verificar o mecanismo não é verificar o defeito** — só depois de seguir o
dado real da API até a comparação é que dá para saber.

A branch, medida da base real (`git merge-base main HEAD`) e **antes de
qualquer commit desta última task (a de código e a de documentação) entrar**
— o cuidado que faltou no item 3 e teve de ser emendado —, soma **10 commits,
18 arquivos, 1292 inserções, 343 remoções**. O lint, ao longo do item inteiro,
caiu de **118** (medido na `main`) para **104** antes desta task — 116, 114,
111, 108, 105, 104, uma queda a cada tela — e foi para **103** com esta task,
que apagou uma função de teste órfã (`corpoDaTabela`,
`Produtos.periodo.test.tsx`). Treze dos catorze problemas a menos vieram das
cinco telas, não por supressão: são os `case` com `let`
(`no-case-declarations`) e as atribuições inúteis que saíam junto de cada
`switch` removido, verificados um a um lintando o arquivo antigo isolado.
Suíte em **1474 testes / 100 arquivos**, `tsc --noEmit` limpo, verde em
`TZ=UTC` e `TZ=America/Sao_Paulo`.

O que sobrou pedindo decisão está em `2026-09-01-multiselect-divergencias.md`,
item 12 — os rótulos que divergem entre as cinco telas em dois eixos, a falta
de `htmlFor` nos cinco filtros, "Últimos 7 dias" em Contas sem teste de
caracterização próprio, e os três achados colaterais da investigação que não
deu em nada.

### Em aberto

1. **A pergunta da API, adiada pelo Erick e a mais séria:** o `PUT /users/{id}`
   aceita troca de senha sem `Authorization`? O cliente manda o token sempre, mas
   se o endpoint for aberto isso não protege ninguém.
2. **As 3 linhas de `contas_receber` com `data > vencimento`.**
3. **Dívida do prettier: 48 arquivos**, mais a regra nova na receita.
4. **`ordenarContas` usa `localeCompare` sem locale** — a correção 1.11 foi sobre
   a lista de opções; a ordenação da tabela ficou de fora do pedido.
5. **`converterParaNumero` duplicado** em `src/pages/Servicos.tsx` e
   `src/context/ServicosContext.tsx`, com o mesmo bug do `1.234`.
   `src/lib/dinheiro.ts` está pronto para elas.
6. **`MultiSelect` ainda não é primitivo** — a cópia está em 8 telas. Promover
   agora seria decidir a API vendo 2 dos 8 usos; quando as seis migrarem, é um
   `git mv`.
7. **`ModalObservacoes`** (`src/components/`) ainda é modal cru, usado por Vendas,
   Serviços e Vendedores. O padrão de modal já está pronto para quando chegarem.
8. **Contraste da caixa de erro do Login** em ~3,6:1, abaixo de AA para corpo.
9. **Confete não respeita `prefers-reduced-motion`** (é `<canvas>`).
10. **`react-hooks/set-state-in-effect`** no `useEffect` que busca dados — vale
    para as telas restantes.
11. **Checkpoint humano de permissões da Fase 2** nunca foi feito.
12. **`docs/DataCoreHS.html`** segue fora do versionamento, sem decisão.

---

## Estado em 10/09/2026 — a colisão, e o que ela ensinou

**Fase 4 fechada em 6/6. Fase 3 em 8 das 12 telas. E, pela primeira vez desde
agosto, o `origin/main` está em dia.**

Suíte **1625 testes / 123 arquivos**, verdes em `TZ=UTC` e
`TZ=America/Sao_Paulo`, zero pulados. Lint **49** (baseline original 192),
`tsc` limpo, prettier limpo.

### O que aconteceu: 79 commits represados encontraram outra frente de trabalho

O repositório vinha **79 commits à frente do `origin/main`**, de propósito — o
merge é checkpoint humano e não tinha sido pedido. Nesse intervalo, uma segunda
frente de trabalho, partindo de um `origin/main` que nunca viu esse trabalho,
**reescreveu a fonte de dados** de Clientes, Produtos, Serviços e Vendas: as
telas deixaram de carregar as notas inteiras no navegador e passaram a ler
resumos já agregados pelo Postgres, com Serviços paginando no servidor.

O resultado foi **45 arquivos em conflito real contra 26 que sobreviveram**. As
migrações de Produtos e Serviços não podiam ser mergeadas: tinham de ser
**refeitas** sobre o código novo.

**A decisão que governou o resgate:** preservar o que já estava empurrado. Nada
de `revert`, nada de "a versão antiga era melhor". Cada leva nasceu de uma
branch criada a partir do `origin/main` e subiu em **fast-forward**.

| Branch                              | O que levou                                                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `fase-4-hooks-sobre-origin`         | `useCliqueFora` e `useIsMobile`, os dois guardas, e Clientes/Produtos/Vendas consumindo o hook            |
| `fase-3-produtos-sobre-origin`      | Produtos reaplicado — 16 commits, casca 920 → 239 linhas                                                  |
| `fase-4-testes-mobile-sobre-origin` | as specs e planos da Fase 4, e os testes `Clientes.mobile` e `Vendas.mobile`, que tinham ficado para trás |
| `fase-3-servicos-sobre-origin`      | Serviços reaplicado — 16 commits, casca 909 → 277 linhas                                                  |

**O `main` local está esgotado.** O que resta nele e não está no `origin/main`
são três contexts (`DataContext`, `ServicosContext`, `ContasReceberContext`) que
a outra frente apagou de propósito ao trocar a fonte de dados.

### A lição de processo: segurar `push` não é neutro

A regra "não empurrar sem o Erick pedir" está certa como checkpoint. Mas o custo
de segurar **não aparece no dia em que se segura** — aparece semanas depois,
inteiro de uma vez, quando outra frente reescreve os mesmos arquivos.

**A partir de agora:** quando o contador de commits à frente do `origin/main`
passar de algumas dezenas, isso vira assunto, em vez de acumular em silêncio.

### O que a reaplicação acrescentou à receita

A receita de sete passos continua valendo. O que a colisão acrescentou:

1. **A decomposição vem do commit anterior aos consertos.** As branches de
   migração terminam com os defeitos já corrigidos dentro dos componentes.
   Trazê-los inteiros faz o commit que move **mover e consertar ao mesmo tempo**,
   e aí um teste vermelho não diz qual dos dois quebrou. Em Produtos o ponto
   limpo foi `79954c07`; em Serviços, `91bb7412` — com a ressalva de que aquele
   commit também adotava os tokens, então a casca teve de vir de `91bb7412^`.
2. **Preservar é diferente de acrescentar.** Restaurar os ícones de seta que o
   ponto limpo não tinha é preservação, porque o `origin/main` os tem; dar vida a
   um estado morto (`exportando`) é conserto, e conserto não entra no commit que
   move.
3. **Citação em comentário vai por arquivo + símbolo, sem número de linha.** Um
   conserto que acrescenta um `case` desloca tudo abaixo, e a citação apodrece.
4. **O portão de cada migração é a rede passar sem uma edição.** Nas duas telas
   isso valeu: os cinco arquivos de teste de tela ficaram byte a byte iguais
   através do commit que move.

### A lição de teste: a plantação é hipótese, não fato

Este é o achado mais caro do período. Ao longo de três dias, **cinco plantações
escritas nos planos não derrubavam o que os planos afirmavam que derrubariam** —
e em dois casos foi o implementador que descobriu.

E o inverso, medido: a revisão final de **Produtos plantou 67 quebras e 19
passaram verdes**. Dezenove maneiras de a tela ficar errada sem nenhum teste
reclamar. Nenhuma era defeito de conta; eram todas buracos de cobertura.

Os padrões que enganam, todos encontrados aqui:

- **`within(linha).getByText(valor)`** prova que o valor está na linha, não na
  célula certa. Trocar duas colunas de lugar passava verde.
- **Troca simétrica entre dois campos** escapa de qualquer asserção que só olhe
  o _conjunto_ de valores presentes. Mexer num lado falha; trocar os dois, não.
- **Exportação verificada por `Object.keys` e `toHaveLength`** não verifica nada.
- **Gráfico testado pelo que recebe** não prova o que desenha.
- **`getByRole("button")` aceita um `<th role="button">`**, que continua
  inalcançável por teclado — o defeito exato volta verde. Só um teste que chama
  `focus()` e olha o `document.activeElement` pega.
- **Comentário que promete cobertura inexistente é pior que ausência de
  cobertura**, porque é o que faz o próximo revisor não plantar ali. Havia um em
  `Produtos.kpis.test.tsx` afirmando cobrir justamente a troca que não cobria.
- **Plantação que quebra a compilação não prova nada.** O teste não roda, e
  "nenhum teste" se parece com falha.

Embutir esses padrões no plano de Serviços **desde a primeira task** derrubou o
placar de 19 plantações verdes para 6.

### Os defeitos consertados na reaplicação

Além de restaurar a decomposição, as duas telas saíram melhores do que entraram:

| Tela     | Defeito                                                                            | Consequência                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Produtos | item sem código colidia na `key` do React                                          | duas linhas reconciliadas como uma; reordenar embaralhava o conteúdo                                                                 |
| Produtos | eixo Y do ranking em 11px                                                          | abaixo do mínimo do checklist — e era **incoberto por construção**, porque o dublê de recharts descartava a render-prop              |
| Serviços | **data de emissão um dia atrás na planilha e no PDF**                              | a tela mostrava 15/03 e o documento exportado, 14/03 — em Brasília. Em `TZ=UTC` o defeito **some**, e foi assim que atravessou meses |
| Serviços | a tela não tinha estado de erro                                                    | API caída = KPIs zerados e "Nenhum resultado encontrado.", sem dizer que a rede falhou                                               |
| Ambas    | cabeçalho ordenável inalcançável por teclado, exportar habilitado com tabela vazia |                                                                                                                                      |

O defeito de fuso merece nota: `new Date("2026-03-15")` é lido como meia-noite em
**UTC**, e a oeste de Greenwich isso ainda é o dia anterior. `dataDeCalendario`
(`src/lib/datas.ts`) existe exatamente para isso. **O teste que o trava passa em
`TZ=UTC` mesmo com o defeito presente** — não há fixture que mude isso, porque o
erro não existe em UTC. É a justificativa concreta da regra de rodar a suíte nos
dois fusos.

### Telas da Fase 3 — 8 de 12

| #   | Tela                                                         | Estado                                                        |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| 1–5 | Dashboard · Locação · Usuários · ContasReceber · ContasPagar | **feitas** (agosto)                                           |
| 6   | Financeiro + CentroCustoTab + MetaTab                        | **feita** — a única com abas                                  |
| 7   | Produtos                                                     | **feita**, e **reaplicada** sobre a fonte agregada            |
| 8   | Serviços                                                     | **feita**, e **reaplicada** sobre a fonte agregada e paginada |
| 9   | Vendedores                                                   | próxima                                                       |
| 10  | Estoque                                                      |                                                               |
| 11  | Clientes                                                     | dado enriquecido; já consome o `useIsMobile`                  |
| 12  | Vendas                                                       | maior e mais crítica, por último                              |

`PENDENTES_FASE_3` tem hoje quatro entradas: `Clientes`, `Estoque`, `Vendas`,
`Vendedores`.

### Dívida aberta: a conferência no navegador

**Nada foi conferido no navegador desde a Fase 4.** É o passo 6 da receita, e é
insubstituível — nenhum teste responde por ele. Acumulado:

1. Os três gráficos de Serviços, nos dois temas.
2. **Abrir a planilha exportada** de Serviços com um período estreito: as colunas
   e o número de linhas têm de bater com a tela. A rede prende o _pedido_, não a
   contagem — o falso é da outra frente e não se toca.
3. **Abrir o PDF**, conferindo o cabeçalho contra o corpo.
4. Derrubar a API e ver o aviso novo de Serviços aparecer.
5. Toque fora de um filtro no celular; `Escape` nos dois popovers de Estoque.
6. Cores de eixo e grade nos dois temas; a pizza de 8 → 6 cores, repetindo da 7ª
   cidade.
7. **Duas mudanças visuais deliberadas:** o primeiro paint em tela estreita
   (Clientes e Vendas agora nascem no tamanho de celular em vez de nascerem
   desktop e corrigirem depois do mount), e as barras do "Top 10" de Produtos,
   que saíram do laranja para a cor de ação do `chartTheme` — os dois gráficos
   ficaram do mesmo tom.
8. Um período de mais de 24 meses, para ver a escala anual.
9. A frase do estado de carregando de Serviços mudou e **não tem teste em tela
   nenhuma**.

### Achados registrados e não corrigidos

- `ordenarEBuscar` (Produtos) nunca devolve `0`: ordenação instável em empate.
- O cabeçalho ordenável não emite `aria-sort` — a direção é informação só visual.
- Exportar com a tabela vazia gera planilha e PDF só com cabeçalho.
- Os `<label>` dos filtros de Serviços seguem sem `htmlFor`.
- "NFS-e Emitidas" sem separador de milhar, com 5.004 notas na base.

## Estado em 15/09/2026 — a conferência no navegador

A dívida da seção anterior foi paga: oito dos nove itens conferidos, um pela
metade. O app rodou em `npm run dev` apontando para produção **só para leitura**
— o `.env.local` manda para `localhost:5200`, porta que nada na máquina sobe, e
as URLs foram passadas pelo ambiente. A suíte ficou em **1630 testes / 123
arquivos**, verde nos dois fusos; lint 49; `tsc` limpo. Depois dos dois consertos
da casca (abaixo), **1647 / 126**.

### O que a conferência confirmou

- **Planilha** de Serviços com período de 01 a 14/09: 57 linhas contra 57 na
  tela, e a soma da coluna Valor (R$ 115.739,20) igual ao KPI.
- **PDF**: as cinco colunas do cabeçalho batem com o corpo.
- **API derrubada**: o `Alert` "Não foi possível carregar as notas de serviço."
  aparece no fluxo da página.
- **Carregando**: "Carregando dados de serviços." — frase completa, com ponto.
- **Mais de 24 meses**: a evolução troca para escala anual, e o preset passa
  sozinho a "Personalizado".
- **Produtos**: linha e barras do "Top 10" no mesmo tom (`#1f89ca`).
- **Estoque, no desktop**: os dois popovers de pizza fecham com `Escape` e com
  clique fora.

### O defeito consertado: a cidade `null`

Desde 2025 a API devolve `cidade_tomador: null` — **1276 de 1276** notas de 2025,
868 das 1133 de 2026 (medido em `silver.stg_servicos`; a falta já existe em
`tiny.servicos`). A planilha e o PDF montavam `${cidade}/${uf}` e saíam com
**"null/null" em toda linha**; a tabela mostrava uma barra solta. Nenhum teste
via isso porque todo fixture tinha cidade.

Consertado em `f3b2ed67` com `rotuloDaCidade` (`pages/servicos/servicos.ts`),
usada nos três lugares. O tipo `Servico` passou a declarar `string | null`.

**A causa não é deste repo.** A importação das NFS-e parou de trazer a cidade do
tomador — é assunto do `tiny-integrador`. Enquanto isso, a pizza "Distribuição
por cidade" **engana**: as fatias "/SP", "/MG" e "/ 8%" são notas sem cidade, e
o rótulo vem pronto do resumo do Postgres (`useServicos.ts`, que não é nosso).

### Defeitos encontrados e ainda abertos

1. ✅ _Consertado em `1dfc8646` — ver abaixo._ **Trocar o tema não repinta os gráficos.** `chartTheme` lê a custom property
   no render, e a troca de tema não provoca render nos gráficos: grade e texto de
   eixo ficam com a cor do tema anterior até recarregar. No claro, a grade fica
   `#1e3a5f` — o azul-marinho do escuro. Medido no DOM: claro recarregado dá
   `#e2e8f0`, e depois da troca continua `#e2e8f0` no escuro. É compartilhado —
   atinge toda tela com recharts.
2. ✅ _Consertado em `511555e3` — ver abaixo._ **A casca não tem celular.** O `AppShell` não recolhe a sidebar em tela
   estreita: em 390px ela ocupa 256px e sobra 128px para a página. Em Estoque as
   pizzas nem renderizam nessa largura. O `useIsMobile` das telas não compensa
   uma casca que não sabe dele.
3. **Falha de rede deixa o resto da tela mentindo.** Abaixo do `Alert`, Serviços
   mostra KPIs "R$ 0,00" / "0" / "N/A", gráficos com moldura vazia e "Nenhum
   resultado encontrado." — como se o período não tivesse nota.
4. **O PDF corta em 30 linhas sem dizer.** Com 57 no recorte, o relatório traz 30
   e o cabeçalho não menciona nem o corte nem o período filtrado.
5. **"NaN%" no tooltip da pizza de situação de Estoque.** Fica para a migração
   dessa tela.

### Menores

- Valores do PDF em formato americano (`R$ 2500.00`).
- Eixo Y da evolução de Serviços: "R$ 550.0K" quebra em duas linhas; o último
  ano ("2026") sai cortado na borda, e com "Todos" o rótulo de 2025 some.
- Na pizza, a sexta cor da rampa (`--color-primary-300`) é quase ilegível como
  texto de rótulo no tema claro.
- Top 10 de Produtos: os rótulos inclinados perdem o **começo** do nome.
- Eixo Y da evolução de Produtos sem separador de milhar ("2000000").

### O que ficou pela metade

~~**Toque fora de um filtro no celular** (item 5).~~ Fechado depois do conserto da
casca: em 390px, tocar numa fatia abre o popover das duas pizzas de Estoque e
tocar no título do card o fecha. Simulado com clique de mouse, que passa pelo
`mousedown` do `useCliqueFora` — o `touchstart` de aparelho de verdade segue sem
prova. ⚠️ Com `trigger="click"` o wrapper do recharts fica **visível** mesmo
fechado — quem some é o conteúdo. Medir a visibilidade do wrapper dá falso
"continua aberto"; medir o texto dá a resposta certa.

### Os dois consertos da casca

**O tema.** `useTemaDoGrafico` (`design-system/chartTheme.ts`) assina a classe do
`<html>` com `MutationObserver` via `useSyncExternalStore`, e os nove componentes
que pintam com cor de token o chamam. **Ouvir o `darkMode` do contexto não
basta** — o `ThemeProvider` põe a classe `dark` num `useEffect`, depois do render,
e o gráfico re-renderizado pelo contexto ainda lê o token velho. Não foi suposto:
o teste seguiu vermelho com essa versão. Guarda novo,
`guarda-tema-do-grafico.test.ts`, com duas portas — componente que usa cor de
token sem chamar o hook, e leitor novo de custom property fora da lista.
Efeito colateral aceito: na troca, a pizza refaz a animação e os rótulos voltam
em ~1,5 s.

**O celular.** Decisão do Erick entre gaveta sobreposta e trilho de ícones fixo:
**gaveta**. Abaixo de `sm` a sidebar fixa some por CSS (`hidden sm:flex` — com
JavaScript, o celular nasceria com 256px de sidebar e saltaria depois da
montagem), e o botão de menu da topbar abre a sidebar expandida por cima, no
molde do `Modal`: cortina, foco entrando e voltando, `Escape`, fundo sem rolar;
navegar fecha. **Não prende o `Tab`**, diferente do `Modal` — fica para quando
alguém pedir. O miolo virou `ConteudoDaSidebar`, e a extração passou nos 15
testes antigos sem edição. Topbar no celular só com avatar e ícone de Sair;
conteúdo com `p-4`, o `--content-padding-mobile`.

Menor, visto na conferência e não desta mudança: o tooltip "Recolher menu" do
botão focado sai cortado no topo da janela.

## Estado em 15/09/2026 (tarde) — Vendedores migrada, Fase 3 em 9 de 12

Branch `fase-3-vendedores`, nascida do `origin/main` `0c5fed35`, treze commits.
Suíte em **1712 testes / 131 arquivos**, verde nos dois fusos; lint **47** (era
49 — saíram o ícone `Save` importado sem uso e o `exportando` que ninguém lia);
`tsc` limpo. `PENDENTES_FASE_3` tem três entradas: Clientes, Estoque, Vendas.
**Próxima tela: Estoque.**

### Como foi

1. **Caracterização antes de mover** — quatro arquivos novos (KPIs e cabeçalho,
   gráficos, tabela, exportação), 68 testes com os três que já existiam.
   **22 plantações** na tela antiga, uma por vez: todas derrubaram ao menos um
   teste.
2. **Decompor em três commits**, e os 68 passaram **sem uma edição** em cada um.
   A ordem foi imposta pelo guarda de cores: componente novo fora de
   `PENDENTES_FASE_3` não pode ter paleta crua, então cada peça nasceu limpa
   ("cada task limpa o que extrai"), e a casca antiga ficou na lista até a
   última peça sair.
3. **Sete consertos, um commit cada, teste vermelho antes e plantação depois.**

### Os consertos

| Commit     | Defeito                                                                                                                                                                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `150fabb0` | **O filtro de produto mandava o rótulo** ("Kit (K1)") onde o servidor filtra pela chave ("K1") — escolher qualquer produto zerava a tela. O comentário ao lado dizia que o multiselect "já guarda a chave". Conferido contra a API real: 4336 → 627 notas com um produto escolhido. |
| `4035d3a2` | Falha de rede silenciosa — mesmo defeito e mesmo conserto de Serviços. A frase é da tela: a do hook (`useComercial.ts`, da outra frente) vem sem acento.                                                                                                                            |
| `e06dfe11` | Ordenar era só de mouse (`onClick` no `<th>`); agora botão com nome e `aria-sort`.                                                                                                                                                                                                  |
| `d9df17bf` | Abrir a edição do tipo era `<div onClick>`; salvar e cancelar eram só ícone.                                                                                                                                                                                                        |
| `756c9d74` | Exportar não desabilitava durante a busca nem com a tabela vazia.                                                                                                                                                                                                                   |
| `953417ed` | "Carregando suas vendas..." → frase com ponto.                                                                                                                                                                                                                                      |
| `66539a53` | Gráfico sem dado era moldura muda → `ChartEmpty`.                                                                                                                                                                                                                                   |

E um de apresentação, visto só no navegador (`ffd9a9cb`): a tabela media 1192px
numa caixa de 1080, e a coluna **Tipo da Nota — a de ação — ficava atrás da
rolagem**. E os cabeçalhos ordenáveis saíam em caixa normal: o preflight do
Tailwind zera `text-transform` em `button`. **Serviços tem o mesmo defeito de
caixa** ("Número NFS-e" ao lado de "DESCRIÇÃO") e não foi mexido.

### Duas lições de verificação

- **Uma plantação não derrubou nada** (`756c9d74`): tirar o `|| exportando` do
  `disabled` não muda o que a pessoa vê, porque o `loading` do `Button` já
  desabilita. O commit saiu dizendo que derrubava; a mensagem foi corrigida antes
  do push. A plantação que conta tira os dois mecanismos. É a lição de 10/09 de
  novo: a plantação é hipótese — e **uma plantação que deixa o JSX inválido
  também não prova nada**: o arquivo não compila, "no tests", e parece vermelho.
- **`prettier --check` num arquivo ignorado responde "formatado".** Os checks dos
  commits de Vendedores passavam porque `src/pages/*` está no `.prettierignore`;
  ao sair de lá, eram 15 arquivos fora do padrão.

### Checklist de tela migrada — Vendedores

1. Hexadecimal cravado: **nenhum** (as oito cores de `CORES` saíram).
2. `dark:` onde há token: **nenhum**.
3. Azul de ação: **sim** — `tone="acao"` no faturamento, `text-action` no valor.
4. Um botão primário por bloco: **sim** — só o "Exportar Excel", em `success`.
5. Texto abaixo de 12px: **só o rótulo do `KpiCard`** (11px), que é do primitivo e
   vale para todas as telas; os eixos subiram de 11 para 12px.
6. Estado vazio com frase completa: **sim** — `TableEmpty` e, depois de
   `66539a53`, `ChartEmpty` nos três gráficos.
7. Ícone é componente: **sim** (lucide). O "-" de "sem observação" é texto.
8. Contagem de paginação em frase: **sim** — "Mostrando 1 a 15 de 4336 notas".
9. `focus-visible` com anel de 2px: **sim**, nos botões novos e nos primitivos.
10. Nada animando em laço fora spinner: **sim** — o único `animate-spin` é o de
    salvar o tipo.

### Conferência no navegador (15/09)

Claro e escuro, filtro de produto contra a API real, vazio (período em 2031:
três `ChartEmpty`, `TableEmpty`, exportar desabilitado), erro (API bloqueada: o
`Alert`), carregando (resposta segurada: a frase), e a edição do tipo aberta e
**cancelada** — salvar grava em produção e não foi dirigido.

### Achados registrados e não corrigidos

- **A coluna "Numero" da planilha corta os dois primeiros dígitos** do número da
  nota (`substring(2)`: 991001 sai 1001). Sem comentário dizendo por quê, e
  nenhuma outra exportação faz isso. Pode ser regra do Tiny (prefixo de série) —
  **Decisão do Erick (15/09): fica como pendência para o futuro** — não mexer sem
  ele pedir.
- O "Produto Top" mostra o valor sem casas fixas ("R$ 15.684.661,84" e
  "R$ 5.000" convivem).
- Falha ao salvar o tipo e ao exportar continuam em toast: são retorno de ação
  que a pessoa acabou de tomar, que é o uso certo.

## Estado em 15/09/2026 (noite) — Estoque migrada, Fase 3 em 10 de 12

Branch `fase-3-estoque`, catorze commits sobre `1015920e`. Suíte em **1773 testes /
137 arquivos**, verde nos dois fusos; lint **39** (era 47 — saíram o `gerarPDF`, a
lista `solicitacao` e o `atualizarQuantidade` que ninguém chamava, e os `any` do
comparador); `tsc` limpo. `PENDENTES_FASE_3`: **Clientes e Vendas**. **Próxima:
Clientes.**

### Como foi

Estoque é diferente das telas do Comercial: a conta é **toda do navegador** — o
`EstoqueContext` entrega o catálogo inteiro e a tela filtra, soma e ordena. Então a
ordem das linhas e os números são observáveis de ponta a ponta, sobre um estoque
falso de seis produtos com todo campo distinto (`estoque/produtosFalsos.ts`).

1. **Caracterização**: três arquivos novos (topo e filtros, gráficos, tabela), 68
   testes com os quatro que existiam. **23 plantações — duas saíram cegas** na
   primeira rodada: só a opção "Inativo" do filtro de situação estava testada, e o
   teste do modal filtrava pela _pesquisa_, que não chega na lista que o modal
   recebe. Os dois testes foram refeitos e as duas plantações replantadas.
2. **Decompor num commit** (`7f23ab63`), 68 testes sem uma edição.
3. **Dez consertos**, um commit cada, teste vermelho antes, plantação depois.

### Os consertos

| Commit     | Defeito                                                                                                                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `a69e2dfe` | **"NaN%" no balão da pizza de situação** — o balão lia `percent` do dado da fatia, onde o recharts não o põe. **O teste de popover escondia**: o dublê dele põe `percent` justamente ali. Teste novo com dublê fiel. |
| `cdfa4008` | Falha de rede silenciosa — o `EstoqueContext` só escrevia no console; agora devolve `erro`, e a tela mostra o `Alert`.                                                                                               |
| `1a600bda` | Ordenar só de mouse → botão com nome, `aria-sort` e caixa alta (a lição de Vendedores aplicada antes de aparecer).                                                                                                   |
| `f013cc27` | Exportar não desabilitava com a tabela vazia.                                                                                                                                                                        |
| `04fbf3ca` | Gráfico sem produto era moldura muda → `ChartEmpty`.                                                                                                                                                                 |
| `f32f04aa` | Estatísticas com ponto decimal (`toFixed`) ao lado de cartões em pt-BR.                                                                                                                                              |
| `d6f394e8` | "Produto Top" sem produto saía "R$ ()".                                                                                                                                                                              |
| `43633713` | Frase de carregando com reticências.                                                                                                                                                                                 |
| `06a896f2` | **Código-SKU ordenava como texto** ("900" antes de "163"), e o comparador nunca devolvia 0 — empate sem regra. Agora ordem natural, e empate pelo nome.                                                              |
| `57dcb7e0` | **Visto só no navegador**: o Tiny devolve nome com espaço nas pontas (" VIDRO - PHOEBUS "), e esse produto abria a tabela. A comparação ignora o espaço das pontas.                                                  |

### Uma lição de processo

Um `prettier --write` rodado com `--ignore-path /dev/null` num arquivo ainda
ignorado **meteu 492 linhas de formatação num commit de conserto de 18**. Desfeito
e reaplicado sem formatar; a formatação foi para o commit do passo 7 (`2c9bf8c5`).
Até a tela sair do `.prettierignore`, não formatar arquivo dela.

### Checklist de tela migrada — Estoque

1. Hexadecimal cravado: **nenhum** (as oito cores de `CORES` saíram).
2. `dark:` onde há token: **nenhum**.
3. Azul de ação: **sim** — valor total em `tone="acao"`, preço em `text-action`.
4. Um botão primário por bloco: **sim** — "Solicitação de Compras"; "Exportar
   Excel" é `success`.
5. Texto abaixo de 12px: **só o rótulo do `KpiCard`** (11px, do primitivo); os
   eixos subiram de 10/11 para 12px.
6. Estado vazio com frase: **sim** — `TableEmpty` e `ChartEmpty` nos três gráficos.
7. Ícone é componente: **sim**.
8. Contagem de paginação em frase: **sim** — "Mostrando 1 a 15 de 280 produtos".
9. `focus-visible` com anel de 2px: **sim**.
10. Nada animando em laço fora spinner: **sim**.

### Conferência no navegador (15/09)

Claro e escuro; o balão de situação mostrando "Inativos · Quantidade: 3 · 1%";
tabela cabendo (1080 de 1080); vazio (Inativo + saldo negativo: três `ChartEmpty`,
`TableEmpty`, exportar desabilitado, "Produto Top" N/A e estatísticas zeradas em
pt-BR); erro (API bloqueada: "Não foi possível carregar o estoque."); carregando;
celular em 390px com as pizzas renderizando.

### Achados registrados e não corrigidos

- **A lista de "Principais" é cravada no código** (29 códigos), sem nome ao lado nem
  registro de quem a definiu — produto novo só entra com deploy. Decisão de produto.
- O eixo do Top 10 escreve "R$ 0.00" / "R$ 2.0M" com ponto (`formatarValorAbreviado`).
- O dublê de `Estoque.popover.test.tsx` segue pondo `percent` no dado da fatia; hoje
  inofensivo (a tela não lê mais), mas é o mesmo tipo de dublê que escondeu o NaN.

## Estado em 15/09/2026 (fim de tarde) — Clientes migrada, Fase 3 em 11 de 12

Branch `fase-3-clientes`, catorze commits sobre `45503de5`. Suíte em **1828 testes /
142 arquivos**, verde nos dois fusos; lint **27** (era 39 — saíram os imports sem uso,
os dois gráficos que ninguém desenhava e os `any` do comparador); `tsc` limpo.
`PENDENTES_FASE_3`: **só Vendas**. `PENDENTES_UTC` do guarda de planilha: **vazia**.
**Próxima e última: Vendas.**

### Como foi

Clientes lê o resumo agregado do banco (`comercial/useComercial.ts`, da outra frente),
mas ordena e pesquisa a carteira **no navegador** — então a ordem das linhas é
observável de ponta a ponta, sobre uma carteira falsa de doze clientes
(`clientes/clientesFalsos.ts`) com o relógio fixado em 15/09/2026.

1. **Caracterização**: quatro arquivos novos (topo e recorte, Top 10, tabela,
   exportação), 72 testes com os quatro que existiam. **32 plantações**, todas
   derrubaram — e nenhuma deixou o arquivo sem compilar (contagem de falhas
   específica em cada uma).
2. **Um conserto antes de decompor** (`68b4b50c`): mover o `toISOString` da última
   compra para `clientes.ts` o tirava de `PENDENTES_UTC`, e o guarda de planilha
   caiu. O conserto foi feito na tela antiga, em commit próprio.
3. **Decompor num commit** (`99b9cb01`), 72 testes sem uma edição.
4. **Dez consertos**, um commit cada, teste vermelho antes, plantação depois.

### Os consertos

| Commit     | Defeito                                                                                                                                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `68b4b50c` | **Última compra da tabela em UTC**: a leste de Greenwich mostrava um dia a menos que a planilha (`TZ=Asia/Tokyo`: 09/09 para 10/09). Em Brasília não aparece, então a suíte não fica vermelha; quem trava é o guarda de planilha, cuja lista ficou vazia. |
| `bb7eea14` | Falha de rede silenciosa — mesmo defeito e conserto de Serviços e Vendedores.                                                                                                                                                                             |
| `84f06e14` | Ordenar só de mouse → botão com nome, `aria-sort` e caixa alta.                                                                                                                                                                                           |
| `622700fc` | Exportar (Excel e PDF) não desabilitava com a tabela vazia.                                                                                                                                                                                               |
| `871e908d` | Top 10 sem cliente era grade e eixos em branco → `ChartEmpty`.                                                                                                                                                                                            |
| `a0381fa2` | Frase de carregando com reticências.                                                                                                                                                                                                                      |
| `139c5911` | Comparador que nunca devolvia 0, e nome por `toLowerCase`: "Ágil" ia para depois de "Zeta", e o espaço da frente abria a tabela. As regras de Estoque.                                                                                                    |
| `dc99b08c` | Taxa de ativação "75.0%" ao lado de "R$ 123.456,78".                                                                                                                                                                                                      |
| `5a0e4338` | Total do PDF "R$ 50000.50".                                                                                                                                                                                                                               |
| `ee69ab69` | Nota do Top Cliente era o valor abreviado do eixo ("R$ 50.0K"), e "R$ 0" sem cliente.                                                                                                                                                                     |
| `01817b69` | **Visto só no navegador**: seis colunas de filtro em ~1080px quebravam "Todos os vendedores" em duas linhas. Duas colunas em `md`, três em `lg`, seis em `2xl`; conferido de 800 a 1920px.                                                                |

### Decisão tomada na decomposição

A tela **calculava e não desenhava** dois gráficos: a distribuição de faturamento
(top 8 + "Outros") e a evolução mensal dos cinco maiores clientes — esta sobre
`evolucao_por_cliente`, que a outra frente pôs na API para esta tela. Os dois saíram
como código morto (ficam no histórico). **Erick (15/09): manter a decisão.** Se o
gráfico de evolução for querido um dia, o dado já vem do banco.

### Duas lições de verificação

- **Uma plantação saiu cega** (`139c5911`): trocar `sensitivity: "base"` por
  `"variant"` não muda a ordem — só o desempate de acento e caixa. Quem põe "Ágil"
  junto do "A" é o `localeCompare` em si; a plantação que conta volta ao
  `toLowerCase`. Mais uma vez: a plantação é hipótese sobre o mecanismo.
- **O teste de `aria-sort` nasceu errado**: procurava o `columnheader` pelo
  `aria-label` do botão, e no jsdom daqui o nome do cabeçalho sai do texto visível.
  Falhava com e sem o conserto — vermelho pelo motivo errado. Corrigido para subir do
  botão ao `<th>`, e conferido vermelho sem o conserto e verde com ele.

### Checklist de tela migrada — Clientes

1. Hexadecimal cravado: **nenhum** (saíram as oito de `CORES` e as seis do balão).
2. `dark:` onde há token: **nenhum**.
3. Azul de ação: **sim** — ticket em `tone="acao"`, valor total em `text-action`.
4. Um botão primário por bloco: **sim** — nenhum `primary`; Excel é `success` e PDF
   `secondary`.
5. Texto abaixo de 12px: **só o rótulo do `KpiCard`** (11px, do primitivo); os eixos
   subiram de 11 para 12px.
6. Estado vazio com frase: **sim** — `TableEmpty` e `ChartEmpty`.
7. Ícone é componente: **sim**.
8. Contagem de paginação em frase: **sim** — "Mostrando 1 a 15 de 1817 clientes".
9. `focus-visible` com anel de 2px: **sim** — conferido no navegador no botão de
   ordenar (anel de 2px na cor de foco).
10. Nada animando em laço fora spinner: **sim**.

### Conferência no navegador (15/09)

Claro e escuro, contra a API real (1817 clientes, 158 ativos); ordenar por Enter no
teclado com `aria-sort` mudando; pesquisa sem resultado (`TableEmpty`, Excel e PDF
desabilitados); vazio (período em 2031: `ChartEmpty`, KPIs e estatísticas zerados sem
"R$"); erro (resumo bloqueado: o `Alert`, com os filtros na tela); carregando
(resposta segurada: a frase); celular em 400px sem rolagem lateral.

### Achados registrados e não corrigidos

- **O PDF corta em 30 clientes sem avisar** — o mesmo de Serviços. Decisão de produto
  (exportar tudo ou avisar), melhor tomada para as duas telas juntas.
- **A borda dos 90 dias**: o limite é "agora menos 90 dias" com hora, e a compra é
  meia-noite — quem comprou exatamente há 90 dias sai inativo.
- **"Ticket Médio/Cliente" é a média das médias** de cada cliente, e não o ticket da
  carteira (valor total sobre notas). O rótulo não diz qual; decisão de produto.
- O eixo do Top 10 escreve "R$ 0.00" / "R$ 2.6M" com ponto — o mesmo de Estoque e
  Vendedores, em `formatarValorAbreviado`.
- O "Top Cliente" com o período "Todos" é um cliente **inativo** (última compra em
  2021): o ranking é por valor do recorte, e não por atividade. Não é defeito, mas
  vale saber ao ler o cartão.

## Estado em 15/09/2026 (noite) — Vendas migrada, Fase 3 concluída (12 de 12)

Branch `fase-3-vendas`, dezessete commits sobre `8bc61ab4`. Suíte em **1887 testes /
147 arquivos**, verde nos dois fusos; lint **24** (era 27 — saíram as oito cores de
`CORES_PIZZA` que ninguém usava, imports sem uso e o estado `exportando` que nada lia);
`tsc` limpo. **`PENDENTES_FASE_3` está vazia: não há mais tela fora do design system.**

### Como foi

Vendas é a gêmea de Vendedores na fonte de dados: resumo agregado do banco e tabela
paginada no servidor (`comercial/useComercial.ts`, da outra frente). A tabela prende o
**pedido** que a tela manda, e não a ordem das linhas.

1. **Caracterização**: quatro arquivos novos (topo e rodapé, gráficos, tabela,
   exportação) sobre `vendas/vendasFalsas.ts`, 74 testes com os quatro que existiam.
   **42 plantações**, todas derrubaram. O dublê de recharts dos gráficos chama o `label`
   da pizza com o `percent` que o recharts calcula e o `content` com o item do array,
   sem nada a mais — a lição do NaN de Estoque.
2. **Decompor num commit** (`6dd57f93`), 74 testes sem uma edição.
3. **Quinze consertos**, um commit cada, teste vermelho antes e plantação depois —
   três deles vistos só no navegador.

### Os consertos

| Commit                  | Defeito                                                                                                                                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `752e83f9`              | Falha de rede silenciosa nos dois hooks → um `Alert`.                                                                                                                                                                                                                                                   |
| `cfc3b27b`              | **A planilha saía com um dia a menos em Brasília**: `new Date("2026-03-05")` é meia-noite em UTC. O teste só fica vermelho em `TZ=America/Sao_Paulo`. Conferido no arquivo exportado da API real: 04/09, igual à tabela.                                                                                |
| `7d835194`              | Ordenar só de mouse → botões com `aria-sort`.                                                                                                                                                                                                                                                           |
| `a03b666b`              | Exportar não desabilitava durante o laço (dois cliques, duas planilhas) nem sem nota.                                                                                                                                                                                                                   |
| `8f043afa`              | Falha ao exportar só escrevia no console → toast.                                                                                                                                                                                                                                                       |
| `41d7cb39`              | Os quatro gráficos sem venda eram moldura muda → `ChartEmpty`.                                                                                                                                                                                                                                          |
| `600bb3b5`              | Frase de carregando com reticências.                                                                                                                                                                                                                                                                    |
| `7ebf2eea`              | **Acima de 24 meses o comparativo comparava ANOS sob "Variação último mês", "Melhor mês" e "Média mensal"** — e com o período "Todos" produção já passa de 24 meses: era o que a tela mostrava por padrão. Agora "Comparativo Anual"; e com menos de dois pontos o cartão explica em vez de ficar mudo. |
| `07cfb7a8` · `20b8873d` | Média de itens ("2.6") e variação ("-20.0%") com ponto.                                                                                                                                                                                                                                                 |
| `98bd4f3f`              | **Navegador**: seis colunas de filtro quebravam "Todos os vendedores".                                                                                                                                                                                                                                  |
| `6abea0c7`              | **Navegador**: "R$ 10.0M" quebrava no eixo da evolução, e o nome inclinado do Top 5 Produtos saía cortado ("TRO PHOEB..."). Conferido medindo cada rótulo contra a caixa do gráfico.                                                                                                                    |
| `5cdee458`              | **Navegador**: "Ver Observações" quebrava em duas linhas e dobrava a altura da linha.                                                                                                                                                                                                                   |

### Três lições

- **Mensagem de commit afirmando plantação que não foi medida, de novo**: o de
  `752e83f9` saiu dizendo que cada plantação derrubava dois testes; a saída mostrava um.
  Corrigido antes de seguir. E a plantação do `a03b666b` rodou com um teste já
  vermelho por outro motivo — foi refeita com a base limpa antes de acreditar na
  contagem.
- **Teste que só enxergava o eixo porque o gráfico vazio desenhava**:
  `Vendas.mobile.test` usava um resumo vazio, e o eixo de vendedores que ele lê só
  existia porque o gráfico sem dado pintava eixo assim mesmo. Com o `ChartEmpty` ele
  caiu — trocou para `vendasFalsas`, sem mudar o que afirma.
- **Um teste caiu pelo conserto, e não por defeito**: o de exportação que pesquisava
  "bocal" com o Vendedor B não casava nota nenhuma no fixture; com o botão desabilitado
  sem nota, o clique não exportava. Trocou o termo.

### Checklist de tela migrada — Vendas

1. Hexadecimal cravado: **nenhum** (saíram `CORES`, `CORES_PIZZA` e os balões).
2. `dark:` onde há token: **nenhum**.
3. Azul de ação: **sim** — faturamento em `tone="acao"`, valor em `text-action`.
4. Um botão primário por bloco: **sim** — nenhum `primary`; "Exportar Excel" é `success`.
5. Texto abaixo de 12px: **só o rótulo do `KpiCard`** (11px, do primitivo); o eixo de
   vendedores caía para 9px em celular e o de valor era 11px — os dois em 12px.
6. Estado vazio com frase: **sim** — `TableEmpty`, quatro `ChartEmpty` e a frase do
   comparativo.
7. Ícone é componente: **sim**.
8. Contagem de paginação em frase: **sim** — "Mostrando 1 a 15 de 4336 notas".
9. `focus-visible` com anel de 2px: **sim**.
10. Nada animando em laço fora spinner: **sim**.

### Conferência no navegador (15/09)

Claro e escuro contra a API real (4336 notas); ordenar por Enter (a primeira linha
virou a maior venda, R$ 799.680,00); modal de observações aberto e fechado;
**exportação real** num período de cinco dias (10 notas, datas iguais às da tabela);
vazio (período em 2031: quatro `ChartEmpty`, `TableEmpty`, exportar desabilitado, a
frase do comparativo); erro (resumo e vendas bloqueados: um `Alert`); carregando;
celular em 400px sem rolagem lateral.

### Achados registrados e não corrigidos

- **Data invertida vira "Confira a conexão"**: com o início depois do fim a API responde
  422, e a tela diz que a rede caiu. Vale para as quatro telas do Comercial; o
  tratamento mora em `comercial/useComercial.ts`, da outra frente.
- **`ModalObservacoesDaNota` não é diálogo**: `<div>` sem `role="dialog"`, sem Escape e
  com o botão em `bg-blue-600` cru. É componente compartilhado com Vendedores, fora
  destas telas.
- **O último ponto do comparativo é o período corrente, ainda aberto**: "Variação último
  ano −32,0%" compara 2026 até setembro com 2025 inteiro. Decisão de produto.
- "Não informado" é o maior vendedor (R$ 38 milhões) e a menor venda é R$ 0,00 — dado,
  não tela.
- A nota do "Produto Top" segue sem casas fixas ("R$ 15.684.661,84" ao lado de
  "R$ 5.000"), como em Vendedores; o eixo abreviado segue com ponto, como nas outras.

### Depois da Fase 3

A **ponte de paleta** (`blue-*`, `slate-700/800/900` no `tailwind.config.js`) ainda não
pode sair: `ModalObservacoesDaNota`, `ModalObservacoes`, `CentralButton` e `Login` a
usam. O guarda de cor cobre as telas; esses componentes são o próximo passo.

## Estado em 16/09/2026 — a ponte de paleta foi deletada

Branch `fase-4-ponte-de-paleta`, seis commits sobre `03ed4319`. Suíte em **1898 testes /
149 arquivos**; lint 24; `tsc` limpo; `npm run build` passa.

A ponte (`blue` em dez degraus e `slate` 700/800/900 redefinidos em hexadecimal no
`tailwind.config.js`) era o andaime da Fase 3: fazia 272 classes de azul e 132 de slate
já escritas apontarem para a marca sem editar tela nenhuma. Com as doze telas migradas,
sobravam **quatro consumidores fora das telas** — eles saíram primeiro, um commit cada,
e só então o andaime caiu.

| Commit                  | O quê                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `75ed9fc1` · `bffc3315` | Os dois modais de observação (o que busca o texto, de Vendas e Vendedores, e o que o recebe, de Serviços) eram `<div className="fixed inset-0">` à mão: **sem `role="dialog"`, sem nome acessível, sem Escape e sem prender o foco** — quem navegava por teclado seguia tabulando na tabela atrás. Agora são o `Modal` do design system. O botão "Fechar" do rodapé saiu: o × do cabeçalho já se chama assim, e dois controles com o mesmo nome acessível no mesmo diálogo é ruído. O `ModalObservacoes` ganhou teste próprio, que não tinha. |
| `c326b687`              | O Login usava `focus:ring-2 focus:ring-blue-400` — `focus:` em vez de `focus-visible:`, e a cor da ponte. O primitivo `Input` não serve ali: o painel é escuro nos dois temas, exceção documentada.                                                                                                                                                                                                                                                                                                                                           |
| `051e4bc6`              | `CentralButton`: borda e pulso em `border-action`/`bg-action`. Ganhou teste, que não tinha.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `e44a25c5`              | **A ponte deletada.** O teste do config deixa de travar os valores dela e passa a travar a ausência; o hexadecimal do `login` fica, que nunca foi ponte.                                                                                                                                                                                                                                                                                                                                                                                      |
| `820dfb07`              | Os quatro arquivos saem do `.prettierignore`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### O guarda ganhou uma regra: nome de token não é classe

Ao deletar a ponte, `guarda-cores` passou a acusar `--color-slate-900` em
`src/test/tailwind-config.test.ts` e `--color-slate-500` em
`pages/financeiro/coresDoAno.ts`. Não são classes: são **nomes de custom property** do
design system (`colors.css`, cópia verbatim) — o padrão casava o trecho inteiro porque o
prefixo de utilitário aceita `-`. Enquanto `slate` esteve na ponte isso ficou escondido.
O guarda passa a descartar achado que contenha `--`.

Duas armadilhas do mesmo tipo apareceram nos testes, que o guarda também varre: a
asserção do Login que citava `ring-blue-400` por extenso virou regex, e o caso novo do
guarda monta `bg-slate-900` em pedaços.

### A prova que importa

Plantação: devolver `border-blue-600` ao `CentralButton` **derruba o guarda de cor** —
e antes da remoção não derrubava, porque a ponte o isentava. É essa a mudança de regime:
a partir daqui a paleta crua do Tailwind é infração em qualquer arquivo do `src`.

### Conferência no navegador (16/09)

Claro e escuro: o modal de observações abrindo sobre a tabela de Vendas, fechando no
Escape; o botão flutuante com a borda da marca e o pulso; e o Login num contexto isolado
do navegador (sem mexer na sessão aberta), com o anel de foco em `#1a71a8` sobre o
azul-marinho do painel.

### Achado registrado e não corrigido

O `CentralButton` pulsa em laço (`animate-ping`, 2 s) o tempo todo, em todas as telas —
é o único elemento que anima sem parar fora de spinner, e contraria o item 10 do
checklist de tela migrada. Não foi mexido: é decisão de produto, e o botão é a porta para
a Central HS.

## Estado em 16/09/2026 (tarde) — a dívida do prettier foi paga

Branch `fase-4-prettier`, seis commits sobre `39acd3f9`. Suíte em **1899 testes / 149
arquivos**, verde nos dois fusos; lint 24; `tsc` limpo; `npm run build` passa. E, pela
primeira vez, **`prettier --check .` fica limpo**.

A lista de isenções nasceu na Fase 0 com uma razão boa: formatar uma tela ANTES de
migrá-la afogaria o diff da migração em espaço em branco. Cada tela saía da lista ao ser
migrada — da sexta (Financeiro) em diante, porque a regra entrou na receita depois de as
cinco primeiras já terem passado.

| Commit     | O quê                                                                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `29969e62` | `src/pages` inteiro — 75 arquivos, incluindo as seis telas anteriores à regra (Dashboard, Locação, Usuários, Contas, Produtos e Serviços).                                          |
| `4826a961` | O guarda do `useIsMobile`, consertado antes de formatar `src/hooks` (abaixo).                                                                                                       |
| `2a3ded50` | `src/components`, `src/context`, `src/hooks`, `src/services` e `src/test` — 26 arquivos.                                                                                            |
| `0b374b5a` | `docs` e o `index.html`: só alinhamento de tabela e o marcador de ênfase (`*x*` vira `_x_`).                                                                                        |
| `92a63af0` | `vite.config.ts`, `postcss.config.js`, os dois scripts avulsos e o README — nunca estiveram na lista, só nunca tinham sido formatados. O `.prettierignore` volta a caber numa tela. |
| `96a98254` | O guarda da lista, agora fechada.                                                                                                                                                   |

### O que sobrou ignorado, e por quê

- **`src/design-system`** — cópia verbatim, ver `ORIGEM.md`. É a isenção permanente.
- **Os quatro arquivos da outra frente** (`comercial/useComercial.ts`,
  `comercial/hooksFalsos.ts`, `servicos/useServicos.ts`, `servicos/hooksFalsos.ts`):
  formatar arquivo de outra sessão vira colisão de diff sem ninguém ter mudado lógica.
  Estão fora do padrão hoje — conferido — e saem quando aquela frente quiser.

### O guarda que a formatação quebrou

`guarda-usemobile` exigia `window.innerWidth` e a palavra `useState` **na mesma linha**.
Ao formatar `src/hooks`, o prettier quebrou as duas linhas em duas cada: o código não
mudou e o guarda acusou. Consertado ANTES, em commit próprio, para o commit de formatação
seguir sendo só formatação — agora casa sobre o corpo sem comentário e com o espaço
achatado, e continua exigindo as duas leituras nomeadamente (plantadas as duas).

É a mesma armadilha de `guarda-cores` na véspera: **guarda que casa texto cru fica refém
da formatação**. Os dois passaram a olhar o código normalizado.

### A lista agora é fechada

`prettierignore.test.ts` afirmava só que `src/design-system` estava lá; passa a afirmar o
conjunto inteiro. A dívida levou treze telas para ser paga, e acrescentar uma linha é o
caminho mais curto quando o `format` toca num arquivo que alguém não queria ver mexido —
entrada nova agora derruba o teste, e quem quiser acrescentar tem de dizer por quê.

## Estado em 16/09/2026 (noite) — o header no desenho do HelpHS

Branch `fase-5-header`, três commits sobre `7e9a6495`. Suíte em **1911 testes / 150
arquivos**; lint 24; `tsc` limpo.

Pedido do Erick: deixar o header igual ao do HelpHS — o interruptor de tema e o "Sair"
dentro do menu que a foto do usuário abre, e o botão de menu na ponta esquerda, junto da
sidebar. Sem "Meu perfil" (não há tela de perfil) e sem o sino de notificações (não há
serviço de notificações no DataCoreHS).

| Commit     | O quê                                                                                                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0f9f9fcc` | `AppShell` ganha `topbarStart`. A topbar tinha um lugar só para conteúdo do app — `topbarActions`, à direita —, e o botão de menu pertence ao lado da sidebar que ele recolhe.                                                                                                                          |
| `7354c1fb` | `Switch` passa a aceitar rótulo como nó do React e `className` no invólucro. Sem isso a linha "🌙 Modo escuro" não teria como pôr o ícone dentro do `<label>` (clicar nele não alternaria) nem virar a ordem para o interruptor ficar na ponta direita — e `style={{}}` o guarda dos primitivos proíbe. |
| `48a14758` | `Header.tsx` vira `BotaoDeMenu.tsx` (só o botão, no `topbarStart`) e nasce `MenuDoUsuario.tsx`: a foto é o gatilho de um painel com nome, papel, "Modo escuro" e "Sair".                                                                                                                                |

### O que o menu promete, e o que não promete

Fecha no clique fora (`useCliqueFora`, o mesmo dos multiselects) e no `Escape`, e nos dois
casos **devolve o foco à foto** — fechar sem devolver deixa quem navega por teclado no
começo do documento, porque o elemento focado saiu da árvore e o navegador recua para o
`<body>`.

**Não é `role="menu"`**, de propósito: esse papel promete navegação por seta entre
`menuitem`s, que não existe aqui, e o interruptor de tema não é item de menu. O painel é
um `<div>` ligado ao gatilho por `aria-controls`, e o "Sair" continua sendo anunciado como
o botão que é. Também não prende o `Tab` dentro dele: prender muda mais do que o pedido, e
um painel que não prende continua utilizável — um que prende e erra, não.

### Um teste que mudou de dono

O "Sair" tinha um teste de que o nome acessível sobrevivia ao texto sumir no celular —
ele era ícone puro abaixo de `sm`. Agora o "Sair" vive no painel, sempre com texto, e quem
esconde conteúdo em tela pequena é o gatilho (nome e papel somem, fica a foto). O teste
foi para lá, com a mesma pergunta.

### Conferência no navegador (16/09)

Claro e escuro, em 1440px: hambúrguer na ponta esquerda, painel abrindo na foto,
alternando o tema pelo interruptor de dentro dele e fechando no `Escape` com o foco de
volta na foto. Em 400px: só a foto no gatilho, e o painel cabendo na tela (160–384 de 400).

### Detalhe para quem vier depois

A prop `user` do `AppShell` **deixou de ser usada por este app** — ela desenha nome, papel
e avatar como texto fixo, e passar junto duplicaria o bloco. Continua no primitivo para
quem quiser o desenho simples.

## Estado em 16/09/2026 — o preset "Mês passado"

Pedido do Erick: mais uma opção no "Período Rápido", que pegasse **apenas o mês passado**.

### Por que ela faltava

As seis opções davam duas leituras do presente ("mês atual", "ano atual") e duas janelas
móveis ("7 dias", "30 dias"), e nenhuma do **mês fechado**. Quem olha o resultado de julho
no dia 5 de agosto caía em "Últimos 30 dias", que arrasta os primeiros dias de agosto para
dentro da conta, ou digitava as duas datas na mão toda vez.

### O que a lista compartilhada provou

O menu mora em `src/lib/periodo.ts` desde 04/09, e a barra de filtros ainda é um
componente por tela. Acrescentar a opção na lista foi **uma linha**, e a prova de que ela
chega em todo lugar veio do vermelho: atualizar a asserção da lista derrubou os cinco
testes de tela de uma vez — Clientes, Produtos, Serviços, Vendas e Vendedores —, sem uma
edição nos seis `FiltrosDe*.tsx`. É a ponte de paleta ao contrário: dessa vez a coisa
compartilhada pagou.

Contas não afirma a lista (nasceu antes dela), então ganhou teste próprio nas gêmeas.

### As duas armadilhas da conta, cada uma com plantação

A conta parte do **dia 1 do mês corrente**, nunca de hoje:

1. **O dia 31 escorrega.** Recuar um mês a partir de 31 de março dá 31 de fevereiro, que o
   JavaScript normaliza para 3 de março — e "mês passado" devolveria março de novo.
2. **O índice cru estoura na virada do ano.** `periodoDoMes(ano, mes - 1)` em janeiro vira
   o índice −1, e o rótulo sai `2026-00-01`: uma data que o `<input type="date">` recusa em
   silêncio, deixando o campo vazio sem dizer por quê.

Partindo do dia 1, o construtor `new Date(ano, mes - 1, 1)` resolve as duas. Cada
plantação foi rodada e derrubou exatamente o teste que a descreve, e mais nenhum.

E o preset anda com o **dia local**, como os outros cinco: às 23h de 31/08 em Brasília,
"mês passado" é julho, não agosto.

### Conferência no navegador (16/09)

Vendas (claro) e Contas a receber (escuro), contra a API de produção, com o relógio em
16/09: as sete opções no menu, e "Mês passado" escrevendo 01/08 a 31/08 nos dois campos,
com os números recarregando (64 vendas, R$ 883.569,30 em Vendas; a Evolução Mensal de
Contas com a barra única de agosto).

⚠️ **O Vite serviu um transform velho** de `periodo.ts` durante a conferência: o disco e o
commit já tinham a opção, e o navegador mostrava seis. Um `touch` no arquivo reinvalidou.
Se a tela discordar do arquivo, desconfiar do cache antes de desconfiar do código.

## Estado em 22/09/2026 — dois consertos, uma pergunta respondida e o roadmap

### Os consertos

- **A pesquisa de Estoque derrubava a tela** (`54aca90f`). Seis produtos de `tiny.estoque`
  (códigos 374 a 380) estão sem unidade, e a API devolve `null` apesar do tipo dizer
  `string`. A busca fazia `p.unidade.toLowerCase()`: qualquer termo que não batesse com o
  nome nem com o código de um deles lançava `TypeError`. Conferido no navegador contra
  produção: "sensor" acha 14, "bateria" mostra a BATERIA DE LÍTIO com a unidade vazia.
- **Quatro testes de Importações falhavam em `TZ=UTC`** (`a0b9439a`). A tela mostra o
  horário da VPS no fuso de quem olha, e os testes cravavam o de Brasília. Agora
  `src/test/fuso.ts` dá `noFuso({ brasilia, utc })`, com os dois esperados escritos, e lança
  em qualquer outro fuso. Plantado: horário cru falha em São Paulo; `hora - 3` falha em UTC.

### A pergunta da API, respondida

O item 1 de "Em aberto" (31/08) — o `PUT /users/{id}` aceita troca de senha sem token? — foi
respondido pelo `/openapi.json` público do authapi, sem nenhuma escrita: `PUT /users/{id}`
(com `password` e `role_name`), `POST /register` (com `role_name`) e `GET /users/{id}` não
declaram token; o GET foi testado e responde 200 sem ele. O conserto é no backend do
authapi, cujo código não está clonado. **Decisão do Erick: trabalho à parte.**

### Decisões de produto (22/09)

| Achado                                                 | Decisão                                                                    |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| PDF de Clientes e Serviços corta em 30                 | Mantém 30, e diz: "Os 30 maiores de N" e quantos ficaram de fora           |
| "Ticket Médio/Cliente" é média das médias              | Vira o ticket da carteira (valor ÷ notas), rótulo "Ticket médio por nota"  |
| Último ponto do comparativo de Vendas é período aberto | Compara o mesmo intervalo do ano anterior, com "até DD/MM" no rótulo       |
| "Principais" de Estoque cravada                        | Fica no código, com o nome ao lado de cada código e teste se sumir do Tiny |
| `CentralButton` pulsa sem parar                        | Pulsa ao abrir e para; com `prefers-reduced-motion`, não pulsa             |
| Exportar com a tabela vazia                            | Desabilitado em todas as telas, como Estoque                               |

### O roadmap

Em ordem: (1) as seis decisões acima; (2) defeitos sem decisão — formatador abreviado com
ponto junto com o "Produto Top" sem casas fixas, a borda dos 90 dias de Clientes, o
"(null)" possível no Produto Top de Estoque, o empate instável de Produtos, o confete sem
`prefers-reduced-motion`, `aria-sort` nas tabelas que faltam; (3) dívida técnica — os 15
`set-state-in-effect`, o checkpoint humano de permissões da Fase 2, o contraste do erro do
Login, o `README.md`. Dependem de outra frente: data invertida no Comercial
(`useComercial.ts`), cidade vazia nas NFS-e (`tiny-integrador`), as três contas com emissão
depois do vencimento e os seis produtos sem unidade (dado do Tiny).

Fechados desde 31/08 e fora da lista: dívida do prettier, `localeCompare` sem locale,
`converterParaNumero` duplicado, `MultiSelect` como primitivo, os dois modais de observação.
