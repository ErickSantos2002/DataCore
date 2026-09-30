{#
  NFS-e marcada como cancelada na bronze e ausente do CSV.

  Vale mais que a de `tipo`: são notas que NÃO podem contar como
  faturamento. Perder essa marca numa recarga não quebra nada visivelmente — só infla o
  número, que é a forma de errar que este projeto mais viu.

  `severity: warn`, mesmo motivo do teste irmão: é lembrete de exportar, não defeito.
#}

{{ config(severity = 'warn') }}

with bronze as (

    select id from {{ source('tiny', 'servicos') }}
    where cancelada
      -- Nota do ADN (chave de 50 dígitos) tira o cancelamento do Evento, que o job
      -- reaplica a cada passagem (D11, desde 2026-09-30): não depende da seed.
      and length(coalesce("código_de_verificação_nf", '')) <> 50

),

seed as (

    select id from {{ ref('nfse_cancelada_curada') }}

)

select b.id
from bronze b
left join seed s on s.id = b.id
where s.id is null
