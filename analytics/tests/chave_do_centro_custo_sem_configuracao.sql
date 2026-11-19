{#
  Toda chave do seed `produto_centro_custo` tem ao menos um ano configurado (custo > 0) na
  aba. Chave digitada errada, ou aba apagada, faria o carro-chefe cair no custo do cadastro
  — que traz frete e embalagem dentro, em dobro com a despesa — sem erro nenhum.
#}

{{ config(severity = 'error') }}

select m.id_produto, m.chave_centro_custo
from {{ ref('produto_centro_custo') }} m
where nullif(btrim(m.chave_centro_custo), '') is not null
  and not exists (
      select 1 from {{ ref('stg_centro_custo') }} c
      where c.produto = m.chave_centro_custo and c.configurado
  )
