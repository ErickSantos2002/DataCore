import { act, render, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LARGURA_DE_CELULAR, useIsMobile } from "./useIsMobile";

const LARGURA_ORIGINAL = window.innerWidth;

function definirLargura(largura: number) {
  Object.defineProperty(window, "innerWidth", {
    value: largura,
    writable: true,
    configurable: true,
  });
}

/** `innerWidth` é global: um teste que o deixa em 375 contamina os seguintes. */
afterEach(() => definirLargura(LARGURA_ORIGINAL));

describe("useIsMobile", () => {
  it("diz que nao e celular numa janela larga", () => {
    definirLargura(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("passa a dizer que e celular quando a janela encolhe", () => {
    definirLargura(1024);
    const { result } = renderHook(() => useIsMobile());

    act(() => {
      definirLargura(375);
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toBe(true);
  });

  it("o limite e exclusivo: abaixo dele e celular, nele nao", () => {
    definirLargura(1024);
    const { result } = renderHook(() => useIsMobile());

    act(() => {
      definirLargura(LARGURA_DE_CELULAR - 1);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(true);

    act(() => {
      definirLargura(LARGURA_DE_CELULAR);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(false);
  });

  it("ja nasce sabendo, sem esperar o efeito", () => {
    definirLargura(375);

    // `renderHook` sozinho não distingue o defeito aqui: o `act` implícito que
    // ele usa para montar já deixa o efeito rodar antes de `result.current` ser
    // lido, então esta asserção passaria mesmo com `useState(false)`. Por isso
    // a prova é outra: um componente que registra o valor a cada render, e a
    // afirmação é sobre o PRIMEIRO valor da lista — o que a tela realmente pinta
    // antes de qualquer efeito rodar. Com `useState(false)` o primeiro valor
    // registrado é `false`, e é esse intervalo que faz o grafico saltar de 300
    // para 420 em celular.
    const valoresRenderizados: boolean[] = [];
    function Sonda() {
      valoresRenderizados.push(useIsMobile());
      return null;
    }

    render(createElement(Sonda));

    expect(valoresRenderizados[0]).toBe(true);
  });

  it("desregistra o listener ao desmontar", () => {
    definirLargura(1024);
    const tirarListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useIsMobile());

    unmount();

    // Espiar o `removeEventListener` é o único jeito de provar isto. A forma
    // óbvia — desmontar, disparar `resize` e afirmar que `result.current`
    // continua `false` — **não prova nada**: depois do `unmount` o React
    // descarta em silêncio qualquer `setState` de um fiber desmontado, então
    // aquela asserção passa com ou sem o cleanup. Foi assim que a primeira
    // versão deste teste nasceu vazia.
    expect(tirarListener).toHaveBeenCalledWith("resize", expect.any(Function));

    tirarListener.mockRestore();
  });
});
