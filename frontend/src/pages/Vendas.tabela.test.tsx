import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Vendas from "./Vendas";
import { ESTADO_VENDAS, reiniciarEstadoDeVendas } from "./vendas/vendasFalsas";
import type { PedidoDaTabela } from "./comercial/useComercial";

/**
 * Caracterização do "Detalhamento de Vendas", antes de decompor a tela.
 *
 * A paginação tem arquivo próprio (`Vendas.paginacao.test.tsx`). Este cobre as
 * seis colunas com dado e sem dado, o pedido de ordenação e de busca e o modal
 * de observações.
 *
 * ⚠️ **A ordenação e a busca são do servidor.** O falso devolve as notas na
 * ordem do fixture; afirmar a ordem das linhas seria afirmar sobre o falso. O
 * que a tela decide — e o que se prende aqui — é **o pedido** que ela manda,
 * anotado em `ESTADO_VENDAS.pedidos`.
 *
 * O clique de ordenar é no TEXTO do cabeçalho, que vale para o `<th>` de hoje e
 * para um botão dentro dele.
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

vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { hooksDeVendas } = await import("./vendas/vendasFalsas");
  return { ...real, ...hooksDeVendas() };
});

/** Dublê do modal: ele busca o texto na rede ao abrir, e o assunto aqui é só
 *  QUAL nota a tela manda abrir e se o fechar volta. */
vi.mock("../components/ModalObservacoesDaNota", () => ({
  default: ({ idNota, onClose }: { idNota: number; onClose: () => void }) => (
    <div role="dialog" aria-label="Observações">
      <p>observações da nota {idNota}</p>
      <button onClick={onClose}>Fechar observações</button>
    </div>
  ),
}));

vi.mock("recharts", () => {
  const semDesenho = () => null;
  const caixa = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ResponsiveContainer: caixa,
    BarChart: caixa,
    LineChart: caixa,
    PieChart: caixa,
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

beforeEach(() => {
  reiniciarEstadoDeVendas();
});

function ultimoPedido(): PedidoDaTabela {
  const pedido = ESTADO_VENDAS.pedidos[ESTADO_VENDAS.pedidos.length - 1];
  if (!pedido) throw new Error("a tela nao pediu pagina nenhuma");
  return pedido;
}

function linhaCom(texto: string): HTMLElement {
  const corpo = screen.getByRole("table").querySelector("tbody") as HTMLElement;
  const linha = within(corpo)
    .getAllByRole("row")
    .find((l) => l.textContent?.includes(texto));
  if (!linha) throw new Error(`linha com "${texto}" nao encontrada`);
  return linha;
}

function celulas(linha: HTMLElement): string[] {
  return within(linha)
    .getAllByRole("cell")
    .map((c) => c.textContent ?? "");
}

function ordenarPor(rotulo: string) {
  const cabecalho = screen.getByRole("table").querySelector("thead")!;
  fireEvent.click(within(cabecalho as HTMLElement).getByText(rotulo));
}

describe("linhas do Detalhamento de Vendas", () => {
  it("o titulo e os seis cabecalhos, na ordem", () => {
    render(<Vendas />);

    expect(
      screen.getByRole("heading", { name: "Detalhamento de Vendas" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("columnheader").map((c) => c.textContent?.trim()),
    ).toEqual([
      "Data",
      "Cliente",
      "Valor",
      "Vendedor",
      "Produtos",
      "Observações",
    ]);
  });

  it("uma nota completa: data, cliente com CNPJ, valor, vendedor, itens e observacao", () => {
    render(<Vendas />);

    const [data, cliente, valor, vendedor, produtos, obs] = celulas(
      linhaCom("Alfa Mineração"),
    );
    expect(data).toBe("05/03/2026");
    expect(cliente).toBe("Alfa MineraçãoCNPJ: 11.222.333/0001-44");
    expect(valor).toBe("R$ 9.999,50");
    expect(vendedor).toBe("Vendedor A");
    expect(produtos).toBe("Bocal, Bafômetro2 itens");
    expect(obs).toBe("Ver Observações");
  });

  it("uma nota sem cliente, sem vendedor, sem itens e sem observacao", () => {
    render(<Vendas />);

    const [data, cliente, valor, vendedor, produtos, obs] = celulas(
      linhaCom("10/02/2026"),
    );
    expect(data).toBe("10/02/2026");
    expect(cliente).toBe("Não informado");
    expect(valor).toBe("R$ 60,00");
    expect(vendedor).toBe("Não informado");
    expect(produtos).toBe("Sem itens");
    expect(obs).toBe("-");
  });

  it("um item so fala no singular", () => {
    render(<Vendas />);
    expect(celulas(linhaCom("Beta Logística"))[4]).toBe("Kit1 item");
  });

  it("sem nota no recorte, a tabela diz que esta vazia", () => {
    ESTADO_VENDAS.vazio = true;
    render(<Vendas />);

    expect(
      screen.getByText("Nenhum resultado encontrado."),
    ).toBeInTheDocument();
  });
});

describe("pedido de ordenacao do Detalhamento de Vendas", () => {
  it("abre pedindo a data de emissao decrescente, 15 por pagina", () => {
    render(<Vendas />);
    expect(ultimoPedido()).toEqual({
      busca: "",
      ordenarPor: "data_emissao",
      direcao: "desc",
      pagina: 1,
      porPagina: 15,
    });
  });

  it("clicar na coluna que ja esta decrescente inverte", () => {
    render(<Vendas />);
    ordenarPor("Data");
    expect(ultimoPedido()).toMatchObject({
      ordenarPor: "data_emissao",
      direcao: "asc",
    });
  });

  it.each([
    ["Cliente", "cliente"],
    ["Valor", "valor"],
    ["Vendedor", "vendedor"],
  ])(
    "%s: o primeiro clique e decrescente, o segundo crescente",
    (rotulo, campo) => {
      render(<Vendas />);

      ordenarPor(rotulo);
      expect(ultimoPedido()).toMatchObject({
        ordenarPor: campo,
        direcao: "desc",
      });

      ordenarPor(rotulo);
      expect(ultimoPedido()).toMatchObject({
        ordenarPor: campo,
        direcao: "asc",
      });
    },
  );

  it("Produtos e Observacoes nao ordenam", () => {
    render(<Vendas />);
    ordenarPor("Produtos");
    ordenarPor("Observações");

    expect(ultimoPedido()).toMatchObject({
      ordenarPor: "data_emissao",
      direcao: "desc",
    });
  });

  it("a pesquisa vai no pedido", () => {
    render(<Vendas />);
    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
      target: { value: "Beta" },
    });
    expect(ultimoPedido()).toMatchObject({ busca: "Beta", pagina: 1 });
  });
});

describe("observacoes do Detalhamento de Vendas", () => {
  it("o botao abre o modal da nota daquela linha, e fechar some com ele", () => {
    render(<Vendas />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver Observações" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "observações da nota 11",
    );

    fireEvent.click(screen.getByRole("button", { name: "Fechar observações" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("ordenar pelo teclado no Detalhamento de Vendas", () => {
  // O clique morava no `<th>`, que não entra na ordem de tabulação nem
  // responde a Enter: ordenar era ação só de mouse, e o leitor de tela não
  // sabia qual coluna estava ordenada.
  const ROTULOS = ["Data", "Cliente", "Valor", "Vendedor"];

  // O `<th>` que contém o botão: no jsdom daqui o nome acessível do cabeçalho
  // sai do texto visível, e não do `aria-label` do botão.
  const cabecalho = (rotulo: string) =>
    screen
      .getByRole("button", { name: `Ordenar por ${rotulo}` })
      .closest("th") as HTMLElement;

  it("cada coluna ordenavel e um botao com nome", () => {
    render(<Vendas />);
    for (const rotulo of ROTULOS) {
      expect(
        screen.getByRole("button", { name: `Ordenar por ${rotulo}` }),
      ).toBeInTheDocument();
    }
  });

  it("aria-sort diz a coluna e o sentido, e as outras ficam em none", () => {
    render(<Vendas />);

    expect(cabecalho("Data")).toHaveAttribute("aria-sort", "descending");
    expect(cabecalho("Valor")).toHaveAttribute("aria-sort", "none");

    fireEvent.click(screen.getByRole("button", { name: "Ordenar por Valor" }));
    expect(cabecalho("Valor")).toHaveAttribute("aria-sort", "descending");
    expect(cabecalho("Data")).toHaveAttribute("aria-sort", "none");

    fireEvent.click(screen.getByRole("button", { name: "Ordenar por Valor" }));
    expect(cabecalho("Valor")).toHaveAttribute("aria-sort", "ascending");
  });
});
