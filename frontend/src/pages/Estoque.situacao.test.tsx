import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import Estoque from "./Estoque";

/**
 * O balão da pizza "Situação dos Produtos" mostra a porcentagem da fatia.
 *
 * Em produção ele mostrava "NaN%" (conferido no navegador em 15/09): o balão lia
 * `percent` de `payload[0].payload`, que é o DADO da fatia (`{ name, value }`) —
 * e o recharts não põe `percent` ali. O teste de popover não via porque o dublê
 * dele (`Estoque.popover.test.tsx`) coloca `percent` justamente nesse lugar.
 *
 * O dublê daqui é fiel nesse ponto: o `Pie` guarda o `data` que recebeu, e o
 * `Tooltip` chama `content` com `payload[0].payload` igual ao item do `data`,
 * sem nada a mais. Com o fixture de `estoque/produtosFalsos.ts`: 4 ativos e 2
 * inativos — 67% e 33%.
 */

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

vi.mock("../context/EstoqueContext", async () => {
  const { PRODUTOS_ESTOQUE } = await import("./estoque/produtosFalsos");
  return {
    useEstoque: () => ({
      produtos: PRODUTOS_ESTOQUE,
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
  // O `data` do `Pie` do gráfico que está sendo desenhado agora. Cada gráfico
  // zera antes dos filhos (o corpo do componente roda antes do dos filhos), e o
  // `Pie` o preenche antes do `Tooltip` irmão — assim cada balão só vê a
  // própria pizza.
  let dadoDaPizza: { name: string; value: number }[] | null = null;
  return {
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    BarChart: ({ children }: { children?: ReactNode }) => {
      dadoDaPizza = null;
      return <div>{children}</div>;
    },
    PieChart: ({
      children,
      onClick,
    }: {
      children?: ReactNode;
      onClick?: () => void;
    }) => {
      dadoDaPizza = null;
      return (
        <div data-testid="pie-chart" onClick={onClick}>
          {children}
        </div>
      );
    },
    Pie: ({ data }: { data: { name: string; value: number }[] }) => {
      dadoDaPizza = data;
      return null;
    },
    // O recharts entrega ao `content` o item do `data` da fatia, sem `percent`.
    Tooltip: ({ content }: { content?: (p: unknown) => ReactNode }) => {
      const dados = dadoDaPizza;
      if (!content || !dados || dados[0]?.name !== "Ativos") return null;
      return (
        <>
          {dados.map((fatia) => (
            <div key={fatia.name} data-balao={fatia.name}>
              {content({
                active: true,
                payload: [
                  { name: fatia.name, value: fatia.value, payload: fatia },
                ],
              })}
            </div>
          ))}
        </>
      );
    },
    Bar: semDesenho,
    Cell: semDesenho,
    XAxis: semDesenho,
    YAxis: semDesenho,
    CartesianGrid: semDesenho,
    Legend: semDesenho,
  };
});

describe("balao da pizza de situacao em Estoque", () => {
  it("mostra a porcentagem de cada fatia, e nao NaN", () => {
    render(<Estoque />);

    // A pizza de situação é a segunda; o clique abre o popover dela.
    fireEvent.click(screen.getAllByTestId("pie-chart")[1]);

    const ativos = document.querySelector(
      '[data-balao="Ativos"]',
    ) as HTMLElement;
    const inativos = document.querySelector(
      '[data-balao="Inativos"]',
    ) as HTMLElement;
    expect(ativos).toHaveTextContent("Quantidade: 4");
    expect(ativos).toHaveTextContent("67%");
    expect(inativos).toHaveTextContent("33%");
    expect(document.body).not.toHaveTextContent("NaN");
  });
});
