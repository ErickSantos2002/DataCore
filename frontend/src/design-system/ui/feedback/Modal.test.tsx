import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Modal, ModalFooter } from "./Modal";
import { Button } from "../core/Button";

describe("Modal", () => {
  it("nao renderiza nada quando fechado", () => {
    render(
      <Modal open={false} onClose={() => {}} title="Trocar senha">
        conteúdo
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("se anuncia como dialogo modal, com titulo", () => {
    render(
      <Modal open onClose={() => {}} title="Trocar senha">
        conteúdo
      </Modal>,
    );
    expect(screen.getByRole("dialog", { name: "Trocar senha" })).toBeInTheDocument();
  });

  it("Esc fecha", async () => {
    const aoFechar = vi.fn();
    render(
      <Modal open onClose={aoFechar} title="Trocar senha">
        conteúdo
      </Modal>,
    );
    await userEvent.keyboard("{Escape}");
    expect(aoFechar).toHaveBeenCalled();
  });

  it("prende o foco dentro dele", async () => {
    render(
      <Modal open onClose={() => {}} title="Trocar senha">
        <ModalFooter>
          <Button variant="secondary">Cancelar</Button>
          <Button>Salvar</Button>
        </ModalFooter>
      </Modal>,
    );
    const dialogo = screen.getByRole("dialog");
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(dialogo.contains(document.activeElement)).toBe(true);
  });

  it("desenha a mensagem de erro do proprio dialogo, e nada quando nao ha erro", () => {
    const { rerender } = render(
      <Modal open onClose={() => {}} title="Novo usuário">
        conteúdo
      </Modal>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(
      <Modal open onClose={() => {}} title="Novo usuário" erro="Informe um nome de usuário.">
        conteúdo
      </Modal>,
    );
    const aviso = screen.getByRole("alert");
    expect(aviso).toHaveTextContent("Informe um nome de usuário.");
    // Dentro do painel, e não solto na página: é o erro DESTE diálogo.
    expect(screen.getByRole("dialog").contains(aviso)).toBe(true);
  });

  it("trava a rolagem do fundo enquanto esta aberto, e devolve ao fechar", () => {
    document.body.style.overflow = "auto";
    const { rerender } = render(
      <Modal open onClose={() => {}} title="Trocar senha">
        conteúdo
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Modal open={false} onClose={() => {}} title="Trocar senha">
        conteúdo
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("auto");
  });

  it("nao monta o conteudo enquanto esta fechado", async () => {
    // A garantia em que se apoia o padrao de "monte o dialogo so quando
    // aberto": fechado, o Modal nem chega a renderizar os filhos, entao o
    // estado deles nao sobrevive de uma abertura para a outra.
    let montagens = 0;
    function Campo() {
      montagens += 1;
      return <input aria-label="Nova senha" type="password" />;
    }

    const { rerender } = render(
      <Modal open={false} onClose={() => {}} title="Trocar senha">
        <Campo />
      </Modal>,
    );
    expect(montagens).toBe(0);

    rerender(
      <Modal open onClose={() => {}} title="Trocar senha">
        <Campo />
      </Modal>,
    );
    await userEvent.type(screen.getByLabelText("Nova senha"), "segredo");
    expect(screen.getByLabelText("Nova senha")).toHaveValue("segredo");

    rerender(
      <Modal open={false} onClose={() => {}} title="Trocar senha">
        <Campo />
      </Modal>,
    );
    rerender(
      <Modal open onClose={() => {}} title="Trocar senha">
        <Campo />
      </Modal>,
    );
    expect(screen.getByLabelText("Nova senha")).toHaveValue("");
  });
});
