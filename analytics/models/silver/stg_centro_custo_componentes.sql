{#
  `stg_centro_custo_componentes` — os `custos_diretos` da aba Centro de Custo, um por linha,
  com a decisão de entrar ou não no CMV (seed `componente_custo_direto`).

  O `custos_diretos` da aba já é POR UNIDADE (o `calcularCusto` soma direto, sem dividir).
  A descrição é texto livre digitado na tela ("Frete ", "Plástico Bolha"): normaliza antes
  de casar. Componente sem linha no seed fica com `entra_no_cmv` nulo e o teste
  `componente_de_custo_direto_sem_classificacao` para o build — entrar ou sair do CMV no
  chute é exatamente o erro que não aparece.
#}

with configs as (

    select id, btrim(produto) as produto, ano, config_json::jsonb as cfg
    from {{ source('tiny', 'centro_custo_config') }}
    where config_json is not null

),

componentes as (

    select
        c.id                                             as id_config,
        c.produto,
        c.ano,
        d.ordem,
        d.item ->> 'descricao'                           as descricao_original,
        {{ normalizar_texto("(d.item ->> 'descricao')") }} as componente,
        {{ texto_para_numero("(d.item ->> 'valor')") }}    as valor_unitario
    from configs c
    -- `jsonb_typeof`: a chave ausente ou gravada como null não pode virar erro de
    -- `jsonb_array_elements`
    cross join lateral jsonb_array_elements(
        case when jsonb_typeof(c.cfg -> 'custos_diretos') = 'array'
             then c.cfg -> 'custos_diretos' else '[]'::jsonb end
    ) with ordinality as d(item, ordem)

)

select
    c.id_config,
    c.produto,
    c.ano,
    c.ordem,
    c.descricao_original,
    c.componente,
    c.valor_unitario,
    s.entra_no_cmv = 'sim'      as entra_no_cmv,
    s.motivo
from componentes c
left join {{ ref('componente_custo_direto') }} s on s.componente = c.componente
