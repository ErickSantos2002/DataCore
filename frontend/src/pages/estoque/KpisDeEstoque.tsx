import { KpiCard } from "../../design-system/ui";
import type { KpisDeEstoque as Kpis } from "./estoque";

export interface KpisDeEstoqueProps {
  kpis: Kpis;
}

const DINHEIRO = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

/**
 * A faixa de quatro indicadores do topo.
 *
 * Nasce limpa, sobre o `KpiCard`. Saem os ícones em círculo colorido, como em
 * Vendedores. "Produtos sem Saldo" ganha `tone="perigo"`, que é o que o
 * vermelho cru queria dizer.
 */
export function KpisDeEstoque({ kpis }: KpisDeEstoqueProps) {
  return (
    <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
      <KpiCard
        label="Produtos Ativos"
        value={kpis.produtosAtivos}
        tone="positivo"
      />

      <KpiCard
        label="Produtos sem Saldo"
        value={kpis.produtosSemSaldo}
        tone="perigo"
      />

      <KpiCard
        label="Valor Total em Estoque"
        value={`R$ ${kpis.valorTotalEstoque.toLocaleString("pt-BR", DINHEIRO)}`}
        tone="acao"
      />

      <KpiCard
        label="Produto Top"
        value={kpis.produtoTop?.nome || "N/A"}
        valorEhTexto
        // Sem produto não há nota: saía "R$ ()", parênteses sozinhos. Sem
        // unidade — produto cadastrado no Tiny sem ela, que a API manda como
        // `null` — vai só o valor: saía "(null)".
        note={
          kpis.produtoTop
            ? `R$ ${kpis.produtoTop.valor.toLocaleString("pt-BR", DINHEIRO)}${
                kpis.produtoTop.unidade ? ` (${kpis.produtoTop.unidade})` : ""
              }`
            : undefined
        }
      />
    </div>
  );
}
