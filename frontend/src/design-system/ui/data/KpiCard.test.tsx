import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KpiCard } from "./KpiCard";

describe("KpiCard", () => {
  it("mostra rotulo, valor e nota", () => {
    render(
      <KpiCard
        label="Faturamento Total"
        value="R$ 128.450,00"
        note="94 vendas no período"
      />,
    );
    expect(screen.getByText("Faturamento Total")).toBeInTheDocument();
    expect(screen.getByText("R$ 128.450,00")).toBeInTheDocument();
    expect(screen.getByText("94 vendas no período")).toBeInTheDocument();
  });

  it("o tom muda a cor do valor", () => {
    render(<KpiCard label="Contas Vencidas" value="12" tone="perigo" />);
    expect(screen.getByText("12").className).toContain("text-on-tint-danger");
  });

  it("o tom neutro (padrao) usa a cor de titulo", () => {
    render(<KpiCard label="Produtos" value="143" />);
    expect(screen.getByText("143").className).toContain("text-conteudo-heading");
  });

  it("valor numerico nao trunca", () => {
    render(<KpiCard label="Ticket Médio" value="R$ 1.234,00" />);
    expect(screen.getByText("R$ 1.234,00").className).not.toContain("truncate");
  });

  it("valorEhTexto trunca com reticencias em vez de usar o tamanho fluido", () => {
    render(<KpiCard label="Produto Top" value="Extintor ABC 6kg" valorEhTexto />);
    const valor = screen.getByText("Extintor ABC 6kg");
    expect(valor.className).toContain("truncate");
    expect(valor.className).not.toContain("clamp");
  });
});
