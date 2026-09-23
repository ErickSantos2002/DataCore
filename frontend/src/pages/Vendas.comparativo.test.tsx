import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Vendas from "./Vendas";
import { ESTADO_VENDAS, reiniciarEstadoDeVendas } from "./vendas/vendasFalsas";
import { fetchResumoComercial } from "../services/notasapi";

/**
 * O comparativo de Vendas com o último período ainda ABERTO.
 *
 * Punha o último ponto contra o penúltimo inteiro: 2026 até setembro contra
 * 2025 inteiro saía "−32%", e no dia 3 a variação mensal ia a perto de −100%.
 * Decisão do Erick (22/09): comparar o mesmo intervalo do período anterior. A
 * evolução vem por mês, sem dia, então a tela faz uma segunda busca com as
 * datas deslocadas — e é essa busca que o dublê de `fetchResumoComercial`
 * responde e anota. A conta do intervalo tem teste próprio em
 * `vendas/vendas.test.ts`.
 *
 * Fixture (`vendas/vendasFalsas.ts`): com três meses, jun, jul e ago de 2026
 * valem 1.000, 3.000 e 2.400; com 26 meses (jan/2024 a fev/2026), 2026 soma
 * 249.
 */

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

vi.mock("../services/notasapi", async (original) => {
  const real = await original<typeof import("../services/notasapi")>();
  return { ...real, fetchResumoComercial: vi.fn() };
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

const buscar = vi.mocked(fetchResumoComercial);

/** Um resumo do período anterior cujos meses somam `total`. */
function anteriorSomando(total: number) {
  return {
    evolucao_mensal: [
      { ano: 2025, mes: 1, total: total * 0.6 },
      { ano: 2025, mes: 2, total: total * 0.4 },
    ],
  } as unknown as Awaited<ReturnType<typeof fetchResumoComercial>>;
}

beforeEach(() => {
  reiniciarEstadoDeVendas();
  buscar.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

/** O par rótulo e valor de uma linha do comparativo. */
function variacao(): HTMLElement {
  const rotulo = screen.getByText(/^Variação último/);
  let alvo: HTMLElement | null = rotulo;
  while (alvo && alvo.textContent === rotulo.textContent) {
    alvo = alvo.parentElement;
  }
  if (!alvo) throw new Error("linha da variação não encontrada");
  return alvo;
}

describe("comparativo de Vendas com o mes em curso", () => {
  it("compara os mesmos dias do mes anterior, e o rotulo diz ate quando", async () => {
    // 20/08, às 23h30 locais: 1 a 20 de agosto (2.400) contra 1 a 20 de julho.
    vi.setSystemTime(new Date(2026, 7, 20, 23, 30));
    buscar.mockResolvedValue(anteriorSomando(1200));
    render(<Vendas />);

    await waitFor(() =>
      expect(variacao()).toHaveTextContent("Variação último mês, até dia 20"),
    );
    await waitFor(() => expect(variacao()).toHaveTextContent("+100,0%"));
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(buscar.mock.calls[0][0]).toMatchObject({
      data_inicio: "2026-07-01",
      data_fim: "2026-07-20",
    });
  });

  it("com o mes ja fechado nao busca nada, e compara com o mes anterior inteiro", () => {
    vi.setSystemTime(new Date(2026, 8, 22, 12, 0));
    render(<Vendas />);

    expect(variacao()).toHaveTextContent("Variação último mês");
    expect(variacao()).not.toHaveTextContent("até");
    expect(variacao()).toHaveTextContent("-20,0%");
    expect(buscar).not.toHaveBeenCalled();
  });
});

describe("comparativo de Vendas com o ano em curso", () => {
  beforeEach(() => {
    ESTADO_VENDAS.meses = 26;
    vi.setSystemTime(new Date(2026, 8, 22, 12, 0));
  });

  it("compara com o mesmo intervalo do ano anterior", async () => {
    // 2026 até 22/09 (249) contra 2025 até 22/09 (1.000): −75,1%. Contra 2025
    // inteiro (1.410) saía −82,3%.
    buscar.mockResolvedValue(anteriorSomando(1000));
    render(<Vendas />);

    await waitFor(() => expect(variacao()).toHaveTextContent("-75,1%"));
    expect(variacao()).toHaveTextContent("Variação último ano, até 22/09");
    expect(buscar.mock.calls[0][0]).toMatchObject({
      data_inicio: "2025-01-01",
      data_fim: "2025-09-22",
    });
  });

  it("enquanto a busca nao volta, mostra um traco, e nunca a conta errada", () => {
    buscar.mockReturnValue(new Promise(() => {}));
    render(<Vendas />);

    expect(variacao()).toHaveTextContent("—");
    expect(variacao()).not.toHaveTextContent("-82,3%");
  });

  it("com o resumo do recorte novo a caminho, nem busca nem compara", () => {
    // Ao trocar a data, a evolução na tela ainda é a do recorte ANTERIOR: o
    // intervalo sairia da evolução velha com o recorte novo, e a variação
    // misturaria os dois (visto no navegador em 22/09: um pedido de
    // 2025-07-01 a 2025-09-22 saiu entre um recorte e outro).
    ESTADO_VENDAS.atualizando = true;
    render(<Vendas />);

    expect(variacao()).toHaveTextContent("—");
    expect(buscar).not.toHaveBeenCalled();
  });

  it("se a busca falha, fica o traco", async () => {
    buscar.mockRejectedValue(new Error("rede"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Vendas />);

    await waitFor(() => expect(buscar).toHaveBeenCalled());
    await waitFor(() => expect(variacao()).toHaveTextContent("—"));
    expect(variacao()).not.toHaveTextContent("%");
  });
});
