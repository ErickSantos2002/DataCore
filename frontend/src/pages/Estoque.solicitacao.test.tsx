import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Estoque from "./Estoque";

/**
 * O modal de solicitação de compras de verdade, aberto pela tela de Estoque.
 *
 * As outras suítes de Estoque trocam o modal por um dublê; aqui o assunto é
 * justamente a ligação entre os dois: a tabela deixava o modal MONTADO o tempo
 * todo (ele só devolvia `null` fechado), e o estado dele sobrevivia ao
 * Cancelar. Quem digitava uma quantidade e desistia reabria com os campos
 * vazios — e o "Gerar PDF" seguinte ainda levava aquela quantidade.
 */

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

vi.mock("../context/EstoqueContext", async () => {
  const { PRODUTOS_ESTOQUE } = await import("./estoque/produtosFalsos");
  return {
    useEstoque: () => ({
      produtos: PRODUTOS_ESTOQUE,
      carregando: false,
      erro: null,
      atualizarProdutos: vi.fn(),
    }),
  };
});

vi.mock("jspdf", () => ({
  default: class {
    internal = { pageSize: { height: 297 } };
    addImage() {}
    setFontSize() {}
    text() {}
    save() {}
  },
}));
vi.mock("jspdf-autotable", () => ({ default: vi.fn() }));

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

const abrirSolicitacao = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "Solicitação de Compras" }),
  );

describe("solicitacao de compras aberta pela tela de Estoque", () => {
  it("cancelar descarta o que foi digitado: reabre sem quantidade nenhuma", () => {
    render(<Estoque />);

    abrirSolicitacao();
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Quantidade de Bocal" }),
      { target: { value: "5" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    abrirSolicitacao();

    expect(
      screen.getByRole("spinbutton", { name: "Quantidade de Bocal" }),
    ).not.toHaveValue();
    expect(screen.getByRole("button", { name: "Gerar PDF" })).toBeDisabled();
  });
});
