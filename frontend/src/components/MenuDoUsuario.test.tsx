import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MenuDoUsuario from "./MenuDoUsuario";

/**
 * O menu do usuário da topbar.
 *
 * Até 16/09/2026 o tema e o "Sair" ficavam soltos na topbar, e o avatar com
 * nome e papel era texto fixo, sem ação. Agora o avatar é o gatilho: abre um
 * painel com quem está logado, o interruptor de tema e o Sair — o desenho do
 * header do HelpHS.
 */

const { ESTADO } = vi.hoisted(() => ({
  ESTADO: { logout: vi.fn(), alternarTema: vi.fn(), navegou: [] as string[] },
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ logout: ESTADO.logout }),
}));

vi.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ darkMode: false, toggleDarkMode: ESTADO.alternarTema }),
}));

vi.mock("react-router-dom", async (original) => {
  const real = await original<typeof import("react-router-dom")>();
  return {
    ...real,
    useNavigate: () => (rota: string) => ESTADO.navegou.push(rota),
  };
});

beforeEach(() => {
  ESTADO.logout = vi.fn();
  ESTADO.alternarTema = vi.fn();
  ESTADO.navegou.length = 0;
});

function montar() {
  return render(
    <MemoryRouter>
      <MenuDoUsuario usuario={{ name: "erick", role: "admin" }} />
    </MemoryRouter>,
  );
}

const gatilho = () =>
  screen.getByRole("button", { name: "Menu do usuário — erick" });

/** O painel, pelo id que o `aria-controls` do gatilho aponta. Não é
 *  `getByRole("menu")`: o painel não é um menu ARIA de propósito — esse papel
 *  promete navegação por seta entre `menuitem`s, que não existe aqui, e o
 *  interruptor de tema não é item de menu. */
const painel = () =>
  document.getElementById(
    gatilho().getAttribute("aria-controls") ?? "",
  ) as HTMLElement | null;

describe("MenuDoUsuario", () => {
  it("fechado, mostra quem esta logado e nada mais", () => {
    montar();

    expect(gatilho()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("erick")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(painel()).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Sair" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("o clique na foto abre o painel, com o tema e o Sair dentro", () => {
    montar();

    fireEvent.click(gatilho());

    expect(gatilho()).toHaveAttribute("aria-expanded", "true");
    expect(painel()).toHaveTextContent("erick");
    expect(painel()).toHaveTextContent("admin");
    expect(
      screen.getByRole("switch", { name: "Modo escuro" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });

  it("o interruptor de dentro do painel alterna o tema", () => {
    montar();
    fireEvent.click(gatilho());

    fireEvent.click(screen.getByRole("switch", { name: "Modo escuro" }));

    expect(ESTADO.alternarTema).toHaveBeenCalledTimes(1);
  });

  it("Sair desloga e volta para o login", () => {
    montar();
    fireEvent.click(gatilho());

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(ESTADO.logout).toHaveBeenCalledTimes(1);
    expect(ESTADO.navegou).toEqual(["/login"]);
  });

  it("clicar de novo na foto fecha", () => {
    montar();
    fireEvent.click(gatilho());
    fireEvent.click(gatilho());

    expect(painel()).toBeNull();
  });

  it("Escape fecha e devolve o foco a foto", () => {
    // Fechar sem devolver o foco deixa quem navega por teclado no começo do
    // documento: o elemento focado saiu da árvore e o navegador recua para o
    // body.
    montar();
    fireEvent.click(gatilho());

    fireEvent.keyDown(document, { key: "Escape" });

    expect(painel()).toBeNull();
    expect(gatilho()).toHaveFocus();
  });

  it("no celular so a foto aparece, e o gatilho continua com nome", () => {
    // Nome e papel empurravam a topbar para fora dos 390px, então somem em
    // tela pequena — o nome acessível do gatilho vem do `aria-label`, e não
    // do texto que sumiu. Herdado do teste que o "Sair" tinha quando morava
    // solto na topbar com o texto escondido no celular.
    montar();

    const nome = screen.getByText("erick");
    expect(nome.parentElement).toHaveClass("hidden", "sm:block");
    expect(gatilho()).toHaveAccessibleName("Menu do usuário — erick");
  });

  it("clicar fora fecha", () => {
    montar();
    fireEvent.click(gatilho());

    fireEvent.mouseDown(document.body);

    expect(painel()).toBeNull();
  });
});
