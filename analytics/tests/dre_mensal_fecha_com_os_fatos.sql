{#
  O `dre_mensal` não perde nem inventa dinheiro.

  1. Despesa: a soma de todas as linhas do DRE (operacional, impostos, financeiro,
     dívida, abaixo da linha) é o contas a pagar do mês (`mes_dre`) menos as canceladas. Se uma
     natureza nova entrar no seed sem coluna no DRE, ela some daqui — e é isto que acusa.
  2. Receita: o total de `receita_bruta` é o de `fato_vendas` + `fato_servicos`. Mês
     fora da janela do DRE ou junção errada aparece como diferença.

  Tolerância de R$ 0,01: soma de `numeric` não arredonda, então a tolerância só cobre
  o caso de alguém trocar o tipo para float.
#}

{{ config(severity = 'error') }}

with dre as (

    select
        mes,
        impostos_sobre_venda + despesa_operacional + despesa_financeira
          + amortizacao_de_divida + impostos_sobre_lucro
          + importacao + dividendos + investimento              as despesa_do_dre,
        despesa_operacional
          - (despesa_grupo_1_equipe + despesa_grupo_2_sede + despesa_grupo_3_servicos_de_apoio
             + despesa_grupo_4_gerais + despesa_grupo_5_diretoria + despesa_grupo_6_materiais
             + despesa_grupo_9_cartoes + despesa_grupo_10_outros + despesa_sem_categoria)
                                                                as operacional_fora_dos_grupos
    from {{ ref('dre_mensal') }}

),

fato as (

    select mes_dre as mes,
           sum(valor) filter (where not cancelada) as despesa
    from {{ ref('fato_contas_pagar') }}
    group by 1

),

despesa as (

    select d.mes, 'despesa' as conferencia,
           coalesce(f.despesa, 0) as esperado, d.despesa_do_dre as obtido
    from dre d
    left join fato f on f.mes = d.mes
    where abs(coalesce(f.despesa, 0) - d.despesa_do_dre) > 0.01
       or abs(d.operacional_fora_dos_grupos) > 0.01

),

receita as (

    select null::date as mes, 'receita' as conferencia,
           (select coalesce(sum(valor_nota_rateado), 0) from {{ ref('fato_vendas') }})
         + (select coalesce(sum(valor_servicos), 0) from {{ ref('fato_servicos') }}) as esperado,
           (select sum(receita_bruta) from {{ ref('dre_mensal') }})                  as obtido

)

select * from despesa
union all
select * from receita where abs(esperado - obtido) > 0.01
