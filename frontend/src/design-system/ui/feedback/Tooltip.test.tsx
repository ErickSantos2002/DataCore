import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("aparece ao focar o gatilho, nao so ao passar o mouse", async () => {
    render(
      <Tooltip label="Recolher menu">
        <button type="button">Menu</button>
      </Tooltip>,
    );
    await userEvent.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Recolher menu");
  });

  it("renderiza o balao fora da arvore do gatilho, para nao ser recortado", async () => {
    // Checar `gatilho.contains(balao)` (gatilho = o <button>) nao prova nada:
    // botao e balao sempre foram irmaos dentro do `span.group`, nunca
    // pai/filho, entao essa comparacao seria verdadeira com ou sem portal.
    // Quem precisa parar de conter o balao e a caixa que recorta — o
    // ancestral com `overflow: hidden` — que e exatamente quem escondia o
    // tooltip na sidebar recolhida.
    render(
      <div data-testid="caixa-recorte" style={{ overflow: "hidden", width: 72 }}>
        <Tooltip label="Recolher menu">
          <button type="button">Menu</button>
        </Tooltip>
      </div>,
    );
    await userEvent.tab();
    const balao = await screen.findByRole("tooltip");
    const caixaQueRecorta = screen.getByTestId("caixa-recorte");
    expect(caixaQueRecorta.contains(balao)).toBe(false);
    expect(document.body.contains(balao)).toBe(true);
  });
});
