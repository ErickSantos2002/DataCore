{#
  O acumulado de 13 semanas do backtest erra menos de 25% (entrada e saída sem importação),
  em cada origem com semanas completas. Semana a semana o erro é maior e esperado (o caixa
  é irregular); no acumulado, um erro acima disso quer dizer que a conta quebrou — janela,
  visibilidade ou taxa — e não que o mês foi atípico. `warn`: é medida, não invariante.
#}

{{ config(severity = 'warn') }}

with por_origem as (

    select
        data_referencia,
        sum(erro_entrada) filter (where entrada_realizada_completa)
          / nullif(sum(entrada_realizada) filter (where entrada_realizada_completa), 0)   as vies_entrada,
        sum(erro_saida_sem_importacao) filter (where saida_realizada_completa)
          / nullif(sum(saida_realizada_sem_importacao) filter (where saida_realizada_completa), 0) as vies_saida,
        count(*) filter (where saida_realizada_completa)                                  as semanas_saida
    from {{ ref('caixa_semanal_backtest') }}
    group by 1

)

select *
from por_origem
where abs(vies_entrada) > 0.25
   or (semanas_saida >= 6 and abs(vies_saida) > 0.25)
