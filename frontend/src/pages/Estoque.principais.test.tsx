import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Estoque from "./Estoque";

/**
 * O aviso de principal que sumiu do Tiny.
 *
 * A lista de "Principais" é cravada no código (decisão do Erick, 22/09), e a
 * suíte não fala com o banco — então quem percebe um código que deixou de
 * existir é a tela, na hora em que a pessoa liga o filtro. Sem o aviso, o
 * filtro só mostraria um produto a menos, calado.
 *
 * O estoque aqui é montado a partir da própria lista: os 29, ou os 29 menos o
 * 121. O fixture de seis produtos das outras suítes só tem três principais.
 */

const { ESTADO } = vi.hoisted(() => ({
  ESTADO: { semO121: false, vazio: false },
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

vi.mock("../context/EstoqueContext", async () => {
  const { PRODUTOS_PRINCIPAIS } = await import("./estoque/estoque");
  const TODOS = PRODUTOS_PRINCIPAIS.map((p, i) => ({
    id: i + 1,
    nome: p.nome,
    codigo: p.codigo,
    unidade: "UN",
    preco: 10,
    saldo: 1,
    situacao: "A" as const,
  }));
  const SEM_O_121 = TODOS.filter((p) => p.codigo !== "121");
  // Listas prontas: um `[]` novo a cada render muda a identidade que o
  // `usePaginacao` observa, e a tela entra em laço.
  const NENHUM: typeof TODOS = [];
  return {
    useEstoque: () => ({
      produtos: ESTADO.vazio ? NENHUM : ESTADO.semO121 ? SEM_O_121 : TODOS,
      carregando: false,
      erro: ESTADO.vazio ? "Não foi possível carregar o estoque." : null,
      atualizarProdutos: vi.fn(),
    }),
  };
});

vi.mock("../components/SolicitacaoComprasModal", () => ({
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
    PieChart: caixa,
    Bar: semDesenho,
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
  ESTADO.semO121 = false;
  ESTADO.vazio = false;
});

function ligarPrincipais() {
  const bloco = screen.getByText("Filtros Personalizados", {
    selector: "label",
  }).parentElement as HTMLElement;
  fireEvent.change(bloco.querySelector("select") as HTMLSelectElement, {
    target: { value: "rapido" },
  });
}

const AVISO = /principais não est/;

describe("principal que sumiu do Tiny", () => {
  it("com os 29 no estoque, ligar o filtro nao avisa nada", () => {
    render(<Estoque />);
    ligarPrincipais();

    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  });

  it("faltando um, o filtro diz qual, com codigo e nome", () => {
    ESTADO.semO121 = true;
    render(<Estoque />);
    ligarPrincipais();

    expect(
      screen.getByText(
        "1 dos 29 principais não está no estoque do Tiny: 121 (BAFÔMETRO PASSIVO - IBLOW C).",
      ),
    ).toBeInTheDocument();
  });

  it("com o filtro desligado, nao avisa mesmo faltando", () => {
    ESTADO.semO121 = true;
    render(<Estoque />);

    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  });

  it("com o estoque sem carregar, fica so o erro, e nao 29 principais faltando", () => {
    // Sem isto, a API caída somaria ao "Não foi possível carregar" um aviso de
    // que os 29 sumiram — que é falso: o que sumiu foi a conexão.
    ESTADO.vazio = true;
    render(<Estoque />);
    ligarPrincipais();

    expect(
      screen.getByText("Não foi possível carregar o estoque."),
    ).toBeInTheDocument();
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  });
});
