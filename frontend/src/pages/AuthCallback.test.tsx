import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AuthCallback from "./AuthCallback";
import { AuthContext } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";

vi.mock("../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
  trocarTicket: vi.fn(),
  consumirNonceSso: vi.fn(),
}));
import { consumirNonceSso, trocarTicket } from "../services/api";

function montar(
  rota: string,
  entrarComToken = vi.fn().mockResolvedValue(undefined),
  estrito = false,
) {
  const value = {
    user: null,
    token: null,
    loading: false,
    login: vi.fn(),
    entrarComToken,
    logout: vi.fn(),
    error: null,
  };
  const arvore = (
    <MemoryRouter initialEntries={[rota]}>
      <ThemeProvider>
        <AuthContext.Provider value={value}>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/inicio" element={<p>pagina:/inicio</p>} />
            <Route path="/login" element={<p>pagina:/login</p>} />
          </Routes>
        </AuthContext.Provider>
      </ThemeProvider>
    </MemoryRouter>
  );
  render(estrito ? <StrictMode>{arvore}</StrictMode> : arvore);
  return { entrarComToken };
}

beforeEach(() => {
  vi.mocked(trocarTicket).mockReset();
  vi.mocked(consumirNonceSso).mockReset().mockReturnValue(true);
});

describe("AuthCallback", () => {
  it("troca o ticket, abre a sessao e vai para o inicio", async () => {
    vi.mocked(trocarTicket).mockResolvedValue("tok-sso");
    const { entrarComToken } = montar("/auth/callback?ticket=tic-1");
    expect(await screen.findByText("pagina:/inicio")).toBeInTheDocument();
    expect(trocarTicket).toHaveBeenCalledWith("tic-1");
    expect(entrarComToken).toHaveBeenCalledWith("tok-sso");
  });

  it("em StrictMode troca o ticket uma vez so", async () => {
    vi.mocked(trocarTicket).mockResolvedValue("tok-sso");
    montar("/auth/callback?ticket=tic-1", undefined, true);
    await screen.findByText("pagina:/inicio");
    expect(trocarTicket).toHaveBeenCalledTimes(1);
  });

  it("ticket recusado mostra o erro e o caminho de volta", async () => {
    vi.mocked(trocarTicket).mockRejectedValue(new Error("400"));
    montar("/auth/callback?ticket=velho");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Link de acesso inválido ou expirado.",
    );
    expect(
      screen.getByRole("link", { name: /voltar para o login/i }),
    ).toHaveAttribute("href", "/login");
  });

  it("sem ticket nem tenta trocar", async () => {
    montar("/auth/callback");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Link de acesso inválido ou expirado.",
    );
    expect(trocarTicket).not.toHaveBeenCalled();
  });

  it("sem o nonce deste navegador recusa o ticket sem trocar", async () => {
    // Link de outra pessoa (login CSRF): o ticket e valido, mas nao foi este
    // navegador que clicou em "Entrar com Microsoft".
    vi.mocked(consumirNonceSso).mockReturnValue(false);
    montar("/auth/callback?ticket=tic-alheio");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Link de acesso inválido ou expirado.",
    );
    expect(trocarTicket).not.toHaveBeenCalled();
  });

  it("se abrir a sessao falha, mostra o erro em vez de entrar", async () => {
    vi.mocked(trocarTicket).mockResolvedValue("tok-sso");
    montar(
      "/auth/callback?ticket=tic-1",
      vi.fn().mockRejectedValue(new Error("me caiu")),
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("pagina:/inicio")).not.toBeInTheDocument(),
    );
  });
});
