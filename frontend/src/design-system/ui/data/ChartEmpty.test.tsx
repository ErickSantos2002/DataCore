import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartEmpty } from "./ChartEmpty";

describe("ChartEmpty", () => {
  it("diz em frase completa, com ponto final, que nao ha dado", () => {
    render(<ChartEmpty height={300} />);
    expect(screen.getByText("Nenhum dado para exibir.")).toBeInTheDocument();
  });

  it("a frase e parametrizavel — cada tela diz o que faltou nela", () => {
    render(<ChartEmpty height={300} message="Nenhuma conta para montar este gráfico." />);
    expect(screen.getByText("Nenhuma conta para montar este gráfico.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum dado para exibir.")).not.toBeInTheDocument();
  });

  it("aceita no, e nao so texto — a saida mora junto da frase", () => {
    render(
      <ChartEmpty
        height={300}
        message={
          <span>
            Nenhuma conta no filtro. <button type="button">Limpar filtros</button>
          </span>
        }
      />,
    );
    expect(screen.getByRole("button", { name: "Limpar filtros" })).toBeInTheDocument();
  });

  it("ocupa a altura do grafico que substitui, para o cartao nao encolher", () => {
    const { container } = render(<ChartEmpty height={280} />);
    const caixa = container.firstElementChild as HTMLElement;
    expect(caixa.style.height).toBe("280px");
  });

  it("centraliza a frase na caixa, em vez de encostar num canto", () => {
    const { container } = render(<ChartEmpty height={300} />);
    const caixa = container.firstElementChild as HTMLElement;
    expect(caixa.className).toContain("items-center");
    expect(caixa.className).toContain("justify-center");
  });
});
