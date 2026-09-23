import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Vendas from "./Vendas";
import { ESTADO_VENDAS, reiniciarEstadoDeVendas } from "./vendas/vendasFalsas";

/**
 * Caracterização do topo e do rodapé de Vendas — cabeçalho, os quatro KPIs,
 * os três cartões de estatística, carregando e o recorte que os filtros
 * mandam —, antes de decompor a tela.
 *
 * O resumo é o de `vendas/vendasFalsas.ts`, que traz as contas esperadas.
 */

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

/** O cartão de KPI cujo rótulo é `rotulo`. */
function cartao(rotulo: string): HTMLElement {
  const alvo = screen
    .getByText(rotulo)
    .closest("div.rounded-xl") as HTMLElement | null;
  if (!alvo) throw new Error(`cartao de KPI "${rotulo}" nao encontrado`);
  return alvo;
}

/** Um par rótulo e valor dos cartões de estatística: sobe do rótulo até o
 *  elemento que também contém o valor. */
function estatistica(rotulo: string): HTMLElement {
  let alvo: HTMLElement | null = screen.getByText(rotulo);
  while (alvo && alvo.textContent === rotulo) alvo = alvo.parentElement;
  if (!alvo) throw new Error(`estatistica "${rotulo}" nao encontrada`);
  return alvo;
}

describe("cabecalho de Vendas", () => {
  it("mostra o titulo, o usuario logado com o papel e a frase de apoio", () => {
    render(<Vendas />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Vendas - Dashboard",
    );
    expect(screen.getByText("erick").parentElement).toHaveTextContent(
      "Bem-vindo, erick (admin)",
    );
    expect(
      screen.getByText(
        "Acompanhe as principais métricas, evolução e detalhes das vendas em tempo real.",
      ),
    ).toBeInTheDocument();
  });
});

describe("KPIs de Vendas", () => {
  it("Faturamento Total e o total da NOTA, e nao so a mercadoria", () => {
    render(<Vendas />);
    expect(cartao("Faturamento Total")).toHaveTextContent("R$ 123.456,78");
  });

  it("Numero de Vendas e a contagem de notas", () => {
    render(<Vendas />);
    expect(cartao("Número de Vendas")).toHaveTextContent("7");
  });

  it("Ticket Medio vem pronto do resumo", () => {
    render(<Vendas />);
    expect(cartao("Ticket Médio")).toHaveTextContent("R$ 17.636,68");
  });

  it("Produto Top e o primeiro do ranking, com o valor", () => {
    render(<Vendas />);

    const topo = cartao("Produto Top");
    expect(topo).toHaveTextContent("Bafômetro Phoebus Premium XL");
    // Com as duas casas, como os outros três cartões: saía "R$ 6.000", e um
    // valor quebrado "R$ 15.684.661,84" ao lado de um redondo "R$ 5.000".
    expect(topo).toHaveTextContent("R$ 6.000,00");
  });

  it("com resumo vazio, os KPIs zeram e o Produto Top diz N/A", () => {
    ESTADO_VENDAS.vazio = true;
    render(<Vendas />);

    expect(cartao("Faturamento Total")).toHaveTextContent("R$ 0,00");
    expect(cartao("Número de Vendas")).toHaveTextContent("0");
    expect(cartao("Ticket Médio")).toHaveTextContent("R$ 0,00");
    expect(cartao("Produto Top")).toHaveTextContent("N/A");
    // Sem produto não há valor: a nota dizia "R$ 0". Como Clientes e Estoque.
    expect(cartao("Produto Top")).not.toHaveTextContent("R$");
  });
});

describe("Resumo do Periodo em Vendas", () => {
  it("clientes, vendedores sem o 'Nao informado', produtos e itens por venda", () => {
    render(<Vendas />);

    expect(estatistica("Total de Clientes")).toHaveTextContent("9");
    expect(estatistica("Total de Vendedores")).toHaveTextContent("5");
    expect(estatistica("Total de Produtos")).toHaveTextContent("6");
    // No formato brasileiro: saía "2.6".
    expect(estatistica("Média de Itens/Venda")).toHaveTextContent("2,6");
  });

  it("com resumo vazio, zera sem NaN", () => {
    ESTADO_VENDAS.vazio = true;
    render(<Vendas />);

    expect(estatistica("Total de Clientes")).toHaveTextContent("0");
    expect(estatistica("Média de Itens/Venda")).toHaveTextContent("0");
    expect(document.body).not.toHaveTextContent("NaN");
  });
});

describe("Comparativo Mensal em Vendas", () => {
  // Relógio em 05/01/2027: o último ponto de cada fixture (ago/2026, ou o ano
  // de 2026) já fechou, e o comparativo é o do último ponto contra o
  // penúltimo. Com o período em curso ele busca o intervalo equivalente — ver
  // `Vendas.comparativo.test.tsx`. Sem relógio fixo, o de 26 meses dependia
  // do dia em que a suíte roda.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2027, 0, 5, 12, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("variacao do ultimo mes, melhor mes e media mensal", () => {
    // A variação no formato brasileiro: saía "-20.0%", com ponto.
    render(<Vendas />);

    expect(estatistica("Variação último mês")).toHaveTextContent("-20,0%");
    expect(estatistica("Melhor mês")).toHaveTextContent("jul. de 2026");
    expect(estatistica("Média mensal")).toHaveTextContent("R$ 2.133,33");
  });

  it("com mais de 24 meses a evolucao e anual, e o cartao fala de ano", () => {
    // Com 26 meses a evolução agrupa por ano: 2024 soma 1.266, 2025 soma
    // 1.410 e 2026 (dois meses) 249. O cartão comparava esses anos sob
    // "Variação último mês", "Melhor mês" e "Média mensal".
    ESTADO_VENDAS.meses = 26;
    render(<Vendas />);

    const cartao = screen.getByRole("heading", { name: "Comparativo Anual" })
      .parentElement as HTMLElement;
    expect(estatistica("Variação último ano")).toHaveTextContent("-82,3%");
    expect(estatistica("Melhor ano")).toHaveTextContent("2025");
    expect(estatistica("Média anual")).toHaveTextContent("R$ 975,00");
    // Só no cartão: o seletor de período tem "Mês atual".
    expect(cartao.textContent).not.toMatch(/mês|mensal/i);
  });

  it("com menos de dois pontos, o cartao diz por que nao compara", () => {
    // Ficava só o título, sem frase nenhuma.
    ESTADO_VENDAS.meses = 1;
    render(<Vendas />);

    const cartao = screen.getByRole("heading", { name: "Comparativo Mensal" })
      .parentElement as HTMLElement;
    expect(cartao).toHaveTextContent(
      "É preciso de vendas em dois meses para comparar.",
    );
    expect(screen.queryByText("Variação último mês")).not.toBeInTheDocument();
  });
});

describe("Performance de Vendas", () => {
  it("maior venda, menor venda e desvio padrao do resumo", () => {
    render(<Vendas />);

    expect(estatistica("Maior venda")).toHaveTextContent("R$ 50.000,50");
    expect(estatistica("Menor venda")).toHaveTextContent("R$ 12,34");
    expect(estatistica("Desvio padrão")).toHaveTextContent("R$ 9.876,54");
  });
});

describe("carregando em Vendas", () => {
  it("enquanto o resumo carrega, a tela mostra so a frase de espera", () => {
    ESTADO_VENDAS.carregando = true;
    render(<Vendas />);

    expect(screen.getByText("Carregando dados de vendas.")).toBeInTheDocument();
    expect(screen.queryByText("Faturamento Total")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("recorte que os filtros de Vendas mandam", () => {
  const ultimoRecorte = () =>
    ESTADO_VENDAS.recortes[ESTADO_VENDAS.recortes.length - 1];

  it("sem filtro nenhum, o recorte vai vazio", () => {
    render(<Vendas />);
    expect(ultimoRecorte()).toEqual({
      clientes: [],
      vendedores: [],
      produtos: [],
      dataInicio: "",
      dataFim: "",
    });
  });

  it("a empresa vai pelo ID do cadastro", () => {
    render(<Vendas />);
    fireEvent.click(
      screen.getByRole("button", { name: "Empresas Todas as empresas" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Beta Logística (55.666.777/0001-88)",
      }),
    );
    expect(ultimoRecorte().clientes).toEqual([2]);
  });

  it("o vendedor vai pelo nome", () => {
    render(<Vendas />);
    fireEvent.click(
      screen.getByRole("button", { name: "Vendedores Todos os vendedores" }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Vendedor B" }));
    expect(ultimoRecorte().vendedores).toEqual(["Vendedor B"]);
  });

  it("o produto vai pela CHAVE, e o sem codigo e '#' mais a descricao", () => {
    render(<Vendas />);
    fireEvent.click(
      screen.getByRole("button", { name: "Produtos Todos os produtos" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Brinde (sem código)" }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Kit bocal (K1)" }));
    expect(ultimoRecorte().produtos).toEqual(["#Brinde", "K1"]);
  });

  it("digitar uma data leva o preset para personalizado e a data ao recorte", () => {
    render(<Vendas />);
    const campo = screen
      .getByText("Data Início")
      .parentElement!.querySelector("input")!;
    fireEvent.change(campo, { target: { value: "2026-02-01" } });

    expect(ultimoRecorte().dataInicio).toBe("2026-02-01");
    const preset = screen
      .getByText("Período Rápido")
      .parentElement!.querySelector("select")!;
    expect(preset).toHaveValue("custom");
  });
});
