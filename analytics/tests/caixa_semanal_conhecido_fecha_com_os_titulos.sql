{#
  O conhecido de cada semana do `caixa_semanal` fecha com a soma dos títulos, recalculada
  aqui pela régua da skill `contas-receber`, direto da bronze:

  - `entrada_a_vencer` = saldo do a receber em aberto (`aberto`/`pendente`, sem excluídas)
    que vence na semana, com o vencimento movido para o próximo dia útil;
  - `saida_parcelas + saida_a_pagar_em_aberto + saida_importacao` = saldo do a pagar em
    aberto (fora excluídas, canceladas e as desconsideradas pelo seed de exceções) da
    semana; o vencido em aberto conta na semana corrente.

  Liquidado hoje conta como em aberto pelo valor, como no macro: a semana corrente começa
  hoje. Título fora do horizonte (além da semana 12) não entra em nenhum dos dois lados.
#}

{{ config(severity = 'error') }}

with semanas as (

    select semana, inicio_projecao, fim_semana from {{ ref('caixa_semanal') }}

),

proximo_dia_util as (

    select t.data, (select min(u.data) from {{ ref('dim_tempo') }} u where u.data >= t.data and u.dia_util) as dia
    from {{ ref('dim_tempo') }} t
    where t.data between current_date - 3 and current_date + 100

),

receber as (

    select s.semana, sum(case when r.liquidacao is not null then r.valor else r.saldo end) as valor
    from {{ source('tiny', 'contas_receber') }} r
    join proximo_dia_util d on d.data = r.vencimento
    join semanas s on d.dia between s.inicio_projecao and s.fim_semana
    where (lower(r.situacao) in ('aberto', 'pendente') and r.liquidacao is null
           or r.liquidacao >= current_date and lower(r.situacao) <> 'cancelada')
      and r.excluida_na_origem_em is null
      and r.vencimento >= current_date
    group by 1

),

pagar as (

    select s.semana, sum(case when p.liquidacao is not null then p.valor else p.saldo end) as valor
    from {{ source('tiny', 'contas_pagar') }} p
    join proximo_dia_util d on d.data = greatest(p.vencimento, current_date)
    join semanas s on d.dia between s.inicio_projecao and s.fim_semana
    where (lower(p.situacao) in ('aberto', 'pendente', 'parcial') and p.liquidacao is null
           or p.liquidacao >= current_date and lower(p.situacao) <> 'cancelada')
      and p.excluida_na_origem_em is null
      and p.id not in (select sk_conta from {{ ref('fato_contas_pagar') }} where natureza = 'desconsiderada')
    group by 1

)

select c.semana,
       c.entrada_a_vencer, r.valor as titulos_a_receber,
       c.saida_parcelas + c.saida_a_pagar_em_aberto + c.saida_importacao as saida_lancada,
       p.valor as titulos_a_pagar
from {{ ref('caixa_semanal') }} c
left join receber r on r.semana = c.semana
left join pagar   p on p.semana = c.semana
where abs(c.entrada_a_vencer - coalesce(r.valor, 0)) > 0.01
   or abs(c.saida_parcelas + c.saida_a_pagar_em_aberto + c.saida_importacao - coalesce(p.valor, 0)) > 0.01
