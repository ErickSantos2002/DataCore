import { KpiCard } from "../../design-system/ui";
import type { KpisDeProduto } from "./produtos";

export interface KpisDeProdutosProps {
  kpis: KpisDeProduto;
}

/**
 * A faixa de quatro indicadores do topo da tela de Produtos.
 *
 * Nunca entrou em `PENDENTES_FASE_3`: nasceu já sobre o `KpiCard` do design
 * system, sem `dark:` nem paleta crua. (O texto anterior falava de uma
 * "Task 6" que não existe no plano desta branch — veio colado junto do
 * arquivo, copiado verbatim de `79954c07`.)
 *
 * "Produto Mais Vendido" usa `valorEhTexto`: descrição de produto é nome, não
 * número, e sem isso o `KpiCard` tenta caber o texto inteiro na altura fixa
 * de 116px em vez de truncar com reticências.
 */
export function KpisDeProdutos({ kpis }: KpisDeProdutosProps) {
  return (
    <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
      <KpiCard
        label="Quantidade Total Vendida"
        value={kpis.totalProdutosVendidos.toLocaleString("pt-BR")}
      />

      <KpiCard
        label="Faturamento Total"
        value={`R$ ${kpis.totalFaturado.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`}
        tone="positivo"
      />

      <KpiCard
        label="Ticket Médio por Produto"
        value={`R$ ${kpis.ticketMedio.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`}
      />

      <KpiCard
        label="Produto Mais Vendido"
        value={kpis.produtoMaisVendido?.descricao || "N/A"}
        valorEhTexto
        note={`Qtd: ${kpis.produtoMaisVendido?.quantidadeVendida?.toLocaleString("pt-BR") || "0"}`}
      />
    </div>
  );
}
