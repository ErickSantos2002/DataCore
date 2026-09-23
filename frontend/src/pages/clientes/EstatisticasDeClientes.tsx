import { Card, CardTitle, DataList } from "../../design-system/ui";

export interface EstatisticasDeClientesProps {
  itens: { label: string; value: string | number }[];
}

/**
 * O cartão "Estatísticas do Período", sobre o `DataList`, como o de Estoque.
 * As quatro cores cruas dos valores (verde, azul, roxo) saem: no `DataList`
 * os valores têm o mesmo peso.
 */
export function EstatisticasDeClientes({ itens }: EstatisticasDeClientesProps) {
  return (
    <Card padding="lg">
      <CardTitle className="mb-4">Estatísticas do Período</CardTitle>
      <DataList items={itens.map((item) => ({ key: item.label, ...item }))} />
    </Card>
  );
}
