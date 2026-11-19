{#
  NFS-e de 2025 em diante em `outro` sem linha no seed `linha_servico_excecao`. A regra
  (discriminação, depois código) não reconheceu a nota; alguém precisa olhar e decidir —
  e se a decisão for `outro`, dizer por quê no seed.
#}

{{ config(severity = 'error') }}

select sk_servico, numero_nfse, data_servico, codigo_atividade, valor_servicos
from {{ ref('fato_servicos') }}
where linha = 'outro'
  and linha_origem <> 'excecao'
  and data_servico >= date '2025-01-01'
