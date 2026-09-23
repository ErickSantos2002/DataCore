import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EstoqueProvider, useEstoque } from "./EstoqueContext";

/**
 * O `EstoqueContext` conta quando a busca falha.
 *
 * O `catch` só escrevia no console e devolvia a lista vazia: com a API caída, a
 * tela de Estoque abria com "0" produtos ativos, "R$ 0,00" em estoque e
 * "Nenhum resultado encontrado.", e quem olhava lia "o estoque está zerado".
 * Mesmo contrato das fontes do Financeiro (`erroDeCarga.test.tsx`): falhou, diz
 * que falhou.
 */

const fetchEstoque = vi.hoisted(() => vi.fn());
vi.mock("../services/notasapi", () => ({ fetchEstoque }));

function Espiao() {
  const { erro, carregando } = useEstoque();
  return <p>{carregando ? "carregando" : (erro ?? "sem erro")}</p>;
}

let console_error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  console_error = vi.spyOn(console, "error").mockImplementation(() => {});
  fetchEstoque.mockReset();
});

afterEach(() => {
  console_error.mockRestore();
});

describe("EstoqueContext", () => {
  it("diz o que nao carregou quando a busca falha", async () => {
    fetchEstoque.mockRejectedValue(new Error("500 da API"));

    render(
      <EstoqueProvider>
        <Espiao />
      </EstoqueProvider>,
    );

    expect(
      await screen.findByText("Não foi possível carregar o estoque."),
    ).toBeInTheDocument();
  });

  it("nao inventa erro quando da certo", async () => {
    fetchEstoque.mockResolvedValue([]);

    render(
      <EstoqueProvider>
        <Espiao />
      </EstoqueProvider>,
    );

    expect(await screen.findByText("sem erro")).toBeInTheDocument();
  });
});
