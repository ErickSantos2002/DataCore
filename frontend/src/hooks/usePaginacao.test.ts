import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePaginacao } from "./usePaginacao";

const LISTA = Array.from({ length: 12 }, (_, i) => `item ${i + 1}`);

describe("usePaginacao", () => {
  it("comeca na primeira pagina e corta pelo tamanho", () => {
    const { result } = renderHook(() => usePaginacao(LISTA, 10));

    expect(result.current.pagina).toBe(1);
    expect(result.current.total).toBe(12);
    expect(result.current.itensDaPagina).toHaveLength(10);
    expect(result.current.itensDaPagina[0]).toBe("item 1");
  });

  it("a ultima pagina traz o resto", () => {
    const { result } = renderHook(() => usePaginacao(LISTA, 10));

    act(() => result.current.setPagina(2));

    expect(result.current.itensDaPagina).toEqual(["item 11", "item 12"]);
  });

  it("volta para a primeira pagina quando a lista muda", () => {
    // O defeito que este hook existe para matar: filtrar de 84 itens para 20
    // deixava a pessoa na pagina 7, com a tabela em branco e o rodape
    // escrevendo "Mostrando 61 a 20 de 20 registros".
    const { result, rerender } = renderHook(
      ({ itens }) => usePaginacao(itens, 10),
      { initialProps: { itens: LISTA } },
    );

    act(() => result.current.setPagina(2));
    expect(result.current.pagina).toBe(2);

    rerender({ itens: LISTA.slice(0, 3) });

    expect(result.current.pagina).toBe(1);
    expect(result.current.itensDaPagina).toHaveLength(3);
  });

  it("nao reseta quando a lista e a MESMA referencia", () => {
    // Sem isto o hook resetaria a cada render e a paginacao ficaria presa
    // na pagina 1 — o defeito oposto, e pior, porque e silencioso.
    const { result, rerender } = renderHook(
      ({ itens }) => usePaginacao(itens, 10),
      { initialProps: { itens: LISTA } },
    );

    act(() => result.current.setPagina(2));
    rerender({ itens: LISTA });

    expect(result.current.pagina).toBe(2);
  });

  it("reseta tambem quando a lista nova tem o MESMO tamanho", () => {
    // Sem este teste, uma implementação com `[itens.length]` na dependência
    // passaria nos outros quatro e ainda assim estaria errada: filtrar pode
    // devolver a mesma quantidade de itens e ser outra lista. É a diferença
    // entre resetar por identidade (certo) e por tamanho (quase certo).
    const OUTRA = Array.from({ length: 12 }, (_, i) => `outro ${i + 1}`);
    const { result, rerender } = renderHook(
      ({ itens }) => usePaginacao(itens, 10),
      { initialProps: { itens: LISTA } },
    );

    act(() => result.current.setPagina(2));
    rerender({ itens: OUTRA });

    expect(result.current.pagina).toBe(1);
    expect(result.current.itensDaPagina[0]).toBe("outro 1");
  });

  it("lista vazia devolve total zero e nenhuma linha", () => {
    const { result } = renderHook(() => usePaginacao([], 10));

    expect(result.current.total).toBe(0);
    expect(result.current.itensDaPagina).toEqual([]);
  });

  it("depois de trocar de lista, ainda da para paginar a mao", () => {
    // Nao e um teste de unidade do reset — os dois acima ja cobrem isso, e
    // qualquer plantacao que quebre o reset quebra este junto. O que ele
    // cobre e o percurso inteiro de quem usa a tela: paginar, filtrar, e
    // paginar de novo no resultado do filtro. E o unico lugar onde as tres
    // coisas acontecem na mesma sessao, e onde um reset que dispara demais
    // apareceria como paginacao morta depois do filtro.
    const OUTRA = Array.from({ length: 12 }, (_, i) => `outro ${i + 1}`);
    const { result, rerender } = renderHook(
      ({ itens }) => usePaginacao(itens, 10),
      { initialProps: { itens: LISTA } },
    );

    act(() => result.current.setPagina(2));
    rerender({ itens: OUTRA });
    expect(result.current.pagina).toBe(1);

    act(() => result.current.setPagina(2));

    expect(result.current.pagina).toBe(2);
    expect(result.current.itensDaPagina).toEqual(["outro 11", "outro 12"]);
  });
});
