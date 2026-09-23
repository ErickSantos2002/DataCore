import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EmConstrucao from "./EmConstrucao";

describe("EmConstrucao", () => {
  it("avisa que a tela ainda nao existe e usa o titulo da pagina no document.title", () => {
    render(<EmConstrucao titulo="Vendas" />);
    expect(
      screen.getByRole("heading", { name: "Em construção" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Em breve teremos gráficos e análises aqui para ajudar na sua tomada de decisão.",
      ),
    ).toBeInTheDocument();
  });
});
