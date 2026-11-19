{#
  `fato_servicos` — o faturamento de serviço (NFS-e).

  **Grão: A NOTA**, como a matriz de barramento (2.3) decidiu. Diferente do `fato_vendas`,
  que é grão de item: a NFS-e não tem itens, tem uma discriminação em texto livre. Grão de
  nota aqui não é simplificação, é o grão que o documento tem.

  ## Por que ele existe agora, e não antes

  Ficou de fora das Fases 5 e 6 de propósito — o star schema desenhava, mas nenhum
  consumidor pedia, e modelo sem consumidor é código morto que ainda assim quebra quando a
  origem muda. O consumidor apareceu na Fase 9: o dashboard soma **NF-e mais NFS-e** no
  faturamento, então um endpoint lendo só `fato_vendas` responderia metade da tela.

  ## O que este modelo NÃO decide

  Que NFS-e cancelada não é faturamento já estava decidido em dois lugares antes daqui: a
  curadoria manual de notas (item 4.9) e o endpoint da API, que já filtra por padrão. Aqui a
  regra só é aplicada — `cancelada` vem tratada da `stg_servicos`.

  ## Dimensões: as três que se aplicam

  - **cliente** — ligado pelo documento do tomador. É a mesma `dim_cliente` do
    `fato_vendas`, e é o que torna possível perguntar "quanto este cliente comprou de
    produto E de serviço" numa consulta só. Foi para isso que a dimensão nasceu unindo as
    três fontes (5.2): 119 tomadores de NFS-e não existem em `tiny.clientes`.
  - **geografia** — vem da CIDADE DO CLIENTE, não da cidade do tomador gravada na nota.
    A nota traz a sua própria, mas usar a do cliente é o que faz "faturamento por região"
    somar igual nos dois fatos. Duas geografias para o mesmo cliente fariam o total por
    região divergir do total geral sem ninguém achar o motivo.
  - **tempo** — pela data de emissão, igual ao `fato_vendas`.

  Produto e vendedor NÃO se aplicam: a NFS-e não tem produto, e não tem campo de vendedor
  (⚠️ registrado na matriz de barramento — só existiria por ligação com a venda que
  originou o serviço, o que hoje não é rastreável).

  ## Linha de negócio (2026-11-19)

  `linha` ∈ calibracao · plataforma · locacao · servico_tecnico · outro — atributo
  degenerado, como a `linha` do `fato_vendas` (os dois fatos a pediram ao mesmo tempo,
  para a margem por linha). O `codigo_atividade` NÃO separa a linha: o 501 tem calibração,
  plataforma e locação; o 3312102 já teve produção de bocais. Quem separa é a
  discriminação. A regra, em ordem (a primeira que casar):

  1. o seed `linha_servico_excecao`, por número + data da nota;
  2. o COMEÇO da discriminação: calibração/manutenção → `calibracao`; anuidade,
     plataforma, desenvolvimento → `plataforma`; locação → `locacao`; serviço técnico →
     `servico_tecnico`;
  3. a palavra em qualquer ponto da discriminação, na mesma ordem (há notas que começam
     pelo solicitante ou pela cidade);
  4. o código, como apoio: 3311200/3312102 → calibracao; 62xxxxx e 119904 → plataforma;
     6421200 → locacao; 7119799 → servico_tecnico;
  5. senão, `outro`. Nota de 2025 em diante em `outro` sem linha no seed para o build.

  `linha_origem` diz qual passo decidiu.
#}

{{ config(materialized = 'table') }}

with servicos as (

    select * from {{ ref('stg_servicos') }}
    -- A régua: nota cancelada não é faturamento. Ver o cabeçalho.
    where not coalesce(cancelada, false)

),

cliente as (

    select chave_cliente, sk_cliente, cidade, uf from {{ ref('dim_cliente') }}

),

geografia as (

    select sk_geografia, cidade, uf from {{ ref('dim_geografia') }}

)

select
    -- ------------------------------------------------------------------ chaves
    s.id                                                          as sk_servico,

    s.data_emissao                                                as data_servico,

    -- `left join` e nunca `inner`: linha sem dimensão SOME do fato e o total encolhe sem
    -- ninguém ver. Tomador sem documento cai no membro próprio, do mesmo jeito que o
    -- `fato_contas_receber` trata o sacado sem documento.
    coalesce(cl.sk_cliente, md5('sem-documento:desconhecido'))    as sk_cliente,
    coalesce(g.sk_geografia, md5('nao informada' || '|' || '--')) as sk_geografia,

    -- ------------------------------------------- dimensões degeneradas (ficam no fato)
    s.numero_nfse,
    s.codigo_atividade,
    s.data_competencia,
    s.iss_retido,
    s.documento_tomador is null                                   as tomador_sem_documento,
    l.linha,
    l.linha_origem,

    -- ------------------------------------------------------------------ métricas
    -- `valor_servicos` é o faturamento. As outras vêm ao lado, cada uma na sua coluna, em
    -- vez de um "valor" polivalente que muda de significado conforme o filtro.
    s.valor_servicos,
    s.valor_iss,
    s.valor_deducoes,
    s.valor_total_recebido

from servicos s
cross join lateral (
    select
        coalesce(x.linha, r.linha, 'outro')                                      as linha,
        case when x.linha is not null then 'excecao' else coalesce(r.origem, 'nenhuma') end
                                                                                 as linha_origem
    from (select 1) um
    left join {{ ref('linha_servico_excecao') }} x
           on x.numero_nfse = s.numero_nfse::text and x.data_servico = s.data_emissao
    left join lateral (
        select
            case
                when d ~ '^(servicos de )?(calibracao|manutencao)'          then 'calibracao'
                when d ~ '^(anuidade|plataforma|desenvolvimento)'           then 'plataforma'
                when d ~ '^locacao'                                         then 'locacao'
                when d ~ '^serv[a-z]*s? tecnico'                            then 'servico_tecnico'
                when d ~ 'calibracao|manutencao'                            then 'calibracao'
                when d ~ 'plataforma|platadorma'                            then 'plataforma'
                when d ~ 'locacao'                                          then 'locacao'
                when d ~ 'serv[a-z]*s? tecnico'                             then 'servico_tecnico'
            end                                                             as linha_d,
            case
                when s.codigo_atividade::text in ('3311200', '3312102')     then 'calibracao'
                when s.codigo_atividade::text like '62%'
                  or s.codigo_atividade::text = '119904'                    then 'plataforma'
                when s.codigo_atividade::text = '6421200'                   then 'locacao'
                when s.codigo_atividade::text = '7119799'                   then 'servico_tecnico'
            end                                                             as linha_c
        from (select coalesce(s.discriminacao, '') as d) dd
    ) rr on true
    cross join lateral (
        select coalesce(rr.linha_d, rr.linha_c) as linha,
               case when rr.linha_d is not null then 'discriminacao'
                    when rr.linha_c is not null then 'codigo' end as origem
    ) r
) l
left join cliente   cl on cl.chave_cliente = s.documento_tomador
left join geografia g  on g.cidade = cl.cidade and g.uf = cl.uf
