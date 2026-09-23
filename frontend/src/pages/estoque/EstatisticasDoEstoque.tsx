import { Card, CardTitle, DataList } from "../../design-system/ui";

export interface EstatisticasDoEstoqueProps {
  itens: { label: string; value: string | number }[];
}

/**
 * O cartão "Estatísticas do Estoque", sobre o `DataList` — que nasceu
 * justamente para esta ficha de pares e as irmãs dela em outras telas.
 *
 * O "Maior Preço" perde o azul que só ele tinha: no `DataList` os quatro valores
 * têm o mesmo peso, e o azul cru não carregava significado.
 */
export function EstatisticasDoEstoque({ itens }: EstatisticasDoEstoqueProps) {
  return (
    <Card padding="lg">
      <CardTitle className="mb-4">Estatísticas do Estoque</CardTitle>
      <DataList items={itens.map((item) => ({ key: item.label, ...item }))} />
    </Card>
  );
}
