{#
  O CMV do `dre_mensal` é a soma do CMV dos itens do `fato_vendas` no mês da venda — e a
  receita sem custo também. Mês do DRE sem a venda, ou venda fora da janela, aparece aqui.
  `lucro_bruto` = receita líquida − cmv, e o `resultado` desconta o CMV.
#}

{{ config(severity = 'error') }}

with itens as (

    select
        date_trunc('month', data_venda)::date                                     as mes,
        coalesce(sum(cmv), 0)                                                     as cmv,
        coalesce(sum(valor_nota_rateado) filter (where fonte_custo = 'sem_custo'), 0) as sem_custo
    from {{ ref('fato_vendas') }}
    group by 1

),

dre as (

    select * from {{ ref('dre_mensal') }}

)

select
    coalesce(d.mes, i.mes)  as mes,
    i.cmv                   as cmv_dos_itens,
    d.cmv                   as cmv_do_dre,
    i.sem_custo             as sem_custo_dos_itens,
    d.receita_produto_sem_custo
from dre d
full join itens i on i.mes = d.mes
where abs(coalesce(i.cmv, 0) - coalesce(d.cmv, 0)) > 0.01
   or abs(coalesce(i.sem_custo, 0) - coalesce(d.receita_produto_sem_custo, 0)) > 0.01
   or abs(d.lucro_bruto - (d.receita_liquida - d.cmv)) > 0.01
   or abs(d.resultado - (d.lucro_bruto - d.despesa_operacional - d.despesa_financeira
                         - d.impostos_sobre_lucro)) > 0.01
