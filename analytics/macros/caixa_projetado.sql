{#
  `caixa_projetado(data_ref)` — a projeção de caixa de 13 semanas (a da `data_ref` e mais
  12), como se hoje fosse `data_ref`. É um macro, e não um modelo, para que a MESMA conta
  sirva ao `caixa_semanal` (hoje) e ao `caixa_semanal_backtest` (datas passadas): um
  backtest com SQL próprio provaria outra conta.

  A regra, as medições e o porquê de cada escolha estão no cabeçalho do `caixa_semanal`.
  Aqui ficam só os detalhes da mecânica.

  ## "Como se hoje fosse" — o que era visível na data

  - **A receber:** visível desde a EMISSÃO. O `created_at` não serve antes de 06/09/2026
    (a base inteira foi carregada em 05–06/09); depois dessa data, emissão e `created_at`
    caem no mesmo dia em 98% dos títulos.
  - **A pagar:** visível desde o `created_at` (a carga é diária), exceto o lote de
    29/09/2026, que repôs contas que o extrator tinha perdido ("buraco no contas a
    pagar"): elas existiam no Tiny, e ali vale a emissão.
  - **Em aberto na data:** sem liquidação e em aberto hoje, ou liquidada na data ou depois.
    Valor: o `saldo` se ainda está aberto; o `valor` se já foi liquidada (o saldo daquele dia
    não está guardado em lugar nenhum).
#}

{% macro caixa_projetado(data_ref, semanas_entrada=26, semanas_saida=26, atraso_saida=63) %}

with parametros as (

    select
        ({{ data_ref }})::date                                     as r,
        -- ritmo de recebimento: as 26 semanas antes da data
        ({{ data_ref }})::date - 7 * {{ semanas_entrada }}         as entrada_ini,
        ({{ data_ref }})::date                                     as entrada_fim,
        {{ semanas_entrada }} * 7 / 30.4375                        as entrada_meses,
        -- ritmo de pagamento: janela que termina `atraso_saida` dias antes da data, porque
        -- a conta a pagar só entra no banco de 11 a 60 dias DEPOIS de paga
        ({{ data_ref }})::date - {{ atraso_saida }} - 7 * {{ semanas_saida }} as saida_ini,
        ({{ data_ref }})::date - {{ atraso_saida }}                as saida_fim

),

semanas as (

    select
        k                                                          as semana,
        date_trunc('week', p.r)::date + 7 * k                      as inicio_semana,
        date_trunc('week', p.r)::date + 7 * k + 6                  as fim_semana,
        -- a semana corrente só projeta da data em diante: o que já passou é realizado
        greatest(p.r, date_trunc('week', p.r)::date + 7 * k)       as inicio_projecao
    from parametros p
    cross join generate_series(0, 12) as k

),

-- dia em que o dinheiro se move: o próprio dia, se útil; senão, o próximo dia útil
calendario as (

    select
        t.data,
        (select min(u.data) from {{ ref('dim_tempo') }} u
          where u.data >= t.data and u.dia_util)                   as dia_caixa
    from {{ ref('dim_tempo') }} t, parametros p
    where t.data between p.r - 7 * 70 and p.r + 7 * 13 + 7

),

-- dias futuros da janela, já movidos para o dia útil
dias_futuros as (

    select c.data, c.dia_caixa, s.semana
    from calendario c
    join parametros p on c.dia_caixa >= p.r
    join semanas s on c.dia_caixa between s.inicio_projecao and s.fim_semana

),

-- ======================================================================= A RECEBER

receber as (

    select c.*
    from {{ ref('stg_contas_receber') }} c
    where c.situacao <> 'cancelada'

),

-- Em aberto numa data `d`: visível (emissão até `d`), não excluída até `d`, e sem
-- liquidação até a véspera. Serve à data de referência e às datas da calibração.
-- `posicao`: a faixa de atraso, se vencido; a semana do vencimento (relativa à semana de
-- `d`), se a vencer. É a chave da taxa.
datas_avaliadas as (

    select p.r as d, true as e_referencia from parametros p
    union all
    -- calibração: 52 datas passadas, toda semana, no mesmo dia da semana da referência,
    -- de 13 a 64 semanas antes dela — todas com as 13 semanas seguintes já observadas
    select p.r - 7 * n, false from parametros p cross join generate_series(13, 64) as n

),

abertos as (

    select
        da.d,
        da.e_referencia,
        c.id,
        c.vencimento,
        c.liquidacao,
        case
            when c.liquidacao is not null then c.valor  -- liquidada depois: o saldo do dia era o valor
            else c.saldo
        end                                                        as valor_aberto,
        case
            when c.vencimento < da.d then {{ faixa_de_atraso('da.d - c.vencimento') }}
            else 'v' || lpad(least(
                     (date_trunc('week', coalesce(cal.dia_caixa, c.vencimento))::date - date_trunc('week', da.d)::date) / 7,
                     13)::text, 2, '0')
        end                                                        as posicao
    from datas_avaliadas da
    join receber c
      on c.data_emissao <= da.d
     and (c.excluida_na_origem_em is null or c.excluida_na_origem_em::date > da.d)
     and (c.liquidacao >= da.d or (c.liquidacao is null and c.situacao in ('aberto', 'pendente')))
    left join calendario cal on cal.data = c.vencimento

),

-- taxa[posição][semana k]: do que estava em aberto naquela posição, quanto entrou na
-- semana k seguinte (a semana 0 começa em `d`, como na projeção)
taxa_base as (

    select posicao, sum(valor_aberto) as base
    from abertos where not e_referencia
    group by 1

),

taxa as (

    select
        a.posicao,
        k.semana,
        coalesce(sum(a.valor_aberto) filter (
            where a.liquidacao >= greatest(a.d, date_trunc('week', a.d)::date + 7 * k.semana)
              and a.liquidacao <= date_trunc('week', a.d)::date + 7 * k.semana + 6
        ), 0) / nullif(b.base, 0)                                  as taxa
    from abertos a
    cross join generate_series(0, 12) as k(semana)
    join taxa_base b on b.posicao = a.posicao
    where not a.e_referencia
    group by a.posicao, k.semana, b.base

),

-- Do que entrou na semana k depois de `d`, quanto veio de título que ainda NÃO existia
-- em `d` (emitido depois). É a parte que só o ritmo pode prever.
participacao_novos as (

    select
        k.semana,
        sum(c.valor) filter (where c.data_emissao > cd.d) / nullif(sum(c.valor), 0) as participacao
    from (select distinct d from abertos where not e_referencia) cd
    cross join generate_series(0, 12) as k(semana)
    join receber c
      on c.situacao in ('pago', 'recebido')
     and c.excluida_na_origem_em is null
     and c.liquidacao >= greatest(cd.d, date_trunc('week', cd.d)::date + 7 * k.semana)
     and c.liquidacao <= date_trunc('week', cd.d)::date + 7 * k.semana + 6
    group by 1

),

aberto_na_referencia as (

    select posicao, posicao like 'v%' as a_vencer, sum(valor_aberto) as valor
    from abertos where e_referencia
    group by 1, 2

),

entrada_esperada as (

    select
        t.semana,
        sum(a.valor * t.taxa) filter (where a.a_vencer)            as a_vencer,
        sum(a.valor * t.taxa) filter (where not a.a_vencer)        as vencida
    from aberto_na_referencia a
    join taxa t on t.posicao = a.posicao
    group by 1

),

-- o valor de face, por semana do vencimento: é o que "fecha com os títulos"
entrada_a_vencer as (

    select s.semana, sum(a.valor_aberto) as valor, count(*) as titulos
    from abertos a
    join calendario c on c.data = a.vencimento
    join semanas s on c.dia_caixa between s.inicio_projecao and s.fim_semana
    where a.e_referencia and a.posicao like 'v%'
    group by 1

),

-- ---------------------------------------------- ritmo de recebimento
-- Média por DIA DO MÊS nas 26 semanas (e não média semanal): recebimento e pagamento se
-- concentram em dias certos do mês, e a média semanal achataria esse dia.
recebimentos as (

    select c.liquidacao as data, c.valor
    from receber c, parametros p
    where c.liquidacao >= p.entrada_ini and c.liquidacao < p.entrada_fim
      and c.excluida_na_origem_em is null
      and c.situacao in ('pago', 'recebido')

),

perfil_entrada as (

    select extract(day from data)::int as dia, sum(valor) / max(p.entrada_meses) as valor_medio
    from recebimentos, parametros p
    group by 1

),

ritmo_entrada as (

    select f.semana, sum(pe.valor_medio) as valor
    from dias_futuros f
    join perfil_entrada pe on pe.dia = extract(day from f.data)::int
    group by 1

),

-- ======================================================================= A PAGAR

pagar as (

    select
        f.*,
        case
            -- o lote que tapou o "buraco no contas a pagar": existia no Tiny desde a emissão
            when s.created_at::date = date '2026-09-29' then f.data_emissao
            else coalesce(s.created_at::date, f.data_emissao)
        end                                                        as visivel_desde,
        case
            when f.parcela_de_parcelamento        then 'parcela'
            when f.natureza = 'importacao'        then 'importacao'
            else 'recorrente'
        end                                                        as tipo_saida,
        -- a fatura do cartão (9.1) só existe no Tiny desde set/2026: ritmo próprio, para
        -- a falta de histórico dela não diluir a do grupo 9 (tarifas)
        case when f.categoria_codigo = '9.1' then '9.1' else f.grupo_balancete end
                                                                   as chave_ritmo
    from {{ ref('fato_contas_pagar') }} f
    join {{ ref('stg_contas_pagar') }} s on s.id = f.sk_conta
    where not f.cancelada

),

pagar_aberto as (

    select
        a.tipo_saida,
        a.chave_ritmo,
        -- vencida e ainda em aberto: sai na semana corrente (o erro seguro é o pessimista)
        greatest(a.data_vencimento, p.r)                           as data_prevista,
        case when a.data_liquidacao is not null then a.valor else a.saldo end as valor_aberto
    from pagar a, parametros p
    where a.visivel_desde <= p.r
      and (   (a.data_liquidacao is null and a.em_aberto)
           or a.data_liquidacao >= p.r)

),

saida_aberta as (

    select s.semana, a.tipo_saida, a.chave_ritmo, sum(a.valor_aberto) as valor, count(*) as titulos
    from pagar_aberto a
    join calendario c on c.data = a.data_prevista
    join semanas s on c.dia_caixa between s.inicio_projecao and s.fim_semana
    group by 1, 2, 3

),

-- ---------------------------------------------- ritmo de pagamento, por chave
pagamentos as (

    select a.chave_ritmo, a.data_liquidacao as data, a.valor
    from pagar a, parametros p
    where a.tipo_saida = 'recorrente'
      and a.data_liquidacao >= p.saida_ini and a.data_liquidacao < p.saida_fim
      and a.visivel_desde <= p.r

),

meses_por_chave as (

    -- chave que começou no meio da janela (a fatura do cartão) divide pelos meses que
    -- teve, não pelos seis: senão o ritmo dela sai diluído
    select
        g.chave_ritmo,
        greatest((p.saida_fim - greatest(p.saida_ini, g.primeiro)) / 30.4375, 1) as meses
    from (select chave_ritmo, min(data) as primeiro from pagamentos group by 1) g, parametros p

),

perfil_saida as (

    select pg.chave_ritmo, extract(day from pg.data)::int as dia, sum(pg.valor) / m.meses as valor_medio
    from pagamentos pg
    join meses_por_chave m on m.chave_ritmo = pg.chave_ritmo
    group by pg.chave_ritmo, 2, m.meses

),

ritmo_saida_chave as (

    select f.semana, ps.chave_ritmo, sum(ps.valor_medio) as valor
    from dias_futuros f
    join perfil_saida ps on ps.dia = extract(day from f.data)::int
    group by 1, 2

),

-- o ritmo, descontado do que já está lançado em aberto na MESMA chave e semana
saida_estimada as (

    select
        r.semana,
        sum(r.valor)                                                         as ritmo,
        sum(greatest(r.valor - coalesce(a.valor, 0), 0))                     as valor
    from ritmo_saida_chave r
    left join saida_aberta a
      on a.semana = r.semana and a.chave_ritmo = r.chave_ritmo and a.tipo_saida = 'recorrente'
    group by 1

),

saida_conhecida as (

    select
        semana,
        sum(valor) filter (where tipo_saida = 'parcela')     as parcelas,
        sum(valor) filter (where tipo_saida = 'recorrente')  as a_pagar,
        sum(valor) filter (where tipo_saida = 'importacao')  as importacao
    from saida_aberta
    group by 1

),

-- ======================================================================= MONTAGEM

montado as (

    select
        p.r                                                        as data_referencia,
        s.semana,
        s.inicio_semana,
        s.fim_semana,
        s.inicio_projecao,
        (select count(*) from {{ ref('dim_tempo') }} t
          where t.data between s.inicio_projecao and s.fim_semana and t.dia_util)
                                                                   as dias_uteis_projetados,

        coalesce(av.valor, 0)                                      as entrada_a_vencer,
        coalesce(av.titulos, 0)                                    as titulos_a_vencer,
        coalesce(ee.a_vencer, 0)                                   as entrada_a_vencer_esperada,
        coalesce(ee.vencida, 0)                                    as entrada_vencida_esperada,
        coalesce(re.valor, 0)                                      as ritmo_entrada,
        coalesce(pn.participacao, 0)                               as participacao_novos,

        coalesce(sc.parcelas, 0)                                   as saida_parcelas,
        coalesce(sc.a_pagar, 0)                                    as saida_a_pagar_em_aberto,
        coalesce(sc.importacao, 0)                                 as saida_importacao,
        coalesce(se.ritmo, 0)                                      as ritmo_saida,
        coalesce(se.valor, 0)                                      as saida_estimada

    from semanas s
    cross join parametros p
    left join entrada_a_vencer av on av.semana = s.semana
    left join entrada_esperada ee on ee.semana = s.semana
    left join ritmo_entrada    re on re.semana = s.semana
    left join participacao_novos pn on pn.semana = s.semana
    left join saida_conhecida  sc on sc.semana = s.semana
    left join saida_estimada   se on se.semana = s.semana

),

com_totais as (

    select
        *,
        entrada_a_vencer_esperada + entrada_vencida_esperada                 as entrada_conhecida,
        ritmo_entrada * participacao_novos
                                                                             as entrada_estimada,
        saida_parcelas + saida_a_pagar_em_aberto                             as saida_conhecida
    from montado

)

select
    data_referencia,
    semana,
    inicio_semana,
    fim_semana,
    inicio_projecao,
    dias_uteis_projetados,

    -- entradas
    entrada_a_vencer,
    titulos_a_vencer,
    entrada_a_vencer_esperada,
    entrada_vencida_esperada,
    entrada_conhecida,
    entrada_estimada,
    entrada_conhecida + entrada_estimada                                     as entrada_total,
    ritmo_entrada,
    participacao_novos,

    -- saídas
    saida_parcelas,
    saida_a_pagar_em_aberto,
    saida_conhecida,
    saida_estimada,
    saida_importacao,
    saida_conhecida + saida_estimada + saida_importacao                      as saida_total,
    ritmo_saida,

    -- fluxo
    (entrada_conhecida + entrada_estimada)
      - (saida_conhecida + saida_estimada + saida_importacao)                as fluxo_liquido,
    sum((entrada_conhecida + entrada_estimada)
        - (saida_conhecida + saida_estimada + saida_importacao))
        over (partition by data_referencia order by semana)                  as fluxo_acumulado,

    -- confiança: quanto da semana é título lançado, e não ritmo
    round(100 * entrada_conhecida / nullif(entrada_conhecida + entrada_estimada, 0), 1)
                                                                             as pct_entrada_conhecida,
    round(100 * (saida_conhecida + saida_importacao)
          / nullif(saida_conhecida + saida_estimada + saida_importacao, 0), 1)
                                                                             as pct_saida_conhecida

from com_totais

{% endmacro %}


{#
  Faixa de atraso de um título vencido, em dias. Até 30 é atraso; depois, inadimplência
  (a régua da tela de Inadimplência). As faixas abaixo de 30 existem porque a chance de
  receber cai rápido nas primeiras semanas.
#}
{% macro faixa_de_atraso(dias) %}
    case
        when {{ dias }} <= 7   then '01-07'
        when {{ dias }} <= 15  then '08-15'
        when {{ dias }} <= 30  then '16-30'
        when {{ dias }} <= 90  then '31-90'
        when {{ dias }} <= 365 then '91-365'
        else '366+'
    end
{% endmacro %}
