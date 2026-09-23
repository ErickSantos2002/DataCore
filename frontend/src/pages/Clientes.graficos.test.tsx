import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Clientes from "./Clientes";
import {
  ESTADO_CLIENTES,
  HOJE_CLIENTES,
  reiniciarEstadoDeClientes,
} from "./clientes/clientesFalsos";

/**
 * O "Top 10 Clientes": que está na tela, sob o título certo, e o que ele
 * recebe e mostra.
 *
 * Com o recharts de verdade o jsdom mede 0x0 e não desenha nada, em silêncio.
 * O dublê daqui anota no DOM o array do `BarChart` (`data-dados`), a série da
 * `Bar` (`data-serie`) e o que os `tickFormatter` dos dois eixos escrevem
 * (`data-rotulos`), e chama o `content` do `Tooltip` para cada barra — com
 * `payload[0].payload` igual ao item do `data`, sem nada a mais, que é o que o
 * recharts entrega.
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
  // O `data` do `BarChart` que está sendo desenhado: o corpo do gráfico roda
  // antes do corpo dos filhos, então eixos e balão leem o array certo.
  let dadosDoGrafico: Record<string, unknown>[] = [];
  return {
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    BarChart: ({
      data,
      children,
    }: {
      data?: Record<string, unknown>[];
      children?: React.ReactNode;
    }) => {
      dadosDoGrafico = data ?? [];
      return (
        <div data-grafico="BarChart" data-dados={JSON.stringify(data)}>
          {children}
        </div>
      );
    },
    Bar: ({ dataKey }: { dataKey?: string }) => (
      <div data-grafico="Bar" data-serie={dataKey} />
    ),
    XAxis: ({ tickFormatter }: { tickFormatter?: (v: number) => string }) => (
      <div
        data-grafico="XAxis"
        data-rotulos={JSON.stringify(
          [0, 880, 50000.5, 2500000].map((v) =>
            tickFormatter ? tickFormatter(v) : v,
          ),
        )}
      />
    ),
    YAxis: ({
      dataKey,
      tickFormatter,
    }: {
      dataKey?: string;
      tickFormatter?: (v: string) => string;
    }) => (
      <div
        data-grafico="YAxis"
        data-rotulos={JSON.stringify(
          dadosDoGrafico.map((d) => {
            const v = String(d[dataKey ?? ""]);
            return tickFormatter ? tickFormatter(v) : v;
          }),
        )}
      />
    ),
    Tooltip: ({ content }: { content?: (p: unknown) => React.ReactNode }) => {
      if (typeof content !== "function") return null;
      return (
        <>
          {dadosDoGrafico.map((d, i) => (
            <div key={i} data-balao={i}>
              {content({ active: true, payload: [{ payload: d }] })}
            </div>
          ))}
        </>
      );
    },
    LineChart: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    PieChart: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Line: semDesenho,
    Pie: semDesenho,
    Cell: semDesenho,
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

/** O cartão do gráfico pelo título — sobe do `<h3>` até o container dele. */
function cartaoDoGrafico(titulo: string): HTMLElement {
  const alvo = screen.getByRole("heading", { name: titulo }).parentElement;
  if (!alvo) throw new Error(`cartao "${titulo}" nao encontrado`);
  return alvo;
}

function atributo(cartao: HTMLElement, peca: string, nome: string): string {
  const el = cartao.querySelector(`[data-grafico="${peca}"]`);
  if (!el) throw new Error(`${peca} nao encontrado no cartao`);
  return el.getAttribute(nome) ?? "";
}

describe("Top 10 Clientes", () => {
  it("recebe os dez primeiros do ranking, na ordem do banco", () => {
    render(<Clientes />);
    const cartao = cartaoDoGrafico("Top 10 Clientes");

    const dados = JSON.parse(atributo(cartao, "BarChart", "data-dados"));
    expect(dados).toHaveLength(10);
    expect(dados.map((d: { nomeCompleto: string }) => d.nomeCompleto)).toEqual([
      "Alfa Mineração Recife Ltda",
      "Beta Logística",
      "Não informado",
      "Gama Saúde",
      "Delta Engenharia",
      "Cliente 06",
      "Cliente 07",
      "Cliente 08",
      "Cliente 09",
      "Cliente 10",
    ]);
    expect(dados.map((d: { valor: number }) => d.valor)).toEqual([
      50000.5, 30000, 20000, 15000, 9000, 940, 930, 920, 910, 900,
    ]);
  });

  it("a barra desenha o valor", () => {
    render(<Clientes />);
    expect(
      atributo(cartaoDoGrafico("Top 10 Clientes"), "Bar", "data-serie"),
    ).toBe("valor");
  });

  it("o eixo dos nomes corta em 18 caracteres no desktop", () => {
    render(<Clientes />);
    const rotulos = JSON.parse(
      atributo(cartaoDoGrafico("Top 10 Clientes"), "YAxis", "data-rotulos"),
    );
    expect(rotulos[0]).toBe("Alfa Mineração Rec...");
    expect(rotulos[1]).toBe("Beta Logística");
  });

  it("o eixo dos valores abrevia em mil e mi, com virgula", () => {
    // Saía "R$ 0.00", "R$ 50.0K" e "R$ 2.5M": ponto decimal e sufixo do
    // inglês. O formato agora é o de `lib/dinheiro.ts` (decisão de 22/09).
    render(<Clientes />);
    expect(
      JSON.parse(
        atributo(cartaoDoGrafico("Top 10 Clientes"), "XAxis", "data-rotulos"),
      ).map((t: string) => t.replace(/\u00a0/g, " ")),
    ).toEqual(["R$ 0", "R$ 880", "R$ 50 mil", "R$ 2,5 mi"]);
  });

  it("o balao mostra o nome inteiro e o valor em reais", () => {
    render(<Clientes />);
    const balao = document.querySelector('[data-balao="0"]') as HTMLElement;

    expect(balao).toHaveTextContent("Alfa Mineração Recife Ltda");
    expect(balao).toHaveTextContent("R$ 50.000,50");
  });

  it("com resumo vazio, o cartao diz que nao ha dado, e nao desenha eixo", () => {
    // Desenhava a grade e os eixos em branco sob o título, que lia como tela
    // quebrada.
    ESTADO_CLIENTES.vazio = true;
    render(<Clientes />);
    const cartao = cartaoDoGrafico("Top 10 Clientes");

    expect(cartao).toHaveTextContent(
      "Nenhum cliente no período para montar este gráfico.",
    );
    expect(cartao.querySelector('[data-grafico="BarChart"]')).toBeNull();
  });
});
