{#
  Contas a pagar, tipadas, com a categoria quebrada em código e a situação normalizada.
  É a base do `fato_contas_pagar` e, por ele, do `dre_mensal` que o Midas (agente CFO do
  HS.OS) lê.

  ⚠️ **As colunas da origem se chamam `cliente_*`, mas aqui o papel é de FORNECEDOR.** Por
  isso viram `fornecedor_*` já na silver: quem ler `cliente_nome` três modelos adiante
  junta com `dim_cliente` e fornecedor vira cliente no relatório.

  ## Conta excluída na origem fica FORA (diferente do `stg_contas_receber`)

  O financeiro exclui a conta vencida e reemite com id novo. No contas a receber a linha
  fica, com a flag, porque o fato de lá prova o drill across e "aconteceu" importa. Aqui o
  consumidor é custo e resultado: a conta excluída e a reemitida são o MESMO compromisso, e
  manter as duas dobraria a despesa. É a régua do Balancete da tela
  (`excluida_na_origem_em IS NULL`), que é a autoridade de custo. Eram 226 contas
  excluídas em 2026-09-05.

  ## O código da categoria é a chave do plano de contas

  O Tiny não tem campo de grupo nem de código: os dois moram no começo do texto
  (`"9.3 - Tarifas Bancárias"` → código `9.3`, grupo `9`). E o texto não é estável — há
  categorias duplicadas que só diferem por um espaço no fim (`"1.9.5 - Comissão "`), uma
  sem espaço antes do hífen (`"2.7- Computadores"`) e categorias com NOME DE PESSOA no
  texto, que num repositório público não podem ir para um seed. O código resolve os três:
  é o que o seed `categoria_dre` usa como chave.

  - categoria vazia ou nula → código `sem` (o Balancete chama de "SEM CATEGORIA");
  - categoria com texto mas sem número → `texto:<texto normalizado>`. Não tem linha no
    seed e por isso QUEBRA o build no teste `categoria_do_tiny_sem_linha_no_dre` — é de
    propósito: categoria fora do plano não pode sumir do DRE calada.

  ## Situação

  `aberto`, `pendente` e `parcial` = **aberto** (ainda há o que pagar); `pago` =
  **quitado**; `cancelada` não é nenhum dos dois e fica fora do DRE. Situação que não
  estiver nessa lista vira NULL em `estado` e derruba o `not_null` — melhor parar do que
  classificar no chute.
#}

with bronze as (

    select * from {{ source('tiny', 'contas_pagar') }}
    where excluida_na_origem_em is null

),

limpo as (

    select
        id,
        id_tiny,

        -- ------------------------------------------------------------- quatro datas
        data_emissao,
        vencimento,
        competencia,
        liquidacao,

        coalesce(valor, 0)                               as valor,
        coalesce(saldo, 0)                               as saldo,

        -- ------------------------------------------------------------- categoria
        -- O texto como veio, só sem espaço nas pontas: é o que a tela mostra.
        nullif(btrim(categoria), '')                     as categoria,
        case
            when nullif(btrim(categoria), '') is null then 'sem'
            when btrim(categoria) ~ '^\d' then substring(btrim(categoria) from '^(\d+(?:\.\d+)*)')
            else 'texto:' || {{ normalizar_texto('categoria') }}
        end                                              as categoria_codigo,

        {{ normalizar_texto('situacao') }}               as situacao,
        historico,
        {{ normalizar_texto('historico') }}              as historico_normalizado,
        nro_documento                                    as numero_documento,
        ocorrencia,
        numero_parcelas,

        -- ------------------------------------------------------------- fornecedor
        btrim(cliente_nome)                              as fornecedor_nome,
        {{ normalizar_texto('cliente_nome') }}           as fornecedor_nome_normalizado,
        {{ so_digitos('cliente_cpf_cnpj') }}             as documento_fornecedor,

        created_at,
        updated_at

    from bronze

)

select
    *,
    -- o grupo do Balancete: o número antes do primeiro ponto
    case
        when categoria_codigo = 'sem' or categoria_codigo like 'texto:%' then 'sem'
        else split_part(categoria_codigo, '.', 1)
    end                                                  as grupo_balancete,
    case
        when situacao in ('aberto', 'pendente', 'parcial') then 'aberto'
        when situacao = 'pago'                             then 'quitado'
        when situacao = 'cancelada'                        then 'cancelada'
    end                                                  as estado
from limpo
