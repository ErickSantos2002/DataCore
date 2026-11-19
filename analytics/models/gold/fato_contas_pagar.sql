{#
  `fato_contas_pagar` — a despesa, grão de CONTA. É a base do `dre_mensal` e o que o Midas
  (agente CFO do HS.OS) consulta quando precisa descer do mês para a conta.

  Mesmo desenho do `fato_contas_receber`: o fato não decide nada que dependa de "hoje".
  Atraso corrente, "provisório", "mês incompleto" — tudo isso muda a cada build e por isso
  é dito na CONSULTA, contra a data de referência dela. Aqui fica só o que aconteceu.

  ## Quatro datas, quatro perguntas

  | data              | responde                         | quem usa                       |
  |-------------------|----------------------------------|--------------------------------|
  | `data_emissao`    | quando a despesa foi lançada     | **o Balancete e o DRE**        |
  | `data_vencimento` | quando vence                     | agenda de caixa                |
  | `data_competencia`| a que mês a despesa pertence     | ninguém ainda (o dado fica)    |
  | `data_liquidacao` | quando o dinheiro saiu           | caixa realizado                |

  ⚠️ **O DRE é por emissão, não por competência**, porque é a régua do Balancete da tela,
  que é a autoridade de custo — um DRE por competência ao lado do Balancete por emissão
  seriam dois "custos de outubro". E o financeiro lança conta com emissão retroativa
  (30–60 dias depois), então mês recente cresce depois de fechado: em 2026-11-19, julho
  tinha 21 contas a mais do que em 2026-09-29, todas lançadas em outubro com emissão de
  julho.

  ⚠️ `vencimento` e `competencia` têm valores fora da `dim_tempo` (vencimento em 2066,
  competência no ano 9850 — digitação na origem). Ficam como vieram; o teste de relação
  delas é `warn`. A emissão, que é a régua, é `error`.

  ## Linha do DRE: plano de contas, depois exceção

  `categoria_dre` dá a linha pelo código da categoria; `excecoes_contas_pagar` sobrescreve
  quando fornecedor + código + histórico batem (hoje: as parcelas do Itaú em 9.3, que são
  dívida e não tarifa — **ainda sem confirmação do Financeiro**). A exceção muda
  `linha_dre` e `natureza`, nunca `grupo_balancete`: o Balancete soma a conta onde o Tiny
  a pôs, e é isso que deixa as âncoras por grupo conferíveis.

  ⚠️ Duas exceções casando a mesma conta multiplicariam a linha. Não há desempate aqui de
  propósito: `fato_contas_pagar_reconcilia_com_a_silver` derruba o build, e a exceção
  ambígua é corrigida no seed, onde a decisão mora.
#}

{{ config(materialized = 'table') }}

with contas as (

    select * from {{ ref('stg_contas_pagar') }}

),

plano as (

    select * from {{ ref('categoria_dre') }}

),

excecoes as (

    select
        {{ normalizar_texto('fornecedor') }}    as fornecedor_normalizado,
        categoria_codigo,
        padrao_historico,
        linha_dre,
        natureza,
        confirmado = 'sim'                      as confirmado,
        motivo
    from {{ ref('excecoes_contas_pagar') }}

)

select
    -- ------------------------------------------------------------------ chaves
    c.id                                        as sk_conta,
    c.id_tiny,

    -- quatro papéis da dim_tempo — ver cabeçalho
    c.data_emissao,
    c.vencimento                                as data_vencimento,
    c.competencia                               as data_competencia,
    c.liquidacao                                as data_liquidacao,

    -- ------------------------------------------- dimensões degeneradas
    c.categoria,
    c.categoria_codigo,
    c.grupo_balancete,
    p.rotulo                                    as categoria_rotulo,
    coalesce(e.linha_dre, p.linha_dre)          as linha_dre,
    coalesce(e.natureza, p.natureza)            as natureza,
    p.linha_dre                                 as linha_dre_do_plano,
    e.linha_dre is not null                     as reclassificada,
    -- NULL quando não houve reclassificação: "confirmada" só tem sentido se houve
    e.confirmado                                as reclassificacao_confirmada,
    e.motivo                                    as motivo_reclassificacao,

    c.fornecedor_nome,
    c.documento_fornecedor,
    c.historico,
    c.numero_documento,
    c.situacao,
    c.estado,

    -- ------------------------------------------------------------------ estado
    c.estado = 'aberto'                         as em_aberto,
    c.estado = 'cancelada'                      as cancelada,

    -- ------------------------------------------------------------------ métricas
    c.valor,
    c.saldo,

    -- realizado: negativo = pagou adiantado. NULL enquanto não liquidou (ver cabeçalho).
    case
        when c.liquidacao is not null then c.liquidacao - c.vencimento
    end                                         as dias_de_atraso

from contas c
-- left join: conta sem linha no plano NÃO some do fato (o total encolheria calado). Ela
-- fica com linha NULL e o teste `categoria_do_tiny_sem_linha_no_dre` derruba o build.
left join plano p
       on p.categoria_codigo = c.categoria_codigo
left join excecoes e
       on e.fornecedor_normalizado = c.fornecedor_nome_normalizado
      and e.categoria_codigo       = c.categoria_codigo
      and c.historico_normalizado ilike e.padrao_historico
