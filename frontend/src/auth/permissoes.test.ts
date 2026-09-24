import { describe, expect, it } from "vitest";

import {
  PERMISSOES,
  podeAcessar,
  rotasVisiveis,
  type Usuario,
} from "./permissoes";

/**
 * A matriz de permissões, conferida contra a mesma tabela (papel × rota) que
 * `acesso-atual.test.tsx` fixou renderizando o `router.tsx`.
 *
 * A diferença entre os dois arquivos é de propósito: lá se prova o que o app
 * entrega hoje, aqui se prova o que a matriz responde. Enquanto os dois
 * concordarem, a troca dos guardas pela matriz (Task 3) não muda acesso de
 * ninguém. Se um dia divergirem, o par exato aparece nos dois relatórios.
 *
 * O estado `loading` não aparece aqui: quem espera a sessão carregar é o guarda,
 * não a matriz. `podeAcessar` responde sobre um usuário já conhecido (ou sobre
 * a ausência dele).
 */

/** Toda rota protegida do app, na mesma ordem do `router.tsx`. */
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
  "/importacoes",
  "/configuracoes",
  "/financeiro",
  "/contas-pagar",
  "/contas-receber",
] as const;

type Rota = (typeof ROTAS)[number];

/**
 * Os ids são todos de fora do conjunto `[1, 3, 4]` de propósito: assim a
 * dimensão "papel" fica isolada da dimensão "id", e a liberação nominal de
 * `/financeiro` e `/locacao` ganha o bloco próprio mais abaixo.
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
      "/importacoes",
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
    // id 2 e papel `financeiro`: legítimo pelo papel, barrado pela regra nominal.
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

describe("podeAcessar, por papel e rota", () => {
  for (const perfil of PERFIS) {
    describe(`papel ${perfil.nome}`, () => {
      for (const rota of ROTAS) {
        const liberado = perfil.libera.includes(rota);

        it(`${liberado ? "acessa" : "não acessa"} ${rota}`, () => {
          expect(podeAcessar(rota, perfil.user)).toBe(liberado);
        });
      }

      it("acessa /login, que é rota pública", () => {
        expect(podeAcessar("/login", perfil.user)).toBe(true);
      });
    });
  }
});

describe("podeAcessar, sem usuário autenticado", () => {
  for (const rota of ROTAS) {
    it(`nega ${rota}`, () => {
      expect(podeAcessar(rota, null)).toBe(false);
    });
  }

  it("libera /login", () => {
    expect(podeAcessar("/login", null)).toBe(true);
  });

  it("libera /auth/callback, a volta do login com Microsoft", () => {
    expect(podeAcessar("/auth/callback", null)).toBe(true);
  });
});

/**
 * A parte do comportamento mais fácil de quebrar sem perceber: a intuição diz
 * "papel financeiro entra no financeiro", e não é isso que acontece. Estas duas
 * telas são liberadas para pessoas nomeadas, por decisão da chefia — ver o
 * comentário na definição da regra em `permissoes.ts`.
 */
describe("podeAcessar em /financeiro e /locacao: identidade, não papel", () => {
  const ROTAS_NOMINAIS = ["/financeiro", "/locacao"] as const;

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
      {
        nome: "usuário sem id",
        user: { role: "financeiro" },
        entra: false,
      },
    ];

  for (const caso of CASOS) {
    for (const rota of ROTAS_NOMINAIS) {
      it(`${caso.nome} ${caso.entra ? "acessa" : "não acessa"} ${rota}`, () => {
        expect(podeAcessar(rota, caso.user)).toBe(caso.entra);
      });
    }
  }

  it("o papel `financeiro` sozinho não abre /financeiro", () => {
    expect(podeAcessar("/financeiro", { id: 2, role: "financeiro" })).toBe(
      false,
    );
  });

  it("um id da lista abre /financeiro mesmo com papel que não existe na matriz", () => {
    expect(podeAcessar("/financeiro", { id: 4, role: "estagiario" })).toBe(
      true,
    );
  });

  it("a regra é declarada como liberação nominal, e não por papel", () => {
    expect(PERMISSOES["/financeiro"]).toEqual({
      tipo: "usuarios",
      ids: [1, 3, 4],
    });
    expect(PERMISSOES["/locacao"]).toEqual({
      tipo: "usuarios",
      ids: [1, 3, 4],
    });
  });
});

/**
 * `/estoque` é página livre: a empresa inteira vê, por decisão do Erick. A rota
 * está certa; quem mente é o menu, que a coloca sob "Administração" (corrigido
 * na Task 4).
 */
describe("podeAcessar em /estoque, que é livre para quem está autenticado", () => {
  it("libera para o papel vendas", () => {
    expect(podeAcessar("/estoque", { role: "vendas" })).toBe(true);
  });

  it("libera para um papel que a matriz nem conhece", () => {
    expect(podeAcessar("/estoque", { id: 13, role: "estagiario" })).toBe(true);
  });

  it("nega para quem não está autenticado", () => {
    expect(podeAcessar("/estoque", null)).toBe(false);
  });

  it("é declarada como `autenticado`, sem lista de papéis", () => {
    expect(PERMISSOES["/estoque"]).toEqual({ tipo: "autenticado" });
  });
});

describe("podeAcessar em rota que a matriz não conhece", () => {
  it("nega por padrão, mesmo para admin", () => {
    expect(
      podeAcessar("/rota-que-nao-existe", {
        id: 10,
        username: "ana.admin",
        role: "admin",
      }),
    ).toBe(false);
  });
});

/** Abertas sem sessão: o login e a volta do login com Microsoft. */
const PUBLICAS = ["/login", "/auth/callback"];

describe("a matriz cobre todas as rotas do app", () => {
  it("tem uma regra para cada rota protegida, mais as públicas", () => {
    expect(Object.keys(PERMISSOES).sort()).toEqual(
      [...ROTAS, ...PUBLICAS].sort(),
    );
  });
});

describe("rotasVisiveis", () => {
  for (const perfil of PERFIS) {
    it(`devolve para o papel ${perfil.nome} exatamente as rotas que ele acessa`, () => {
      expect(rotasVisiveis(perfil.user).sort()).toEqual(
        [...perfil.libera, ...PUBLICAS].sort(),
      );
    });
  }

  it("devolve para o id 1 as duas telas de liberação nominal", () => {
    const visiveis = rotasVisiveis({ id: 1, username: "u1", role: "admin" });

    expect(visiveis).toContain("/financeiro");
    expect(visiveis).toContain("/locacao");
  });

  it("devolve só as rotas públicas para quem não está autenticado", () => {
    expect(rotasVisiveis(null).sort()).toEqual([...PUBLICAS].sort());
  });

  it("nunca devolve rota que `podeAcessar` negaria", () => {
    for (const perfil of PERFIS) {
      for (const rota of rotasVisiveis(perfil.user)) {
        expect(podeAcessar(rota, perfil.user)).toBe(true);
      }
    }
  });
});
