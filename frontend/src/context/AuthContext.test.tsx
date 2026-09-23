import { act, render, screen } from "@testing-library/react";
import { AxiosError } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "./AuthContext";
import { useAuth } from "../hooks/useAuth";
import { criarHttp } from "../services/http";

/**
 * A sessão salva, lida ao abrir o app.
 *
 * Era lida num `useEffect`: o primeiro render saía SEMPRE com `user` nulo e
 * `loading` ligado, mesmo com a sessão no `localStorage`, e só o efeito
 * corrigia no render seguinte — um render a mais em que o app inteiro achava
 * que ninguém estava logado. Agora a sessão sai do estado inicial.
 */

vi.mock("../services/api", () => ({
  default: { post: vi.fn(), get: vi.fn() },
}));

/** Anota o que cada render do consumidor viu. */
function Espiao({ vistos }: { vistos: string[] }) {
  const { user, loading, token } = useAuth();
  vistos.push(
    `${loading ? "carregando" : "pronto"}:${user?.username ?? "-"}:${token ?? "-"}`,
  );
  return <p>{user ? `Logado como ${user.username}` : "Sem sessão"}</p>;
}

afterEach(() => {
  localStorage.clear();
});

describe("sessao salva no AuthContext", () => {
  it("com a sessao no localStorage, ja o primeiro render tem o usuario", () => {
    localStorage.setItem("access_token", "tok-123");
    localStorage.setItem("id", "4");
    localStorage.setItem("username", "erick");
    localStorage.setItem("role", "admin");
    const vistos: string[] = [];

    render(
      <AuthProvider>
        <Espiao vistos={vistos} />
      </AuthProvider>,
    );

    expect(screen.getByText("Logado como erick")).toBeInTheDocument();
    expect(vistos[0]).toBe("pronto:erick:tok-123");
    expect(vistos.every((v) => v === "pronto:erick:tok-123")).toBe(true);
  });

  it("sem sessao, nao ha usuario e nao fica carregando", () => {
    const vistos: string[] = [];

    render(
      <AuthProvider>
        <Espiao vistos={vistos} />
      </AuthProvider>,
    );

    expect(screen.getByText("Sem sessão")).toBeInTheDocument();
    expect(vistos[0]).toBe("pronto:-:-");
  });

  it("sessao pela metade nao conta como sessao", () => {
    // Só o token, sem id, nome e papel: é como o app fica quando o login
    // falha no meio, depois de gravar o token e antes do /me.
    localStorage.setItem("access_token", "tok-123");
    const vistos: string[] = [];

    render(
      <AuthProvider>
        <Espiao vistos={vistos} />
      </AuthProvider>,
    );

    expect(screen.getByText("Sem sessão")).toBeInTheDocument();
    expect(vistos[vistos.length - 1]).toBe("pronto:-:-");
  });
});

/**
 * Sessão expirada: um 401 numa chamada com token derruba a sessão.
 *
 * Passa pelo `criarHttp` de verdade — é ele que reconhece o 401 —, com o
 * transporte trocado por um que sempre recusa. O que se confere é o efeito na
 * sessão: sem usuário (o `ProtectedRoute` manda para o /login), sem nada no
 * `localStorage` e com a frase que a tela de login mostra.
 */
describe("sessao expirada no AuthContext", () => {
  function EspiaoDeErro() {
    const { user, error } = useAuth();
    return (
      <>
        <p>{user ? `Logado como ${user.username}` : "Sem sessão"}</p>
        <p>{error ?? "sem erro"}</p>
      </>
    );
  }

  it("401 com token limpa a sessao e deixa o aviso para o login", async () => {
    localStorage.setItem("access_token", "tok-velho");
    localStorage.setItem("id", "4");
    localStorage.setItem("username", "erick");
    localStorage.setItem("role", "admin");

    render(
      <AuthProvider>
        <EspiaoDeErro />
      </AuthProvider>,
    );
    expect(screen.getByText("Logado como erick")).toBeInTheDocument();

    const http = criarHttp("https://exemplo.test");
    http.defaults.adapter = async (config) => {
      throw new AxiosError("401", "ERR_BAD_REQUEST", config, null, {
        data: { detail: "Token inválido ou expirado." },
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        config,
      });
    };
    await act(async () => {
      await http.get("/notas_fiscais/").catch(() => undefined);
    });

    expect(screen.getByText("Sem sessão")).toBeInTheDocument();
    expect(
      screen.getByText("Sua sessão expirou. Entre de novo."),
    ).toBeInTheDocument();
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("id")).toBeNull();
  });
});
