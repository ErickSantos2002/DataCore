-- Cobrança da inadimplência: ciclos, linha do tempo e observação fixa por empresa.
-- Roda ANTES do deploy do backend novo.
-- Uso (Konsole, superusuário): bash backend/scripts/migrar_tiny.sh 013_cobranca.sql
-- Spec: docs/superpowers/specs/2026-10-09-inadimplencia-design.md

CREATE TABLE IF NOT EXISTS tiny.cobranca_ciclos (
    id                 bigserial PRIMARY KEY,
    empresa            text        NOT NULL,
    status             text        NOT NULL,
    promessa_data      date,
    promessa_valor     numeric(14,2),
    promessa_condicoes text,
    aberto_em          timestamptz NOT NULL DEFAULT now(),
    aberto_por         text        NOT NULL,
    encerrado_em       timestamptz,
    ultimo_contato_em  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS cobranca_ciclos_um_aberto
    ON tiny.cobranca_ciclos (empresa) WHERE encerrado_em IS NULL;

CREATE TABLE IF NOT EXISTS tiny.cobranca_eventos (
    id                 bigserial PRIMARY KEY,
    ciclo_id           bigint      NOT NULL REFERENCES tiny.cobranca_ciclos(id),
    ocorrido_em        timestamptz NOT NULL,
    registrado_em      timestamptz NOT NULL DEFAULT now(),
    registrado_por     text        NOT NULL,
    tipo               text        NOT NULL,
    canal              text,
    filial_cnpj        text,
    status_anterior    text,
    status_novo        text,
    promessa_data      date,
    promessa_valor     numeric(14,2),
    promessa_condicoes text,
    anotacao           text,
    valor_inadimplente numeric(14,2)
);
CREATE INDEX IF NOT EXISTS cobranca_eventos_ciclo
    ON tiny.cobranca_eventos (ciclo_id, ocorrido_em DESC);

CREATE TABLE IF NOT EXISTS tiny.cobranca_empresas (
    empresa      text PRIMARY KEY,
    observacao   text        NOT NULL,
    alterado_por text        NOT NULL,
    alterado_em  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tiny.cobranca_ciclos IS
    'Uma cobrança de uma empresa (raiz do CNPJ), do primeiro atraso até a dívida acabar.';
COMMENT ON TABLE tiny.cobranca_eventos IS
    'Linha do tempo da cobrança. Só INSERT: nada é editado nem apagado.';
COMMENT ON TABLE tiny.cobranca_empresas IS
    'Observação fixa por empresa — vale para todos os ciclos dela.';

-- As permissões copiam as de tiny.configuracoes, como na 002: quem escreve lá escreve
-- aqui; quem só lê lá só lê aqui. Evento não tem UPDATE nem DELETE para ninguém.
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT rolname FROM pg_roles
         WHERE NOT rolsuper AND rolname NOT LIKE 'pg\_%'
    LOOP
        IF has_table_privilege(r.rolname, 'tiny.configuracoes', 'UPDATE') THEN
            EXECUTE format('GRANT SELECT, INSERT, UPDATE ON tiny.cobranca_ciclos TO %I', r.rolname);
            EXECUTE format('GRANT SELECT, INSERT ON tiny.cobranca_eventos TO %I', r.rolname);
            EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON tiny.cobranca_empresas TO %I', r.rolname);
            EXECUTE format('GRANT USAGE ON SEQUENCE tiny.cobranca_ciclos_id_seq, tiny.cobranca_eventos_id_seq TO %I', r.rolname);
        ELSIF has_table_privilege(r.rolname, 'tiny.configuracoes', 'SELECT') THEN
            EXECUTE format('GRANT SELECT ON tiny.cobranca_ciclos, tiny.cobranca_eventos, tiny.cobranca_empresas TO %I', r.rolname);
        END IF;
    END LOOP;
END $$;
