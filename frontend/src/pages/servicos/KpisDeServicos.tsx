import { KpiCard } from "../../design-system/ui";
import { formatarDinheiroAbreviado } from "../../lib/dinheiro";
import type { KpisDeServico } from "./servicos";

export interface KpisDeServicosProps {
  kpis: KpisDeServico;
}

/**
 * A faixa de quatro indicadores do topo da tela de Serviços.
 *
 * Nasceu limpa: nunca entrou no `PENDENTES_FASE_3`. Molde:
 * `produtos/KpisDeProdutos.tsx`.
 *
 * "Top Cliente" usa `valorEhTexto`: o `KpiCard` então trunca com reticências
 * e, sozinho, coloca `title={String(value)}` no valor. É esse atributo que
 * `Servicos.kpis.test.tsx` confere (símbolo `cartaoDoKpi`) — o nome vem
 * truncado por CSS, e o `title` é a única cópia íntegra na tela.
 *
 * "NFS-e Emitidas" recebe o número cru, e não `toLocaleString("pt-BR")`: é o
 * que `Servicos.tsx` mostrava antes desta decomposição, e a contagem real da
 * base passa de mil (5.004 notas), então o separador de milhar mudaria o que
 * a pessoa lê. Achado ao mover (não corrigido) — pôr o separador é decisão de
 * apresentação, e vale para os quatro cartões de uma vez, não só para este.
 */
export function KpisDeServicos({ kpis }: KpisDeServicosProps) {
  return (
    <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
      <KpiCard
        label="Faturamento Total"
        value={`R$ ${kpis.totalFaturado.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`}
        tone="acao"
      />

      <KpiCard
        label="NFS-e Emitidas"
        value={kpis.totalServicos}
        tone="positivo"
      />

      <KpiCard
        label="Ticket Médio"
        value={`R$ ${kpis.ticketMedio.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`}
      />

      <KpiCard
        label="Top Cliente"
        value={kpis.topCliente?.nome || "N/A"}
        valorEhTexto
        note={
          kpis.topCliente
            ? formatarDinheiroAbreviado(kpis.topCliente.valor)
            : "R$ 0"
        }
      />
    </div>
  );
}
