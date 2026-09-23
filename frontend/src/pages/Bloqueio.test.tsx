import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Bloqueio from "./Bloqueio";

describe("Bloqueio", () => {
  it("avisa que o acesso foi negado", () => {
    render(<Bloqueio />);
    expect(
      screen.getByRole("heading", { name: "Acesso negado" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Você não tem permissão para acessar esta página."),
    ).toBeInTheDocument();
  });
});
