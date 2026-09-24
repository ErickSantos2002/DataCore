import type { ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KeyRound } from "lucide-react";

import useNavGroups from "./Sidebar";
import { AuthContext } from "../context/AuthContext";

/**
 * O conteúdo do menu — rótulos, ordem, grupos e ícones.
 *
 * Quem garante que nenhum item aponta para tela bloqueada é
 * `Sidebar.invariante.test.tsx`, e ele faz isso sem enumerar item nenhum. Aqui
 * é o oposto: a enumeração, para que uma mudança de conteúdo apareça como
 * mudança de teste.
 */

type Usuario = { id: number; username: string; role: string } | null;

function wrapperPara(user: Usuario) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthContext.Provider
        value={{
          user,
          token: null,
          loading: false,
          login: vi.fn(),
          entrarComToken: vi.fn(),
          logout: vi.fn(),
          error: null,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  };
}

describe("useNavGroups", () => {
  it("monta os quatro grupos do design, na ordem e com os rotulos renomeados, para o admin", () => {
    const { result } = renderHook(() => useNavGroups(), {
      wrapper: wrapperPara({ id: 1, username: "erick", role: "admin" }),
    });

    expect(result.current.map((g) => g.label)).toEqual([
      "Principal",
      "Comercial",
      "Financeiro",
      "Administração",
    ]);
    // Estoque é rota livre; fica em Principal, com o resto do que todo mundo vê.
    expect(result.current[0].items.map((i) => i.label)).toEqual([
      "Início",
      "Meta do trimestre",
      "Estoque",
    ]);
    expect(result.current[1].items.map((i) => i.label)).toEqual([
      "Vendas",
      "Serviços",
      "Clientes",
      "Produtos",
      "Vendedores",
    ]);
    expect(result.current[2].items.map((i) => i.label)).toEqual([
      "Gerenciamento",
      "Contas a pagar",
      "Contas a receber",
      "Locação",
    ]);
    expect(result.current[3].items.map((i) => i.label)).toEqual([
      "Importações",
      "Usuários",
      "Configurações",
    ]);
  });

  it("usa o KeyRound do lucide para Locação, que não existe no ICON_PATHS do design system", () => {
    const { result } = renderHook(() => useNavGroups(), {
      wrapper: wrapperPara({ id: 1, username: "erick", role: "admin" }),
    });
    const financeiro = result.current.find((g) => g.label === "Financeiro");
    const locacao = financeiro?.items.find((i) => i.label === "Locação");
    expect(isValidElement(locacao?.icon)).toBe(true);
    expect((locacao?.icon as ReactElement).type).toBe(KeyRound);
  });

  it("some com os grupos inteiros de que o usuário não alcança nenhum item", () => {
    const { result } = renderHook(() => useNavGroups(), {
      wrapper: wrapperPara({ id: 99, username: "vendedor", role: "vendas" }),
    });
    expect(result.current.map((g) => g.label)).toEqual([
      "Principal",
      "Comercial",
    ]);
  });

  it("mostra Estoque em Principal mesmo para quem não tem papel nenhum conhecido", () => {
    const { result } = renderHook(() => useNavGroups(), {
      wrapper: wrapperPara({ id: 99, username: "visitante", role: "suporte" }),
    });
    expect(result.current.map((g) => g.label)).toEqual(["Principal"]);
    expect(result.current[0].items.map((i) => i.label)).toEqual([
      "Início",
      "Meta do trimestre",
      "Estoque",
    ]);
  });

  it("mostra só Contas a pagar/receber no grupo Financeiro pro papel financeiro sem o id nomeado", () => {
    const { result } = renderHook(() => useNavGroups(), {
      wrapper: wrapperPara({
        id: 99,
        username: "financeiro",
        role: "financeiro",
      }),
    });
    const financeiro = result.current.find((g) => g.label === "Financeiro");
    expect(financeiro?.items.map((i) => i.label)).toEqual([
      "Contas a pagar",
      "Contas a receber",
    ]);
  });

  it("mostra só Serviços no grupo Comercial pro papel servicos", () => {
    const { result } = renderHook(() => useNavGroups(), {
      wrapper: wrapperPara({ id: 99, username: "tecnico", role: "servicos" }),
    });
    const comercial = result.current.find((g) => g.label === "Comercial");
    expect(comercial?.items.map((i) => i.label)).toEqual(["Serviços"]);
  });
});
