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
  | `data_vencimento` | quando vence                     | agenda de caixa; DRE da parcela|
  | `data_competencia`| a que mês a despesa pertence     | ninguém (não é confiável)      |
  | `data_liquidacao` | quando o dinheiro saiu           | caixa realizado                |

  ⚠️ **O DRE é por emissão, não por competência** (exceto parcelamento, abaixo), porque é a régua do Balancete da tela,
  que é a autoridade de custo — um DRE por competência ao lado do Balancete por emissão
  seriam dois "custos de outubro". E o financeiro lança conta com emissão retroativa
  (30–60 dias depois), então mês recente cresce depois de fechado: em 2026-11-19, julho
  tinha 21 contas a mais do que em 2026-09-29, todas lançadas em outubro com emissão de
  julho.

  ## Parcelamento: `mes_dre` = mês do VENCIMENTO

  Parcelamento de dívida ou de imposto é lançado no Tiny de uma vez: todas as parcelas com a
  emissão do dia do lançamento e os vencimentos espalhados por anos. Por emissão, anos de
  parcelas caíam num mês só — em out/2026 a dívida do Itaú e três parcelamentos de imposto
  (DAS, ICMS, ICMS-ST) fizeram o imposto sobre venda passar de 2/5 da receita do mês.

  **A regra.** `parcela_de_parcelamento` = a conta é de `divida`, `imposto_venda` ou
  `imposto_lucro` **e** pertence a um LOTE (mesmo fornecedor + código de categoria + data de
  emissão) de 2 contas ou mais em que pelo menos uma vence mais de 60 dias depois da
  emissão. Parcela de parcelamento vai para o mês do vencimento; o resto, para o da
  emissão. Por que cada peça:

  - **Por lote, não por conta.** As primeiras parcelas vencem em 30–45 dias; um corte por
    conta deixaria a 1ª e a 2ª no mês do lançamento. O lote leva todas juntas.
  - **60 dias.** Imposto do mês é emitido no mês e vence no seguinte (até ~60 dias); acima
    disso, em dívida e imposto, só há parcelamento — medido em 2026-11-19, os lotes de 2021,
    2023 e out–nov/2026 são todos de parcelas ("Parcela 31/60", "Parcela Giro 11/57"...).
  - **2 contas ou mais.** Conta sozinha com vencimento longe é outra coisa: emissão
    digitada errada ou cota única de imposto do trimestre. Fica na emissão.
  - **Só dívida e imposto.** Despesa operacional fica SEMPRE na emissão: é o que protege a
    regra do lançamento retroativo (conta lançada já paga com emissão retroativa) e
    mantém `despesa_operacional` na régua do Balancete. As poucas operacionais parceladas
    (cerca de 30 contas entre 2021 e 2025) ficam de fora de propósito.
  - **Vencimento, não competência.** A competência casa com o mês do vencimento em todas as
    parcelas de 2026, mas no resto do contas a pagar ela não é confiável (competência anos
    antes da emissão, ano 2000, ano 9850) — e nos impostos comuns ela é o mês do
    vencimento, não o do fato gerador. Usá-la em geral moveria imposto comum de mês.

  O Balancete continua por emissão — `grupo_balancete` e `data_emissao` não mudam. É só o
  DRE que muda de mês, e `dre_mensal_sem_parcela_fora_do_mes` tranca isso.

  ⚠️ `vencimento` e `competencia` têm valores fora da `dim_tempo` (vencimento em 2066,
  competência no ano 9850 — digitação na origem). Ficam como vieram; o teste de relação
  delas é `warn`. A emissão, que é a régua, é `error`.

  ## Linha do DRE: plano de contas, depois exceção

  `categoria_dre` dá a linha pelo código da categoria; `excecoes_contas_pagar` sobrescreve
  quando fornecedor + código + histórico batem (as parcelas do Itaú em 9.3, que são dívida e
  não tarifa; a fatura do cartão paga por boleto no Santander, também em 9.3; a guia da
  DCTFWeb em 8.4 — todas confirmadas pelo Financeiro em 2026-11-19). A exceção muda
  `linha_dre` e `natureza`, nunca `grupo_balancete`: o Balancete soma a conta onde o Tiny
  a pôs, e é isso que deixa as âncoras por grupo conferíveis.

  Desde 2026-11-19 a exceção pode também (colunas vazias = não muda):
  - **`grupo_dre`**: o grupo em que o DRE soma a conta. A guia da DCTFWeb (INSS + IRRF da
    folha) está em 8.4 no Tiny e no Balancete, mas é pessoal: no DRE vai para o grupo 1.
    `grupo_balancete` não muda, e as colunas `balancete_*` e a âncora por grupo continuam
    batendo com a tela.
  - **`mes_dre = apuracao`**: o mês do DRE é o "Apuração MM/AAAA" do histórico, e não a
    emissão. A guia de outubro paga a folha de setembro, e é em setembro que ela é custo.
    Histórico sem o MM/AAAA (a guia do 13º) fica na emissão.
  - **`natureza = desconsiderada`**: a conta sai do DRE e do caixa projetado (conta que o
    Financeiro mandou esquecer). Fica no fato e no Balancete, que reproduz a tela.
  - **`id_tiny`**: a exceção vale só para aquela conta.

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

-- O lote de lançamento: mesmo fornecedor + código + emissão. É "de parcelas" quando tem 2
-- contas ou mais e alguma vence mais de 60 dias depois da emissão (ver cabeçalho).
lotes as (

    select
        id,
        count(*) over lote >= 2
        and bool_or(vencimento - data_emissao > 60) over lote   as lote_de_parcelas
    from contas
    window lote as (partition by fornecedor_nome_normalizado, categoria_codigo, data_emissao)

),

excecoes as (

    select
        {{ normalizar_texto('fornecedor') }}    as fornecedor_normalizado,
        categoria_codigo,
        padrao_historico,
        nullif(btrim(id_tiny), '')::bigint      as id_tiny,
        linha_dre,
        natureza,
        nullif(btrim(grupo_dre), '')            as grupo_dre,
        mes_dre,
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

    -- o mês do DRE — ver "Parcelamento" e "O mês da apuração" no cabeçalho
    case
        when parcela.de_parcelamento then date_trunc('month', c.vencimento)
        when e.mes_dre = 'apuracao' and apuracao.mes is not null then apuracao.mes
        else date_trunc('month', c.data_emissao)
    end::date                                   as mes_dre,
    parcela.de_parcelamento                     as parcela_de_parcelamento,

    -- ------------------------------------------- dimensões degeneradas
    c.categoria,
    c.categoria_codigo,
    c.grupo_balancete,
    -- o grupo em que o DRE soma a conta: o do Balancete, salvo exceção (ver cabeçalho)
    coalesce(e.grupo_dre, c.grupo_balancete)    as grupo_dre,
    p.rotulo                                    as categoria_rotulo,
    coalesce(e.linha_dre, p.linha_dre)          as linha_dre,
    coalesce(e.natureza, p.natureza)            as natureza,
    p.linha_dre                                 as linha_dre_do_plano,
    e.linha_dre is not null                     as reclassificada,
    -- NULL quando não houve reclassificação: "confirmada" só tem sentido se houve
    e.confirmado                                as reclassificacao_confirmada,
    e.motivo                                    as motivo_reclassificacao,
    -- a fatura do cartão: o código 9.1, ou a fatura lançada em outro código e
    -- reclassificada (antes de out/2026 ela vinha como tarifa do Santander)
    c.categoria_codigo = '9.1' or coalesce(e.linha_dre = 'cartao', false)
                                                as fatura_cartao,

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
      and coalesce(c.historico_normalizado, '') ilike e.padrao_historico
      and (e.id_tiny is null or e.id_tiny = c.id_tiny)
join lotes l
  on l.id = c.id
cross join lateral (
    select coalesce(e.natureza, p.natureza) in ('divida', 'imposto_venda', 'imposto_lucro')
           and l.lote_de_parcelas               as de_parcelamento
) parcela
-- "Apuração MM/AAAA" no histórico: o mês a que a guia se refere
cross join lateral (
    select to_date(substring(c.historico_normalizado from 'apuracao:?\s*(\d{2}/\d{4})'), 'MM/YYYY') as mes
) apuracao
