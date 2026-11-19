{#
  A guia da DCTFWeb (Receita Federal, 8.4, "Recibo Declaração … Apuração MM/AAAA") é INSS
  + IRRF da folha — Financeiro, 2026-11-19. No DRE ela é pessoal (grupo 1,
  `encargos_da_folha`), no mês da APURAÇÃO. Âncora: a guia emitida em out/2026 com
  apuração 09/2026 conta em set/2026. A taxa da Prefeitura em 8.4 continua onde estava, e
  o Balancete continua com a guia no grupo 8.
#}

{{ config(severity = 'error') }}

with guias as (

    select *,
           to_date(substring(historico_normalizado from 'apuracao:?\s*(\d{2}/\d{4})'), 'MM/YYYY') as apuracao
    from (
        select f.*, s.historico_normalizado
        from {{ ref('fato_contas_pagar') }} f
        join {{ ref('stg_contas_pagar') }} s on s.id = f.sk_conta
        where f.categoria_codigo = '8.4'
    ) x

)

select 'guia da DCTFWeb fora da folha ou fora do mes da apuracao' as problema, sk_conta::text as chave
from guias
where fornecedor_nome ilike 'receita federal'
  and historico_normalizado like 'recibo declaracao%apuracao%'
  and (natureza <> 'operacional' or grupo_dre <> '1' or grupo_balancete <> '8'
       or linha_dre <> 'encargos_da_folha'
       or (apuracao is not null and mes_dre <> apuracao))

union all

select 'taxa da Prefeitura saiu do 8.4', sk_conta::text
from guias
where fornecedor_nome ilike '%prefeitura%' and (linha_dre = 'encargos_da_folha' or grupo_dre <> '8')

union all

select 'ancora: guia de out/2026 nao esta em set/2026', null
where not exists (
    select 1 from guias
    where data_emissao >= date '2026-10-01' and data_emissao < date '2026-11-01'
      and linha_dre = 'encargos_da_folha' and mes_dre = date '2026-09-01'
)

union all

select 'ancora: set/2026 sem encargos da folha no grupo 1', mes::text
from {{ ref('dre_mensal') }}
where mes = date '2026-09-01' and (encargos_da_folha <= 0 or encargos_da_folha > despesa_grupo_1_equipe)
