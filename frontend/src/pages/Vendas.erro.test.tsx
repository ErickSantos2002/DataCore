import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Vendas from "./Vendas";
import { ESTADO_VENDAS, reiniciarEstadoDeVendas } from "./vendas/vendasFalsas";

/**
 * O que a tela de Vendas diz quando a busca falha.
 *
 * `useResumoComercial` e `useVendasPaginadas` já caíam no `catch`, gravavam o
 * vazio e devolviam `erro` — e a casca descartava os dois. Com a API caída a
 * pessoa via "R$ 0,00", "0" vendas, "N/A", quatro gráficos vazios e "Nenhum
 * resultado encontrado.", e lia "não vendemos nada". Mesmo defeito e conserto
 * de Serviços, Vendedores e Clientes: `Alert variant="danger"` no fluxo da
 * página, e não toast.
 *
 * ⚠️ A frase é da tela: a do hook (`comercial/useComercial.ts`, da outra
 * frente) vem sem acento.
 */

const FRASE =
  "Não foi possível carregar as vendas. Confira a conexão e recarregue a página.";

// A tela pede o toast para avisar falha de exportação; o assunto deste
// arquivo é outro, então o dublê só precisa existir.
vi.mock("../components/ToastProvider", () => ({
  useToast: () => ({
    sucesso: vi.fn(),
    erro: vi.fn(),
    aviso: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { hooksDeVendas } = await import("./vendas/vendasFalsas");
  return { ...real, ...hooksDeVendas() };
});

vi.mock("../components/ModalObservacoesDaNota", () => ({
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
    LineChart: caixa,
    PieChart: caixa,
    Bar: semDesenho,
    Line: semDesenho,
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
  reiniciarEstadoDeVendas();
});

describe("falha de rede na tela de Vendas", () => {
  it("o resumo falhando, a tela avisa em bloco com frase acentuada", () => {
    ESTADO_VENDAS.erroDoResumo =
      "Nao foi possivel carregar os dados do periodo.";
    render(<Vendas />);

    expect(screen.getByRole("alert")).toHaveTextContent(FRASE);
    expect(screen.queryByText(/Nao foi possivel/)).not.toBeInTheDocument();
  });

  it("a pagina da tabela falhando, a tela avisa em bloco tambem", () => {
    ESTADO_VENDAS.erroDaTabela = "Nao foi possivel carregar as notas.";
    render(<Vendas />);

    expect(screen.getByRole("alert")).toHaveTextContent(FRASE);
  });

  it("as duas falhando, o aviso aparece uma vez so", () => {
    ESTADO_VENDAS.erroDoResumo =
      "Nao foi possivel carregar os dados do periodo.";
    ESTADO_VENDAS.erroDaTabela = "Nao foi possivel carregar as notas.";
    render(<Vendas />);

    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("sem falha nenhuma, nenhum aviso", () => {
    render(<Vendas />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
