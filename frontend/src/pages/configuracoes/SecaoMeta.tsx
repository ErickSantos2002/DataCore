import { useState } from "react";

import { Button } from "../../design-system/ui/core/Button";
import { Card } from "../../design-system/ui/core/Card";
import { Input } from "../../design-system/ui/forms/Input";
import { degrausDaMeta, parseValor } from "../dashboard/metaTrimestral";
import { useSalvarConfiguracao } from "./useSalvarConfiguracao";

function emReais(valor: number): string {
  return `R$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "12666666.72" → "12.666.666,72": o campo mostra a meta como se lê. */
function comoSeDigita(valor: string | undefined): string {
  return parseValor(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export interface SecaoProps {
  valor: string | undefined;
  aoSalvar: () => void;
}

/** A META é ANUAL; o painel mede o trimestre. A prévia faz a divisão por 4 à
 *  vista, para ninguém gravar a meta do trimestre achando que é a do ano. */
export function SecaoMeta({ valor, aoSalvar }: SecaoProps) {
  const [rascunho, setRascunho] = useState(() => comoSeDigita(valor));
  const { salvar, salvando, erro } = useSalvarConfiguracao("META", aoSalvar);

  const degraus = degrausDaMeta(rascunho.replace("R$", ""));
  const mudou = parseValor(rascunho.replace("R$", "")) !== parseValor(valor);

  return (
    <Card padding="lg">
      <h2 className="text-lg font-semibold text-conteudo-heading">
        Meta anual
      </h2>
      <p className="mt-1 text-sm text-conteudo-muted">
        A meta do ANO. O painel divide por 4 e mede o trimestre contra três
        degraus de bonificação.
      </p>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Input
            label="Meta anual (R$)"
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            inputMode="decimal"
            spellCheck={false}
            className="font-mono"
            error={erro ?? undefined}
          />
          <div>
            <Button
              variant="primary"
              size="sm"
              disabled={!mudou || salvando}
              onClick={() => salvar(rascunho)}
            >
              Salvar meta
            </Button>
          </div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-conteudo-muted">Meta do trimestre (÷4)</dt>
          <dd className="font-mono text-conteudo">
            {emReais(degraus.trimestre)}
          </dd>
          <dt className="text-conteudo-muted">55% de PL (90%)</dt>
          <dd className="font-mono text-conteudo">
            {emReais(degraus.degrau55)}
          </dd>
          <dt className="text-conteudo-muted">85% de PL (120%)</dt>
          <dd className="font-mono text-conteudo">
            {emReais(degraus.degrau85)}
          </dd>
          <dt className="text-conteudo-muted">100% de PL (140%)</dt>
          <dd className="font-mono text-conteudo">
            {emReais(degraus.degrau100)}
          </dd>
        </dl>
      </div>
    </Card>
  );
}
