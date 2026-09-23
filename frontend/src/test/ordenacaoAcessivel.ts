import { fireEvent, screen } from "@testing-library/react";
import { expect } from "vitest";

/**
 * O `aria-sort` de uma tabela ordenável, conferido pela tela renderizada.
 *
 * As tabelas com o botão "Ordenar por X" dentro do `<th>` (e não o `sortable`
 * do primitivo) mostravam a direção só na seta: quem usa leitor de tela ouvia
 * "Ordenar por Valor, botão" e não sabia se a coluna estava crescente,
 * decrescente ou fora de uso. Estoque passava o `aria-sort` à mão; Contas,
 * Serviços e Produtos não passavam.
 *
 * Confere: cada cabeçalho ordenável tem `aria-sort`; no máximo um sai de
 * "none"; e depois de clicar em `rotulo`, é ele que sai, na direção da seta
 * que o botão desenha (a `ChevronDown` é decrescente).
 */
export function conferirAriaSort(rotulo: string): void {
  const botoes = () => screen.getAllByRole("button", { name: /^Ordenar por / });
  const estado = (botao: HTMLElement) =>
    botao.closest("th")?.getAttribute("aria-sort");

  expect(botoes().length).toBeGreaterThan(1);
  for (const botao of botoes()) {
    expect(["none", "ascending", "descending"]).toContain(estado(botao));
  }
  expect(botoes().filter((b) => estado(b) !== "none").length).toBeLessThan(2);

  fireEvent.click(
    screen.getByRole("button", { name: `Ordenar por ${rotulo}` }),
  );

  const clicado = screen.getByRole("button", { name: `Ordenar por ${rotulo}` });
  // A seta do botão é SVG sem nome; a classe do lucide diz qual é.
  const seta = clicado.querySelector("svg.lucide-chevron-down")
    ? "descending"
    : clicado.querySelector("svg.lucide-chevron-up")
      ? "ascending"
      : null;
  expect(seta).not.toBeNull();
  expect(estado(clicado)).toBe(seta);
  for (const outro of botoes().filter((b) => b !== clicado)) {
    expect(estado(outro)).toBe("none");
  }
}
