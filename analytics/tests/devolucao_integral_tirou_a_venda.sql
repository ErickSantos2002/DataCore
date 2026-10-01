{#
  Âncoras da regra de devolução integral (silver.vendas, CTE
  `notas_devolvidas_integralmente`), medidas em 2026-10-01.

  As 10 vendas abaixo têm nota de devolução 1202/2202 emitida, citando a venda pelo número
  e com o mesmo valor — foram desfeitas por inteiro e NÃO podem estar no faturamento. A
  006586 teve devolução PARCIAL (1 de 3 aparelhos) e TEM que estar: a D8 não abate
  devolução parcial, e o marcador dela está em `marcadores_excecoes`.

  Devolve uma linha por âncora violada.
#}

{{ config(severity = 'error') }}

with devolvidas(numero) as (
    values ('002351'), ('004322'), ('004394'), ('004395'), ('004482'),
           ('004483'), ('004896'), ('005123'), ('005525'), ('005641')
),

vendas as (
    select distinct numero_nota::text as numero from {{ ref('vendas') }}
)

select d.numero, 'devolvida integralmente e ainda conta' as problema
from devolvidas d
join vendas v on v.numero = d.numero

union all

select '006586', 'devolucao parcial tirou a nota inteira'
where not exists (select 1 from vendas where numero = '006586')
