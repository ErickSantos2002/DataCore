{#
  A âncora do DRE: a despesa de cada mês, POR GRUPO, bate com o Balancete da tela.

  O Balancete (Gerenciamento Financeiro → Balancete, `montarBalancete` no frontend) é a
  autoridade de custo. A régua dele é refeita aqui direto da BRONZE, sem passar pela
  silver: `excluida_na_origem_em IS NULL`, mês pela `data_emissao`, sem filtro de
  situação, grupo = o número que abre a categoria (ou "outros"). Se a silver mudar de
  régua, este teste acusa — conferir o modelo contra ele mesmo não acusaria nada.

  ⚠️ **Por grupo, não só o total.** Conferir só a soma passa igual com categoria na
  linha errada; por grupo, um código mapeado para o grupo errado no seed aparece aqui.

  O valor da âncora conferida à mão (jul/2026) não está neste repositório — ele é
  público e carrega a régua, não o resultado (ver `scripts/verificar_sem_valores.sh`).
  O que fica aqui é a igualdade, mês a mês, para sempre.
#}

{{ config(severity = 'error') }}

with tela as (

    select
        date_trunc('month', data_emissao)::date             as mes,
        coalesce(substring(categoria from '^(\d+)'), 'sem') as grupo,
        sum(valor)                                          as valor
    from {{ source('tiny', 'contas_pagar') }}
    where excluida_na_origem_em is null
    group by 1, 2

),

fato as (

    select
        date_trunc('month', data_emissao)::date as mes,
        grupo_balancete                         as grupo,
        sum(valor)                              as valor
    from {{ ref('fato_contas_pagar') }}
    group by 1, 2

),

por_grupo as (

    select coalesce(t.mes, f.mes) as mes, coalesce(t.grupo, f.grupo) as grupo,
           t.valor as valor_tela, f.valor as valor_gold, 'grupo' as conferencia
    from tela t
    full join fato f on f.mes = t.mes and f.grupo = t.grupo
    where t.valor is distinct from f.valor

),

-- e as duas colunas de conferência do DRE, contra a mesma régua
total_tela as (

    select mes,
           sum(valor)                                       as total,
           sum(valor) filter (where grupo not in ('7', '8')) as sem_impostos
    from tela group by 1

),

por_mes as (

    select d.mes, 'balancete_sem_impostos' as grupo,
           coalesce(t.sem_impostos, 0) as valor_tela, d.balancete_sem_impostos as valor_gold,
           'dre_mensal' as conferencia
    from {{ ref('dre_mensal') }} d
    left join total_tela t on t.mes = d.mes
    where coalesce(t.sem_impostos, 0) <> d.balancete_sem_impostos
       or coalesce(t.total, 0) <> d.balancete_total

)

select * from por_grupo
union all
select * from por_mes
