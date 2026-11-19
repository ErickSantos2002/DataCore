{#
  `caixa_semanal_backtest` — a projeção do `caixa_semanal` rodada como se hoje fosse uma
  data passada, comparada semana a semana com o que de fato entrou e saiu (por
  `liquidacao`). É a âncora: exercita exatamente o que pode estar errado (a visibilidade
  "como se hoje fosse", as taxas, o ritmo e o dia concentrado).

  - **Origens fixas** (`origens`), toda segunda ou dia 1 entre abr e set/2026. Antes de
    abr/2026 o `created_at` do a pagar é a carga em lote de 20–23/03 e a visibilidade "na
    data" não pode ser reconstruída. Para medir mais, acrescentar origens.
  - **Saída realizada só vale com `saida_realizada_completa`**: a conta a pagar entra no
    banco até ~60 dias depois de paga, então semana mais recente que isso ainda não tem o
    realizado inteiro e pareceria um erro da projeção. Entrada: `entrada_realizada_completa`
    (semana já terminada).
  - **A importação fica fora do erro de saída**: a projeção só a tem quando lançada, e ela
    é irregular demais para ritmo. Vai em `importacao_realizada`, para quem quiser ver.
  - As `vars` `caixa_semanas_entrada`, `caixa_semanas_saida` e `caixa_atraso_saida` existem
    para comparar janelas (`dbt run --select caixa_semanal_backtest --vars ...`). As
    padrão (26, 26, 63) foram as de menor erro no acumulado de 13 semanas em 2026-11-19.
#}

{{ config(materialized = 'table') }}

{% set origens = ['2026-04-06', '2026-04-20', '2026-05-04', '2026-05-18', '2026-06-01', '2026-06-15', '2026-07-06', '2026-07-20', '2026-08-03', '2026-09-01'] %}

with projecao as (

    {% for o in origens %}
    select * from ({{ caixa_projetado("date '" ~ o ~ "'", var('caixa_semanas_entrada', 26), var('caixa_semanas_saida', 26), var('caixa_atraso_saida', 63)) }}) p{{ loop.index }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}

),

recebido as (

    select pr.data_referencia, pr.semana, coalesce(sum(c.valor), 0) as valor
    from projecao pr
    left join {{ ref('stg_contas_receber') }} c
      on c.liquidacao between pr.inicio_projecao and pr.fim_semana
     and c.situacao in ('pago', 'recebido')
     and c.excluida_na_origem_em is null
    group by 1, 2

),

pago as (

    select
        pr.data_referencia,
        pr.semana,
        coalesce(sum(f.valor) filter (where f.natureza <> 'importacao' or f.parcela_de_parcelamento), 0) as sem_importacao,
        coalesce(sum(f.valor) filter (where f.natureza = 'importacao' and not f.parcela_de_parcelamento), 0) as importacao
    from projecao pr
    left join {{ ref('fato_contas_pagar') }} f
      on f.data_liquidacao between pr.inicio_projecao and pr.fim_semana
     and not f.cancelada
    group by 1, 2

)

select
    pr.*,
    r.valor                                                    as entrada_realizada,
    p.sem_importacao                                           as saida_realizada_sem_importacao,
    p.importacao                                               as importacao_realizada,
    pr.entrada_total - r.valor                                 as erro_entrada,
    (pr.saida_total - pr.saida_importacao) - p.sem_importacao  as erro_saida_sem_importacao,
    -- a conta a pagar entra no banco até 60 dias depois de paga: semana mais recente que
    -- isso ainda não tem o realizado inteiro, e o erro dela não vale como medida
    pr.fim_semana < current_date - 63                          as saida_realizada_completa,
    pr.fim_semana < current_date                               as entrada_realizada_completa
from projecao pr
join recebido r on r.data_referencia = pr.data_referencia and r.semana = pr.semana
join pago     p on p.data_referencia = pr.data_referencia and p.semana = pr.semana
