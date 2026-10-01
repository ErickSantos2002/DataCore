import { useEffect, useState } from "react";

import { Card } from "../../design-system/ui/core/Card";
import {
  fetchHistoricoConfiguracoes,
  type HistoricoConfiguracao,
} from "../../services/notasapi";

function quando(instante: string): string {
  return new Date(instante).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** As últimas 20 alterações. `versao` muda a cada gravação da página — é o
 *  sinal para buscar de novo. */
export function SecaoHistorico({ versao }: { versao: number }) {
  const [linhas, setLinhas] = useState<HistoricoConfiguracao[] | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetchHistoricoConfiguracoes(20)
      .then((h) => vivo && (setLinhas(h), setFalhou(false)))
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
    };
  }, [versao]);

  return (
    <Card padding="lg">
      <h2 className="text-lg font-semibold text-conteudo-heading">Histórico</h2>
      {falhou ? (
        <p className="mt-2 text-sm text-conteudo-muted">
          Não foi possível carregar o histórico.
        </p>
      ) : linhas === null ? (
        <p className="mt-2 text-sm text-conteudo-muted">Carregando…</p>
      ) : linhas.length === 0 ? (
        <p className="mt-2 text-sm text-conteudo-muted">
          Nenhuma alteração registrada ainda.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-conteudo-faint">
              <tr>
                <th className="py-2 pr-4">Quando</th>
                <th className="py-2 pr-4">Quem</th>
                <th className="py-2 pr-4">Chave</th>
                <th className="py-2">Alteração</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((h) => (
                <tr key={h.id} className="border-t border-borda">
                  <td className="whitespace-nowrap py-2 pr-4 text-conteudo-muted">
                    {quando(h.alterado_em)}
                  </td>
                  <td className="py-2 pr-4 text-conteudo">{h.alterado_por}</td>
                  <td className="py-2 pr-4 font-mono text-conteudo">
                    {h.chave}
                  </td>
                  <td className="break-all py-2 font-mono text-conteudo">
                    {`${h.valor_anterior ?? "(criada)"} → ${h.valor_novo}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
