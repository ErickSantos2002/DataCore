import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Produtos from "./Produtos";

/**
 * Duas linhas de produto SEM código na mesma tabela.
 *
 * A agregação nova (item 9.4) passou a incluir item sem código — 36 itens,
 * 0,12% do valor —, que a anterior descartava com `if (!item.codigo) return`.
 * Cada um deles vira `codigo: ""`, e a `TableRow` usava `key={produto.codigo}`:
 * duas linhas com a MESMA key. O React avisa no console e passa a reconciliar
 * as duas como se fossem a mesma linha.
 *
 * Por que a asserção olha o aviso do console, e não só o conteúdo das linhas:
 * com duas keys iguais o React ainda casa filho a filho por POSIÇÃO e acaba
 * atualizando as props certas, então o texto renderizado sai correto mesmo com
 * o defeito vivo — um teste que só comparasse o conteúdo das duas linhas
 * passaria verde com a `key` errada e não estaria provando nada. O aviso é o
 * mecanismo do próprio React para detectar a colisão, e é ele que some quando
 * cada linha ganha a `chave` do resumo.
 *
 * Fixture proposital: nenhum dos dois itens tem código, e as descrições são
 * diferentes — é `p.chave` (`'#' + descricao`) que os distingue.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const { NOTAS } = vi.hoisted(() => ({
  NOTAS: [
    {
      id: 1,
      data_emissao: "2026-01-10",
      valor_nota: 100,
      cliente: { nome: "Alfa Mineração", cpf_cnpj: "11.222.333/0001-44" },
      nome_vendedor: "Vendedor A",
      itens: [{ descricao: "Frete", quantidade: "1", valor_total: "100" }],
    },
    {
      id: 2,
      data_emissao: "2026-02-10",
      valor_nota: 200,
      cliente: { nome: "Beta Logística", cpf_cnpj: "55.666.777/0001-88" },
      nome_vendedor: "Vendedor B",
      itens: [
        {
          descricao: "Desconto Comercial",
          quantidade: "2",
          valor_total: "200",
        },
      ],
    },
  ],
}));

vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { criarHooksFalsos, resumoDeProdutos } = await import(
    "./comercial/hooksFalsos"
  );
  return { ...real, ...criarHooksFalsos(NOTAS, resumoDeProdutos) };
});

vi.mock("recharts", () => {
  const semDesenho = () => null;
  const passante = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ResponsiveContainer: passante,
    BarChart: passante,
    LineChart: passante,
    PieChart: passante,
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

function corpoDaTabela(): HTMLElement {
  const corpo = document.querySelector("tbody");
  if (!corpo) throw new Error("tbody nao encontrado");
  return corpo as HTMLElement;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("produto sem codigo na tabela", () => {
  it("as duas linhas sem codigo nao colidem na key do React", () => {
    const avisos: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      avisos.push(args.map(String).join(" "));
    });

    render(<Produtos />);

    expect(avisos.filter((a) => /same key/i.test(a))).toEqual([]);
  });

  it("as duas linhas sem codigo aparecem, cada uma com a sua descricao", () => {
    render(<Produtos />);

    const linhas = within(corpoDaTabela()).getAllByRole("row");
    expect(linhas).toHaveLength(2);
    // Ordenacao inicial: quantidadeVendida desc — Desconto (2 un.) na frente.
    expect(
      within(linhas[0]).getByText("Desconto Comercial"),
    ).toBeInTheDocument();
    expect(within(linhas[1]).getByText("Frete")).toBeInTheDocument();

    // A `chave` e dado INTERNO: ela nao pode vazar para coluna nenhuma.
    expect(
      within(corpoDaTabela()).queryByText("#Frete"),
    ).not.toBeInTheDocument();
    expect(
      within(corpoDaTabela()).queryByText("#Desconto Comercial"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("#Frete")).not.toBeInTheDocument();
  });
});
