import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renderiza o rotulo com papel de botao", () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
  });

  it("loading desabilita o clique junto com o spinner", async () => {
    const aoClicar = vi.fn();
    render(
      <Button loading onClick={aoClicar}>
        Salvar
      </Button>,
    );
    const botao = screen.getByRole("button");
    expect(botao).toBeDisabled();
    await userEvent.click(botao);
    expect(aoClicar).not.toHaveBeenCalled();
  });

  it("disabled tambem bloqueia o clique", async () => {
    const aoClicar = vi.fn();
    render(
      <Button disabled onClick={aoClicar}>
        Salvar
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(aoClicar).not.toHaveBeenCalled();
  });

  it("clica quando esta livre", async () => {
    const aoClicar = vi.fn();
    render(<Button onClick={aoClicar}>Salvar</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(aoClicar).toHaveBeenCalledOnce();
  });

  it("repassa atributos nativos de botao", () => {
    render(<Button type="submit">Enviar</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("o spinner herda a cor do texto da variante, nao a cor de acao", () => {
    render(
      <Button variant="danger" loading>
        Excluir
      </Button>,
    );
    expect(screen.getByRole("status").className).toContain("!text-on-danger");
  });
});
