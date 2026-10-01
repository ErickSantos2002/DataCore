-- Histórico de alterações das configurações + chave do trimestre automático.
-- Roda ANTES do deploy do backend novo (ele grava histórico em todo PUT).
-- Uso (Konsole, superusuário): bash scripts/migrar_tiny.sh 002_configuracoes_historico.sql

CREATE TABLE IF NOT EXISTS tiny.configuracoes_historico (
    id             bigserial PRIMARY KEY,
    chave          text        NOT NULL,
    valor_anterior text,
    valor_novo     text        NOT NULL,
    alterado_por   text        NOT NULL,
    alterado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS configuracoes_historico_alterado_em
    ON tiny.configuracoes_historico (alterado_em DESC);

COMMENT ON TABLE tiny.configuracoes_historico IS
    'Quem mudou qual configuração, quando, e de qual valor para qual.';
COMMENT ON COLUMN tiny.configuracoes_historico.valor_anterior IS
    'NULL quando a chave foi criada.';
COMMENT ON COLUMN tiny.configuracoes_historico.alterado_por IS
    'username de auth.usuarios (o e-mail é opcional lá).';

-- As permissões copiam as de tiny.configuracoes: quem escreve lá registra
-- histórico aqui; quem só lê lá, só lê aqui. O script não precisa saber o nome
-- de usuário nenhum (o repo é público).
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT rolname FROM pg_roles
         WHERE NOT rolsuper AND rolname NOT LIKE 'pg\_%'
    LOOP
        IF has_table_privilege(r.rolname, 'tiny.configuracoes', 'UPDATE') THEN
            EXECUTE format('GRANT SELECT, INSERT ON tiny.configuracoes_historico TO %I', r.rolname);
            EXECUTE format('GRANT USAGE ON SEQUENCE tiny.configuracoes_historico_id_seq TO %I', r.rolname);
        ELSIF has_table_privilege(r.rolname, 'tiny.configuracoes', 'SELECT') THEN
            EXECUTE format('GRANT SELECT ON tiny.configuracoes_historico TO %I', r.rolname);
        END IF;
    END LOOP;
END $$;

-- 'auto' = o trimestre do calendário. Não sobrescreve um valor já gravado.
INSERT INTO tiny.configuracoes (chave, valor)
SELECT 'TRIMESTRE_APURACAO', 'auto'
 WHERE NOT EXISTS (SELECT 1 FROM tiny.configuracoes WHERE chave = 'TRIMESTRE_APURACAO');
