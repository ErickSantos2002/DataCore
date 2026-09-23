import { TrendingDown, TrendingUp } from "lucide-react";

import { Card } from "../../design-system/ui";
import { useTemaDoGrafico } from "../../design-system/chartTheme";
import { formatarMoeda, formatarVariacao, type KpiDeAno } from "./financeiro";
import { corDoAno } from "./coresDoAno";

export interface KpisPorAnoProps {
  kpis: KpiDeAno[];
}

/**
 * Um cartão por ano da janela: faturamento, quantidade de notas e a variação
 * contra o ano anterior.
 *
 * Não usa o `KpiCard` do design system de propósito — o primitivo tem três
 * linhas de anatomia fixa (rótulo, valor, nota) e este cartão tem quatro: a
 * quarta é a tendência, com ícone e cor de sinal. Encaixar a tendência dentro
 * da `note` juntaria duas informações que a pessoa lê separadas.
 *
 * "Sem dados" em vez de "R$ 0,00": ano que ainda não começou não faturou zero,
 * ele não tem número. É a mesma regra do travessão na tabela.
 */
export function KpisPorAno({ kpis }: KpisPorAnoProps) {
  useTemaDoGrafico();
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {kpis.map(({ ano, total, quantidade, crescimento }) => (
        <Card
          key={ano}
          className="border-l-4"
          style={{ borderLeftColor: corDoAno(ano) }}
        >
          <p className="text-sm font-medium text-conteudo-muted">{ano}</p>
          <p
            className="mt-1 text-xl font-bold"
            style={{ color: corDoAno(ano) }}
          >
            {total > 0 ? formatarMoeda(total) : "Sem dados"}
          </p>
          <p className="mt-1 text-xs text-conteudo-muted">
            {quantidade} transações
          </p>
          {crescimento !== null && (
            <div
              className={[
                "mt-2 flex items-center gap-1 text-xs font-semibold",
                crescimento >= 0 ? "text-success" : "text-danger",
              ].join(" ")}
            >
              {crescimento >= 0 ? (
                <TrendingUp size={12} aria-hidden="true" />
              ) : (
                <TrendingDown size={12} aria-hidden="true" />
              )}
              {formatarVariacao(crescimento)} vs {ano - 1}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
