import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("alterna ao clicar no rotulo", async () => {
    render(<Checkbox label="Somente ativos" />);
    const caixa = screen.getByRole("checkbox", { name: "Somente ativos" });
    expect(caixa).not.toBeChecked();
    await userEvent.click(screen.getByText("Somente ativos"));
    expect(caixa).toBeChecked();
  });

  it("desabilitado nao alterna", async () => {
    render(<Checkbox label="Somente ativos" disabled />);
    await userEvent.click(screen.getByText("Somente ativos"));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("pinta o desenho a partir do estado real do campo, nao da prop", async () => {
    // Sem `checked` controlado (exatamente como o teste acima usa o
    // componente), o clique alterna o <input> real via comportamento nativo
    // do <label>, mas ninguem reatualiza uma prop `checked` — ela continua
    // `undefined` para sempre. Se o <span> desenhado tirar sua cor dessa
    // prop, a caixa fica marcada para o leitor de tela e vazia para o olho.
    // Este teste e fraco por natureza: o jsdom nao roda o pipeline do
    // Tailwind, entao ele nao prova que o pixel mudou — so que a classe
    // `peer-checked:*` (que le o :checked do DOM via CSS, nao a prop) esta
    // no elemento certo. E o maximo verificavel neste ambiente; a mecanica
    // e o que importa aqui, nao o pixel.
    render(<Checkbox label="Somente ativos" />);
    await userEvent.click(screen.getByText("Somente ativos"));
    const caixa = screen.getByRole("checkbox");
    expect(caixa).toBeChecked();
    expect(caixa.nextElementSibling?.className).toContain("peer-checked:bg-action");
  });
});
