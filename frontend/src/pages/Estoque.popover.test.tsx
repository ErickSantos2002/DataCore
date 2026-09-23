import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import Estoque from "./Estoque";

/**
 * Caracterização dos DOIS popovers de pizza de Estoque, antes de o clique
 * fora virar `useCliqueFora` (item 6 da Fase 4).
 *
 * Por que este arquivo tem um dublê de recharts diferente dos outros: nos
 * demais testes de Estoque o `Tooltip` é `() => null`, porque nenhum deles
 * olha para gráfico. Aqui o popover É o `Tooltip` — trocá-lo por `null`
 * apagaria justamente o que se quer observar, e o teste passaria verde sem
 * provar nada. O dublê abaixo chama `content` com `active: true`, que é o
 * que o recharts faz quando o ponteiro está sobre uma fatia; o `content` de
 * Estoque devolve `null` sozinho quando o popover está fechado — é ele quem
 * decide, e é essa decisão que o teste observa.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const PRODUTOS_ESTOQUE = [
  {
    id: 1,
    nome: "Bafômetro Phoebus",
    codigo: "1.163",
    unidade: "UN",
    preco: 250,
    saldo: 10,
    situacao: "A" as const,
  },
  {
    id: 2,
    nome: "Tubo descartável",
    codigo: "P2",
    unidade: "UN",
    preco: 5,
    saldo: 100,
    situacao: "A" as const,
  },
];

vi.mock("../context/EstoqueContext", () => ({
  useEstoque: () => ({
    produtos: PRODUTOS_ESTOQUE,
    carregando: false,
    atualizarProdutos: vi.fn(),
  }),
}));

/** O payload que o recharts entregaria ao `content` de uma fatia. Traz os
 *  campos que os DOIS popovers leem: `fullName`/`value` no de distribuição,
 *  `name`/`value`/`percent` no de situação. Um `percent` ausente faria
 *  `(percent * 100).toFixed(0)` estourar dentro do componente. */
const FATIA = {
  payload: [
    {
      payload: {
        fullName: "Bafômetro Phoebus",
        name: "Ativos",
        value: 2500,
        percent: 0.5,
      },
    },
  ],
};

vi.mock("recharts", () => {
  const semDesenho = () => null;
  return {
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    BarChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    LineChart: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    // Expõe o `onClick` que abre o popover no tap. O `data-testid` é costura
    // de teste deliberada: o dublê não reproduz a árvore do recharts, então
    // alcançar o nó por CSS seria alcançar um detalhe do próprio dublê.
    PieChart: ({
      children,
      onClick,
    }: {
      children?: ReactNode;
      onClick?: () => void;
    }) => (
      <div data-testid="pie-chart" onClick={onClick}>
        {children}
      </div>
    ),
    // Chama `content` como o recharts chamaria com o ponteiro sobre a fatia.
    Tooltip: ({
      content,
    }: {
      content?: (p: typeof FATIA & { active: boolean }) => ReactNode;
    }) => (content ? <>{content({ active: true, ...FATIA })}</> : null),
    Bar: semDesenho,
    Line: semDesenho,
    Pie: semDesenho,
    Cell: semDesenho,
    XAxis: semDesenho,
    YAxis: semDesenho,
    CartesianGrid: semDesenho,
    Legend: semDesenho,
  };
});

/** Os dois `PieChart`, na ordem de montagem: [0] é "Distribuição de Valor em
 *  Estoque", [1] é "Situação dos Produtos". */
const DISTRIBUICAO = 0;
const SITUACAO = 1;

/** O container com `ref={pizza*Ref}` e `className="relative"` — é ele que
 *  leva o `onKeyDown`. No dublê a árvore é
 *  `div.relative > div (ResponsiveContainer) > div[data-testid=pie-chart]`,
 *  então o container é o avô do gráfico. */
function containerDo(indice: number) {
  return screen.getAllByTestId("pie-chart")[indice].parentElement!
    .parentElement!;
}

describe("Estoque — popovers de pizza", () => {
  it("o popover de distribuicao abre no clique e fecha ao clicar fora", () => {
    render(<Estoque />);
    expect(screen.queryByText("valor: R$ 2.500,00")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByTestId("pie-chart")[DISTRIBUICAO]);
    expect(screen.getByText("valor: R$ 2.500,00")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("valor: R$ 2.500,00")).not.toBeInTheDocument();
  });

  it("o popover de situacao abre no clique e fecha ao clicar fora", () => {
    render(<Estoque />);
    expect(screen.queryByText("Quantidade: 2500")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByTestId("pie-chart")[SITUACAO]);
    expect(screen.getByText("Quantidade: 2500")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Quantidade: 2500")).not.toBeInTheDocument();
  });

  it("tocar fora TAMBEM fecha — o Estoque e a unica das tres que ja acerta", () => {
    render(<Estoque />);
    fireEvent.click(screen.getAllByTestId("pie-chart")[SITUACAO]);
    expect(screen.getByText("Quantidade: 2500")).toBeInTheDocument();

    fireEvent.touchStart(document.body);
    expect(screen.queryByText("Quantidade: 2500")).not.toBeInTheDocument();
  });

  it("Escape fecha o popover de distribuicao", () => {
    render(<Estoque />);
    fireEvent.click(screen.getAllByTestId("pie-chart")[DISTRIBUICAO]);
    expect(screen.getByText("valor: R$ 2.500,00")).toBeInTheDocument();

    fireEvent.keyDown(containerDo(DISTRIBUICAO), { key: "Escape" });

    expect(screen.queryByText("valor: R$ 2.500,00")).not.toBeInTheDocument();
  });

  it("Escape fecha o popover de situacao", () => {
    render(<Estoque />);
    fireEvent.click(screen.getAllByTestId("pie-chart")[SITUACAO]);
    expect(screen.getByText("Quantidade: 2500")).toBeInTheDocument();

    fireEvent.keyDown(containerDo(SITUACAO), { key: "Escape" });

    expect(screen.queryByText("Quantidade: 2500")).not.toBeInTheDocument();
  });

  // Os dois testes de clique fora acima fecham o popover com um mousedown em
  // document.body — um alvo fora das DUAS refs. Nesse cenário os dois
  // handlers disparam igual, pareado certo ou trocado, e o teste não provaria
  // nada sobre qual ref vai com qual setter. Este aqui abre os dois popovers
  // e clica DENTRO de um deles: só prova o pareamento correto se o clique
  // fechar o outro popover e preservar o que foi clicado.
  it("clicar dentro de um popover fecha so o outro, nao o proprio", () => {
    render(<Estoque />);
    fireEvent.click(screen.getAllByTestId("pie-chart")[DISTRIBUICAO]);
    fireEvent.click(screen.getAllByTestId("pie-chart")[SITUACAO]);
    expect(screen.getByText("valor: R$ 2.500,00")).toBeInTheDocument();
    expect(screen.getByText("Quantidade: 2500")).toBeInTheDocument();

    // Dentro do popover de situacao, fora do de distribuicao.
    fireEvent.mouseDown(screen.getByText("Quantidade: 2500"));

    expect(screen.queryByText("valor: R$ 2.500,00")).not.toBeInTheDocument();
    expect(screen.getByText("Quantidade: 2500")).toBeInTheDocument();
  });
});
