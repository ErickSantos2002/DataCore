import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Clientes from "./Clientes";

/**
 * Caracterização da PAGINAÇÃO COMO ELA VIVE em Clientes.
 *
 * Molde de `Produtos.paginacao.test.tsx` (Task 2). Diferença: Clientes NÃO
 * agrega — cada cliente do fixture vira uma linha da tabela (Produtos soma
 * `itens` por código; aqui não há nada parecido), então o fixture já é uma
 * lista de N clientes, com N = pageSize + 2.
 *
 * `clientesTabela` só mantém quem tem `numeroComprasPeriodo > 0`
 * (Clientes.tsx ~linha 258), então cada cliente do fixture precisa de pelo
 * menos uma nota cujo `cliente.cpf_cnpj` bata (depois de normalizado) com o
 * `cpf_cnpj` do cliente enriquecido — daí a nota 1-para-1 com o cliente.
 *
 * A ordenação padrão é por `ultimaCompra` decrescente (Clientes.tsx ~linha
 * 93). Por isso cada nota tem uma `data_emissao` distinta: com datas
 * repetidas o comparador (`aVal > bVal ? 1 : -1`, nunca 0) desempata de
 * forma não determinística — defeito conhecido da tela, não desta task.
 *
 * Página de 15 itens, 17 clientes: duas páginas, a segunda com 2.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const { CLIENTES_ENRIQUECIDOS, NOTAS } = vi.hoisted(() => {
  const CLIENTES_ENRIQUECIDOS = Array.from({ length: 17 }, (_, i) => ({
    id: i + 1,
    nome: `Cliente ${String(i + 1).padStart(2, "0")}`,
    cpf_cnpj: `11.111.111/0001-${String(i + 1).padStart(2, "0")}`,
    email: `cliente${i + 1}@exemplo.com`,
    fone: `8199999${String(i + 1).padStart(4, "0")}`,
    totalComprado: 100 + i,
    numeroCompras: 1,
    ultimaCompra: new Date(`2026-01-${String(i + 1).padStart(2, "0")}`),
    status: "ativo" as const,
    ticketMedio: 100 + i,
  }));
  const NOTAS = Array.from({ length: 17 }, (_, i) => ({
    id: i + 1,
    numero: 1000 + i + 1,
    data_emissao: `2026-01-${String(i + 1).padStart(2, "0")}`,
    valor_nota: 100 + i,
    valor_produtos: 100 + i,
    cliente: {
      id: i + 1,
      nome: `Cliente ${String(i + 1).padStart(2, "0")}`,
      cpf_cnpj: `11.111.111/0001-${String(i + 1).padStart(2, "0")}`,
    },
    nome_vendedor: "Vendedor A",
    tipo: null,
    itens: [
      {
        codigo: "P1",
        descricao: "Item",
        quantidade: "1",
        valor_total: String(100 + i),
      },
    ],
    tem_observacoes: false,
  }));
  return { CLIENTES_ENRIQUECIDOS, NOTAS };
});

// A tela deixou de ler o `DataContext` (item 9.4): a agregação por cliente vem
// somada do banco. O falso mora em `comercial/hooksFalsos`.
vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { criarHooksFalsos, resumoDeClientes } = await import(
    "./comercial/hooksFalsos"
  );
  return {
    ...real,
    ...criarHooksFalsos(NOTAS, (ns) =>
      resumoDeClientes(ns, CLIENTES_ENRIQUECIDOS),
    ),
  };
});

vi.mock("recharts", () => {
  const semDesenho = () => null;
  return {
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    BarChart: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    LineChart: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    PieChart: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
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

/** As linhas de dado da tabela — o `<tbody>`, sem o cabeçalho. */
function linhasDaTabela(): HTMLElement[] {
  const corpo = document.querySelector("tbody");
  if (!corpo) throw new Error("tbody nao encontrado");
  return within(corpo as HTMLElement).queryAllByRole("row");
}

describe("paginacao em Clientes", () => {
  it("corta a tabela em 15 linhas por pagina", () => {
    render(<Clientes />);
    expect(linhasDaTabela()).toHaveLength(15);
  });

  it("a frase de contagem diz o intervalo e o total", () => {
    render(<Clientes />);
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 1 a 15 de 17 clientes",
    );
  });

  it("Proximo leva a segunda pagina, que tem o resto", () => {
    render(<Clientes />);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(linhasDaTabela()).toHaveLength(2);
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 16 a 17 de 17 clientes",
    );
  });

  it("Anterior volta para a primeira", () => {
    render(<Clientes />);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(linhasDaTabela()).toHaveLength(15);
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 1 a 15 de 17 clientes",
    );
  });

  it("os extremos desabilitam", () => {
    render(<Clientes />);
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
  });

  it("com filtro que nao casa nada, a tabela diz que esta vazia", () => {
    render(<Clientes />);

    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
      target: { value: "zzzzz-nao-existe" },
    });

    expect(linhasDaTabela()).toHaveLength(1);
    expect(
      screen.getByText("Nenhum resultado encontrado."),
    ).toBeInTheDocument();
  });

  it("filtrar volta para a primeira pagina", () => {
    // O defeito 3: quem estava na pagina 2 e filtrava continuava na 2, com a
    // tabela em branco e o rodape escrevendo um intervalo invertido — algo
    // como "Mostrando 16 a 9 de 9 clientes".
    render(<Clientes />);

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 16 a 17",
    );

    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
      target: { value: "Cliente 0" },
    });

    expect(screen.getByText(/Mostrando/)).toHaveTextContent("Mostrando 1 a ");
    expect(linhasDaTabela().length).toBeGreaterThan(0);
  });
});
