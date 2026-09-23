import { CheckCircle2 } from "lucide-react";

import { Card, CardTitle } from "../../design-system/ui";
import { useTemaDoGrafico } from "../../design-system/chartTheme";
import { formatarDinheiro, type FaixaDeBonificacao } from "./meta";
import { corDaFaixa } from "./coresDaMeta";

export interface ListaDeFaixasProps {
  faixas: FaixaDeBonificacao[];
  proxima: FaixaDeBonificacao | null;
  faturamentoAnoPassado: number;
}

/** O contorno da linha diz em que estado ela está, sem depender só de cor. */
function tomDaLinha(
  faixa: FaixaDeBonificacao,
  proxima: FaixaDeBonificacao | null,
): string {
  if (faixa.batida) return "border-success bg-tint-success";
  if (proxima && faixa.bonus === proxima.bonus)
    return "border-info bg-tint-info";
  return "border-borda bg-surface-elevated";
}

/**
 * As dez faixas de bonificação, uma linha cada.
 *
 * Cada linha responde três perguntas diferentes e por isso tem três colunas:
 * que faixa é (disco com o percentual, multiplicador e projeção anual),
 * quanto falta (alvo e barra de progresso) e em que pé está (batida ou o que
 * falta em reais).
 */
export function ListaDeFaixas({
  faixas,
  proxima,
  faturamentoAnoPassado,
}: ListaDeFaixasProps) {
  useTemaDoGrafico();
  return (
    <Card padding="lg">
      <CardTitle>Faixas de Bonificação (PL) — Trimestre</CardTitle>
      <p className="mb-5 mt-1 text-sm text-conteudo-muted">
        Faturamento trimestral necessário para cada percentual de bônus do
        salário. Abaixo de cada multiplicador, a projeção do{" "}
        <strong>faturamento anual</strong> caso a meta seja batida em{" "}
        <strong>todos os trimestres</strong> e o crescimento vs o ano passado (
        {formatarDinheiro(faturamentoAnoPassado)}).
      </p>

      <div className="flex flex-col gap-3">
        {faixas.map((faixa) => (
          <div
            key={faixa.bonus}
            className={`rounded-xl border p-4 transition-colors ${tomDaLinha(faixa, proxima)}`}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex shrink-0 items-center gap-3 md:w-60">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-on-primary shadow"
                  style={{ backgroundColor: corDaFaixa(faixa.bonus) }}
                >
                  {faixa.bonus}%
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-conteudo-heading">
                    Bônus {faixa.bonus}%
                  </p>
                  <p className="text-xs text-conteudo-muted">
                    {faixa.multiplicador.toLocaleString("pt-BR", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 4,
                    })}
                    × META÷4
                  </p>
                  <p className="mt-1 text-xs leading-snug text-conteudo">
                    Se bater todo trim.:{" "}
                    <strong>{formatarDinheiro(faixa.anualProjetado)}</strong>
                    /ano
                  </p>
                  {faixa.crescimentoAnual !== null && (
                    <p
                      className={[
                        "text-xs font-semibold leading-snug",
                        faixa.crescimentoAnual >= 0
                          ? "text-success"
                          : "text-danger",
                      ].join(" ")}
                    >
                      ({faixa.crescimentoAnual >= 0 ? "+" : ""}
                      {faixa.crescimentoAnual.toFixed(2)}% vs ano passado)
                    </p>
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-sm text-conteudo">
                    Alvo:{" "}
                    <span className="font-semibold text-conteudo-heading">
                      {formatarDinheiro(faixa.alvo)}
                    </span>
                  </span>
                  <span className="text-sm font-bold text-conteudo">
                    {faixa.progresso.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-tint-neutral">
                  <div
                    className={`h-full rounded-full transition-all ${faixa.batida ? "bg-success" : ""}`}
                    style={{
                      width: `${faixa.progresso}%`,
                      backgroundColor: faixa.batida
                        ? undefined
                        : corDaFaixa(faixa.bonus),
                    }}
                  />
                </div>
              </div>

              <div className="shrink-0 md:w-52 md:text-right">
                {faixa.batida ? (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Meta
                    atingida
                  </span>
                ) : (
                  <p className="text-sm">
                    <span className="text-conteudo-muted">Faltam </span>
                    <span className="font-semibold text-danger">
                      {formatarDinheiro(faixa.falta)}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
