import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Estoque from "./Estoque";

/**
 * Caracterização do que `isMobile` controla em Estoque, antes de a cópia local
 * virar `src/hooks/useIsMobile.ts` (item 5 da Fase 4).
 *
 * Arquivo separado do `Estoque.popover.test.tsx` de propósito: lá o dublê de
 * `Tooltip` devolve um fragment, e publicar uma prop exigiria envolvê-lo num
 * elemento — o que muda a árvore que os testes de lá percorrem, um deles
 * subindo `parentElement` duas vezes. Aqui o dublê expõe o `height` do
 * `ResponsiveContainer` e o `trigger` do `Tooltip`, as duas props que
 * `isMobile` controla.
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
];

vi.mock("../context/EstoqueContext", () => ({
  useEstoque: () => ({
    produtos: PRODUTOS_ESTOQUE,
    carregando: false,
    atualizarProdutos: vi.fn(),
  }),
}));

/** Cada render do `Tooltip` empilha aqui o `trigger` que recebeu, na ordem em
 *  que o recharts o chamaria. É o que permite provar o defeito do estado
 *  inicial: `render()` do Testing Library flush o efeito de correção antes de
 *  devolver o controle ao teste, então o DOM final é sempre o mesmo — correto
 *  ou não o inicializador. Só o PRIMEIRO valor da pilha denuncia se a tela
 *  nasceu com o gesto errado. Ver o teste "montando ja estreito" abaixo. */
let chamadasDoTrigger: Array<string | undefined> = [];

vi.mock("recharts", () => {
  const semDesenho = () => null;
  return {
    ResponsiveContainer: ({
      children,
      height,
    }: {
      children?: ReactNode;
      height?: number;
    }) => (
      <div data-testid="grafico" data-height={String(height)}>
        {children}
      </div>
    ),
    BarChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    LineChart: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    PieChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Bar: semDesenho,
    Line: semDesenho,
    Pie: semDesenho,
    Cell: semDesenho,
    XAxis: semDesenho,
    YAxis: semDesenho,
    Tooltip: ({ trigger }: { trigger?: string }) => {
      chamadasDoTrigger.push(trigger);
      return <div data-testid="tooltip" data-trigger={trigger} />;
    },
    CartesianGrid: semDesenho,
    Legend: semDesenho,
  };
});

const LARGURA_ORIGINAL = window.innerWidth;

function redimensionarPara(largura: number) {
  Object.defineProperty(window, "innerWidth", {
    value: largura,
    writable: true,
    configurable: true,
  });
  fireEvent(window, new Event("resize"));
}

afterEach(() => {
  Object.defineProperty(window, "innerWidth", {
    value: LARGURA_ORIGINAL,
    writable: true,
    configurable: true,
  });
  chamadasDoTrigger = [];
});

describe("Estoque — o que muda em tela pequena", () => {
  it("o grafico e mais alto em celular do que no desktop", () => {
    render(<Estoque />);
    expect(screen.getAllByTestId("grafico")[0]).toHaveAttribute(
      "data-height",
      "300",
    );

    redimensionarPara(375);

    expect(screen.getAllByTestId("grafico")[0]).toHaveAttribute(
      "data-height",
      "420",
    );
  });

  it("639 e celular e 640 nao — o limite e exclusivo", () => {
    render(<Estoque />);

    redimensionarPara(639);
    expect(screen.getAllByTestId("grafico")[0]).toHaveAttribute(
      "data-height",
      "420",
    );

    redimensionarPara(640);
    expect(screen.getAllByTestId("grafico")[0]).toHaveAttribute(
      "data-height",
      "300",
    );
  });

  it("em celular o popover abre no toque; no desktop, no hover", () => {
    render(<Estoque />);
    // O primeiro Tooltip (barra do ranking) nao recebe `trigger` — o alvo e
    // o segundo, da pizza de Distribuicao de Valor, que e o unico do arquivo
    // controlado por `isMobile`.
    // É o único uso de `isMobile` no projeto que muda INTERAÇÃO, e não
    // aparência: em tela pequena o popover do gráfico abre no toque, porque
    // hover não existe em celular.
    expect(screen.getAllByTestId("tooltip")[1]).toHaveAttribute(
      "data-trigger",
      "hover",
    );

    redimensionarPara(375);

    expect(screen.getAllByTestId("tooltip")[1]).toHaveAttribute(
      "data-trigger",
      "click",
    );
  });

  it("montando ja estreito, o popover ja nasce no modo toque", () => {
    redimensionarPara(375);
    render(<Estoque />);

    // O DOM final não prova nada aqui: `render()` já flusha o efeito de
    // correção antes de devolver o controle ao teste, então o Tooltip acaba
    // em "click" mesmo com o inicializador antigo (`useState(false)`) — só
    // muda o CAMINHO até lá. `chamadasDoTrigger[1]` é o primeiro valor que o
    // Tooltip da pizza recebeu, antes de qualquer correção: com o defeito ele
    // nasce em "hover" e só depois troca para "click", que é exatamente o
    // instante em que a tela responde ao gesto errado.
    expect(chamadasDoTrigger[1]).toBe("click");
  });
});
