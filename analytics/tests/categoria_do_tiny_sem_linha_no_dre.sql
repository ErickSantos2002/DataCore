{#
  Toda categoria que existe no contas a pagar tem linha no seed `categoria_dre`.

  É o teste que impede o DRE de mentir por omissão. O financeiro cria categoria no Tiny
  quando precisa, e ninguém avisa o dbt: sem este teste a conta nova cairia com
  `linha_dre` NULL e sumiria de todas as linhas do DRE — o resultado do mês melhoraria
  sozinho, sem erro nenhum. Também pega categoria com texto e sem número
  (`texto:<...>` no staging), que não segue o plano de contas.

  `severity: error`, de propósito: categoria nova precisa quebrar o build. O conserto é
  uma linha no seed — e a decisão de onde ela entra no DRE é de gente, não de regra.
#}

{{ config(severity = 'error') }}

select
    c.categoria_codigo,
    min(c.categoria)    as exemplo_de_texto,
    count(*)            as contas
from {{ ref('stg_contas_pagar') }} c
left join {{ ref('categoria_dre') }} p on p.categoria_codigo = c.categoria_codigo
where p.categoria_codigo is null
group by 1
