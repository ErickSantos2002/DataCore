import { Card, CardTitle } from "../../design-system/ui";

export interface FaturamentoMensal {
  mes: string;
  total: number;
}

export interface ResumoTrimestreProps {
  meses: FaturamentoMensal[];
  /** O faturamento apurado do trimestre — a soma dos meses acima. */
  total: number;
  totalAno: number;
}

function emReais(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

/**
 * O faturamento mês a mês do trimestre em apuração, com o total do
 * trimestre e o total do ano fechando a lista.
 *
 * É a contraparte numérica dos velocímetros: eles mostram a distância até o
 * degrau, esta lista mostra de onde o número saiu.
 */
export function ResumoTrimestre({
  meses,
  total,
  totalAno,
}: ResumoTrimestreProps) {
  return (
    <Card padding="lg">
      <CardTitle>Trimestre Atual</CardTitle>

      <ul className="mt-4 space-y-3 text-left text-conteudo">
        {meses.length === 0 ? (
          <li className="text-sm text-conteudo-muted">
            Nenhum mês do trimestre foi apurado ainda. Os valores aparecem aqui
            quando as notas do período são sincronizadas com o Tiny ERP.
          </li>
        ) : (
          meses.map((item) => (
            <li
              key={item.mes}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="font-medium">{item.mes}:</span>
              <span className="font-mono font-bold text-action">
                R$ {emReais(item.total)}
              </span>
            </li>
          ))
        )}

        <li className="flex items-baseline justify-between gap-3 border-t border-borda pt-3">
          <span className="font-medium">Total do trimestre:</span>
          <span className="font-mono font-bold text-conteudo-heading">
            R$ {emReais(total)}
          </span>
        </li>

        <li className="flex items-baseline justify-between gap-3 border-t border-borda pt-3">
          <span className="font-medium">Total do Ano:</span>
          <span className="font-mono font-bold text-success">
            R$ {emReais(totalAno)}
          </span>
        </li>
      </ul>
    </Card>
  );
}
