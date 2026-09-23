import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Clientes from "./Clientes";
import {
  ESTADO_CLIENTES,
  HOJE_CLIENTES,
  reiniciarEstadoDeClientes,
} from "./clientes/clientesFalsos";

/**
 * Caracterização do topo de Clientes — cabeçalho, os quatro KPIs, as
 * estatísticas do período, carregando e o recorte que os filtros mandam —,
 * antes de decompor a tela.
 *
 * O resumo e as opções são os de `clientes/clientesFalsos.ts`, que traz a
 * tabela do fixture e as contas esperadas. O relógio é fixado em 15/09/2026:
 * ativo e inativo dependem de "hoje menos noventa dias".
 */

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
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(HOJE_CLIENTES);
  reiniciarEstadoDeClientes();
});

afterEach(() => {
  vi.useRealTimers();
});

/** O cartão de KPI cujo rótulo é `rotulo` — escopa a busca do valor. */
function cartao(rotulo: string): HTMLElement {
  const alvo = screen
    .getByText(rotulo)
    .closest("div.rounded-xl") as HTMLElement | null;
  if (!alvo) throw new Error(`cartao de KPI "${rotulo}" nao encontrado`);
  return alvo;
}

/** A linha de "Estatísticas do Período": sobe do rótulo até o elemento que
 *  também contém o valor. */
function estatistica(rotulo: string): HTMLElement {
  let alvo: HTMLElement | null = screen.getByText(rotulo);
  while (alvo && alvo.textContent === rotulo) alvo = alvo.parentElement;
  if (!alvo) throw new Error(`estatistica "${rotulo}" nao encontrada`);
  return alvo;
}

describe("cabecalho de Clientes", () => {
  it("mostra o titulo, o usuario logado com o papel e a frase de apoio", () => {
    render(<Clientes />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Clientes - Dashboard",
    );
    expect(screen.getByText("erick").parentElement).toHaveTextContent(
      "Bem-vindo, erick (admin)",
    );
    expect(
      screen.getByText(
        "Visualize seus principais clientes e oportunidades de reativação.",
      ),
    ).toBeInTheDocument();
  });
});

describe("KPIs de Clientes", () => {
  it("Clientes Ativos conta quem comprou nos ultimos noventa dias", () => {
    render(<Clientes />);
    // Dez: a compra de 17/06, há 90 dias exatos, conta.
    expect(cartao("Clientes Ativos")).toHaveTextContent("10");
  });

  it("Inativos conta o resto da carteira do recorte", () => {
    render(<Clientes />);
    expect(cartao("Inativos (90 dias)")).toHaveTextContent("2");
  });

  it("Top Cliente e o primeiro do ranking, com o valor em reais", () => {
    // A nota era o valor abreviado do eixo, "R$ 50.0K", com ponto — o único
    // dinheiro do topo fora do formato brasileiro.
    render(<Clientes />);

    const topo = cartao("Top Cliente");
    expect(topo).toHaveTextContent("Alfa Mineração Recife Ltda");
    expect(topo).toHaveTextContent("R$ 50.000,50");
    expect(topo).not.toHaveTextContent("Beta Logística");
  });

  it("Ticket medio por nota e o valor da carteira sobre as notas dela", () => {
    // 130.370,50 / 29 notas. Era a média das médias de cada cliente
    // (47.685,125 / 12 = R$ 3.973,76): um cliente de uma nota pesava igual a
    // um de duzentas. Decisão do Erick (22/09): o ticket da carteira.
    render(<Clientes />);
    expect(cartao("Ticket médio por nota")).toHaveTextContent("R$ 4.495,53");
    expect(screen.queryByText("Ticket Médio/Cliente")).not.toBeInTheDocument();
  });

  it("com resumo vazio, os KPIs zeram e o Top Cliente diz N/A", () => {
    ESTADO_CLIENTES.vazio = true;
    render(<Clientes />);

    expect(cartao("Clientes Ativos")).toHaveTextContent("0");
    expect(cartao("Inativos (90 dias)")).toHaveTextContent("0");
    expect(cartao("Top Cliente")).toHaveTextContent("N/A");
    // Sem cliente não há valor: a nota dizia "R$ 0".
    expect(cartao("Top Cliente")).not.toHaveTextContent("R$");
    expect(cartao("Ticket médio por nota")).toHaveTextContent("R$ 0,00");
  });
});

describe("estatisticas do periodo em Clientes", () => {
  it("Total de Clientes conta a carteira do recorte", () => {
    render(<Clientes />);
    expect(estatistica("Total de Clientes")).toHaveTextContent("12");
  });

  it("Taxa de Ativacao divide ativos pelo total", () => {
    render(<Clientes />);
    // 10 de 12, no formato brasileiro, como o faturamento ao lado: saía
    // "75.0%" (9 de 12, antes da compra de 90 dias exatos contar).
    expect(estatistica("Taxa de Ativação")).toHaveTextContent("83,3%");
  });

  it("Faturamento Total le o KPI do resumo, e nao a soma dos clientes", () => {
    render(<Clientes />);
    expect(estatistica("Faturamento Total")).toHaveTextContent("R$ 123.456,78");
  });

  it("Notas no Periodo soma as notas de cada cliente", () => {
    render(<Clientes />);
    expect(estatistica("Notas no Período")).toHaveTextContent("29");
  });

  it("com resumo vazio, zera sem NaN", () => {
    ESTADO_CLIENTES.vazio = true;
    render(<Clientes />);

    expect(estatistica("Total de Clientes")).toHaveTextContent("0");
    expect(estatistica("Taxa de Ativação")).toHaveTextContent("0%");
    expect(estatistica("Faturamento Total")).toHaveTextContent("R$ 0,00");
    expect(estatistica("Notas no Período")).toHaveTextContent("0");
    expect(document.body).not.toHaveTextContent("NaN");
  });
});

describe("carregando em Clientes", () => {
  it("enquanto o resumo carrega, a tela mostra so a frase de espera", () => {
    ESTADO_CLIENTES.carregando = true;
    render(<Clientes />);

    expect(
      screen.getByText("Carregando dados dos clientes."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Clientes Ativos")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("recorte que os filtros de Clientes mandam", () => {
  const ultimoRecorte = () =>
    ESTADO_CLIENTES.recortes[ESTADO_CLIENTES.recortes.length - 1];

  it("sem filtro nenhum, o recorte vai vazio", () => {
    render(<Clientes />);
    expect(ultimoRecorte()).toEqual({
      clientes: [],
      vendedores: [],
      produtos: [],
      dataInicio: "",
      dataFim: "",
    });
  });

  it("um cliente vira TODOS os ids de cadastro com o mesmo documento", () => {
    render(<Clientes />);

    fireEvent.click(
      screen.getByRole("button", { name: "Cliente Todos os clientes" }),
    );
    // Os dois cadastros da Alfa são uma opção só; o rótulo é o do último.
    expect(
      screen.getAllByRole("checkbox", { name: /11\.222\.333\/0001-44/ }),
    ).toHaveLength(1);
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "ALFA MINERACAO (11.222.333/0001-44)",
      }),
    );

    expect(ultimoRecorte().clientes).toEqual([1, 7]);
  });

  it("o vendedor vai pelo nome", () => {
    render(<Clientes />);

    fireEvent.click(
      screen.getByRole("button", { name: "Vendedor Todos os vendedores" }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Vendedor B" }));

    expect(ultimoRecorte().vendedores).toEqual(["Vendedor B"]);
  });

  it("o produto vai pela CHAVE, e o sem codigo e '#' mais a descricao", () => {
    render(<Clientes />);

    fireEvent.click(
      screen.getByRole("button", { name: "Produto Todos os produtos" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Brinde (sem código)" }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Kit bocal (K1)" }));

    expect(ultimoRecorte().produtos).toEqual(["#Brinde", "K1"]);
  });

  it("o preset escreve as duas datas no recorte", () => {
    render(<Clientes />);

    const preset = screen
      .getByText("Período")
      .parentElement!.querySelector("select")!;
    fireEvent.change(preset, { target: { value: "mesAtual" } });

    expect(ultimoRecorte().dataInicio).toBe("2026-09-01");
    expect(ultimoRecorte().dataFim).toBe("2026-09-30");
  });
});
