# O MultiSelect absorve a peça de Contas, e a acessibilidade se decide de uma vez

Decidido em 02/09/2026, logo depois de fundir o item 1 da Fase 4. Adendo ao
`2026-08-25-datacorehs-design-system-design.md`, que governa a modernização, e
consequência direta do item 7 de
`../2026-09-01-multiselect-divergencias.md`.

## O que a fase anterior deixou para trás

O item 1 da Fase 4 extraiu o `MultiSelect` que vivia copiado dentro de seis
telas e fez as seis consumirem um primitivo do design system. Ao fechar a conta,
apareceu o que a lista da fase não contava: **existe uma sétima implementação do
mesmo widget**, `src/pages/contas/MultiSelectDeContas.tsx`, compartilhada por
ContasReceber e ContasPagar desde a unificação das gêmeas.

Ela não é descuido. O comentário dela explica a espera: promover a primitivo
antes das seis telas migrarem seria decidir a API sem ver os seis usos, "e é
assim que se ganha uma prop por tela"; quando as seis migrassem, a promoção
seria "um `git mv` com os seis usos na mão". As seis migraram. A condição que a
própria nota estabeleceu está satisfeita.

Só que a fusão não é simétrica, e é isso que torna esta fase uma decisão e não
um `git mv`.

## O que foi medido, e que muda o problema

**A peça velha é dona do próprio rótulo; a nova não é.** `MultiSelectDeContas`
recebe `rotulo` e liga o gatilho ao rótulo e ao valor por `aria-labelledby` com
dois ids — quem usa leitor de tela ouve "Situação, 2 selecionado(s)". O
primitivo novo tem só `aria-expanded`, e nas seis telas o `<label>` que aparece
acima dele é escrito na página, solto, sem `htmlFor`. O leitor anuncia "Todos os
produtos" e o nome do campo não entra. É o defeito 1.14, que a Fase 1 corrigiu
nas gêmeas, reintroduzido por herança das seis cópias — que também não o tinham.

**Mas a peça velha promete um `listbox` que não existe.** O gatilho declara
`aria-haspopup="listbox"` e o painel é um `<div>` comum, com os mesmos `<label>`
envolvendo `<input type="checkbox">` que o primitivo usa. Não há `role="listbox"`
nem `role="option"` em lugar nenhum. Ou seja: ela acerta o rótulo e erra o papel.

**E ela não tem teste nenhum.** `grep` por `MultiSelectDeContas` em arquivo de
teste devolve vazio. Os três filtros de Contas — a tela de dinheiro — estão sem
rede, enquanto o primitivo tem 41 testes de caracterização em cima.

**O contrato do design system está em três versões.** `Select` (nativo) e
`SearchSelect` (escolha única) são donos do rótulo por `htmlFor`; o `SearchSelect`
ainda tem `role="listbox"`, `role="option"` e Escape, porque ali o papel é
verdadeiro. `MultiSelectDeContas` usa `aria-labelledby`. O `MultiSelect` novo não
tem nada. Quatro peças, três contratos.

## As decisões

**Escopo: só os dois multi.** `MultiSelect` e `MultiSelectDeContas` são o mesmo
widget com dois nomes, e viram um. `SearchSelect` fica fora: é seleção única,
guarda `value: string`, fecha ao escolher e tem navegação por seta — mesma
casca, modelo de seleção diferente. Uma casca compartilhada entre os dois é
defensável e fica para depois; fundir agora o que é literalmente a mesma peça
entrega o ganho de acessibilidade nas seis telas sem dobrar a superfície de
teste. `Select` está fora por outro motivo: é um `<select>` de verdade.

**O `rotulo` é obrigatório.** Prop obrigatória, não opcional. Uma prop opcional
de acessibilidade é exatamente a que ninguém lembra de passar — foi assim que
chegamos aqui. Obrigatória, o TypeScript impede que alguém use o primitivo sem
rótulo, hoje e daqui a um ano. O custo é as seis telas serem tocadas outra vez,
e o ganho de quebra é que 15 `<label>` soltos com paleta crua saem dessas telas,
adiantando trabalho da Fase 3.

**A semântica é de checkbox honesto, não de listbox.** Um botão que abre um
painel de checkboxes **não é um listbox** — é disclosure, e é esse o padrão ARIA
que se aplica. Então: o `aria-haspopup="listbox"` da peça velha não é portado, o
painel ganha `role="group"` com `aria-label` do rótulo, e as opções continuam
sendo `<input type="checkbox">` de verdade.

A alternativa era ir a `role="listbox"` com `aria-multiselectable` e
`role="option" aria-selected`, coerente com o `SearchSelect`. Foi recusada por
duas razões: trocaria checkbox por opção selecionável, derrubando os 41 testes
que acham as opções por `getByRole("checkbox")` — a rede que a fase anterior
inteira existiu para construir —, e resolveria uma incoerência de nome trocando
por uma incoerência de fato, porque marcar várias caixas é o que a peça faz.

## A peça final, e o que muda em cada consumidor

```tsx
interface MultiSelectProps {
  rotulo: string; // NOVO, obrigatório
  opcoes: OpcaoDeMultiSelect[];
  selecionados: string[];
  onChange: (selecionados: string[]) => void;
  placeholder: string;
  buscarPor?: EstrategiaDeBusca; // default buscaPorTexto
}
```

`src/design-system/ui/forms/MultiSelect.tsx` continua sendo o lar;
`src/pages/contas/MultiSelectDeContas.tsx` é apagada.

**A raiz do primitivo passa a ser a da peça velha:**
`<div className="relative flex flex-col gap-1.5">` com o `<label id>` como
primeiro filho, depois o `<button aria-expanded aria-labelledby="{rotulo} {valor}">`
com o `<span id>` do estado dentro, e o painel. **O botão e o painel continuam
irmãos dentro dessa mesma `div`** — é disso que os `within(botao.parentElement!)`
dos testes dependem, e o `<label>` entrar ali não muda a relação.

**15 usos nas seis telas:** ganham `rotulo` e a página apaga o `<label>` que
escreve à mão hoje — o que de quebra tira 15 pares de
`text-gray-700 dark:text-gray-300` dessas telas.

**3 usos em Contas:** `opcoes={deTextos(...)}` e `selecionadas` → `selecionados`.
O resto é igual: a busca de Contas já é a padrão, então nem `buscarPor` precisa.

Três precisões, para não sobrar interpretação:

- **O `rotulo` recebe exatamente o texto do `<label>` que sai.** Em Produtos são
  "Empresas", "Vendedores" e "Produtos"; nas outras cinco, o que estiver escrito
  no `<label>` daquele filtro. Renomear rótulo é mudança de produto e não está
  nesta fase.
- **O `<div>` que envolve cada filtro na página FICA.** Ele é a célula do grid
  (`grid-cols-1 md:grid-cols-2 lg:grid-cols-6`); só o `<label>` interno sai. Quem
  apagar o `<div>` junto quebra o layout dos filtros.
- **O `gap-1.5` substitui o `mb-1`** que os `<label>` das páginas usam hoje:
  0,375rem no lugar de 0,25rem. É o padrão do design system, e entra na lista da
  conferência no navegador.

## O preço da acessibilidade, medido antes de decidir

Acrescentar `aria-labelledby` ao gatilho **muda o nome acessível dele**, e os 41
testes acham o gatilho exatamente por esse nome:
`getByRole("button", { name: "Todos os produtos" })`.

Isso foi medido, não suposto. Uma sonda descartável renderizou o gatilho com
`aria-labelledby` apontando para rótulo e valor:

- `"Todos os produtos"` → **não casa mais**
- `"Produto Todos os produtos"` → **casa**

Contadas as consultas afetadas nos seis arquivos de teste: **30**, sendo 12
dentro dos helpers `abrir`/`containerDoFiltro` (dois por arquivo) e 18 soltas
no corpo dos testes. As 6 consultas a `"Limpar seleção"` não são afetadas,
porque aquele botão não tem `aria-labelledby`.

Trinta edições mecânicas, todas do mesmo tipo: o nome esperado passa a ser
`"<rótulo> <valor>"`. Cada uma delas **é** a afirmação do ganho — o teste passa
a exigir que o nome do campo seja anunciado junto com o estado.

## A ordem, e por que ela é essa

Três movimentos. A ordem importa e é contraintuitiva.

**M1 — caracterizar Contas, sem tocar em nada.** Um teste dos três filtros
contra `MultiSelectDeContas` como ela é hoje: abrir, buscar, marcar, desmarcar,
limpar, fechar ao clicar fora — e o nome acessível `"Situação, 2 selecionado(s)"`
que ela já entrega. Contas nunca teve rede; agora tem. E, o que importa mais,
esse teste vira o **critério de aceitação do M3**, escrito contra a peça que já
faz certo.

**M2 — o primitivo alcança a peça velha.** Ganha `rotulo` obrigatório,
`aria-labelledby` no gatilho, `role="group"` no painel, `aria-label` no campo de
busca e `Escape` para fechar devolvendo o foco ao gatilho. O
`aria-haspopup="listbox"` não entra. As seis telas passam `rotulo` e apagam o
`<label>` solto. **É aqui que as 30 consultas mudam.**

**M3 — Contas passa a consumir o primitivo**, e `MultiSelectDeContas.tsx` é
apagada. Critério duro, o mesmo da fase anterior: **a caracterização do M1 passa
sem uma edição.**

A ordem contraintuitiva é a acessibilidade vir **antes** da fusão. O instinto
diz o contrário — unificar primeiro, corrigir depois, que foi a regra da fase
anterior. Aqui ela se inverte por um motivo concreto: se a fusão viesse antes,
Contas _perderia_ o rótulo acessível durante um movimento inteiro, a
caracterização do M1 quebraria, e consertá-la exigiria editar o teste que existe
justamente para não ser editado. Invertendo, o M3 é uma fusão de verdade sem
mudança de comportamento, porque a essa altura o primitivo já faz tudo o que a
peça velha fazia.

O princípio por trás não mudou — **separar unificar de corrigir**. O que mudou
foi qual dos dois vem primeiro, e a resposta veio de medir onde a rede está.

## O que NÃO entra

- **`SearchSelect`.** Nem a fusão de casca com ele. É a próxima conversa.
- **Migrar tela.** As seis continuam em `PENDENTES_FASE_3`. O M2 apaga 15
  `<label>` com paleta crua porque eles saem junto com a prop nova, não porque
  esta fase migre alguma tela.
- **Navegação por seta entre as opções.** Num grupo de checkboxes, `Tab` já
  navega e é o comportamento nativo esperado. Seta é do padrão listbox, que
  recusamos.
- **Trocar o `<input type="checkbox">` cru pelo `Checkbox` do design system.**
  O `Checkbox` esconde o campo dentro de um `<span>` intermediário e mudaria a
  árvore que os 41 testes leem. Continua sendo item da Fase 2, como as duas
  peças já registram no próprio comentário.
- **Os outros itens do documento de divergências.** As quatro buscas, o ramo
  morto de Clientes, o `dePares`, as dívidas de teste. Continuam esperando
  decisão.

## Riscos

**O maior: o M2 editar mais do que as 30 consultas de nome.** É o movimento que
mexe em teste existente, e é onde uma mudança pode vazar sem ninguém ver. O
guarda é aritmético: 30 consultas, contadas por arquivo antes de começar
(Clientes 6, Estoque 6, Vendas 6, Produtos 4, Serviços 4, Vendedores 4). Se uma
falha aparecer fora dessa lista, a mudança vazou para além do rótulo e a
execução para.

**O segundo: Contas não ter rede na hora de mexer.** Mitigado por o M1 existir e
vir primeiro. Se o M1 for pulado ou feito por cima, o M3 vira exatamente o
"simples" que se disse das gêmeas antes de aparecerem 18 defeitos nelas.

**O terceiro: a mudança visual nas seis telas.** O rótulo sai da página e entra
no primitivo, então passa a ser pintado por token enquanto os campos vizinhos
ainda estão em paleta crua com `dark:`. É a mesma mistura que a fase anterior já
aceitou e registrou, agora um pouco maior. Entra na conferência no navegador,
que segue pendente.

## Como se sabe que terminou

- `src/pages/contas/MultiSelectDeContas.tsx` não existe mais, e os três filtros
  de Contas consomem o primitivo.
- O primitivo exige `rotulo` por tipo, anuncia "<rótulo>, <estado>" no gatilho,
  marca o painel como `role="group"`, rotula o campo de busca e fecha com
  `Escape` devolvendo o foco.
- Nenhum `aria-haspopup="listbox"` sobrou no repositório fora do `SearchSelect`,
  onde o papel é verdadeiro.
- As seis telas não escrevem mais `<label>` para os filtros de MultiSelect.
- A caracterização de Contas escrita no M1 passa sem uma edição depois do M3.
- Suíte não regride e lint não sobe: baseline **1357 testes / 84 arquivos**,
  lint **119**, `tsc --noEmit` limpo.

## Depois deste plano

O `SearchSelect` e o `MultiSelect` passam a ser as duas únicas peças de seleção
com busca do design system, com contratos que só diferem onde o modelo de
seleção difere. Se valer uma casca compartilhada entre os dois, é aí que a
pergunta fica bem posta — com os dois lados já corretos, em vez de um deles
sendo corrigido no mesmo movimento.
