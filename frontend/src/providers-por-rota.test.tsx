import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

import AppRoutes from "./router";
import { AuthContext } from "./context/AuthContext";

/**
 * Cada context é montado só no ramo de rota que o consome.
 *
 * Até a Fase 2 o `main.tsx` empilhava dez providers em volta do aplicativo
 * inteiro: quem abria a tela de login montava `EstoqueProvider`,
 * `DataProvider`, `ContasPagarProvider` e mais sete, cada um disparando a
 * própria carga de dados que aquela tela nunca ia usar.
 *
 * O que este arquivo trava é os dois lados da afirmação, porque só a metade
 * "não monta" passaria de graça se alguém apagasse um provider de que uma tela
 * depende: para cada rota, o conjunto de providers montados é **exatamente** o
 * conjunto que as páginas daquele ramo consomem — nem a mais, nem a menos.
 *
 * O consumidor de cada context foi levantado com `grep`, não pelo nome:
 *
 * | Context        | Quem chama o hook                                          |
 * |----------------|------------------------------------------------------------|
 * | Estoque        | `pages/Estoque`                                            |
 * | Servicos       | `pages/Servicos`                                           |
 * | ContasPagar    | `pages/ContasPagar`, `pages/GerenciamentoFinanceiro`       |
 * | ContasReceber  | `pages/ContasReceber`, `pages/GerenciamentoFinanceiro`     |
 * | Configuracoes  | `pages/Configuracoes`, `pages/Dashboard`, `components/MetaTab` |
 * | Dashboard      | `pages/Dashboard`, `components/MetaTab`                    |
 *
 * `components/MetaTab` só é renderizado por `pages/GerenciamentoFinanceiro`, o
 * que faz `/financeiro` herdar `Configuracoes` e `Dashboard` além dos quatro
 * próprios. `ThemeProvider` e `AuthProvider` não aparecem aqui: são globais de
 * verdade e continuam no `main.tsx`.
 */

const montados = vi.hoisted(() => new Set<string>());

/** Um provider que só existe para anotar que foi montado. */
function espiao(nome: string) {
  return ({ children }: { children: React.ReactNode }) => {
    montados.add(nome);
    return <>{children}</>;
  };
}

vi.mock("./context/EstoqueContext", () => ({
  EstoqueProvider: espiao("Estoque"),
}));
vi.mock("./context/ContasPagarContext", () => ({
  ContasPagarProvider: espiao("ContasPagar"),
}));
vi.mock("./context/ConfiguracoesContext", () => ({
  ConfiguracoesProvider: espiao("Configuracoes"),
}));
vi.mock("./context/DashboardContext", () => ({
  DashboardProvider: espiao("Dashboard"),
}));

vi.mock("./pages/Login", () => ({ default: () => "pagina:/login" }));
vi.mock("./pages/Home", () => ({ default: () => "pagina:/inicio" }));
vi.mock("./pages/Dashboard", () => ({ default: () => "pagina:/dashboard" }));
vi.mock("./pages/Estoque", () => ({ default: () => "pagina:/estoque" }));
vi.mock("./pages/Clientes", () => ({ default: () => "pagina:/clientes" }));
vi.mock("./pages/Vendas", () => ({ default: () => "pagina:/vendas" }));
vi.mock("./pages/Produtos", () => ({ default: () => "pagina:/produtos" }));
vi.mock("./pages/Vendedores", () => ({ default: () => "pagina:/vendedores" }));
vi.mock("./pages/Servicos", () => ({ default: () => "pagina:/servicos" }));
vi.mock("./pages/ContasPagar", () => ({
  default: () => "pagina:/contas-pagar",
}));
vi.mock("./pages/ContasReceber", () => ({
  default: () => "pagina:/contas-receber",
}));
vi.mock("./pages/Usuarios", () => ({ default: () => "pagina:/usuarios" }));
vi.mock("./pages/Configuracoes", () => ({
  default: () => "pagina:/configuracoes",
}));
vi.mock("./pages/GerenciamentoFinanceiro", () => ({
  default: () => "pagina:/financeiro",
}));
vi.mock("./pages/Locacao", () => ({ default: () => "pagina:/locacao" }));
vi.mock("./pages/NotFound", () => ({ default: () => "pagina:404" }));

/**
 * `admin` de id 1 abre tudo: o portão nominal de `/financeiro` e `/locacao`
 * também aceita esse id. Com um usuário mais fraco a rota bloqueada nunca
 * chegaria a montar os providers, e o teste passaria dizendo o contrário do
 * que quer dizer.
 */
const ADMIN = { id: 1, username: "ana.admin", role: "admin" };

async function providersMontadosEm(rota: string): Promise<string[]> {
  montados.clear();

  render(
    <AuthContext.Provider
      value={{
        user: ADMIN,
        token: "token-de-teste",
        loading: false,
        login: vi.fn(),
        entrarComToken: vi.fn(),
        logout: vi.fn(),
        error: null,
      }}
    >
      <MemoryRouter initialEntries={[rota]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthContext.Provider>,
  );

  // Espera a página aparecer: com `lazy`, ela só chega depois do Suspense.
  await screen.findByText(/^pagina:/);

  return [...montados].sort();
}

const ESPERADO: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["/login", []],
  ["/inicio", []],
  ["/locacao", []],
  ["/usuarios", []],
  ["/estoque", ["Estoque"]],
  ["/clientes", []],
  ["/vendas", []],
  ["/produtos", []],
  ["/vendedores", []],
  ["/servicos", []],
  ["/contas-pagar", []],
  ["/contas-receber", []],
  ["/configuracoes", ["Configuracoes"]],
  ["/dashboard", ["Configuracoes", "Dashboard"]],
  // Servicos e Vendas saíram daqui quando a tela passou a ler o faturamento
  // já somado de `GET /faturamento/mensal`: as duas séries por ano e mês vêm
  // da mesma requisição, e o `VendasContext` — que existia só para esta
  // tela — deixou de existir.
  // O `ContasReceber` saiu de `/financeiro` em 2026-09-09: a tela nunca leu os
  // dados, e o provider existia para propagar a falha de uma busca de 11,2 MB.
  // O `ContasPagar` fica enquanto o balancete somar os custos no navegador.
  ["/financeiro", ["Configuracoes", "ContasPagar", "Dashboard"]],
];

describe("providers montados por rota", () => {
  beforeEach(() => montados.clear());

  it("a tela de login não monta provider nenhum", async () => {
    const montadosNoLogin = await providersMontadosEm("/login");

    expect(montadosNoLogin).not.toContain("Estoque");
    expect(montadosNoLogin).toEqual([]);
  });

  for (const [rota, esperado] of ESPERADO) {
    it(`${rota} monta [${esperado.join(", ") || "nenhum"}]`, async () => {
      expect(await providersMontadosEm(rota)).toEqual([...esperado].sort());
    });
  }
});
