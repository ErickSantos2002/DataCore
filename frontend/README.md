# DataCoreHS

Painel da Health & Safety sobre as notas fiscais do Tiny ERP: faturamento, meta do
trimestre, clientes, produtos, serviços, vendedores, estoque, contas a pagar e a receber,
locação e o centro de custo. É por onde a empresa olha o próprio número.

Front em React 19 + TypeScript, com Vite e Tailwind 3. Não fala com banco: consome duas
APIs próprias, a de autenticação (`authapi`) e a do Tiny (`tinyapi`). Código, interface e
commits são em português do Brasil.

## Como rodar

Requer Node 20 (o mesmo da imagem Docker).

```bash
npm install
npm run dev        # Vite na porta 5174
```

As duas APIs vêm de variáveis de ambiente (modelo em `.env.example`):

| Variável         | Para quê                                 | Sem ela                                    |
| ---------------- | ---------------------------------------- | ------------------------------------------ |
| `VITE_API_URL`   | autenticação (`/login`, `/me`, `/users`) | aponta para `authapi.healthsafetytech.com` |
| `VITE_NOTAS_URL` | notas, estoque, contas, financeiro       | aponta para `tinyapi.healthsafetytech.com` |

⚠️ **Sem as variáveis o app aponta para produção.** Consultar é seguro; o que grava é
Usuários, Configurações, o Centro de Custo e o tipo da nota em Vendedores — não use contra
dado real.

O `vite.config.ts` tem um proxy `/api` para o `tinyapi`. Com `VITE_NOTAS_URL=/api` as
chamadas de notas saem da mesma origem e o CORS não entra no caminho — útil quando a
porta 5174 está ocupada, porque o `authapi` e o `tinyapi` só aceitam origens conhecidas:

```bash
VITE_API_URL=https://authapi.healthsafetytech.com VITE_NOTAS_URL=/api \
  npm run dev -- --port 5173 --strictPort
```

## Testes e verificação

```bash
npm test                                         # vitest (jsdom)
TZ=UTC npm test && TZ=America/Sao_Paulo npm test # a suíte tem de passar nos dois fusos
npm run lint                                     # eslint
npx prettier --check .                           # formatação
npx tsc --noEmit                                 # tipos
npm run build                                    # dist/
```

**Os dois fusos não são enfeite.** Os defeitos de data deste projeto só aparecem a oeste de
Greenwich: `new Date("2026-07-10")` é meia-noite em UTC, que em Brasília ainda é dia 9. Um
teste de data que roda só em UTC passa com o defeito presente.

Um arquivo ou um teste:

```bash
npx vitest run src/pages/ContasPagar.test.tsx
npx vitest run -t "nome do teste"
```

## Arquitetura

- **`services/` é a única porta de rede.** `criarHttp(baseURL)` monta a instância axios e
  injeta o `Bearer`; `api.ts` (auth) e `notasapi.ts` (notas) têm cada um a sua. Nada fora
  de `services/` importa axios.
- **Permissão é uma matriz declarativa**, em `src/auth/permissoes.ts`. `RequirePermissao`
  e a `Sidebar` leem a mesma matriz. Rota sem entrada é negada.
- **Os providers moram nas rotas** (`router.tsx`), no menor ramo que só contém quem os usa;
  `main.tsx` guarda só tema, sessão e router. Toda página é `React.lazy`.
- **Tela é casca; conta é arquivo puro.** Cada tela em `pages/<tela>/` separa cabeçalho,
  filtros, KPIs, gráficos e tabela em componentes, e a lógica num `.ts` sem React
  (`clientes.ts`, `vendas.ts`, `estoque.ts`…), testável sem montar nada.
- **Contas a Receber e a Pagar são a mesma tela**, `pages/contas/TelaDeContas.tsx`,
  parametrizada. Só entra ali divergência de domínio.
- **`src/lib/` guarda o que errava em toda parte:** `datas.ts` (data de calendário sem
  `new Date`), `dinheiro.ts` (o valor do Tiny nos formatos `1.234,56` e `1234.56`, e o
  abreviado dos gráficos, "R$ 2,5 mi"), `periodo.ts` (os presets de período), `pdf.ts`
  (o corte dos relatórios), `ariaSort.ts`.
- **`src/hooks/`**: `usePeriodo` (preset e datas trocam no mesmo clique),
  `usePaginacao` (lista em memória) e `usePaginaDoRecorte` (tabela paginada no servidor) —
  os dois últimos voltam para a página 1 quando o recorte muda, ajustando durante o render.

## Design system

`src/design-system/tokens/` e `styles.css` são **cópia verbatim** do Health & Safety Design
System — não se edita aqui; mudança de token vem por sync (ver `ORIGEM.md`). Os primitivos
em `ui/{core,data,feedback,forms,navigation}` são port nosso, pelos barrels:

```ts
import { Button, Modal } from "../design-system/ui"; // caminho relativo: não há alias @/
```

Escreve-se com as classes de token do `tailwind.config.js` (`bg-surface`,
`text-conteudo-muted`, `text-action`, `bg-tint-*`). Os guardas em
`src/test/guarda-*.test.ts` derrubam a suíte se aparecer hexadecimal cravado, paleta crua
do Tailwind (`text-gray-500`), classe de token com opacidade (`bg-surface/40`), primitivo
com aparência em `style={{}}` ou interativo sem `focus-visible:ring-2`, ou ícone remoto.
O Tailwind fica na 3 (`dependencias.test.ts`).

## Telas e quem acessa

| Rota                                               | Tela                              | Acesso                                                  |
| -------------------------------------------------- | --------------------------------- | ------------------------------------------------------- |
| `/inicio`, `/dashboard`                            | Início e meta do trimestre        | quem está logado                                        |
| `/estoque`                                         | Estoque e solicitação de compras  | quem está logado                                        |
| `/clientes`, `/vendas`, `/produtos`, `/vendedores` | Comercial                         | admin, vendas, financeiro                               |
| `/servicos`                                        | NFS-e                             | admin, serviços, financeiro                             |
| `/contas-receber`, `/contas-pagar`                 | Contas                            | admin, financeiro                                       |
| `/financeiro`, `/locacao`                          | Gerenciamento financeiro, locação | usuários nomeados (ids 1, 3 e 4), por decisão da chefia |
| `/usuarios`, `/configuracoes`, `/importacoes`      | Administração                     | admin                                                   |

A fonte é `src/auth/permissoes.ts`; esta tabela é só o retrato.

## Deploy

`dockerfile` em duas etapas: build com Node 20 e a pasta `dist/` servida por Nginx
(`traefik/nginx.conf`). As variáveis `VITE_*` entram no **build**, não em tempo de
execução — trocar de API é gerar a imagem de novo.

## Documentação

- `docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md` — o documento que
  governa: decisões, o estado de cada fase e o que ficou em aberto.
- `docs/superpowers/plans/` — os planos das fases 0 a 2 e os padrões de tela.
- `docs/superpowers/2026-08-31-contas-achados.md` — os 23 achados de Contas.
- `CLAUDE.md` — as regras de trabalho do repositório (local, fora do versionamento).

Software interno da Health & Safety.
