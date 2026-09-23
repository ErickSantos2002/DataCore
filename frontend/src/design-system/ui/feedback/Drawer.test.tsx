import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Drawer, DrawerFooter } from "./Drawer";

describe("Drawer", () => {
  it("nao renderiza nada quando fechado", () => {
    render(
      <Drawer open={false} onClose={() => {}} title="Pedido #1234">
        conteúdo
      </Drawer>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("se anuncia como dialogo, com titulo", () => {
    render(
      <Drawer open onClose={() => {}} title="Pedido #1234">
        conteúdo
      </Drawer>,
    );
    expect(screen.getByRole("dialog", { name: "Pedido #1234" })).toBeInTheDocument();
  });

  it("renderiza o status como Badge no cabecalho", () => {
    render(
      <Drawer
        open
        onClose={() => {}}
        title="Pedido #1234"
        status={{ label: "Faturado", variant: "success" }}
      >
        conteúdo
      </Drawer>,
    );
    expect(screen.getByText("Faturado")).toBeInTheDocument();
  });

  it("DrawerFooter renderiza secundario a esquerda e acao a direita, ambos clicaveis", async () => {
    const aoSecundario = vi.fn();
    const aoAgir = vi.fn();
    const usuario = userEvent.setup();
    render(
      <Drawer open onClose={() => {}} title="Pedido #1234">
        <DrawerFooter
          secondaryLabel="Cancelar"
          onSecondary={aoSecundario}
          actionLabel="Salvar"
          onAction={aoAgir}
        />
      </Drawer>,
    );
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(aoSecundario).toHaveBeenCalled();
    await usuario.click(screen.getByRole("button", { name: "Salvar" }));
    expect(aoAgir).toHaveBeenCalled();
  });

  it("Esc fecha", async () => {
    const aoFechar = vi.fn();
    render(
      <Drawer open onClose={aoFechar} title="Pedido #1234">
        conteúdo
      </Drawer>,
    );
    await userEvent.keyboard("{Escape}");
    expect(aoFechar).toHaveBeenCalled();
  });

  it("clicar na cortina fecha", async () => {
    const aoFechar = vi.fn();
    const usuario = userEvent.setup();
    render(
      <Drawer open onClose={aoFechar} title="Pedido #1234">
        conteúdo
      </Drawer>,
    );
    // A cortina é aria-hidden e decorativa — pega pelo container, não por role.
    const cortina = document.querySelector('[aria-hidden="true"]');
    expect(cortina).not.toBeNull();
    await usuario.click(cortina as Element);
    expect(aoFechar).toHaveBeenCalled();
  });

  it("o role=dialog fica no painel, nao no envolvente que inclui a cortina", () => {
    render(
      <Drawer open onClose={() => {}} title="Pedido #1234">
        conteúdo
      </Drawer>,
    );
    const dialogo = screen.getByRole("dialog");
    const cortina = document.querySelector('[aria-hidden="true"]');
    expect(cortina).not.toBeNull();
    // A prova que importa: o nó com role="dialog" não contém a cortina.
    // Se role="dialog" estivesse no envolvente (que inclui a cortina), esta
    // asserção falharia — e "foco está dentro do diálogo" responderia sim
    // trivialmente, mesmo sem prisão de foco nenhuma.
    expect(dialogo.contains(cortina)).toBe(false);
  });

  it("prende o foco nas duas direcoes: Tab do ultimo volta ao primeiro, Shift+Tab do primeiro vai ao ultimo", async () => {
    const usuario = userEvent.setup();
    render(
      <Drawer open onClose={() => {}} title="Pedido #1234">
        <DrawerFooter
          secondaryLabel="Cancelar"
          onSecondary={() => {}}
          actionLabel="Salvar"
          onAction={() => {}}
        />
      </Drawer>,
    );
    const dialogo = screen.getByRole("dialog");
    const botaoFechar = screen.getByRole("button", { name: "Fechar" });
    const cancelar = screen.getByRole("button", { name: "Cancelar" });
    const salvar = screen.getByRole("button", { name: "Salvar" });

    // O foco entra no painel ao abrir.
    expect(dialogo).toHaveFocus();

    await usuario.tab();
    expect(botaoFechar).toHaveFocus();
    await usuario.tab();
    expect(cancelar).toHaveFocus();
    await usuario.tab();
    expect(salvar).toHaveFocus();
    // Do último, Tab volta ao primeiro.
    await usuario.tab();
    expect(botaoFechar).toHaveFocus();

    // Shift+Tab do primeiro vai ao último.
    await usuario.tab({ shift: true });
    expect(salvar).toHaveFocus();
  });

  it("devolve o foco a quem abriu, ao fechar", async () => {
    const usuario = userEvent.setup();

    function Fixture() {
      const [aberto, setAberto] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setAberto(true)}>
            Abrir
          </button>
          <Drawer open={aberto} onClose={() => setAberto(false)} title="Pedido #1234">
            conteúdo
          </Drawer>
        </>
      );
    }

    render(<Fixture />);
    const gatilho = screen.getByRole("button", { name: "Abrir" });

    // Clicar no gatilho o deixa focado e abre o Drawer — o efeito de
    // abertura guarda esse elemento como o foco a restaurar.
    await usuario.click(gatilho);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(gatilho).toHaveFocus();
  });
});
