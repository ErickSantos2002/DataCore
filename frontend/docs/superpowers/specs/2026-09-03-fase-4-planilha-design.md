# A exportação para Excel vira `src/lib/planilha.ts`

Decidido em 03/09/2026, logo depois de fechar o item 2. É o **item 3 da Fase 4**,
adendo ao `2026-08-25-datacorehs-design-system-design.md`, que governa a
modernização, e continuação de `2026-09-01-fase-4-blocos-comuns-design.md`.

## Este item não se parece com os dois anteriores, e vale dizer por quê

O `MultiSelect` apagou 737 linhas. O `Pagination` apagou 699. Este aqui apaga
**cerca de 40**: nove funções de exportação, cada uma com o mesmo esqueleto de
quatro linhas.

Se o critério fosse volume, ele não valeria a fase. O que o justifica é outra
coisa: **sete dos nove arquivos carregam o mesmo defeito**, e ele é o defeito que
a Fase 1 já corrigiu uma vez, em Contas. Extrair aqui não é economizar linhas —
é fazer com que só exista um lugar onde esse erro possa ser cometido.

## O que se repete e o que varia

Nove arquivos de produção montam planilha, com nove funções de exportação e
**dez abas** — `financeiro/AbaComissao.tsx` é a única que monta duas abas no
mesmo arquivo ("Vendas" e "Serviço"). Em todas, o mesmo esqueleto:

```ts
const ws = XLSX.utils.json_to_sheet(dadosExport);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "<aba>");
XLSX.writeFile(wb, `<prefixo>_<data>.xlsx`);
```

O que **varia** é só a montagem das linhas, e é variação de domínio legítima:
Produtos exporta seis colunas (`Código`, `Produto`, `Quantidade Vendida`…),
Clientes exporta nove, com `Última Compra` formatada em `pt-BR` e um `Status`
derivado. **Isso continua em cada tela** — não é duplicação, é o conteúdo.

## O defeito, e onde ele está

**Sete dos nove montam o nome do arquivo com `new Date().toISOString()`**, que é
UTC. Quem exporta depois das 21h no horário de Brasília arquiva com a data do dia
seguinte.

| Arquivo                      | Nome do arquivo   | Estado                     |
| ---------------------------- | ----------------- | -------------------------- |
| `Clientes.tsx`               | `toISOString()`   | **UTC**                    |
| `Estoque.tsx`                | `toISOString()`   | **UTC**                    |
| `Produtos.tsx`               | `toISOString()`   | **UTC**                    |
| `Servicos.tsx`               | `toISOString()`   | **UTC**                    |
| `Vendas.tsx`                 | `toISOString()`   | **UTC**                    |
| `Vendedores.tsx`             | `toISOString()`   | **UTC**                    |
| `locacao/notasDeLocacao.ts`  | `toISOString()`   | **UTC** — e é tela migrada |
| `contas/contas.ts`           | `diaLocal(agora)` | correto                    |
| `financeiro/AbaComissao.tsx` | `dataDeHoje()`    | correto                    |

É o mesmo defeito registrado em `2026-08-31-contas-achados.md` — "o nome do
arquivo exportado saía em UTC; quem exporta à noite arquiva com a data do dia
seguinte" — encontrado mais seis vezes.

### O caso de Locação, que é o mais instrutivo

Locação **é tela migrada**, com teste de caracterização, e mesmo assim tem o
defeito. Os testes dela não o pegam, por dois motivos diferentes, e os dois
merecem ficar registrados:

- `Locacao.test.tsx:545` calcula a data esperada com o **mesmo**
  `new Date().toISOString()` que a tela usa, e o comentário admite: _"A tela usa
  `new Date().toISOString()`, que é UTC — o mesmo cálculo aqui."_ O teste
  concorda com a tela por construção, certa ou errada. É uma tautologia, e
  **estava certo escrevê-lo assim**: caracterização fixa o que existe, não o que
  deveria existir. O que faltou foi o passo seguinte.
- `locacao/notasDeLocacao.test.ts:93` testa `nomeDoArquivo` de verdade, com
  instante fixo — mas escolheu `2026-08-28T12:00:00Z`. Meio-dia UTC é 09:00 em
  São Paulo, **mesmo dia**: o teste passa nos dois fusos e nunca exercita a
  virada. A rede existe e é cega no ponto exato onde o defeito mora.

A lição para as próximas caracterizações: **um teste de data que escolhe o
meio-dia não testa fuso.** O instante tem de ser escolhido perto da virada, ou
não prova nada.

## A terceira duplicação, menor

Os dois arquivos que acertam o fazem com **implementações separadas da mesma
função**: `diaLocal` em `contas/contas.ts:258` e `dataDeHoje` em
`financeiro/AbaComissao.tsx:34`. Corpos equivalentes — `getFullYear`,
`getMonth() + 1`, `getDate()`, tudo com `padStart`.

`diaLocal` **não é função de planilha**: ela tem um segundo uso em
`contas.ts:286`, montando o intervalo do preset de período — que é justamente o
item 4 desta fase. Isso decide onde ela mora.

## As decisões

**`diaLocal` sobe para `src/lib/datas.ts`.** O arquivo existe desde as gêmeas e
foi criado para exatamente esta classe de defeito; hoje ele tem
`dataDeCalendario`, que resolve o problema irmão (`YYYY-MM-DD` lido em UTC volta
um dia). O `CLAUDE.md` já aponta `lib/datas.ts` como o lugar dos dois erros
recorrentes de data — este é um deles. `contas.ts` e `AbaComissao.tsx` passam a
importar de lá, e a cópia de `AbaComissao` é apagada.

**A extração leva o esqueleto, não o nome do arquivo.** `baixarPlanilha` recebe
as linhas já montadas, o nome da aba e **o nome do arquivo pronto**. Cada tela
continua calculando o nome que calcula hoje, inclusive errado. É o que permite
que os quatro testes que já existem sirvam de critério de aceitação da extração.

**Unificar e corrigir são movimentos separados**, pelo motivo de sempre: juntos,
não dá para saber qual dos dois quebrou. O conserto do UTC vem depois, tela a
tela, com plantação.

**Os dois testes de Locação são editados de propósito**, e as duas edições estão
escritas aqui antes de começar: o de tela para de replicar `toISOString`, e o
unitário troca `12:00Z` por um instante que exercite a virada (`23:00` em São
Paulo). **O unitário passa a falhar contra o código de hoje** — e é essa falha
que prova que ele deixou de ser cego.

## A peça final

```ts
// src/lib/planilha.ts
export interface AbaDePlanilha {
  nome: string;
  linhas: Record<string, unknown>[];
  /** Ajuste na folha depois de montada. Ver "A exceção de Vendedores". */
  ajustar?: (folha: XLSX.WorkSheet) => void;
}

export function baixarPlanilha(abas: AbaDePlanilha[], arquivo: string): void;
```

```ts
// oito consumidores, no lugar das quatro linhas
baixarPlanilha(
  [{ nome: "Produtos", linhas: dadosExport }],
  `produtos_${diaLocal(new Date())}.xlsx`,
);

// AbaComissao, que sempre montou duas abas no mesmo arquivo
baixarPlanilha(
  [
    { nome: "Vendas", linhas: linhasDeVendas },
    { nome: "Serviço", linhas: linhasDeServico },
  ],
  `comissao-${diaLocal(new Date())}.xlsx`,
);
```

### A exceção de Vendedores

`Vendedores.tsx` é a única das nove que **mexe na folha depois de montada**: ela
define `ws['!cols']` com nove larguras e varre as células das colunas `E` e `F`
pondo `t: "n"` e `z: "#,##0.00"`, para o valor sair como número contábil em vez
de texto. As outras oito entregam a folha como o `json_to_sheet` devolveu.

Por isso o `ajustar` opcional. É uma saída de emergência, e saída de emergência
é como se ganha uma prop por tela — o risco nomeado no item 1. O que a mantém
honesta é o escopo: ela recebe a folha e não devolve nada, quem chama já tem o
código pronto, e **o docblock diz que Vendedores é a única chamadora**. Se
aparecer uma segunda, é hora de perguntar se aquilo devia ser padrão em vez de
exceção.

A alternativa era deixar Vendedores fora da extração. Foi recusada porque o
esqueleto voltaria a existir em dois lugares, e o próximo a copiar copiaria o
de lá — que é exatamente como nove cópias nasceram.

**A lista de abas não é generalização especulativa.** A primeira versão desta
spec propunha uma `aba` só, e a auto-revisão derrubou: `AbaComissao` já monta
duas abas hoje, e uma assinatura de aba única a deixaria de fora da extração —
ou pediria uma segunda função. Um arquivo Excel tem N abas; é o modelo do
próprio `xlsx`, e é o formato do problema que existe.

`linhas` chega pronta. A função não sabe nada de domínio, não formata número,
não decide coluna — ela existe para que `json_to_sheet`, `book_new`,
`book_append_sheet` e `writeFile` apareçam **uma vez** no repositório.

## A ordem

**M1 — `diaLocal` sobe para `src/lib/datas.ts`.** Movimento pequeno e isolado:
a função ganha teste próprio no seu lar novo (incluindo um caso de virada de
dia, que é o que falta hoje), e os dois consumidores passam a importar. Nenhum
comportamento muda.

**M2 — extrair `baixarPlanilha`, sem tocar no nome do arquivo.** As nove funções
de exportação passam a chamá-la, oito com uma aba e `AbaComissao` com duas. Critério duro: **os quatro arquivos de teste
que já afirmam sobre exportação passam sem uma edição** — `ContasPagar.test`,
`ContasReceber.test`, `AbaComissao.test` e `Locacao.test`. Eles já mockam o
`xlsx` e capturam o que foi mandado para ele; se algum precisar mudar, a
extração alterou comportamento e volta atrás.

**M3 — o conserto do UTC nos sete**, tela a tela, cada uma com plantação. É aqui
que os dois testes de Locação são editados, com as duas edições declaradas
acima.

A ordem coloca `diaLocal` primeiro porque o M3 depende dela, e coloca o conserto
por último pelo motivo de sempre.

## O que NÃO entra

- **Migrar tela.** As seis continuam em `PENDENTES_FASE_3`.
- **Mexer na montagem das linhas.** As colunas de cada planilha são domínio; se
  alguma estiver errada, é achado para registrar, não para consertar aqui.
- **Levar a formatação de Vendedores para as outras oito.** Largura de coluna e
  formato contábil são coisa que só ela faz hoje; espalhar seria mudança de
  produto, não extração. Se as outras devem ganhar isso, é decisão à parte.
- **Os outros itens da Fase 4** — preset de período, `useIsMobile`, clique fora.
  O preset ganha de graça o `diaLocal` no lugar certo, e agradece.

## Riscos

**O maior: `baixarPlanilha` virar um canivete.** A tentação é ela receber os
dados crus e um mapa de colunas, ou formatar moeda, ou decidir o nome do
arquivo. Cada uma dessas seria uma prop por tela, que é como se ganha uma API
ruim — foi o risco nomeado no item 1 e continua valendo. A assinatura acima é
deliberadamente burra: linhas prontas, aba, arquivo.

**O segundo: o M3 mexer em teste que não devia.** Duas edições estão
autorizadas, ambas em Locação. Se aparecer uma terceira, a execução para.

**O terceiro: `AbaComissao` ser a única com duas abas.** Ela é o caso que a
assinatura precisa suportar e o único que exercita a lista com mais de um
elemento — se a extração for testada só com os oito casos de aba única, o
caminho de duas abas entra sem rede. O teste de `baixarPlanilha` cobre os dois.

## Como se sabe que terminou

- `grep -rn "json_to_sheet\|book_new\|book_append_sheet" src/` devolve
  ocorrências **apenas** em `src/lib/planilha.ts` e nos arquivos de teste que
  mockam o `xlsx`.
- `grep -rn "toISOString" src/pages/` não devolve nenhuma geração de nome de
  arquivo.
- `diaLocal` existe uma vez só, em `src/lib/datas.ts`, com teste de virada de
  dia; `dataDeHoje` não existe mais.
- Os quatro testes de exportação que já existiam passam sem edição depois do M2.
- O teste unitário de `nomeDoArquivo` de Locação exercita a virada e **falharia**
  contra o código de hoje.
- Suíte não regride e lint não sobe: baseline **1426 testes / 92 arquivos**,
  lint **119**, `tsc --noEmit` limpo.

## Depois deste plano

Sobram três itens: o preset de período (que já encontra `diaLocal` no lugar
certo), o `useIsMobile` e o clique fora. Nenhum tem defeito de correção
conhecido — são duplicação pura, e depois deles a Fase 4 acaba e a Fase 3 volta
com seis telas bem menores do que eram em agosto.
