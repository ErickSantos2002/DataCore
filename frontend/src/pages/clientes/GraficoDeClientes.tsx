import { useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  chartTheme,
  corDaSerie,
  useTemaDoGrafico,
} from "../../design-system/chartTheme";
import { Card, CardTitle, ChartEmpty } from "../../design-system/ui";
import { useIsMobile } from "../../hooks/useIsMobile";
import { formatarDinheiroAbreviado } from "../../lib/dinheiro";
import type { BarraDoRanking } from "./clientes";

/** Índice da rampa de séries do `chartTheme`, com nome em vez de número. */
const SERIE_ACAO = 0;

/** Sem cliente, as barras pintavam a grade e os eixos em branco sob o título,
 *  que lia como tela quebrada. Uma frase para vazio e para falha — a falha já
 *  tem o `Alert` no topo da página. */
const MENSAGEM_SEM_DADO = "Nenhum cliente no período para montar este gráfico.";

export interface GraficoDeClientesProps {
  ranking: BarraDoRanking[];
}

/**
 * O "Top 10 Clientes", barras deitadas com o balão posicionado à mão.
 *
 * Nasce limpo, sobre o `chartTheme`. Sai o balão que perguntava
 * `classList.contains("dark")` no render — sem nada que o fizesse renderizar de
 * novo na troca de tema — com seis hexadecimais cravados, e o `#374151` da
 * grade, escuro também no tema claro.
 *
 * O balão segue o cursor e troca de lado quando estouraria a borda direita: a
 * conta veio inteira, com as larguras de 220 e 280px que o conteúdo usa.
 */
export function GraficoDeClientes({ ranking }: GraficoDeClientesProps) {
  useTemaDoGrafico();
  const isMobile = useIsMobile();

  const chartRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState<
    { x: number; y: number } | undefined
  >(undefined);

  return (
    <Card padding="lg" className="overflow-hidden">
      <CardTitle className="mb-4">Top 10 Clientes</CardTitle>

      {ranking.length === 0 ? (
        <ChartEmpty height={isMobile ? 420 : 300} message={MENSAGEM_SEM_DADO} />
      ) : (
        <div ref={chartRef} className="relative">
          <ResponsiveContainer width="100%" height={isMobile ? 420 : 300}>
            <BarChart
              data={ranking}
              layout="vertical"
              margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
              barCategoryGap={2}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onMouseMove={(state: any) => {
                if (!state?.isTooltipActive) {
                  setTooltipPos(undefined);
                  return;
                }
                const tooltipW = isMobile ? 220 : 280;
                const pad = 16;
                const chartX = state.chartX ?? 0;
                const chartY = state.chartY ?? 0;
                const containerW =
                  chartRef.current?.getBoundingClientRect().width ?? 0;

                // Se estourar à direita, posiciona à esquerda do cursor.
                const x =
                  chartX + tooltipW + pad > containerW
                    ? Math.max(8, chartX - tooltipW - pad)
                    : chartX + pad;
                const y = Math.max(8, chartY - 40);
                setTooltipPos({ x, y });
              }}
              onMouseLeave={() => setTooltipPos(undefined)}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={chartTheme.grid.stroke}
              />

              <XAxis
                type="number"
                tickFormatter={(v) => formatarDinheiroAbreviado(v)}
                stroke={chartTheme.axis.stroke}
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                type="category"
                dataKey="nomeCompleto"
                width={isMobile ? 130 : 160}
                tick={{ fontSize: 12 }}
                tickFormatter={(name: string) =>
                  isMobile
                    ? name.length > 12
                      ? `${name.substring(0, 12)}...`
                      : name
                    : name.length > 18
                      ? `${name.substring(0, 18)}...`
                      : name
                }
                axisLine={false}
                tickLine={false}
                stroke={chartTheme.axis.stroke}
              />

              <Tooltip
                position={tooltipPos}
                offset={0}
                allowEscapeViewBox={{ x: true, y: true }}
                wrapperStyle={{ overflow: "visible", pointerEvents: "none" }}
                content={({ active, payload }) => {
                  if (!(active && payload && payload.length)) return null;
                  const { nomeCompleto, valor } = payload[0].payload;
                  return (
                    <div
                      style={{
                        ...chartTheme.tooltip,
                        padding: "8px 12px",
                        maxWidth: isMobile ? 220 : 280,
                        whiteSpace: "normal",
                        wordBreak: "break-word",
                        hyphens: "auto",
                        fontSize: isMobile ? "12px" : "13px",
                        lineHeight: 1.35,
                      }}
                    >
                      <p style={{ fontWeight: 600, marginBottom: 6 }}>
                        {nomeCompleto}
                      </p>
                      <p style={{ color: corDaSerie(SERIE_ACAO) }}>
                        valor:
                        <br />
                        {typeof valor === "number"
                          ? `R$ ${valor.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`
                          : "N/A"}
                      </p>
                    </div>
                  );
                }}
              />

              <Bar dataKey="valor" fill={corDaSerie(SERIE_ACAO)} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
