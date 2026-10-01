-- Aposenta MESES_ANALISE, substituída por TRIMESTRE_APURACAO (migração 002).
-- Roda DEPOIS do deploy do front novo: o front antigo lê esta chave e ficaria
-- sem trimestre. Nenhum outro sistema a lê (varrido em ~/github, 01/10/2026).
-- Uso (Konsole, superusuário): bash scripts/migrar_tiny.sh 003_aposentar_meses_analise.sql

DELETE FROM tiny.configuracoes WHERE chave = 'MESES_ANALISE';
