# Fase 4 — os blocos que as seis telas repetem

Decidida em 01/09/2026, depois de fechar a tela 6. Adendo ao
`2026-08-25-datacorehs-design-system-design.md`, que governa a modernização.

## Por que agora, e não durante cada migração

A Fase 3 migra tela a tela. Restam seis — Produtos, Serviços, Vendedores,
Estoque, Clientes e Vendas —, **8.145 linhas sem um teste sequer**, cada uma
maior que a tela 6 inteira.

Medindo antes de começar, apareceu o que elas têm em comum, e é muito:

| Repetido em | O quê                          | Tamanho                                       |
| ----------- | ------------------------------ | --------------------------------------------- |
| 6 telas     | `MultiSelect`                  | **737 linhas**                                |
| 7 arquivos  | exportação para Excel          | montada à mão em cada uma                     |
| 6 telas     | paginação própria              | e o primitivo `Pagination` já existe, sem uso |
| 6 telas     | fechar dropdown ao clicar fora | o mesmo `useEffect` copiado                   |
| 5 telas     | preset de período              | com o mesmo defeito nas cinco                 |
| 4 telas     | `useIsMobile`                  | 12 linhas idênticas                           |

Só o `MultiSelect` é 9% de tudo o que falta migrar.

Extrair durante as migrações — que era o plano — produz um sistema
**meio-migrado por meses**: metade das telas consumindo o primitivo e metade
carregando a cópia, e cada tela nova tendo que decidir de novo qual dos
comportamentos divergentes adotar. Fazer a extração como fase própria deixa as
seis migrações seguintes muito menores e a decisão de API tomada uma vez só,
olhando os seis usos ao mesmo tempo em vez de um.

**O risco que isso parecia ter não existe.** Mexer em 8.145 linhas sem teste
seria às cegas — mas não é preciso caracterizar a tela para extrair um bloco
dela: basta caracterizar **o bloco**, onde ele vive. Um teste que abre o
`MultiSelect`, digita, filtra, seleciona e fecha ao clicar fora é pequeno, e é
tudo o que a extração precisa de rede.

**A duplicação está confinada às seis telas não migradas.** Nenhum outro
arquivo tem os blocos, com uma exceção: a exportação para Excel também vive em
`Locacao.tsx`, que já é migrada e tem teste de caracterização — se a extração
tocar nela, o teste avisa.

## O que a extração encontra: seis cópias que divergiram

O `MultiSelect` não é a mesma coisa copiada seis vezes. Ele divergiu em duas
dimensões, e é isso que torna a unificação uma decisão e não um `git mv`.

**A forma da opção:**

| Telas                                  | `options`                              |
| -------------------------------------- | -------------------------------------- |
| Produtos, Serviços, Vendedores, Vendas | `string[]`, no formato `"Nome (CNPJ)"` |
| Estoque, Clientes                      | `{ value, label }[]`                   |

Nas quatro primeiras o CNPJ é extraído do texto por regex nos parênteses. Nas
duas últimas ele vem separado, no `value`.

**A busca — quatro estratégias diferentes:**

| Tela               | Acha por                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Produtos           | só texto                                                                                 |
| Estoque            | só texto, pelo `label`                                                                   |
| Serviços           | texto, e número normalizando a opção inteira                                             |
| Vendedores, Vendas | texto, e CNPJ extraído dos parênteses — normalizando o termo só quando ele é todo dígito |
| Clientes           | `label`, `value` e número no `value`                                                     |

Em Produtos ainda existe um `normalizar` **declarado e nunca usado**: alguém
começou a portar a busca numérica e parou. É a assinatura do problema — a
mesma ideia sendo reimplementada seis vezes, cada vez um pouco melhor, sem
ninguém voltar nas anteriores.

**Consequência prática:** hoje, quem procura um cliente digitando o CNPJ sem
pontuação acha em Vendas e não acha em Produtos.

## Como fazer sem quebrar: o método das gêmeas

O mesmo que funcionou em ContasReceber/ContasPagar, e pelo mesmo motivo —
**separar unificar de corrigir**:

1. **Caracterizar o bloco onde ele vive.** Um teste por tela, focado no
   `MultiSelect` daquela tela: abrir, digitar, ver a lista filtrar, escolher,
   desmarcar, fechar ao clicar fora. Não é a tela inteira.
2. **Unificar sem mudar comportamento.** Critério de sucesso: **os testes de
   caracterização passam sem UMA edição.** É o que prova que a extração não
   mexeu em nada — o controle que só existe se a unificação vier sozinha.
3. **Só então as divergências**, uma a uma, cada uma com a asserção mudada de
   propósito e autorizada. A busca por CNPJ chegando a Produtos é melhoria,
   mas é mudança de comportamento e entra como decisão, não como efeito
   colateral de refactor.

## A ordem, por retorno

1. **`MultiSelect` → primitivo** (737 linhas, 6 telas). O maior retorno e a
   decisão de API mais difícil, então vem primeiro, enquanto o assunto está
   fresco. API proposta: `opcoes: { valor, rotulo }[]` — o par explícito
   cobre os dois formatos, com `valor === rotulo` para quem hoje passa
   `string[]`. Busca casando rótulo, valor e dígitos.
2. **Paginação → adotar o `Pagination` que já existe.** Não é extrair, é usar
   o primitivo que a Fase 1 construiu e ninguém consumiu. Ele devolve `null`
   com zero resultados e pressupõe `TableEmpty` no consumidor, que as seis
   telas ainda não têm.
3. **Exportação para Excel → `src/lib/planilha.ts`.** Sete arquivos montando
   `json_to_sheet` + `book_new` + `book_append_sheet` + `writeFile` na mão.
4. **Preset de período → componente.** Cinco telas, e **as cinco carregam o
   mesmo defeito**: o preset rotulado "30 dias" usa o primeiro dia do mês
   corrente, não trinta dias atrás. Extrair primeiro, consertar depois.
5. **`useIsMobile` → `src/hooks/`.** Quatro cópias de doze linhas.
6. **Clique fora → hook.** Seis cópias do mesmo `useEffect`; provavelmente
   morre junto com o `MultiSelect`, e aí some da lista.

## O que NÃO entra

- **Migrar qualquer uma das seis telas.** Esta fase só extrai; a Fase 3
  continua depois, e cada tela migrada já nasce consumindo os primitivos.
- **Consertar as divergências.** Elas viram lista, com o comportamento atual
  fixado em teste, e são decididas uma a uma.
- **`ModalObservacoes`.** Já é componente compartilhado em `components/`; o
  que falta nele é migração para o padrão de `Modal`, e isso pertence à tela
  que o consome.

## Riscos

**O maior: unificar e corrigir no mesmo fôlego.** É o erro que as gêmeas
ensinaram a não cometer — junto, não dá para saber qual dos dois quebrou. O
guarda é o critério do passo 2: se um teste de caracterização precisou ser
editado para passar, a unificação mudou comportamento e volta atrás.

**O segundo: a API do primitivo sair errada por olhar poucos usos.** Mitigado
por esta fase existir: os seis usos são decididos juntos, não um por vez.

**O terceiro: a extração parar no meio.** Um `MultiSelect` primitivo com três
telas consumindo e três com a cópia é pior que hoje. Cada item da lista é
entregue inteiro — todas as telas trocadas — ou não é entregue.

## Como se sabe que terminou

- As 737 linhas de `MultiSelect` viraram um primitivo com teste próprio, e as
  seis telas o consomem.
- Nenhuma das seis tem paginação própria, exportação própria ou `useIsMobile`
  próprio.
- A suíte não regride e o lint não sobe.
- As divergências estão numa lista, com o comportamento atual fixado em teste
  e cada uma esperando decisão.
