import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ModalObservacoes from "./ModalObservacoes";

/**
 * O modal de observações que recebe o texto pronto — o de Serviços.
 *
 * Gêmeo de `ModalObservacoesDaNota`, que busca o texto ao abrir. O que se
 * trava aqui é o que ele mostra e o que ele é: até 15/09/2026 era um
 * `<div className="fixed inset-0">` à mão, sem `role="dialog"`, sem nome
 * acessível, sem Escape e sem prender o foco.
 */

describe("ModalObservacoes", () => {
  it("mostra o texto que recebe, num dialogo com nome", () => {
    render(
      <ModalObservacoes
        observacoes="Entregue na portaria."
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Observações da Nota" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Entregue na portaria.")).toBeInTheDocument();
  });

  it("sem observacao, nao desenha nada", () => {
    render(<ModalObservacoes observacoes={null} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Escape fecha", () => {
    const fechar = vi.fn();
    render(<ModalObservacoes observacoes="Texto." onClose={fechar} />);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(fechar).toHaveBeenCalled();
  });

  it("o x do cabecalho fecha", () => {
    const fechar = vi.fn();
    render(<ModalObservacoes observacoes="Texto." onClose={fechar} />);

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(fechar).toHaveBeenCalled();
  });
});
