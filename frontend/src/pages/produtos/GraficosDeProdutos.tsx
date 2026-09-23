import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardTitle } from "../../design-system/ui";
import {
  chartTheme,
  corDaSerie,
  useTemaDoGrafico,
} from "../../design-system/chartTheme";
import type { PontoDeEvolucao, ProdutoAgregado } from "./produtos";
import { formatarDinheiroAbreviado } from "../../lib/dinheiro";

/** Índice da rampa de séries do `chartTheme`, com nome em vez de número. */
const SERIE_ACAO = 0;

export interface GraficosDeProdutosProps {
  evolucao: PontoDeEvolucao[];
  ranking: ProdutoAgregado[];
}

/**
 * Os dois gráficos da tela de Produtos: a evolução mensal da quantidade
 * vendida e o ranking dos 10 produtos por valor.
 */
export function GraficosDeProdutos({
  evolucao,
  ranking,
}: GraficosDeProdutosProps) {
  useTemaDoGrafico();
  // Ranking de produtos por valor (top 10) — a forma que o BarChart espera
  // (`produto`/`valor`) é montagem de gráfico, não conta de domínio, por
  // isso mora aqui e não em `produtos.ts`.
  const rankingProdutosValor = ranking.map((p) => ({
    produto: p.descricao,
    valor: p.valorTotal,
  }));

  return (
    <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Evolução da Quantidade de Produtos Vendidos */}
      <Card padding="lg">
        <CardTitle className="mb-4">
          Evolução da Quantidade de Produtos Vendidos
        </CardTitle>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={evolucao}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={chartTheme.grid.stroke}
            />
            <XAxis
              dataKey="mes"
              tick={{ fill: chartTheme.axis.stroke, fontSize: 12 }}
              axisLine={{ stroke: chartTheme.grid.stroke }}
            />
            <YAxis
              tick={{ fill: chartTheme.axis.stroke, fontSize: 12 }}
              axisLine={{ stroke: chartTheme.grid.stroke }}
            />
            <Tooltip
              contentStyle={chartTheme.tooltip}
              itemStyle={{ color: corDaSerie(SERIE_ACAO) }}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke={corDaSerie(SERIE_ACAO)}
              strokeWidth={3}
              dot={{ fill: corDaSerie(SERIE_ACAO), r: 4 }}
              activeDot={{ r: 6, fill: corDaSerie(SERIE_ACAO) }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Top 10 Produtos por Valor */}
      <Card padding="lg">
        <CardTitle className="mb-4">Top 10 Produtos (Valor)</CardTitle>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={rankingProdutosValor} barCategoryGap="20%">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={chartTheme.grid.stroke}
            />
            <XAxis
              dataKey="produto"
              angle={-45}
              textAnchor="end"
              height={60}
              tick={{ fill: chartTheme.axis.stroke, fontSize: 12 }}
              axisLine={{ stroke: chartTheme.grid.stroke }}
              tickFormatter={(value) =>
                value.length > 15 ? value.substring(0, 15) + "..." : value
              }
            />
            <YAxis
              // 80 cabe o rótulo mais largo do abreviado, "R$ 999,9 mil"; no
              // padrão de 60 o "R" de "R$ 550 mil" saía cortado (visto em
              // Serviços em 22/09).
              width={80}
              tick={({ x, y, payload }) => (
                // 12px, e não 11 — item 5 do checklist de tela migrada
                // (tamanho mínimo de fonte). As outras três marcações de eixo
                // desta tela e as de `GraficosDeContas.tsx` (a tela irmã) já
                // usam 12; só esta destoava, e um rótulo de eixo é justamente
                // o texto que a pessoa mais precisa ler de relance.
                <text
                  x={x}
                  y={y}
                  textAnchor="end"
                  fontSize={12}
                  fill={chartTheme.axis.stroke}
                >
                  {formatarDinheiroAbreviado(payload.value)}
                </text>
              )}
              axisLine={{ stroke: chartTheme.grid.stroke }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const { produto, valor } = payload[0].payload;
                  return (
                    <div
                      style={{
                        ...chartTheme.tooltip,
                        padding: "8px 12px",
                        maxWidth: "200px",
                        whiteSpace: "normal",
                        wordBreak: "break-word",
                      }}
                    >
                      <p style={{ fontWeight: 600, marginBottom: "4px" }}>
                        {produto}
                      </p>
                      <p
                        style={{
                          color: corDaSerie(SERIE_ACAO),
                          fontSize: "14px",
                        }}
                      >
                        Valor: <br />
                        <span style={{ fontWeight: 600 }}>
                          R${" "}
                          {valor.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey="valor"
              fill={corDaSerie(SERIE_ACAO)}
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
