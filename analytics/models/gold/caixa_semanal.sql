{#
  `caixa_semanal` — o caixa projetado das próximas 13 semanas (a corrente e mais 12), uma
  linha por semana. É o que a skill `caixa-projetado` do Midas (agente CFO do HS.OS) lê.

  **Entrega o FLUXO, não o saldo.** O saldo bancário não chega ao DataCore; quem soma o
  saldo inicial ao `fluxo_acumulado` é a skill, quando alguém o informar.

  A conta inteira está no macro `caixa_projetado`, para o `caixa_semanal_backtest` rodar
  exatamente a mesma conta em datas passadas.

  ## Conhecido × estimado, sempre em colunas separadas

  | coluna | o que é |
  |---|---|
  | `entrada_a_vencer` | a receber em aberto que vence na semana, pelo valor de face — é o que "fecha com os títulos" |
  | `entrada_a_vencer_esperada` | o mesmo, pela pontualidade medida: quanto do que vence na semana w entra na semana k |
  | `entrada_vencida_esperada` | o vencido em aberto × a taxa de recuperação da faixa de atraso, por semana |
  | `entrada_estimada` | ritmo de recebimento × a parte dele que vem de título que ainda não existe |
  | `saida_parcelas` | parcelas de dívida e de imposto parcelado (`parcela_de_parcelamento`) |
  | `saida_a_pagar_em_aberto` | o resto do a pagar lançado e em aberto |
  | `saida_estimada` | ritmo de pagamento por chave do plano de contas, menos o já lançado da mesma chave |
  | `saida_importacao` | importação, só se estiver lançada — irregular demais para ritmo |

  A régua do a receber é a da skill `contas-receber`: situação `aberto`/`pendente`, sem
  excluídas na origem, valor = `saldo`. Vencimento em fim de semana ou feriado vai para o
  próximo dia útil (`dim_tempo.dia_util`).

  ## Por que o a pagar é quase todo estimado

  Medido em 2026-11-19: das contas a pagar que venceram em out/2026 (fora as parcelas), só
  0,6% do valor estava no banco 7 dias antes do vencimento. O Financeiro lança a conta
  depois de paga — de 11 a 60 dias depois, na maior parte. Uma projeção só com "a pagar em
  aberto" diria que sobra caixa: o pior erro possível aqui. Por isso:

  - o **ritmo de pagamento** é a média das 26 semanas que terminam **9 semanas antes** da
    data: as mais recentes ainda não estão lançadas (completude medida: 28% na semana
    anterior, 81% quatro semanas atrás, 99% sete semanas atrás);
  - por **chave** = grupo do Balancete, com a fatura do cartão (9.1) à parte, porque ela
    só existe no Tiny desde set/2026; sem parcelas (já conhecidas) e sem importação;
  - o lançado em aberto da mesma chave e semana é DESCONTADO do ritmo — senão contaria
    duas vezes;
  - conta a pagar vencida e ainda em aberto sai na semana corrente: o erro seguro é o
    pessimista.

  ## O ritmo é por DIA DO MÊS, não por semana

  A média semanal achataria o dia concentrado (folha, impostos, pró-labore: o grupo 5 paga
  91% do valor entre os dias 1 e 7). Os dois ritmos guardam a média de cada dia do mês na
  janela; a projeção soma os dias da semana, com o fim de semana movido para o dia útil
  seguinte.

  ## Vencido: quanto volta, e quando

  52 datas passadas (toda semana, de 13 a 64 semanas antes, no mesmo dia da semana): o que
  estava em aberto em cada uma, por posição (faixa de atraso se vencido — 1–7, 8–15,
  16–30, 31–90, 91–365, 366+ dias; até 30 é atraso, depois inadimplência, a régua da tela
  —, ou semana do vencimento se a vencer), e quanto dele entrou em cada uma das 13 semanas
  seguintes. A taxa vale para o a vencer também: título que vence não entra todo na semana
  do vencimento.

  ## Entrada estimada: só a parte nova

  O ritmo de recebimento das 26 semanas (por `liquidacao`) inclui o recebimento de títulos
  que já estão em aberto hoje. Para não contar duas vezes, ele entra multiplicado por
  `participacao_novos`: na calibração, a parte do recebido na semana k que veio de título
  emitido depois da data. Não é `max(ritmo, conhecido)`: essa forma só erra para cima.

  ## A régua do "como se hoje fosse" (o backtest)

  Ver o cabeçalho do macro: a receber visível desde a emissão (o `created_at` é da carga em
  lote de 05–06/09/2026); a pagar desde o `created_at`, exceto o lote de 29/09/2026.

  ## Confiança

  `pct_entrada_conhecida` / `pct_saida_conhecida`: quanto da semana é título lançado.
  `erro_tipico_entrada_pct` / `erro_tipico_saida_pct`: o erro absoluto médio daquela
  semana do horizonte no `caixa_semanal_backtest`, em % do realizado — é o número para
  dizer junto com a projeção. ⚠️ Semana a semana o erro é grande (o caixa é irregular); o
  acumulado de 13 semanas erra bem menos.

  ## `fluxo_acumulado_conservador`

  O backtest de 2026-11-19 errou para o lado otimista: entrada acima e saída abaixo do
  realizado na maior parte das origens (a recuperação do vencido piorou em set/2026, e o
  ritmo de pagamento olha 9 semanas para trás enquanto a despesa cresce). O conservador
  divide a entrada por (1 + viés da entrada) e a saída por (1 + viés da saída), com os
  vieses do acumulado de todas as origens do backtest — e SÓ na direção pessimista: viés
  que favoreceria o caixa é ignorado. Recalcula a cada build, conforme o realizado completa.
  ⚠️ É calibrado nas mesmas origens em que é medido: serve de piso para "vamos ter caixa?",
  não de previsão melhor.

  ⚠️ Depende de hoje (`current_date` do build). Não é fato histórico: o build do dia
  substitui o anterior, e `data_referencia` diz de quando é a projeção.
#}

{{ config(materialized = 'table') }}

with projecao as (

    {{ caixa_projetado('current_date') }}

),

erro_tipico as (

    select
        semana,
        round(100 * avg(abs(erro_entrada)) filter (where entrada_realizada_completa)
              / nullif(avg(entrada_realizada) filter (where entrada_realizada_completa), 0), 0)
                                                                    as erro_tipico_entrada_pct,
        round(100 * avg(abs(erro_saida_sem_importacao)) filter (where saida_realizada_completa)
              / nullif(avg(saida_realizada_sem_importacao) filter (where saida_realizada_completa), 0), 0)
                                                                    as erro_tipico_saida_pct
    from {{ ref('caixa_semanal_backtest') }}
    group by 1

),

vies as (

    select
        sum(erro_entrada) filter (where entrada_realizada_completa)
          / nullif(sum(entrada_realizada) filter (where entrada_realizada_completa), 0)   as entrada,
        sum(erro_saida_sem_importacao) filter (where saida_realizada_completa)
          / nullif(sum(saida_realizada_sem_importacao) filter (where saida_realizada_completa), 0) as saida
    from {{ ref('caixa_semanal_backtest') }}

),

conservador as (

    select
        p.semana,
        p.entrada_total / (1 + greatest(coalesce(v.entrada, 0), 0))
          - (p.saida_total - p.saida_importacao) / (1 + least(coalesce(v.saida, 0), 0))
          - p.saida_importacao                                      as fluxo_liquido_conservador,
        round(100 * v.entrada, 1)                                   as vies_backtest_entrada_pct,
        round(100 * v.saida, 1)                                     as vies_backtest_saida_pct
    from projecao p cross join vies v

)

select
    p.*,
    case
        when p.pct_entrada_conhecida >= 70 and p.pct_saida_conhecida >= 70 then 'alta'
        when p.pct_entrada_conhecida >= 40                                 then 'media'
        else 'baixa'
    end                                                             as confianca,
    case
        when p.pct_entrada_conhecida >= 70 then 'entradas: títulos em aberto (pontualidade medida)'
        else 'entradas: principalmente ritmo de recebimento'
    end || '; ' ||
    case
        when p.pct_saida_conhecida >= 70 then 'saídas: contas lançadas'
        else 'saídas: principalmente ritmo de pagamento (o a pagar é lançado depois de pago)'
    end                                                             as metodo,
    e.erro_tipico_entrada_pct,
    e.erro_tipico_saida_pct,
    c.fluxo_liquido_conservador,
    sum(c.fluxo_liquido_conservador) over (order by p.semana)      as fluxo_acumulado_conservador,
    c.vies_backtest_entrada_pct,
    c.vies_backtest_saida_pct
from projecao p
left join erro_tipico e on e.semana = p.semana
left join conservador c on c.semana = p.semana
