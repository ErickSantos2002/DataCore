# O clique fora vira `src/hooks/useCliqueFora.ts`

Decidido em 08/09/2026, na volta do fim de semana. É o **item 6 da Fase 4**,
adendo ao `2026-08-25-datacorehs-design-system-design.md`, que governa a
modernização, e continuação de `2026-09-01-fase-4-blocos-comuns-design.md`.

Fecha a Fase 4 junto com o item 5 (`useIsMobile`), que fica para depois por ser
extração mecânica sem defeito escondido.

## O item vem antes da Fase 3 de propósito

A Fase 4 existe para que as seis telas restantes não sejam migradas duas vezes.
Produtos, a próxima da fila da Fase 3, é uma das quatro telas que ainda carregam
a cópia do `useIsMobile`; Estoque é a dona de uma das três implementações de
clique fora. Migrar qualquer uma delas com a Fase 4 em 4/6 obriga a reabrir o
arquivo depois — que é exatamente o retrabalho que a fase foi criada para
evitar.

## O que se repete, e onde está a divergência

Três implementações, em três arquivos, e **elas discordam entre si em dois
eixos**. Não é o caso do item 4, em que os cinco blocos eram byte a byte
idênticos e toda a divergência era contra uma sexta implementação certa. Aqui
cada uma acerta uma coisa que as outras erram:

|                           | `MultiSelect`  | `SearchSelect`       | `Estoque`      |
| ------------------------- | -------------- | -------------------- | -------------- |
| `mousedown`               | sim            | sim                  | sim            |
| `touchstart`              | **não**        | **não**              | **sim**        |
| Registra só quando aberto | **não** (`[]`) | **sim** (`[aberto]`) | **não** (`[]`) |
| `Escape` fecha            | sim            | sim                  | **não**        |

Nenhuma das três está inteira. A peça unificada é a interseção dos acertos, não
a cópia de uma delas — e é isso que separa este item do item 4.

`MultiSelect.tsx:91-99`, `SearchSelect.tsx:75-84` e `Estoque.tsx:109-131`. São
cerca de **35 linhas** somadas; o item apaga pouco. **O valor deste item não
está na linha apagada, está nos dois defeitos que a divergência denuncia** — a
mesma lógica do item 3, em que a extração da planilha valeu pelo `toISOString()`
que ela desenterrou.

## Os dois defeitos

### 1. No celular, tocar fora não fecha o dropdown

`MultiSelect` e `SearchSelect` escutam **apenas** `mousedown`. Em toque, o
navegador dispara `touchstart` → `touchend` → um `click` sintetizado; `mousedown`
não vem, ou vem tarde e com o alvo já resolvido. O painel fica aberto por cima do
conteúdo, e a pessoa precisa tocar de novo no gatilho para fechar.

**O `MultiSelect` é consumido por sete arquivos** — Clientes, Estoque, Produtos,
Serviços, Vendas, Vendedores e `contas/FiltrosDeContas.tsx` —, então o defeito é
de sete telas, não de um componente. E o design system tem o rodapé compacto de
celular no `Pagination` desde o item 2: o app **é** usado em tela pequena, isso
não é hipótese.

O Estoque é a única das três que acerta, e o comentário no código mostra que foi
deliberado: _"Aceita mouse OU touch"_. **A implementação que ninguém promoveu a
primitivo é a que estava certa** — o inverso do que aconteceu no item 4, em que
Contas, a implementação certa, era a única já testada.

### 2. Listeners de documento vivos com o painel fechado

`MultiSelect` registra o listener com `[]` e nunca o desmonta enquanto o
componente vive — aberto ou fechado. Cinco telas montam três `MultiSelect` cada
(Clientes, Produtos, Serviços, Vendas e `FiltrosDeContas`); Vendedores monta
dois, Estoque um. São três handlers rodando `contains` a cada `mousedown` da
página, e como no máximo um painel fica aberto por vez, pelo menos dois deles
sempre trabalham para decidir fechar um painel que já está fechado.

Não é defeito visível para quem usa, e é por isso que ele sobreviveu: nenhum
teste falha por causa dele. É desperdício, e some de graça ao adotar a forma do
`SearchSelect`, que é a única que guarda `if (!aberto) return`.

### O que **não** é defeito, e por que o `Escape` fica quase todo de fora

A investigação começou com a suspeita de que os três não fechavam no `Escape`.
**Ela não se sustentou, e o registro é o achado** — a mesma lição do item 4:
verificar o mecanismo não é verificar o defeito. Olhar só os
`document.addEventListener` levava à conclusão errada, porque os dois primitivos
tratam `Escape` por `onKeyDown` no container, e não por listener global:

- `MultiSelect.tsx:84` — fecha **e devolve o foco ao gatilho**
- `SearchSelect.tsx:133` — fecha, junto de `ArrowDown`, `ArrowUp` e `Enter`

E `onKeyDown` no container é a forma **certa**, não um descuido: `Escape` deve
agir quando o foco está dentro do componente. Listeners globais de `keydown`
fechariam os três painéis de Vendas a cada tecla, e não só aquele em que a
pessoa está.

Sobra o Estoque, que de fato não fecha no `Escape` em nenhum dos dois popovers.
Entra neste item por ser barato, mas **não entra no hook** — vai como `onKeyDown`
no container de cada popover, seguindo o padrão dos primitivos.

## As decisões

### O hook recebe uma ref, não uma lista

```ts
useCliqueFora(ref, aoFechar, ativo);
```

O Estoque chama duas vezes, uma por popover. A alternativa — uma lista de refs e
um listener só — espelharia o `onDocClick` de hoje, mas os dois primitivos
passariam array de um elemento à toa, e a semântica fica ambígua: com duas refs,
o alvo dentro de uma delas deveria impedir o fechamento _da outra_? Hoje não
impede — o Estoque avalia cada popover contra a própria ref, dentro de um
handler só. Uma ref por chamada expressa isso sem o `if` duplo.

### O hook escuta `mousedown` **e** `touchstart`

É o defeito 1 sendo corrigido no ponto único. `touchstart` vai com
`{ passive: true }`, como o Estoque já faz — o handler não chama
`preventDefault`, e a flag evita que o navegador segure a rolagem esperando para
ver se ele chamaria.

### O hook só registra quando `ativo` é verdadeiro

É o defeito 2. `ativo` é o `aberto` de quem chama; com `false`, o efeito não
registra nada.

### `Escape` fica fora do hook

Pelo motivo acima: é `onKeyDown` de container, não listener de documento.
Misturar as duas coisas num hook chamado `useCliqueFora` seria dar a ele duas
responsabilidades e um nome que mente sobre uma delas.

### Unificar e corrigir são passos separados

Regra do `CLAUDE.md`, e ela morde aqui mais do que no item 4, porque a peça
unificada **não é igual a nenhuma das três**. Se o `touchstart` entrar junto da
extração e um teste quebrar, não dá para saber se quebrou por causa da extração
ou da correção.

Então o hook **nasce com o defeito** — só `mousedown`, registrando sempre — para
que os testes de caracterização passem sem uma edição. `touchstart` e o `ativo`
entram depois, cada um em commit próprio, cada um com plantação.

## A peça final

`src/hooks/useCliqueFora.ts`, ao lado de `usePaginacao.ts`. Docblock no estilo
do repo: o porquê, com o defeito concreto que a decisão evitou.

Três consumidores: `MultiSelect.tsx`, `SearchSelect.tsx` e `Estoque.tsx` (duas
chamadas).

## Como se prova

### O que já tem rede, e o que não tem

| Alvo                         | Teste de clique fora hoje                                            |
| ---------------------------- | -------------------------------------------------------------------- |
| `MultiSelect` primitivo      | **sim** — `MultiSelect.test.tsx:109`                                 |
| `MultiSelect` nas telas      | **sim** — 6 arquivos, todos com `fireEvent.mouseDown(document.body)` |
| `SearchSelect`               | **não**                                                              |
| Popovers de pizza do Estoque | **não**                                                              |

Sete arquivos cobrem o `MultiSelect`; **dois dos três alvos estão descobertos**.
A receita é clara: teste de caracterização antes de mover uma linha, e a prova de
que o teste enxerga — plantar a quebra, ver falhar, reverter.

Então o passo 1 não é extrair. É **escrever caracterização para o `SearchSelect`
e para os dois popovers do Estoque**, com plantação, e só depois mexer.

### A prova de que a extração não mudou comportamento

Os sete arquivos que já cobrem o `MultiSelect` passam **sem uma edição**, mais os
dois novos. É o mesmo critério que fechou o item 3, quando os quatro arquivos que
mockavam o `xlsx` passaram intocados.

### A prova de cada correção

- **`touchstart`:** teste novo disparando `fireEvent.touchStart(document.body)`
  com o painel aberto. Plantado: some o `touchstart` do hook, o teste falha.
- **`ativo`:** teste que conta os listeners registrados com o componente fechado.
  Plantado: troque `ativo` por `true` fixo, o teste falha.
- **`Escape` no Estoque:** teste por popover. Plantado: some o `onKeyDown`.

### Guarda

`src/test/guarda-clique-fora.test.ts`, no formato dos seis que já existem: falha
se algum arquivo fora de `src/hooks/useCliqueFora.ts` registrar `mousedown` ou
`touchstart` em `document`. É o que impede a quarta implementação de nascer — e é
o mesmo mecanismo do `guarda-planilha`, que travou os defeitos do item 3.

## O que NÃO entra

- **`useIsMobile`** — é o item 5, e é o outro que falta para fechar a Fase 4.
- **Apagar o `SearchSelect`.** Decidido em 08/09: ele migra junto, mesmo órfão.
  Nenhuma tela o consome hoje (só o próprio teste e dois comentários de exemplo
  no `FilterBar.tsx`), mas várias das seis telas da Fase 3 têm filtro de
  cliente e de produto com busca, que é o caso dele. Migrar custa a mesma troca
  de seis linhas e evita que ele seja a quarta divergência daqui a um mês.
- **`Escape` nos primitivos** — já existe e está certo.
- **Migrar o Estoque para o design system.** É Fase 3, e a tela inteira será
  reescrita. Aqui ela só troca o bloco de clique fora e ganha o `Escape`.
- **Refatorar o `Tooltip`**, que tem listeners de `scroll`, `resize` e `keydown`
  próprios e vive em portal — outro problema, e ele já é exceção documentada no
  guarda dos primitivos.

## Riscos

**O `touchstart` pode fechar o painel antes do toque ser processado.** Tocar num
checkbox _dentro_ do painel não fecha, porque o container contém o alvo. Mas
tocar num elemento interativo _fora_ passa a fechar o painel **e** acionar o
elemento no mesmo gesto — que é o comportamento desejado e o que o Estoque já
faz hoje. O risco real é o inverso: um painel que renderiza em portal ficaria
fora do `contains` e fecharia sozinho. **Nenhum dos três renderiza em portal** —
verificado; o `Tooltip` é o único que usa portal no repo, e ele está fora deste
item.

**O `ativo` pode introduzir um render a mais.** O efeito passa a depender de
`aberto`, então abre e fecha registram e desregistram. É o que o `SearchSelect`
já faz há semanas, sem sintoma.

**A jsdom sintetiza `touchstart` sem `TouchEvent` real.** `fireEvent.touchStart`
funciona, mas não prova comportamento de navegador. A conferência no
navegador — que já acumula três pendências desde o item 1 — ganha uma quarta:
abrir um filtro no celular e tocar fora.

## Como se sabe que terminou

- `grep -rn "addEventListener(\"mousedown\"" src` devolve **só**
  `src/hooks/useCliqueFora.ts`
- `guarda-clique-fora` verde, provado por plantação
- Os sete arquivos que já cobriam o `MultiSelect` passam sem edição
- `SearchSelect` e os dois popovers do Estoque têm caracterização própria
- Suíte verde em `TZ=UTC` e `TZ=America/Sao_Paulo`
- Lint **não sobe** de 103; `tsc --noEmit` limpo
- A conferência no navegador ganha o quarto item registrado

## Depois deste plano

Item 5 (`useIsMobile`) fecha a Fase 4. Aí a Fase 3 retoma por Produtos — e a
remedição de 08/09 confirmou que a fila de agosto sobreviveu: Produtos segue a
menor das seis (990 linhas) e Vendas a maior (1315). A suposição registrada em
04/09, de que a Fase 4 tinha embaralhado a ordem, **não se confirmou**.

## Notas relacionadas

- `2026-08-25-datacorehs-design-system-design.md` — o documento que governa
- `2026-09-01-fase-4-blocos-comuns-design.md` — a decisão da Fase 4
- `2026-09-03-fase-4-planilha-design.md` — o item 3, e o padrão do guarda
- `2026-09-04-fase-4-preset-periodo-design.md` — o item 4, e a lição do
  mecanismo que não é o defeito
