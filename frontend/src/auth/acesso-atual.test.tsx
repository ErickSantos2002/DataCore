import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import AppRoutes from "../router";
import { AuthContext } from "../context/AuthContext";

/**
 * Rede de segurança da Fase 2 — caracterização do controle de acesso ATUAL.
 *
 * Este arquivo não julga se o acesso de hoje está certo; ele registra qual é.
 * As tasks seguintes arrancam os seis guardas do `router.tsx` e os trocam por
 * uma matriz declarativa. Se qualquer par (papel × rota) mudar nesse caminho,
 * é aqui que a mudança aparece — e o commit que a causou fica identificado.
 *
 * Duas regras que este arquivo segue de propósito:
 *
 * 1. Só se testa comportamento observável **pela rota**: "o papel `servicos`
 *    que abre `/vendas` vê bloqueio". Nenhum guarda é importado nem citado numa
 *    asserção. Os guardas vão deixar de existir; o teste tem de sobreviver a
 *    isso sem ser reescrito, senão não prova nada.
 * 2. As páginas são dubladas por marcadores de texto. O que está sob teste é
 *    quem chega até a página, não o que a página desenha.
 *
 * Comportamentos preservados de propósito, ainda que discutíveis (a correção é
 * decisão do Erick, fora do refactor — ver "Fora de escopo" no plano da Fase 2):
 * `/financeiro` e `/locacao` são governados por id de usuário `[1, 3, 4]`, não
 * por papel; e `/estoque` não tem guarda de papel nenhum, apesar de o menu
 * exibi-lo sob "Administração".
 */

vi.mock("../pages/Login", () => ({ default: () => "pagina:/login" }));
vi.mock("../pages/Home", () => ({ default: () => "pagina:/inicio" }));
vi.mock("../pages/Dashboard", () => ({ default: () => "pagina:/dashboard" }));
vi.mock("../pages/Estoque", () => ({ default: () => "pagina:/estoque" }));
vi.mock("../pages/Clientes", () => ({ default: () => "pagina:/clientes" }));
vi.mock("../pages/Vendas", () => ({ default: () => "pagina:/vendas" }));
vi.mock("../pages/Produtos", () => ({ default: () => "pagina:/produtos" }));
vi.mock("../pages/Vendedores", () => ({ default: () => "pagina:/vendedores" }));
vi.mock("../pages/Servicos", () => ({ default: () => "pagina:/servicos" }));
vi.mock("../pages/ContasPagar", () => ({
  default: () => "pagina:/contas-pagar",
}));
vi.mock("../pages/ContasReceber", () => ({
  default: () => "pagina:/contas-receber",
}));
vi.mock("../pages/Usuarios", () => ({ default: () => "pagina:/usuarios" }));
vi.mock("../pages/Configuracoes", () => ({
  default: () => "pagina:/configuracoes",
}));
vi.mock("../pages/GerenciamentoFinanceiro", () => ({
  default: () => "pagina:/financeiro",
}));
vi.mock("../pages/Locacao", () => ({ default: () => "pagina:/locacao" }));
vi.mock("../pages/NotFound", () => ({ default: () => "pagina:404" }));

type Usuario = { id: number; username: string; role: string } | null;

/** Toda rota protegida do app, na ordem em que aparece no `router.tsx`. */
const ROTAS = [
  "/inicio",
  "/dashboard",
  "/clientes",
  "/estoque",
  "/servicos",
  "/vendas",
  "/locacao",
  "/produtos",
  "/vendedores",
  "/usuarios",
  "/configuracoes",
  "/financeiro",
  "/contas-pagar",
  "/contas-receber",
] as const;

type Rota = (typeof ROTAS)[number];

/**
 * O que o usuário efetivamente vê ao abrir a rota, reduzido a um rótulo.
 * Ler do `textContent` em vez de casar seletor evita amarrar o teste ao
 * desenho do bloqueio (hoje há dois: `<Bloqueio />` e um texto solto no
 * `RequireAdmin`) e à marcação da tela de carregando.
 */
function telaVisivel(): string {
  const texto = document.body.textContent ?? "";

  const marcador = texto.match(/pagina:[^ ]*/);
  if (marcador) return marcador[0];

  if (texto.includes("Acesso negado")) return "bloqueio";
  if (texto.includes("Carregando") || texto.includes("Verificando permissões"))
    return "carregando";

  return `(tela não reconhecida) ${texto.slice(0, 120)}`;
}

function renderizar(rota: string, user: Usuario, loading = false): void {
  render(
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
      <MemoryRouter initialEntries={[rota]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

/**
 * Abre a rota e devolve a tela que fica **depois** que a página chega.
 *
 * As páginas são `React.lazy`: a primeira renderização de cada uma suspende, e
 * quem lê o DOM no mesmo tique vê o fallback do `Suspense`, não a tela. O `act`
 * assíncrono deixa a promessa do módulo resolver e o React repintar antes da
 * leitura, para a asserção continuar falando de acesso e não de rede. Quando
 * não há página a carregar — bloqueio, redirecionamento, sessão ainda em
 * andamento — nada suspende e o `act` passa reto.
 */
async function abrir(
  rota: string,
  user: Usuario,
  loading = false,
): Promise<string> {
  renderizar(rota, user, loading);

  await act(async () => {});

  return telaVisivel();
}

/**
 * Os ids são todos de fora do conjunto `[1, 3, 4]` de propósito: assim a
 * dimensão "papel" fica isolada da dimensão "id", e o portão por id ganha o
 * bloco próprio mais abaixo.
 */
const PERFIS: ReadonlyArray<{
  nome: string;
  user: Usuario;
  libera: readonly Rota[];
}> = [
  {
    nome: "admin",
    user: { id: 10, username: "ana.admin", role: "admin" },
    libera: [
      "/inicio",
      "/dashboard",
      "/estoque",
      "/clientes",
      "/vendas",
      "/produtos",
      "/vendedores",
      "/servicos",
      "/contas-pagar",
      "/contas-receber",
      "/usuarios",
      "/configuracoes",
    ],
  },
  {
    nome: "vendas",
    user: { id: 11, username: "vera.vendas", role: "vendas" },
    libera: [
      "/inicio",
      "/dashboard",
      "/estoque",
      "/clientes",
      "/vendas",
      "/produtos",
      "/vendedores",
    ],
  },
  {
    nome: "servicos",
    user: { id: 12, username: "sergio.servicos", role: "servicos" },
    libera: ["/inicio", "/dashboard", "/estoque", "/servicos"],
  },
  {
    // id 2 e papel `financeiro`: legítimo pelo papel, barrado pelo portão de id.
    nome: "financeiro",
    user: { id: 2, username: "fabio.financeiro", role: "financeiro" },
    libera: [
      "/inicio",
      "/dashboard",
      "/estoque",
      "/clientes",
      "/vendas",
      "/produtos",
      "/vendedores",
      "/servicos",
      "/contas-pagar",
      "/contas-receber",
    ],
  },
  {
    nome: "papel desconhecido (estagiario)",
    user: { id: 13, username: "eva.estagiaria", role: "estagiario" },
    libera: ["/inicio", "/dashboard", "/estoque"],
  },
];

describe("acesso atual, por papel e rota", () => {
  for (const perfil of PERFIS) {
    describe(`papel ${perfil.nome}`, () => {
      for (const rota of ROTAS) {
        const liberado = perfil.libera.includes(rota);
        const esperado = liberado ? `pagina:${rota}` : "bloqueio";

        it(`${liberado ? "abre" : "vê bloqueio em"} ${rota}`, async () => {
          expect(await abrir(rota, perfil.user)).toBe(esperado);
        });
      }

      it("abre /login (a rota pública não tem guarda, nem para quem já está autenticado)", async () => {
        expect(await abrir("/login", perfil.user)).toBe("pagina:/login");
      });
    });
  }
});

describe("acesso atual, sem usuário autenticado", () => {
  for (const rota of ROTAS) {
    it(`redireciona ${rota} para /login`, async () => {
      expect(await abrir(rota, null)).toBe("pagina:/login");
    });
  }

  it("abre /login", async () => {
    expect(await abrir("/login", null)).toBe("pagina:/login");
  });
});

describe("acesso atual, enquanto a sessão carrega", () => {
  // `loading` vence antes de qualquer checagem de papel: nenhuma rota protegida
  // vaza conteúdo, e nenhuma manda o usuário para o login por engano.
  for (const rota of ROTAS) {
    it(`mostra carregando em ${rota}`, async () => {
      expect(await abrir(rota, null, true)).toBe("carregando");
    });
  }

  it("mostra carregando numa rota protegida mesmo com usuário já em mãos", async () => {
    expect(
      await abrir(
        "/usuarios",
        { id: 10, username: "ana.admin", role: "admin" },
        true,
      ),
    ).toBe("carregando");
  });

  it("abre /login normalmente, porque a rota pública não espera a sessão", async () => {
    expect(await abrir("/login", null, true)).toBe("pagina:/login");
  });
});

/**
 * `/financeiro` e `/locacao` não olham o papel: olham a chave primária do
 * usuário. Os casos abaixo existem para separar as duas coisas — é a parte do
 * comportamento atual mais fácil de quebrar sem perceber, porque a intuição diz
 * "papel financeiro entra no financeiro", e hoje não é isso que acontece.
 */
describe("acesso atual a /financeiro e /locacao, governado por id e não por papel", () => {
  const ROTAS_POR_ID = ["/financeiro", "/locacao"] as const;

  const CASOS: ReadonlyArray<{ nome: string; user: Usuario; entra: boolean }> =
    [
      {
        nome: "id 1 com papel admin",
        user: { id: 1, username: "u1", role: "admin" },
        entra: true,
      },
      {
        nome: "id 3 com papel vendas",
        user: { id: 3, username: "u3", role: "vendas" },
        entra: true,
      },
      {
        nome: "id 4 com papel desconhecido",
        user: { id: 4, username: "u4", role: "estagiario" },
        entra: true,
      },
      {
        nome: "id 2 com papel financeiro",
        user: { id: 2, username: "u2", role: "financeiro" },
        entra: false,
      },
      {
        nome: "id 5 com papel admin",
        user: { id: 5, username: "u5", role: "admin" },
        entra: false,
      },
    ];

  for (const caso of CASOS) {
    for (const rota of ROTAS_POR_ID) {
      it(`${caso.nome} ${caso.entra ? "abre" : "vê bloqueio em"} ${rota}`, async () => {
        expect(await abrir(rota, caso.user)).toBe(
          caso.entra ? `pagina:${rota}` : "bloqueio",
        );
      });
    }
  }
});
