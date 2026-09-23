export interface DataListItem {
  /** Identifica a linha na lista de `items` — não aparece na tela. */
  key: string;
  label: string;
  value: string | number;
}

export interface DataListProps {
  items: DataListItem[];
  className?: string;
}

/**
 * Pares rótulo/valor com fundo alternado — "Resumo do Período", "Comparativo
 * Mensal", "Performance de Vendas", "Estatísticas do Período" e
 * "Estatísticas do Estoque". Não é port: a anatomia vem do design do Erick e
 * repete com marcação idêntica em pelo menos cinco cards da Fase 3.
 *
 * Não é `Table`: não há cabeçalho nem colunas comparáveis entre linhas, só
 * uma ficha de pares. Por isso a marcação é `<dl>`/`<dt>`/`<dd>` — a que
 * descreve "lista de definições" — em vez de uma tabela, que anunciaria
 * linhas e colunas que não existem para quem usa leitor de tela. Cada par
 * fica num `<div>` que envolve o `dt` e o `dd` (o HTML permite agrupar assim
 * dentro de uma `<dl>`), porque é esse `<div>` que carrega o fundo alternado
 * — `bg-surface-base` nos índices pares, transparente nos ímpares.
 *
 * ```tsx
 * <DataList
 *   items={[
 *     { key: "receita", label: "Receita bruta", value: "R$ 128.450,00" },
 *     { key: "despesas", label: "Despesas", value: "R$ 42.100,00" },
 *   ]}
 * />
 * ```
 */
export function DataList({ items, className }: DataListProps) {
  if (items.length === 0) return null;

  return (
    <dl className={["grid gap-0.5", className].filter(Boolean).join(" ")}>
      {items.map((item, indice) => (
        <div
          key={item.key}
          className={[
            "flex items-baseline justify-between gap-3 rounded-lg px-3 py-2.5",
            indice % 2 === 0 ? "bg-surface-base" : "",
          ].join(" ")}
        >
          <dt className="text-[13px] text-conteudo-muted">{item.label}</dt>
          <dd className="m-0 font-mono text-[13px] font-semibold text-conteudo-heading">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
