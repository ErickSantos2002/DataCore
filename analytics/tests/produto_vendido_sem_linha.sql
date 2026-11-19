{#
  Produto vendido sem linha no seed `linha_produto`. Sem a linha, a receita dele cai em
  `sem_linha` na margem por linha, e "o que dá dinheiro?" responde com um buraco.
  Resolver = pôr o id no seed com a linha (aparelho, consumivel ou acessorio).
#}

{{ config(severity = 'error') }}

select distinct p.id_produto, p.nome
from {{ ref('fato_vendas') }} f
join {{ ref('dim_produto') }} p on p.sk_produto = f.sk_produto
where f.linha is null
