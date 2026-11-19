{#
  Parcela de parcelamento não cai no mês do lançamento.

  O defeito (35e720e, corrigido em 2026-11-19): o `dre_mensal` agrupava tudo por emissão,
  e parcelamento entra no Tiny de uma vez — out/2026 recebeu as parcelas da dívida do Itaú
  até 2030 e de três parcelamentos de imposto até 2031. Os outros testes passavam com o
  bloco no mês errado, porque o Balancete também é por emissão: nenhum deles olha o
  VENCIMENTO.

  Este olha, em duas partes:

  1. **Conta.** Nenhuma conta de dívida ou imposto de um lançamento múltiplo (2+ contas
     com mesmo fornecedor + código + emissão) entra num mês do DRE vencendo mais de 60
     dias depois do fim desse mês. A âncora é o vencimento, não a regra do modelo: se o
     `mes_dre` voltar a ser a emissão, as parcelas de 2027 em diante aparecem aqui.
     Conta isolada fica de fora (emissão digitada errada ou cota única do trimestre — 1
     conta em 2026-11-19, ver cabeçalho do `fato_contas_pagar`).
  2. **Mês.** `amortizacao_de_divida`, `impostos_sobre_venda` e `impostos_sobre_lucro` de
     cada mês do DRE são a soma do fato por `mes_dre`. Sem isto, o fato poderia estar
     certo e o DRE agrupar por outra data.
#}

{{ config(severity = 'error') }}

with fato as (

    select
        *,
        count(*) over (partition by fornecedor_nome, categoria_codigo, data_emissao) as tamanho_do_lancamento
    from {{ ref('fato_contas_pagar') }}
    where not cancelada
      and natureza in ('divida', 'imposto_venda', 'imposto_lucro')

),

parcela_fora as (

    select
        mes_dre                                         as mes,
        'conta ' || id_tiny::text                       as conferencia,
        data_vencimento                                 as esperado,
        null::numeric                                   as obtido
    from fato
    where tamanho_do_lancamento >= 2
      and data_vencimento - ((mes_dre + interval '1 month')::date - 1) > 60

),

por_mes as (

    select
        mes_dre                                                   as mes,
        sum(valor) filter (where natureza = 'divida')             as divida,
        sum(valor) filter (where natureza = 'imposto_venda')      as imposto_venda,
        sum(valor) filter (where natureza = 'imposto_lucro')      as imposto_lucro
    from fato
    group by 1

),

mes_fora as (

    select d.mes, x.conferencia, null::date as esperado, x.diferenca as obtido
    from {{ ref('dre_mensal') }} d
    left join por_mes f on f.mes = d.mes
    cross join lateral (values
        ('amortizacao_de_divida', d.amortizacao_de_divida - coalesce(f.divida, 0)),
        ('impostos_sobre_venda',  d.impostos_sobre_venda  - coalesce(f.imposto_venda, 0)),
        ('impostos_sobre_lucro',  d.impostos_sobre_lucro  - coalesce(f.imposto_lucro, 0))
    ) as x(conferencia, diferenca)
    where abs(x.diferenca) > 0.01

)

select mes, conferencia, esperado, obtido from parcela_fora
union all
select mes, conferencia, esperado, obtido from mes_fora
