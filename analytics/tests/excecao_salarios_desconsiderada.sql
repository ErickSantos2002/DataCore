{#
  A conta "Salários" sem categoria emitida em 2026-10-23 (id do Tiny no seed de exceções)
  é desconsiderada por orientação do Financeiro (2026-11-19). Âncora: out/2026 — ela está
  em `valor_desconsiderado`, não na despesa sem categoria nem em resultado nenhum, e não
  aparece no caixa projetado. O Balancete continua com ela (é a tela).
#}

{{ config(severity = 'error') }}

with conta as (

    select * from {{ ref('fato_contas_pagar') }} where id_tiny = 617343460

)

select 'conta nao esta desconsiderada' as problema, null::text as chave
where not exists (select 1 from conta where natureza = 'desconsiderada')

union all

select 'ancora out/2026: valor desconsiderado nao bate com a conta', d.mes::text
from {{ ref('dre_mensal') }} d
where d.mes = date '2026-10-01'
  and abs(d.valor_desconsiderado - (select coalesce(sum(valor), 0) from conta)) > 0.01

union all

select 'conta desconsiderada ainda na despesa sem categoria', d.mes::text
from {{ ref('dre_mensal') }} d
where d.mes = date '2026-10-01'
  and d.despesa_sem_categoria >= (select coalesce(sum(valor), 0) from conta)
  and (select count(*) from conta) > 0
