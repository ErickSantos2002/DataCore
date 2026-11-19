{#
  O `fato_contas_pagar` tem que ter a mesma contagem e o mesmo valor da silver.

  Mesma lógica dos testes irmãos: o fato não aplica regra de filtro, só junta plano de
  contas e exceções. Diferença = linha multiplicada — quase sempre duas exceções do seed
  `excecoes_contas_pagar` casando a mesma conta — ou perdida num join.
#}

{{ config(severity = 'error') }}

with silver as (
    select count(*) as linhas, sum(valor) as total, sum(saldo) as saldo
    from {{ ref('stg_contas_pagar') }}
),
fato as (
    select count(*) as linhas, count(distinct sk_conta) as contas, sum(valor) as total, sum(saldo) as saldo
    from {{ ref('fato_contas_pagar') }}
)
select s.linhas as linhas_silver, f.linhas as linhas_fato, f.contas as contas_fato,
       s.total as total_silver, f.total as total_fato
from silver s, fato f
where s.linhas <> f.linhas
   or f.contas <> f.linhas
   or s.total is distinct from f.total
   or s.saldo is distinct from f.saldo
