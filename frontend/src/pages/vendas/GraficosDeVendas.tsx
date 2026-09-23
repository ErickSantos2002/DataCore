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
import { useIsMobile } from "../../hooks/useIsMobile";
import { formatarDinheiroAbreviado } from "../../lib/dinheiro";
import type { PontoDeEvolucao } from "./vendas";

/** Índices da rampa de séries do `chartTheme`, com nome em vez de número. */
const SERIE_ACAO = 0;
const SERIE_POSITIVA = 1;

/** A altura dos quatro gráficos — o `ChartEmpty` que ocupa o lugar do vazio
 *  precisa do MESMO número, senão o cartão pula de tamanho. */
const ALTURA = 300;

/** Gráfico sem dado não desenha nada útil: linha e barras pintam um eixo em
 *  branco e a pizza nada, e a moldura muda sob o título lia como tela
 *  quebrada. Uma frase para vazio e para falha — a falha já tem o `Alert` no
 *  topo da página. */
const MENSAGEM_SEM_DADO = "Nenhuma venda no período para montar este gráfico.";

const DINHEIRO = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

export interface GraficosDeVendasProps {
  evolucao: PontoDeEvolucao[];
  rankingProdutos: { produto: string; valor: number }[];
  rankingVendedores: { vendedor: string; valor: number }[];
  distribuicaoEmpresas: { name: string; value: number }[];
}

/**
 * Evolução, Top 5 Produtos, Top 5 Vendedores e distribuição por empresa.
 *
 * Nasce limpo, sobre o `chartTheme`. Saem as oito cores de `CORES`, as oito de
 * `CORES_PIZZA` (que ninguém usava), o balão da evolução que perguntava
 * `classList.contains("dark")` no render e os três balões sempre brancos, também
 * no tema escuro. As barras do Top 5 Produtos eram laranja e as de vendedores
 * verdes: saem na cor de ação e na positiva da rampa. A pizza passa da rampa de
 * oito para a de seis — a sétima e a oitava fatias repetem as duas primeiras.
 *
 * O eixo de vendedores caía para 9px em celular, e o de valor dos produtos
 * era 11px desenhado à mão: os dois sobem para 12px.
 */
export function GraficosDeVendas({
  evolucao,
  rankingProdutos,
  rankingVendedores,
  distribuicaoEmpresas,
}: GraficosDeVendasProps) {
  useTemaDoGrafico();
  const isMobile = useIsMobile();

  const balao = {
    ...chartTheme.tooltip,
    padding: "8px 12px",
    whiteSpace: "normal" as const,
    wordBreak: "break-word" as const,
  };
  const eixo = { fill: chartTheme.axis.stroke, fontSize: 12 };

  return (
    <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                tick={eixo}
                axisLine={{ stroke: chartTheme.grid.stroke }}
              />
              <YAxis
                // Na largura padrão (60px) "R$ 10.0M" não cabia e quebrava em
                // duas linhas, com o "R$" cortado no topo do gráfico.
                width={80}
                tickFormatter={(value) => formatarDinheiroAbreviado(value)}
                tick={eixo}
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
        <CardTitle className="mb-4">Top 5 Produtos</CardTitle>
        {rankingProdutos.length === 0 ? (
          <ChartEmpty height={ALTURA} message={MENSAGEM_SEM_DADO} />
        ) : (
          <ResponsiveContainer width="100%" height={ALTURA}>
            {/* A margem esquerda e os 110px do eixo são para o nome inclinado:
              com 60px e sem margem, o começo dele saía cortado
              ("TRO PHOEB..." em vez de "BAFÔMETRO PHOEB..."). */}
            <BarChart
              data={rankingProdutos}
              barCategoryGap="20%"
              margin={{ top: 5, right: 10, left: 30, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={chartTheme.grid.stroke}
              />
              <XAxis
                dataKey="produto"
                angle={-45}
                textAnchor="end"
                height={110}
                tick={eixo}
                axisLine={{ stroke: chartTheme.grid.stroke }}
                tickFormatter={(value: string) =>
                  value.length > 15 ? value.substring(0, 15) + "..." : value
                }
              />
              <YAxis
                // 80 cabe o rótulo mais largo do abreviado, "R$ 999,9 mil"; no
                // padrão de 60 o "R" de "R$ 550 mil" saía cortado (visto em
                // Serviços em 22/09).
                width={80}
                tick={eixo}
                tickFormatter={(value: number) =>
                  formatarDinheiroAbreviado(value)
                }
                axisLine={{ stroke: chartTheme.grid.stroke }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!(active && payload && payload.length)) return null;
                  const { produto, valor } = payload[0].payload;
                  return (
                    <div style={{ ...balao, maxWidth: "200px" }}>
                      <p style={{ fontWeight: 600, marginBottom: "4px" }}>
                        {produto}
                      </p>
                      <p style={{ color: corDaSerie(SERIE_ACAO) }}>
                        valor: <br />
                        <span style={{ fontWeight: 600 }}>
                          R$ {valor.toLocaleString("pt-BR", DINHEIRO)}
                        </span>
                      </p>
                    </div>
                  );
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
        <CardTitle className="mb-4">Top 5 Vendedores</CardTitle>
        {rankingVendedores.length === 0 ? (
          <ChartEmpty height={ALTURA} message={MENSAGEM_SEM_DADO} />
        ) : (
          <ResponsiveContainer width="100%" height={ALTURA}>
            <BarChart
              data={rankingVendedores}
              layout="vertical"
              margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={chartTheme.grid.stroke}
              />
              <XAxis
                type="number"
                tickFormatter={(value) => formatarDinheiroAbreviado(value)}
                tick={eixo}
                stroke={chartTheme.axis.stroke}
              />
              <YAxis
                type="category"
                dataKey="vendedor"
                width={isMobile ? 80 : 140}
                tick={eixo}
                tickFormatter={(name: string) =>
                  isMobile
                    ? name.length > 8
                      ? `${name.substring(0, 8)}...`
                      : name
                    : name.length > 15
                      ? `${name.substring(0, 15)}...`
                      : name
                }
                stroke={chartTheme.axis.stroke}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!(active && payload && payload.length)) return null;
                  const { vendedor, valor } = payload[0].payload;
                  return (
                    <div style={{ ...balao, maxWidth: "240px" }}>
                      <p style={{ fontWeight: 600, marginBottom: "6px" }}>
                        {vendedor}
                      </p>
                      <p style={{ color: corDaSerie(SERIE_POSITIVA) }}>
                        valor: <br />
                        <span style={{ fontWeight: 600 }}>
                          R$ {valor.toLocaleString("pt-BR", DINHEIRO)}
                        </span>
                      </p>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="valor"
                fill={corDaSerie(SERIE_POSITIVA)}
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card padding="lg">
        <CardTitle className="mb-4">Distribuição por Empresa</CardTitle>
        {distribuicaoEmpresas.length === 0 ? (
          <ChartEmpty height={ALTURA} message={MENSAGEM_SEM_DADO} />
        ) : (
          <ResponsiveContainer width="100%" height={ALTURA}>
            <PieChart>
              <Pie
                data={distribuicaoEmpresas}
                cx="50%"
                cy="50%"
                label={({ percent = 0 }) => `${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                dataKey="value"
              >
                {distribuicaoEmpresas.map((fatia, indice) => (
                  <Cell key={fatia.name + indice} fill={corDaSerie(indice)} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!(active && payload && payload.length)) return null;
                  const { name, value } = payload[0].payload;
                  return (
                    <div style={{ ...balao, maxWidth: "260px" }}>
                      <p style={{ fontWeight: 600, marginBottom: "4px" }}>
                        {name}
                      </p>
                      <p style={{ color: corDaSerie(SERIE_ACAO) }}>
                        valor: {formatarDinheiroAbreviado(value)}
                      </p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
