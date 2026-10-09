# Inadimplência — página de cobrança e indicadores

Data: 09/10/2026 · Status: aprovado em conversa, aguardando revisão da spec

## Por quê

O financeiro pediu para "trabalhar a inadimplência" em três recortes — total, anual e
mensal — e, na conversa, para **controlar a cobrança** dentro do sistema: com quem já
falou, quem respondeu, quem prometeu pagar e até quando, guardando tudo para análise.

Hoje a única visão é a de Contas a Receber, que mostra o que está em aberto mas não
separa atraso de inadimplência, não diz há quanto tempo cada cliente deve, não junta as
filiais de uma mesma empresa e não tem onde registrar a cobrança.

## Escopo

Uma página nova, **Inadimplência**, com duas abas — **Cobrança** e **Indicadores** —, e
o que ela precisa no banco e na API. Em quatro entregas, cada uma com teste e commit
próprios (ver "Entregas").

**Fora do escopo** (segunda etapa, depois de semanas de uso gerarem dado):

- análises da própria cobrança: % de promessas cumpridas, tempo do primeiro contato
  até o pagamento, recuperado por mês;
- lembrete/notificação (e-mail, push) de promessa vencendo;
- envio de cobrança pelo sistema (e-mail, WhatsApp);
- baixa de "perda" no Tiny — o status aqui é só controle interno.

## Definições

Valem para a página inteira, API e testes.

**Base.** `tiny.contas_receber` com `excluida_na_origem_em IS NULL` e situação diferente
de `cancelada`/`cancelado` (`SITUACOES_CANCELADAS` de `core/contas_agregado.py`). Em
aberto = situação `aberto` ou `parcial`, valor = `saldo`.

**Atraso de um título** = `hoje − vencimento`, em dias, para título em aberto com
vencimento antes de hoje.

| Faixa | Nome na tela |
|---|---|
| 1–30 dias | **Atraso** |
| 31–60, 61–90, mais de 90 dias | **Inadimplência** |

A carência de 30 dias é decisão do Erick (padrão de mercado) e fica numa constante só,
`CARENCIA_DIAS = 30`.

**Empresa** = a raiz do CNPJ: os 8 primeiros dígitos de um CNPJ de 14 dígitos. CPF (11
dígitos) é a própria pessoa. Documento vazio cai numa chave pelo nome normalizado
(`nome:` + `lower(trim(cliente_nome))`) — hoje não acontece em nenhum título vencido,
mas a chave tem de existir. A chave vai no banco e na URL **só como dígitos** (ou o
prefixo `nome:`), nunca formatada.

Por quê: no Tiny a mesma empresa aparece com vários CNPJs (uma filial por cidade) e
várias grafias. Medido em 09/10/2026 nos títulos vencidos: há mais nomes e mais CNPJs
que empresas — um único grupo tem duas dezenas de filiais e de grafias. Agrupar por nome
separava a empresa em pedaços e escondia parte da dívida.

**Nome exibido da empresa** = o `cliente_nome` do título em aberto com a emissão mais
recente; empate pelo maior `id`. **Filial** = o CNPJ completo, com o nome dela.

**Taxa de inadimplência (safra).** Para um conjunto de títulos já **maduros** (com
`vencimento + 30 ≤ hoje`):

```
taxa = Σ inadimplente / Σ valor
inadimplente(título) = saldo  se não pago
                     = valor  se pago depois de vencimento + 30 dias
                     = 0      se pago até vencimento + 30 dias
```

- **mensal**: os títulos que vencem no mês. O mês fica **em apuração** enquanto
  `último dia do mês + 30 > hoje` — mostra o número parcial com o selo, nunca como
  fechado;
- **anual**: os títulos que vencem no ano; o ano corrente leva "até agora";
- **total**: todo o histórico.

Conta quem pagou depois dos 30 dias: o que se mede é se pagou dentro do prazo. Por isso
um mês fechado não muda mais. Pagamento parcial entra pelo saldo atual (o Tiny não guarda
a data de cada recebimento parcial).

**Inadimplência da carteira (foto de hoje)** = Σ saldo inadimplente hoje ÷ Total a
Receber (o mesmo número do card de Contas a Receber).

**Recuperado depois do atraso** = `1 − (Σ saldo inadimplente hoje ÷ Σ inadimplente da
safra total)`. Liga os dois números: do que passou de 30 dias sem pagar na história,
quanto acabou entrando.

## 1. Banco

Migração `backend/migrations/013_cobranca.sql`, rodada pelo Erick no Konsole com
superusuário (`bash backend/scripts/migrar_tiny.sh 013_cobranca.sql`) **antes** do deploy da
API. As permissões copiam as de `tiny.configuracoes`, como na `002`: quem escreve lá
escreve aqui, quem só lê lá só lê aqui — o script não nomeia usuário (repo público).

```sql
CREATE TABLE tiny.cobranca_ciclos (
    id            bigserial PRIMARY KEY,
    empresa       text        NOT NULL,          -- a chave da empresa
    status        text        NOT NULL,          -- ver "Status"
    promessa_data date,                          -- a promessa vigente
    promessa_valor numeric(14,2),
    promessa_condicoes text,
    aberto_em     timestamptz NOT NULL DEFAULT now(),
    aberto_por    text        NOT NULL,          -- username, ou 'sistema'
    encerrado_em  timestamptz,
    ultimo_contato_em timestamptz
);
-- No máximo um ciclo aberto por empresa.
CREATE UNIQUE INDEX cobranca_ciclos_um_aberto
    ON tiny.cobranca_ciclos (empresa) WHERE encerrado_em IS NULL;

CREATE TABLE tiny.cobranca_eventos (
    id            bigserial PRIMARY KEY,
    ciclo_id      bigint      NOT NULL REFERENCES tiny.cobranca_ciclos(id),
    ocorrido_em   timestamptz NOT NULL,           -- quando o contato aconteceu
    registrado_em timestamptz NOT NULL DEFAULT now(),
    registrado_por text       NOT NULL,           -- username, ou 'sistema'
    tipo          text        NOT NULL,           -- 'contato' | 'status' | 'observacao' | 'sistema'
    canal         text,                           -- telefone | email | whatsapp | presencial | outro
    filial_cnpj   text,                           -- CNPJ completo, opcional
    status_anterior text,
    status_novo   text,
    promessa_data date,
    promessa_valor numeric(14,2),
    promessa_condicoes text,
    anotacao      text,
    valor_inadimplente numeric(14,2)              -- foto da dívida da empresa no momento
);
CREATE INDEX ON tiny.cobranca_eventos (ciclo_id, ocorrido_em DESC);
```

**A observação fixa mora na empresa, não no ciclo**: "só aceitam boleto por e-mail"
vale para a próxima cobrança também. Tabela própria, uma linha por empresa:

```sql
CREATE TABLE tiny.cobranca_empresas (
    empresa       text PRIMARY KEY,
    observacao    text NOT NULL,
    alterado_por  text NOT NULL,
    alterado_em   timestamptz NOT NULL DEFAULT now()
);
```

Cada edição dela também vira evento
`observacao` no ciclo aberto, com o texto anterior na anotação — o histórico não perde
nada.

`cobranca_eventos` **só recebe INSERT**: a API não tem rota de editar nem de apagar
evento. É o que torna a linha do tempo confiável para análise.

## 2. Status

| Código | Na tela | Quem põe |
|---|---|---|
| `sem_contato` | Sem contato | sistema (ao abrir o ciclo) |
| `em_contato` | Em contato | financeiro |
| `respondeu` | Respondeu | financeiro |
| `promessa` | Promessa de pagamento | financeiro — exige `promessa_data` (≥ hoje); valor e condições opcionais |
| `quebrada` | Promessa quebrada | sistema |
| `negociacao` | Em negociação | financeiro |
| `contestado` | Contestado | financeiro |
| `juridico` | Jurídico / Protesto | financeiro |
| `perda` | Perda | financeiro |
| `pago` | Pago | sistema |

O financeiro escolhe qualquer status da coluna "financeiro", a partir de qualquer outro.
`sem_contato`, `quebrada` e `pago` só o sistema põe — a API recusa com 422. A lista é
fechada (constante no backend, espelhada no front); o detalhe vai no texto livre.

**Ciclo.** Um ciclo é uma cobrança da empresa, do primeiro atraso até a dívida acabar.

- **Abre** sozinho quando a empresa passa a ter título inadimplente (mais de 30 dias) e
  não tem ciclo aberto — status `sem_contato`, `aberto_por = 'sistema'`. Abre também na
  mão quando o financeiro registra contato com uma empresa só em atraso (1–30 dias).
- **Fecha** como `pago` quando a empresa não tem mais **nenhum** título vencido em aberto
  (nem em atraso). Fechar só pelo "acima de 30 dias" faria a empresa fechar e reabrir em
  poucos dias por causa de um título que já está a caminho.
- `perda` e `juridico` **não fecham** o ciclo — a dívida continua existindo no Tiny. Se
  ela for paga, fecha como `pago` normalmente.
- Empresa que volta a dever depois de fechada ganha **ciclo novo**; o antigo fica para
  análise.

## 3. Sincronização automática

`app/services/cobranca.py → sincronizar(db, hoje)`, idempotente, chamada no **fim do job
`extrair_contas`** (o mesmo que roda pelo timer de segunda a sábado, pela varredura de
domingo e pelo botão "Atualizar dados agora"). Não precisa timer nem mudança em
`deploy/`.

Em ordem, numa transação:

1. **abre** ciclo para cada empresa com inadimplente > 0 sem ciclo aberto;
2. **fecha como `pago`** cada ciclo aberto cuja empresa não tem mais vencido em aberto —
   evento `sistema` "Sem títulos vencidos no Tiny";
3. **quebra a promessa** de cada ciclo em `promessa` com `promessa_data < hoje` — evento
   `sistema` com a data e o valor prometidos;
4. registra, em cada evento do sistema, o `valor_inadimplente` da empresa no momento.

Falha na sincronização **não derruba a carga** de contas: é registrada no `detalhe` da
execução do job (`operacao.execucoes_job`) e aparece na tela de Importações. A carga é o
que alimenta o resto do sistema; a cobrança se acerta na próxima.

## 4. API

Roteador novo `app/api/endpoints/inadimplencia.py`, prefixo `/inadimplencia`. **Todas** as
rotas dependem de um `exigir_papeis("admin", "financeiro")` novo em `core/security.py`
(hoje só existe `exigir_admin`) — a regra não fica só no front.

| Rota | O que devolve |
|---|---|
| `GET /resumo` | cards da aba Cobrança: total vencido, atraso, inadimplente, inadimplência da carteira, recuperado; e por status: sem contato, promessas vencendo em 7 dias, promessas quebradas, em negociação |
| `GET /empresas` | uma página da lista. Filtros: `busca` (nome, CNPJ com ou sem pontuação), `status` (repetível), `faixa` (`atraso`, `31_60`, `61_90`, `90_mais`), `incluir_atraso` (padrão `false`: só quem tem inadimplente). Ordena por: `valor` (padrão, desc), `maior_atraso`, `titulos`, `nome`, `status`, `proxima_data`, `ultimo_contato`. `limite`/`offset` como em `/contas_receber/pagina` |
| `GET /empresas/{empresa}` | cabeçalho do modal: nome, chave, filiais (CNPJ, nome, saldo vencido), telefone e e-mail do título mais recente, observação fixa, ciclo aberto (status, promessa) e os eventos do ciclo aberto e dos anteriores |
| `GET /empresas/{empresa}/titulos` | os títulos **em aberto** da empresa — vencidos e a vencer —, no formato `ContaDaTela` de `/contas_receber/pagina` |
| `POST /empresas/{empresa}/eventos` | registra contato e/ou muda status. Corpo: `ocorrido_em`, `canal`, `filial_cnpj?`, `status_novo?`, `promessa?{data, valor?, condicoes?}`, `anotacao?`. Abre ciclo se não houver. Precisa de pelo menos `canal` ou `status_novo`. Devolve o detalhe atualizado |
| `PUT /empresas/{empresa}/observacao` | grava a observação fixa (`{texto}`); vazio apaga |
| `GET /indicadores` | aba Indicadores: série mensal (24 meses, com `em_apuracao`), anual (desde 2019), total, e o "último mês fechado" e a "média dos 12 meses" já calculados |

Os valores e taxas são somados no banco (padrão de `core/contas_agregado.py`, item 9.4) —
nenhuma rota manda a lista de títulos para a tela calcular. As consultas ficam num
módulo próprio, `app/core/inadimplencia.py`, e reaproveitam as constantes de
`contas_agregado.py`.

Validação (422, `detail` em português): status desconhecido ou do sistema; promessa sem
data ou com data passada; `filial_cnpj` que não é filial da empresa; `ocorrido_em` no
futuro; anotação acima de 4.000 caracteres.

## 5. Página

Rota `/inadimplencia`, regra `{ tipo: "papeis", papeis: ["admin", "financeiro"] }` em
`auth/permissoes.ts`; item no menu Financeiro, logo depois de Contas a Receber. Código em
`frontend/src/pages/inadimplencia/`, no mesmo desenho de `pages/contas/`: regra em `.ts`
puro, hooks de busca, componentes de desenho.

Cabeçalho da página igual ao de Contas (`CabecalhoContas`). Duas abas (`Tabs` do design
system): **Cobrança** (abre por padrão) e **Indicadores**.

### Aba Cobrança

- **Cards** (`KpiCard`): Total vencido não pago · Em atraso (até 30 dias) · Inadimplente
  (mais de 30 dias) · Inadimplência da carteira · Recuperado depois do atraso. Segunda
  linha, da cobrança: Sem contato · Promessas nos próximos 7 dias · Promessas quebradas ·
  Em negociação. Clicar num card de status filtra a lista.
- **Barra por faixa de atraso**, com as quatro faixas e o valor, títulos e empresas de
  cada uma. Clicar numa faixa filtra a lista.
- **Filtros** (`FilterBar`): Status (multi-seleção), Faixa de atraso, "Incluir empresas
  só em atraso (1–30 dias)".
- **Lista de empresas, no padrão da tabela de Contas a Receber**: card com título, busca,
  "Exportar planilha" (todas as linhas do filtro, não só a página), cabeçalho que ordena,
  paginação de 15, selos. Colunas:

  | Coluna | Conteúdo |
  |---|---|
  | Empresa | nome; embaixo, o CNPJ — completo se for uma filial só, senão a raiz formatada e "N filiais" |
  | Títulos | quantos títulos vencidos em aberto |
  | Valor devido | saldo vencido |
  | Maior atraso | selo "N dias", na cor da faixa |
  | Status | selo do status (cor por grupo: neutro, em andamento, promessa, alerta, encerrado) |
  | Próxima data | a data da promessa, em vermelho se já passou |
  | Último contato | "há N dias", ou "nunca" |

### Modal da empresa

Clicar numa linha abre um `Modal` tamanho `2xl` com:

- **Cabeçalho fixo**: nome e CNPJ, valor devido, maior atraso, status, telefone e e-mail
  do Tiny, e o botão **Registrar contato**.
- **Observação fixa** logo abaixo, editável no lugar.
- Duas abas:
  - **Títulos** (abre por padrão): os títulos em aberto **agrupados por filial**, com
    subtotal por filial e as mesmas colunas da tabela de Contas a Receber — ID Tiny,
    Vencimento, Emissão, Cliente (nome e CNPJ da filial), Categoria, Valor, Saldo,
    Situação (o mesmo selo, inclusive "· Vencida"). Mais uma coluna, **Atraso**. Os a
    vencer aparecem por último, separados.
  - **Cobrança**: a linha do tempo do ciclo aberto, do mais novo para o mais velho —
    contatos, mudanças de status e eventos do sistema, cada um com quem, quando, canal,
    filial e a anotação. Ciclos anteriores ficam recolhidos embaixo.
- **Registrar contato** abre um formulário dentro do modal: data e hora (padrão agora),
  canal, filial (opcional, lista das filiais), novo status (opcional) e anotação livre.
  Escolhendo "Promessa de pagamento" aparecem data (obrigatória), valor e condições.
  Erro de gravação aparece no `erro` do Modal, como nos outros formulários do sistema.

### Aba Indicadores

- Cards: Último mês fechado · Média dos últimos 12 meses · Ano corrente (até agora, com a
  seta comparando ao ano anterior) · Total desde o início.
- **Taxa mensal**: barras dos últimos 24 meses por mês de vencimento, linha tracejada da
  média dos 12 meses, mês em apuração hachurado; tooltip com valor vencido e valor não
  pago em 30 dias. Recharts com `chartTheme`, como os outros gráficos.
- **Taxa anual**: barras horizontais por ano, ano corrente marcado "até agora", e a linha
  do total.
- **Como ler este número**: o texto curto do protótipo, com o exemplo do último mês.

## Testes

- **Backend** (`backend/tests/test_inadimplencia.py`), no banco de teste do
  `docker-compose.test.yml`: chave de empresa (CNPJ, CPF, sem documento); faixas e
  carência; taxa safra com pago em dia, pago com 31 dias e não pago; mês em apuração;
  cancelada fora de tudo; as três regras da sincronização e a idempotência; recusa de
  status do sistema, promessa sem data e filial de outra empresa; 403 para papel `vendas`.
- **Front**: testes de tela no padrão de `ContasReceber.test.tsx`, com servidor falso —
  lista, filtros, ordenação, modal com as duas abas, formulário de contato e promessa,
  erro de gravação; permissão em `permissoes.test.ts` e `acesso-atual.test.tsx`.
- **Conferência contra produção** (somente leitura, `bancos.consultar`): os cards e as
  taxas batem com as consultas avulsas feitas na conversa de 09/10/2026, e o "Total
  vencido não pago" bate com o filtro "Vencidas" de Contas a Receber.

## Entregas

1. **Banco e sincronização**: migração `013`, `core/inadimplencia.py` (consultas e
   regras), `services/cobranca.py` e a chamada no `extrair_contas`, com testes.
2. **API**: `exigir_papeis`, o roteador e os testes.
3. **Página — Cobrança**: rota, menu, permissão, cards, lista, modal e formulário.
4. **Página — Indicadores**.

Deploy: o Erick roda a `013` no Konsole → deploy do `datacore-api` → deploy do
`datacore-sistema`. A primeira sincronização acontece na próxima carga de contas; para
não esperar, dá para clicar em "Atualizar dados agora".

## Riscos e decisões registradas

- **Nome por grupo**: o "nome exibido" é o do título mais recente — pode ser o de uma
  filial ("Empresa X - Cidade Y"). Aceito; o CNPJ e a lista de filiais desfazem a dúvida.
- **"Pago" quando a dívida some por cancelamento ou exclusão no Tiny**: o ciclo fecha
  como `pago` também. O evento do sistema diz "Sem títulos vencidos no Tiny", não
  "pagamento recebido", para não afirmar o que não se sabe.
- **Dado pessoal**: CPF de cliente pessoa física aparece na tela, como já aparece em
  Contas a Receber; a página é restrita a admin e financeiro.
