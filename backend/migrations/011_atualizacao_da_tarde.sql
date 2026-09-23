-- 011 — o número do dia passa a aparecer antes das 15h.
--
-- POR QUÊ
-- O pessoal da empresa abre o sistema por volta das 15h para ver se a meta subiu, e até
-- aqui estava vendo o faturamento da MADRUGADA. A ordem dos horários explica: a carga de
-- notas das 15:00 UTC (12:00 no Brasil) enchia o bronze, mas nada reconstruía o gold
-- depois dela — e é o gold que as telas leem. O último `dbt build` era o das 05:00 UTC
-- (02:00 no Brasil), então uma nota emitida às 10h da manhã só aparecia na tela às 2h da
-- madrugada seguinte. A carga do meio-dia não mudava nada do que alguém via.
--
-- O que passa a acontecer, em horário de Brasília:
--   14:30  carga de notas fiscais   (~3,5 min)
--   14:35  importação de NFS-e      (~20 s) — o faturamento da tela é NF-e **mais** NFS-e
--   14:45  dbt build                (~15 s) — reconstrói silver e gold
--   14:46  o número do dia está na tela, com folga até as 15h
--
-- ⚠️ ISSO NÃO É O FECHAMENTO DO DIA. Medido em 19/09 sobre 90 dias de notas com hora
-- preenchida: 49% saem de manhã e 51% à tarde. A atualização das 14:30 mostra o dia até
-- ali; o que for emitido depois continua entrando na carga da madrugada. Quem comparar o
-- número das 15h com o do dia seguinte vai ver o de hoje subir — e isso é o certo, não um
-- erro de carga.
--
-- Esta migration só reescreve o CATÁLOGO. Quem dispara são os timers da VPS, que mudam
-- junto (`deploy/systemd/*.timer`); `conferir_agendamentos.sh` é o que acusa se um dos
-- dois lados ficar para trás.
--
-- REVERSÃO
--   BEGIN;
--   UPDATE operacao.jobs SET horarios = ARRAY['04:00','15:00']::time[] WHERE job = 'extrair_notas';
--   UPDATE operacao.jobs SET horarios = ARRAY['04:30']::time[]          WHERE job = 'importar_nfse';
--   UPDATE operacao.jobs SET horarios = ARRAY['05:00']::time[]          WHERE job = 'dbt_build';
--   COMMIT;
--   (e reverter os três arquivos .timer, senão o catálogo passa a mentir)

BEGIN;

UPDATE operacao.jobs
   SET horarios = ARRAY['04:00', '15:00', '17:30']::time[],
       descricao = 'Baixa do Tiny ERP as notas de venda emitidas, com os itens e os '
                   'marcadores de cada uma. É a carga que sustenta o faturamento. A das '
                   '14:30 existe para o número do dia estar na tela antes das 15h.'
 WHERE job = 'extrair_notas';

UPDATE operacao.jobs
   SET horarios = ARRAY['04:30', '17:35']::time[]
 WHERE job = 'importar_nfse';

UPDATE operacao.jobs
   SET horarios = ARRAY['05:00', '17:45']::time[],
       descricao = 'Reconstrói as camadas silver e gold com o dbt. É o resultado dela que '
                   'os painéis leem — sem esta carga, as telas mostram os números de '
                   'antes. Roda na madrugada e de novo às 14:45.'
 WHERE job = 'dbt_build';

-- A folga até virar "atrasada" continua medida sobre o intervalo MAIOR entre execuções,
-- não sobre o menor: entre a carga da tarde e a da madrugada seguinte passam ~10h30 para
-- as notas e ~11h15 para o dbt. Encurtar a folga junto com o horário faria a tela acusar
-- atraso toda madrugada — alarme que dispara sozinho é alarme que se desliga.

COMMIT;
