import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GraficosDeProdutos } from "./GraficosDeProdutos";
import type { PontoDeEvolucao, ProdutoAgregado } from "./produtos";

/**
 * Os dois gráficos de Produtos, provados pelo que DESENHAM.
 *
 * Os cinco `Produtos.*.test.tsx` leem o `data-serie` que o dublê de recharts
 * escreve, e isso prova o dado ENTREGUE ao gráfico — nunca qual campo daquele
 * dado o gráfico plota. A revisão final de 10/09/2026 mostrou o preço: trocar
 * o `dataKey` da linha de `"total"` para `"ordem"` e o do eixo X de `"mes"`
 * para `"ano"` passava verde nas oito suítes de Produtos.
 *
 * Cenário do primeiro: a "Evolução da Quantidade de Produtos Vendidos" passa a
 * plotar o `ordem`, que é `Date.getTime()` — cerca de 1,77 × 10¹² por ponto. A
 * linha vira uma reta colada no topo, o eixo Y sai em trilhões e ninguém mais
 * lê a evolução de itens vendidos. Cenário do segundo: o eixo X escreve
 * "2026, 2026, 2026" em vez de "jan/2026, fev/2026" — e acima de 24 meses fica
 * em BRANCO, porque o agrupamento anual não carrega `ano` por ponto (o tipo
 * `PontoDeEvolucao` marca o campo como opcional justamente por isso).
 *
 * Por isso o dublê daqui vai além de guardar a série: ele RESOLVE o `dataKey`
 * contra os dados do gráfico e escreve o resultado. O que se afirma passa a
 * ser a lista de números que a linha desenha e a lista de rótulos que o eixo
 * escreve — não uma prop.
 *
 * O `YAxis` segue a mesma ideia herdada do teste do tamanho de fonte: quando
 * `tick` é função, ele a CHAMA. Os `Produtos.*.test.tsx` fazem `YAxis: () =>
 * null`, e foi por isso que o `fontSize={11}` daquele eixo atravessou a
 * migração inteira sem ninguém ver. Aqui a render-prop roda uma vez por barra,
 * com o valor daquela barra — o que também exercita os três ramos de
 * `formatarDinheiroAbreviado` (`lib/dinheiro.ts`). O `<svg>` em volta é
 * necessário para o React criar o `<text>` no namespace certo.
 *
 * Continua sendo o NOSSO código sob teste: o recharts segue dublê, e o que se
 * mede são as props que `GraficosDeProdutos.tsx` escreve nele.
 */
vi.mock("recharts", async () => {
  const { createContext, useContext } = await import("react");

  interface Contexto {
    id: string;
    dados: Record<string, unknown>[];
  }

  const Grafico = createContext<Contexto>({ id: "", dados: [] });

  const grafico =
    (id: string) =>
    ({
      data,
      children,
    }: {
      data?: Record<string, unknown>[];
      children?: React.ReactNode;
    }) => (
      <Grafico.Provider value={{ id, dados: data ?? [] }}>
        <div data-testid={id} data-serie={JSON.stringify(data ?? [])}>
          {children}
        </div>
      </Grafico.Provider>
    );

  /** O que a peça desenha: cada ponto da série resolvido pelo `dataKey`. */
  const desenho =
    (sufixo: string) =>
    ({ dataKey }: { dataKey?: string }) => {
      const { id, dados } = useContext(Grafico);
      const valores = dados.map((ponto) => (dataKey ? ponto[dataKey] : null));
      return (
        <div
          data-testid={`${id}-${sufixo}`}
          data-desenhado={JSON.stringify(valores)}
        />
      );
    };

  return {
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    LineChart: grafico("grafico-evolucao"),
    BarChart: grafico("grafico-ranking"),
    Line: desenho("linha"),
    Bar: desenho("barra"),
    XAxis: desenho("eixo-x"),
    YAxis: ({ tick }: { tick?: unknown }) => {
      const { dados } = useContext(Grafico);
      if (typeof tick !== "function") return null;
      const marcar = tick as (props: unknown) => React.ReactNode;
      return (
        <svg>
          {dados.map((ponto, i) => (
            <g key={i}>
              {marcar({ x: 0, y: 0, payload: { value: ponto.valor } })}
            </g>
          ))}
        </svg>
      );
    },
    Tooltip: () => null,
    CartesianGrid: () => null,
  };
});

/**
 * Dois meses de evolução. O `mes` é literal, e não formatado por `Date`: o que
 * se prova aqui é qual CAMPO o eixo escreve, e um rótulo derivado de fuso
 * misturaria essa pergunta com a de `evolucaoDoResumo`, que tem teste próprio.
 *
 * O `ordem` é o carimbo de tempo usado só para ordenar — é ele que a plantação
 * do `dataKey` fazia a linha plotar.
 */
const EVOLUCAO: PontoDeEvolucao[] = [
  { mes: "jan/2026", total: 3, ordem: new Date(2026, 0).getTime(), ano: 2026 },
  { mes: "fev/2026", total: 5, ordem: new Date(2026, 1).getTime(), ano: 2026 },
];

/**
 * Três produtos cujos valores caem cada um num ramo de
 * `formatarDinheiroAbreviado` (`lib/dinheiro.ts`): milhão, milhar e unidade.
 */
const RANKING: ProdutoAgregado[] = [
  {
    chave: "P1",
    codigo: "P1",
    descricao: "Bafômetro Digital",
    quantidadeVendida: 10,
    valorTotal: 1_200_000,
    valorMedio: 120_000,
    numeroVendas: 3,
  },
  {
    chave: "P2",
    codigo: "P2",
    descricao: "Tubo Coletor de Amostra",
    quantidadeVendida: 4,
    valorTotal: 1500,
    valorMedio: 375,
    numeroVendas: 2,
  },
  {
    chave: "P3",
    codigo: "P3",
    descricao: "Máscara de Solda",
    quantidadeVendida: 1,
    valorTotal: 999,
    valorMedio: 999,
    numeroVendas: 1,
  },
];

/** O que uma peça do gráfico desenhou, lido do dublê. */
function desenhado(testId: string): unknown[] {
  return JSON.parse(screen.getByTestId(testId).dataset.desenhado ?? "[]");
}

describe("GraficosDeProdutos", () => {
  it("a linha da evolucao plota a quantidade do mes, e nao o carimbo de ordenacao", () => {
    render(<GraficosDeProdutos evolucao={EVOLUCAO} ranking={RANKING} />);

    expect(desenhado("grafico-evolucao-linha")).toEqual([3, 5]);
  });

  it("o eixo X da evolucao rotula com o mes, e nao com o ano", () => {
    render(<GraficosDeProdutos evolucao={EVOLUCAO} ranking={RANKING} />);

    expect(desenhado("grafico-evolucao-eixo-x")).toEqual([
      "jan/2026",
      "fev/2026",
    ]);
  });

  it("a barra do ranking plota o valor e e rotulada pelo nome do produto", () => {
    render(<GraficosDeProdutos evolucao={EVOLUCAO} ranking={RANKING} />);

    expect(desenhado("grafico-ranking-barra")).toEqual([1_200_000, 1500, 999]);
    expect(desenhado("grafico-ranking-eixo-x")).toEqual([
      "Bafômetro Digital",
      "Tubo Coletor de Amostra",
      "Máscara de Solda",
    ]);
  });

  it("o eixo Y do ranking abrevia milhao, milhar e unidade cada um na sua escala", () => {
    // A plantação que passava verde: dividir por 1.000 e continuar rotulando
    // "M". Um produto de R$ 1.200.000,00 ganharia o rótulo "R$ 1200.0M" — e o
    // único teste que existia aqui olhava só o `font-size`, com um valor de
    // milhar que nem passa por aquele ramo.
    render(<GraficosDeProdutos evolucao={EVOLUCAO} ranking={RANKING} />);

    expect(screen.getByText("R$ 1,2 mi")).toBeInTheDocument();
    expect(screen.getByText("R$ 1,5 mil")).toBeInTheDocument();
    expect(screen.getByText("R$ 999")).toBeInTheDocument();
  });

  it("o rotulo do eixo Y do ranking nao desce abaixo de 12px", () => {
    // Item 5 do checklist de tela migrada: 11px é abaixo do piso legível, e
    // rótulo de eixo é justamente o texto lido de relance. As outras três
    // marcações desta tela já usavam 12 — só esta destoava.
    render(<GraficosDeProdutos evolucao={EVOLUCAO} ranking={RANKING} />);

    const rotulo = screen.getByText("R$ 1,5 mil");

    expect(rotulo.getAttribute("font-size")).toBe("12");
  });
});
