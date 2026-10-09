-- Anexos (imagens e PDF) dos eventos da cobrança. O arquivo mora no volume da API
-- (ARQUIVOS_DIR, /app/arquivos em produção); aqui ficam só os metadados.
-- Roda ANTES do deploy do backend novo: o detalhe da empresa já lê esta tabela.
-- Uso (Konsole, superusuário): bash backend/scripts/migrar_tiny.sh 014_cobranca_anexos.sql

CREATE TABLE IF NOT EXISTS tiny.cobranca_anexos (
    id            bigserial PRIMARY KEY,
    evento_id     bigint      NOT NULL REFERENCES tiny.cobranca_eventos(id),
    caminho       text        NOT NULL,
    nome_original text        NOT NULL,
    tipo          text        NOT NULL,
    tamanho       int         NOT NULL,
    enviado_por   text        NOT NULL,
    enviado_em    timestamptz NOT NULL DEFAULT now(),
    apagado_por   text,
    apagado_em    timestamptz
);
CREATE INDEX IF NOT EXISTS cobranca_anexos_evento
    ON tiny.cobranca_anexos (evento_id);

COMMENT ON TABLE tiny.cobranca_anexos IS
    'Anexos dos eventos da cobrança. Apagar marca apagado_em/apagado_por e remove o arquivo do disco; a linha fica.';
COMMENT ON COLUMN tiny.cobranca_anexos.caminho IS
    'Relativo ao ARQUIVOS_DIR da API: cobranca/AAAA/MM/<uuid>.<ext>. Nunca deriva do nome enviado.';
COMMENT ON COLUMN tiny.cobranca_anexos.tipo IS
    'MIME tirado da assinatura do conteúdo, não da extensão nem do content-type do pedido.';

-- Mesmo esquema da 013: quem escreve em tiny.configuracoes escreve aqui; quem só lê lá
-- só lê aqui. Sem DELETE (apagar é marcar) e UPDATE só nas colunas de apagar: o app
-- nunca reescreve o caminho, então uma injeção não o aponta para fora da pasta.
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT rolname FROM pg_roles
         WHERE NOT rolsuper AND rolname NOT LIKE 'pg\_%'
    LOOP
        IF has_table_privilege(r.rolname, 'tiny.configuracoes', 'UPDATE') THEN
            -- REVOKE antes: rodar de novo por cima de um UPDATE na tabela inteira o desfaz
            EXECUTE format('REVOKE UPDATE ON tiny.cobranca_anexos FROM %I', r.rolname);
            EXECUTE format('GRANT SELECT, INSERT ON tiny.cobranca_anexos TO %I', r.rolname);
            EXECUTE format('GRANT UPDATE (apagado_em, apagado_por) ON tiny.cobranca_anexos TO %I', r.rolname);
            EXECUTE format('GRANT USAGE ON SEQUENCE tiny.cobranca_anexos_id_seq TO %I', r.rolname);
        ELSIF has_table_privilege(r.rolname, 'tiny.configuracoes', 'SELECT') THEN
            EXECUTE format('GRANT SELECT ON tiny.cobranca_anexos TO %I', r.rolname);
        END IF;
    END LOOP;
END $$;
