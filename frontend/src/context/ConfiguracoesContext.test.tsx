import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchConfiguracoes: vi.fn(),
  updateConfiguracao: vi.fn(),
  createConfiguracao: vi.fn(),
}));
vi.mock("../services/notasapi", () => api);

import {
  ConfiguracoesProvider,
  useConfiguracoes,
} from "./ConfiguracoesContext";

function montar() {
  return renderHook(() => useConfiguracoes(), {
    wrapper: ConfiguracoesProvider,
  });
}

const meta = (r: ReturnType<typeof montar>["result"]) =>
  r.current.configuracoes.find((c) => c.chave === "META")?.valor;

describe("ConfiguracoesContext", () => {
  beforeEach(() => {
    api.fetchConfiguracoes.mockResolvedValue([
      { id: 1, chave: "META", valor: "1.00" },
    ]);
  });

  it("guarda o valor normalizado que o backend devolveu, não o digitado", async () => {
    api.updateConfiguracao.mockResolvedValue({
      id: 1,
      chave: "META",
      valor: "13000000.00",
    });
    const { result } = montar();
    await waitFor(() => expect(meta(result)).toBe("1.00"));

    await act(() => result.current.editarConfiguracao("META", "13.000.000,00"));

    expect(meta(result)).toBe("13000000.00");
  });

  it("erro do backend rejeita e não mexe no estado", async () => {
    api.updateConfiguracao.mockRejectedValue(new Error("422"));
    const { result } = montar();
    await waitFor(() => expect(meta(result)).toBe("1.00"));

    await expect(
      act(() => result.current.editarConfiguracao("META", "x")),
    ).rejects.toThrow("422");
    expect(meta(result)).toBe("1.00");
  });
});
