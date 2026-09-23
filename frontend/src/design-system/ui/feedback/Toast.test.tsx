import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toast, ToastStack } from "./Toast";

describe("Toast", () => {
  it("se anuncia sem roubar o foco de quem esta digitando", () => {
    render(<Toast variant="error">As senhas não coincidem.</Toast>);
    const aviso = screen.getByRole("status");
    expect(aviso).toHaveTextContent("As senhas não coincidem.");
    expect(aviso).toHaveAttribute("aria-live", "polite");
  });

  it("sem onClose, nao mostra botao de fechar", () => {
    render(<Toast variant="info">Aviso.</Toast>);
    expect(screen.queryByRole("button", { name: "Fechar" })).not.toBeInTheDocument();
  });

  it("com onClose, o botao de fechar chama o callback", async () => {
    const aoFechar = vi.fn();
    render(
      <Toast variant="success" onClose={aoFechar}>
        Senha alterada.
      </Toast>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});

describe("ToastStack", () => {
  it("empilha os toasts filhos", () => {
    render(
      <ToastStack>
        <Toast variant="success">Um.</Toast>
        <Toast variant="error">Dois.</Toast>
      </ToastStack>,
    );
    const avisos = screen.getAllByRole("status");
    expect(avisos).toHaveLength(2);
  });
});
