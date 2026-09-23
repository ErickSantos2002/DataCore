# MultiSelect — as divergências que sobraram, para decidir

O `MultiSelect` estava copiado dentro de seis páginas — Produtos, Serviços,
Vendedores, Estoque, Clientes e Vendas. Não eram seis usos do mesmo
componente: eram seis componentes diferentes com o mesmo nome, declarados
dentro da própria página, que divergiram em duas dimensões. A forma da opção
(`string[]` em quatro telas, `{value,label}` em duas) e a busca, que virou
quatro estratégias distintas.

A fase extraiu o primitivo e trocou as seis telas. Ela **não consertou nada**,
de propósito — é o método herdado das gêmeas ContasReceber/ContasPagar:
unificar e corrigir são passos separados, porque juntos não dá para saber qual
dos dois quebrou. A prova de que a unificação não mudou comportamento é que os
testes de caracterização passaram sem edição, com uma exceção por tela, prevista
e autorizada (o painel deixou de fechar ao marcar). Essa exceção é só a face
mais visível de uma mudança mais larga: nenhum render do componente pai fecha
mais o painel, não só a marcação — ver o item 6.

O que sobrou é este documento. Os itens 1 a 4 são divergências de
comportamento, e cada uma está hoje **fixada em teste** com o comportamento
atual, esperando decisão. Os itens 5, 6 e 8 não são comportamento e não há
teste que os trave: são a forma do código (5), uma dívida nos próprios testes
(6) e mudanças de aparência para conferir no navegador (8). O item 9 — o texto
do estado vazio escrito de duas formas — **está fixado em teste** como os
quatro primeiros: 13 asserções citam a forma atual, e trocá-la custa editar
todas elas. O item 10, da fase seguinte, traz duas divergências no mesmo
molde — tamanho de página e substantivo da contagem — **fixadas em teste** nas
seis telas, e mais uma decisão de aparência sem teste que a cubra, para a
conferência no navegador.

O item 11, da mesma fase, é o primeiro que registra um defeito **corrigido**
em vez de preservado: o nome do arquivo exportado saía em UTC em onze lugares.
O que ele deixou pedindo decisão foram quatro coisas, e **nenhuma estava fixada
em teste** — uma prop com chamadora única, o preset de período que continuava
em UTC (isento por lista que só encolhe), duas datas de dado fora do alcance do
guarda, e uma duplicação de PDF que sobreviveu à correção. O preset de período
foi o item seguinte da mesma fase, e fechou — ver item 12 abaixo.

O item 7 era o único que não pedia escolha entre dois comportamentos
defensáveis — era regressão de acessibilidade — e **deixou de ser pendência**:
foi resolvido na fase de 02/09/2026. Ele continua aqui como registro do que
ficou decidido. Fora ele, nada aqui está decidido.

O item 12, também da mesma fase, segue o molde do item 11: um defeito
**corrigido** (as cinco telas montavam o preset de período com o rótulo
mentindo sobre o que a chave calculava), e nenhuma pendência nova fixada em
teste — só achados para quem migrar cada tela na Fase 3, e um caso em que a
investigação **não achou defeito nenhum**, registrado justamente por isso.

## 1. As quatro buscas

O primitivo recebe a estratégia por injeção — a prop `buscarPor`, com
`buscaPorTexto` de padrão. As quatro vivem em
`src/design-system/ui/forms/buscaDeMultiSelect.ts`, puras e testadas em
separado.

| Estratégia                    | Telas              | Acha por                                                                          |
| ----------------------------- | ------------------ | --------------------------------------------------------------------------------- |
| `buscaPorTexto` (padrão)      | Produtos, Estoque  | só o rótulo, sem diferenciar maiúscula                                            |
| `buscaPorTextoOuNumero`       | Serviços           | rótulo, ou os dígitos do rótulo contra os dígitos do termo                        |
| `buscaPorCnpjEntreParenteses` | Vendedores, Vendas | rótulo, ou o CNPJ entre parênteses — normalizando só quando o termo é todo dígito |
| `buscaPorRotuloValorOuNumero` | Clientes           | rótulo, valor cru, ou os dígitos do valor                                         |

A pergunta que este item põe: **unificar tudo na busca mais rica** — rótulo,
valor e dígitos — significa que Produtos e Estoque passam a achar por número, o
que hoje não fazem.

A consequência prática de hoje é essa: quem procura uma empresa digitando o
CNPJ sem pontuação acha em Vendas e não acha em Produtos. É a mesma pessoa, o
mesmo hábito, e o resultado depende da tela em que ela está. Unificar é
melhoria, mas é mudança de comportamento visível — decisão do Erick, não efeito
colateral de refactor.

## 2. Dois ramos mortos, mortos por motivos diferentes

Este é o achado mais interessante da fase, e a distinção importa porque leva a
decisões opostas.

**O ramo morto de Clientes é morto pelos dados.** Em
`buscaPorRotuloValorOuNumero` a condição que casa o valor cru
(`opcao.valor.toLowerCase().includes(termo)`) é inalcançável **como a tela de
Clientes monta os dados hoje**: `clientesUnicos` (`Clientes.tsx:134`) constrói o
`value` com `cpf_cnpj.replace(/\D/g, "")`, ou seja, já só com dígitos. Daí
`valor === valorNormalizado` sempre, e as duas condições viram a mesma expressão
booleana quando o termo é todo dígito; termo com qualquer pontuação nunca casa a
do valor cru, porque não há pontuação no valor para casar. Foi provado por
execução na Task 5, não no papel: apagada a condição, os sete testes de Clientes
continuaram passando — não por falha do teste, mas porque nenhum termo consegue
isolá-la.

**Ele foi mantido de propósito.** O primitivo é do design system e pode receber
opções de outra procedência, com valor pontuado ou com letra, onde a condição
volta a ser alcançável em separado. O caso concreto está no teste
`buscaDeMultiSelect.test.ts:135`, com a opção `{ valor: "P2", rotulo: "Tubo
descartável" }`: o termo `"p"` não tem dígito e não está no rótulo, então só a
condição do valor cru explica o `true`. Apagar resolveria Clientes e quebraria
em silêncio essa forma de opção.

**O ramo morto de `buscaPorCnpjEntreParenteses` é morto pela matemática.** As
cópias de Vendedores e Vendas tinham uma terceira condição —
`cnpj.toLowerCase().includes(termo)`, o CNPJ ainda pontuado contra o termo cru —
que é morta para _qualquer_ entrada possível. O CNPJ é extraído do próprio
rótulo por `rotulo.match(/\((.*?)\)/)`, então é sempre substring literal dele;
tudo que essa condição casa, a condição do rótulo já casou antes. Isso não
depende de dado nenhum: não há como torná-la alcançável sem mudar a forma da
regex.

**Esse já saiu.** Ele não entrou na estratégia extraída na Task 7, e as seis
cópias que o carregavam não existem mais — o código morto foi embora com elas.
O item fica registrado aqui não para decidir se sai, mas porque a decisão foi
tomada por análise e convém que ela esteja escrita: se alguém reencontrar essa
condição em outra tela e achar que faltou, a resposta é que ela não fazia nada.

A decisão que este item põe, então, é só sobre o de Clientes: mantê-lo custa
zero e protege um uso futuro do primitivo, ou a tela de Clientes passa a guardar
o `value` com pontuação como as outras e a condição vira alcançável ali também.

## 3. Serviços não tem o guard de "termo todo dígito"

Vendedores e Vendas só normalizam o termo quando ele é todo dígito
(`/^\d+$/.test(termo)`): quem digita `"a11"` procura o texto `"a11"`, não o
número `11`. Serviços normaliza sempre — `"x11"` acha o rótulo cujos dígitos
contêm `11`.

É divergência real, e foi travada em teste na Task 7
(`buscaDeMultiSelect.test.ts:65` e `:88`) justamente para que uma unificação
descuidada não a apagasse em silêncio.

Nas duas direções: **pôr o guard em Serviços** deixa a busca mais previsível —
texto é texto, número é número — e tira de quem digita um código misturado com
letra a chance de achar pelos dígitos. **Tirar o guard de Vendedores e Vendas**
torna a busca mais permissiva e passa a devolver resultado numérico para termos
que a pessoa escreveu como texto, o que produz o falso positivo que o guard
existe para evitar. As duas são defensáveis; nenhuma é neutra.

## 4. O ponto cego da suíte

O plano mandava, tela por tela, passar a estratégia "no filtro X; os outros
ficam no padrão". Isso estava errado, e virou a Ruling 7 do controlador: na
cópia existia **um só** `filteredOptions`, compartilhado por todas as instâncias
daquela tela. Passar a estratégia num filtro só faria os outros caírem no
`buscaPorTexto` padrão e perderem, em silêncio, a busca numérica que têm hoje.
Foi consertado em Serviços (Task 10, commit `1393609a`) depois de já ter
entrado, e prevenido nas demais.

O que torna isso digno de documento é a segunda metade: **a suíte não pega esse
erro.** Os revisores provaram por mutação, em quatro telas diferentes, que
remover o `buscarPor` de um filtro secundário deixa os testes verdes — em
Vendedores (filtro de produtos), em Clientes (produto e vendedor), em Vendas
(vendedores e produtos) e em **Serviços (cidade)**: removido o `buscarPor` do
filtro de cidade, os 7 testes de `Servicos.multiselect.test.tsx` continuam
passando (conferido de novo agora: removido, roda, verde; recolocado, `git
status` limpo). Só o filtro que a caracterização exercita morde. Um
estreitamento futuro nesses filtros passaria despercebido.

Serviços tinha sido excluído do item por engano — o raciocínio original era
que o teste "no filtro de tipos, acha pelo número digitado sem pontuação"
(`Servicos.multiselect.test.tsx:226`, commit `1393609a`) já cobria a tela,
mas esse teste exercita o filtro de **tipos**, não o de **cidade**: são dois
filtros diferentes, cada um com sua própria instância de `buscarPor`
(ver o item 4 acima, "um só `filteredOptions`" era o problema da cópia — o
primitivo tem uma prop por instância). Cobrir tipos não diz nada sobre
cidade.

A decisão: vale acrescentar um teste que exercite um **segundo** filtro? Vale
para **quatro telas**, não seis — o resto da lista já está fora por motivo
próprio. Estoque tem **um só** `MultiSelect` (`Estoque.tsx:452`) — não existe
segundo filtro para exercitar. E nem Produtos nem Estoque passam `buscarPor`
em uso nenhum, então não há estratégia a perder: a mutação que este item
descreve é inócua nas duas.

Sobram **Vendedores, Clientes, Vendas e Serviços** — as quatro onde a mutação
foi provada, com **seis filtros** ao todo (Vendedores/produtos,
Clientes/vendedor, Clientes/produto, Vendas/vendedores, Vendas/produtos,
Serviços/cidade). Mas o custo não é "seis `it` e pronto": para o teste morder,
o termo precisa ser aceito pela estratégia injetada e recusado pela
`buscaPorTexto` padrão, e em várias delas o fixture de hoje não permite
escrever esse termo.

**Clientes** é a única que já dá sem tocar no fixture, e só no filtro de
produto: os rótulos são `"Bafômetro Phoebus (P1)"` e `"Tubo descartável
(P2)"`, e o termo `"x1"` casa a condição dos dígitos de
`buscaPorRotuloValorOuNumero` (dígitos do termo = `"1"`, dígitos do rótulo =
`"1"`) sem casar o texto. Um `it`, nada mais. O filtro de vendedor da mesma
tela não serviria — o rótulo não tem dígito nenhum.

**Vendedores**, no filtro de produto, não dá: `buscaPorCnpjEntreParenteses`
exige termo todo dígito, e o único dígito entre parênteses (`"1"`, `"2"`) já é
substring literal do rótulo — a condição de texto vence antes. Varri todos os
termos todo-dígito de 0 a 9999 contra os dois rótulos do fixture: nenhum separa
a estratégia do padrão.

**Vendas** não dá em filtro nenhum. Os itens do fixture não têm `codigo`
(`Vendas.multiselect.test.tsx:39` e `:50`) e `Vendas.tsx:190` monta
`` `${descricao} (${codigo})` ``, então o rótulo sai com `"(undefined)"` — zero
dígito entre parênteses. O filtro de vendedores também não, porque nome de
vendedor não tem parênteses para a regex achar.

**Serviços**, no filtro de cidade, é o caso intermediário. `buscaPorTextoOuNumero`
é a mais barata das quatro estratégias porque não tem o guard de "termo todo
dígito" que `buscaPorCnpjEntreParenteses` exige — mas ainda assim, com o
fixture de hoje (cidades "Recife" e "Olinda", nenhuma com dígito), não existe
termo que separe a estratégia do padrão: sem dígito no rótulo, a condição dos
dígitos nunca casa. Não precisa da reestruturação que Vendedores e Vendas
exigem (um campo `codigo` novo, um rótulo `"(codigo)"` inteiro para montar) —
basta um dígito dentro de um nome de cidade já existente, o mesmo tipo de
plantio mínimo que Serviços já fez para o filtro de tipos (`"Manutenção
preventiva 1.234"`). Ainda é plantio, só que menor.

O custo real, então, são **seis `it` mais o plantio de dado no fixture em
três telas** (Vendedores, Vendas e Serviços) — o de Serviços mais barato que
o dos outros dois, mas não gratuito. Os quatro arquivos já têm o `abrir` e o
`campoDeBusca` de que o teste precisa; o que falta é o dado.

A alternativa é deixar só a nota: custo zero agora, e o buraco continua aberto
para quem mexer nesses filtros sem ler este documento. A diferença entre as duas
é quem paga — a suíte hoje, ou a próxima pessoa que estreitar um filtro sem
perceber.

## 5. Não existe `dePares`

A divisão é por filtro, não por tela. Dos 15 usos do primitivo, **13 passam por
`deTextos`**, que monta o par com `valor === rotulo` a partir de `string[]`. Os
outros **dois** vieram de listas `{value,label}` que já existiam e precisaram de
um `.map` inline de renomeação:

```tsx
opcoes={produtosUnicos.map((o) => ({ valor: o.value, rotulo: o.label }))}
```

Está em `Estoque.tsx:453` e `Clientes.tsx:603`. Clientes é o caso que mostra que
a divisão não é por tela: o filtro de clientes usa o `.map`, e os de vendedor e
produto da mesma tela usam `deTextos` (`:617`, `:631`).

Vendedores é um terceiro formato, e vale explicar por que ele **não** conta como
problema: `produtosUnicos` (`Vendedores.tsx:136`) guarda pares, e o uso descarta
o valor com `deTextos(produtosUnicos.map(p => p.label))` (`:517`). Nada se perde
— o rótulo já carrega o código (`descricao (codigo)`, montado em `:142`) e o
filtro da tabela casa exatamente essa string (`:158`), então o rótulo _é_ a
identidade. E o par não tem função nenhuma: a chave de deduplicação do `Map` é
`i.codigo` (`Vendedores.tsx:141`), e o par é só o **valor** — exatamente como em
`Produtos.tsx:179` e `Vendas.tsx:189`, que deduplicam pela mesma chave e guardam
`string` no valor. Ou seja, o campo `value` de Vendedores nunca é lido, e removê-lo
não ameaça deduplicação nenhuma. É redundância, não defeito — quem decidir sobre
`dePares` precisa saber que este caso não é cliente dele.

Nenhum helper foi criado, de propósito, para não estourar o escopo das trocas.
Há dois pontos para quem decidir: se um `dePares` deve existir, e se ele deve
ser memoizado. A perda de estabilidade de referência não é só dos dois `.map`
inline: `deTextos` (`buscaDeMultiSelect.ts:23`) também faz `textos.map(...)` e
aloca array novo a cada render, e ela é quem alimenta os outros **13** usos, não
só os dois de cima. Ou seja, o problema é dos 15 sítios, não de 2. Sem
consequência hoje — o primitivo não é `React.memo`, então nada rerenderiza a
mais por causa disso — mas é exatamente o tipo de coisa que passa a doer no dia
em que alguém memoiza o primitivo e não entende por que não adiantou.

## 6. Dívidas de teste herdadas

Pequenas, reais, e baratas de quitar agora.

O teste chamado **"marcar de novo desmarca, e 'Limpar seleção' zera tudo"**
existe nas seis telas, e em **três** ele nunca reclica o checkbox — o corpo marca
uma opção e clica em "Limpar seleção", só. O nome promete duas coisas e o teste
faz uma. São `Produtos.multiselect.test.tsx:134`,
`Servicos.multiselect.test.tsx:184` e `Vendedores.multiselect.test.tsx:211`.

As outras três já foram quitadas durante a fase e servem de modelo: Clientes
(`:299`), Estoque (`:216`) e Vendas (`:203`) reclicam o mesmo checkbox e asserem
a volta ao placeholder antes de testar o "Limpar seleção" isoladamente — ver
`Clientes.multiselect.test.tsx:308-315` e os equivalentes. Quitar as três que
faltam é copiar esse bloco: cinco linhas por tela — o reclique, as três da
asserção do placeholder e a remarcação antes do "Limpar seleção", sem a qual o
resto do teste fica sem seleção para limpar.

O ramo de desmarcar já tem cobertura própria no primitivo desde o commit
`785a1b09` (`MultiSelect.test.tsx:25`), então o buraco é de nome, não de
cobertura real.

O comportamento novo — **o painel não fecha ao marcar** — está provado só
implicitamente nas seis telas, como efeito colateral do teste acima. Ele tem
`it` explícito no primitivo (`MultiSelect.test.tsx:50`); nas telas, é uma
suposição que o teste depende mas não afirma. Um `it` por tela transformaria a
mudança autorizada numa afirmação.

E a mudança é mais larga do que "não fecha ao marcar" registra. A causa raiz
não é a marcação: é que o componente deixou de ser declarado dentro da
página. Nas seis cópias, `onChange` recriava o componente a cada render do
pai e ele remontava do zero, resetando `isOpen` — e _qualquer_ render do pai
disparava isso, não só o de marcar uma opção. Medido contra a base: com o
dropdown de empresas aberto em Vendas, digitar na busca **da tabela**
(um filtro que não tem nada a ver com o dropdown) fechava o painel antes, e
não fecha mais agora; o mesmo valia para mudar a data, ordenar uma coluna ou
um refresh de dados. Marcar um checkbox é só o caso que os testes de
caracterização exercitam — é o mais fácil de notar, não o único.

Sobre ponteiros de comentário, o critério importa mais que a contagem, então
vale declará-lo: **conta como dívida o ponteiro que aponta para código que não
existe mais naquele arquivo**; não conta o que erra a linha por uma ou duas,
porque esses são inevitáveis e inofensivos — o leitor acha o alvo olhando em
volta.

Pelo critério, a dívida não são dois: são **dez**, espalhados em cinco
arquivos, e o escopo do item era curto — não é só Clientes.

Os dois originais estão em `src/pages/Clientes.multiselect.test.tsx`: a linha
**205** diz "A busca (~linha 592)" e a **225** diz `Clientes.tsx:601`. A busca
não mora mais em `Clientes.tsx` em linha nenhuma — mora em
`buscaDeMultiSelect.ts`, e quem seguir o ponteiro cai no cabeçalho do bloco de
filtros. As linhas 228 e 234 do mesmo arquivo _parecem_ ponteiros mas não são:
narram o que a Task 5 fez com `Clientes.tsx` na época, e continuam verdadeiras.

Os outros seis, conferidos um a um, afirmam no presente e apontam para código
que também já saiu do arquivo — a mesma extração que esvaziou `Clientes.tsx`
esvaziou os outros cinco:

- `Produtos.multiselect.test.tsx:145` diz que a função `normalizar` "existe no
  arquivo" mas nunca é chamada; `grep normalizar src/pages/Produtos.tsx` não
  devolve nada — ela não existe mais ali.
- `Estoque.multiselect.test.tsx:186` cita `option.label.toLowerCase().includes(searchLower)`
  como o que "o filtro só faz"; esse trecho não existe em `Estoque.tsx` — a
  busca mora em `buscaPorTexto`, em `buscaDeMultiSelect.ts`, com outros nomes
  de variável.
- `Vendedores.multiselect.test.tsx:22,182,198` cita `option.match(/\((.*?)\)/)`
  e `/^\d+$/.test(searchTerm)` como o que "o MultiSelect daqui" faz; nenhum dos
  dois trechos existe em `Vendedores.tsx` — moraram em
  `buscaPorCnpjEntreParenteses`, com os parâmetros renomeados para `opcao` e
  `termo`.
- `Vendas.multiselect.test.tsx:22,164,180` repete a mesma dupla de citações,
  com o mesmo problema, também ausente de `Vendas.tsx`.

Deriva de linha existe, e não é só de Clientes: `~linha 133` para
`clientesUnicos`, hoje a 134 (`Clientes.multiselect.test.tsx:22` e `:213`);
`~linha 167` para `empresasUnicas`, hoje a 168 (`Vendas.multiselect.test.tsx:20`);
`~linha 259` para o filtro da tabela, hoje a 261
(`Clientes.multiselect.test.tsx:275`). Todos trazem o `~` que já avisa que são
aproximados. Ficam como estão.

A fusão do item 7 criou um ponteiro desses e o quitou no mesmo movimento. O
cabeçalho de `src/pages/contas/FiltrosDeContas.multiselect.test.tsx` dizia que o
arquivo fora escrito "contra `MultiSelectDeContas` como ela é hoje" e que
"depois que Contas passar a consumir o primitivo, ele tem que passar SEM UMA
EDIÇÃO" — duas frases que a fusão tornou falsas, porque a peça velha não existe
mais e o arquivo tem uma edição, a autorizada do item 9. O comentário foi
reescrito para dizer o que é verdade agora: caracterização escrita contra a peça
velha, hoje afirmando o primitivo, com a divergência de texto do vazio anotada
como a única aceita. Nenhuma asserção foi tocada.

## 7. A sétima cópia — fundida em 02/09/2026 (histórico)

`src/pages/contas/MultiSelectDeContas.tsx` era a sétima implementação do mesmo
widget: 156 linhas, compartilhadas por ContasReceber e ContasPagar. Ela esperava
de propósito — promover a primitivo antes das seis telas migrarem seria decidir a
API sem ver os seis usos. As seis migraram, e a fase
`2026-09-02-multiselect-acessibilidade` fez a fusão.

**A peça velha não existe mais.** `grep -rn "MultiSelectDeContas" src/` devolve
só o comentário histórico no cabeçalho da caracterização de Contas — nenhuma
referência de código. Os três filtros de Contas consomem o primitivo, que hoje
tem **18 usos**: 15 nas seis telas e 3 em `contas/FiltrosDeContas.tsx`.

O que ficou decidido:

- **O primitivo é dono do rótulo.** `rotulo` virou prop obrigatória, e o gatilho
  leva `aria-labelledby` apontando para o `<label>` e para o `<span>` do estado:
  o nome acessível é `"<rótulo> <estado>"` — "Empresas 3 selecionado(s)". Os 15
  `<label>` soltos das telas saíram junto, e com eles 15 pares de
  `text-gray-700 dark:text-gray-300` (de 70 para 55). A regressão de
  acessibilidade que este item registrava acabou.
- **Disclosure com `role="group"`, não listbox.** Um botão que abre um painel de
  checkboxes não é uma lista de opções. As opções continuam sendo
  `<input type="checkbox">` de verdade, e é assim que os 41 testes de
  caracterização das seis telas as acham — `getByRole("checkbox")`, 37 consultas
  ao todo, mais 10 na de Contas. Ir a `role="listbox"`/`role="option"` trocaria
  uma incoerência de nome por uma de fato, e derrubaria essa rede inteira.
- **O `aria-haspopup="listbox"` não foi portado.** A peça velha declarava o papel
  e entregava um `<div>` comum. O único `aria-haspopup` que sobrou como atributo
  está em `SearchSelect.tsx`, onde há `role="listbox"` e `role="option"` para
  sustentá-lo — e a ausência no primitivo está travada em teste:
  `MultiSelect.test.tsx` afirma `not.toHaveAttribute("aria-haspopup")` e
  `queryByRole("listbox")` nulo.

A fusão deixou também uma lição de layout que teste de unidade nenhum pegaria.
Ela está no item 8, porque quem a resolve é a conferência no navegador.

**O que continua aberto:** a **casca compartilhada com o `SearchSelect`**. Ela
ficou de fora de propósito — o `SearchSelect` é de seleção única, guarda
`value: string`, fecha ao escolher e tem navegação por seta; mesma casca, modelo
de seleção diferente. Agora que os dois lados têm o papel ARIA que de fato
entregam, a pergunta fica bem posta, mas ninguém a decidiu.

## 8. O tamanho da opção mudou em duas telas — acrescentar à conferência no navegador

Não é cor, então não é a mistura de paleta já aceita como consequência
inevitável das cinco telas ainda não migradas (ver
`.superpowers/sdd/2026-09-01-fase-4-multiselect/progress.md`: "a conferência
no navegador é feita uma vez, no fim das seis... se a mistura estiver feia...
nenhum trabalho se perde" — essa nota cobre `dark:`/paleta crua, não tamanho
de fonte).

O primitivo renderiza `<span className="text-conteudo">` para o texto de cada
opção, sem `text-sm` — `MultiSelect.tsx:184`, e nessa linha desde `c0040d2b`.
Este item foi escrito com o ponteiro em `:139`, quando o `<span>` estava de fato
em `:137`; ele andou 47 linhas desde então, e não foi tudo do item 7: **10
vieram do commit do Escape** (`2346f65b`, o ouvinte de teclado na raiz) e 37 do
commit do rótulo (`c0040d2b`, o `<label>` e o `role="group"`).

Conferido contra as seis cópias antes da extração: **Clientes**
(`git show 5f0fe921~1:src/pages/Clientes.tsx:663`) e
**Servicos** (`git show aab23f77~1:src/pages/Servicos.tsx:550`) tinham
`text-sm text-gray-700 dark:text-gray-200`; as outras quatro não tinham
`text-sm` — Produtos, Vendedores e Vendas tinham só `text-gray-700
dark:text-gray-200` (sem tamanho), e Estoque não tinha `<span>` nenhum, o
texto saía cru dentro do `<label>`.

Efeito prático: nas telas de Clientes e Servicos, as opções do dropdown
ficaram **maiores** do que eram antes da extração (perderam o `text-sm`); nas
outras quatro, o tamanho não mudou. É mudança de aparência real, não diferença
de paleta — por isso não está coberta pela decisão já tomada sobre `dark:` e
cores. Acrescentar à conferência no navegador que a fase já previu: olhar o
dropdown aberto de Clientes e Servicos ao lado de uma das outras quatro e
decidir se o tamanho maior fica ou se `text-sm` volta para a classe do
`<span>` no primitivo.

### E o que Contas perdeu na fusão do item 7

A fusão foi descrita como "sem mudança de comportamento", e é verdade — mas
comportamento não inclui aparência, e as duas peças não se pareciam. As três
telas de Contas herdaram o visual do primitivo, e a diferença **não tem teste
que a cubra**, porque nada disso é comportamento.

O caso que mais custa é a **borda de "campo aberto"**. A peça velha alternava a
cor da borda do gatilho — `border-action` quando aberto, `border-borda` quando
fechado —, e o primitivo é sempre `border-borda`. É afordância visual perdida
nos três filtros de Contas: nada na borda distingue mais o campo aberto do
fechado.

O resto é tipografia e acabamento, na mesma direção:

| onde               | peça velha                                                                    | primitivo                                                        |
| ------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `<span>` da opção  | `text-sm text-conteudo`                                                       | `text-conteudo`                                                  |
| `<label>` da opção | `transition-colors` (`MultiSelectDeContas.tsx:138`)                           | sem `transition-colors` (`MultiSelect.tsx:176`)                  |
| estado vazio       | `<p>` com `text-sm text-conteudo-muted`                                       | `<div>` sem `text-sm`                                            |
| campo de busca     | `bg-surface-base`, `rounded-md`, `text-sm`, `placeholder:text-conteudo-faint` | `bg-surface`, `rounded`, sem `text-sm`, sem regra de placeholder |
| checkbox           | `accent-action`                                                               | sem `accent-*`                                                   |
| "Limpar seleção"   | `rounded-md` com `transition-colors`                                          | `rounded`, sem `transition-colors`                               |

Os ponteiros para `MultiSelect.tsx` desta seção valem a partir de `c0040d2b`; os
de `MultiSelectDeContas.tsx` são o conteúdo dela em `488c5c80~1`, o último commit
antes do `git rm`.

**É dívida do primitivo, não da fusão.** As seis telas já viviam assim desde a
extração; foi a fusão que fez Contas passar a sofrer também. Entra na mesma
conferência no navegador: olhar os três filtros de Contas abertos, decidir se a
borda de campo aberto volta — no primitivo, valendo para os 18 usos — e se o
`text-sm` volta junto com o do item acima.

### Por que esta conferência não é opcional

A fusão quase entrou com o painel por cima do próprio gatilho, nas seis telas, e
a suíte teria passado verde. A markup prescrita pelo plano trocava a raiz do
primitivo de `relative` para `relative flex flex-col gap-1.5` e não dizia nada
sobre o painel — que é `absolute` **sem `top`** e dependia da posição estática.
Com a raiz em flex, o Flexbox posiciona o filho absoluto no topo do content box:
medido no Chrome headless, o painel saltava de `botão.bottom + 4px` para
`container.top + 4px`, cobrindo o rótulo e o gatilho. Foi corrigido com um
`top-full` no painel, a mesma âncora que `SearchSelect` e a peça velha já usavam.

jsdom não faz layout, então nada disso aparece em teste de unidade — e é por isso
que este item existe. **Geometria não se prova com a suíte.**

## 9. O texto do estado vazio tem duas formas no design system

Descoberto na fusão do item 7. Eram três formas da mesma cópia:

| peça                                               | texto                          |
| -------------------------------------------------- | ------------------------------ |
| `MultiSelect` (primitivo)                          | `Nenhum resultado encontrado`  |
| `MultiSelectDeContas` (apagada)                    | `Nenhum resultado`             |
| `Table` (`MENSAGEM_VAZIO_PADRAO`) e `SearchSelect` | `Nenhum resultado encontrado.` |

Na fusão o texto do primitivo ganhou — 15 usos contra 3, e ele já estava
publicado —, e a variante curta morreu com a peça velha. Ganhar custou as
**duas** únicas asserções autorizadas da fase, em
`FiltrosDeContas.multiselect.test.tsx` e em `ContasPagar.test.tsx`.

Sobraram duas, e a diferença entre elas é um ponto final. A convenção escrita
(`CLAUDE.md:122`) manda pôr ponto em **frase de erro**, e vazio de dropdown não é
erro — então ela não decide este caso sozinha. Estendê-la a estado vazio é o
caminho mais simples e põe `Table` e `SearchSelect` do lado certo, deixando o
`MultiSelect` como o único a destoar; mas é extensão, não regra já dada, e é
essa extensão que precisa ser aceita ou recusada.

`Pagination` não entra na conta: com zero resultados ele devolve `null` e não
escreve frase nenhuma — o texto só aparece em `Pagination.test.tsx`, afirmando a
ausência.

A decisão: pôr o ponto no `MultiSelect` e ficar com uma cópia só, ou aceitar que
o vazio de um dropdown se escreva diferente do vazio de uma tabela. Custo de
unificar, contado: **uma linha** de produção (`MultiSelect.tsx:188`, nessa linha
desde `c0040d2b`) e **13 asserções** de teste que citam o texto sem ponto — nos
seis arquivos de caracterização das telas, no de Contas, no de ContasPagar e em
`MultiSelect.test.tsx`.

## 10. `Pagination` — o item 2 da Fase 4, e o que ele preservou de propósito

Fechado em 03/09/2026. As seis telas que ainda rolavam a própria paginação —
Clientes, Estoque, Produtos, Serviços, Vendas e Vendedores — passaram a
consumir o `Pagination` do design system e o hook novo
`src/hooks/usePaginacao.ts`, com `TableEmpty` no `<tbody>`. O método é o mesmo
do MultiSelect: unificar sem mudar comportamento primeiro, corrigir depois. Os
detalhes da execução — os três defeitos que a adoção matou e os números da
medição — estão em `2026-09-03-fase-4-pagination-design.md`; este documento
registra só o que sobrou pedindo decisão, do mesmo jeito que fez com as
buscas do `MultiSelect`.

Duas divergências foram preservadas, com o comportamento atual fixado em
teste nas seis:

| Tela       | Itens por página | Substantivo da contagem |
| ---------- | ---------------- | ----------------------- |
| Clientes   | 15               | registros               |
| Estoque    | 15               | registros               |
| Produtos   | 10               | **produtos**            |
| Serviços   | 15               | registros               |
| Vendas     | 10               | registros               |
| Vendedores | 10               | registros               |

**Tamanho de página.** `pageSize` é prop do primitivo — unificar o componente
não obrigou a uniformizar o número, e as seis continuam pesando 10 ou 15 exatamente
como antes. Se um dia o produto quiser todas na mesma contagem, é decisão de
produto, não efeito colateral de refactor.

**Substantivo da contagem.** `itemLabel` também é prop, e o default do
primitivo já é "registros" — por isso cinco telas não passam nada e só Produtos
passa `"produtos"`. É a mesma forma de divergência inofensiva que o item 1 já
registrou para as buscas do `MultiSelect`: nenhuma das duas está errada, são
domínios diferentes descrevendo a própria listagem.

**O que ficou decidido, sem pedir escolha:** a forma compacta de celular — `<`,
a página atual, `>` — subiu do markup copiado das seis para dentro do
`Pagination`, e **Contas passou a herdá-la sem ter pedido**, porque era a única
consumidora do primitivo antes deste item. É item novo para a conferência no
navegador nos dois temas, que segue pendente desde o item 1 da Fase 4: olhar o
rodapé de Contas abaixo de `md` e confirmar que o rodapé de celular que ela
ganhou de graça não atrapalha a tela de dinheiro.

Junto na mesma conferência, um segundo item: **com uma página só, as seis
telas passam a mostrar um rodapé completo que antes não existia.** O spec
autoriza como exceção a frase de contagem aparecer sozinha nesse caso, mas o
que o primitivo de fato renderiza é maior — a frase mais os botões `Anterior`,
`1` e `Próxima`, os três desabilitados, onde antes o `{totalPaginas > 1 &&
...}` escondia o bloco inteiro. É inerente ao `Pagination`, não dá para adotar
o primitivo e evitar isso, mas nenhuma das seis caracterizações cobre o caso —
os fixtures usam 17 ou 12 itens, sempre duas páginas ou mais — e vale olhar no
navegador antes de considerar resolvido.

### Três achados colaterais, de fora deste item

Apareceram durante a execução, são de outras telas ou fases, e ninguém vai
lembrar deles se não ficarem escritos.

**O comparador de ordenação de `Produtos.tsx` nunca devolve 0**
(`src/pages/Produtos.tsx:400-402`, `aVal > bVal ? 1 : -1` nos dois ramos): itens
empatados saem em ordem que depende só do motor JS, não de regra nenhuma. É o
mesmo defeito que a Fase 3 já achou e corrigiu em Dashboard e Locação. As
outras cinco telas desta fase — Clientes, Estoque, Serviços, Vendas e
Vendedores — têm exatamente o mesmo padrão nas mesmas duas linhas do próprio
comparador. Fica fora do escopo deste item porque não é paginação; vira
trabalho de quem migrar essas seis telas na Fase 3.

**`Vendas.tsx` não termina em newline.** Pré-existente — já estava assim em
`main` antes desta fase tocar o arquivo. E não é a única: das seis telas
deste item, só `Produtos.tsx` termina em newline; Clientes, Estoque, Serviços
e Vendedores têm o mesmo formato de Vendas. Não vale linha própria por tela;
vale o registro de que existe, para quem for atrás de "por que o prettier
reformata isso" não achar que foi este item que introduziu.

**Violar o contrato do `usePaginacao` derruba a tela, não degrada em
silêncio.** O hook exige que a lista recebida venha de um `useMemo` com os
filtros na dependência — é o que garante que o reset de página dispara só
quando a lista muda de verdade, não a cada render. Passar uma lista recriada a
cada render faz o reset rodar durante o próprio render, produzir outra
referência nova, disparar outro reset, e o React aborta com "Too many
re-renders" em vez de paginar errado por baixo do capô. Está no docblock do
hook (`src/hooks/usePaginacao.ts`), e vale a menção aqui porque é a garantia
de que ninguém vai violar o contrato por acidente sem notar — a tela cai na
hora, alto e claro.

## 11. A exportação para Excel — o item 3 da Fase 4, e o defeito de fuso que ele desenterrou

Fechado em 04/09/2026. `json_to_sheet` + `book_new` + `book_append_sheet` +
`writeFile` estavam copiados em nove arquivos; hoje o esqueleto existe em um só,
`src/lib/planilha.ts`, e as nove telas consomem `baixarPlanilha`. `diaLocal`
subiu para `src/lib/datas.ts`, onde já morava `dataDeCalendario`. Os detalhes da
execução estão em `2026-09-03-fase-4-planilha-design.md` e em
`2026-09-03-fase-4-planilha-retomada.md`; aqui fica o que sobrou.

**A cópia carregava um defeito, e a cópia é que o espalhou.** O nome do arquivo
saía de `toISOString()`, que devolve o dia em **UTC**: às 23h de 28/08 em
Brasília já são 02h de 29/08 em UTC, e quem exportava à noite arquivava com a
data do dia seguinte. Onze ocorrências, em oito arquivos:

| Onde                                     | Formato              | Como estava                     |
| ---------------------------------------- | -------------------- | ------------------------------- |
| Produtos, Vendas, Vendedores             | `.xlsx`              | `new Date().toISOString()`      |
| Clientes, Estoque, Serviços              | `.xlsx` **e** `.pdf` | `new Date().toISOString()`      |
| `locacao/notasDeLocacao.ts`              | `.xlsx`              | `hoje.toISOString()`, parâmetro |
| `components/SolicitacaoComprasModal.tsx` | `.pdf`               | `new Date().toISOString()`      |

Sete das nove telas que exportam tinham o defeito. As duas que não tinham —
Contas e a aba de Comissão — já haviam sido consertadas na Fase 3, e é por isso
que o `diaLocal` existia em duas cópias antes deste item: cada conserto anterior
escreveu a sua.

**O plano previa sete, e eram onze.** Ele foi redigido em cima do `xlsx` e não
enxergou os `.pdf`, que montam o nome pela mesma expressão, na mesma tela, três
linhas abaixo. O décimo primeiro estava fora de `src/pages/` inteiramente —
`components/SolicitacaoComprasModal.tsx` —, e só apareceu no passo final de
conferência do spec, que varre `src/` e não `src/pages/`.

**Locação é o caso que vale guardar, porque ela tinha teste.** Era tela migrada,
com caracterização, e o defeito atravessou a migração inteira mesmo assim —
porque os dois testes que tocavam o nome do arquivo **pregavam o defeito**, cada
um do seu jeito:

- `Locacao.test.tsx:545` calculava a data esperada com o mesmo
  `new Date().toISOString()` que a tela usava. Concordava com a tela **por
  construção**, certa ou errada. Fixar o que existe é o método correto — o que
  faltou foi o passo seguinte, que é decidir o defeito em vez de deixá-lo
  pregado;
- `locacao/notasDeLocacao.test.ts:93` escolheu `12:00Z` como instante. Meio-dia
  cai no mesmo dia em São Paulo e em UTC, então a asserção nunca exercitou a
  virada.

**A lição, que vale além deste item: um teste de data que escolhe o meio-dia não
testa fuso.** O instante tem de ser escolhido perto da virada — e construído em
**hora local** (`new Date(2026, 7, 28, 23, 0, 0)`), nunca por string ISO, para a
asserção valer nos dois fusos sem consultar `process.env.TZ`. Com o instante
trocado, o teste falhou pela primeira vez em `TZ=America/Sao_Paulo`, pedindo
`locacao_2026-08-28.xlsx` e recebendo `locacao_2026-08-29.xlsx`.

**O que trava isso agora:** `src/test/guarda-planilha.test.ts`, quatro testes.
O esqueleto do `xlsx` só em `lib/planilha.ts`; nenhum
`new Date().toISOString()` em `src/` inteiro; nenhum `toISOString` numa tela já
limpa; e a lista de pendentes sem entrada obsoleta. Os quatro foram provados com
plantio — quebra plantada, falha observada, revertida.

### O que sobrou pedindo decisão

**`ajustar` tem uma chamadora só.** É a prop de `AbaDePlanilha` que deixa mexer
na folha antes de anexá-la ao livro, e existe porque `Vendedores` define largura
de coluna. Uma segunda chamadora é sinal de que aquilo devia ser padrão do
primitivo, não injeção — vale reavaliar quando aparecer.

**O preset de período continuava em UTC nas cinco telas**, e era o próximo item
da Fase 4 — fechado no item 12, abaixo. Estava isento no guarda pela lista
`PENDENTES_UTC`, que **só encolhe**: apagar a linha é parte de migrar a tela, e
o guarda falha se um arquivo da lista já estiver limpo. `Estoque` não está na
lista — ela exporta, mas não tem preset.

**Duas datas fora de nome de arquivo, que nenhum item da Fase 4 cobre.**
`context/DataContext.tsx:75` e `context/DashboardContext.tsx:187` montam data com
`toISOString`, e `Clientes.tsx:1133` exibe `ultimaCompra` em dd/mm/yyyy pelo
mesmo caminho. É a mesma família de defeito, mas é data de **dado** e de
**exibição**, não nome de arquivo. Ficam fora do guarda de propósito: estendê-lo
até `context/` exigiria uma segunda lista de isenção para um problema que
ninguém decidiu ainda.

**O PDF de solicitação de compras existe em dois lugares.** `Estoque.tsx:403` e
`components/SolicitacaoComprasModal.tsx:92` geram o mesmo
`solicitacao_compras_AAAA-MM-DD.pdf`, cada um com o seu `jsPDF`. Os dois tinham
o mesmo defeito de UTC e os dois foram corrigidos, mas a duplicação em si não
foi tocada — não é planilha, e ninguém decidiu qual das duas é a boa.

## 12. O preset de período — o item 4 da Fase 4, e o rótulo que mentia para quem lia

Fechado em 04/09/2026. `periodoDoPreset` e `PRESETS_DE_PERIODO` moram em
`src/lib/periodo.ts` desde o item 11 preparar o terreno (`diaLocal` já estava
em `src/lib/datas.ts`); cinco telas — Produtos, Vendas, Vendedores, Serviços e
Clientes — trocaram o próprio `switch (presetPeriodo)` pela função
compartilhada, uma tarefa por tela (Task 3 a Task 7). Os detalhes da execução
estão em `docs/superpowers/specs/2026-09-04-fase-4-preset-periodo-design.md` e
no ledger `.superpowers/sdd/2026-09-04-fase-4-preset-periodo/progress.md`;
aqui fica o que sobrou.

**O que mudou para quem usa.** As cinco cópias carregavam o mesmo defeito que
o item 11 já tinha nomeado (1.3): o rótulo "Mês atual" ficava preso à chave
`30dias`, que não calculava trinta dias nenhum — calculava do dia 1 do mês até
HOJE, nunca até o fim do mês. "Ano atual" tinha o mesmo formato de defeito: de
1º de janeiro até HOJE, nunca até 31/12. Conferido na cópia de antes da Task 3
(`git show cecaf5a2:src/pages/Produtos.tsx:128-147`): a variável `fim` nasce
como `hoje.toISOString()` antes do `switch`, e nem o ramo `"30dias"` nem o
`"anoAtual"` a sobrescreviam — só `inicio` mudava. Depois da troca:

- **"Mês atual" ganhou chave própria** (`mesAtual`, antes inexistente) e passa
  a cobrir o mês inteiro, do dia 1 ao último — não mais "até hoje". Uma conta
  emitida dia 20 deixa de sumir do filtro só porque hoje é dia 15.
- **"Ano atual" vai até 31/12**, não mais até hoje.
- **A chave `30dias` passou a fazer o que o nome sempre disse fazer.** Antes
  ela nunca tinha calculado trinta dias — o rótulo "Mês atual" que ficava
  preso a ela mentia sobre o cálculo real. Agora `30dias` é uma janela rolante
  de fato, com o rótulo "Últimos 30 dias". É a única opção genuinamente
  **nova** para quem usa as cinco telas: antes não existia forma de pedir uma
  janela de 30 dias corridos.

**Contas ganhou "Últimos 7 dias", aditivo.** Ao contrário das cinco telas —
que já tinham essa opção —, `pages/contas/contas.ts` não tinha `7dias` na
própria lista antes da Task 2 (conferido em `git show
31b826e3:src/pages/contas/contas.ts`, a base do item). É a única mudança em
Contas que este item trouxe; as outras cinco opções mantêm o comportamento que
Contas já tinha, porque `"mesAtual"` e `"anoAtual"` já eram calculados do jeito
certo lá — o defeito 1.3 era só das cinco telas, não de Contas.

### A investigação do filtro que não deu em nada

Uma versão anterior do documento de design deste item (`2026-09-04-fase-4-preset-periodo-design.md`)
afirmou que o filtro manual de `dataInicio`/`dataFim` das cinco telas — o
segundo mecanismo de data, que este item não toca, distinto do preset —
escondia as notas emitidas hoje. A suspeita: `data_emissao` chegando como
`"2026-09-04T00:00:00"` (sem `Z`, parseado como hora **local**) contra um
`dataFim` `"2026-09-04"` (parseado como meia-noite **UTC**) — em Brasília os
dois virariam instantes diferentes e `new Date(n.data_emissao) <= new
Date(dataFim)` reprovaria a nota do próprio dia.

**O mecanismo era real; a premissa não era.** `DataContext.tsx:70-79` e
`ServicosContext.tsx:68-79` normalizam `data_emissao` para data pura
(`AAAA-MM-DD`) antes de entregar às telas — nenhuma das duas pontas da
comparação chega com hora. Rodado contra o pipeline de verdade, os dois lados
viram meia-noite UTC igualmente e a nota de hoje aparece. A suspeita nasceu de
um formato que existe no repositório (`Locacao.test.tsx` monta data com hora),
mas não é o formato que essas duas telas recebem.

**A lição, registrada para não se repetir:** verificar o mecanismo não é
verificar o defeito. Um defeito só é defeito depois de alguém seguir o dado
real da API até o ponto de comparação — não até onde o código _parece_ poder
quebrar.

### Três achados colaterais, de fora deste item

**O filtro do `Servicos` diverge das outras quatro, e é o mais robusto — mas
não corrige defeito nenhum** (ver investigação acima). `Servicos.tsx:157-159`
monta `new Date(dataInicio + "T00:00:00")` e `+ "T23:59:59"` — parse local
explícito, com borda de fim de dia — em vez de comparar `new Date(...)` direto
como as outras quatro. Fica registrado porque é uma terceira forma de montar
filtro de data no repositório — a quarta, contando `emissaoDe`/`filtrarContas`
de Contas abaixo — e quem um dia unificar filtros de tabela (não é este item,
nem está no escopo da Fase 4) tem aqui as formas já mapeadas.

**A normalização de `DataContext.tsx:75` passa por `toISOString()`, num bloco
cujo próprio comentário diz "Conversão segura da data para local (sem UTC)".**
O código constrói `new Date(ano, mes-1, dia)` — local, correto — e extrai
`.toISOString().split("T")[0]` — UTC de novo. A ida e volta é identidade a
oeste de Greenwich (Brasília inclusa: meia-noite local mais três horas
continua no mesmo dia em UTC), então funciona hoje; a leste do meridiano,
deslocaria um dia. E as quatro telas (não Serviços) **dependem** dessa
normalização continuar existindo para os dois lados do filtro seguirem
concordando — funciona, e é frágil: um comentário que promete uma coisa
enquanto o código faz outra, sustentando um filtro que só está certo por
causa dele. Data de **dado**, não de nome de arquivo — fora do alcance do
`guarda-planilha`, e ninguém decidiu corrigi-lo ainda.

**`emissaoDe` (`pages/contas/contas.ts:82-84`) não normaliza a data — só
converte para `string`.** `filtrarContas` (`:290-291`) compara essa string
direto contra `filtros.dataInicio`/`dataFim` com `<`/`>`, uma comparação
lexicográfica que só funciona porque a API do Tiny devolve `AAAA-MM-DD` para o
campo de emissão hoje. Não há `dataDeCalendario` nem validação de formato no
meio: se o formato mudar, ou se algum dialeto (`DialetoDeContas`) apontar para
um campo em outro formato, o filtro erra em silêncio — sem exceção, sem teste
que acuse, só resultado errado. Registrado, não corrigido: nenhum item da Fase
4 cobre `contas.ts`.

### O que sobrou pedindo decisão

**Os rótulos divergem entre as cinco telas, em dois eixos.** Produtos, Vendas
e Vendedores usam "Período Rápido" + "Data Início"/"Data Fim"; Clientes e
Serviços usam "Período" + "Início"/"Fim". Nenhuma foi renomeada — são telas em
`PENDENTES_FASE_3`, e renomear rótulo é mudança de aparência, fora do escopo
de um item que só troca o cálculo por baixo. Fica para quem migrar cada tela
na Fase 3.

**As cinco telas não têm um único `htmlFor`.** Os `<label>` do filtro de
período são irmãos dos campos, nunca associados — confirmado por
`grep -c htmlFor` zerado nas cinco antes deste item. É por isso que os cinco
arquivos de teste (`*.periodo.test.tsx`) acham o campo por travessia de texto
(`screen.getByText(rótulo).parentElement`) em vez de `getByLabelText`, o
contorno que `ContasPagar.test.tsx` já usa neste repositório. É lacuna de
acessibilidade real, não só decisão de teste — o mesmo tipo de regressão que o
item 7 corrigiu no `MultiSelect`, ainda presente aqui porque as cinco telas
seguem fora da Fase 3.

**"Últimos 7 dias" entrou em Contas sem teste de caracterização próprio.** Foi
acrescentado em `ContasPagar.test.tsx` (Task 2), no mesmo arquivo onde cada um
dos outros quatro presets (`30dias`, `mesAtual`, `anoAtual`, `todos`) tem o
seu `it`. O ramo está coberto no teste unitário de `periodoDoPreset` e nas
cinco telas que o exercitam via `*.periodo.test.tsx`, mas não em Contas
especificamente — se alguém quebrar só o fio entre o `<select>` de Contas e
`periodoDoPreset("7dias", ...)`, a suíte de Contas não morde.

### O que trava isso agora

`src/test/guarda-planilha.test.ts` — o mesmo guarda do item 11, cuja lista
`PENDENTES_UTC` cobria as cinco telas por causa deste defeito. Chegou a uma
entrada só, `"src/pages/Clientes.tsx"`, e por um motivo que não é este item: a
exibição de `ultimaCompra` em dd/mm/aaaa (`Clientes.tsx:1112`), um segundo
`toISOString` fora do preset, registrado à parte no item 11 acima. As quatro
tasks das telas que ficam de fato limpas — T3 (Produtos), T5 (Vendas), T6
(Vendedores) e T7 (Serviços) — apagaram a própria linha ao migrar; T4
(Clientes) manteve a dela, porque `ultimaCompra` não sai com o preset. O
terceiro teste do guarda — "nenhuma entrada da lista de pendentes esta
obsoleta" — rodou verde antes mesmo da Task 8 tocar o arquivo,
prova de que o mecanismo "a lista só encolhe" funcionou tarefa a tarefa, sem
precisar de um esvaziamento manual no fim.

## O que a fase entregou

Nenhuma das seis cópias sobrou: `grep -rn "const MultiSelect" src/pages/`
devolve zero (a sétima peça, `MultiSelectDeContas`, é o item 7 acima e sempre
esteve fora deste escopo). Nos seis `.tsx` de tela, **783 linhas removidas e
51 acrescentadas** — líquido −732, contra as ~737 que o spec previa.

O branch inteiro contra a `main`, **medido antes deste documento entrar** (no
commit `54abc751`), são 21 commits e 20 arquivos, 3222 inserções contra 783
remoções; a maior parte das inserções são os testes de caracterização, que antes
não existiam.

Naquela mesma medição, ainda dentro da fase anterior, a suíte estava em **1357
testes / 84 arquivos**, `tsc --noEmit` limpo, e o lint em **120 problemas** —
eram 135 quando a fase começou. Caiu 15 sem ninguém ter ido atrás
disso, só apagando duplicação.

## O que vem depois

Os outros cinco itens da Fase 4, cada um com plano próprio a escrever. São
menores e mais mecânicos, e nenhum tem a decisão de API que este teve.

**Adotar o `Pagination`.** Não é extrair, é usar o primitivo que a Fase 1
construiu. Uma correção ao spec, conferida agora: ele **já tem um consumidor** —
`pages/contas/TabelaDeContas.tsx:300`, das gêmeas. São as seis telas desta fase
que ainda rolam paginação própria. Ele devolve `null` com zero resultados e
pressupõe `TableEmpty` no consumidor, que as seis ainda não têm.

**Extração para Excel em `src/lib/planilha.ts` — feita em 04/09/2026, item 11
acima.** O spec falava em sete arquivos montando `json_to_sheet` + `book_new` +
`book_append_sheet` + `writeFile` na mão; eram **nove** — as seis telas desta
fase mais `financeiro/AbaComissao.tsx`, `Locacao.tsx` e
`contas/TelaDeContas.tsx`. Hoje é um.

**Preset de período — feito em 04/09/2026, item 12 acima.** Cinco telas
tinham o mesmo defeito; hoje `periodoDoPreset` e `PRESETS_DE_PERIODO` moram em
`src/lib/periodo.ts`, que usa o `diaLocal` posto em `src/lib/datas.ts` pelo
item 11. A forma exata do defeito, para quem só ler este parágrafo: o rótulo
que a pessoa lia já dizia "Mês atual" nas cinco, mas o valor da opção era
`"30dias"`, e era ele que o `switch` casava — o ramo montava
`new Date(hoje.getFullYear(), hoje.getMonth(), 1)`, o primeiro dia do mês
corrente até HOJE, nunca trinta dias atrás e nunca até o fim do mês. Ou seja: a
interface não mentia para quem usava, o código mentia para quem lia.

**`useIsMobile` para `src/hooks/`.** Quatro cópias, em Produtos, Vendas,
Estoque e Clientes.

**Clique fora.** As seis cópias das telas morreram com o `MultiSelect` e
viraram um `useEffect` só, no primitivo (`MultiSelect.tsx:97`, desde
`c0040d2b`); a fusão do item 7 levou junto a de `MultiSelectDeContas`, que este
parágrafo listava. Ainda assim
não zerou: restam três implementações — a do primitivo, a de
`SearchSelect.tsx:82` e, em `Estoque.tsx:122`, uma variante que não é a mesma,
que fecha dois popovers de gráfico e escuta `mousedown` **e** `touchstart`. Um
hook que sirva às três precisa cobrir o toque e aceitar mais de um envolvente;
era o que o spec chamava de "provavelmente morre junto com o MultiSelect", e não
morreu.
