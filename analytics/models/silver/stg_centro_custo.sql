{#
  `stg_centro_custo` — o custo unitário de cada produto da aba Centro de Custo, por ano. É
  de onde o `fato_vendas` tira o CMV dos carros-chefe.

  ## A conta é a da tela, menos o overhead

  `calcularCusto` (frontend/src/pages/financeiro/centroCusto.ts) faz
  `custoAduaneiroPorUn + totalDireto + overheadPorUn`, com
  `custoAduaneiroPorUn = soma dos serviços aduaneiros × participação% ÷ unidades importadas`
  (nulo sem participação ou sem unidades — aqui também).

  Para o CMV, duas partes ficam de fora:
  - **overhead**: rateia a despesa fixa da empresa, que o DRE já desconta na despesa
    operacional. Somá-lo contaria a mesma despesa duas vezes.
  - **custo direto que já está no contas a pagar** (frete de entrega, gás, Infotech,
    embalagem): mesmo motivo. Quem decide componente a componente é o seed
    `componente_custo_direto`, via `stg_centro_custo_componentes`.

  `custo_unitario_tela` (aduaneiro + todos os diretos) existe para a conferência com a aba.

  ## Configuração que não vale

  A tabela tem linha sem `config_json`, linha com nome solto ("PHOEBUS", "TESTE") e linha
  gravada zerada (2025). `configurado = false` quando a conta dá zero ou nada: o fato trata
  como ano sem configuração, e NUNCA como custo zero. Quais nomes contam é o seed
  `produto_centro_custo` quem diz; aqui entram todas as linhas.
#}

with configs as (

    select id, btrim(produto) as produto, ano, config_json::jsonb as cfg
    from {{ source('tiny', 'centro_custo_config') }}
    where config_json is not null

),

aduaneiro as (

    select c.id, sum({{ texto_para_numero("(s.item ->> 'valor')") }}) as total_aduaneiro
    from configs c
    cross join lateral jsonb_array_elements(
        case when jsonb_typeof(c.cfg -> 'servicos_aduaneiros') = 'array'
             then c.cfg -> 'servicos_aduaneiros' else '[]'::jsonb end
    ) as s(item)
    group by 1

),

diretos as (

    select
        id_config                                          as id,
        sum(valor_unitario)                                as custo_direto_unitario,
        coalesce(sum(valor_unitario) filter (where entra_no_cmv), 0)
                                                           as custo_direto_no_cmv_unitario,
        count(*) filter (where entra_no_cmv is null)       as qtd_componentes_sem_classificacao
    from {{ ref('stg_centro_custo_componentes') }}
    group by 1

),

calculado as (

    select
        c.id                                                         as id_config,
        c.produto,
        c.ano,
        coalesce(a.total_aduaneiro, 0)                               as total_aduaneiro,
        {{ texto_para_numero("(c.cfg ->> 'participacao_pct')") }}     as participacao_pct,
        {{ texto_para_numero("(c.cfg ->> 'unidades_importadas')") }}  as unidades_importadas,
        coalesce(d.custo_direto_unitario, 0)                         as custo_direto_unitario,
        coalesce(d.custo_direto_no_cmv_unitario, 0)                  as custo_direto_no_cmv_unitario,
        coalesce(d.qtd_componentes_sem_classificacao, 0)             as qtd_componentes_sem_classificacao
    from configs c
    left join aduaneiro a on a.id = c.id
    left join diretos   d on d.id = c.id

),

rateado as (

    select
        *,
        case
            when participacao_pct > 0 and unidades_importadas > 0
                then total_aduaneiro * participacao_pct / 100 / unidades_importadas
        end                                                          as custo_aduaneiro_unitario
    from calculado

)

select
    id_config,
    produto,
    ano,
    total_aduaneiro,
    participacao_pct,
    unidades_importadas,
    custo_aduaneiro_unitario,
    custo_direto_unitario,
    custo_direto_no_cmv_unitario,
    -- o que a aba mostra sem o overhead — só para conferir com a tela
    coalesce(custo_aduaneiro_unitario, 0) + custo_direto_unitario    as custo_unitario_tela,
    -- o custo do CMV
    coalesce(custo_aduaneiro_unitario, 0) + custo_direto_no_cmv_unitario
                                                                     as custo_cmv_unitario,
    coalesce(custo_aduaneiro_unitario, 0) + custo_direto_no_cmv_unitario > 0
                                                                     as configurado,
    qtd_componentes_sem_classificacao
from rateado
