import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Estoque from "./Estoque";

/**
 * Os três gráficos de Estoque: que estão na tela, sob o título certo, e que
 * cada um recebe o array certo.
 *
 * Mesmo dublê de `Vendedores.graficos.test.tsx`: cada peça que recebe dado
 * anota no DOM o array (`data-dados`) e a série (`data-serie`), e a asserção
 * prende **título do cartão → array recebido**. O `Tooltip` fica mudo — os
 * popovers têm arquivo próprio (`Estoque.popover.test.tsx`).
 *
 * Com o fixture de `estoque/produtosFalsos.ts`:
 *   - só 1, 2 e 5 têm saldo E preço positivos — o 3 (saldo 0), o 4 (saldo
 *     negativo) e o 6 (preço 0) ficam fora das barras e da distribuição;
 *   - o nome do 1 passa de 20 caracteres, e cada gráfico o corta num ponto.
 */

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const { ESTADO } = vi.hoisted(() => ({
  ESTADO: { grande: false, vazio: false },
}));

/** Doze produtos ativos, todos com saldo e preço, valor 1.200 → 100 — para
 *  provar o corte do Top 10 e o da distribuição em oito. */
const ESTOQUE_GRANDE = Array.from({ length: 12 }, (_, i) => ({
  id: 100 + i,
  nome: `Item ${String(i).padStart(2, "0")}`,
  codigo: `G${i}`,
  unidade: "UN",
  preco: 1,
  saldo: 1200 - i * 100,
  situacao: "A" as const,
}));

vi.mock("../context/EstoqueContext", async () => {
  const { PRODUTOS_ESTOQUE } = await import("./estoque/produtosFalsos");
  return {
    useEstoque: () => ({
      produtos: ESTADO.vazio
        ? []
        : ESTADO.grande
          ? ESTOQUE_GRANDE
          : PRODUTOS_ESTOQUE,
      carregando: false,
      atualizarProdutos: vi.fn(),
    }),
  };
});

vi.mock("../components/SolicitacaoComprasModal", () => ({
  default: () => null,
}));

vi.mock("recharts", () => {
  const semDesenho = () => null;
  const comDados =
    (nome: string) =>
    ({
      data,
      dataKey,
      children,
    }: {
      data?: unknown[];
      dataKey?: string;
      children?: React.ReactNode;
    }) => (
      <div
        data-grafico={nome}
        {...(data ? { "data-dados": JSON.stringify(data) } : {})}
        {...(dataKey ? { "data-serie": dataKey } : {})}
      >
        {children}
      </div>
    );
  return {
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    BarChart: comDados("BarChart"),
    PieChart: comDados("PieChart"),
    Bar: comDados("Bar"),
    Pie: comDados("Pie"),
    Cell: semDesenho,
    XAxis: semDesenho,
    YAxis: semDesenho,
    Tooltip: semDesenho,
    CartesianGrid: semDesenho,
    Legend: semDesenho,
  };
});

beforeEach(() => {
  ESTADO.grande = false;
  ESTADO.vazio = false;
});

function cartaoDoGrafico(titulo: string): HTMLElement {
  const alvo = screen.getByRole("heading", { name: titulo }).parentElement;
  if (!alvo) throw new Error(`cartao "${titulo}" nao encontrado`);
  return alvo;
}

function dadosEm(cartao: HTMLElement, nome: string): Record<string, unknown>[] {
  const peca = cartao.querySelector(`[data-grafico="${nome}"][data-dados]`);
  if (!peca) throw new Error(`${nome} sem dados neste cartao`);
  return JSON.parse(peca.getAttribute("data-dados")!);
}

function serieEm(cartao: HTMLElement): string | null {
  return (
    cartao.querySelector("[data-serie]")?.getAttribute("data-serie") ?? null
  );
}

describe("graficos de Estoque", () => {
  it("Top 10 recebe so quem tem saldo e preco, do maior valor ao menor, com o nome cortado em 20", () => {
    render(<Estoque />);

    const cartao = cartaoDoGrafico("Top 10 Produtos em Estoque");

    expect(serieEm(cartao)).toBe("valor");
    expect(dadosEm(cartao, "BarChart")).toEqual([
      {
        nome: "Kit calibração",
        fullName: "Kit calibração",
        valor: 3600,
        unidade: "KT",
      },
      {
        nome: "Bafômetro Phoebus Pr...",
        fullName: "Bafômetro Phoebus Premium Edition XL",
        valor: 2500,
        unidade: "UN",
      },
      {
        nome: "Tubo descartável",
        fullName: "Tubo descartável",
        valor: 500,
        unidade: "CX",
      },
    ]);
  });

  it("Distribuicao de Valor recebe os mesmos produtos, com o nome cortado em 15", () => {
    render(<Estoque />);

    const cartao = cartaoDoGrafico("Distribuição de Valor em Estoque");

    expect(serieEm(cartao)).toBe("value");
    expect(dadosEm(cartao, "Pie")).toEqual([
      { name: "Kit calibração", fullName: "Kit calibração", value: 3600 },
      {
        name: "Bafômetro Phoeb...",
        fullName: "Bafômetro Phoebus Premium Edition XL",
        value: 2500,
      },
      // "Tubo descartável" tem 16 caracteres: também passa de 15 e é cortado.
      { name: "Tubo descartáve...", fullName: "Tubo descartável", value: 500 },
    ]);
  });

  it("Situacao dos Produtos conta ativos e inativos", () => {
    render(<Estoque />);

    const cartao = cartaoDoGrafico("Situação dos Produtos");

    expect(dadosEm(cartao, "Pie")).toEqual([
      { name: "Ativos", value: 4 },
      { name: "Inativos", value: 2 },
    ]);
  });

  it("com mais de dez elegiveis, o Top 10 corta em dez, e a distribuicao em oito", () => {
    ESTADO.grande = true;
    render(<Estoque />);

    const barras = dadosEm(
      cartaoDoGrafico("Top 10 Produtos em Estoque"),
      "BarChart",
    );
    const fatias = dadosEm(
      cartaoDoGrafico("Distribuição de Valor em Estoque"),
      "Pie",
    );

    expect(barras.map((b) => b.nome)).toEqual(
      Array.from(
        { length: 10 },
        (_, i) => `Item ${String(i).padStart(2, "0")}`,
      ),
    );
    expect(fatias.map((f) => f.name)).toEqual(
      Array.from({ length: 8 }, (_, i) => `Item ${String(i).padStart(2, "0")}`),
    );
  });

  it("situacao sem nenhum inativo nao desenha fatia de zero", () => {
    ESTADO.grande = true;
    render(<Estoque />);

    expect(dadosEm(cartaoDoGrafico("Situação dos Produtos"), "Pie")).toEqual([
      { name: "Ativos", value: 12 },
    ]);
  });

  it.each([
    "Top 10 Produtos em Estoque",
    "Distribuição de Valor em Estoque",
    "Situação dos Produtos",
  ])(
    "sem produto, %s diz que nao ha o que mostrar, em vez de moldura muda",
    (titulo) => {
      // Gráfico sem dado não desenha nada útil: as barras pintam um eixo em
      // branco e as pizzas nada. Item 6 do checklist de tela migrada.
      ESTADO.vazio = true;
      render(<Estoque />);

      const cartao = cartaoDoGrafico(titulo);
      expect(cartao).toHaveTextContent(
        "Nenhum produto para montar este gráfico.",
      );
      expect(cartao.querySelector("[data-grafico]")).toBeNull();
    },
  );
});
