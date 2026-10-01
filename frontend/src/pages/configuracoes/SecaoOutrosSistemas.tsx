import { useState } from "react";

import { Alert } from "../../design-system/ui/feedback";
import { Button } from "../../design-system/ui/core/Button";
import { Card } from "../../design-system/ui/core/Card";
import { Input } from "../../design-system/ui/forms/Input";
import { CHAVES_DO_PAINEL } from "./chaves";
import { useSalvarConfiguracao } from "./useSalvarConfiguracao";

/** Quem lê cada chave que o painel não usa. Chave sem nota aparece sem nota. */
const QUEM_LE: Record<string, string> = {
  CFOP_VALIDOS:
    "Lida pelo HS.OS (relatório de compradores). O painel usa a régua do dbt.",
  MARCADORES_INVALIDOS:
    "Lida pelo HS.OS (relatório de compradores). O painel usa a régua do dbt.",
};

interface Configuracao {
  id: number;
  chave: string;
  valor: string;
}

function LinhaEditavel({
  cfg,
  aoSalvar,
}: {
  cfg: Configuracao;
  aoSalvar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(cfg.valor);
  const { salvar, salvando, erro } = useSalvarConfiguracao(cfg.chave, aoSalvar);

  return (
    <div className="flex flex-col gap-2 border-b border-borda py-4 last:border-b-0">
      {editando ? (
        <Input
          label={cfg.chave}
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          spellCheck={false}
          className="font-mono"
        />
      ) : (
        <>
          <p className="text-sm font-semibold text-conteudo-muted">
            {cfg.chave}
          </p>
          <p className="whitespace-pre-line break-words font-mono text-sm text-conteudo">
            {cfg.valor}
          </p>
        </>
      )}
      {QUEM_LE[cfg.chave] && (
        <p className="text-xs text-conteudo-faint">{QUEM_LE[cfg.chave]}</p>
      )}
      {erro && <Alert variant="danger">{erro}</Alert>}
      <div className="flex gap-2">
        {editando ? (
          <>
            <Button
              variant="success"
              size="sm"
              disabled={salvando}
              onClick={async () => {
                if (await salvar(rascunho)) setEditando(false);
              }}
            >
              Salvar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setRascunho(cfg.valor);
                setEditando(false);
              }}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            aria-label={`Editar ${cfg.chave}`}
            onClick={() => {
              setRascunho(cfg.valor);
              setEditando(true);
            }}
          >
            Editar
          </Button>
        )}
      </div>
    </div>
  );
}

/** Chaves que estão no banco mas não são do painel. Some quando não há nenhuma. */
export function SecaoOutrosSistemas({
  configuracoes,
  aoSalvar,
}: {
  configuracoes: Configuracao[];
  aoSalvar: () => void;
}) {
  const outras = configuracoes.filter((c) => !CHAVES_DO_PAINEL.has(c.chave));
  if (outras.length === 0) return null;

  return (
    <Card padding="lg">
      <h2 className="text-lg font-semibold text-conteudo-heading">
        Usadas por outros sistemas
      </h2>
      <p className="mt-1 text-sm text-conteudo-muted">
        Ficam nesta tabela, mas o painel não as lê. Mudar aqui afeta quem as
        usa.
      </p>
      <div className="mt-2">
        {outras.map((cfg) => (
          <LinhaEditavel key={cfg.id} cfg={cfg} aoSalvar={aoSalvar} />
        ))}
      </div>
    </Card>
  );
}
