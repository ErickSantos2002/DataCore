import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import AppRoutes from "./router";
import { AuthContext } from "./context/AuthContext";

/**
 * O fallback do `Suspense` que cobre as rotas.
 *
 * As páginas do `router.tsx` são `React.lazy`, então entre abrir a rota e a
 * tela aparecer existe um estado intermediário — o chunk ainda vindo pela rede.
 * Os outros testes de rota esperam esse estado passar, de propósito: o que eles
 * afirmam é sobre acesso. Este arquivo é o único que olha justamente para o
 * intervalo, e trava as duas pontas: o fallback aparece enquanto o módulo não
 * chegou, e some quando ele chega.
 *
 * Se alguém trocar o carregamento sob demanda por import estático, o primeiro
 * `expect` cai — e é essa a mudança que se quer ver.
 */

vi.mock("./pages/Login", () => ({ default: () => "pagina:/login" }));

describe("carregamento da página sob demanda", () => {
  it("mostra o fallback até o módulo da página chegar, e some depois", async () => {
    render(
      <AuthContext.Provider
        value={{
          user: null,
          token: null,
          loading: false,
          login: vi.fn(),
          entrarComToken: vi.fn(),
          logout: vi.fn(),
          error: null,
        }}
      >
        <MemoryRouter initialEntries={["/login"]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(screen.getByText("Carregando página...")).toBeInTheDocument();

    expect(await screen.findByText("pagina:/login")).toBeInTheDocument();
    expect(screen.queryByText("Carregando página...")).not.toBeInTheDocument();
  });
});
