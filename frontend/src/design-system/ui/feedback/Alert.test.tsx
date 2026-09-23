import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert } from "./Alert";

describe("Alert", () => {
  it("se anuncia para leitor de tela", () => {
    render(<Alert variant="danger">Não foi possível carregar seus chamados.</Alert>);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar seus chamados.",
    );
  });

  it("pinta com tinta semantica, nao com degrau da rampa", () => {
    render(<Alert variant="warning">Prazo correndo.</Alert>);
    expect(screen.getByRole("alert").className).toContain("bg-tint-warning");
  });
});
