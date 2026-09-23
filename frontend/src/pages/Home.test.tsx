import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./Home";

describe("Home", () => {
  it("mostra a logo e o rodape com direitos reservados, sem oferecer navegacao", () => {
    render(<Home />);
    expect(screen.getByAltText("Logo Health & Safety")).toBeInTheDocument();
    expect(
      screen.getByText(/Todos os direitos reservados/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`© ${new Date().getFullYear()}`)),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
