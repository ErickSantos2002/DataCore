import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RankedList } from "./RankedList";

describe("RankedList", () => {
  it("mostra nome e valor formatado de cada item", () => {
    render(
      <RankedList
        items={[
          { key: "a", nome: "Extintor ABC 6kg", valor: 312800, valorFormatado: "R$ 312.800,00" },
          { key: "b", nome: "Capacete Classe A", valor: 156400, valorFormatado: "R$ 156.400,00" },
        ]}
      />,
    );
    expect(screen.getByText("Extintor ABC 6kg")).toBeInTheDocument();
    expect(screen.getByText("R$ 312.800,00")).toBeInTheDocument();
    expect(screen.getByText("Capacete Classe A")).toBeInTheDocument();
    expect(screen.getByText("R$ 156.400,00")).toBeInTheDocument();
  });

  it("a barra do primeiro colocado enche e as demais sao fracao dele, nao de um total", () => {
    render(
      <RankedList
        items={[
          { key: "a", nome: "Primeiro", valor: 100 },
          { key: "b", nome: "Segundo", valor: 50 },
          { key: "c", nome: "Terceiro", valor: 25 },
        ]}
      />,
    );
    const barras = screen.getAllByRole("progressbar", { hidden: true });
    expect(barras).toHaveLength(3);
    expect(barras[0]).toHaveAttribute("aria-valuenow", "100");
    expect(barras[1]).toHaveAttribute("aria-valuenow", "50");
    expect(barras[2]).toHaveAttribute("aria-valuenow", "25");
  });

  it("uma lista vazia nao quebra", () => {
    const { container } = render(<RankedList items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("um unico item com valor zero nao quebra a divisao pelo maior valor", () => {
    render(<RankedList items={[{ key: "a", nome: "Sem venda", valor: 0 }]} />);
    const barra = screen.getByRole("progressbar", { hidden: true });
    expect(barra).toHaveAttribute("aria-valuenow", "0");
  });

  it("usa o valor bruto quando nao ha valorFormatado", () => {
    render(<RankedList items={[{ key: "a", nome: "Item", valor: 42 }]} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("desenha a barra com o trilho de 6px em bg-action-tint que o design pede", () => {
    render(<RankedList items={[{ key: "a", nome: "Item", valor: 42 }]} />);
    const barra = screen.getByRole("progressbar", { hidden: true });
    expect(barra).toHaveClass("h-1.5");
    expect(barra).toHaveClass("bg-action-tint");
  });
});
