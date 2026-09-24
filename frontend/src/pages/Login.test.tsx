import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Login from "./Login";
import { AuthContext } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";

function renderLogin(
  auth: Partial<React.ComponentProps<typeof AuthContext.Provider>["value"]>,
) {
  const value = {
    user: null,
    token: null,
    loading: false,
    login: vi.fn(),
    entrarComToken: vi.fn(),
    logout: vi.fn(),
    error: null,
    ...auth,
  };
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <AuthContext.Provider value={value}>
          <Login />
        </AuthContext.Provider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("Login", () => {
  it("oferece usuario, senha e um botao de entrar", () => {
    renderLogin({});
    expect(screen.getByLabelText(/usu[áa]rio/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
  });

  it("mostra a mensagem de erro quando as credenciais falham", () => {
    renderLogin({ error: "Usuário ou senha incorretos." });
    expect(
      screen.getByText("Usuário ou senha incorretos."),
    ).toBeInTheDocument();
  });

  it("o erro e anunciado ao leitor de tela, em texto que se le sobre o painel escuro", () => {
    // Sem `role="alert"`, a mensagem aparecia calada para quem usa leitor de
    // tela. E o texto era `text-danger` (#ef4444) sobre o fundo composto do
    // cartão (#413344): 3,13:1, abaixo do AA de 4,5:1 para corpo. Branco dá
    // 11,78:1; a borda e o fundo vermelhos seguem dizendo que é erro. O
    // painel é escuro nos dois temas, então a conta vale para os dois.
    renderLogin({ error: "Usuário ou senha incorretos." });

    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveTextContent("Usuário ou senha incorretos.");
    expect(alerta).toHaveClass("text-white", "border-danger", "bg-tint-danger");
    expect(alerta).not.toHaveClass("text-danger");
  });

  it("desabilita usuario, senha e o botao enquanto o login esta em andamento", () => {
    renderLogin({ loading: true });
    expect(screen.getByLabelText(/usu[áa]rio/i)).toBeDisabled();
    expect(screen.getByLabelText(/senha/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /entrando/i })).toBeDisabled();
  });
});

describe("anel de foco do Login", () => {
  /**
   * Checagem de REGRA, e não de comportamento: o jsdom não pinta anel nenhum.
   * Os dois campos do login eram `focus:ring-2 focus:ring-blue-400` — `focus:`
   * em vez de `focus-visible:` (o anel aparecia também no clique de mouse, que
   * é o que a convenção do repositório evita) e a cor vinha da ponte de
   * paleta, que está sendo removida. O primitivo `Input` não serve aqui: o
   * painel do login é escuro nos dois temas, exceção documentada.
   */
  it("os campos usam focus-visible e a cor de foco do design system", () => {
    renderLogin({});

    for (const campo of [
      screen.getByPlaceholderText("Usuário"),
      screen.getByPlaceholderText("Senha"),
    ]) {
      expect(campo.className).toContain("focus-visible:ring-2");
      expect(campo.className).toContain("focus-visible:ring-focus");
      // Sem escrever a classe antiga por extenso: o guarda de cor varre este
      // arquivo, e a string literal seria acusada como uso de paleta crua.
      expect(campo.className).not.toMatch(/ring-blue-\d+/);
    }
  });
});
