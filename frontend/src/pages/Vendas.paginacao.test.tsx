import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Vendas from "./Vendas";

/**
 * Caracterização da PAGINAÇÃO COMO ELA VIVE em Vendas.
 *
 * Molde de `Produtos.paginacao.test.tsx` (Task 2). Diferença: Vendas NÃO
 * agrega — cada nota do fixture vira uma linha da tabela —, então o fixture
 * já é uma lista de N notas, com N = pageSize + 2.
 *
 * A ordenação padrão é por `data_emissao` decrescente (Vendas.tsx ~linha
 * 126). Por isso cada nota tem uma `data_emissao` distinta: com datas
 * repetidas o comparador (`aVal > bVal ? 1 : -1`, nunca 0) desempata de
 * forma não determinística — defeito conhecido da tela, não desta task.
 *
 * Página de 15 itens, 17 notas: duas páginas, a segunda com 2.
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

const { NOTAS_VENDAS } = vi.hoisted(() => ({
  NOTAS_VENDAS: Array.from({ length: 17 }, (_, i) => ({
    id: i + 1,
    data_emissao: `2026-01-${String(i + 1).padStart(2, "0")}`,
    valor_nota: 100 + i,
    cliente: {
      nome: `Cliente ${String(i + 1).padStart(2, "0")}`,
      cpf_cnpj: `11.111.111/0001-${String(i + 1).padStart(2, "0")}`,
    },
    nome_vendedor: "Vendedor A",
    itens: [
      { descricao: "Item", quantidade: "1", valor_total: String(100 + i) },
    ],
    tem_observacoes: false,
  })),
}));

// A tela deixou de ler o `DataContext` (item 9.4): os agregados vêm somados do
// banco e a tabela vem paginada. O falso mora em `comercial/hooksFalsos` e é
// compartilhado pelos três arquivos de teste desta tela.
// Os pedidos que a tabela fez ao servidor. O falso é da outra frente e não os
// anota, então este arquivo embrulha o hook dele — e anota num `useEffect`,
// como o hook de verdade busca: render descartado pelo React não chega a
// buscar, e contar chamadas do hook contaria esses também.
const { PEDIDOS } = vi.hoisted(() => ({
  PEDIDOS: [] as { busca: string; pagina: number }[],
}));
vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { criarHooksFalsos } = await import("./comercial/hooksFalsos");
  const falsos = criarHooksFalsos(NOTAS_VENDAS);
  const { useEffect } = await import("react");
  return {
    ...real,
    ...falsos,
    useVendasPaginadas: (
      ...args: Parameters<typeof falsos.useVendasPaginadas>
    ) => {
      const { busca, pagina } = args[1];
      useEffect(() => {
        PEDIDOS.push({ busca, pagina });
      }, [busca, pagina]);
      return falsos.useVendasPaginadas(...args);
    },
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

describe("paginacao em Vendas", () => {
  it("corta a tabela em 15 linhas por pagina", () => {
    render(<Vendas />);
    expect(linhasDaTabela()).toHaveLength(15);
  });

  it("a frase de contagem diz o intervalo e o total", () => {
    render(<Vendas />);
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 1 a 15 de 17 notas",
    );
  });

  it("Proximo leva a segunda pagina, que tem o resto", () => {
    render(<Vendas />);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(linhasDaTabela()).toHaveLength(2);
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 16 a 17 de 17 notas",
    );
  });

  it("Anterior volta para a primeira", () => {
    render(<Vendas />);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(linhasDaTabela()).toHaveLength(15);
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 1 a 15 de 17 notas",
    );
  });

  it("os extremos desabilitam", () => {
    render(<Vendas />);
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
  });

  it("com filtro que nao casa nada, a tabela diz que esta vazia", () => {
    render(<Vendas />);

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
    // como "Mostrando 16 a 9 de 9 notas".
    render(<Vendas />);

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

  it("filtrar na pagina 2 nao pede a pagina 2 do filtro novo", () => {
    // A volta para a página 1 era um `useEffect`: existia um render com a
    // busca nova e a página velha, e a tabela pedia ao servidor a página 2 de
    // "Cliente 0" antes de o efeito corrigir — uma requisição jogada fora a
    // cada filtro trocado fora da primeira página.
    PEDIDOS.length = 0;
    render(<Vendas />);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
      target: { value: "Cliente 0" },
    });

    const doFiltroNovo = PEDIDOS.filter((p) => p.busca === "Cliente 0");
    expect(doFiltroNovo.length).toBeGreaterThan(0);
    expect(doFiltroNovo.map((p) => p.pagina)).not.toContain(2);
  });
});
