-- 012 — Botão "Atualizar dados agora" da tela Meta do trimestre.
--
-- POR QUÊ
-- O botão antigo chamava um webhook do n8n, e os fluxos do n8n saíram de cena em
-- 2026-09-04. O botão seguia dizendo "acionado" porque o `fetch` era `no-cors` e não via
-- a resposta: não atualizava nada e ninguém sabia.
--
-- A atualização de verdade é uma sequência de três cargas, e elas não moram no mesmo
-- lugar: notas e NFS-e rodam no container da API, o dbt no container `datacore-dbt`. A
-- API não alcança o outro container (e não deve ganhar acesso ao Docker da VPS por causa
-- de um botão). Então o botão só deixa um PEDIDO aqui, e quem executa é a VPS: um timer
-- de 1 minuto (`deploy/systemd/datacore-atualizacao-manual.timer`) pega o pedido e roda
-- extrair_notas → importar_nfse → dbt build com origem `manual`.
--
-- Um pedido por vez: o índice único parcial impede um segundo pedido aberto, e é isso
-- que faz dez cliques virarem uma atualização só.
--
-- REVERSÃO
--   DROP TABLE operacao.pedidos_atualizacao;

BEGIN;

CREATE TABLE IF NOT EXISTS operacao.pedidos_atualizacao (
    id           BIGSERIAL PRIMARY KEY,
    pedido_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
    pedido_por   TEXT        NOT NULL,
    iniciado_em  TIMESTAMPTZ,
    concluido_em TIMESTAMPTZ,
    resultado    TEXT CHECK (resultado IN ('sucesso', 'falha', 'abandonado')),
    detalhe      TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS pedidos_atualizacao_um_aberto
    ON operacao.pedidos_atualizacao ((true))
    WHERE concluido_em IS NULL;

COMMENT ON TABLE operacao.pedidos_atualizacao IS
    'Fila do botão "Atualizar dados agora". A API grava o pedido; o timer '
    'datacore-atualizacao-manual da VPS executa notas → NFS-e → dbt e fecha a linha.';
COMMENT ON COLUMN operacao.pedidos_atualizacao.resultado IS
    'sucesso | falha | abandonado. abandonado = ficou aberto mais de 1 hora (VPS caiu, '
    'timer desligado) e foi fechado pela API no pedido seguinte, para não travar a fila.';

-- Mesmo dono de `execucoes_job`, que é o usuário com que a API e os jobs conectam: se a
-- migration rodar como outro superusuário, a tabela nasceria dele e a API levaria
-- "permission denied" no primeiro clique.
DO $$
BEGIN
    EXECUTE format('ALTER TABLE operacao.pedidos_atualizacao OWNER TO %I',
                   (SELECT tableowner FROM pg_tables
                     WHERE schemaname = 'operacao' AND tablename = 'execucoes_job'));
END $$;

-- Mesma regra da 005: o `dbt` só lê o schema `operacao`.
GRANT SELECT ON operacao.pedidos_atualizacao TO dbt;

COMMIT;
