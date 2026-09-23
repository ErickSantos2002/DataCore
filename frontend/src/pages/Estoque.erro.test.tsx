import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Estoque from "./Estoque";

/**
 * O que a tela de Estoque diz quando a busca falha: `Alert variant="danger"` no
 * fluxo da página, e não toast — o estado dura até recarregar. Mesmo padrão de
 * Serviços e Vendedores. A frase vem do `EstoqueContext`
 * (`context/EstoqueContext.test.tsx`).
 */

const { ESTADO } = vi.hoisted(() => ({
  ESTADO: { erro: null as string | null },
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

vi.mock("../context/EstoqueContext", () => ({
  useEstoque: () => ({
    produtos: [],
    carregando: false,
    erro: ESTADO.erro,
    atualizarProdutos: vi.fn(),
  }),
}));

vi.mock("../components/SolicitacaoComprasModal", () => ({
  default: () => null,
}));

vi.mock("recharts", () => {
  const semDesenho = () => null;
  const caixa = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ResponsiveContainer: caixa,
    BarChart: caixa,
    PieChart: caixa,
    Bar: semDesenho,
    Pie: semDesenho,
    Cell: semDesenho,
    XAxis: semDesenho,
    YAxis: semDesenho,
    Tooltip: semDesenho,
    CartesianGrid: semDesenho,
    Legend: semDesenho,
  };
});

beforeEach(() => {
  ESTADO.erro = null;
});

describe("falha de rede na tela de Estoque", () => {
  it("a busca falhando, a tela avisa em bloco com a frase do contexto", () => {
    ESTADO.erro = "Não foi possível carregar o estoque.";
    render(<Estoque />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar o estoque.",
    );
  });

  it("busca que da certo nao desenha aviso nenhum", () => {
    render(<Estoque />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
