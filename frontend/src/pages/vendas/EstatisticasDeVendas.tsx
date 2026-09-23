import { Card, CardTitle, DataList } from "../../design-system/ui";
import type { ComparativoMensal } from "./vendas";

const DINHEIRO = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

export interface EstatisticasDeVendasProps {
  resumo: { label: string; value: string | number }[];
  comparativo: ComparativoMensal | null;
  /** A evolução é por ano (mais de 24 meses): os rótulos falam de ano. */
  porAno: boolean;
  /** Com o último período aberto, até quando ele vai: "até 22/09". */
  ate?: string;
  performance: { label: string; value: string }[];
}

/**
 * Os três cartões de rodapé: resumo do período, comparativo mensal e
 * performance.
 *
 * Nascem limpos, sobre o `DataList`. As cores cruas dos valores saem: verde na
 * maior venda, vermelho na menor e amarelo no desvio não diziam nada que o
 * rótulo já não dissesse. A variação perde o verde e o vermelho — o `DataList`
 * só recebe texto —, e o sentido fica no sinal, "+" ou "-".
 */
export function EstatisticasDeVendas({
  resumo,
  comparativo,
  porAno,
  ate,
  performance,
}: EstatisticasDeVendasProps) {
  // Acima de 24 meses a evolução é anual, e o cartão comparava ANOS sob
  // "Variação último mês", "Melhor mês" e "Média mensal".
  const unidade = porAno
    ? {
        titulo: "Anual",
        ultimo: "último ano",
        melhor: "Melhor ano",
        media: "Média anual",
      }
    : {
        titulo: "Mensal",
        ultimo: "último mês",
        melhor: "Melhor mês",
        media: "Média mensal",
      };

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card padding="lg">
        <CardTitle className="mb-4">Resumo do Período</CardTitle>
        <DataList
          items={resumo.map((item) => ({ key: item.label, ...item }))}
        />
      </Card>

      <Card padding="lg">
        <CardTitle className="mb-4">Comparativo {unidade.titulo}</CardTitle>
        {comparativo ? (
          <DataList
            items={[
              {
                key: "variacao",
                label: ate
                  ? `Variação ${unidade.ultimo}, ${ate}`
                  : `Variação ${unidade.ultimo}`,
                // Com vírgula, como a média ao lado: saía "-20.0%". Traço
                // enquanto a base do período aberto não chega.
                value:
                  comparativo.variacao === null
                    ? "—"
                    : `${comparativo.variacao >= 0 ? "+" : ""}${comparativo.variacao.toLocaleString(
                        "pt-BR",
                        { minimumFractionDigits: 1, maximumFractionDigits: 1 },
                      )}%`,
              },
              {
                key: "melhor",
                label: unidade.melhor,
                value: comparativo.melhorMes,
              },
              {
                key: "media",
                label: unidade.media,
                value: `R$ ${comparativo.mediaMensal.toLocaleString("pt-BR", DINHEIRO)}`,
              },
            ]}
          />
        ) : (
          // Com menos de dois pontos o cartão ficava só com o título.
          <p className="text-sm text-conteudo-muted">
            É preciso de vendas em dois meses para comparar.
          </p>
        )}
      </Card>

      <Card padding="lg">
        <CardTitle className="mb-4">Performance de Vendas</CardTitle>
        <DataList
          items={performance.map((item) => ({ key: item.label, ...item }))}
        />
      </Card>
    </div>
  );
}
