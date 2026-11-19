{#
  `dre_mensal` — o resultado do mês, uma linha por mês de EMISSÃO. É o que a skill
  `resultado-mensal` do Midas (agente CFO do HS.OS) lê.

  ## Por que emissão

  É a régua de data do Balancete da tela (Gerenciamento Financeiro → Balancete), que é a
  autoridade de custo. Um DRE por competência ao lado de um Balancete por emissão seriam
  dois "custos de outubro" que não batem, e quem lê não tem como saber qual vale. A
  competência está no `fato_contas_pagar` para quando alguém quiser.

  ## As réguas que já existem não são refeitas aqui

  - **Receita bruta** = `fato_vendas.valor_nota_rateado` por `data_venda` +
    `fato_servicos.valor_servicos` por `data_servico` — exatamente o que
    `GET /faturamento/mensal` soma para o painel. O que é venda quem decide é a silver.
  - **Despesa** = `fato_contas_pagar`, com a linha do DRE dada pelo seed `categoria_dre`
    e pelas exceções.

  ## A ordem do DRE

      receita bruta (vendas + serviços)
    − impostos sobre venda                        → receita líquida
    − despesas operacionais, por grupo            → resultado operacional
    − financeiro (tarifas) − dívida (amortização)
    − impostos sobre lucro                        → resultado
      abaixo da linha: importação, dividendos, investimento

  ⚠️ **Dívida entra acima do resultado** porque é o que a especificação do Midas pede (é
  saída de caixa que compete com o resultado). Contabilmente, amortização de principal não
  é despesa — quem quiser o resultado contábil soma `amortizacao_de_divida` de volta.

  ⚠️ **Só tem despesa o que está no contas a pagar.** Não há receita financeira, e o grupo
  1 é pessoal parcial (encargos e retenções que o Tiny não registra ficam de fora).

  ## Conta cancelada

  Fica fora do DRE (cancelada não é despesa). As colunas `balancete_*` NÃO tiram: elas
  reproduzem a tela como ela é, inclusive nesse ponto, porque existem para a conferência.
  Em 2026-11-19 não havia nenhuma conta cancelada no contas a pagar.

  ## Qualidade, não "provisório"

  `tem_fatura_cartao`: a fatura do cartão (9.1) só aparece no Tiny a partir de set/2026,
  e mês sem ela tem despesa subestimada. É fato do mês, determinístico. "Provisório"
  (mês corrente e o anterior crescem com o lançamento retroativo) depende de hoje e é dito
  na consulta, nunca guardado aqui.

  `valor_reclassificado_nao_confirmado`: quanto do mês está numa linha por exceção que o
  Financeiro ainda não confirmou (hoje, as parcelas do Itaú). Diferente de zero = o DRE
  do mês depende dessa decisão, e quem lê tem que dizer isso.
#}

{{ config(materialized = 'table') }}

with contas as (

    select
        date_trunc('month', data_emissao)::date as mes,
        *
    from {{ ref('fato_contas_pagar') }}

),

vendas as (

    select date_trunc('month', data_venda)::date as mes, sum(valor_nota_rateado) as valor
    from {{ ref('fato_vendas') }}
    group by 1

),

servicos as (

    select date_trunc('month', data_servico)::date as mes, sum(valor_servicos) as valor
    from {{ ref('fato_servicos') }}
    group by 1

),

-- Todo mês entre o primeiro e o último movimento existe, tenha havido algo ou não: mês
-- sem linha some do gráfico em vez de aparecer como zero. A janela sai dos dados, não de
-- `current_date`, para o modelo não mudar de forma conforme o dia do build.
janela as (

    select min(mes) as inicio, max(mes) as fim
    from (
        select mes from contas
        union all select mes from vendas
        union all select mes from servicos
    ) m

),

meses as (

    select t.data as mes
    from {{ ref('dim_tempo') }} t, janela j
    where t.data between j.inicio and j.fim
      and extract(day from t.data) = 1

),

despesa as (

    select
        mes,

        -- ------------------------------------------------- DRE (sem as canceladas)
        sum(valor) filter (where not cancelada and natureza = 'imposto_venda')  as impostos_sobre_venda,

        sum(valor) filter (where not cancelada and natureza = 'operacional' and grupo_balancete = '1')   as despesa_grupo_1_equipe,
        sum(valor) filter (where not cancelada and natureza = 'operacional' and grupo_balancete = '2')   as despesa_grupo_2_sede,
        sum(valor) filter (where not cancelada and natureza = 'operacional' and grupo_balancete = '3')   as despesa_grupo_3_servicos_de_apoio,
        sum(valor) filter (where not cancelada and natureza = 'operacional' and grupo_balancete = '4')   as despesa_grupo_4_gerais,
        sum(valor) filter (where not cancelada and natureza = 'operacional' and grupo_balancete = '5')   as despesa_grupo_5_diretoria,
        sum(valor) filter (where not cancelada and natureza = 'operacional' and grupo_balancete = '6')   as despesa_grupo_6_materiais,
        sum(valor) filter (where not cancelada and natureza = 'operacional' and grupo_balancete = '9')   as despesa_grupo_9_cartoes,
        sum(valor) filter (where not cancelada and natureza = 'operacional' and grupo_balancete = '10')  as despesa_grupo_10_outros,
        sum(valor) filter (where not cancelada and natureza = 'operacional' and grupo_balancete = 'sem') as despesa_sem_categoria,
        sum(valor) filter (where not cancelada and natureza = 'operacional')                             as despesa_operacional,

        sum(valor) filter (where not cancelada and natureza = 'financeiro')     as despesa_financeira,
        sum(valor) filter (where not cancelada and natureza = 'divida')         as amortizacao_de_divida,
        sum(valor) filter (where not cancelada and natureza = 'imposto_lucro')  as impostos_sobre_lucro,

        sum(valor) filter (where not cancelada and natureza = 'importacao')     as importacao,
        sum(valor) filter (where not cancelada and natureza = 'dividendo')      as dividendos,
        sum(valor) filter (where not cancelada and natureza = 'investimento')   as investimento,

        -- ------------------------------------------------- qualidade
        count(*) filter (where categoria_codigo = '9.1' and not cancelada) > 0  as tem_fatura_cartao,
        sum(valor) filter (where not cancelada and reclassificada and not reclassificacao_confirmada)
                                                                                as valor_reclassificado_nao_confirmado,
        count(*)                                                                as qtd_contas,

        -- ------------------------------------------------- conferência com a tela
        -- A régua do Balancete, sem mexer em nada: todo o contas a pagar vivo, por
        -- emissão, grupo = número que abre a categoria. "Sem impostos" = fora 7 e 8.
        sum(valor)                                                              as balancete_total,
        sum(valor) filter (where grupo_balancete not in ('7', '8'))             as balancete_sem_impostos

    from contas
    group by 1

),

montado as (

    select
        m.mes,
        extract(year from m.mes)::int                                   as ano,
        extract(month from m.mes)::int                                  as mes_numero,

        coalesce(v.valor, 0)                                            as receita_vendas,
        coalesce(s.valor, 0)                                            as receita_servicos,
        coalesce(v.valor, 0) + coalesce(s.valor, 0)                     as receita_bruta,
        coalesce(d.impostos_sobre_venda, 0)                             as impostos_sobre_venda,

        coalesce(d.despesa_grupo_1_equipe, 0)                           as despesa_grupo_1_equipe,
        coalesce(d.despesa_grupo_2_sede, 0)                             as despesa_grupo_2_sede,
        coalesce(d.despesa_grupo_3_servicos_de_apoio, 0)                as despesa_grupo_3_servicos_de_apoio,
        coalesce(d.despesa_grupo_4_gerais, 0)                           as despesa_grupo_4_gerais,
        coalesce(d.despesa_grupo_5_diretoria, 0)                        as despesa_grupo_5_diretoria,
        coalesce(d.despesa_grupo_6_materiais, 0)                        as despesa_grupo_6_materiais,
        coalesce(d.despesa_grupo_9_cartoes, 0)                          as despesa_grupo_9_cartoes,
        coalesce(d.despesa_grupo_10_outros, 0)                          as despesa_grupo_10_outros,
        coalesce(d.despesa_sem_categoria, 0)                            as despesa_sem_categoria,
        coalesce(d.despesa_operacional, 0)                              as despesa_operacional,

        coalesce(d.despesa_financeira, 0)                               as despesa_financeira,
        coalesce(d.amortizacao_de_divida, 0)                            as amortizacao_de_divida,
        coalesce(d.impostos_sobre_lucro, 0)                             as impostos_sobre_lucro,

        coalesce(d.importacao, 0)                                       as importacao,
        coalesce(d.dividendos, 0)                                       as dividendos,
        coalesce(d.investimento, 0)                                     as investimento,

        coalesce(d.tem_fatura_cartao, false)                            as tem_fatura_cartao,
        coalesce(d.valor_reclassificado_nao_confirmado, 0)              as valor_reclassificado_nao_confirmado,
        coalesce(d.qtd_contas, 0)                                       as qtd_contas,
        coalesce(d.balancete_total, 0)                                  as balancete_total,
        coalesce(d.balancete_sem_impostos, 0)                           as balancete_sem_impostos

    from meses m
    left join vendas   v on v.mes = m.mes
    left join servicos s on s.mes = m.mes
    left join despesa  d on d.mes = m.mes

)

select
    mes,
    ano,
    mes_numero,

    receita_vendas,
    receita_servicos,
    receita_bruta,
    impostos_sobre_venda,
    receita_bruta - impostos_sobre_venda                                as receita_liquida,

    despesa_grupo_1_equipe,
    despesa_grupo_2_sede,
    despesa_grupo_3_servicos_de_apoio,
    despesa_grupo_4_gerais,
    despesa_grupo_5_diretoria,
    despesa_grupo_6_materiais,
    despesa_grupo_9_cartoes,
    despesa_grupo_10_outros,
    despesa_sem_categoria,
    despesa_operacional,
    receita_bruta - impostos_sobre_venda - despesa_operacional          as resultado_operacional,

    despesa_financeira,
    amortizacao_de_divida,
    impostos_sobre_lucro,
    receita_bruta - impostos_sobre_venda - despesa_operacional
        - despesa_financeira - amortizacao_de_divida - impostos_sobre_lucro
                                                                        as resultado,

    -- abaixo da linha
    importacao,
    dividendos,
    investimento,

    -- qualidade
    tem_fatura_cartao,
    valor_reclassificado_nao_confirmado,
    qtd_contas,

    -- conferência com o Balancete da tela
    balancete_total,
    balancete_sem_impostos

from montado
