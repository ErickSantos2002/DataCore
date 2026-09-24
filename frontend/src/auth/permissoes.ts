/**
 * Fonte única de permissão de rota do DataCoreHS.
 *
 * Antes desta matriz existiam duas fontes: seis componentes de guarda no
 * `router.tsx` e um conjunto de predicados próprios na `Sidebar.tsx`. Duas
 * fontes podem discordar — e discordavam. Aqui a regra de cada rota é declarada
 * uma vez, e tanto o guarda quanto o menu a leem.
 *
 * Este arquivo **reproduz** o acesso que o app já tinha, sem corrigir nada. As
 * divergências levantadas na Fase 2 são decisão do Erick, em trabalho separado.
 * `src/auth/acesso-atual.test.tsx` é a prova de que nada mudou no caminho.
 */

/** Os papéis que a matriz conhece. O `role` do usuário pode trazer outros. */
export type Papel = "admin" | "vendas" | "servicos" | "financeiro";

/**
 * O usuário, visto pela ótica da permissão. Os dois campos são opcionais de
 * propósito: uma rota `autenticado` decide sem olhar papel nem id, e um teste
 * deve poder perguntar por `{ role: "vendas" }` sem inventar uma matrícula.
 */
export type Usuario = {
  id?: number;
  username?: string;
  role?: string;
};

export type Regra =
  /** Sem sessão: qualquer um abre, autenticado ou não. */
  | { tipo: "publico" }
  /** Basta estar logado; o papel não é consultado. */
  | { tipo: "autenticado" }
  /** Restrita aos papéis listados. */
  | { tipo: "papeis"; papeis: readonly Papel[] }
  /** Liberação nominal, por id de usuário — ver o comentário em PERMISSOES. */
  | { tipo: "usuarios"; ids: readonly number[] };

export const PERMISSOES: Record<string, Regra> = {
  "/login": { tipo: "publico" },
  // Volta do login com Microsoft. Pública porque a sessão ainda não existe; o
  // menu não a lista (a Sidebar só mostra os itens que ela mesma declara).
  "/auth/callback": { tipo: "publico" },

  "/inicio": { tipo: "autenticado" },
  "/dashboard": { tipo: "autenticado" },

  // `/estoque` é página livre: a empresa inteira pode ver, por decisão do
  // Erick. A ausência de restrição aqui é intencional, não um esquecimento.
  "/estoque": { tipo: "autenticado" },

  "/clientes": { tipo: "papeis", papeis: ["admin", "vendas", "financeiro"] },
  "/vendas": { tipo: "papeis", papeis: ["admin", "vendas", "financeiro"] },
  "/produtos": { tipo: "papeis", papeis: ["admin", "vendas", "financeiro"] },
  "/vendedores": { tipo: "papeis", papeis: ["admin", "vendas", "financeiro"] },

  "/servicos": { tipo: "papeis", papeis: ["admin", "servicos", "financeiro"] },

  "/contas-pagar": { tipo: "papeis", papeis: ["admin", "financeiro"] },
  "/contas-receber": { tipo: "papeis", papeis: ["admin", "financeiro"] },

  "/usuarios": { tipo: "papeis", papeis: ["admin"] },
  // Tela de operação: horário de timer, duração de carga, erro de API do Tiny.
  // Só admin, por decisão do Erick — quem lê número não precisa dela, e quem
  // precisa dela mexe na VPS.
  "/importacoes": { tipo: "papeis", papeis: ["admin"] },
  "/configuracoes": { tipo: "papeis", papeis: ["admin"] },

  // NÃO TROQUE POR `{ tipo: "papeis", papeis: ["financeiro"] }`.
  // `/financeiro` e `/locacao` são liberadas para pessoas nomeadas — os
  // usuários de id 1, 3 e 4 — por decisão da chefia, e não para quem tem o
  // papel `financeiro`. É regra de negócio deliberada, não resquício de
  // legado: um usuário com papel `financeiro` fora desta lista deve continuar
  // barrado, e isso é o comportamento correto. "Consertar" a regra para papel
  // abre duas telas financeiras para quem não deve vê-las.
  // Observação operacional: se um desses ids for um dia reatribuído a outra
  // pessoa, ela herda o acesso sem que nada no código acuse.
  "/financeiro": { tipo: "usuarios", ids: [1, 3, 4] },
  "/locacao": { tipo: "usuarios", ids: [1, 3, 4] },
};

/**
 * Responde se o usuário pode abrir a rota.
 *
 * Rota que a matriz não conhece é negada — cadastrar a regra é parte de criar
 * a rota. O estado `loading` da sessão não é assunto daqui: quem espera a
 * sessão carregar é o guarda, que só consulta a matriz com o usuário em mãos.
 */
export function podeAcessar(rota: string, user: Usuario | null): boolean {
  const regra = PERMISSOES[rota];
  if (!regra) return false;

  if (regra.tipo === "publico") return true;

  if (!user) return false;

  switch (regra.tipo) {
    case "autenticado":
      return true;
    case "papeis":
      return regra.papeis.some((papel) => papel === user.role);
    case "usuarios":
      return user.id !== undefined && regra.ids.includes(user.id);
  }
}

/**
 * As rotas da matriz que este usuário consegue abrir. É o que a `Sidebar` usa
 * para montar o menu, garantindo que nenhum item aponte para uma tela que o
 * usuário levaria bloqueio ao abrir.
 */
export function rotasVisiveis(user: Usuario | null): string[] {
  return Object.keys(PERMISSOES).filter((rota) => podeAcessar(rota, user));
}
