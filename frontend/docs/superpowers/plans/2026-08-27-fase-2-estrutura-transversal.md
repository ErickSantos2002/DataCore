# Fase 2 — Estrutura transversal · Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development`
> para executar tarefa a tarefa. Os passos usam caixas (`- [x]`) para acompanhamento.

**Objetivo:** tornar o controle de acesso uma fonte única e testada, montar cada context
só no ramo de rota que o usa, dividir o pacote por rota e tipar a camada de rede.

**Arquitetura:** uma matriz declarativa `rota → papéis` passa a ser lida tanto pelo
guarda de rota quanto pelo menu, eliminando a possibilidade de os dois discordarem.
As rotas viram `lazy` e cada ramo carrega os próprios providers.

**Stack:** React 19 · react-router-dom · TypeScript 5.8 · Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md`

---

## Restrições globais

- Tailwind **v3.4.17**, `tailwind.config.js` em CommonJS. Não migrar.
- `src/design-system/tokens/` e `src/design-system/styles.css` são **cópia verbatim**
  do Design System. Nunca editar.
- Os cinco testes de guarda da Fase 1 continuam valendo e não podem ser afrouxados.
- Lint: baseline **190 problemas**. Não pode subir.
- Suíte: baseline **184 testes / 47 arquivos**. Nada pode regredir.
- Nunca `push`. Nunca commit na `main` — o trabalho sai em `ds/fase-2-estrutura`.

---

## O achado que redefine esta fase

O levantamento do `router.tsx`, `main.tsx` e `services/` encontrou coisas que o
spec não conhecia. Elas mudam a ordem das tarefas.

**1. `RequireFinanceiro` libera por usuário nomeado, e isso é intencional.**
`router.tsx:91` — `![1, 3, 4].includes(user.id)`. Governa `/financeiro` e
`/locacao`.

Levantei isso como defeito e **estava errado**. O Erick confirmou: essas duas
telas são para aquelas pessoas especificamente, não para quem tem papel
`financeiro`, e a regra veio da chefia. **Não é legado, não é para ser
"consertado".** Um usuário com papel `financeiro` que não esteja na lista deve
continuar barrado — é o comportamento correto.

O que muda é só a forma de escrever: hoje a regra está enterrada dentro de um
componente de guarda, sem uma linha dizendo por que aqueles números existem.
Na matriz ela vira explícita e documentada. O risco real que sobra é o de
reaproveitamento de id — se o id 3 for atribuído a outra pessoa um dia, ela
herda o acesso. Isso não bloqueia esta fase; fica anotado como observação
operacional para o Erick, não como tarefa.

**2. `RequireVendedores` é idêntico a `RequireVendas`.**
Linhas 43-53 e 67-77: mesma condição, `admin | vendas | financeiro`. Duplicação morta.

**3. `/estoque` não tem guarda de papel, e a rota está certa.** O Erick confirmou:
estoque é página livre, a empresa inteira pode ver. **Quem está errado é o menu**,
que a coloca sob "Administração" e sugere uma restrição que não existe.

A correção, portanto, não é fechar a rota — é mover o item de grupo. Ele vai para
**Principal**, junto de Início e Meta do trimestre. Isso faz a estrutura do menu
dizer a verdade: Principal é o que todo mundo vê; Comercial, Financeiro e
Administração são áreas restritas.

**4. `updateUserPassword` não manda o token.**
`services/api.ts:20` usa `axios.put` cru em vez da instância `authApi`, então o
interceptor não roda e a requisição sai **sem cabeçalho `Authorization`**. Ou a
troca de senha está quebrada, ou o endpoint aceita troca de senha sem
autenticação. As duas hipóteses são graves e precisam ser checadas contra a API.

**5. `ClientesContext.tsx` e `VendedoresContext.tsx` são código morto.**
Exportam provider e hook, e os únicos arquivos que os mencionam são eles mesmos.
A pirâmide do `main.tsx` tem **10 providers**, não 12.

**6. `services/` já é a única porta de rede.** Zero arquivos fora de `services/`
importam `axios`. A camada não precisa ser criada, só tipada.

---

## Decisão de método: preservar antes de corrigir

**Ruling:** a reestruturação reproduz o comportamento de acesso atual **exatamente**,
incluindo o portão por id `[1,3,4]` e o `/estoque` aberto. Corrigir as divergências
é trabalho separado, depois, com decisão do Erick por escrito.

**Custo de errar:** misturar "reorganizar o controle de acesso" com "mudar quem
enxerga o quê" num passo só produz um bloqueio silencioso em produção que ninguém
consegue atribuir a uma linha. Se o refactor preserva e um teste depois muda, dá
para apontar o commit que mudou o acesso de cada papel.

Por isso a Task 1 é um teste de caracterização do acesso **antes** de existir
qualquer matriz.

---

## Estrutura de arquivos

| Arquivo                         | Responsabilidade                                                    |
| ------------------------------- | ------------------------------------------------------------------- |
| `src/auth/permissoes.ts`        | A matriz `rota → papéis` e as funções que a consultam. Fonte única. |
| `src/auth/permissoes.test.ts`   | A matriz contra cada papel — a lógica mais perigosa do refactor.    |
| `src/auth/RequirePermissao.tsx` | O guarda parametrizado que substitui os seis.                       |
| `src/router.tsx`                | Só rotas. Sem definição de guarda, sem import no meio do arquivo.   |
| `src/components/Sidebar.tsx`    | Deriva o menu da matriz; deixa de ter predicado próprio.            |
| `src/main.tsx`                  | Só `ThemeProvider`, `AuthProvider`, `BrowserRouter`.                |
| `src/services/http.ts`          | Fábrica de instância `axios` com o interceptor compartilhado.       |

---

## Task 1 — Rede de segurança: caracterizar o acesso atual

Nada muda de comportamento aqui. Esta task existe para que as próximas possam
mudar estrutura com prova de que o acesso continuou igual.

**Arquivos:** criar `src/auth/acesso-atual.test.tsx`

- [x] **Passo 1: levantar a tabela real, do código, não da memória**

Ler `src/router.tsx` inteiro e montar a tabela de quem entra em cada rota. O
resultado esperado, já conferido — confirme antes de usar:

| Rota              | Guarda               | Quem entra                  |
| ----------------- | -------------------- | --------------------------- |
| `/login`          | nenhum               | todos                       |
| `/inicio`         | `ProtectedRoute`     | autenticado                 |
| `/dashboard`      | `ProtectedRoute`     | autenticado                 |
| `/estoque`        | `ProtectedRoute`     | autenticado                 |
| `/clientes`       | `RequireVendas`      | admin, vendas, financeiro   |
| `/vendas`         | `RequireVendas`      | admin, vendas, financeiro   |
| `/produtos`       | `RequireVendas`      | admin, vendas, financeiro   |
| `/vendedores`     | `RequireVendedores`  | admin, vendas, financeiro   |
| `/servicos`       | `RequireServicos`    | admin, servicos, financeiro |
| `/contas-pagar`   | `RequireContasPagar` | admin, financeiro           |
| `/contas-receber` | `RequireContasPagar` | admin, financeiro           |
| `/usuarios`       | `RequireAdmin`       | admin                       |
| `/configuracoes`  | `RequireAdmin`       | admin                       |
| `/financeiro`     | `RequireFinanceiro`  | **id ∈ {1,3,4}**            |
| `/locacao`        | `RequireFinanceiro`  | **id ∈ {1,3,4}**            |

- [x] **Passo 2: escrever o teste que percorre a tabela**

Um teste por par (papel × rota), renderizando a rota com um usuário falso no
`AuthContext` e afirmando se aparece a tela ou o bloqueio. Cubra os papéis
`admin`, `vendas`, `servicos`, `financeiro` e um papel desconhecido, mais o
caso `user = null` e o caso `loading = true`.

Não teste "o componente `RequireVendas` retorna X" — teste "o papel `servicos`
que abre `/vendas` vê bloqueio". O teste tem de sobreviver ao guarda sumir.

- [x] **Passo 3: rodar e ver passar**

`npx vitest run src/auth/acesso-atual.test.tsx`
Todos passam — é caracterização do que já existe.

- [x] **Passo 4: provar que o teste enxerga**

Inverta uma condição de um guarda no `router.tsx` (troque um `!==` por `===`),
rode de novo, veja falhar, e reverta. Um teste de caracterização que não falha
quando o comportamento muda não é rede de segurança nenhuma.

- [x] **Passo 5: commit**

```bash
git add src/auth/acesso-atual.test.tsx
git commit -m "test(auth): caracteriza o controle de acesso atual antes do refactor"
```

---

## Task 2 — A matriz de permissões

**Arquivos:** criar `src/auth/permissoes.ts` e `src/auth/permissoes.test.ts`

**Interfaces produzidas** — as próximas tasks dependem destes nomes:

```ts
export type Papel = "admin" | "vendas" | "servicos" | "financeiro";
export type Regra =
  | { tipo: "publico" }
  | { tipo: "autenticado" }
  | { tipo: "papeis"; papeis: readonly Papel[] }
  | { tipo: "usuarios"; ids: readonly number[] }; // liberação nominal — ver abaixo

export const PERMISSOES: Record<string, Regra>;
export function podeAcessar(rota: string, user: Usuario | null): boolean;
export function rotasVisiveis(user: Usuario | null): string[];
```

- [x] **Passo 1: escrever o teste da matriz**

O mesmo conjunto de pares papel × rota da Task 1, agora contra `podeAcessar`
direto, sem renderizar. Inclua explicitamente: `podeAcessar("/financeiro", {id: 2,
role: "financeiro"})` é `false` (o portão por id manda), e
`podeAcessar("/estoque", {role: "vendas"})` é `true`.

- [x] **Passo 2: rodar e ver falhar** — `permissoes.ts` ainda não existe.

- [x] **Passo 3: escrever a matriz** reproduzindo a tabela da Task 1 sem desvio.

O tipo `{ tipo: "usuarios" }` representa uma **regra de negócio deliberada**:
`/financeiro` e `/locacao` são liberadas para pessoas nomeadas, por decisão da
chefia, e não para o papel `financeiro`. Comente exatamente isso na definição —
sem essa frase, o próximo a ler o arquivo vai "consertar" a regra achando que é
um resquício, e vai abrir duas telas para quem não deve vê-las.

- [x] **Passo 4: rodar e ver passar.**

- [x] **Passo 5: commit**

```bash
git commit -m "feat(auth): matriz rota->papeis como fonte unica de permissao"
```

---

## Task 3 — O guarda parametrizado

**Arquivos:** criar `src/auth/RequirePermissao.tsx`; modificar `src/router.tsx`

- [x] **Passo 1** — teste: `RequirePermissao` renderiza filho quando `podeAcessar`
      é verdadeiro, `<Bloqueio />` quando falso, e o estado de carregando enquanto
      `loading`. O estado de carregando usa primitivo do Design System, não
      `text-gray-500` cru — os guardas atuais violam o guarda de cores da Fase 1.
- [x] **Passo 2** — rodar, ver falhar.
- [x] **Passo 3** — implementar.
- [x] **Passo 4** — trocar os seis guardas no `router.tsx` pelo novo, apagar as
      definições, e subir o `import Bloqueio` da linha 41 para o topo.
- [x] **Passo 5** — rodar **o teste da Task 1**. É ele que prova que a troca não
      mexeu em acesso. Se algum par mudou, o refactor está errado; não ajuste o
      teste para passar.
- [x] **Passo 6: commit**

---

## Task 4 — O menu deriva da matriz

**Arquivos:** modificar `src/components/Sidebar.tsx`

Hoje a Sidebar decide o menu com predicados próprios (`idsFinanceiroLegado`,
`podeContas`, `ehAdmin`) — a segunda fonte de verdade que esta fase existe para
eliminar.

- [x] **Passo 1** — teste do invariante, que é o coração da fase: **para todo papel,
      todo item exibido no menu aponta para uma rota que aquele papel consegue
      abrir.** Percorra os papéis e cruze `rotasVisiveis` com o menu renderizado.
- [x] **Passo 2** — rodar e registrar o resultado no relatório. Se falhar, diga em
      qual par papel × item, e pare antes de mexer: significa que existe uma
      divergência que ninguém mapeou ainda.
- [x] **Passo 3** — trocar os predicados próprios da Sidebar
      (`idsFinanceiroLegado`, `podeContas`, `ehAdmin`) por `podeAcessar`.
- [x] **Passo 4** — mover **Estoque** do grupo "Administração" para "Principal".
      A rota é livre por decisão do Erick, e deixá-la sob Administração faz o
      menu prometer uma restrição que não existe. Nenhuma outra permissão muda.
- [x] **Passo 5** — rodar a suíte inteira. O invariante tem de ficar verde **sem
      exceção nenhuma**. Se você precisar de um caso especial para passar, o
      caso especial é um defeito — relate em vez de silenciar.
- [x] **Passo 6: commit**

---

## Task 5 — Providers por rota e code splitting

**Arquivos:** modificar `src/main.tsx`, `src/router.tsx`; apagar dois contexts mortos

- [x] **Passo 1** — apagar `src/context/ClientesContext.tsx` e
      `src/context/VendedoresContext.tsx`. Antes de apagar, confirme com
      `grep -rn` que ninguém os importa. Commit separado: remoção de código morto
      não se mistura com mudança de comportamento.
- [x] **Passo 2** — teste: abrir `/login` **não** monta `EstoqueProvider` nem
      `VendasProvider`. Faça o provider registrar sua montagem num espião.
- [x] **Passo 3** — rodar, ver falhar (hoje a pirâmide monta todos).
- [x] **Passo 4** — mover cada provider para o ramo de rota que o consome.
      `ThemeProvider`, `AuthProvider` e `BrowserRouter` ficam no `main.tsx`.
      Descubra o consumidor de cada context com `grep`, não por suposição.
- [x] **Passo 5** — rodar; a suíte inteira, não só o teste novo.
- [x] **Passo 6** — envolver cada página em `lazy` + `Suspense`, com o fallback
      usando primitivo do Design System.
- [x] **Passo 7** — `npm run build` e **colar no relatório a lista de chunks**. O
      aviso atual "Using dynamic import() to code-split" tem de sumir e tem de
      aparecer mais de um chunk. Sem essa prova a task não está pronta.
- [x] **Passo 8: commit**

---

## Task 6 — `services/` tipado e o bug do token

**Arquivos:** criar `src/services/http.ts`; modificar `src/services/api.ts`,
`src/services/notasapi.ts`

**Atenção:** o spec pedia "uma instância `axios` única". Isso está **errado** e não
deve ser seguido: existem dois backends distintos — `VITE_API_URL`
(`authapi.healthsafetytech.com`) e `VITE_NOTAS_URL` (`tinyapi.healthsafetytech.com`).
Uma instância só quebraria as chamadas de notas. O que se compartilha é o
**interceptor**, não a instância.

- [x] **Passo 1** — teste: uma instância criada pela fábrica manda
      `Authorization: Bearer <token>` quando há token no `localStorage`, e não manda
      cabeçalho nenhum quando não há.
- [x] **Passo 2** — rodar, ver falhar.
- [x] **Passo 3** — `http.ts` com `criarHttp(baseURL)`; os dois módulos passam a usá-la.
- [x] **Passo 4** — teste do bug: `updateUserPassword` manda o cabeçalho
      `Authorization`. **Tem de falhar** — hoje `api.ts:20` usa `axios.put` cru.
- [x] **Passo 5** — corrigir para `authApi.put`, rodar, ver passar.
- [x] **Passo 6** — tipar os retornos das funções de `api.ts` e `notasapi.ts`.
      Sem `any` novo; se um retorno for genuinamente desconhecido, `unknown`.
- [x] **Passo 7: commit**

---

## Task 7 — Fechamento

- [x] Suíte completa, `tsc --noEmit`, `npm run lint` (≤190), `npm run build`.
- [x] Conferir que o teste da Task 1 continua verde e **inalterado** desde o commit
      dela. `git log -p src/auth/acesso-atual.test.tsx` deve mostrar um commit só.
      Se mostrar mais, alguém ajustou a rede de segurança para passar — investigar.
- [x] Registrar no spec os achados desta fase.
- [ ] Checkpoint humano com o Erick: entrar com cada papel e conferir menu e rotas.

---

## Fora de escopo, e por quê

As duas primeiras dúvidas foram **decididas pelo Erick** em 27/08/2026 e deixaram
de estar em aberto:

1. **O portão `[1,3,4]` fica.** `/financeiro` e `/locacao` são para pessoas
   nomeadas, por decisão da chefia — não para o papel `financeiro`. A matriz
   reproduz a regra e a documenta.
2. **`/estoque` continua livre.** A rota está correta; o menu é que muda de
   grupo, na Task 4.

Segue fora de escopo:

3. Unificar `RequireVendas`/`RequireVendedores` **como regra** — na matriz elas já
   ficam idênticas, mas se um dia devem divergir, é escolha de negócio.
4. **Observação operacional, não tarefa:** se um dia o id 1, 3 ou 4 for atribuído
   a outra pessoa, ela herda o acesso a `/financeiro` e `/locacao` sem que nada
   no código acuse. Vale conferir antes de reaproveitar id de usuário desligado.
