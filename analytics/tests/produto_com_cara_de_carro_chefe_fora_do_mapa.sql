{#
  Produto vendido com cara de aparelho (Phoebus, iBlow, Mark X) que o seed
  `produto_centro_custo` não conhece. A regex aqui é só DETECTOR: quem liga produto ao
  Centro de Custo é o seed, por id. Sem este teste, um Phoebus cadastrado com id novo
  cairia calado no custo do cadastro (ou em "sem custo") e o CMV do carro-chefe
  encolheria sem ninguém ver. Resolver = pôr o id no seed, com chave ou com o motivo de
  não ter.
#}

{{ config(severity = 'error') }}

select p.id_produto, p.nome
from {{ ref('dim_produto') }} p
where exists (select 1 from {{ ref('fato_vendas') }} f where f.sk_produto = p.sk_produto)
  and (p.nome ~ '(bafometro|etilometro).*(phoebus|iblow|mark ?x)'
       or p.nome ~ '^(phoebus|iblow|mark ?x)')
  and p.id_produto not in (select id_produto from {{ ref('produto_centro_custo') }})
