{#
  Âncora do rateio aduaneiro: o iBlow 10 PRO em out/2026 (mês fechado), recalculado da
  origem por OUTRO caminho — `jsonb_path_query` direto sobre `tiny.centro_custo_config`,
  sem passar pela silver — e comparado com o custo unitário de cada item do `fato_vendas`.

    custo = (Σ serviços aduaneiros × participação% ÷ unidades importadas)
          + componentes do aparelho ('Bafômetro')

  O valor esperado em real fica fora deste arquivo (repositório público); o que se tranca
  é a conta. Para garantir que o rateio participa de verdade, a âncora também falha se o
  mês não tiver venda do produto ou se a parte aduaneira for zero.
#}

{{ config(severity = 'error') }}

with cfg as (

    select config_json::jsonb as c
    from {{ source('tiny', 'centro_custo_config') }}
    where produto = 'BAFÔMETRO PASSIVO - IBLOW 10 PRO' and ano = 2026

),

esperado as (

    select
        (select sum(v::text::numeric) from cfg, jsonb_path_query(c, '$.servicos_aduaneiros[*].valor') v)
          * (select (c ->> 'participacao_pct')::numeric from cfg) / 100
          / (select (c ->> 'unidades_importadas')::numeric from cfg)        as aduaneiro_un,
        (select sum(v::text::numeric) from cfg,
                jsonb_path_query(c, '$.custos_diretos[*] ? (@.descricao like_regex "^ *bafômetro *$" flag "i").valor') v)
                                                                            as aparelho_un

),

itens as (

    select f.custo_unitario, f.fonte_custo, f.quantidade
    from {{ ref('fato_vendas') }} f
    join {{ ref('dim_produto') }} p on p.sk_produto = f.sk_produto
    where p.id_produto = '612544323'
      and f.data_venda >= date '2026-10-01' and f.data_venda < date '2026-11-01'

)

select 'item com custo diferente da conta' as problema, i.custo_unitario, e.aduaneiro_un + e.aparelho_un as esperado
from itens i, esperado e
where i.fonte_custo <> 'centro_custo'
   or abs(i.custo_unitario - (e.aduaneiro_un + e.aparelho_un)) > 0.01
union all
select 'sem venda no mes da ancora', null, null where not exists (select 1 from itens)
union all
select 'rateio aduaneiro zerado ou nulo', null, aduaneiro_un from esperado
where coalesce(aduaneiro_un, 0) <= 0 or coalesce(aparelho_un, 0) <= 0
