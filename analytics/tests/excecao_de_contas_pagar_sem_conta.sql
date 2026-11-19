{#
  Exceção do seed `excecoes_contas_pagar` que não casa conta nenhuma.

  Exceção morta é pior que nenhuma: quem lê o seed acredita que a reclassificação está
  valendo. Acontece quando o financeiro muda o nome do fornecedor no Tiny ("Itaú" →
  "Banco Itaú") ou a grafia do histórico — e aí as parcelas voltam para a tarifa bancária
  sem aviso.

  `severity: warn`: o DRE continua certo pelo plano de contas; o que falta é a exceção.
#}

{{ config(severity = 'warn') }}

select e.fornecedor, e.categoria_codigo, e.padrao_historico
from {{ ref('excecoes_contas_pagar') }} e
where not exists (
    select 1
    from {{ ref('stg_contas_pagar') }} c
    where c.fornecedor_nome_normalizado = {{ normalizar_texto('e.fornecedor') }}
      and c.categoria_codigo = e.categoria_codigo
      and coalesce(c.historico_normalizado, '') ilike e.padrao_historico
      and (nullif(btrim(e.id_tiny), '') is null or nullif(btrim(e.id_tiny), '')::bigint = c.id_tiny)
)
