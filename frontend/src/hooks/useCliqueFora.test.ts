import { fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCliqueFora } from "./useCliqueFora";

/** Monta um elemento no documento e devolve a ref que o aponta.
 *
 *  O elemento fica no `body` até o fim do arquivo: o `cleanup()` de
 *  `src/test/setup.ts` só desmonta o que o Testing Library renderizou, e este
 *  aqui foi posto à mão. Não atrapalha porque cada teste cria o seu e as
 *  asserções olham para `aoFechar`, não para o DOM. */
function refPara(elemento: HTMLElement) {
  document.body.appendChild(elemento);
  return { current: elemento };
}

describe("useCliqueFora", () => {
  it("chama aoFechar quando o mousedown cai fora da ref", () => {
    const dentro = document.createElement("div");
    const aoFechar = vi.fn();
    renderHook(() => useCliqueFora(refPara(dentro), aoFechar, true));

    fireEvent.mouseDown(document.body);

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("NAO chama aoFechar quando o mousedown cai dentro da ref", () => {
    const dentro = document.createElement("div");
    const filho = document.createElement("button");
    dentro.appendChild(filho);
    const aoFechar = vi.fn();
    renderHook(() => useCliqueFora(refPara(dentro), aoFechar, true));

    fireEvent.mouseDown(filho);

    expect(aoFechar).not.toHaveBeenCalled();
  });

  it("desregistra o listener ao desmontar", () => {
    const dentro = document.createElement("div");
    const aoFechar = vi.fn();
    const { unmount } = renderHook(() =>
      useCliqueFora(refPara(dentro), aoFechar, true),
    );

    unmount();
    fireEvent.mouseDown(document.body);

    expect(aoFechar).not.toHaveBeenCalled();
  });

  it("nao quebra quando a ref ainda esta vazia", () => {
    const aoFechar = vi.fn();
    renderHook(() => useCliqueFora({ current: null }, aoFechar, true));

    expect(() => fireEvent.mouseDown(document.body)).not.toThrow();
  });

  it("chama aoFechar quando o touchstart cai fora da ref", () => {
    const dentro = document.createElement("div");
    const aoFechar = vi.fn();
    renderHook(() => useCliqueFora(refPara(dentro), aoFechar, true));

    fireEvent.touchStart(document.body);

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("NAO chama aoFechar quando o touchstart cai dentro da ref", () => {
    const dentro = document.createElement("div");
    const filho = document.createElement("button");
    dentro.appendChild(filho);
    const aoFechar = vi.fn();
    renderHook(() => useCliqueFora(refPara(dentro), aoFechar, true));

    fireEvent.touchStart(filho);

    expect(aoFechar).not.toHaveBeenCalled();
  });

  it("nao registra listener nenhum enquanto ativo for falso", () => {
    const dentro = document.createElement("div");
    const aoFechar = vi.fn();
    const registrar = vi.spyOn(document, "addEventListener");

    renderHook(() => useCliqueFora(refPara(dentro), aoFechar, false));

    const registrados = registrar.mock.calls.map(([evento]) => evento);
    expect(registrados).not.toContain("mousedown");
    expect(registrados).not.toContain("touchstart");

    fireEvent.mouseDown(document.body);
    expect(aoFechar).not.toHaveBeenCalled();

    registrar.mockRestore();
  });

  it("chama o aoFechar do render mais recente, nao o do primeiro", () => {
    const dentro = document.createElement("div");
    document.body.appendChild(dentro);
    const ref = { current: dentro };
    const velho = vi.fn();
    const novo = vi.fn();
    const { rerender } = renderHook(
      ({ f }: { f: () => void }) => useCliqueFora(ref, f, true),
      {
        initialProps: { f: velho },
      },
    );
    rerender({ f: novo });
    fireEvent.mouseDown(document.body);
    expect(velho).not.toHaveBeenCalled();
    expect(novo).toHaveBeenCalledTimes(1);
  });
});
