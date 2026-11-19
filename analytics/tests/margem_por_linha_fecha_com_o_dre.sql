{#
  A margem por linha não perde nem inventa dinheiro: por mês, a soma das linhas é a
  `receita_bruta` do `dre_mensal` (vendas + serviços) e o `cmv` dele.
#}

{{ config(severity = 'error') }}

with linhas as (

    select mes, sum(receita) as receita, coalesce(sum(cmv), 0) as cmv
    from {{ ref('margem_por_linha_mensal') }}
    group by 1

)

select coalesce(d.mes, l.mes) as mes, d.receita_bruta, l.receita, d.cmv as cmv_dre, l.cmv
from {{ ref('dre_mensal') }} d
full join linhas l on l.mes = d.mes
where abs(coalesce(d.receita_bruta, 0) - coalesce(l.receita, 0)) > 0.01
   or abs(coalesce(d.cmv, 0) - coalesce(l.cmv, 0)) > 0.01
