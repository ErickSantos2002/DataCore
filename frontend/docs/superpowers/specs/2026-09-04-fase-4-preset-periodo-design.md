# O preset de período vira `src/lib/periodo.ts`

Decidido em 04/09/2026, logo depois de fechar o item 3. É o **item 4 da Fase 4**,
adendo ao `2026-08-25-datacorehs-design-system-design.md`, que governa a
modernização, e continuação de `2026-09-01-fase-4-blocos-comuns-design.md`.

## Este item não é extrair — é adotar

Os três itens anteriores extraíram uma peça que não existia: o `MultiSelect`
virou primitivo, o `Pagination` foi adotado de um primitivo que a Fase 1 tinha
construído, e o `baixarPlanilha` nasceu do esqueleto repetido em nove telas.

Aqui a peça **já existe, já está certa e já está testada**.
`pages/contas/contas.ts` tem `periodoDoPreset(preset, agora)`, função pura
escrita durante a Fase 3, com 11 asserções, duas delas exercitando a virada do
dia e a do ano. Ela já respondeu esta mesma pergunta, e respondeu diferente do
que o resto do app responde. O item é fazer as cinco telas restantes adotarem a
resposta que Contas já deu.

É a mesma jogada do item 2, e é por isso que ele apaga pouca linha: cerca de
**160**, cinco blocos de 32 linhas byte a byte idênticos.

## O que se repete, e onde está a divergência

Cinco telas — `Clientes`, `Produtos`, `Servicos`, `Vendas` e `Vendedores` —
carregam o mesmo `useEffect` de 32 linhas. Eles são **byte a byte idênticos**:
mesmo `md5`, mesma indentação, mesmos comentários. Não há uma única divergência
entre as cinco **no bloco do preset** — o filtro que consome as datas, esse sim,
diverge em `Servicos`, e está tratado mais abaixo.

Isso é diferente do `MultiSelect`, que eram seis peças que discordavam entre si.
Aqui **toda a divergência é contra Contas**:

|                   | As cinco telas                                     | Contas (`periodoDoPreset`)                                   |
| ----------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| Chave `30dias`    | rotulada **"Mês atual"**, devolve 1º do mês → hoje | rotulada **"Últimos 30 dias"**, devolve 30 dias atrás → hoje |
| `mesAtual`        | não existe                                         | mês **inteiro**, dia 1 ao último                             |
| `anoAtual`        | 01/01 → **hoje**                                   | 01/01 → **31/12**                                            |
| `todos`, `custom` | iguais                                             | iguais                                                       |

O rótulo que mente é o achado que o documento de divergências já registrava: a
pessoa lê "Mês atual", o valor da opção é `"30dias"`, e o ramo do `switch` monta
`new Date(hoje.getFullYear(), hoje.getMonth(), 1)` — o primeiro dia do mês
corrente, não trinta dias atrás. **A interface não mente para quem usa; o código
mente para quem lê.**

Contas resolveu isso separando os dois em opções distintas, e registrou no
docblock por que o mês passou a terminar no último dia: _"uma conta emitida dia
20 sumia do 'mês atual' enquanto hoje fosse dia 15"_.

## O defeito — e o que parecia ser um segundo, e não era

### O preset monta a data em UTC

`hoje.toISOString().split("T")[0]` devolve o dia em UTC. Em `anoAtual` o bloco
mistura `getFullYear()` (local) com `toISOString()` (UTC), que é textualmente o
defeito que `contas.ts:257` documenta. É o defeito que o `PENDENTES_UTC` do
`guarda-planilha` rastreia hoje, com as cinco telas na lista.

Adotar `periodoDoPreset`, que sai de `diaLocal`, resolve. **É o único defeito
deste item.**

### O filtro: investigado, e está correto

Este documento afirmou, numa versão anterior, que o filtro escondia as notas
emitidas hoje. **Estava errado, e o registro fica porque o erro é instrutivo.**

As cinco filtram com `new Date(n.data_emissao) <= new Date(dataFim)`, e a
suspeita era que `data_emissao` chegasse como `"2026-09-04T00:00:00"` — sem `Z`,
parseado como hora **local** — contra um `dataFim` `"2026-09-04"`, parseado como
meia-noite **UTC**. Em Brasília os dois viram instantes diferentes e o `<=`
reprovaria a nota do dia.

O mecanismo é real. **A premissa não era:** `DataContext.tsx:70-79` e
`ServicosContext.tsx:68-79` normalizam `data_emissao` para data pura antes de
entregar às telas. Os dois lados do `<=` chegam como `AAAA-MM-DD`, os dois são
parseados como meia-noite UTC, e a comparação está certa. Rodado contra o
pipeline real: a nota de hoje aparece.

**A lição:** verificar o mecanismo não é verificar o defeito. O formato com hora
existe no repositório — em `Locacao.test.tsx` —, e foi de lá que a suspeita veio.
Um defeito só é defeito depois de alguém seguir o dado da API até a comparação.

Fica registrado o que a investigação achou de verdade, tudo fora deste item:

- **O filtro do `Servicos` diverge das outras quatro** (`Servicos.tsx:179-180`),
  usando `new Date(dataInicio + "T00:00:00")` e `+ "T23:59:59"`. É parse local
  explícito com borda de fim de dia — **mais robusto** que o das outras quatro,
  não menos.
- **A normalização do `DataContext` passa por `toISOString()`** (linha 75), num
  bloco cujo comentário diz "sem UTC". A ida e volta é identidade a oeste de
  Greenwich, então funciona aqui; a leste, deslocaria um dia.
- As quatro dependem dessa normalização continuar existindo para o `new Date`
  dos dois lados seguir concordando. Funciona, e é frágil.

## As decisões

**1. As cinco adotam o comportamento de Contas, sem preservar o atual.** Contra
o método herdado das gêmeas ("unificar e corrigir são passos separados"), porque
aqui não existe unificar sem corrigir: a peça que sobrevive é a de Contas, e ela
já tem o comportamento decidido. Preservar o atual significaria escrever uma
segunda função de período no repositório para depois convergir — o oposto do que
o item quer.

**2. O menu vira um só, com SEIS opções — e Contas também ganha.** Escrever o
plano revelou o que esta seção não tinha visto: adotar a lista de Contas como
ela é faria as cinco telas **perderem** "Últimos 7 dias", que elas têm e Contas
não — e pior, silenciosamente, porque `periodoDoPreset` não tem ramo `7dias` e a
escolha cairia no `default`, virando "Todos".

A saída é `periodoDoPreset` ganhar o ramo `7dias` (sete dias atrás até hoje, o
mesmo molde do `30dias`, e exatamente o que as cinco já faziam) e a lista
compartilhada ficar com seis: `todos`, `7dias`, `30dias`, `mesAtual`, `anoAtual`
e `custom`. As cinco telas ganham `mesAtual`; Contas ganha `7dias`. Aditivo dos
dois lados — nada some de lugar nenhum, e o app inteiro passa a oferecer o mesmo
menu, que é o objetivo do item.

**3. `periodoDoAno` e `periodoDaBarra` ficam em Contas.** São clique em barra de
gráfico, domínio dela, sem segundo consumidor. Sobem `Periodo`,
`periodoDoPreset` e `periodoDoMes` — esta última porque `periodoDoPreset`
depende dela.

**4. A lista de opções também é compartilhada.** `PRESETS_DE_PERIODO` vive no
mesmo módulo, e `FiltrosDeContas.tsx` passa a consumi-la. Sem isso sobraria uma
sexta cópia da lista de opções — exatamente o defeito que o item existe para
matar, sobrevivendo à sua própria correção.

**5. O filtro das cinco NÃO é tocado.** A investigação acima mostrou que ele
está correto. Mexer em cinco filtros que funcionam, sem defeito para mostrar e
sem teste que consiga demonstrar diferença de comportamento, é risco sem
retorno. O que a investigação achou vai para o documento de divergências.

**6. Os testes de `periodoDoPreset` NÃO precisam ser endurecidos — conferido, e
o contrário do que este documento supôs primeiro.** A suspeita era que eles
tivessem o ponto cego de Locação, porque vários casos usam
`new Date("2026-08-31T12:00:00Z")` — meio-dia, que cai no mesmo dia nos dois
fusos. Conferindo caso a caso: os de meio-dia testam **tamanho de mês** (março,
fevereiro), onde fuso não é o ponto, e existem **dois testes de virada de
verdade** — `viradaDoMes` e `viradaDoAno`, ambos em `02:00Z`, que é 23h do dia
anterior em Brasília. Um retorno a `toISOString` faria os dois falharem.

Eles resolvem a asserção nos dois fusos com um ternário sobre
`getTimezoneOffset()`, e não construindo o instante em hora local como o item 3
recomendou. É mais difícil de ler e igualmente correto; fica como observação,
não como trabalho deste item.

A função entra no item quase como está — a única mudança de corpo é o ramo
`7dias` da decisão 2. A quebra é vista no teste das cinco telas, que é onde a
fiação nova mora.

## A peça final

`src/lib/periodo.ts`:

- `Periodo` — o par `{ inicio, fim }`, movido de `contas.ts`;
- `periodoDoPreset(preset, agora)` — movido, sem mudança de corpo;
- `periodoDoMes(ano, indiceDoMes)` — movido, dependência da anterior;
- `PRESETS_DE_PERIODO` — a lista `{ value, label }` das **seis** opções, hoje só
  em `FiltrosDeContas.tsx` (onde se chama `PRESETS`, e tem cinco);
- o ramo `7dias` de `periodoDoPreset`, que não existia — ver decisão 2.

## Como se prova

**Uma correção ao que este documento supôs:** as cinco **têm** teste. Não em
`<Nome>.test.tsx`, que não existe, mas em `<Nome>.paginacao.test.tsx` e
`<Nome>.multiselect.test.tsx` — dez arquivos, escritos nos itens 1 e 2 desta
mesma fase. Eles já trazem o harness pronto: `vi.mock("../hooks/useAuth")` e
`vi.mock("../context/DataContext")` (ou `ServicosContext`, em `Servicos`), com
fixtures de nota e cliente montados à mão.

Isso muda a estratégia para melhor: **não se escreve harness novo.** O teste
deste item, `src/pages/<Nome>.periodo.test.tsx`, nasce por decalque do
`.paginacao.test.tsx` de cada tela — mesmo mock, mesmo formato de fixture, só o
fixture com datas escolhidas para separar as opções do dropdown.

Cinco arquivos, um por tela, seguindo a nomenclatura que os itens 1 e 2 já
fixaram. Cada um monta a tela, dirige o `<select>` de período e afirma as duas
datas resultantes nos campos e as linhas que sobram na tabela.

A ordem obriga a ver a quebra: o teste é escrito contra o comportamento **novo**
e roda **antes** de o `useEffect` sair. Ele tem de falhar — "Mês atual" ainda
devolvendo 01/09 a 04/09 em vez de 01/09 a 30/09 — e essa falha é a prova de que
o teste enxerga a fiação.

Estes cinco arquivos **não** são a caracterização que a Fase 3 vai pedir quando
migrar cada tela: cobrem só o preset, do mesmo jeito que os `.paginacao` cobrem
só a paginação.

## O que NÃO entra

- **Migrar as cinco telas para o design system.** Elas seguem no
  `PENDENTES_FASE_3`; o `<select>` continua markup cru. Este item troca a
  lógica, não a aparência.
- **O filtro das cinco.** Está correto — ver a investigação acima. A divergência
  do `Servicos` e a fragilidade das outras quatro vão para o documento de
  divergências.
- **O `toISOString()` dentro de `DataContext.tsx:75`**, no bloco que diz "sem
  UTC". Não é `src/pages/`, não é este item, e funciona a oeste de Greenwich.
  Registrado.
- **`emissaoDe` de Contas não normalizar a data.** Hoje é inofensivo, porque o
  campo de emissão de Contas é data pura. Registrado.
- **O `useIsMobile` e o clique fora**, que são os dois itens seguintes.

## Riscos

**A mudança é visível, em cinco telas, e ninguém pediu.** "Mês atual" passa a
significar outra coisa, e quem usa o filtro todo dia vai notar. A defesa é que a
opção nova (`Últimos 30 dias`) preserva o comportamento antigo com o nome
honesto, então nada some — o que existia continua alcançável, com o rótulo
certo. Ainda assim é conferência no navegador, não só teste.

**O `PENDENTES_UTC` quase fica vazio — corrigido durante a execução, não fica
de todo.** A previsão aqui era que as cinco saíssem da lista e ela zerasse,
fazendo o terceiro teste do `guarda-planilha` (lista sem entrada obsoleta)
virar trivialmente verdadeiro. Quatro saem mesmo; a quinta, `Clientes.tsx`,
tem um segundo `toISOString` fora do preset (a exibição de `ultimaCompra`) que
esta spec não cobre, e apagar a linha dela quebraria o segundo teste do guarda
("nenhuma tela fora da lista monta data com `toISOString`"). A lista termina
com **uma** entrada, não vazia — ver "Como se sabe que terminou" abaixo, que
tem o critério certo.

## Como se sabe que terminou

- `grep -rn "presetPeriodo" src/pages/` não devolve nenhum `switch` — só o
  estado e o `<select>`.
- `grep -rn "toISOString" src/pages/` não devolve nada fora de comentário —
  **exceto** `Clientes.tsx:1112`, que não é preset: é a exibição de
  `ultimaCompra` em dd/mm/aaaa, fora do escopo deste item.
- **Corrigido durante a execução:** `PENDENTES_UTC` **não** fica vazio — fica
  com **uma** entrada, `"src/pages/Clientes.tsx"`, pelo motivo acima. A
  previsão original (lista vazia) só valeria se `Clientes.tsx` não tivesse um
  segundo `toISOString` fora do preset; como tem, esvaziar a lista quebraria o
  segundo teste do `guarda-planilha` ("nenhuma tela fora da lista monta data
  com toISOString"). O critério que vale é: a lista tem uma entrada, e o
  comentário acima dela explica por quê — não vazia, e não apagada.
- `periodoDoPreset`, `periodoDoMes` e `Periodo` existem uma vez só, em
  `src/lib/periodo.ts`; `contas.ts` importa de lá.
- A lista de opções existe uma vez só, e `FiltrosDeContas.tsx` a consome.
- O filtro das cinco está **intocado**: `git diff` não mostra mudança nas linhas
  de comparação de data.
- Os cinco testes de período **falham** contra o `useEffect` antigo, visto antes
  de ele sair — não por plantio, mas porque a ordem os põe primeiro.
- As cinco telas respondem ao dropdown com as datas de Contas, provado pelo
  teste das cinco.
- Suíte não regride e lint não sobe: baseline **1437 testes / 94 arquivos**,
  lint **118**, `tsc --noEmit` limpo, verde em `TZ=UTC` e
  `TZ=America/Sao_Paulo`.

## Depois deste plano

Sobram dois itens da Fase 4: o `useIsMobile` (quatro cópias de doze linhas) e o
clique fora (três implementações, uma delas diferente das outras). Nenhum tem
defeito de correção conhecido — são duplicação pura. Depois deles a Fase 4 acaba
e a Fase 3 volta, com seis telas bem menores do que eram em agosto.
