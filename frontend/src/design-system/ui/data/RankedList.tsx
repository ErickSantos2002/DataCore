import { Progress } from "./Progress";

export interface RankedListItem {
  /** Identifica a linha na lista de `items` — não aparece na tela. */
  key: string;
  /** Nome da linha — trunca com reticências quando não cabe. */
  nome: string;
  /** Valor numérico bruto, usado só para calcular a proporção da barra
   * contra o maior valor da lista. */
  valor: number;
  /** Texto já formatado do valor — `"R$ 312.800,00"`, `"148 vendas"`. Cai
   * para `valor` quando omitido. */
  valorFormatado?: string;
}

export interface RankedListProps {
  items: RankedListItem[];
  className?: string;
}

/**
 * "Top produtos", "Top clientes", "Top vendedores", "Top fornecedores" — nome
 * e valor numa linha, barra fina logo abaixo proporcional ao **maior valor da
 * lista**, não a um total e não a 100. Não é port: a anatomia vem do design
 * do Erick e se repete em pelo menos seis telas da Fase 3.
 *
 * A barra usa o `Progress` já existente (`tone="neutral"`, sem `label`,
 * `trackSize="md"` e `trackTone="action"` para o trilho de 6px em
 * `bg-action-tint` que o design pede) — o texto de nome e valor já está na
 * linha acima, então a barra fica `aria-hidden`: sem isso, o leitor de tela
 * anunciaria um "barra de progresso" sem contexto, porque o `Progress` não
 * expõe um nome acessível dissociado do texto visível.
 *
 * ```tsx
 * <RankedList
 *   items={[
 *     { key: "extintor", nome: "Extintor ABC 6kg", valor: 312800, valorFormatado: "R$ 312.800,00" },
 *     { key: "capacete", nome: "Capacete Classe A", valor: 156400, valorFormatado: "R$ 156.400,00" },
 *   ]}
 * />
 * ```
 */
export function RankedList({ items, className }: RankedListProps) {
  if (items.length === 0) return null;

  const maiorValor = Math.max(...items.map((item) => item.valor), 0);

  return (
    <div className={["grid gap-3", className].filter(Boolean).join(" ")}>
      {items.map((item) => {
        const proporcao = maiorValor > 0 ? (item.valor / maiorValor) * 100 : 0;
        return (
          <div key={item.key} className="grid gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-[13px] text-conteudo">{item.nome}</span>
              <span className="shrink-0 font-mono text-xs text-conteudo-muted">
                {item.valorFormatado ?? item.valor}
              </span>
            </div>
            <div aria-hidden="true">
              <Progress value={proporcao} tone="neutral" trackSize="md" trackTone="action" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
