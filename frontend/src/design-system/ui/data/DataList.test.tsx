import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataList } from "./DataList";

describe("DataList", () => {
  it("cada rotulo e cada valor aparecem ligados como par, nao como dois textos soltos", () => {
    render(
      <DataList
        items={[
          { key: "receita", label: "Receita bruta", value: "R$ 128.450,00" },
          { key: "despesas", label: "Despesas", value: "R$ 42.100,00" },
        ]}
      />,
    );
    const rotulo = screen.getByText("Receita bruta");
    expect(rotulo.tagName).toBe("DT");
    const valor = rotulo.nextElementSibling;
    expect(valor?.tagName).toBe("DD");
    expect(valor).toHaveTextContent("R$ 128.450,00");
  });

  it("usa dl/dt/dd, nao tabela — nao e dado tabular", () => {
    const { container } = render(
      <DataList items={[{ key: "a", label: "Rótulo", value: "Valor" }]} />,
    );
    expect(container.querySelector("dl")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
  });

  it("alterna o fundo das linhas por indice", () => {
    const { container } = render(
      <DataList
        items={[
          { key: "a", label: "Um", value: "1" },
          { key: "b", label: "Dois", value: "2" },
          { key: "c", label: "Tres", value: "3" },
        ]}
      />,
    );
    const linhas = container.querySelectorAll("dl > div");
    expect(linhas).toHaveLength(3);
    expect(linhas[0].className).toContain("bg-surface-base");
    expect(linhas[1].className).not.toContain("bg-surface-base");
    expect(linhas[2].className).toContain("bg-surface-base");
  });

  it("uma lista vazia nao quebra", () => {
    const { container } = render(<DataList items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
