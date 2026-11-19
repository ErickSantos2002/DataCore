{#
  O `grupo` de cada linha do seed `categoria_dre` é o número que abre o código.

  O grupo é o que liga o seed ao Balancete da tela (`3.9.2` → grupo `3`). Digitado
  errado no seed, a conta continua somando certo no fato (lá o grupo sai do código), mas
  quem lê o seed para entender o DRE lê o grupo errado — e a próxima pessoa a mexer no
  seed copia o erro. Custa uma linha conferir.
#}

{{ config(severity = 'error') }}

select categoria_codigo, grupo
from {{ ref('categoria_dre') }}
where grupo is distinct from
      case when categoria_codigo = 'sem' then 'sem' else split_part(categoria_codigo, '.', 1) end
