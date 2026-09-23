import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Switch } from "./Switch";

describe("Switch", () => {
  it("se anuncia como switch e alterna", async () => {
    const aoMudar = vi.fn();
    render(<Switch label="Tema escuro" onChange={aoMudar} />);
    await userEvent.click(screen.getByRole("switch", { name: "Tema escuro" }));
    expect(aoMudar).toHaveBeenCalled();
  });
});

describe("Switch: rótulo composto e classe do invólucro", () => {
  /**
   * O menu do usuário do DataCoreHS precisa da linha "🌙 Modo escuro" com o
   * interruptor na PONTA DIREITA, e o rótulo só aceitava string — o ícone
   * teria de viver fora do `<label>`, e clicar nele não alternaria nada. O
   * `className` é o que permite virar a ordem (`flex-row-reverse`) e ocupar a
   * largura do menu sem `style={{}}`.
   */
  it("aceita no do React como rotulo, e o clique nele alterna", async () => {
    const aoMudar = vi.fn();
    render(
      <Switch
        checked={false}
        onChange={aoMudar}
        label={<span data-testid="rotulo">Modo escuro</span>}
      />,
    );

    await userEvent.click(screen.getByTestId("rotulo"));

    expect(aoMudar).toHaveBeenCalledWith(true);
  });

  it("o className vai para o invólucro, sem apagar o que ele ja tinha", () => {
    render(
      <Switch checked={false} label="Modo escuro" className="w-full flex-row-reverse" />,
    );

    const involucro = screen.getByText("Modo escuro").closest("label")!;
    expect(involucro.className).toContain("w-full");
    expect(involucro.className).toContain("flex-row-reverse");
    expect(involucro.className).toContain("items-center");
  });
});
