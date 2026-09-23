-- 010 — `operacao.jobs`: o catálogo das importações, e a origem de cada execução.
--
-- POR QUÊ
-- A tela de Importações precisa responder três perguntas que o banco hoje não sabe:
-- *que horas essa carga roda*, *ela está ativa* e *quanto ela costuma demorar*. As duas
-- primeiras só existiam dentro do `OnCalendar` dos timers do systemd, na VPS — quem não
-- tem SSH não alcança. A terceira o banco até sabia, mas respondia errado (ver abaixo).
--
-- O catálogo é declarado aqui porque a regra do projeto é que a definição mora num lugar
-- só. A view `operacao.avisos_cargas` tinha a sua própria lista fixa de jobs, escrita
-- dentro de um `VALUES` — a quarta cópia da mesma informação. Agora ela lê desta tabela.
--
-- ⚠️ ESTE CATÁLOGO PODE DIVERGIR DA VPS. Ele descreve o que os timers fazem, mas não é
-- lido por eles: quem muda um `OnCalendar` tem que mudar aqui também. Não há como o banco
-- descobrir isso sozinho — o job roda dentro de um container e não enxerga o systemd do
-- host. O `scripts/conferir_agendamentos.sh` existe para acusar a divergência.
--
-- POR QUE `origem`, E POR QUE ISSO MUDA UM NÚMERO
-- O tempo médio de `extrair_contas` calculado sobre a tabela crua dá **36 minutos**, com
-- um máximo de **7h27**. Nenhum dos dois descreve a carga diária, que leva de 33 a 36
-- minutos de forma estável: a conta estava somando os backfills históricos de 2015-2019 e
-- os `--dry-run --limite 1` de teste, que duram segundos. Média que mistura as três coisas
-- não descreve nenhuma delas, e pior: parece certa.
--
-- A origem é decidida por quem DISPARA, não pelo job: `rodar-job.sh` e `rodar-dbt.sh`
-- exportam `DATACORE_ORIGEM_JOB=agendada` quando o systemd os chamou (detectado pelo
-- `INVOCATION_ID`, que só existe sob systemd). Sem a variável, vale `manual` — o padrão
-- seguro, porque execução manual é a que não deve entrar na estatística.
--
-- O backfill das linhas antigas usa `argumentos IS NULL` como critério: o timer nunca
-- passa argumento, e toda execução manual registrada até hoje passou algum. Vale para o
-- passado; daqui pra frente quem responde é a coluna.
--
-- Com UMA exceção, descoberta ao medir: `dbt_build` grava `argumentos = 'dbt build'`
-- SEMPRE, inclusive no job diário, porque quem registra é o wrapper que recebe o
-- subcomando do dbt. Sem tratar isso, as 9 execuções do dbt virariam todas 'manual' e o
-- cartão dele apareceria na tela sem duração nenhuma — o defeito exato que esta coluna
-- existe para evitar, só que do outro lado.
--
-- REVERSÃO
--   BEGIN;
--   CREATE OR REPLACE VIEW operacao.avisos_cargas AS <a definição da migration 009>;
--   DROP VIEW operacao.resumo_importacoes;
--   DROP TABLE operacao.jobs;
--   ALTER TABLE operacao.execucoes_job DROP COLUMN origem;
--   COMMIT;

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. De onde veio cada execução
-- ---------------------------------------------------------------------------

ALTER TABLE operacao.execucoes_job
    ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual';

ALTER TABLE operacao.execucoes_job
    DROP CONSTRAINT IF EXISTS execucoes_job_origem_check;

ALTER TABLE operacao.execucoes_job
    ADD CONSTRAINT execucoes_job_origem_check
    CHECK (origem IN ('agendada', 'manual'));

-- O passado: sem argumentos = veio do timer. O `dbt build` puro é a exceção explicada
-- no cabeçalho — é o comando do job diário, não um argumento que alguém escolheu.
UPDATE operacao.execucoes_job
   SET origem = 'agendada'
 WHERE argumentos IS NULL
    OR btrim(argumentos) = ''
    OR (job = 'dbt_build' AND btrim(argumentos) = 'dbt build');

COMMENT ON COLUMN operacao.execucoes_job.origem IS
    'agendada = disparada pelo systemd; manual = alguém rodou à mão (backfill, teste, '
    'reprocessamento). Só as agendadas entram na estatística de duração.';

-- ---------------------------------------------------------------------------
-- 2. O catálogo
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS operacao.jobs (
    job               text PRIMARY KEY,
    rotulo            text NOT NULL,
    descricao         text NOT NULL,
    fonte             text NOT NULL,
    -- Horários em UTC, como no `OnCalendar`. A VPS roda em UTC; quem exibe converte.
    -- É array porque `extrair_notas` roda duas vezes por dia, e uma coluna `horario`
    -- só teria cabido metade da verdade.
    horarios          time[] NOT NULL,
    unidade_systemd   text NOT NULL,
    horas_ate_atraso  integer NOT NULL,
    ativo             boolean NOT NULL DEFAULT true,
    ordem             integer NOT NULL
);

COMMENT ON TABLE operacao.jobs IS
    'Catálogo das importações: o que cada uma faz, quando roda e se está ligada. '
    'Descreve os timers da VPS, mas não é lido por eles — ver conferir_agendamentos.sh.';

INSERT INTO operacao.jobs
    (job, rotulo, descricao, fonte, horarios, unidade_systemd, horas_ate_atraso, ordem)
VALUES
    ('extrair_notas', 'Notas fiscais',
     'Baixa do Tiny ERP as notas de venda emitidas, com os itens e os marcadores de cada uma. '
     'É a carga que sustenta o faturamento.',
     'Tiny ERP', ARRAY['04:00', '15:00']::time[], 'tiny-extrator-notas.timer', 15, 1),

    ('importar_nfse', 'Notas de serviço',
     'Busca no ADN — o ambiente nacional da NFS-e — as notas de serviço emitidas nos últimos '
     '30 dias, e reconfere as que já estavam gravadas.',
     'ADN (NFS-e nacional)', ARRAY['04:30']::time[], 'tiny-extrator-nfse.timer', 26, 2),

    ('dbt_build', 'Dados analíticos',
     'Reconstrói as camadas silver e gold com o dbt. É o resultado dela que os painéis leem — '
     'sem esta carga, as telas mostram os números de ontem.',
     'Interno (dbt)', ARRAY['05:00']::time[], 'datacore-dbt.timer', 26, 3),

    ('extrair_contas', 'Contas a pagar e receber',
     'Baixa do Tiny ERP o contas a pagar e a receber, e marca as que foram excluídas na origem.',
     'Tiny ERP', ARRAY['10:00']::time[], 'tiny-extrator-contas.timer', 30, 4),

    ('extrair_estoque', 'Estoque',
     'Atualiza saldo e custo dos produtos a partir do Tiny ERP.',
     'Tiny ERP', ARRAY['16:00']::time[], 'tiny-extrator-estoque.timer', 30, 5)
ON CONFLICT (job) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. A view de avisos passa a ler o catálogo
--    Mesmas colunas de antes — `GET /operacao/avisos` não muda de contrato.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW operacao.avisos_cargas AS
WITH ultima AS (
    SELECT DISTINCT ON (job) job, id, inicio, fim, resultado, erros, contagens
    FROM operacao.execucoes_job
    ORDER BY job, inicio DESC
)
SELECT
    e.job,
    e.rotulo,
    u.id                                   AS execucao_id,
    u.inicio,
    u.fim,
    u.resultado,
    u.erros,
    u.contagens,
    ROUND(EXTRACT(EPOCH FROM (now() - u.inicio)) / 3600.0, 1) AS horas_desde_inicio,
    CASE
        WHEN u.job IS NULL                                            THEN 'sem_registro'
        WHEN u.resultado = 'falha'                                    THEN 'falha'
        WHEN u.resultado IS NULL AND now() - u.inicio <= interval '3 hours' THEN 'rodando'
        WHEN u.resultado IS NULL                                      THEN 'inacabada'
        WHEN now() - u.inicio > e.horas_ate_atraso * interval '1 hour' THEN 'atrasada'
        ELSE 'ok'
    END AS estado,
    CASE
        WHEN u.job IS NULL THEN
            'A carga de ' || e.rotulo || ' nunca registrou execução.'
        WHEN u.resultado = 'falha' THEN
            'A carga de ' || e.rotulo || ' falhou com ' || u.erros || ' erro(s).'
        WHEN u.resultado IS NULL AND now() - u.inicio <= interval '3 hours' THEN
            'A carga de ' || e.rotulo || ' está rodando agora.'
        WHEN u.resultado IS NULL THEN
            'A carga de ' || e.rotulo || ' começou e não terminou — provavelmente foi '
            || 'interrompida. Rodar de novo costuma resolver.'
        WHEN now() - u.inicio > e.horas_ate_atraso * interval '1 hour' THEN
            'A carga de ' || e.rotulo || ' não roda há '
            || ROUND(EXTRACT(EPOCH FROM (now() - u.inicio)) / 3600.0) || ' horas.'
        ELSE
            'A carga de ' || e.rotulo || ' rodou normalmente.'
    END AS mensagem
FROM operacao.jobs e
LEFT JOIN ultima u ON u.job = e.job
WHERE e.ativo;

-- ---------------------------------------------------------------------------
-- 4. `operacao.resumo_importacoes` — uma linha por importação, pronta para o cartão
--
--    A estatística olha só execuções `agendada`, concluídas e bem-sucedidas dos
--    últimos 30 dias. `execucoes_na_media` vai junto de propósito: número calculado
--    sobre 3 execuções não merece a mesma confiança que um calculado sobre 30, e quem
--    lê a tela tem o direito de saber a diferença.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW operacao.resumo_importacoes AS
SELECT
    j.job,
    j.rotulo,
    j.descricao,
    j.fonte,
    j.horarios,
    j.unidade_systemd,
    j.ativo,
    j.ordem,
    a.estado,
    a.mensagem,
    a.execucao_id                AS ultima_execucao_id,
    a.inicio                     AS ultimo_inicio,
    a.fim                        AS ultimo_fim,
    a.resultado                  AS ultimo_resultado,
    a.erros                      AS ultimos_erros,
    a.contagens                  AS ultimas_contagens,
    ROUND(EXTRACT(EPOCH FROM (a.fim - a.inicio))::numeric, 1) AS ultima_duracao_seg,
    prox.proxima_execucao,
    est.execucoes_na_media,
    est.duracao_mediana_seg,
    est.duracao_min_seg,
    est.duracao_max_seg,
    hist.execucoes_30d,
    hist.falhas_30d
FROM operacao.jobs j
LEFT JOIN operacao.avisos_cargas a ON a.job = j.job
LEFT JOIN LATERAL (
    SELECT MIN(quando) AS proxima_execucao
    FROM (
        SELECT ((d + h) AT TIME ZONE 'UTC') AS quando
        FROM unnest(j.horarios) AS h,
             (VALUES ((now() AT TIME ZONE 'UTC')::date),
                     ((now() AT TIME ZONE 'UTC')::date + 1)) AS dias(d)
    ) candidatos
    WHERE quando > now()
) prox ON j.ativo
LEFT JOIN LATERAL (
    SELECT
        COUNT(*)                                                        AS execucoes_na_media,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (fim - inicio)))::numeric, 1)    AS duracao_mediana_seg,
        ROUND(MIN(EXTRACT(EPOCH FROM (fim - inicio)))::numeric, 1)       AS duracao_min_seg,
        ROUND(MAX(EXTRACT(EPOCH FROM (fim - inicio)))::numeric, 1)       AS duracao_max_seg
    FROM operacao.execucoes_job x
    WHERE x.job = j.job
      AND x.origem = 'agendada'
      AND x.resultado = 'sucesso'
      AND x.fim IS NOT NULL
      AND x.inicio > now() - interval '30 days'
) est ON true
LEFT JOIN LATERAL (
    SELECT
        COUNT(*)                                                     AS execucoes_30d,
        COUNT(*) FILTER (WHERE resultado = 'falha' OR erros > 0)     AS falhas_30d
    FROM operacao.execucoes_job y
    WHERE y.job = j.job
      AND y.inicio > now() - interval '30 days'
) hist ON true;

COMMENT ON VIEW operacao.resumo_importacoes IS
    'Uma linha por importação: o que é, quando roda, como foi a última vez e quanto '
    'costuma demorar. A duração ignora execução manual — ver comentário da migration 010.';

COMMIT;
