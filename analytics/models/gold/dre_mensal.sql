{#
  `dre_mensal` — o resultado do mês, uma linha por mês do DRE (`fato_contas_pagar.mes_dre`):
  o mês de EMISSÃO, exceto parcela de parcelamento, que vai para o mês do VENCIMENTO. É o
  que a skill `resultado-mensal` do Midas (agente CFO do HS.OS) lê.

  ## Por que emissão

  É a régua de data do Balancete da tela (Gerenciamento Financeiro → Balancete), que é a
  autoridade de custo. Um DRE por competência ao lado de um Balancete por emissão seriam
  dois "custos de outubro" que não batem, e quem lê não tem como saber qual vale. A
  competência está no `fato_contas_pagar` para quando alguém quiser.

  ## A exceção: parcelamento vai para o mês da parcela

  Parcelamento de dívida ou de imposto entra no Tiny de uma vez, com a emissão no dia do
  lançamento e os vencimentos espalhados por anos. Por emissão, out/2026 recebia de uma vez
  as parcelas da dívida do Itaú até 2030 e de três parcelamentos de imposto até 2031. Por
  isso, **parcela de parcelamento (dívida e imposto) entra no mês do VENCIMENTO**; todo o
  resto continua na emissão. A regra, e por que é por lote, 60 dias, só dívida e imposto e
  vencimento em vez de competência, está no cabeçalho do `fato_contas_pagar`, que é onde
  `mes_dre` nasce.

  - A **despesa operacional nunca muda de mês**: a regra não alcança o lançamento
    retroativo (conta lançada já paga com emissão retroativa), que é o motivo de o DRE ser
    por emissão.
  - As colunas **`balancete_*` continuam por EMISSÃO** — são a tela, e a tela não mudou.
    Em mês com parcelamento, `balancete_total` e a despesa do DRE deixam de bater, e é para
    ser assim.
  - **Meses futuros existem**: a janela vai até a última parcela agendada (2031). Mês sem
    nenhum lançamento — só parcelas que ainda vão vencer — tem `mes_lancado = false`, e
    quem lê o "resultado do mês" filtra por ele (e pela data de referência da consulta).
  - `dre_mensal_sem_parcela_fora_do_mes` tranca o caso: nenhuma conta de dívida ou imposto
    conta num mês do DRE vencendo mais de 60 dias depois dele.

  ## As réguas que já existem não são refeitas aqui

  - **Receita bruta** = `fato_vendas.valor_nota_rateado` por `data_venda` +
    `fato_servicos.valor_servicos` por `data_servico` — exatamente o que
    `GET /faturamento/mensal` soma para o painel. O que é venda quem decide é a silver.
  - **Despesa** = `fato_contas_pagar`, com a linha do DRE dada pelo seed `categoria_dre`
    e pelas exceções.
  - **CMV** = `fato_vendas.cmv` por `data_venda` — a regra (fonte do custo, ano sem
    configuração) está no cabeçalho do `fato_vendas`.

  ## A ordem do DRE

      receita bruta (vendas + serviços)
    − impostos sobre venda                        → receita líquida
    − CMV (custo da mercadoria vendida)           → lucro bruto
    − despesas operacionais, por grupo            → resultado operacional
    − financeiro (tarifas)
    − impostos sobre lucro                        → resultado
    − dívida (amortização)                        → resultado_apos_divida
      abaixo da linha: importação, dividendos, investimento

  **Dívida fica fora do `resultado`** (corrigido em 2026-11-19 — a 1ª versão a punha acima,
  a pedido da spec do Midas, e isso estava errado): amortização de principal não é despesa.
  Ela continua em `amortizacao_de_divida`, que o Midas usa como saída de caixa, e
  `resultado_apos_divida` = `resultado` − `amortizacao_de_divida`, para quem quer saber o
  que sobra depois de pagar o banco. ⚠️ Juros: o Tiny lança a parcela inteira (principal +
  juros) numa conta só; não há como separar aqui, e `despesa_financeira` só tem o que foi
  lançado como tarifa. A parcela inteira está em `amortizacao_de_divida`.

  ## CMV (2026-11-19)

  Até aqui a venda do aparelho entrava inteira na receita e a compra dele ficava abaixo da
  linha, como importação: o `resultado` era "antes do custo da mercadoria". Agora o CMV
  desconta o custo do que SAIU no mês, e a **importação continua abaixo da linha** — ela é
  compra de estoque; descontar as duas contaria o aparelho duas vezes.

  - `cmv` só tem os itens com custo. `receita_produto_sem_custo` é a receita de venda dos
    itens sem custo nenhum, e `cobertura_cmv_pct` = receita de produto com custo ÷ receita
    de produto (0–100; nulo sem venda). Cobertura abaixo de 100 = `lucro_bruto` superestimado
    na proporção dessa receita — quem lê tem que dizer.
  - `cmv_de_outro_ano`: parte do CMV calculada com o custo do último ano configurado no
    Centro de Custo, porque o ano da venda não tem configuração. Diferente de zero = o mês
    usa custo emprestado de outro ano.
  - Serviço (calibração) não tem CMV: não há mercadoria. Peça consumida na calibração,
    se houver, não está aqui (pendência).

  ⚠️ **Só tem despesa o que está no contas a pagar.** Não há receita financeira. O grupo
  1 tem, desde 2026-11-19, a guia da DCTFWeb (INSS + IRRF da folha) que o Tiny põe em 8.4
  (`encargos_da_folha`), no mês da apuração; a folha de cada mês é lançada até o dia 15
  do seguinte, então o mês corrente e o anterior têm o grupo 1 incompleto.

  **Grupo do DRE ≠ grupo do Balancete.** As colunas `despesa_grupo_*` somam por
  `grupo_dre` (o do Balancete, salvo exceção); as `balancete_*`, por `grupo_balancete`.

  ## Conta cancelada

  Fica fora do DRE (cancelada não é despesa). As colunas `balancete_*` NÃO tiram: elas
  reproduzem a tela como ela é, inclusive nesse ponto, porque existem para a conferência.
  Em 2026-11-19 não havia nenhuma conta cancelada no contas a pagar.

  ## Qualidade, não "provisório"

  `tem_fatura_cartao`: houve fatura do cartão no mês — em 9.1, ou, de mar/2025 a set/2026,
  paga por boleto no Santander e lançada como tarifa (9.3), que a exceção reclassifica
  para o cartão (corrigido em 2026-11-19: antes disso esses meses pareciam sem fatura, e a
  despesa estava na linha errada, não faltando). Mês sem fatura tem despesa subestimada. É fato do mês, determinístico. "Provisório"
  (mês corrente e o anterior crescem com o lançamento retroativo) depende de hoje e é dito
  na consulta, nunca guardado aqui.

  `valor_reclassificado_nao_confirmado`: quanto do mês está numa linha por exceção que o
  Financeiro ainda não confirmou (desde 2026-11-19, nenhuma: o Itaú foi confirmado). Diferente de zero = o DRE
  do mês depende dessa decisão, e quem lê tem que dizer isso.
#}

{{ config(materialized = 'table') }}

with contas as (

    select mes_dre as mes, *
    from {{ ref('fato_contas_pagar') }}

),

-- O Balancete é por EMISSÃO, sempre — inclusive nas parcelas. Por isso é agrupado à parte.
balancete as (

    select
        date_trunc('month', data_emissao)::date                     as mes,
        sum(valor)                                                  as balancete_total,
        sum(valor) filter (where grupo_balancete not in ('7', '8')) as balancete_sem_impostos
    from {{ ref('fato_contas_pagar') }}
    group by 1

),

vendas as (

    select
        date_trunc('month', data_venda)::date                                  as mes,
        sum(valor_nota_rateado)                                                as valor,
        coalesce(sum(cmv), 0)                                                  as cmv,
        coalesce(sum(cmv) filter (where fonte_custo = 'centro_custo_de_outro_ano'), 0)
                                                                               as cmv_de_outro_ano,
        coalesce(sum(valor_nota_rateado) filter (where fonte_custo = 'sem_custo'), 0)
                                                                               as receita_sem_custo
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
-- `current_date`, para o modelo não mudar de forma conforme o dia do build. Vai até a
-- última parcela agendada — ver `mes_lancado`.
janela as (

    select min(mes) as inicio, max(mes) as fim
    from (
        select mes from contas
        union all select mes from balancete
        union all select mes from vendas
        union all select mes from servicos
    ) m

),

-- Mês em que algo foi LANÇADO: houve venda, serviço ou conta emitida. Mês futuro só com
-- parcela agendada não entra.
lancados as (

    select mes from balancete
    union select mes from vendas
    union select mes from servicos

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

        sum(valor) filter (where not cancelada and natureza = 'operacional' and grupo_dre = '1')   as despesa_grupo_1_equipe,
        sum(valor) filter (where not cancelada and natureza = 'operacional' and grupo_dre = '2')   as despesa_grupo_2_sede,
        sum(valor) filter (where not cancelada and natureza = 'operacional' and grupo_dre = '3')   as despesa_grupo_3_servicos_de_apoio,
        sum(valor) filter (where not cancelada and natureza = 'operacional' and grupo_dre = '4')   as despesa_grupo_4_gerais,
        sum(valor) filter (where not cancelada and natureza = 'operacional' and grupo_dre = '5')   as despesa_grupo_5_diretoria,
        sum(valor) filter (where not cancelada and natureza = 'operacional' and grupo_dre = '6')   as despesa_grupo_6_materiais,
        sum(valor) filter (where not cancelada and natureza = 'operacional' and grupo_dre = '9')   as despesa_grupo_9_cartoes,
        sum(valor) filter (where not cancelada and natureza = 'operacional' and grupo_dre = '10')  as despesa_grupo_10_outros,
        sum(valor) filter (where not cancelada and natureza = 'operacional' and grupo_dre = 'sem') as despesa_sem_categoria,
        sum(valor) filter (where not cancelada and natureza = 'operacional')                             as despesa_operacional,
        sum(valor) filter (where not cancelada and linha_dre = 'encargos_da_folha')                     as encargos_da_folha,

        sum(valor) filter (where not cancelada and natureza = 'financeiro')     as despesa_financeira,
        sum(valor) filter (where not cancelada and natureza = 'divida')         as amortizacao_de_divida,
        sum(valor) filter (where not cancelada and natureza = 'imposto_lucro')  as impostos_sobre_lucro,

        sum(valor) filter (where not cancelada and natureza = 'importacao')     as importacao,
        sum(valor) filter (where not cancelada and natureza = 'dividendo')      as dividendos,
        sum(valor) filter (where not cancelada and natureza = 'investimento')   as investimento,
        sum(valor) filter (where not cancelada and natureza = 'desconsiderada') as valor_desconsiderado,

        -- ------------------------------------------------- qualidade
        count(*) filter (where fatura_cartao and not cancelada) > 0             as tem_fatura_cartao,
        sum(valor) filter (where not cancelada and reclassificada and not reclassificacao_confirmada)
                                                                                as valor_reclassificado_nao_confirmado,
        count(*)                                                                as qtd_contas,
        count(*) filter (where parcela_de_parcelamento)                         as qtd_parcelas,
        coalesce(sum(valor) filter (where not cancelada and parcela_de_parcelamento), 0)
                                                                                as valor_parcelas

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
        coalesce(v.cmv, 0)                                              as cmv,
        coalesce(v.cmv_de_outro_ano, 0)                                 as cmv_de_outro_ano,
        coalesce(v.receita_sem_custo, 0)                                as receita_produto_sem_custo,

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
        coalesce(d.encargos_da_folha, 0)                                as encargos_da_folha,

        coalesce(d.despesa_financeira, 0)                               as despesa_financeira,
        coalesce(d.amortizacao_de_divida, 0)                            as amortizacao_de_divida,
        coalesce(d.impostos_sobre_lucro, 0)                             as impostos_sobre_lucro,

        coalesce(d.importacao, 0)                                       as importacao,
        coalesce(d.dividendos, 0)                                       as dividendos,
        coalesce(d.investimento, 0)                                     as investimento,
        coalesce(d.valor_desconsiderado, 0)                             as valor_desconsiderado,

        coalesce(d.tem_fatura_cartao, false)                            as tem_fatura_cartao,
        coalesce(d.valor_reclassificado_nao_confirmado, 0)              as valor_reclassificado_nao_confirmado,
        coalesce(d.qtd_contas, 0)                                       as qtd_contas,
        coalesce(d.qtd_parcelas, 0)                                     as qtd_parcelas,
        coalesce(d.valor_parcelas, 0)                                   as valor_parcelas,
        l.mes is not null                                               as mes_lancado,
        coalesce(b.balancete_total, 0)                                  as balancete_total,
        coalesce(b.balancete_sem_impostos, 0)                           as balancete_sem_impostos

    from meses m
    left join vendas    v on v.mes = m.mes
    left join servicos  s on s.mes = m.mes
    left join despesa   d on d.mes = m.mes
    left join balancete b on b.mes = m.mes
    left join lancados  l on l.mes = m.mes

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

    cmv,
    receita_bruta - impostos_sobre_venda - cmv                          as lucro_bruto,
    receita_produto_sem_custo,
    case
        when receita_vendas <> 0
            then round(100 * (receita_vendas - receita_produto_sem_custo) / receita_vendas, 2)
    end                                                                 as cobertura_cmv_pct,
    cmv_de_outro_ano,

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
    -- dentro do grupo 1: a guia da DCTFWeb (INSS + IRRF da folha)
    encargos_da_folha,
    receita_bruta - impostos_sobre_venda - cmv - despesa_operacional    as resultado_operacional,

    despesa_financeira,
    impostos_sobre_lucro,
    receita_bruta - impostos_sobre_venda - cmv - despesa_operacional
        - despesa_financeira - impostos_sobre_lucro                     as resultado,

    -- dívida: fora do resultado (principal não é despesa), mas é saída de caixa
    amortizacao_de_divida,
    receita_bruta - impostos_sobre_venda - cmv - despesa_operacional
        - despesa_financeira - impostos_sobre_lucro - amortizacao_de_divida
                                                                        as resultado_apos_divida,

    -- abaixo da linha
    importacao,
    dividendos,
    investimento,

    -- fora do DRE por decisão do Financeiro (seed de exceções); está no Balancete
    valor_desconsiderado,

    -- qualidade
    mes_lancado,
    tem_fatura_cartao,
    valor_reclassificado_nao_confirmado,
    qtd_contas,
    qtd_parcelas,
    valor_parcelas,

    -- conferência com o Balancete da tela (por EMISSÃO)
    balancete_total,
    balancete_sem_impostos

from montado
