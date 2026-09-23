import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Clientes from "./Clientes";
import {
  ESTADO_CLIENTES,
  HOJE_CLIENTES,
  reiniciarEstadoDeClientes,
} from "./clientes/clientesFalsos";

/**
 * O que a tela de Clientes diz quando a busca falha.
 *
 * `useResumoComercial` já caía no `catch`, gravava o resumo vazio e devolvia
 * `erro` — e a casca descartava. Com a API caída a pessoa via "0" ativos,
 * "N/A", um gráfico vazio e "Nenhum resultado encontrado.", e lia "não tenho
 * cliente nenhum". Mesmo defeito e mesmo conserto de Serviços e Vendedores:
 * `Alert variant="danger"` no fluxo da página, e não toast, que some em 4 s.
 *
 * ⚠️ A frase é da tela: a do hook (`comercial/useComercial.ts`, da outra
 * frente) vem sem acento. O falso devolve o resumo VAZIO junto do `erro`, que é
 * o que o `catch` de verdade grava.
 */

const FRASE =
  "Não foi possível carregar os clientes. Confira a conexão e recarregue a página.";

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { hooksDeClientes } = await import("./clientes/clientesFalsos");
  return { ...real, ...hooksDeClientes() };
});

vi.mock("recharts", () => {
  const semDesenho = () => null;
  const caixa = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ResponsiveContainer: caixa,
    BarChart: caixa,
    Bar: semDesenho,
    XAxis: semDesenho,
    YAxis: semDesenho,
    Tooltip: semDesenho,
    CartesianGrid: semDesenho,
  };
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(HOJE_CLIENTES);
  reiniciarEstadoDeClientes();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("falha de rede na tela de Clientes", () => {
  it("o resumo falhando, a tela avisa em bloco com frase acentuada", () => {
    ESTADO_CLIENTES.erro = "Nao foi possivel carregar os dados do periodo.";
    render(<Clientes />);

    expect(screen.getByRole("alert")).toHaveTextContent(FRASE);
    expect(screen.queryByText(/Nao foi possivel/)).not.toBeInTheDocument();
  });

  it("os filtros continuam na tela, para a pessoa tentar de novo", () => {
    ESTADO_CLIENTES.erro = "Nao foi possivel carregar os dados do periodo.";
    render(<Clientes />);

    expect(
      screen.getByRole("button", { name: "Cliente Todos os clientes" }),
    ).toBeInTheDocument();
  });

  it("sem falha nenhuma, nenhum aviso", () => {
    render(<Clientes />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
