/**
 * O `aria-sort` de um cabeçalho ordenável: "none" fora de uso, e a direção
 * quando é a coluna da ordem.
 *
 * As tabelas com botão "Ordenar por" dentro do `<th>` (e não o `sortable` do
 * primitivo, que já emite o atributo) mostravam a direção só na seta: o leitor
 * de tela não sabia se a coluna estava crescente, decrescente ou fora de uso.
 * Estoque escrevia a expressão à mão; Contas, Serviços e Produtos não
 * escreviam nada.
 */
export function ariaSort(
  emUso: boolean,
  direcao: "asc" | "desc",
): "none" | "ascending" | "descending" {
  if (!emUso) return "none";
  return direcao === "asc" ? "ascending" : "descending";
}
