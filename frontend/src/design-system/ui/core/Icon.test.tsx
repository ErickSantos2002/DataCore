import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon } from "./Icon";

describe("Icon", () => {
  it("e decorativo por padrao, invisivel para leitor de tela", () => {
    const { container } = render(<Icon name="check" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("aceita rotulo quando carrega significado sozinho", () => {
    render(<Icon name="check" aria-label="Concluído" />);
    expect(screen.getByLabelText("Concluído")).toBeInTheDocument();
  });

  it("some com aria-hidden quando recebe rotulo, para nao esconder o que rotula", () => {
    const { container } = render(<Icon name="check" aria-label="Concluído" />);
    expect(container.querySelector("svg")).not.toHaveAttribute("aria-hidden");
  });
});
