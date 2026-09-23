import { useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { useCliqueFora } from "../../hooks/useCliqueFora";
import { useIsMobile } from "../../hooks/useIsMobile";
import { formatarDinheiroAbreviado } from "../../lib/dinheiro";
import { type BarraDoRanking, type FatiaDeValor } from "./estoque";

/** Índices da rampa de séries do `chartTheme`, com nome em vez de número. */
const SERIE_ACAO = 0;
const SERIE_POSITIVA = 1;
const SERIE_NEGATIVA = 4;

/** Gráfico sem dado não desenha nada útil — as barras pintam um eixo em branco
 *  e as pizzas nada, e a moldura muda sob o título lia como tela quebrada. */
const MENSAGEM_SEM_DADO = "Nenhum produto para montar este gráfico.";

export interface GraficosDeEstoqueProps {
  ranking: BarraDoRanking[];
  distribuicao: FatiaDeValor[];
  situacao: { name: string; value: number }[];
}

/**
 * Top 10 por valor, distribuição do valor e situação dos produtos — os três
 * cartões de gráfico, devolvidos sem invólucro: a casca os põe na mesma grade
 * que o cartão de estatísticas.
 *
 * Nasce limpo, sobre o `chartTheme`. Saem as oito cores cravadas e os balões
 * sempre brancos (inclusive no tema escuro). As barras do Top 10 saem do
 * laranja para a cor de ação, como em Produtos e Vendedores; Ativos e Inativos
 * ficam no verde e no vermelho da rampa. O eixo do nome sobe de 10/11px para
 * 12px.
 *
 * Os dois popovers de pizza vieram inteiros: estado, refs, `useCliqueFora`,
 * `Escape` no container e o modo toque (`trigger="click"`) em celular. A
 * estrutura `div.relative > ResponsiveContainer > PieChart` é a que
 * `Estoque.popover.test.tsx` percorre.
 */
export function GraficosDeEstoque({
  ranking,
  distribuicao,
  situacao,
}: GraficosDeEstoqueProps) {
  useTemaDoGrafico();
  const isMobile = useIsMobile();

  const chartRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState<
    { x: number; y: number } | undefined
  >(undefined);

  const [showPizzaDistribuicao, setShowPizzaDistribuicao] = useState(false);
  const [showPizzaSituacao, setShowPizzaSituacao] = useState(false);
  const pizzaDistribRef = useRef<HTMLDivElement>(null);
  const pizzaSituacaoRef = useRef<HTMLDivElement>(null);

  // Uma chamada por popover: cada um é avaliado contra a própria ref.
  useCliqueFora(
    pizzaDistribRef,
    () => setShowPizzaDistribuicao(false),
    showPizzaDistribuicao,
  );
  useCliqueFora(
    pizzaSituacaoRef,
    () => setShowPizzaSituacao(false),
    showPizzaSituacao,
  );

  const balao = {
    ...chartTheme.tooltip,
    padding: "8px 12px",
    whiteSpace: "normal" as const,
  };

  return (
    <>
      <Card padding="lg">
        <CardTitle className="mb-4">Top 10 Produtos em Estoque</CardTitle>

        {ranking.length === 0 ? (
          <ChartEmpty
            height={isMobile ? 420 : 300}
            message={MENSAGEM_SEM_DADO}
          />
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
                  dataKey="nome"
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
                    const { fullName, valor } = payload[0].payload;
                    return (
                      <div
                        style={{
                          ...balao,
                          maxWidth: isMobile ? 220 : 280,
                          wordBreak: "break-word",
                          fontSize: isMobile ? "12px" : "13px",
                          lineHeight: 1.35,
                        }}
                      >
                        <p style={{ fontWeight: 600, marginBottom: 6 }}>
                          {fullName}
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

      <Card padding="lg">
        <CardTitle className="mb-4">Distribuição de Valor em Estoque</CardTitle>

        {distribuicao.length === 0 ? (
          <ChartEmpty height={300} message={MENSAGEM_SEM_DADO} />
        ) : (
          <div
            ref={pizzaDistribRef}
            tabIndex={-1}
            onKeyDown={(e) =>
              e.key === "Escape" && setShowPizzaDistribuicao(false)
            }
            onMouseLeave={() => setShowPizzaDistribuicao(false)}
            className="relative focus:outline-none"
          >
            <ResponsiveContainer width="100%" height={300}>
              <PieChart
                onClick={() => setShowPizzaDistribuicao(true)} // celular: abre no toque
                onMouseEnter={() => !isMobile && setShowPizzaDistribuicao(true)} // desktop: no hover
              >
                <Pie
                  data={distribuicao}
                  cx="50%"
                  cy="50%"
                  label={({ percent = 0 }) => `${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill={corDaSerie(SERIE_ACAO)}
                  dataKey="value"
                  onMouseLeave={() => setShowPizzaDistribuicao(false)}
                  isAnimationActive={false}
                >
                  {distribuicao.map((_fatia, indice) => (
                    <Cell
                      key={`cell-${indice}`}
                      fill={corDaSerie(indice)}
                      onClick={() => setShowPizzaDistribuicao(true)}
                    />
                  ))}
                </Pie>

                <Tooltip
                  trigger={isMobile ? "click" : "hover"}
                  wrapperStyle={{
                    maxWidth: 260,
                    whiteSpace: "normal",
                    wordWrap: "break-word",
                  }}
                  content={({ active, payload }) => {
                    if (!showPizzaDistribuicao) return null;
                    if (active && payload && payload.length) {
                      const { fullName, value } = payload[0].payload;
                      return (
                        <div style={{ ...balao, maxWidth: 240 }}>
                          <p style={{ fontWeight: 600, marginBottom: 4 }}>
                            {fullName}
                          </p>
                          <p style={{ color: corDaSerie(SERIE_ACAO) }}>
                            valor: R${" "}
                            {value.toLocaleString("pt-BR", {
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
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card padding="lg">
        <CardTitle className="mb-4">Situação dos Produtos</CardTitle>

        {situacao.length === 0 ? (
          <ChartEmpty height={300} message={MENSAGEM_SEM_DADO} />
        ) : (
          <div
            ref={pizzaSituacaoRef}
            tabIndex={-1}
            onKeyDown={(e) => e.key === "Escape" && setShowPizzaSituacao(false)}
            onMouseLeave={() => setShowPizzaSituacao(false)}
            className="relative focus:outline-none"
          >
            <ResponsiveContainer width="100%" height={300}>
              <PieChart
                onClick={() => setShowPizzaSituacao(true)}
                onMouseEnter={() => !isMobile && setShowPizzaSituacao(true)}
              >
                <Pie
                  data={situacao}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ percent = 0 }) => `${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill={corDaSerie(SERIE_ACAO)}
                  dataKey="value"
                  onMouseLeave={() => setShowPizzaSituacao(false)}
                  isAnimationActive={false}
                >
                  {situacao.map((fatia, indice) => (
                    <Cell
                      key={`cell-${indice}`}
                      fill={corDaSerie(
                        fatia.name === "Ativos"
                          ? SERIE_POSITIVA
                          : SERIE_NEGATIVA,
                      )}
                      onClick={() => setShowPizzaSituacao(true)}
                    />
                  ))}
                </Pie>

                <Tooltip
                  trigger={isMobile ? "click" : "hover"}
                  wrapperStyle={{
                    maxWidth: 260,
                    whiteSpace: "normal",
                    wordWrap: "break-word",
                  }}
                  content={({ active, payload }) => {
                    if (!showPizzaSituacao) return null;
                    if (active && payload && payload.length) {
                      const { name, value } = payload[0].payload;
                      // A porcentagem sai do total das fatias, e não de
                      // `payload[0].payload.percent`: o recharts entrega aqui o
                      // DADO da fatia, sem `percent`, e o balão mostrava "NaN%".
                      const total = situacao.reduce(
                        (soma, fatia) => soma + fatia.value,
                        0,
                      );
                      const percent = total > 0 ? value / total : 0;
                      return (
                        <div style={{ ...balao, maxWidth: 240 }}>
                          <p style={{ fontWeight: 600, marginBottom: 4 }}>
                            {name}
                          </p>
                          <p style={{ color: corDaSerie(SERIE_ACAO) }}>
                            Quantidade: {value}
                          </p>
                          <p style={{ color: corDaSerie(SERIE_POSITIVA) }}>
                            {(percent * 100).toFixed(0)}%
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </>
  );
}
