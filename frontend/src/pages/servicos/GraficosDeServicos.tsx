import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { Card, CardTitle } from "../../design-system/ui";
import {
  chartTheme,
  corDaSerie,
  useTemaDoGrafico,
} from "../../design-system/chartTheme";
import { formatarDinheiroAbreviado } from "../../lib/dinheiro";
import {
  type PontoDeEvolucao,
  type FatiaDeCliente,
  type FatiaDeCidade,
} from "./servicos";

/** Índice da rampa de séries do `chartTheme`, com nome em vez de número. */
const SERIE_ACAO = 0;

export interface GraficosDeServicosProps {
  evolucaoMensal: PontoDeEvolucao[];
  rankingClientes: FatiaDeCliente[];
  distribuicaoCidades: FatiaDeCidade[];
}

/**
 * Os três gráficos da tela de Serviços: a evolução mensal, o ranking de
 * clientes e a distribuição por cidade.
 */
export function GraficosDeServicos({
  evolucaoMensal,
  rankingClientes,
  distribuicaoCidades,
}: GraficosDeServicosProps) {
  useTemaDoGrafico();
  return (
    <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Evolução dos Serviços */}
      <Card padding="lg">
        <CardTitle className="mb-4">Evolução dos Serviços Emitidos</CardTitle>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={evolucaoMensal}>
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
      </Card>

      {/* Ranking de Clientes */}
      <Card padding="lg">
        <CardTitle className="mb-4">Top 10 Clientes</CardTitle>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={rankingClientes} layout="vertical">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={chartTheme.grid.stroke}
            />
            <XAxis
              type="number"
              tickFormatter={(value) => formatarDinheiroAbreviado(value)}
              stroke={chartTheme.axis.stroke}
            />
            <YAxis
              type="category"
              dataKey="cliente"
              width={140}
              tick={{ fontSize: 11 }}
              stroke={chartTheme.axis.stroke}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const { clienteCompleto, valor } = payload[0].payload;

                  return (
                    <div
                      style={{
                        ...chartTheme.tooltip,
                        padding: "8px 12px",
                        maxWidth: "250px",
                        whiteSpace: "normal",
                        wordWrap: "break-word",
                      }}
                    >
                      <p style={{ fontWeight: 600, marginBottom: "4px" }}>
                        {clienteCompleto}
                      </p>
                      <p style={{ color: corDaSerie(SERIE_ACAO) }}>
                        Valor: R${" "}
                        {Number(valor).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="valor" fill={corDaSerie(SERIE_ACAO)} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Distribuição por Cidade */}
      <Card padding="lg" className="lg:col-span-2">
        <CardTitle className="mb-4">
          Distribuição por Cidade do Serviço
        </CardTitle>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={distribuicaoCidades}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent = 0 }) => {
                const nomeCortado =
                  name.length > 15 ? `${name.substring(0, 15)}...` : name;
                return `${nomeCortado} ${(percent * 100).toFixed(0)}%`;
              }}
              outerRadius={80}
              fill={corDaSerie(SERIE_ACAO)}
              dataKey="value"
            >
              {distribuicaoCidades.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={corDaSerie(index)} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatarDinheiroAbreviado(value)}
              contentStyle={chartTheme.tooltip}
            />
          </PieChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
