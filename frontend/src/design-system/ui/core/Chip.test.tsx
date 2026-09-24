import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Chip } from "./Chip";

describe("Chip", () => {
  it("mostra o texto que recebe", () => {
    render(<Chip>Cliente: CIMENTOS EXEMPLO</Chip>);
    expect(screen.getByText("Cliente: CIMENTOS EXEMPLO")).toBeInTheDocument();
  });

  it("sem onRemove, o x nao aparece", () => {
    render(<Chip>Cliente: CIMENTOS EXEMPLO</Chip>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("com onRemove, o x chama o callback ao ser clicado", () => {
    const aoRemover = vi.fn();
    render(<Chip onRemove={aoRemover}>Cliente: CIMENTOS EXEMPLO</Chip>);
    fireEvent.click(
      screen.getByRole("button", { name: "Remover filtro Cliente: CIMENTOS EXEMPLO" }),
    );
    expect(aoRemover).toHaveBeenCalledTimes(1);
  });

  it("a variante aplicado usa fundo de tinta e texto de acao", () => {
    render(<Chip variant="aplicado">Período: Este mês</Chip>);
    const pilula = screen.getByText("Período: Este mês").closest("span");
    expect(pilula?.className).toContain("bg-action-tint");
    expect(pilula?.className).toContain("text-action");
  });

  it("a variante salvo usa borda e sem fundo de tinta", () => {
    render(<Chip variant="salvo">Minha visão</Chip>);
    const pilula = screen.getByText("Minha visão").closest("span");
    expect(pilula?.className).toContain("border-borda");
    expect(pilula?.className).not.toContain("bg-action-tint");
  });
});
