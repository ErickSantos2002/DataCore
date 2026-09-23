# O `Pagination` sai do armário, e as seis telas param de rolar a própria

Decidido em 03/09/2026, logo depois de fechar a fusão do MultiSelect com a peça
de Contas. É o **item 2 da Fase 4**, adendo ao
`2026-08-25-datacorehs-design-system-design.md`, que governa a modernização, e
continuação direta de `2026-09-01-fase-4-blocos-comuns-design.md`.

## Por que este item é diferente dos outros da fase

Os cinco itens restantes da Fase 4 foram descritos como "menores e mais
mecânicos, e nenhum tem a decisão de API que este teve". Para o `Pagination`
isso é **meio verdade e vale corrigir antes de começar**: a decisão de API de
fato não existe, porque o primitivo já está construído desde a Fase 1 e já tem
um consumidor. Mas a adoção não é mecânica, por dois motivos que a medição
trouxe.

O primeiro é que o primitivo **não faz tudo o que as seis cópias fazem** — falta
nele a forma compacta de celular. O segundo é que as seis cópias escondem **três
defeitos**, e um deles imprime na tela uma frase impossível.

Então este item não é "trocar markup por componente". É o mesmo trabalho de
sempre: caracterizar, unificar sem mudar comportamento, corrigir depois.

## O que foi medido

Seis implementações da mesma paginação, cada uma declarada dentro da própria
página, com o mesmo formato: uma frase de contagem, um bloco completo para
desktop e um bloco compacto para celular.

| Tela       | Bloco de markup | Itens/página | Substantivo  | Colunas |
| ---------- | --------------- | ------------ | ------------ | ------- |
| Clientes   | 111 linhas      | 15           | registros    | 5       |
| Estoque    | 105             | 15           | registros    | 7       |
| Produtos   | 104             | **10**       | **produtos** | 6       |
| Serviços   | 104             | 15           | registros    | 6       |
| Vendas     | 104             | **10**       | registros    | 6       |
| Vendedores | 99              | **10**       | registros    | 7       |

São **627 linhas de markup**, mais cerca de 60 de estado e `slice` — perto de
**687 no total**, quase o tamanho do `MultiSelect` (737) que o item 1 apagou.

Cada tela tem **uma única tabela**, então a contagem de colunas é o `colSpan`
sem ambiguidade. Ela vem do `<td>` de uma linha do corpo, e **não** de
`grep -c "<th"`: esse conta o `<thead>` junto e devolve um a mais nas seis — foi
o número errado que este spec trouxe na primeira versão.

E a forma compacta de celular é **literalmente a mesma string de classes nas
seis** (`flex md:hidden justify-center gap-2 items-center mt-2`), com os mesmos
rótulos `<` e `>`: não divergiu, foi copiada.

Do outro lado, `src/design-system/ui/data/Pagination.tsx` tem 8 testes e **um
consumidor só**, `pages/contas/TabelaDeContas.tsx:300`, das gêmeas.

## Os três defeitos que a adoção encontra

Nenhum era conhecido antes. Os três estão nas **seis** telas.

**1. A frase de contagem vive dentro do `{totalPaginas > 1 && ...}`.** Quem tem
10 produtos ou menos não lê contagem nenhuma. É o **defeito 1.7 das gêmeas**,
que a Fase 1 já corrigiu em Contas, reintroduzido aqui por herança — as seis
cópias sempre o tiveram. Este defeito **morre sozinho na adoção**, porque o
primitivo mostra a frase sempre.

**2. Não existe estado vazio.** O `<tbody>` mapeia a lista direto, sem ramo para
o zero. Filtro que não casa nada devolve o cabeçalho da tabela e o nada embaixo,
sem uma palavra de explicação. É exatamente o buraco que o docblock do
`Pagination` avisa que ele pressupõe estar tapado: ele devolve `null` com zero
resultados, então **adotá-lo sem `TableEmpty` deixaria a tela literalmente muda
no zero**.

**3. A página não volta para a 1 quando o filtro muda.** É o pior dos três, e o
único que imprime coisa errada. Na página 7 de 84 produtos, filtre para 20:

- `produtosTabela.slice(60, 70)` num array de 20 devolve `[]` — tabela em branco
- `totalPaginas` vira 2, e `2 > 1` é verdade, então o rodapé aparece
- a frase monta `Mostrando 61 a Math.min(70, 20) de 20` e sai
  **"Mostrando 61 a 20 de 20 registros"**, com o intervalo invertido
- o botão Próximo compara `paginaAtual === totalPaginas`, ou seja `7 === 2`,
  então continua **habilitado** e leva à página 8, que também não existe

## As divergências, e por que nenhuma vira uniformização

Três, e as três são preservadas como estão:

- **Tamanho de página** — 10 em Produtos, Vendas e Vendedores; 15 em Clientes,
  Estoque e Serviços. `pageSize` é prop: unificar o componente não obriga a
  uniformizar o número.
- **Substantivo da contagem** — "registros" em cinco telas, "produtos" em
  Produtos. `itemLabel` é prop, e o default do primitivo já é "registros", então
  cinco telas não passam nada e Produtos passa `"produtos"`.
- **Rótulo do botão** — as seis escrevem "Próximo", o primitivo escreve
  "Próxima". Esta muda, porque o rótulo pertence ao primitivo. É a mesma troca
  que Contas já sofreu e está registrada no comentário de `TabelaDeContas`.

Se algum dia as seis devem paginar de 10 ou de 15, é decisão de produto e entra
no documento de divergências, não neste movimento. **Uniformizar junto com
unificar é o erro que as gêmeas ensinaram a não cometer.**

## As decisões

**A forma compacta de celular sobe para o primitivo.** As seis telas têm hoje um
rodapé compacto abaixo de `md` — `<`, o número da página, `>` — e Contas, que já
consome o primitivo, **não tem**. Se a adoção viesse como está, as seis
perderiam a forma compacta e ganhariam Anterior + até cinco números + Próxima
numa linha de ~370px dentro de uma tela de 360px, que envolve. Seria trocar algo
que funciona no celular por algo que quebra.

Então o primitivo aprende a forma compacta **antes** da adoção. É a mesma
inversão decidida na fase passada, e pelo mesmo motivo: se a peça nova não
alcança a peça velha primeiro, a fusão vira perda de comportamento e a
caracterização quebra por um motivo que não é defeito. De quebra, **Contas ganha
junto** um rodapé de celular que hoje não tem.

**O reset de página vira `src/hooks/usePaginacao.ts`.** O defeito 3 precisa
morar em algum lugar, e seis cópias de `useEffect(() => setPagina(1), [...])`
seriam a duplicação que esta fase inteira existe para matar — cada tela listando
os próprios filtros na dependência, e é aí que a sétima esquece um. O hook
recebe a lista já memoizada e o tamanho, e devolve `{ pagina, setPagina,
itensDaPagina, total }`, apagando também os dois `useState`, o `useMemo` do
`slice` e o `totalPaginas` de cada tela — cerca de 10 linhas vezes seis.

O reset dispara na **identidade da lista**, não no seu tamanho: filtrar pode
devolver a mesma quantidade de itens e ainda assim ser outra lista. Isso só é
seguro porque nas seis telas a lista já é um `useMemo` cujas dependências são
exatamente os filtros — o `useMemo` **é** o contrato do hook, e por ser sutil vai
dito no docblock, com o defeito concreto que evita.

**`TableEmpty` entra nas seis.** Não como enfeite: é a metade do contrato do
`Pagination` que o consumidor precisa cumprir. Sem ele, o zero fica mudo.

## A peça final

```tsx
// src/hooks/usePaginacao.ts
const { pagina, setPagina, itensDaPagina, total } = usePaginacao(
  produtosTabela,
  10,
);
```

```tsx
// no rodapé, no lugar das ~104 linhas
<Pagination
  page={pagina}
  pageSize={10}
  total={total}
  itemLabel="produtos" // só Produtos; as outras cinco usam o default
  onPageChange={setPagina}
/>
```

```tsx
// no <tbody>, o ramo que não existe hoje
{itensDaPagina.length === 0 ? (
  <TableEmpty colSpan={6} />   // Produtos; ver a tabela de colunas acima
) : (
  itensDaPagina.map(...)
)}
```

O `Pagination` ganha a forma compacta abaixo de `md`, com a frase de contagem
continuando visível nos dois tamanhos — é assim que as seis se comportam hoje, e
não há motivo para mudar.

## A ordem, e por que ela é essa

Quatro movimentos.

**M0 — o primitivo aprende a forma compacta.** Teste primeiro, contra o
`Pagination` sozinho: abaixo de `md` mostra `<`, a página atual e `>`; acima,
a janela de cinco. A frase de contagem aparece nos dois. Contas ganha junto,
sem tocar em Contas.

Os rótulos são **os mesmos caracteres que as seis usam hoje**, `<` e `>`, e não
os tipográficos `‹` e `›`. Trocá-los seria melhoria de tipografia no meio de uma
unificação — uma terceira edição na caracterização do M2, justamente o que a
regra abaixo manda tratar como sinal de que a adoção mudou o que não devia. Se a
troca vale, ela vale sozinha, depois, com o antes e o depois visíveis num diff
que só fala disso.

**M1 — caracterizar a paginação onde ela vive.** Um teste por tela, focado só no
rodapé: a frase de contagem, ir para a próxima, voltar, os extremos
desabilitados, o corte em 10 ou 15. **Não é a tela inteira** — é o mesmo recorte
que o item 1 provou funcionar. As seis já têm arquivo de teste do MultiSelect,
então a rede nasce ao lado dela.

**M2 — adotar o primitivo sem mudar comportamento.** Critério duro, o mesmo de
sempre: a caracterização do M1 passa sem uma edição, com **duas exceções
previstas e autorizadas**, escritas aqui antes de começar para não serem
inventadas depois:

1. o rótulo "Próximo" vira "Próxima";
2. a frase de contagem passa a aparecer com uma página só — o defeito 1
   corrigido de graça, porque é impossível adotar o primitivo e mantê-lo.

Qualquer terceira edição necessária significa que a adoção mudou algo que não
devia, e a execução para.

**M3 — os dois defeitos que sobram**, cada um com plantação: `TableEmpty` nas
seis e o `usePaginacao` com o reset.

A ordem coloca a acessibilidade da forma compacta antes da adoção pelo mesmo
motivo da fase passada, e coloca os defeitos depois pelo motivo de sempre:
**junto, não dá para saber qual dos dois quebrou.**

## O que NÃO entra

- **Migrar qualquer uma das seis telas.** As seis continuam em
  `PENDENTES_FASE_3`. Este item toca o rodapé e o `<tbody>` delas, nada mais.
- **Uniformizar 10 e 15**, ou o substantivo da contagem. Viram linha no
  documento de divergências, com o comportamento atual fixado em teste.
- **Trocar a tabela crua pelo `Table` do design system.** `TableEmpty` é um
  `<tr><td>` comum e funciona dentro do `<table>` que já existe; trocar a tabela
  inteira é trabalho da Fase 3, tela a tela.
- **Os outros quatro itens da Fase 4** — Excel, preset de período, `useIsMobile`
  e clique fora. Cada um com plano próprio.
- **Zerar a paleta crua dessas telas.** O rodapé some inteiro e leva junto o
  `dark:` que tinha dentro, mas isso é efeito colateral, não objetivo.

## Riscos

**O maior: o M2 mexer em mais do que o rodapé.** É o movimento que edita seis
arquivos de 1.100 a 1.400 linhas cada. O guarda é o critério do M1: se um teste
de caracterização precisou ser editado fora das duas exceções listadas acima, a
adoção mudou comportamento e volta atrás.

**O segundo: o reset por identidade da lista disparar quando não deve.** Se
alguma das seis não memoizar a lista com os filtros na dependência, o hook
resetaria a página a cada render e a paginação ficaria presa na 1. Mitigação:
conferir as seis `useMemo` antes do M3 — a medição já viu que existem, mas ver
que existem não é o mesmo que ver o que têm na dependência.

**O terceiro: a forma compacta mudar Contas sem ninguém olhar.** O M0 dá a
Contas um rodapé de celular que ela não tem. Contas é a tela de dinheiro e tem
231 testes de caracterização, que devem passar intocados — mas o que eles não
cobrem é a aparência. Entra na conferência no navegador, que segue pendente
desde o item 1.

## Como se sabe que terminou

- `grep -n "totalPaginas" src/pages/` devolve zero: nenhuma das seis rola
  paginação própria.
- As seis consomem `Pagination` e `usePaginacao`, e nenhuma declara `useState`
  de página ou `useMemo` de `slice`.
- As seis têm `TableEmpty`, e com filtro que não casa nada a tela **diz** que
  está vazia.
- Filtrar da página 7 para uma lista de duas páginas volta para a 1, e nenhuma
  frase de contagem inverte o intervalo.
- O `Pagination` tem a forma compacta abaixo de `md`, com teste próprio, e
  Contas a herda.
- A caracterização escrita no M1 passa sem edição depois do M2, fora as duas
  exceções autorizadas.
- Suíte não regride e lint não sobe: baseline **1373 testes / 85 arquivos**,
  lint **119**, `tsc --noEmit` limpo.

## Depois deste plano

Sobram quatro itens da Fase 4 — a exportação para Excel (nove arquivos), o
preset de período (cinco telas com o mesmo defeito), o `useIsMobile` (quatro
cópias) e o clique fora (três implementações, uma delas diferente das outras).
Nenhum deles tem primitivo pronto esperando, como este tinha; todos são extração
de verdade.

E a Fase 3 continua com seis telas, agora com o rodapé e o estado vazio já
resolvidos em todas — que é exatamente o que a Fase 4 prometeu fazer por elas.
