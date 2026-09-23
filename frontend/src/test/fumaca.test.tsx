import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function Titulo() {
  return <h1>DataCoreHS</h1>;
}

describe("ferramental de teste", () => {
  it("renderiza um componente React e encontra o texto na tela", () => {
    render(<Titulo />);
    expect(
      screen.getByRole("heading", { name: "DataCoreHS" }),
    ).toBeInTheDocument();
  });
});
