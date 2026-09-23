# O `useIsMobile` vira `src/hooks/useIsMobile.ts`

Decidido em 08/09/2026, logo depois de fechar o item 6. É o **item 5 da Fase 4**,
adendo ao `2026-08-25-datacorehs-design-system-design.md`, que governa a
modernização, e continuação de `2026-09-01-fase-4-blocos-comuns-design.md`.

**É o último item da Fase 4.** Com ele fechado, as seis telas restantes da Fase 3
chegam sem nenhum bloco duplicado para carregar.

## O item não é o que o plano de setembro dizia que era

O documento que governa descreve este item como "quatro cópias de doze linhas", e
a spec do item 6 o chamou de "extração mecânica sem defeito escondido". **As duas
descrições estavam incompletas**, e a medição de 08/09 mostrou por quê: as quatro
cópias são de fato idênticas, mas **o uso delas não é** — e duas das quatro telas
não usam o resultado para nada.

Este item, então, não é "quatro telas adotam um hook". É **três adotam, uma
apaga** — e chegar a esse número exigiu duas leituras. A primeira olhou a
variável `isMobile` e concluiu que `Produtos` e `Vendas` eram código morto igual,
porque o lint acusa as duas do mesmo jeito. A segunda olhou
`grep window.innerWidth` e viu que `Vendas` usa a informação, por fora do hook e
sem reagir a `resize`. **A variável não usada era o sintoma; a pergunta era quem
precisa da resposta.**

## O que se repete, e o que não se usa

As quatro cópias — `Clientes.tsx:72`, `Estoque.tsx:71`, `Produtos.tsx:91`,
`Vendas.tsx:100` — são funcionalmente idênticas: mesmo breakpoint de 640px, mesmo
`useState(false)`, mesmo `useEffect` com `resize`, mesma limpeza. Divergem só em
nome de variável e comentário, e num detalhe de estilo: `Clientes` escreve
`React.useState`/`React.useEffect` enquanto os outros três importam direto.

Diferente do item 6, aqui **não há divergência de comportamento entre as cópias**.
A divergência está em outro lugar:

| Tela       | Declara | Usa `isMobile`?     | Lê `innerWidth` inline?   |
| ---------- | ------- | ------------------- | ------------------------- |
| `Clientes` | sim     | **sim** — 5 pontos  | **sim** — 1 (`isMobileW`) |
| `Estoque`  | sim     | **sim** — 11 pontos | não                       |
| `Vendas`   | sim     | **não**             | **sim** — 3               |
| `Produtos` | sim     | **não**             | não                       |

Todos os usos estão **dentro de componentes do recharts**, e isso decide como o
item se prova — ver "Como se prova" abaixo.

**A quarta coluna é o achado, e ela não estava na primeira versão desta spec.**
A leitura original olhou só a variável `isMobile` e concluiu que `Produtos` e
`Vendas` eram código morto igual. O lint concordava — acusa as duas com
`'isMobile' is assigned a value but never used`. Mas `grep window.innerWidth`
conta outra história: **só `Produtos` é código morto de verdade.**

## O defeito, e ele não é hipótese

### 1. Duas telas declaram o hook e ignoram o resultado — por motivos diferentes

`Produtos.tsx:108` e `Vendas.tsx:123` fazem `const isMobile = useIsMobile();` e
nunca usam o valor. **Isso não é dedução: o lint já acusa, e vinha acusando.**

```
src/pages/Produtos.tsx  108:9  warning  'isMobile' is assigned a value but never used
src/pages/Vendas.tsx    123:9  warning  'isMobile' is assigned a value but never used
```

São 2 dos 87 avisos do baseline de 103. Apagar essas duas atribuições **derruba o
lint em 2** — a primeira vez na Fase 4 que a medição aponta o número exato antes
de a task começar.

**Mas as duas telas não têm o mesmo problema, e a primeira leitura desta spec
errou nisso.** Ver a variável não usada e concluir "código morto" foi olhar para
o sintoma:

- **`Produtos` é código morto de verdade.** A única leitura de `window.innerWidth`
  no arquivo está dentro do próprio hook. A tela não pergunta nada sobre a
  largura da janela. A resposta certa é **apagar**.
- **`Vendas` precisa da resposta e a obtém da pior forma.** Três leituras diretas,
  dentro do `YAxis` do gráfico:

  ```tsx
  Vendas.tsx:824   width={window.innerWidth < 640 ? 80 : 140}
  Vendas.tsx:825   tick={{ fontSize: window.innerWidth < 640 ? 9 : 12 }}
  Vendas.tsx:827   window.innerWidth < 640 ? (trunca em 8) : (trunca em 15)
  ```

  A tela tinha o hook no escopo, ignorou, e respondeu à mão três vezes — e
  **nenhuma das três reage a `resize`**, porque são lidas no render do gráfico.
  A resposta certa aqui é **adotar**, não apagar.

O lint acusa as duas do mesmo jeito porque ele só enxerga a variável. **Apagar o
hook de `Vendas` teria deixado as três leituras órfãs e o defeito de `resize`
vivo** — e o guarda da última task falharia apontando o arquivo, seis passos
depois de a decisão errada ter sido tomada.

O número do lint sobrevive à correção: `Produtos` some com um aviso ao apagar, e
`Vendas` some com o outro ao passar a **usar** o `isMobile`.

### 2. `Clientes` tem a mesma patologia, uma vez

`Clientes.tsx:830`, dentro do `content` do tooltip do gráfico:

```tsx
const isMobileW = window.innerWidth < 640;
```

O `isMobile` do hook está no escopo e é usado a sessenta linhas dali (linhas 765 a
811). Mesma pergunta, duas respostas, no mesmo componente — e a de baixo **não
reage a `resize`**: é lida no instante em que o tooltip renderiza. Na prática o
tooltip remonta com frequência e o sintoma some, o que é justamente por que ela
sobreviveu.

### 3. O primeiro render sempre mente, e em celular isso salta aos olhos

As quatro cópias inicializam com `useState(false)` e só corrigem no `useEffect`,
que roda depois da montagem. **Em celular, o primeiro render é sempre o de
desktop.**

Não é invisível. `Clientes.tsx:765` e `Estoque.tsx:588` fazem:

```tsx
<ResponsiveContainer width="100%" height={isMobile ? 420 : 300}>
```

O gráfico monta com 300px e salta para 420px. Junto vão a fonte dos eixos
(`isMobile ? 10 : 11`), a largura do eixo Y (`130` ou `160`) e a do tooltip
(`220` ou `280`). No `Estoque` muda também o gatilho do popover — `trigger` vai de
`"hover"` para `"click"` — então por um instante a tela responde ao gesto errado.

A correção é inicializar o estado com o valor real, em vez de `false`:

```ts
const [isMobile, setIsMobile] = useState(() => window.innerWidth < LIMITE);
```

**É seguro aqui, e isso foi verificado, não presumido:** `src/main.tsx` usa
`createRoot` puro, sem hidratação, e não há `ssr` no `vite.config.ts`. O `window`
existe no primeiro render. Num projeto com SSR essa linha quebraria o build do
servidor — é a razão pela qual o padrão `useState(false)` existe no mundo, e é a
razão pela qual ele não faz sentido **neste** projeto.

## As decisões

### O hook fica em `src/hooks/`, não no design system

Ao lado de `usePaginacao.ts` e `useCliqueFora.ts`. Não é primitivo de interface —
não renderiza nada, responde uma pergunta sobre a janela. `src/design-system/ui/`
é para o que se vê.

### O breakpoint vira constante nomeada

640px aparece hoje em cinco lugares (as quatro cópias mais o `isMobileW`), sempre
como literal. Vira uma constante no hook, com o comentário dizendo o que ela é: o
`sm` do Tailwind. Se um dia divergir do Tailwind, o comentário é onde alguém
descobre.

Fica **como `resize` mesmo**, e não `matchMedia`, apesar de `matchMedia` casar com
o breakpoint por construção e não disparar a cada pixel de arrasto. Motivo:
`matchMedia` é troca de mecanismo, e trocar mecanismo junto de unificar é
exatamente o que a receita do repo separa. O ganho é pequeno — o React já
descarta `setState` com o mesmo valor, então o re-render só acontece na travessia
do limiar. Fica registrado como possibilidade, não como pendência.

### `Clientes` passa a ter uma resposta só

O `isMobileW` da linha 830 morre e o `isMobile` do hook ocupa o lugar. Além de
apagar a quinta cópia, corrige a assimetria: o valor passa a reagir a `resize`
como o resto da tela.

### Uma tela perde o hook em vez de adotá-lo

`Produtos` só apaga: não pergunta nada sobre a largura da janela. Adotar um hook
para guardar valor que ninguém lê seria trocar código morto por código morto mais
bem organizado.

As outras três — `Clientes`, `Estoque` e `Vendas` — adotam. `Vendas` entra nesse
grupo apesar de o lint acusá-la igual a `Produtos`, porque ela **usa** a
informação, só que por três `window.innerWidth` soltos que não reagem a `resize`.

### Unificar e corrigir são passos separados

Como no item 6, e pelo mesmo motivo. O hook **nasce com `useState(false)`**, igual
às cópias, para que a caracterização passe sem edição. O estado inicial correto
entra depois, em commit próprio, com plantação.

## Como se prova, e por que aqui é mais difícil

### A cobertura hoje é zero

`grep -rln "isMobile\|innerWidth"` nos arquivos de teste devolve **nenhum**. Nada
no repositório observa este comportamento — nem o hook, nem o efeito dele nas
telas.

### E tudo que `isMobile` controla passa pelo recharts

Os 5 usos em `Clientes` e os 11 em `Estoque` estão **todos** dentro de componentes
do recharts, que todo teste de página deste repo substitui por dublê. Um teste
copiado do molde existente não veria nada — é o mesmo problema que o item 6
enfrentou nos popovers, e a solução é a mesma: **um dublê que exponha a prop que
interessa**, em vez do `() => null` padrão.

O alvo mais honesto é o `height` do `ResponsiveContainer` (300 contra 420), porque
é o efeito mais visível e o mais fácil de afirmar sem ambiguidade. No `Estoque`, o
`trigger` do `Tooltip` (`"hover"` contra `"click"`) é um segundo alvo — e um mais
hostil que o `height`, porque é o único uso de `isMobile` em todo o projeto que
muda **interação**, e não aparência.

> **Nota, pós-revisão final:** esta seção afirmava que o `Estoque.popover.test.tsx`
> "já tem o dublê que o expõe". Isso era falso — o dublê de lá expõe o `content`,
> não o `trigger`, e a promessa ficou sem entrega até ser fechada depois da revisão.
> O teste foi escrito em `Estoque.mobile.test.tsx`, com um dublê próprio para o
> `trigger`, não em `popover.test.tsx`: lá o dublê de `Tooltip` devolve um fragment
> e o arquivo tem seis testes que percorrem a árvore, um deles subindo
> `parentElement` duas vezes — envolver o `Tooltip` para publicar uma prop nova
> acrescentaria um nó e quebraria aquilo. `mobile.test.tsx` já tinha o formato
> certo: poucos testes, todos olhando um `data-testid` do dublê.
>
> A prova do estado inicial também exigiu mais do que o dublê simples do `height`:
> comparar o DOM final não distingue o inicializador certo do errado, porque
> `render()` do Testing Library já flusha o efeito de correção do hook antes de
> devolver o controle ao teste — os dois convergem para o mesmo resultado final.
> O dublê teve que empilhar cada chamada do `Tooltip`, e o teste olha o
> **primeiro** valor da pilha, não o DOM.

### Mexer em `window.innerWidth` na jsdom

A jsdom fixa `innerWidth` em 1024 e a propriedade é gravável, então o teste ajusta
o valor e dispara `new Event("resize")`. **Tem de restaurar o valor ao fim de cada
teste** — `innerWidth` é global e um teste que o deixa em 375 contamina todos os
seguintes do arquivo, de forma difícil de rastrear.

### A ordem

1. Caracterização das três telas que usam a informação, com plantação.
2. Apagar a cópia morta de `Produtos` — passo isolado, porque o critério dele é
   diferente de todos: o lint tem de cair.
3. Extrair o hook, nascendo igual às cópias.
4. `Clientes`, `Estoque` e `Vendas` adotam.
5. Matar as leituras inline: o `isMobileW` de `Clientes` e as três de `Vendas`.
6. Corrigir o primeiro render, com plantação.
7. Guarda.

## Guarda

`src/test/guarda-usemobile.test.ts`, no formato dos sete que já existem: falha se
`window.innerWidth` aparecer em qualquer arquivo fora de `src/hooks/useIsMobile.ts`.
Pega tanto uma quinta cópia do hook quanto uma leitura solta nova — que é como as
quatro leituras inline nasceram, uma em `Clientes` e três em `Vendas`.

**Este guarda já se pagou antes de existir.** Foi a varredura que ele formaliza —
`grep window.innerWidth` em todo o `src/` — que mostrou que `Vendas` usava a
informação, quando a primeira leitura desta spec a tinha classificado como código
morto. O guarda não vai só impedir a próxima cópia: ele achou a que estava lá.

Vale a lição do item 6, que custou um fix round: **a asserção sobre o próprio dono
tem de ignorar comentário**, igual à que varre os outros arquivos. Um guarda que
passa verde quando alguém comenta a linha que ele protege dá falsa sensação de
cobertura.

## O que NÃO entra

- **`matchMedia`** — registrado acima como possibilidade, não como pendência.
- **Os 15 erros `react-hooks/set-state-in-effect`.** Investiguei se o
  `useIsMobile` era a origem: **não é**. Eles estão nos `useEffect` que buscam
  dados, em sete contexts e oito telas, e as linhas não batem com nenhuma das
  quatro cópias. É o item 10 da lista de "Em aberto" e continua lá.
- **Os cinco avisos de variável não usada de `Estoque.tsx`** (`TrendingUp`,
  `ProdutoEstoque`, `atualizarQuantidade`, `gerarPDF`, `entry`) — pré-existentes e
  de outro assunto.
- **Migrar as telas para o design system.** É Fase 3.
- **O emoji no comentário do `Estoque`** (`🔹`) some junto com o bloco apagado, mas
  a tela tem outros; varrer emoji do repo é item à parte.

## Riscos

**O estado inicial correto pode expor um render a mais em teste.** Hoje todo teste
monta com `isMobile === false`; depois da correção, um teste que ajuste
`innerWidth` antes do `render` verá o valor certo já no primeiro render. É o
comportamento desejado, mas pode quebrar um teste que dependia do valor errado —
e nenhum depende hoje, porque a cobertura é zero.

**`Produtos` pode estar prestes a usar `isMobile`.** O histórico diz que não:
`git log -S"isMobile"` devolve **um único commit** no arquivo — o que criou a
página (`978242db`). A cópia nasceu sem uso e assim ficou. Se alguém quiser
depois, o hook vai existir e é uma linha de import — mais barato que manter código
morto esperando.

**Adotar em `Vendas` muda comportamento, e é para mudar.** Hoje as três leituras
são feitas no render do gráfico e não reagem a `resize`: quem estreita a janela vê
o eixo continuar com 140px de largura e a fonte em 12. Depois da adoção, o gráfico
acompanha. É o defeito sendo corrigido, mas é bom saber que a tela vai se comportar
diferente — e é justamente o que a caracterização precisa registrar **antes**, para
a mudança ficar visível no diff dos testes em vez de passar despercebida.

## Como se sabe que terminou

- `grep -rn "window.innerWidth" src` fora de teste devolve **só**
  `src/hooks/useIsMobile.ts`
- `grep -rn "const useIsMobile" src/pages/` devolve **zero**
- `guarda-usemobile` verde, provado por plantação, e a asserção sobre o dono
  ignora comentário
- Lint **cai pelo menos 2** — de 103 para 101 ou menos. É o primeiro item da fase
  com um número previsto antes de começar. Um aviso some com o `Produtos`, ao
  apagar; o outro some com o `Vendas`, ao passar a **usar** o `isMobile`. Se não
  cair, algo não foi apagado ou não foi adotado.
- Suíte verde nos dois fusos; `tsc --noEmit` limpo
- **Fase 4 fechada**, 6 de 6

## Notas relacionadas

- `2026-08-25-datacorehs-design-system-design.md` — o documento que governa
- `2026-09-01-fase-4-blocos-comuns-design.md` — a decisão da Fase 4
- `2026-09-08-fase-4-clique-fora-design.md` — o item 6, e a lição do guarda que
  não guardava
