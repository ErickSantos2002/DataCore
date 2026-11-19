{#
  Componente de `custos_diretos` da aba Centro de Custo sem linha no seed
  `componente_custo_direto`, num produto que o CMV usa. Sem classificação ele ficaria fora
  do CMV calado — ou, se alguém "consertasse" somando tudo, entraria em dobro com a
  despesa. Resolver = classificar no seed.
#}

{{ config(severity = 'error') }}

select c.produto, c.ano, c.descricao_original, c.componente
from {{ ref('stg_centro_custo_componentes') }} c
where c.entra_no_cmv is null
  and c.produto in (select chave_centro_custo from {{ ref('produto_centro_custo') }})
