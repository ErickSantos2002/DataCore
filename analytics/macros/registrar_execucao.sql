{% macro registrar_execucao_dbt(results) %}
{#-
  Grava o resultado do `dbt build` em `operacao.execucoes_job` — a MESMA tabela que os
  extratores do Tiny usam. Assim a falha do dbt aparece em `/operacao/avisos` junto com as
  outras tres cargas, sem inventar um canal novo: quem for olhar problema olha um lugar so.

  Antes disto, o timer das 05:00 falhava CALADO. Item 8.5 do roadmap.

  ⚠️ ESTE HOOK SO RODA SE O DBT CHEGOU AO FIM. Se ele morrer antes — banco fora do ar,
  credencial errada, imagem quebrada — nada e gravado, e isso e de proposito: a view
  `operacao.avisos_cargas` acusa `atrasada` depois de 26h, que e o alarme certo para
  "nao rodou". Um hook nao consegue relatar a propria ausencia.

  So registra em `dbt build` e so no target `prod`. Duas travas, pelo mesmo motivo:
  `operacao.execucoes_job` e uma tabela SO, compartilhada por dev e prod. Um `dbt build`
  rodado na maquina de quem desenvolve gravaria "rodou agora" e o painel diria que a
  reconstrucao diaria esta em dia quando ela nao rodou. Este projeto ja foi mordido por
  isso uma vez: 11 das 20 execucoes registradas eram teste, e o monitor de volume teve
  que aprender a filtrar depois. Melhor nao sujar do que limpar.
-#}
{%- if flags.WHICH != 'build' -%}{{ return('') }}{%- endif -%}
{%- if target.name != 'prod' -%}{{ return('') }}{%- endif -%}
{%- if not execute -%}{{ return('') }}{%- endif -%}

{%- set nos_com_erro = [] -%}
{%- set erros = [] -%}
{%- set avisos = [] -%}
{%- set concluidos = [] -%}
{%- for r in results -%}
    {%- if r.status in ['error', 'fail'] -%}
        {%- do erros.append(1) -%}
        {%- do nos_com_erro.append(r.node.name) -%}
    {%- elif r.status == 'warn' -%}
        {%- do avisos.append(1) -%}
    {%- elif r.status in ['success', 'pass'] -%}
        {%- do concluidos.append(1) -%}
    {%- endif -%}
{%- endfor -%}

{#- De onde veio esta execucao: `rodar-dbt.sh` exporta a variavel quando quem o chamou
    foi o systemd. Sem ela vale `manual`, que e o valor seguro — ver migration 010. Esta
    linha e o que impede o `dbt build` diario de entrar na estatistica como execucao de
    alguem testando, e vice-versa. -#}
{%- set origem_bruta = (env_var('DATACORE_ORIGEM_JOB', 'manual') | lower | trim) -%}
{%- set origem = origem_bruta if origem_bruta in ['agendada', 'manual'] else 'manual' -%}
{%- set qtd_erros = erros | length -%}
{%- set resultado = 'falha' if qtd_erros > 0 else 'sucesso' -%}
{%- set detalhe = (nos_com_erro | join(', '))[:400] -%}

insert into operacao.execucoes_job
    (job, inicio, fim, resultado, erros, contagens, detalhe, argumentos, origem)
values (
    'dbt_build',
    '{{ run_started_at }}'::timestamptz,
    now(),
    '{{ resultado }}',
    {{ qtd_erros }},
    '{
        "nos": {{ results | length }},
        "concluidos": {{ concluidos | length }},
        "avisos": {{ avisos | length }},
        "erros": {{ qtd_erros }}
     }'::jsonb,
    {% if qtd_erros > 0 %}'{{ detalhe }}'{% else %}null{% endif %},
    'dbt build',
    '{{ origem }}'
)
{% endmacro %}
