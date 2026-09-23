import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardTitle, ChartEmpty } from "../../design-system/ui";
import {
  chartTheme,
  corDaSerie,
  useTemaDoGrafico,
} from "../../design-system/chartTheme";
import { formatarDinheiroAbreviado } from "../../lib/dinheiro";
import {
  formatarMoeda,
  type Evolucao,
  type PontoDeCategoria,
  type PontoDeContraparte,
} from "./contas";

/** Índices da rampa de séries do `chartTheme`, com nome em vez de número. */
const SERIE_SUCESSO = 1;
const SERIE_ACAO = 0;
const SERIE_PERIGO = 4;

/** Nome de contraparte longo não cabe no eixo; corta em 16 com reticências. */
const LIMITE_DO_EIXO = 16;

/**
 * Altura de cada gráfico, em pixels. Constante porque o `ChartEmpty` que
 * ocupa o lugar do gráfico vazio precisa do MESMO número — número solto
 * repetido em dois lugares é número que sai do lugar na primeira mexida.
 */
const ALTURA_DA_EVOLUCAO = 280;
const ALTURA_DO_CARTAO = 300;

/**
 * A frase do gráfico sem dado. Não é a da tabela ("Nenhuma conta
 * encontrada.") de propósito: são quatro caixas na mesma tela, e repetir a
 * mesma frase em todas faria a tela gaguejar.
 *
 * Serve tanto para a lista vazia quanto para a falha de carregamento — em
 * ambos não há conta para plotar, e a causa da falha já está no `Alert`
 * vermelho no topo da página.
 */
const MENSAGEM_SEM_DADO = "Nenhuma conta para montar este gráfico.";

export interface GraficosDeContasProps {
  evolucao: Evolucao;
  categorias: PontoDeCategoria[];
  contrapartes: PontoDeContraparte[];
  /** Nome da série de quitado nos dados — "recebido" ou "pago". */
  chaveQuitado: string;
  /** Legenda das duas barras — "Recebido"/"A Receber", "Pago"/"Em Aberto". */
  legendaQuitado: string;
  legendaAberto: string;
  /** Entrada de dinheiro é ação; saída é perigo. */
  tomDoAberto: "acao" | "perigo";
  /** "Top 10 Clientes" ou "Top 10 Fornecedores". */
  tituloDasContrapartes: string;
  /** Clique numa barra da evolução — filtra o mês ou o ano da barra. */
  onClicarNaEvolucao: (estado: { activeLabel?: string }) => void;
}

/** Balão de tooltip com nome longo quebrando em várias linhas. */
function BalaoDeTooltip({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div
      style={{
        ...chartTheme.tooltip,
        padding: "8px 12px",
        maxWidth: "260px",
        whiteSpace: "normal",
        wordBreak: "break-word",
      }}
    >
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{titulo}</p>
      <p style={{ color: corDaSerie(SERIE_ACAO) }}>{formatarMoeda(valor)}</p>
    </div>
  );
}

/**
 * Os três gráficos das telas de Contas: a evolução no tempo, a distribuição
 * por categoria e o ranking de cliente/fornecedor.
 *
 * O desenho da Fase 3 desenhou estes gráficos em SVG puro; isso é referência
 * de LEIAUTE, não de implementação. Eles continuam em recharts, com as cores
 * saindo de `chartTheme` — que resolve os tokens em tempo de execução e
 * portanto acompanha a troca de tema, coisa que hexadecimal cravado na prop
 * nunca fez.
 *
 * Cada gráfico vive no próprio `Card`: são três perguntas diferentes, e uma
 * caixa só com três respostas dentro é uma caixa que ninguém lê.
 */
export function GraficosDeContas({
  evolucao,
  categorias,
  contrapartes,
  chaveQuitado,
  legendaQuitado,
  legendaAberto,
  tomDoAberto,
  tituloDasContrapartes,
  onClicarNaEvolucao,
}: GraficosDeContasProps) {
  useTemaDoGrafico();
  const corDoAberto = corDaSerie(
    tomDoAberto === "perigo" ? SERIE_PERIGO : SERIE_ACAO,
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card padding="lg" className="lg:col-span-2">
        <div className="mb-4 flex items-center justify-between gap-4">
          <CardTitle>{evolucao.titulo}</CardTitle>
          <span className="text-xs text-conteudo-faint">
            Clique em uma barra para filtrar
          </span>
        </div>
        {evolucao.dados.length === 0 ? (
          <ChartEmpty height={ALTURA_DA_EVOLUCAO} message={MENSAGEM_SEM_DADO} />
        ) : (
          <ResponsiveContainer width="100%" height={ALTURA_DA_EVOLUCAO}>
            <BarChart
              data={evolucao.dados}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
              onClick={onClicarNaEvolucao}
              style={{ cursor: "pointer" }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={chartTheme.grid.stroke}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: chartTheme.axis.stroke, fontSize: 12 }}
                axisLine={{ stroke: chartTheme.grid.stroke }}
              />
              <YAxis
                tickFormatter={formatarDinheiroAbreviado}
                tick={{ fill: chartTheme.axis.stroke, fontSize: 12 }}
                width={80}
                axisLine={{ stroke: chartTheme.grid.stroke }}
              />
              <Tooltip
                contentStyle={chartTheme.tooltip}
                formatter={(valor) => formatarMoeda(Number(valor))}
              />
              <Legend />
              <Bar
                dataKey={chaveQuitado}
                name={legendaQuitado}
                fill={corDaSerie(SERIE_SUCESSO)}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="aberto"
                name={legendaAberto}
                fill={corDoAberto}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card padding="lg">
        <CardTitle className="mb-4">Distribuição por Categoria</CardTitle>
        {categorias.length === 0 ? (
          <ChartEmpty height={ALTURA_DO_CARTAO} message={MENSAGEM_SEM_DADO} />
        ) : (
          <ResponsiveContainer width="100%" height={ALTURA_DO_CARTAO}>
            <PieChart>
              <Pie
                data={categorias}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ percent = 0 }) => `${(percent * 100).toFixed(0)}%`}
              >
                {categorias.map((fatia, indice) => (
                  <Cell key={fatia.name} fill={corDaSerie(indice)} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const { name, value } = payload[0]
                    .payload as PontoDeCategoria;
                  return <BalaoDeTooltip titulo={name} valor={value} />;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card padding="lg">
        <CardTitle className="mb-4">{tituloDasContrapartes}</CardTitle>
        {contrapartes.length === 0 ? (
          <ChartEmpty height={ALTURA_DO_CARTAO} message={MENSAGEM_SEM_DADO} />
        ) : (
          <ResponsiveContainer width="100%" height={ALTURA_DO_CARTAO}>
            <BarChart
              data={contrapartes}
              layout="vertical"
              margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={chartTheme.grid.stroke}
              />
              <XAxis
                type="number"
                tickFormatter={formatarDinheiroAbreviado}
                stroke={chartTheme.axis.stroke}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="nome"
                width={120}
                stroke={chartTheme.axis.stroke}
                tick={{ fontSize: 12 }}
                tickFormatter={(nome: string) =>
                  nome.length > LIMITE_DO_EIXO
                    ? `${nome.slice(0, LIMITE_DO_EIXO)}...`
                    : nome
                }
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const { nome, valor } = payload[0]
                    .payload as PontoDeContraparte;
                  return <BalaoDeTooltip titulo={nome} valor={valor} />;
                }}
              />
              <Bar
                dataKey="valor"
                fill={corDaSerie(SERIE_ACAO)}
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
