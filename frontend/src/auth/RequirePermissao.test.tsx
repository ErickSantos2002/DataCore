import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import RequirePermissao from "./RequirePermissao";
import { AuthContext } from "../context/AuthContext";

/**
 * O guarda parametrizado que substituiu os seis guardas do `router.tsx`.
 *
 * Aqui se testa só o guarda: as três saídas que ele pode dar e a ordem entre
 * elas. Quem entra em cada rota é assunto da matriz (`permissoes.test.ts`) e do
 * app inteiro (`acesso-atual.test.tsx`) — este arquivo não repete a tabela.
 */

type Usuario = { id: number; username: string; role: string } | null;

function renderizar(rota: string, user: Usuario, loading = false) {
  const filho = <p>conteudo protegido</p>;

  return render(
    <AuthContext.Provider
      value={{
        user,
        token: user ? "token-de-teste" : null,
        loading,
        login: vi.fn(),
        logout: vi.fn(),
        error: null,
      }}
    >
      <RequirePermissao rota={rota}>{filho as ReactNode}</RequirePermissao>
    </AuthContext.Provider>,
  );
}

const ADMIN: Usuario = { id: 10, username: "ana.admin", role: "admin" };
const VENDAS: Usuario = { id: 11, username: "vera.vendas", role: "vendas" };

describe("RequirePermissao", () => {
  it("renderiza o filho quando podeAcessar é verdadeiro", () => {
    renderizar("/usuarios", ADMIN);

    expect(screen.getByText("conteudo protegido")).toBeInTheDocument();
    expect(screen.queryByText(/Acesso negado/)).not.toBeInTheDocument();
  });

  it("renderiza o Bloqueio quando podeAcessar é falso", () => {
    renderizar("/usuarios", VENDAS);

    expect(screen.getByText("Acesso negado")).toBeInTheDocument();
    expect(screen.queryByText("conteudo protegido")).not.toBeInTheDocument();
  });

  it("nega rota que a matriz não conhece", () => {
    renderizar("/rota-que-nao-existe", ADMIN);

    expect(screen.getByText("Acesso negado")).toBeInTheDocument();
    expect(screen.queryByText("conteudo protegido")).not.toBeInTheDocument();
  });

  it("mostra o estado de carregando enquanto a sessão carrega", () => {
    // Quem espera a sessão é o guarda, não a matriz: `loading` vence antes de
    // qualquer consulta a `podeAcessar`, senão a rota pisca o bloqueio no
    // instante em que o usuário ainda não chegou do localStorage.
    renderizar("/usuarios", null, true);

    expect(screen.getByText(/Verificando permissões/)).toBeInTheDocument();
    expect(screen.queryByText("conteudo protegido")).not.toBeInTheDocument();
    expect(screen.queryByText("Acesso negado")).not.toBeInTheDocument();
  });

  it("mostra o estado de carregando mesmo com um usuário já em mãos", () => {
    renderizar("/usuarios", ADMIN, true);

    expect(screen.getByText(/Verificando permissões/)).toBeInTheDocument();
    expect(screen.queryByText("conteudo protegido")).not.toBeInTheDocument();
  });

  it("anuncia o carregando com o primitivo de status do Design System", () => {
    // O estado de carregando dos seis guardas antigos era `text-gray-500`
    // cru — cor fora do token e nada anunciado a leitor de tela.
    renderizar("/usuarios", ADMIN, true);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
