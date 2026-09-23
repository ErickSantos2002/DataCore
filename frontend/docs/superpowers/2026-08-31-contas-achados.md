# Contas a Receber e Contas a Pagar — o que a caracterização achou

Levantado em 31/08/2026, antes de refatorar, pelo método da Fase 3: teste de
caracterização primeiro, plantação para provar que o teste enxerga. **231 testes
novos** (122 + 109), **219 plantações medidas**, nenhum teste cego.

As duas telas têm **83% das linhas idênticas** (277 divergentes em 1641). O
objetivo do par não é migrar duas telas: é separar o que difere **de propósito**
do que difere **por descuido**.

---

## 1. Defeitos compartilhados — estão nas duas telas

Corrigir uma sem a outra recria a divergência que este levantamento existe para
acabar.

### 1.1 O "Total em Aberto" e o "Total Recebido/Pago" somam grandezas diferentes

`ContasReceber.tsx:225-230` · `ContasPagar.tsx:229-234`

Conta quitada entra pelo **valor cheio** (`valor_numero`); conta em aberto entra
pelo **saldo** (`saldo_numero`). Uma nota de R$ 1.000 com R$ 900 já recebidos
aparece como **R$ 100** no painel, e os R$ 900 que entraram **não aparecem em
lugar nenhum** — nem em "Aberto", nem em "Recebido".

Os gráficos de categoria e de cliente/fornecedor somam sempre `valor_numero`
(`ContasReceber.tsx:296`, `ContasPagar.tsx:302`), então **o topo da tela e o
gráfico logo abaixo não fecham entre si**, e nada avisa.

### 1.2 A "Média Mensal" mistura as duas grandezas e divide pelo mês errado

`ContasReceber.tsx:237-238` · `ContasPagar.tsx:241-242`

```
mediaMensal = (totalAberto + totalRecebido) / mesesComDados
```

Soma saldo com valor cheio, e divide por **meses distintos de emissão**, não de
vencimento nem de competência.

Medido: uma conta de R$ 1.000 com R$ 900 recebidos, mais uma de R$ 1.000
quitada, ambas emitidas em janeiro → a tela mostra **R$ 1.100,00**. Não é o
faturado (R$ 2.000,00) nem o que entrou (R$ 1.000,00).

Medido também: três contas emitidas em maio, vencendo jun/jul/ago, contam como
**um** mês. A média sai R$ 600,00 (a soma inteira) em vez de R$ 200,00.

O rótulo "Média Mensal" não diz de qual mês nem de qual grandeza.

### 1.3 Os presets de período misturam fuso local com UTC

`ContasReceber.tsx:173,182` · `ContasPagar.tsx:174,183`

O **início** do período vem de `getFullYear()/getMonth()` (local); o **fim** sai
de `toISOString()` (UTC). Perto da meia-noite os dois discordam.

- Em Brasília, às 23h de 31/08, "Mês atual" vira **01/08 a 01/09**.
- Com o relógio em `2026-01-01T02:00Z`, "Mês atual" vira **01/12/2025 a
  01/01/2026** — dezembro rotulado "mês atual" —, e "Ano atual" vira **2025
  inteiro**.

O certo é o dia local nas duas pontas.

### 1.4 O nome do arquivo exportado usa a data em UTC

`ContasReceber.tsx:369` · equivalente em `ContasPagar.tsx`

Às 21h de 31/08 o arquivo sai `contas_a_receber_2026-09-01.xlsx`. Quem exporta à
noite arquiva com a data do dia seguinte.

### 1.5 "Vencida" apaga a situação real, na tela e na planilha

`ContasReceber.tsx:149,360` · `ContasPagar.tsx:366`

Depois do vencimento, "pendente" e "aberto" viram a mesma palavra. Quem abre o
Excel não consegue mais distinguir as duas.

### 1.6 Situação vazia desenha uma pílula colorida sem texto

`ContasReceber.tsx:151` · `ContasPagar.tsx:151`

`situacao ?? "-"` cobre `null`, não `""`.

### 1.7 A contagem de registros só aparece com duas páginas ou mais

`ContasReceber.tsx:746` · `ContasPagar.tsx:763-766`

A frase "Mostrando X a Y de N registros" mora dentro do bloco `totalPaginas > 1`.
Com 15 contas ou menos, ninguém lê contagem nenhuma.

### 1.8 A busca não tira acento

`ContasReceber.tsx:315-320` · `ContasPagar.tsx:321`

Só baixa a caixa. Quem digita `servicos` não acha `Serviços`; `mineracao` não
acha `Mineração`.

### 1.9 Exportar continua habilitado com zero linhas

`ContasReceber.tsx:669-677` · `ContasPagar.tsx:682`

Gera uma planilha vazia. A tela de Locação já desabilita nesse caso.

### 1.10 Falha de API é silenciosa

`ContasReceberContext.tsx:83-85` · equivalente em `ContasPagarContext.tsx`

Tela zerada, indistinguível de base vazia. Mesmo defeito que ficou em aberto na
tela de Usuários — e a decisão vale para as telas restantes.

### 1.11 As listas de opções usam `.sort()` cru

`ContasReceber.tsx:202-203`

Sem `localeCompare`: `["Boletos","Zinco","Água"]` em vez de
`["Água","Boletos","Zinco"]`.

### 1.12 A pizza corta em 8 sem fatia "Outros"

`ContasReceber.tsx:299,587` · `ContasPagar.tsx:304`

E o percentual das 8 é calculado **sem** o resto, então as fatias somam 100% de
um total que não é o total.

### 1.13 Ordenar não volta para a primeira página

`ContasReceber.tsx:340-345`

`alternarOrdenacao` é o único handler que não chama `setPaginaAtual(1)`. Ordenar
na página 2 deixa o usuário na página 2 de uma lista reordenada.

### 1.14 Nenhum `<label>` tem `htmlFor`

`ContasReceber.tsx:410-462`

Mesmo achado da tela de Usuários, já resolvido lá pelos primitivos `Input`/
`Select`.

---

## 2. Defeitos de uma tela só

### Contas a Receber

- **`ContasReceberContext.tsx:71` — `"1.234"` sem casa decimal vira R$ 1,23.** O
  ponto de milhar é lido como separador decimal. É o pior defeito de dinheiro do
  par.
- **`ContasReceber.tsx:47-51` — `formatarData` fatia em `-` e ignora o `T`.**
  `"2026-01-18T10:00:00"` renderiza `18T10:00:00/01/2026`. Hoje a API manda data
  pura, então não aparece; `src/lib/datas.ts` já resolve isso.
- **`ContasReceber.tsx:713` — tabela vazia sem mensagem nenhuma.** Ver 3.1.

### Contas a Pagar

- **`ContasPagar.tsx:205` — `opcoesFornecedor` não passa por `.filter(Boolean)`**
  como situação e categoria. Um `cliente_nome` vazio vira uma opção em branco.
- **`ContasPagar.tsx:174,183` — "Mês atual" termina hoje, não no fim do mês.** Com
  o relógio em 15/03, uma conta emitida em 20/03 some do "mês atual". Pode ser
  proposital; o rótulo não diz.

---

## 3. Divergências acidentais — candidatas a unificar

Nenhuma tem razão aparente. São o resultado de alguém editar uma gêmea e
esquecer a outra.

### 3.1 Estado vazio

`ContasPagar.tsx:749-755` desenha "Nenhuma conta encontrada.". **ContasReceber
não desenha nada** — filtro que não casa devolve tabela muda.

### 3.2 O texto do selo de situação

Receber renderiza `{situacao}` **cru** (`"PAGO"` da API aparece como `"PAGO"`);
Pagar renderiza o literal `"Pago"`. A mesma linha do Tiny sai escrita diferente
nas duas telas.

### 3.3 Ordem das colunas da tabela

- Receber: ID · Cliente · Categoria · **Data · Vencimento · Valor · Saldo** ·
  Situação
- Pagar: ID · Fornecedor · Categoria · **Valor · Saldo · Emissão · Vencimento** ·
  Situação

### 3.4 Colunas da planilha

Receber tem `ID Tiny`, `Forma Pagamento` e `Portador`. Pagar **não tem ID Tiny** e
tem `Ocorrência` no lugar dos outros dois. O rótulo da data é `Data` numa e
`Emissão` na outra.

### 3.5 CPF/CNPJ na célula da contraparte

Receber mostra numa segunda linha; Pagar usa `truncate` + `title` e não mostra
documento nenhum.

---

## 4. Divergências de domínio — manter

- **O que conta como quitado.** Receber aceita `recebido` **ou** `pago`; Pagar
  aceita **só** `pago`. Correto pelos nomes — mas é o candidato número um a ser
  edição de uma só das duas, então confirmar contra o Tiny antes de unificar.
  Consequência: o `aVencer30` de Receber também exclui `recebido`.
- **Qual campo de data manda no filtro.** Receber usa `c.data`; Pagar usa
  `c.data_emissao`. Nomes que a própria API entrega diferentes. Confirmar que
  `contas_receber.data` é mesmo a emissão antes de unificar — o rótulo da coluna
  também diverge.

---

## 5. Verificado igual nos dois, e portanto seguro de unificar

Conferido de propósito, porque parecia arbitrário:

- `ITENS_POR_PAGINA = 15`
- Ordenação padrão `{ campo: "vencimento", direcao: "asc" }`; primeiro clique
  sempre `desc`
- Janela de 5 números de página
- `vencida` com `<` **estrito** — quem vence hoje não está vencida
- `aVencer30` com `>= hoje` e `<= hoje+30`, inclusivo nas duas bordas
- Bordas do filtro de data inclusivas
- `converterParaNumero` idêntico
- O comparador de ordenação **já devolve 0 no empate** nas duas — ao contrário de
  Locação e Usuários antes do conserto

---

## 6. Alarmes falsos descartados

Registrados para ninguém reabrir:

- **`cliente_nome` dentro de ContasPagar** parece cópia mal feita: é o nome do
  campo que a API manda para o fornecedor, rotulado "Fornecedor" na tela.
- **A paginação** parecia divergir: é a mesma lógica, formatada diferente pelo
  prettier (`pageNum` contra `p`).
- **O indicador de ordenação** usa `&&` numa e `? :` na outra. Renderiza o mesmo;
  o `else` é `null`.
- **A data da planilha** não tem o bug "um dia antes" das telas anteriores:
  `formatarData` fatia a string sem tocar em `Date`.

---

## 7. O que ficou sem cobertura de teste, e por quê

- **Render props do recharts** — `label` de porcentagem da pizza, os dois
  `Tooltip content` customizados, o `tickFormatter` que trunca nome em 16
  caracteres. Em jsdom o `ResponsiveContainer` mede 0×0 e o gráfico não desenha.
  O teste fixa **os dados entregues a cada gráfico**, que é o número que o
  usuário lê no tooltip.
- **Ramos inalcançáveis pela tela** — `handleClickEvolucao` com `activeLabel`
  ausente ou mês inválido; o recharts sempre manda categoria válida.
- **Fechar o multi-select por clique fora** (`mousedown` no documento): testaria
  o dublê, não a tela.
- **`data_emissao` com hora** — quebraria o `ano` do contexto
  (`Number("15T00:00:00")` → `NaN`) e o título viraria "Evolução Mensal — NaN".
  Fica como aviso se o backend mudar.
- **Layout mobile da paginação** — duplica os botões do desktop.
