# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

DataCoreHS — painel React + TypeScript sobre as notas fiscais do Tiny ERP. Código,
comentários, interface e mensagem de commit são em **português do Brasil**.

## Comandos

```bash
npm run dev            # Vite na porta 5174; /api é proxy para tinyapi (produção)
npm run build          # tsc implícito via vite build → dist/
npm test               # vitest run (jsdom, setup em src/test/setup.ts)
npm run test:watch
npm run lint           # eslint . — ver baseline abaixo
npm run format         # prettier --write . (respeita .prettierignore; ver "Dívida do prettier")

npx vitest run src/pages/ContasPagar.test.tsx          # um arquivo
npx vitest run -t "nome do teste"                       # um teste
TZ=UTC npm test && TZ=America/Sao_Paulo npm test        # a suíte tem que passar nos dois
```

Baselines em 22/09/2026: **2027 testes / 160 arquivos**, verdes nos dois fusos; lint
**9 avisos, 0 erros** (era 143 em 31/08 e 24 em 16/09 — os 15 `set-state-in-effect`
acabaram em 22/09); `tsc` limpo; `prettier --check .` limpo. Nada pode regredir; o lint
não pode subir.

`.env` define `VITE_API_URL` (auth) e `VITE_NOTAS_URL` (notas). Sem elas o app aponta
para **produção** — não dirigir modal de exclusão nem escrita contra dado real.

## Arquitetura

**Dois backends, um interceptor.** `services/http.ts` expõe `criarHttp(baseURL)`, que
cria a instância axios e injeta o `Bearer` do `localStorage`. `services/api.ts` (auth) e
`services/notasapi.ts` (notas) têm cada um a sua instância. `services/` é a **única**
porta de rede — nada fora dela importa `axios`.

**Permissão é matriz declarativa.** `src/auth/permissoes.ts` é fonte única: `PERMISSOES`
mapeia rota → regra (`publico` | `autenticado` | `papeis` | `usuarios`). `RequirePermissao`
e a `Sidebar` leem a mesma matriz — antes eram duas fontes e discordavam. Rota nova sem
entrada na matriz é **negada**. `/financeiro` e `/locacao` liberam por **id de usuário
nomeado** (1, 3, 4) por decisão da chefia: não trocar por papel. `/estoque` é livre de
propósito.

**Providers moram nas rotas, não no `main.tsx`.** `router.tsx` monta cada context no menor
ramo que só contém consumidores dele; quando dois conjuntos se cruzam (`ServicosProvider`,
`ContasPagarProvider`, `ContasReceberProvider`), o provider aparece em dois pontos em vez
de subir. `main.tsx` guarda só tema, sessão e router. Todas as páginas são `React.lazy`
com `Suspense` — sem isso o build vira um chunk de 1,7 MB.

**Conta pura fora do componente.** Tela migrada vira casca de ~70 linhas em
`pages/<tela>/`: cabeçalho, filtros, KPIs, gráficos, tabela em componentes, e a lógica em
um `.ts` sem React (`pages/contas/contas.ts`, `pages/dashboard/metaTrimestral.ts`).

**As gêmeas.** ContasReceber e ContasPagar são a mesma tela: `pages/contas/TelaDeContas.tsx`
parametrizada por `ConfiguracaoDeContas`. Só entra ali divergência de **domínio** — o
`DialetoDeContas` (`situacoesQuitadas`, `campoDaEmissao`, `chaveQuitado`). O que divergia
por descuido virou código igual.

**`src/lib/` resolve os dois erros recorrentes.** `datas.ts` converte data de calendário
sem passar por `new Date` (`YYYY-MM-DD` em UTC volta um dia); `dinheiro.ts` lê o valor do
Tiny nos dois formatos (`1.234,56` e `1234.56`) sem transformar `1.234` em R$ 1,23. Usar
sempre — as cópias com o bug acabaram.

⚠️ O defeito de `datas.ts` **só existe a oeste de Greenwich**: em `TZ=UTC` o teste que o
trava passa com o defeito presente. É por isso que a suíte roda nos dois fusos, e o teste
tem de construir o instante em hora local, numa data cuja virada atravesse o fuso — meio-dia
não testa nada.

## Design system — as regras que os testes cobram

`src/design-system/tokens/` e `styles.css` são **cópia verbatim** do Health & Safety Design
System (Claude Design). **Nunca editar** — mudança de token acontece lá e desce por sync;
por isso a pasta está no `.prettierignore` e há teste travando isso. Ver `ORIGEM.md`.

Os primitivos em `ui/{core,data,feedback,forms,navigation}` são port nosso, exportados pelos
barrels (`import { Button, Alert } from "../design-system/ui"`, caminho relativo — não há
`paths` no `tsconfig.json`, e `@/` passa no Vite mas quebra o `tsc`).

`tailwind.config.js` (v3.4.17, CommonJS — **não migrar para v4**) tem duas camadas:

1. **classes de token** (`bg-surface`, `text-conteudo-muted`, `text-action`, `bg-tint-*`,
   `z-dropdown|overlay|tooltip|toast`) que saem de `var(--...)` e reagem ao tema. É o que
   se escreve hoje.
2. **ponte de paleta** (`blue-*`, `slate-700/800/900`) — hexadecimal literal, **temporária**,
   andaime das telas ainda não migradas. Some quando a última migrar.

Sete guardas em `src/test/guarda-*.test.ts` falham a suíte se:

- houver hexadecimal cravado (`[#1a71a8]`) em qualquer `.ts/.tsx/.css`/`index.html`;
- uma classe de token levar modificador de opacidade (`bg-surface/40`) — o Tailwind não
  aplica alfa sobre `var()` com hex e a regra simplesmente não é gerada;
- um arquivo **fora** de `PENDENTES_FASE_3` usar paleta crua (`text-gray-500`) — ou um
  arquivo **dentro** da lista já estiver limpo. A lista **só encolhe**: apagar a linha é
  parte de migrar a tela, e nunca se acrescenta linha para calar o guarda;
- um primitivo usar `style={{}}` para aparência (só `width`/`height` vindos de dado),
  fizer hover por estado de React (exceção documentada: `Tooltip.tsx`, que vive em portal),
  usar a ponte de paleta, ou for interativo sem `focus-visible:ring-2`;
- um ícone vier de servidor remoto (é `lucide-react`).

Outros travas: `dependencias.test.ts` (fica no Tailwind 3), `fonte.test.ts`,
`prettierignore.test.ts`, `tailwind-config.test.ts`.

## Fase 3 — a receita por tela (concluída em 15/09/2026)

Feitas: Dashboard, Locação, Usuários, ContasReceber+ContasPagar, Financeiro, Produtos,
Serviços, Vendedores, Estoque, Clientes e Vendas — as doze. `PENDENTES_FASE_3` e
`PENDENTES_UTC` estão vazias. **A ponte de paleta foi deletada em 16/09/2026**: `blue-*`
e `slate-*` voltaram a ser paleta crua do Tailwind, e o guarda de cor as acusa em
qualquer arquivo do `src`.

⚠️ **Produtos e Serviços foram reaplicados em 10/09** sobre uma reescrita da fonte de
dados feita por outra frente de trabalho: as telas leem resumos agregados do Postgres
(`pages/comercial/useComercial.ts`, `pages/servicos/useServicos.ts`), e Serviços pagina no
servidor. **Esses arquivos não são nossos — não editar.** Ver "Estado em 10/09/2026" na
spec, que traz a colisão inteira e as lições.

1. **Teste de caracterização antes de mover uma linha**, observando a tela renderizada —
   nunca exportando função só para testar.
2. **Provar que o teste enxerga**: plantar a quebra, ver falhar, reverter. Sem essa prova
   a task não está entregue.
3. Quebrar em componentes por responsabilidade, com a conta pura em arquivo próprio.
4. Zerar `dark:` e paleta crua; tirar a tela de `PENDENTES_FASE_3`.
5. Responder o checklist de 10 itens **um a um** (spec, "Checklist de tela migrada").
6. Conferir no navegador nos dois temas, incluindo vazio, carregando e erro.
7. Tirar a tela do `.prettierignore` e formatar, **em commit próprio**. Até lá,
   `prettier --check` nos arquivos dela responde "formatado" — eles estão ignorados —,
   e **não formatar** arquivo dela antes: o diff do conserto some debaixo da formatação.

Quando a tela tem gêmea ou muita duplicação: **unificar e corrigir são passos separados**.
Unificar tem que passar nos testes de caracterização sem uma edição; só depois os defeitos,
cada um com plantação. Junto, não dá para saber qual dos dois quebrou.

Padrões herdados: `Modal` com prop `erro`, montado só quando aberto · `Pagination` devolve
`null` com zero resultados (pressupõe `TableEmpty` no consumidor) · `ChartEmpty` com
`height` obrigatório · **falha de rede é `Alert variant="danger"` no fluxo da página, não
Toast** (toast some em 4 s e deixa a pessoa diante de tela vazia; toast é para confirmar
ação que a pessoa acabou de tomar).

## Convenções

- Interface em português, sentence case, sem emoji; frase de erro completa com ponto final.
- `focus-visible` com anel de 2px, nunca `focus`.
- Commits em português, conventional commits, **sem acento** na mensagem
  (`fix(contas): ordenar volta para a primeira pagina`). Uma tela = uma branch = um
  checkpoint humano. **Não fazer `push` sem o Erick pedir** — mas segurar não é neutro:
  79 commits represados colidiram com outra frente em 09/09 e custaram duas migrações
  refeitas. Passando de algumas dezenas à frente do `origin/main`, **levantar o assunto**
  em vez de acumular em silêncio. Em 10/09 o `origin/main` ficou em dia.
- Comentário aqui explica **por que**, com o defeito concreto que a decisão evitou. É o
  estilo do repo — seguir.

## Documentação

- `docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md` — o documento que
  governa. A seção "Estado em 31/08/2026" tem o progresso e 12 itens em aberto.
- `docs/superpowers/plans/` — planos das fases 0, 1 e 2 e o adendo dos padrões de tela.
- `docs/superpowers/2026-08-31-contas-achados.md` — os 23 achados das gêmeas.
- `docs/DataCoreHS.html` — mockup do design, fora do versionamento e sem decisão ainda.
- `README.md` está desatualizado (descreve a estrutura anterior ao design system).

## Vizinhos

- O backend das duas URLs (`VITE_API_URL` = `<api>/auth`, `VITE_NOTAS_URL` = `<api>`)
  mora em `../backend/`.
- Produção é o serviço `datacore-sistema` do EasyPanel, que builda `frontend/`.
