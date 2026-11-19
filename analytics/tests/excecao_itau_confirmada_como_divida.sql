{#
  As parcelas do Itaú em 9.3 são empréstimo, confirmado pelo Financeiro em 2026-11-19.
  Âncora: out/2026, o mês do lançamento em bloco. Nenhuma parcela do Itaú em 9.3 fica na
  tarifa, nenhuma reclassificação fica sem confirmação, e o DRE não tem mais valor
  reclassificado não confirmado em mês nenhum.
#}

{{ config(severity = 'error') }}

-- pelo nome normalizado: o Tiny grava "Itaú", com acento
with itau as (

    select f.*
    from {{ ref('fato_contas_pagar') }} f
    join {{ ref('stg_contas_pagar') }} s on s.id = f.sk_conta
    where s.fornecedor_nome_normalizado = 'itau' and f.categoria_codigo = '9.3'

)

select 'parcela do Itau fora da divida ou sem confirmacao' as problema, sk_conta::text as chave
from itau
where historico ilike '%parcela%'
  and (natureza <> 'divida' or not coalesce(reclassificacao_confirmada, false))

union all

select 'ancora out/2026 sem parcela do Itau na divida', null
where not exists (
    select 1 from itau
    where natureza = 'divida' and data_emissao >= date '2026-10-01' and data_emissao < date '2026-11-01'
)

union all

select 'mes com valor reclassificado nao confirmado', mes::text
from {{ ref('dre_mensal') }}
where valor_reclassificado_nao_confirmado <> 0
