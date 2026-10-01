-- Aposenta MESES_ANALISE, substituída por TRIMESTRE_APURACAO (migração 002).
-- Roda DEPOIS de duas coisas:
--   1. o deploy do front novo — o front antigo lê esta chave e ficaria sem trimestre;
--   2. a skill `faturamento` do HS.OS parar de ler esta chave — o SQL de "quanto
--      falta para a meta" de lá faz cross join com os meses dela e, sem a linha,
--      responde realizado = 0 sem erro nenhum.
-- Uso (Konsole, superusuário): bash scripts/migrar_tiny.sh 003_aposentar_meses_analise.sql

DELETE FROM tiny.configuracoes WHERE chave = 'MESES_ANALISE';
