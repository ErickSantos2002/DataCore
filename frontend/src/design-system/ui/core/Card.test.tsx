import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card, CardBody, CardHeader, CardTitle } from "./Card";

describe("Card", () => {
  it("compoe cabecalho, titulo e corpo", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Faturamento</CardTitle>
        </CardHeader>
        <CardBody>R$ 4.107.512,01</CardBody>
      </Card>,
    );
    expect(screen.getByText("Faturamento")).toBeInTheDocument();
    expect(screen.getByText("R$ 4.107.512,01")).toBeInTheDocument();
  });

  it("o titulo e um cabecalho de verdade, nao um div com fonte grande", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Faturamento</CardTitle>
        </CardHeader>
      </Card>,
    );
    expect(screen.getByRole("heading", { name: "Faturamento" })).toBeInTheDocument();
  });

  it("se separa do fundo por borda, nao por sombra", () => {
    const { container } = render(<Card>conteúdo</Card>);
    const cartao = container.firstElementChild as HTMLElement;
    expect(cartao.className).toContain("border");
    expect(cartao.className).not.toMatch(/\bshadow-(sm|md|lg|xl)\b/);
  });
});
