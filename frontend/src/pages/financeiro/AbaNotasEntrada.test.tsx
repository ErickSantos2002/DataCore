import type React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AbaNotasEntrada from "./AbaNotasEntrada";

// O recharts mede a caixa com ResizeObserver, que o jsdom não tem; o gráfico
// não é o que se testa aqui.
vi.mock("recharts", () => {
  const caixa = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  const semDesenho = () => null;
  return {
    ResponsiveContainer: caixa,
    BarChart: caixa,
    Bar: semDesenho,
    CartesianGrid: semDesenho,
    XAxis: semDesenho,
    YAxis: semDesenho,
    Tooltip: semDesenho,
  };
});

const fetchResumoDeEntradas = vi.hoisted(() => vi.fn());
const fetchPaginaDeEntradas = vi.hoisted(() => vi.fn());
const fetchItensDaEntrada = vi.hoisted(() => vi.fn());
vi.mock("../../services/notasEntrada", () => ({
  fetchResumoDeEntradas,
  fetchPaginaDeEntradas,
  fetchItensDaEntrada,
}));

const RESUMO = {
  quantidade: 3,
  valor_total: 1500,
  remetentes: 2,
  importacao_quantidade: 1,
  importacao_valor: 1000,
  por_tipo: [
    { tipo: "compra", quantidade: 2, valor: 1200 },
    { tipo: "devolucao", quantidade: 1, valor: 300 },
    { tipo: "conserto", quantidade: 0, valor: 0 },
    { tipo: "outras", quantidade: 0, valor: 0 },
  ],
  por_mes: [{ mes: "2026-03", quantidade: 3, valor: 1500 }],
  maiores_remetentes: [
    { remetente: "Fornecedor Alfa", uf: "SP", quantidade: 2, valor: 1200 },
  ],
  por_situacao: [
    { situacao: "emitida", quantidade: 2 },
    { situacao: "registrada", quantidade: 1 },
    { situacao: "pendente", quantidade: 0 },
    { situacao: "cancelada", quantidade: 4 },
  ],
};

const NOTA = {
  id: 7,
  numero: "008591",
  serie: "1",
  data_emissao: "2026-03-10",
  remetente: "Fornecedor Alfa",
  cpf_cnpj: "00.000.000/0001-00",
  uf: "SP",
  tipo: "compra",
  importacao: true,
  situacao: "emitida",
  descricao_situacao: "Emitida DANFE",
  natureza_operacao: "Compra",
  cfop: "3102",
  chave_acesso: null,
  valor: 1000,
};

beforeEach(() => {
  fetchResumoDeEntradas.mockReset().mockResolvedValue(RESUMO);
  fetchPaginaDeEntradas
    .mockReset()
    .mockResolvedValue({ itens: [NOTA], total: 1, limite: 20, offset: 0 });
  fetchItensDaEntrada.mockReset().mockResolvedValue([
    {
      id: 1,
      codigo: "BAF-1",
      descricao: "Bafômetro",
      unidade: "UN",
      ncm: null,
      cfop: "3102",
      quantidade: 2,
      valor_unitario: 500,
      valor_total: 1000,
    },
  ]);
});

describe("AbaNotasEntrada", () => {
  it("mostra os indicadores, os tipos com nota e a tabela", async () => {
    render(<AbaNotasEntrada />);
    expect(await screen.findByText("R$ 1.500,00")).toBeInTheDocument();
    expect(screen.getByText("1 notas do exterior")).toBeInTheDocument();
    expect(screen.getByText("Compra · 2 nota(s)")).toBeInTheDocument();
    expect(screen.queryByText(/Conserto \/ reparo ·/)).not.toBeInTheDocument();
    expect(await screen.findByText("008591")).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("row", { name: "Ver itens da nota 008591" }),
      ).getByText("Importação"),
    ).toBeInTheDocument();
    // A contagem por situação aparece no filtro, como as abas do Tiny.
    expect(
      screen.getByRole("button", { name: "Canceladas (4)" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("pede o ano atual sem as canceladas, e o filtro refaz as duas buscas", async () => {
    render(<AbaNotasEntrada />);
    await screen.findByText("008591");
    expect(fetchResumoDeEntradas).toHaveBeenLastCalledWith({
      data_inicio: "2026-01-01",
      data_fim: "2026-12-31",
      situacao: ["emitida", "registrada", "pendente"],
      tipo: undefined,
    });
    fireEvent.click(screen.getByRole("button", { name: "Todo o histórico" }));
    fireEvent.click(screen.getByRole("button", { name: "Devolução de venda" }));
    await waitFor(() =>
      expect(fetchResumoDeEntradas).toHaveBeenLastCalledWith({
        situacao: ["emitida", "registrada", "pendente"],
        tipo: ["devolucao"],
      }),
    );
    expect(fetchPaginaDeEntradas).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tipo: ["devolucao"],
        offset: 0,
        ordenar_por: "data_emissao",
        direcao: "desc",
      }),
    );
  });

  it("busca só no Enter e ordena pela coluna", async () => {
    render(<AbaNotasEntrada />);
    await screen.findByText("008591");
    const campo = screen.getByLabelText("Buscar nota de entrada");
    fireEvent.change(campo, { target: { value: " alfa " } });
    expect(fetchPaginaDeEntradas).not.toHaveBeenLastCalledWith(
      expect.objectContaining({ busca: "alfa" }),
    );
    fireEvent.submit(campo.closest("form")!);
    await waitFor(() =>
      expect(fetchPaginaDeEntradas).toHaveBeenLastCalledWith(
        expect.objectContaining({ busca: "alfa" }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /Valor/ }));
    await waitFor(() =>
      expect(fetchPaginaDeEntradas).toHaveBeenLastCalledWith(
        expect.objectContaining({ ordenar_por: "valor", direcao: "desc" }),
      ),
    );
  });

  it("clicar na nota abre os itens", async () => {
    render(<AbaNotasEntrada />);
    fireEvent.click(
      await screen.findByRole("row", { name: "Ver itens da nota 008591" }),
    );
    const modal = await screen.findByRole("dialog");
    expect(await within(modal).findByText("Bafômetro")).toBeInTheDocument();
    expect(fetchItensDaEntrada).toHaveBeenCalledWith(7);
  });

  it("falha de rede vira aviso na página, não tela vazia calada", async () => {
    fetchResumoDeEntradas.mockRejectedValue(new Error("rede"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<AbaNotasEntrada />);
    expect(
      await screen.findByText("As notas de entrada não carregaram"),
    ).toBeInTheDocument();
  });
});
