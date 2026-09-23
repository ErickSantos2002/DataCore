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
import { useTemaDoGrafico } from "../../design-system/chartTheme";
import {
  ANOS,
  MESES,
  PARES_YOY,
  chaveDaVariacao,
  crescimento,
  formatarMoeda,
  formatarVariacao,
  somaDoAno,
  type PontoDeVariacao,
  type SeriePorAnoMes,
} from "./financeiro";
import { corDoAno } from "./coresDoAno";

export interface TabelaComparativaProps {
  total: SeriePorAnoMes;
  variacao: PontoDeVariacao[];
}

/** Verde para crescimento, vermelho para queda, apagado para "não existe". */
function tomDaVariacao(valor: number | null): string {
  if (valor === null) return "text-conteudo-faint";
  return valor >= 0 ? "text-success" : "text-danger";
}

/** Célula compacta: são catorze colunas, o padding do primitivo não cabe. */
const CELULA = "px-3 py-2 text-right font-mono tabular-nums";

/**
 * Os doze meses contra os cinco anos, com as quatro variações à direita e uma
 * linha de total no rodapé.
 *
 * A linha de total **não** é a média das variações mensais: é a variação
 * entre os totais do ano. São números diferentes, e o que a diretoria lê é o
 * segundo — a média de doze percentuais dá peso igual a janeiro e a dezembro.
 */
export function TabelaComparativa({ total, variacao }: TabelaComparativaProps) {
  useTemaDoGrafico();
  const totaisDoAno = ANOS.map((ano) => somaDoAno(total, ano));

  return (
    <Card padding="none">
      <CardTitle className="px-5 pt-5">Tabela Mensal Comparativa</CardTitle>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell className="px-3 py-2 text-left">
              Mês
            </TableHeaderCell>
            {ANOS.map((ano) => (
              <TableHeaderCell
                key={ano}
                className="px-3 py-2 text-right"
                style={{ color: corDoAno(ano) }}
              >
                {ano}
              </TableHeaderCell>
            ))}
            {PARES_YOY.map(([base, comp]) => (
              <TableHeaderCell
                key={`${comp}${base}`}
                className="px-3 py-2 text-right"
              >
                {String(base).slice(2)}/{comp}
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {MESES.map((mes, indice) => (
            <TableRow key={mes}>
              <TableCell className="px-3 py-2 font-medium">{mes}</TableCell>
              {ANOS.map((ano) => (
                <TableCell key={ano} className={CELULA}>
                  {formatarMoeda(total[ano][indice])}
                </TableCell>
              ))}
              {PARES_YOY.map(([base, comp]) => {
                const chave = chaveDaVariacao(base, comp);
                const valor = variacao[indice][chave] as number | null;
                return (
                  <TableCell
                    key={chave}
                    className={`${CELULA} font-semibold ${tomDaVariacao(valor)}`}
                  >
                    {formatarVariacao(valor)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
          <TableRow className="border-t-2 border-borda-strong bg-surface-elevated font-bold">
            <TableCell className="px-3 py-3">Total</TableCell>
            {ANOS.map((ano, indice) => (
              <TableCell
                key={ano}
                className={`${CELULA} py-3`}
                style={{ color: corDoAno(ano) }}
              >
                {formatarMoeda(totaisDoAno[indice])}
              </TableCell>
            ))}
            {PARES_YOY.map(([base, comp]) => {
              const valor = crescimento(
                totaisDoAno[ANOS.indexOf(base)],
                totaisDoAno[ANOS.indexOf(comp)],
              );
              return (
                <TableCell
                  key={`total-${comp}${base}`}
                  className={`${CELULA} py-3 ${tomDaVariacao(valor)}`}
                >
                  {formatarVariacao(valor)}
                </TableCell>
              );
            })}
          </TableRow>
        </TableBody>
      </Table>
    </Card>
  );
}
