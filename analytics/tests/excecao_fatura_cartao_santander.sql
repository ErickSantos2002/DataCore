{#
  A fatura do cartão paga por boleto no Santander (9.3, "Pagamento de Boleto") é cartão,
  não tarifa — Financeiro, 2026-11-19. Âncora: jul/2026, mês sem conta em 9.1: a fatura
  dele está no grupo 9 do DRE como despesa operacional, e `tem_fatura_cartao` é verdade.
  Nenhum "Pagamento de Boleto" do Santander em 9.3 sobra na despesa financeira.
#}

{{ config(severity = 'error') }}

select 'boleto do Santander em 9.3 fora do cartao' as problema, sk_conta::text as chave
from {{ ref('fato_contas_pagar') }}
where categoria_codigo = '9.3'
  and fornecedor_nome ilike '%santander%'
  and historico ilike 'pagamento de boleto%'
  and (natureza <> 'operacional' or linha_dre <> 'cartao' or not fatura_cartao or grupo_dre <> '9')

union all

select 'ancora jul/2026 sem fatura do cartao', mes::text
from {{ ref('dre_mensal') }}
where mes = date '2026-07-01'
  and (not tem_fatura_cartao or despesa_grupo_9_cartoes <= 0)

union all

select 'ancora jul/2026 sem boleto do Santander', null
where not exists (
    select 1 from {{ ref('fato_contas_pagar') }}
    where fatura_cartao and categoria_codigo = '9.3' and mes_dre = date '2026-07-01'
)
