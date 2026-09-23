import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../../design-system/ui";
import {
  chartTheme,
  corDaSerie,
  useTemaDoGrafico,
} from "../../design-system/chartTheme";
import { formatarDinheiroAbreviado } from "../../lib/dinheiro";
import { SeletorDeAno } from "./SeletorDeAno";
import {
  GRUPOS_DE_CATEGORIA,
  GRUPO_SEM_CATEGORIA,
  ROTULO_SEM_CATEGORIA,
  MESES,
  ROTULO_DE_ENTRADA,
  formatarMoeda,
  type Ano,
  type Balancete,
} from "./financeiro";

/** Índices da rampa de séries do `chartTheme`, com nome em vez de número. */
const SERIE_ENTRADA = 1;
const SERIE_SAIDA = 4;

const ALTURA_DO_GRAFICO = 280;

/** Categoria + doze meses + total. */
const COLUNAS = 14;

/** Célula compacta: são catorze colunas, o padding do primitivo não cabe. */
const CELULA = "px-2 py-2 text-right font-mono tabular-nums";

export interface AbaBalanceteProps {
  ano: number;
  onAno: (ano: Ano) => void;
  balancete: Balancete;
}

/** O rótulo de uma linha, venha ela das entradas ou do plano de contas. */
function rotuloDaLinha(chave: string): string {
  if (chave === GRUPO_SEM_CATEGORIA) return ROTULO_SEM_CATEGORIA;
  return (
    ROTULO_DE_ENTRADA[chave] ??
    GRUPOS_DE_CATEGORIA[chave] ??
    `${chave} - Outros`
  );
}

/**
 * O balancete do ano: entradas de venda e serviço contra as contas a pagar,
 * agrupadas pelo número que abre a categoria no plano de contas do Tiny.
 *
 * As contas que não seguem o plano de contas aparecem numa linha própria, no
 * fim, sob "SEM CATEGORIA" — antes elas somavam no total sem virar linha, e o
 * balancete fechava com um valor que nada explicava.
 */
export function AbaBalancete({ ano, onAno, balancete }: AbaBalanceteProps) {
  useTemaDoGrafico();
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center gap-4">
        <SeletorDeAno ano={ano} onAno={onAno} />

        <div className="ml-auto flex flex-wrap gap-6">
          <div className="text-center">
            <p className="text-xs text-conteudo-muted">Total Entradas</p>
            <p className="text-base font-bold text-success">
              {formatarMoeda(balancete.totalEntradasAno)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-conteudo-muted">Total Saídas</p>
            <p className="text-base font-bold text-danger">
              {formatarMoeda(balancete.totalSaidasAno)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-conteudo-muted">Saldo do Período</p>
            <p
              className={[
                "text-base font-bold",
                balancete.saldoDoAno >= 0 ? "text-success" : "text-danger",
              ].join(" ")}
            >
              {formatarMoeda(balancete.saldoDoAno)}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-4">Entradas vs Saídas — {ano}</CardTitle>
        <ResponsiveContainer width="100%" height={ALTURA_DO_GRAFICO}>
          <BarChart data={balancete.pontosDoGrafico} barCategoryGap="25%">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={chartTheme.grid.stroke}
            />
            <XAxis
              dataKey="mes"
              tick={{ fill: chartTheme.axis.stroke, fontSize: 12 }}
            />
            <YAxis
              tickFormatter={formatarDinheiroAbreviado}
              tick={{ fill: chartTheme.axis.stroke, fontSize: 11 }}
              width={85}
            />
            <Tooltip
              contentStyle={chartTheme.tooltip}
              formatter={(valor: number, nome: string) => [
                formatarMoeda(valor),
                nome,
              ]}
            />
            <Legend />
            <Bar
              dataKey="Entradas"
              fill={corDaSerie(SERIE_ENTRADA)}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="Saídas"
              fill={corDaSerie(SERIE_SAIDA)}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card padding="none">
        <CardTitle className="px-5 pt-5">Balancete — {ano}</CardTitle>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell className="min-w-[260px] px-3 py-2 text-left">
                Categoria
              </TableHeaderCell>
              {MESES.map((mes) => (
                <TableHeaderCell key={mes} className="px-2 py-2 text-right">
                  {mes}/{String(ano).slice(2)}
                </TableHeaderCell>
              ))}
              <TableHeaderCell className="px-3 py-2 text-right">
                Total
              </TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow className="bg-tint-success">
              <TableCell
                colSpan={COLUNAS}
                className="px-3 py-2 text-sm font-bold uppercase tracking-wide text-on-tint-success"
              >
                Entradas
              </TableCell>
            </TableRow>

            {balancete.linhasDeEntrada.map((chave) => (
              <LinhaDeValores
                key={chave}
                rotulo={rotuloDaLinha(chave)}
                valores={balancete.entradas[chave]}
                tomDoTotal="text-success"
              />
            ))}

            <TableRow className="bg-tint-success font-bold">
              <TableCell className="px-3 py-2 text-sm text-on-tint-success">
                Total de entradas
              </TableCell>
              {balancete.totalEntradasMes.map((valor, mes) => (
                <TableCell key={mes} className={`${CELULA} text-success`}>
                  {formatarMoeda(valor)}
                </TableCell>
              ))}
              <TableCell className={`${CELULA} px-3 text-success`}>
                {formatarMoeda(balancete.totalEntradasAno)}
              </TableCell>
            </TableRow>

            <TableRow className="bg-tint-danger">
              <TableCell
                colSpan={COLUNAS}
                className="px-3 py-2 text-sm font-bold uppercase tracking-wide text-on-tint-danger"
              >
                Saídas
              </TableCell>
            </TableRow>

            {balancete.linhasDeSaida.map((grupo) => (
              <LinhaDeValores
                key={grupo}
                rotulo={rotuloDaLinha(grupo)}
                valores={balancete.saidas[grupo]}
                tomDoTotal="text-danger"
              />
            ))}

            <TableRow className="bg-tint-danger font-bold">
              <TableCell className="px-3 py-2 text-sm text-on-tint-danger">
                Total de saídas
              </TableCell>
              {balancete.totalSaidasMes.map((valor, mes) => (
                <TableCell key={mes} className={`${CELULA} text-danger`}>
                  {formatarMoeda(valor)}
                </TableCell>
              ))}
              <TableCell className={`${CELULA} px-3 text-danger`}>
                {formatarMoeda(balancete.totalSaidasAno)}
              </TableCell>
            </TableRow>

            <TableRow className="border-t-2 border-borda-strong bg-surface-elevated font-bold">
              <TableCell className="px-3 py-3 text-sm uppercase tracking-wide">
                Saldo do Período
              </TableCell>
              {balancete.saldoMes.map((valor, mes) => (
                <TableCell
                  key={mes}
                  className={`${CELULA} py-3 ${tomDoSaldo(valor)}`}
                >
                  {formatarMoeda(valor)}
                </TableCell>
              ))}
              <TableCell
                className={`${CELULA} px-3 py-3 text-sm ${tomDoSaldo(balancete.saldoDoAno)}`}
              >
                {formatarMoeda(balancete.saldoDoAno)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

/**
 * Saldo zerado fica apagado, não verde.
 *
 * O texto de um saldo zerado é travessão — `formatarMoeda` devolve travessão
 * para zero —, e travessão verde diria "fechou no positivo" para um mês que
 * na verdade não teve movimento nenhum, ou fechou empatado.
 */
function tomDoSaldo(valor: number): string {
  if (valor === 0) return "text-conteudo-faint";
  return valor > 0 ? "text-success" : "text-danger";
}

function LinhaDeValores({
  rotulo,
  valores,
  tomDoTotal,
}: {
  rotulo: string;
  valores: number[];
  tomDoTotal: string;
}) {
  const total = valores.reduce((soma, valor) => soma + valor, 0);
  return (
    <TableRow>
      <TableCell className="px-3 py-2">{rotulo}</TableCell>
      {valores.map((valor, mes) => (
        <TableCell key={mes} className={CELULA}>
          {formatarMoeda(valor)}
        </TableCell>
      ))}
      <TableCell className={`${CELULA} px-3 font-semibold ${tomDoTotal}`}>
        {formatarMoeda(total)}
      </TableCell>
    </TableRow>
  );
}
