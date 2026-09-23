import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("mostra as iniciais quando nao ha imagem", () => {
    render(<Avatar name="Erick Santos" />);
    expect(screen.getByText("ES")).toBeInTheDocument();
  });

  it("mostra a imagem com texto alternativo quando ha", () => {
    render(<Avatar name="Erick Santos" src="/foto.png" />);
    expect(screen.getByRole("img", { name: "Erick Santos" })).toBeInTheDocument();
  });
});
