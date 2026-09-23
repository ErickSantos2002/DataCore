import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import useNavGroups from "./Sidebar";
import { AuthContext } from "../context/AuthContext";
import { PERMISSOES, podeAcessar } from "../auth/permissoes";

/**
 * O invariante do menu — o teste que a Fase 2 existe para deixar no lugar.
 *
 * **Para todo papel, todo item exibido no menu aponta para uma rota que aquele
 * papel consegue abrir.** Enquanto a `Sidebar` escrevia os próprios predicados
 * (`idsFinanceiroLegado`, `podeContas`, `ehAdmin`) e o `router.tsx` escrevia os
 * dele, os dois podiam discordar — e discordavam em silêncio, porque nada no
 * sistema comparava um com o outro. Este arquivo é essa comparação.
 *
 * Ele é escrito para valer para o que ainda não existe:
 *
 * - **Itens futuros** — nada aqui enumera "Vendas", "Estoque" ou qualquer outro
 *   rótulo. O teste percorre o que o hook devolveu, seja lá o que for. Um item
 *   novo na `Sidebar` amanhã já nasce coberto, sem ninguém lembrar de nada.
 * - **Papéis e liberações nominais futuras** — as pessoas de teste são derivadas
 *   da própria matriz: cada papel que aparece numa regra `papeis` e cada id que
 *   aparece numa regra `usuarios` viram personas automaticamente. Acrescentar um
 *   papel `suporte` à matriz basta para ele passar a ser testado aqui.
 *
 * O `/login` é a pegadinha do arquivo. Ele está em `rotasVisiveis` porque é rota
 * pública, e o menu obviamente não lista o login. Isso **não** é motivo para
 * afrouxar o invariante nem para uma exceção escrita à mão: o invariante corre
 * na direção menu → rota (todo item do menu abre), onde `/login` simplesmente
 * não participa; e o teste da direção contrária, mais abaixo, dispensa `/login`
 * pela regra que ele tem na matriz (`tipo: "publico"`), não pelo nome.
 */

type Usuario = { id: number; username: string; role: string } | null;

/** Papéis citados em alguma regra `papeis` da matriz. Deriva; não enumera. */
const PAPEIS_DA_MATRIZ = [
  ...new Set(
    Object.values(PERMISSOES).flatMap((regra) =>
      regra.tipo === "papeis" ? [...regra.papeis] : [],
    ),
  ),
];

/** Ids citados em alguma regra `usuarios` — a liberação nominal da chefia. */
const IDS_NOMEADOS = [
  ...new Set(
    Object.values(PERMISSOES).flatMap((regra) =>
      regra.tipo === "usuarios" ? [...regra.ids] : [],
    ),
  ),
];

/** Um id que nenhuma regra nominal cita, para separar papel de matrícula. */
const ID_COMUM = Math.max(0, ...IDS_NOMEADOS) + 1000;

/**
 * Cada papel da matriz aparece duas vezes — com id comum e com id nomeado —
 * porque o portão `[1, 3, 4]` de `/financeiro` e `/locacao` é ortogonal ao
 * papel: o menu tem de acertar as duas combinações. Mais um papel que a matriz
 * não conhece e a sessão ausente.
 */
const PESSOAS: { nome: string; user: Usuario }[] = [
  ...PAPEIS_DA_MATRIZ.flatMap((papel) => [
    {
      nome: `papel ${papel}, id comum`,
      user: { id: ID_COMUM, username: papel, role: papel },
    },
    ...IDS_NOMEADOS.map((id) => ({
      nome: `papel ${papel}, id nomeado ${id}`,
      user: { id, username: papel, role: papel },
    })),
  ]),
  {
    nome: "papel desconhecido, id comum",
    user: {
      id: ID_COMUM,
      username: "estagiario",
      role: "papel-que-nao-existe",
    },
  },
  {
    nome: `papel desconhecido, id nomeado ${IDS_NOMEADOS[0]}`,
    user: {
      id: IDS_NOMEADOS[0],
      username: "estagiario",
      role: "papel-que-nao-existe",
    },
  },
  { nome: "sem sessão", user: null },
];

function wrapperPara(user: Usuario) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthContext.Provider
        value={{
          user,
          token: null,
          loading: false,
          login: vi.fn(),
          logout: vi.fn(),
          error: null,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  };
}

/** Todo item de todo grupo, achatado, com o grupo junto para a mensagem de erro. */
function itensDoMenu(
  user: Usuario,
): { grupo: string; label: string; path: string }[] {
  const { result } = renderHook(() => useNavGroups(), {
    wrapper: wrapperPara(user),
  });
  return result.current.flatMap((grupo) =>
    grupo.items.map((item) => ({
      grupo: grupo.label,
      label: item.label,
      path: item.path,
    })),
  );
}

describe("invariante: o menu nunca oferece o que a rota nega", () => {
  it.each(PESSOAS)("$nome só vê itens que consegue abrir", ({ user }) => {
    const oferecidosEBloqueados = itensDoMenu(user)
      .filter((item) => !podeAcessar(item.path, user))
      .map((item) => `${item.grupo} > ${item.label} (${item.path})`);

    expect(oferecidosEBloqueados).toEqual([]);
  });

  it.each(PESSOAS.filter((p) => p.user !== null))(
    "$nome vê algum item — o teste não é vazio",
    ({ user }) => {
      expect(itensDoMenu(user).length).toBeGreaterThan(0);
    },
  );

  it("não monta menu nenhum sem sessão", () => {
    expect(itensDoMenu(null)).toEqual([]);
  });

  /**
   * A direção contrária: rota que a matriz protege e ninguém alcança pelo menu
   * é tela órfã. As públicas ficam de fora pela regra que têm na matriz — é
   * assim que `/login` sai daqui sem virar exceção escrita à mão.
   */
  it("toda rota não-pública da matriz tem item de menu para alguém", () => {
    const naMatriz = Object.entries(PERMISSOES)
      .filter(([, regra]) => regra.tipo !== "publico")
      .map(([rota]) => rota);
    const noMenu = new Set(
      PESSOAS.flatMap(({ user }) => itensDoMenu(user).map((i) => i.path)),
    );

    expect(naMatriz.filter((rota) => !noMenu.has(rota))).toEqual([]);
  });

  /** E o inverso disso: item apontando para rota que a matriz não conhece. */
  it("nenhum item do menu aponta para rota fora da matriz", () => {
    const fora = PESSOAS.flatMap(({ user }) => itensDoMenu(user))
      .filter((item) => !(item.path in PERMISSOES))
      .map((item) => item.path);

    expect([...new Set(fora)]).toEqual([]);
  });
});
