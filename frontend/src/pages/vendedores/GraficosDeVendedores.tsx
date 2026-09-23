import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
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
import { formatarDinheiroAbreviado } from "../../lib/dinheiro";
import type { PontoDeEvolucao } from "./vendedores";

/** Índice da rampa de séries do `chartTheme`, com nome em vez de número. */
const SERIE_ACAO = 0;

/** A altura dos três gráficos — o `ChartEmpty` que ocupa o lugar do vazio
 *  precisa do MESMO número, senão o cartão pula de tamanho. */
const ALTURA = 300;

/** Gráfico sem dado não desenha nada útil: a linha e as barras pintam um eixo
 *  em branco e a pizza nada. A moldura muda sob o título lia como tela
 *  quebrada. Uma frase serve para vazio e para falha — a falha já tem o
 *  `Alert` no topo da página. */
const MENSAGEM_SEM_DADO = "Nenhuma venda no período para montar este gráfico.";

export interface GraficosDeVendedoresProps {
  evolucao: PontoDeEvolucao[];
  topProdutos: { produto: string; valor: number }[];
  distribuicaoClientes: { name: string; value: number }[];
}

/**
 * Evolução da mercadoria, os cinco produtos de maior valor e a distribuição
 * pelos oito maiores clientes.
 *
 * Nasce limpo, sobre o `chartTheme`. Saem as oito cores cravadas (`CORES`) e os
 * três balões de estilo próprio — um deles sempre branco, mesmo no tema escuro,
 * e outro que perguntava `classList.contains("dark")` no render, sem nada que o
 * fizesse renderizar de novo na troca de tema.
 *
 * ⚠️ As barras do "Top Produtos" eram LARANJA e a linha era azul. Aqui as duas
 * saem na cor de ação — a mesma mudança deliberada que Produtos fez (ver o
 * retrato de 10/09 na spec). A pizza passa da rampa de oito para a de seis do
 * `chartTheme`: a sétima e a oitava fatias repetem as duas primeiras cores.
 */
export function GraficosDeVendedores({
  evolucao,
  topProdutos,
  distribuicaoClientes,
}: GraficosDeVendedoresProps) {
  useTemaDoGrafico();
  return (
    <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card padding="lg">
        <CardTitle className="mb-4">Evolução das Vendas</CardTitle>
        {evolucao.length === 0 ? (
          <ChartEmpty height={ALTURA} message={MENSAGEM_SEM_DADO} />
        ) : (
          <ResponsiveContainer width="100%" height={ALTURA}>
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
                // 80 cabe o rótulo mais largo do abreviado, "R$ 999,9 mil"; no
                // padrão de 60 o "R" de "R$ 550 mil" saía cortado (visto em
                // Serviços em 22/09).
                width={80}
                tickFormatter={(value) => formatarDinheiroAbreviado(value)}
                tick={{ fill: chartTheme.axis.stroke, fontSize: 12 }}
                axisLine={{ stroke: chartTheme.grid.stroke }}
              />
              <Tooltip
                contentStyle={chartTheme.tooltip}
                itemStyle={{ color: corDaSerie(SERIE_ACAO) }}
                formatter={(value: number) => formatarDinheiroAbreviado(value)}
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
        )}
      </Card>

      <Card padding="lg">
        <CardTitle className="mb-4">Top Produtos Vendidos</CardTitle>
        {topProdutos.length === 0 ? (
          <ChartEmpty height={ALTURA} message={MENSAGEM_SEM_DADO} />
        ) : (
          <ResponsiveContainer width="100%" height={ALTURA}>
            <BarChart data={topProdutos} layout="horizontal">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={chartTheme.grid.stroke}
              />
              <XAxis
                dataKey="produto"
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fill: chartTheme.axis.stroke, fontSize: 12 }}
                tickFormatter={(value: string) =>
                  value.length > 12 ? `${value.substring(0, 12)}...` : value
                }
              />
              <YAxis
                width={80}
                tick={{ fill: chartTheme.axis.stroke, fontSize: 12 }}
                tickFormatter={(value: number) =>
                  formatarDinheiroAbreviado(value)
                }
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
                          maxWidth: "250px",
                          whiteSpace: "normal",
                          wordWrap: "break-word",
                          overflow: "hidden",
                        }}
                      >
                        <p style={{ fontWeight: 600, marginBottom: "4px" }}>
                          {produto}
                        </p>
                        <p style={{ color: corDaSerie(SERIE_ACAO) }}>
                          Valor:{" "}
                          {typeof valor === "number"
                            ? `R$ ${valor.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            : "N/A"}
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
        )}
      </Card>

      <Card padding="lg">
        <CardTitle className="mb-4">Distribuição de Clientes</CardTitle>
        {distribuicaoClientes.length === 0 ? (
          <ChartEmpty height={ALTURA} message={MENSAGEM_SEM_DADO} />
        ) : (
          <ResponsiveContainer width="100%" height={ALTURA}>
            <PieChart>
              <Pie
                data={distribuicaoClientes}
                cx="50%"
                cy="50%"
                label={({ percent = 0 }) => `${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill={corDaSerie(SERIE_ACAO)}
                dataKey="value"
              >
                {distribuicaoClientes.map((_fatia, indice) => (
                  <Cell key={`cell-${indice}`} fill={corDaSerie(indice)} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const { name, value } = payload[0].payload;
                    return (
                      <div
                        style={{
                          ...chartTheme.tooltip,
                          padding: "8px 12px",
                          maxWidth: "260px",
                          whiteSpace: "normal",
                          wordWrap: "break-word",
                        }}
                      >
                        <p style={{ fontWeight: 600, marginBottom: "4px" }}>
                          {name}
                        </p>
                        <p style={{ color: corDaSerie(SERIE_ACAO) }}>
                          valor: {formatarDinheiroAbreviado(value)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
