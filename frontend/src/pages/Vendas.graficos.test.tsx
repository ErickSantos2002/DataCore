import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Vendas from "./Vendas";
import { ESTADO_VENDAS, reiniciarEstadoDeVendas } from "./vendas/vendasFalsas";

/**
 * Os quatro gráficos de Vendas: que estão na tela, sob o título certo, o array
 * que cada um recebe, o que os eixos escrevem e o que o balão mostra.
 *
 * Com o recharts de verdade o jsdom mede 0x0 e não desenha nada, em silêncio.
 * O dublê daqui anota no DOM:
 *   - `data-dados` — o array do gráfico (no `Pie`, o da pizza);
 *   - `data-serie` — o `dataKey` da `Line`/`Bar`;
 *   - `data-rotulos` — o que o eixo escreve: com `dataKey`, os valores do
 *     array passados pelo `tickFormatter`; sem, os números de amostra
 *     `[0, 999.5, 2400, 2500000]` (e o `tick` desenhado, quando é função);
 *   - `data-fatias` — o `label` da pizza, com o `percent` que o recharts
 *     calcula (valor sobre a soma);
 *   - os balões — o `content` chamado para cada item, com
 *     `payload[0].payload` igual ao item do array, sem nada a mais, que é o
 *     que o recharts entrega; e o `formatter`, quando o balão é o padrão.
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

vi.mock("recharts", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const AMOSTRA = [0, 999.5, 2400, 2500000];
  // O array do gráfico que está sendo desenhado: o corpo do gráfico roda antes
  // do corpo dos filhos, e o `Pie` roda antes do `Tooltip` irmão.
  let atual: Record<string, unknown>[] = [];
  type Props = {
    data?: Record<string, unknown>[];
    dataKey?: string;
    children?: React.ReactNode;
    tickFormatter?: (v: never) => string;
    tick?: unknown;
    content?: (p: unknown) => React.ReactNode;
    formatter?: (v: number) => string;
    label?: (p: { percent: number }) => string;
  };
  const grafico =
    (nome: string) =>
    ({ data, children }: Props) => {
      atual = data ?? [];
      return (
        <div
          data-grafico={nome}
          {...(data ? { "data-dados": JSON.stringify(data) } : {})}
        >
          {children}
        </div>
      );
    };
  const serie =
    (nome: string) =>
    ({ dataKey }: Props) => <div data-grafico={nome} data-serie={dataKey} />;
  const eixo =
    (nome: string) =>
    ({ dataKey, tickFormatter, tick }: Props) => {
      const valores = dataKey ? atual.map((d) => d[dataKey]) : AMOSTRA;
      const rotulos = valores.map((v) => {
        if (typeof tick === "function") {
          return renderToStaticMarkup(
            (tick as (p: unknown) => React.ReactElement)({
              x: 0,
              y: 0,
              payload: { value: v },
            }),
          ).replace(/<[^>]+>/g, "");
        }
        return tickFormatter ? tickFormatter(v as never) : String(v);
      });
      return (
        <div
          data-grafico={nome}
          data-rotulos={JSON.stringify(rotulos)}
          {...(dataKey ? { "data-chave": dataKey } : {})}
        />
      );
    };
  return {
    ResponsiveContainer: ({ children }: Props) => <div>{children}</div>,
    LineChart: grafico("LineChart"),
    BarChart: grafico("BarChart"),
    PieChart: ({ children }: Props) => {
      atual = [];
      return <div data-grafico="PieChart">{children}</div>;
    },
    Line: serie("Line"),
    Bar: serie("Bar"),
    Pie: ({ data, dataKey, label, children }: Props) => {
      atual = data ?? [];
      const soma = atual.reduce((s, d) => s + Number(d.value), 0);
      return (
        <div
          data-grafico="Pie"
          data-dados={JSON.stringify(data)}
          data-serie={dataKey}
          data-fatias={JSON.stringify(
            label
              ? atual.map((d) => label({ percent: Number(d.value) / soma }))
              : [],
          )}
        >
          {children}
        </div>
      );
    },
    XAxis: eixo("XAxis"),
    YAxis: eixo("YAxis"),
    Tooltip: ({ content, formatter }: Props) => (
      <div data-grafico="Tooltip">
        {formatter ? <p data-formatado>{formatter(2400)}</p> : null}
        {typeof content === "function"
          ? atual.map((d, i) => (
              <div key={i} data-balao={i}>
                {content({ active: true, payload: [{ payload: d }] })}
              </div>
            ))
          : null}
      </div>
    ),
    Cell: () => null,
    CartesianGrid: () => null,
    Legend: () => null,
  };
});

beforeEach(() => {
  reiniciarEstadoDeVendas();
});

function cartaoDoGrafico(titulo: string): HTMLElement {
  const alvo = screen.getByRole("heading", { name: titulo }).parentElement;
  if (!alvo) throw new Error(`cartao "${titulo}" nao encontrado`);
  return alvo;
}

function atributo(cartao: HTMLElement, peca: string, nome: string): string {
  const el = cartao.querySelector(`[data-grafico="${peca}"][${nome}]`);
  if (!el) throw new Error(`${peca} sem ${nome} neste cartao`);
  return el.getAttribute(nome) ?? "";
}

const json = (cartao: HTMLElement, peca: string, nome: string) =>
  JSON.parse(atributo(cartao, peca, nome));

function balao(cartao: HTMLElement, indice: number): HTMLElement {
  const el = cartao.querySelector(`[data-balao="${indice}"]`);
  if (!el) throw new Error(`balao ${indice} nao encontrado`);
  return el as HTMLElement;
}

describe("Evolucao das Vendas", () => {
  it("um ponto por mes, rotulado pelo mes abreviado, com o total da nota", () => {
    render(<Vendas />);
    const cartao = cartaoDoGrafico("Evolução das Vendas");

    const dados = json(cartao, "LineChart", "data-dados");
    expect(dados.map((d: { mes: string }) => d.mes)).toEqual([
      "jun. de 2026",
      "jul. de 2026",
      "ago. de 2026",
    ]);
    expect(dados.map((d: { total: number }) => d.total)).toEqual([
      1000, 3000, 2400,
    ]);
    expect(atributo(cartao, "Line", "data-serie")).toBe("total");
  });

  it("acima de 24 meses, um ponto por ano com a soma", () => {
    ESTADO_VENDAS.meses = 26;
    render(<Vendas />);
    const dados = json(
      cartaoDoGrafico("Evolução das Vendas"),
      "LineChart",
      "data-dados",
    );

    expect(dados.map((d: { mes: string }) => d.mes)).toEqual([
      "2024",
      "2025",
      "2026",
    ]);
    expect(dados.map((d: { total: number }) => d.total)).toEqual([
      1266, 1410, 249,
    ]);
  });

  it("24 meses exatos continuam mensais", () => {
    ESTADO_VENDAS.meses = 24;
    render(<Vendas />);
    expect(
      json(cartaoDoGrafico("Evolução das Vendas"), "LineChart", "data-dados"),
    ).toHaveLength(24);
  });

  it("o eixo de valor abrevia, e o balao usa a mesma abreviacao", () => {
    render(<Vendas />);
    const cartao = cartaoDoGrafico("Evolução das Vendas");

    const eixoY = cartao.querySelector('[data-grafico="YAxis"]') as HTMLElement;
    expect(
      JSON.parse(eixoY.getAttribute("data-rotulos")!).map((t: string) =>
        t.replace(/\u00a0/g, " "),
      ),
    ).toEqual(["R$ 0", "R$ 999,5", "R$ 2,4 mil", "R$ 2,5 mi"]);
    expect(cartao.querySelector("[data-formatado]")).toHaveTextContent(
      "R$ 2,4 mil",
    );
  });
});

describe("Top 5 Produtos", () => {
  it("os cinco primeiros do ranking, e o sem descricao vira 'Sem descrição'", () => {
    render(<Vendas />);
    const cartao = cartaoDoGrafico("Top 5 Produtos");

    expect(json(cartao, "BarChart", "data-dados")).toEqual([
      { produto: "Bafômetro Phoebus Premium XL", valor: 6000 },
      { produto: "Bocal descartável", valor: 5000 },
      { produto: "Sem descrição", valor: 4000 },
      { produto: "Kit calibração", valor: 3000 },
      { produto: "Sensor", valor: 2000 },
    ]);
    expect(atributo(cartao, "Bar", "data-serie")).toBe("valor");
  });

  it("o eixo dos nomes corta em 15, o de valor abrevia", () => {
    render(<Vendas />);
    const cartao = cartaoDoGrafico("Top 5 Produtos");

    const eixos = cartao.querySelectorAll("[data-grafico$='Axis']");
    const x = JSON.parse(eixos[0].getAttribute("data-rotulos")!);
    const y = JSON.parse(eixos[1].getAttribute("data-rotulos")!).map(
      (t: string) => t.replace(/\u00a0/g, " "),
    );
    expect(x[0]).toBe("Bafômetro Phoeb...");
    expect(x[4]).toBe("Sensor");
    expect(y).toEqual(["R$ 0", "R$ 999,5", "R$ 2,4 mil", "R$ 2,5 mi"]);
  });

  it("o balao mostra o nome inteiro e o valor em reais", () => {
    render(<Vendas />);
    const primeiro = balao(cartaoDoGrafico("Top 5 Produtos"), 0);

    expect(primeiro).toHaveTextContent("Bafômetro Phoebus Premium XL");
    expect(primeiro).toHaveTextContent("R$ 6.000,00");
  });
});

describe("Top 5 Vendedores", () => {
  it("os cinco primeiros do ranking, com o 'Não informado' no meio", () => {
    render(<Vendas />);
    const cartao = cartaoDoGrafico("Top 5 Vendedores");

    expect(json(cartao, "BarChart", "data-dados")).toEqual([
      { vendedor: "Maria Aparecida dos Santos", valor: 60000 },
      { vendedor: "Vendedor B", valor: 50000 },
      { vendedor: "Não informado", valor: 40000 },
      { vendedor: "Vendedor C", valor: 30000 },
      { vendedor: "Vendedor D", valor: 20000 },
    ]);
  });

  it("o eixo dos nomes corta em 15 no desktop, o de valor abrevia", () => {
    render(<Vendas />);
    const cartao = cartaoDoGrafico("Top 5 Vendedores");

    const eixos = cartao.querySelectorAll("[data-grafico$='Axis']");
    const x = JSON.parse(eixos[0].getAttribute("data-rotulos")!).map(
      (t: string) => t.replace(/\u00a0/g, " "),
    );
    const y = JSON.parse(eixos[1].getAttribute("data-rotulos")!);
    expect(x).toEqual(["R$ 0", "R$ 999,5", "R$ 2,4 mil", "R$ 2,5 mi"]);
    expect(y[0]).toBe("Maria Aparecida...");
    expect(y[1]).toBe("Vendedor B");
  });

  it("o balao mostra o nome inteiro e o valor em reais", () => {
    render(<Vendas />);
    const primeiro = balao(cartaoDoGrafico("Top 5 Vendedores"), 0);

    expect(primeiro).toHaveTextContent("Maria Aparecida dos Santos");
    expect(primeiro).toHaveTextContent("R$ 60.000,00");
  });
});

describe("Distribuicao por Empresa", () => {
  it("os oito maiores clientes, e o sem nome vira 'Não informado'", () => {
    render(<Vendas />);
    const cartao = cartaoDoGrafico("Distribuição por Empresa");

    const dados = json(cartao, "Pie", "data-dados");
    expect(dados).toHaveLength(8);
    expect(dados[0]).toEqual({ name: "Cliente 0", value: 9000 });
    expect(dados[1]).toEqual({ name: "Não informado", value: 8900 });
    expect(dados[7]).toEqual({ name: "Cliente 7", value: 8300 });
    expect(atributo(cartao, "Pie", "data-serie")).toBe("value");
  });

  it("cada fatia leva a porcentagem arredondada", () => {
    render(<Vendas />);
    const fatias = json(
      cartaoDoGrafico("Distribuição por Empresa"),
      "Pie",
      "data-fatias",
    );
    // 9.000 de 69.200 são 13%; 8.300 são 12%.
    expect(fatias[0]).toBe("13%");
    expect(fatias[7]).toBe("12%");
  });

  it("o balao mostra o nome e o valor abreviado", () => {
    render(<Vendas />);
    const primeiro = balao(cartaoDoGrafico("Distribuição por Empresa"), 0);

    expect(primeiro).toHaveTextContent("Cliente 0");
    expect(primeiro).toHaveTextContent("valor: R$ 9 mil");
  });
});

describe("graficos sem dado em Vendas", () => {
  it("com resumo vazio, os quatro cartoes dizem que nao ha dado, e nao desenham eixo", () => {
    // Desenhavam grade e eixos em branco sob o título, e a pizza nada — lia
    // como tela quebrada.
    ESTADO_VENDAS.vazio = true;
    render(<Vendas />);

    for (const titulo of [
      "Evolução das Vendas",
      "Top 5 Produtos",
      "Top 5 Vendedores",
      "Distribuição por Empresa",
    ]) {
      const cartao = cartaoDoGrafico(titulo);
      expect(cartao).toHaveTextContent(
        "Nenhuma venda no período para montar este gráfico.",
      );
      expect(cartao.querySelector("[data-grafico]")).toBeNull();
    }
  });

  it("um grafico sem dado nao apaga os outros", () => {
    // Um mês só: a evolução tem ponto, e os rankings também.
    ESTADO_VENDAS.meses = 1;
    render(<Vendas />);
    expect(
      cartaoDoGrafico("Evolução das Vendas").querySelector("[data-grafico]"),
    ).not.toBeNull();
  });
});
