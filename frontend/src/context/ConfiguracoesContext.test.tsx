import { act, render, screen, waitFor } from "@testing-library/react";
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

let editar: (chave: string, valor: string) => Promise<void>;

function Espiao() {
  const ctx = useConfiguracoes();
  editar = ctx.editarConfiguracao;
  return (
    <p data-testid="meta">
      {ctx.configuracoes.find((c) => c.chave === "META")?.valor}
    </p>
  );
}

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
    render(
      <ConfiguracoesProvider>
        <Espiao />
      </ConfiguracoesProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("meta")).toHaveTextContent("1.00"),
    );

    await act(() => editar("META", "13.000.000,00"));

    expect(screen.getByTestId("meta")).toHaveTextContent("13000000.00");
  });

  it("erro do backend rejeita e não mexe no estado", async () => {
    api.updateConfiguracao.mockRejectedValue(new Error("422"));
    render(
      <ConfiguracoesProvider>
        <Espiao />
      </ConfiguracoesProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("meta")).toHaveTextContent("1.00"),
    );

    await expect(act(() => editar("META", "x"))).rejects.toThrow("422");
    expect(screen.getByTestId("meta")).toHaveTextContent("1.00");
  });
});
