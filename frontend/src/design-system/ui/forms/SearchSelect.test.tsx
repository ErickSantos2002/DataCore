import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchSelect } from "./SearchSelect";

const CLIENTES = [
  { value: "1", label: "CIMENTOS EXEMPLO S.A" },
  { value: "2", label: "QUIMICA EXEMPLO LTDA" },
];

describe("SearchSelect", () => {
  it("filtra as opcoes conforme se digita", async () => {
    render(<SearchSelect label="Cliente" options={CLIENTES} searchable />);
    await userEvent.click(screen.getByLabelText("Cliente"));
    await userEvent.keyboard("QUIM");
    expect(screen.getByText("QUIMICA EXEMPLO LTDA")).toBeVisible();
    expect(screen.queryByText("CIMENTOS EXEMPLO S.A")).not.toBeInTheDocument();
  });

  it("diz quando a busca nao acha nada, em frase completa", async () => {
    render(<SearchSelect label="Cliente" options={CLIENTES} searchable />);
    await userEvent.click(screen.getByLabelText("Cliente"));
    await userEvent.keyboard("zzzz");
    expect(screen.getByText("Nenhum resultado encontrado.")).toBeInTheDocument();
  });

  it("Esc fecha a lista e devolve o foco ao gatilho", async () => {
    render(<SearchSelect label="Cliente" options={CLIENTES} searchable />);
    const gatilho = screen.getByLabelText("Cliente");
    await userEvent.click(gatilho);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(gatilho).toHaveFocus();
  });

  it("seta para baixo e Enter escolhem uma opcao", async () => {
    const aoMudar = vi.fn();
    render(
      <SearchSelect label="Cliente" options={CLIENTES} searchable={false} onChange={aoMudar} />,
    );
    const gatilho = screen.getByLabelText("Cliente");
    gatilho.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(aoMudar).toHaveBeenCalledWith("2");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("clicar fora fecha a lista", async () => {
    render(<SearchSelect label="Cliente" options={CLIENTES} searchable />);
    await userEvent.click(screen.getByLabelText("Cliente"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    // `mouseDown`, e não `click`: o componente fecha no `mousedown` do
    // documento. `fireEvent.click` não dispara `mousedown`, entao o teste
    // passaria mesmo com o listener removido.
    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
