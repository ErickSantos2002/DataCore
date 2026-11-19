{#
  `margem_por_linha_mensal` — "o que dá dinheiro?": receita, custo da mercadoria e margem
  bruta por mês e linha de negócio. É o que a skill `margem-por-linha` do Midas lê.

  | tipo | linhas | de onde |
  |---|---|---|
  | produto | aparelho · consumivel · acessorio | `fato_vendas.linha` (seed `linha_produto`) |
  | servico | calibracao · plataforma · locacao · servico_tecnico · outro | `fato_servicos.linha` |

  Por produto, a pergunta se responde direto no `fato_vendas` (`linha`, `cmv`,
  `valor_nota_rateado` por `sk_produto`); aqui fica o grão mês × linha.

  ## As réguas

  - **Receita bruta**, a mesma do `dre_mensal` (`receita_vendas` + `receita_servicos`):
    sem os impostos sobre venda, que o DRE não aloca por linha. A soma das linhas do mês é
    a `receita_bruta` do DRE, e o `cmv`, o do DRE (`margem_por_linha_fecha_com_o_dre`).
  - **CMV só em produto**, o do `fato_vendas` (Centro de Custo para os carros-chefe, que já
    inclui II, PIS, COFINS e desembaraço; cadastro para o resto).
  - **`lucro_bruto` = receita − cmv**, para fechar com o DRE. ⚠️ Inclui a receita SEM custo,
    que entra inteira como lucro: por isso a **`margem_bruta_pct` é calculada só sobre a
    receita com custo** — (receita com custo − cmv) ÷ receita com custo —, e a
    `cobertura_custo_pct` diz quanto da receita ela representa.

  ## Serviço: sem custo direto rastreado

  `cmv`, `lucro_bruto` e `margem_bruta_pct` ficam NULOS no serviço, e `cobertura_custo_pct`
  é 0. O custo da calibração (gás, laboratório, pessoal) e o da plataforma (sistema,
  pessoal) existem, mas estão na despesa operacional do `dre_mensal`, sem ligação com a
  nota. Margem de 100% seria uma margem que ninguém calculou.

  **Gás seco (6.3) não vira custo direto da calibração.** É comprado em lote (dois
  fornecedores, poucas contas no ano) e lançado depois de pago; somado no mês da compra,
  faria a margem da calibração oscilar com a reposição de estoque de gás, e não com a
  calibração feita. Para isso seria preciso o consumo por calibração, que não está no
  banco. Fica na despesa operacional.

  `quantidade`: unidades vendidas no produto; no serviço, notas (NFS-e) — o serviço não
  tem unidade comparável (uma nota pode ter 1 ou 40 bafômetros).
#}

{{ config(materialized = 'table') }}

with produto as (

    select
        date_trunc('month', data_venda)::date                              as mes,
        'produto'                                                          as tipo,
        coalesce(linha, 'sem_linha')                                       as linha,
        sum(valor_nota_rateado)                                            as receita,
        sum(valor_nota_rateado) filter (where fonte_custo <> 'sem_custo')  as receita_com_custo,
        coalesce(sum(cmv), 0)                                              as cmv,
        sum(quantidade)                                                    as quantidade,
        count(distinct id_nota)                                            as notas
    from {{ ref('fato_vendas') }}
    group by 1, 2, 3

),

servico as (

    select
        date_trunc('month', data_servico)::date                            as mes,
        'servico'                                                          as tipo,
        linha,
        sum(valor_servicos)                                                as receita,
        0::numeric                                                         as receita_com_custo,
        null::numeric                                                      as cmv,
        count(*)::numeric                                                  as quantidade,
        count(*)                                                           as notas
    from {{ ref('fato_servicos') }}
    group by 1, 2, 3

),

unido as (

    select * from produto
    union all
    select * from servico

)

select
    mes,
    extract(year from mes)::int                                            as ano,
    tipo,
    linha,
    receita,
    cmv,
    case when tipo = 'produto' then receita - cmv end                      as lucro_bruto,
    case
        when tipo = 'produto' and coalesce(receita_com_custo, 0) <> 0
            then round(100 * (receita_com_custo - cmv) / receita_com_custo, 1)
    end                                                                    as margem_bruta_pct,
    coalesce(receita_com_custo, 0)                                         as receita_com_custo,
    case
        when receita <> 0 then round(100 * coalesce(receita_com_custo, 0) / receita, 1)
    end                                                                    as cobertura_custo_pct,
    quantidade,
    notas,
    case
        when tipo = 'servico' then 'sem custo direto rastreado: o custo do serviço está na despesa operacional'
    end                                                                    as observacao_custo
from unido
