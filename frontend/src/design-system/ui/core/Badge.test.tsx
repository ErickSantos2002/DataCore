import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("mostra o texto que recebe", () => {
    render(<Badge>Ativo</Badge>);
    expect(screen.getByText("Ativo")).toBeInTheDocument();
  });

  it("o fundo e tinta semantica, nao degrau da rampa", () => {
    render(<Badge variant="success">Concluído</Badge>);
    const selo = screen.getByText("Concluído");
    expect(selo.className).toContain("bg-tint-success");
    expect(selo.className).toContain("text-on-tint-success");
  });
});
