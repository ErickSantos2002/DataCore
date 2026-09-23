import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
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
import { formatarDinheiroAbreviado } from "../../lib/dinheiro";
import {
  ANOS,
  PARES_YOY,
  chaveDaVariacao,
  formatarMoeda,
  formatarVariacao,
  type Ano,
  type PontoAnual,
  type PontoDeVariacao,
} from "./financeiro";
import { corDoAno } from "./coresDoAno";

/** Índices da rampa de séries do `chartTheme`, com nome em vez de número. */
const SERIE_POSITIVA = 1;
const SERIE_NEGATIVA = 4;

const ALTURA_DO_COMPARATIVO = 320;
const ALTURA_DO_ACUMULADO = 280;
const ALTURA_DA_VARIACAO = 200;

export interface GraficosDaVisaoGeralProps {
  comparativo: PontoAnual[];
  acumulado: PontoAnual[];
  variacao: PontoDeVariacao[];
  anosAtivos: Set<Ano>;
}

/** Eixo, grade e balão saem todos do tema único — nenhuma cor solta aqui. */
function eixoX() {
  return (
    <XAxis
      dataKey="mes"
      tick={{ fill: chartTheme.axis.stroke, fontSize: 12 }}
    />
  );
}

function balao() {
  return (
    <Tooltip
      contentStyle={chartTheme.tooltip}
      formatter={(valor: number, nome: string) => [formatarMoeda(valor), nome]}
    />
  );
}

/**
 * Os gráficos da Visão Geral: comparativo mensal, acumulado do ano e as
 * quatro variações ano contra ano.
 *
 * As quatro variações recebem o MESMO array e se distinguem pelo `dataKey` —
 * cada cartão plota o par de anos que o título dele promete. A barra é
 * pintada por `Cell` uma a uma porque a cor depende do sinal do valor, não
 * da série: verde para crescimento, vermelho para queda, e cor de grade para
 * o mês em que o ano base não faturou e a variação não existe.
 */
export function GraficosDaVisaoGeral({
  comparativo,
  acumulado,
  variacao,
  anosAtivos,
}: GraficosDaVisaoGeralProps) {
  useTemaDoGrafico();
  const anos = ANOS.filter((ano) => anosAtivos.has(ano));

  return (
    <>
      <Card>
        <CardTitle className="mb-4">Comparativo Mensal</CardTitle>
        <ResponsiveContainer width="100%" height={ALTURA_DO_COMPARATIVO}>
          <BarChart data={comparativo} barCategoryGap="20%">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={chartTheme.grid.stroke}
            />
            {eixoX()}
            <YAxis
              tickFormatter={formatarDinheiroAbreviado}
              tick={{ fill: chartTheme.axis.stroke, fontSize: 11 }}
              width={80}
            />
            {balao()}
            <Legend />
            {anos.map((ano) => (
              <Bar
                key={ano}
                dataKey={ano.toString()}
                fill={corDoAno(ano)}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <CardTitle className="mb-4">Acumulado no Ano (YTD)</CardTitle>
        <ResponsiveContainer width="100%" height={ALTURA_DO_ACUMULADO}>
          <LineChart data={acumulado}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={chartTheme.grid.stroke}
            />
            {eixoX()}
            <YAxis
              tickFormatter={formatarDinheiroAbreviado}
              tick={{ fill: chartTheme.axis.stroke, fontSize: 11 }}
              width={80}
            />
            {balao()}
            <Legend />
            {anos.map((ano) => (
              <Line
                key={ano}
                type="monotone"
                dataKey={ano.toString()}
                stroke={corDoAno(ano)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {PARES_YOY.map(([base, comp]) => {
          const chave = chaveDaVariacao(base, comp);
          return (
            <Card key={chave}>
              <CardTitle>Variação Mensal</CardTitle>
              <p className="mb-4 mt-1 text-sm text-conteudo-muted">
                {comp} vs {base}
              </p>
              <ResponsiveContainer width="100%" height={ALTURA_DA_VARIACAO}>
                <BarChart data={variacao}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={chartTheme.grid.stroke}
                  />
                  {eixoX()}
                  <YAxis
                    tickFormatter={(valor: number) => `${valor.toFixed(0)}%`}
                    tick={{ fill: chartTheme.axis.stroke, fontSize: 11 }}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={chartTheme.tooltip}
                    formatter={(valor) => [
                      formatarVariacao(valor as number | null),
                      "Variação",
                    ]}
                  />
                  <ReferenceLine
                    y={0}
                    stroke={chartTheme.axis.stroke}
                    strokeWidth={1.5}
                  />
                  <Bar dataKey={chave} radius={[4, 4, 0, 0]}>
                    {variacao.map((ponto, indice) => {
                      const valor = ponto[chave] as number | null;
                      return (
                        <Cell
                          key={`${chave}-${indice}`}
                          fill={
                            valor === null
                              ? chartTheme.grid.stroke
                              : corDaSerie(
                                  valor >= 0 ? SERIE_POSITIVA : SERIE_NEGATIVA,
                                )
                          }
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          );
        })}
      </div>
    </>
  );
}
