import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Progress } from "./Progress";

describe("Progress", () => {
  it("se anuncia como barra de progresso com o valor", () => {
    render(<Progress value={40} label="Meta do mês" />);
    const barra = screen.getByRole("progressbar", { name: "Meta do mês" });
    expect(barra).toHaveAttribute("aria-valuenow", "40");
  });

  it("satura em 100 para nao vazar do card", () => {
    render(<Progress value={140} label="Prazo" />);
    const barra = screen.getByRole("progressbar", { name: "Prazo" });
    expect(barra).toHaveAttribute("aria-valuenow", "100");
  });

  it("quando encerrado, troca a barra pelo resumo do resultado", () => {
    render(<Progress value={100} done doneLabel="Concluído" label="Prazo" />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("Concluído")).toBeInTheDocument();
  });

  it("sem trackSize/trackTone, o trilho continua com os 4px e a cor de hoje", () => {
    render(<Progress value={40} label="Meta do mês" />);
    const barra = screen.getByRole("progressbar", { name: "Meta do mês" });
    expect(barra).toHaveClass("h-1");
    expect(barra).toHaveClass("bg-surface-elevated");
    expect(barra).not.toHaveClass("h-1.5");
    expect(barra).not.toHaveClass("bg-action-tint");
  });

  it("trackSize='md' deixa o trilho com 6px", () => {
    render(<Progress value={40} label="Meta do mês" trackSize="md" />);
    const barra = screen.getByRole("progressbar", { name: "Meta do mês" });
    expect(barra).toHaveClass("h-1.5");
    expect(barra).not.toHaveClass("h-1");
  });

  it("trackTone='action' tinge o trilho com bg-action-tint", () => {
    render(<Progress value={40} label="Meta do mês" trackTone="action" />);
    const barra = screen.getByRole("progressbar", { name: "Meta do mês" });
    expect(barra).toHaveClass("bg-action-tint");
    expect(barra).not.toHaveClass("bg-surface-elevated");
  });
});
