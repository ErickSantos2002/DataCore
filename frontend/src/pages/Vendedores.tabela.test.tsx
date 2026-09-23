import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Vendedores from "./Vendedores";
import { updateNotaTipo } from "../services/notasapi";
import type { PedidoDaTabela } from "./comercial/useComercial";

/**
 * Caracterização da tabela "Minhas Vendas", antes de decompor a tela.
 *
 * A paginação já tem arquivo próprio (`Vendedores.paginacao.test.tsx`). Este
 * cobre o resto: as sete colunas com dado e sem dado, o pedido de ordenação, a
 * busca, o modal de observações e a edição do tipo da nota.
 *
 * ⚠️ **A ordenação e a busca são do servidor.** O falso devolve as notas na
 * ordem do fixture; afirmar a ordem das linhas seria afirmar sobre o falso. O
 * que a tela decide — e o que se prende aqui — é **o pedido** que ela manda,
 * anotado em `ESTADO.pedidos`.
 *
 * ⚠️ **A edição do tipo GRAVA na nota** (`updateNotaTipo`, um PATCH). Aqui ela
 * é dublê; na conferência no navegador contra produção ela não se dirige.
 *
 * Fixture — três notas, com todo campo exibido distinto entre elas:
 *   - 11 · 05/03/2026 · Alfa Mineração, com e-mail e fone · mercadoria
 *     R$ 1.234,50 (nota R$ 9.999) · Bocal e Bafômetro · Vendedor A · com
 *     observação · Inbound
 *   - 12 · 10/02/2026 · SEM cliente · R$ 50 · sem itens · sem vendedor · sem
 *     observação · SEM tipo
 *   - 13 · 20/01/2026 · Beta Logística, sem contato · R$ 700 · um item ·
 *     Vendedor B · sem observação · ReCompra
 */

const { NOTAS, ESTADO } = vi.hoisted(() => ({
  NOTAS: [
    {
      id: 11,
      numero: 991001,
      data_emissao: "2026-03-05",
      valor_nota: 9999,
      valor_produtos: 1234.5,
      cliente: {
        id: 1,
        nome: "Alfa Mineração",
        cpf_cnpj: "11.222.333/0001-44",
        email: "compras@alfa.com.br",
        fone: "(11) 4000-1000",
      },
      nome_vendedor: "Vendedor A",
      tipo: "Inbound",
      itens: [
        {
          codigo: "B1",
          descricao: "Bocal",
          quantidade: "10",
          valor_total: "100",
        },
        {
          codigo: "F1",
          descricao: "Bafômetro",
          quantidade: "1",
          valor_total: "1134.5",
        },
      ],
      tem_observacoes: true,
    },
    {
      id: 12,
      numero: 991002,
      data_emissao: "2026-02-10",
      valor_nota: 60,
      valor_produtos: 50,
      cliente: null,
      nome_vendedor: "",
      tipo: null,
      itens: [],
      tem_observacoes: false,
    },
    {
      id: 13,
      numero: 991003,
      data_emissao: "2026-01-20",
      valor_nota: 800,
      valor_produtos: 700,
      cliente: {
        id: 2,
        nome: "Beta Logística",
        cpf_cnpj: "55.666.777/0001-88",
      },
      nome_vendedor: "Vendedor B",
      tipo: "ReCompra",
      itens: [
        { codigo: "K1", descricao: "Kit", quantidade: "1", valor_total: "700" },
      ],
      tem_observacoes: false,
    },
  ],
  ESTADO: {
    pedidos: [] as PedidoDaTabela[],
    toastErro: null as null | ReturnType<typeof vi.fn>,
  },
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { criarHooksFalsos } = await import("./comercial/hooksFalsos");
  const falsos = criarHooksFalsos(NOTAS);
  return {
    ...real,
    ...falsos,
    useVendasPaginadas: (
      recorte: Parameters<typeof falsos.useVendasPaginadas>[0],
      pedido: PedidoDaTabela,
    ) => {
      ESTADO.pedidos.push(pedido);
      return falsos.useVendasPaginadas(recorte, pedido);
    },
  };
});

vi.mock("../services/notasapi", async (original) => {
  const real = await original<typeof import("../services/notasapi")>();
  return { ...real, updateNotaTipo: vi.fn(), fetchVendas: vi.fn() };
});

vi.mock("../components/ToastProvider", () => ({
  useToast: () => ({
    sucesso: vi.fn(),
    erro: ESTADO.toastErro,
    aviso: vi.fn(),
    info: vi.fn(),
  }),
}));

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
  ESTADO.pedidos.length = 0;
  ESTADO.toastErro = vi.fn();
  vi.mocked(updateNotaTipo).mockReset();
});

function ultimoPedido(): PedidoDaTabela {
  const pedido = ESTADO.pedidos[ESTADO.pedidos.length - 1];
  if (!pedido) throw new Error("a tela nao pediu pagina nenhuma");
  return pedido;
}

/** A linha do `<tbody>` que contém `texto`. */
function linhaCom(texto: string): HTMLElement {
  const corpo = document.querySelector("tbody") as HTMLElement;
  const linha = within(corpo)
    .getAllByRole("row")
    .find((l) => l.textContent?.includes(texto));
  if (!linha) throw new Error(`linha com "${texto}" nao encontrada`);
  return linha;
}

/** A célula da coluna `rotulo` numa linha, pelo índice do cabeçalho. */
function celula(linha: HTMLElement, rotulo: string): HTMLElement {
  const cabecalhos = Array.from(document.querySelectorAll("thead th"));
  const indice = cabecalhos.findIndex(
    (th) => th.textContent?.trim() === rotulo,
  );
  if (indice < 0) throw new Error(`coluna "${rotulo}" nao encontrada`);
  return linha.querySelectorAll("td")[indice] as HTMLElement;
}

describe("colunas da tabela de Vendedores", () => {
  it("o cabecalho traz as sete colunas, nesta ordem", () => {
    render(<Vendedores />);

    const rotulos = Array.from(document.querySelectorAll("thead th")).map(
      (th) => th.textContent?.trim(),
    );
    expect(rotulos).toEqual([
      "Data",
      "Cliente",
      "Valor",
      "Produtos",
      "Vendedor",
      "Observações",
      "Tipo da Nota",
    ]);
  });

  it.each([
    ["Data", "05/03/2026"],
    ["Valor", "R$ 1.234,50"],
    ["Vendedor", "Vendedor A"],
    ["Tipo da Nota", "Inbound"],
  ])("na nota completa, a coluna %s mostra %s", (rotulo, esperado) => {
    render(<Vendedores />);

    expect(celula(linhaCom("Alfa Mineração"), rotulo)).toHaveTextContent(
      esperado,
    );
  });

  it("a celula de cliente traz nome, documento, e-mail e telefone", () => {
    render(<Vendedores />);

    const cel = celula(linhaCom("Alfa Mineração"), "Cliente");
    expect(cel).toHaveTextContent("Alfa Mineração");
    expect(cel).toHaveTextContent("11.222.333/0001-44");
    expect(cel).toHaveTextContent("compras@alfa.com.br");
    expect(cel).toHaveTextContent("(11) 4000-1000");
  });

  it("a celula de produtos junta as descricoes e conta os itens no plural", () => {
    render(<Vendedores />);

    const cel = celula(linhaCom("Alfa Mineração"), "Produtos");
    expect(cel).toHaveTextContent("Bocal, Bafômetro");
    expect(cel).toHaveTextContent("2 itens");
  });

  it("com um item so, a contagem vai no singular", () => {
    render(<Vendedores />);

    expect(celula(linhaCom("Beta Logística"), "Produtos")).toHaveTextContent(
      "1 item",
    );
  });

  it("a celula de observacoes da nota com observacao e um botao", () => {
    render(<Vendedores />);

    const cel = celula(linhaCom("Alfa Mineração"), "Observações");
    expect(
      within(cel).getByRole("button", { name: "Ver Observações" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["Cliente", "Cliente não informado"],
    ["Produtos", "Sem itens"],
    ["Vendedor", "Não informado"],
    ["Observações", "-"],
    ["Tipo da Nota", "Não definido"],
  ])("na nota sem dado, a coluna %s mostra %s", (rotulo, esperado) => {
    render(<Vendedores />);

    expect(celula(linhaCom("10/02/2026"), rotulo)).toHaveTextContent(esperado);
  });
});

describe("pedido de ordenacao da tabela de Vendedores", () => {
  it("a tela abre pedindo data de emissao decrescente", () => {
    render(<Vendedores />);

    expect(ultimoPedido()).toMatchObject({
      ordenarPor: "data_emissao",
      direcao: "desc",
    });
  });

  it.each([
    ["Cliente", "cliente"],
    ["Valor", "valor_produtos"],
    ["Tipo da Nota", "tipo"],
  ])(
    "o primeiro clique em %s pede %s decrescente, o segundo crescente",
    (rotulo, campo) => {
      render(<Vendedores />);

      fireEvent.click(
        screen.getByRole("button", { name: `Ordenar por ${rotulo}` }),
      );
      expect(ultimoPedido()).toMatchObject({
        ordenarPor: campo,
        direcao: "desc",
      });

      fireEvent.click(
        screen.getByRole("button", { name: `Ordenar por ${rotulo}` }),
      );
      expect(ultimoPedido()).toMatchObject({
        ordenarPor: campo,
        direcao: "asc",
      });
    },
  );

  it("clicar em Data, que ja e a ordem decrescente, inverte para crescente", () => {
    render(<Vendedores />);

    fireEvent.click(screen.getByRole("button", { name: "Ordenar por Data" }));

    expect(ultimoPedido()).toMatchObject({
      ordenarPor: "data_emissao",
      direcao: "asc",
    });
  });

  it("Produtos, Vendedor e Observacoes nao ordenam", () => {
    render(<Vendedores />);
    const antes = ultimoPedido();

    for (const rotulo of ["Produtos", "Vendedor", "Observações"]) {
      fireEvent.click(screen.getByRole("columnheader", { name: rotulo }));
    }

    expect(ultimoPedido()).toMatchObject({
      ordenarPor: antes.ordenarPor,
      direcao: antes.direcao,
    });
  });

  it.each([
    ["Data", "data_emissao"],
    ["Cliente", "cliente"],
    ["Valor", "valor_produtos"],
    ["Tipo da Nota", "tipo"],
  ])(
    "a coluna %s ordena por um botao, que o teclado alcanca, e o th diz a direcao",
    (rotulo) => {
      // O clique morava no `<th>`, que não entra na ordem de tabulação nem
      // responde a Enter: ordenar era ação só de mouse. `aria-sort` conta o
      // estado para leitor de tela, que antes só tinha o chevron para ver.
      render(<Vendedores />);

      const botao = screen.getByRole("button", {
        name: `Ordenar por ${rotulo}`,
      });
      fireEvent.click(botao);

      expect(botao.closest("th")).toHaveAttribute(
        "aria-sort",
        ultimoPedido().direcao === "asc" ? "ascending" : "descending",
      );
    },
  );

  it("coluna que nao e a da ordem atual diz aria-sort none", () => {
    render(<Vendedores />);

    expect(
      screen.getByRole("button", { name: "Ordenar por Cliente" }).closest("th"),
    ).toHaveAttribute("aria-sort", "none");
  });

  it("a tela pede 15 por pagina", () => {
    render(<Vendedores />);

    expect(ultimoPedido()).toMatchObject({ porPagina: 15, pagina: 1 });
  });
});

describe("pesquisa da tabela de Vendedores", () => {
  it("o que se digita vai no pedido, e a tabela mostra o que o servidor devolve", () => {
    render(<Vendedores />);

    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
      target: { value: "Beta" },
    });

    expect(ultimoPedido().busca).toBe("Beta");
    const corpo = document.querySelector("tbody") as HTMLElement;
    expect(within(corpo).getAllByRole("row")).toHaveLength(1);
    expect(corpo).toHaveTextContent("Beta Logística");
  });
});

describe("filtro de produto em Vendedores", () => {
  it("escolher um produto deixa na tabela so as notas que tem aquele item", () => {
    // O multiselect recebia só os RÓTULOS ("Kit (K1)") e devolvia o rótulo,
    // que ia direto para `recorte.produtos` — onde o servidor espera a CHAVE
    // ("K1"). O filtro não casava nada: escolher qualquer produto zerava a
    // tabela. O falso do Comercial filtra pela chave, como o banco.
    render(<Vendedores />);

    fireEvent.click(
      screen.getByRole("button", { name: "Produtos Todos os produtos" }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Kit (K1)" }));

    const corpo = document.querySelector("tbody") as HTMLElement;
    expect(within(corpo).getAllByRole("row")).toHaveLength(1);
    expect(corpo).toHaveTextContent("Beta Logística");
  });
});

describe("observacoes na tabela de Vendedores", () => {
  it("Ver Observacoes abre o modal da nota daquela linha, e fechar o tira", () => {
    render(<Vendedores />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver Observações" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "observações da nota 11",
    );

    fireEvent.click(screen.getByRole("button", { name: "Fechar observações" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("edicao do tipo da nota em Vendedores", () => {
  /** O `<select>` de tipo aberto numa linha, e os dois botões ao lado. */
  function edicaoNa(linha: HTMLElement) {
    const cel = celula(linha, "Tipo da Nota");
    const select = within(cel).getByRole("combobox") as HTMLSelectElement;
    const [salvar, cancelar] = within(cel).getAllByRole("button");
    return { cel, select, salvar, cancelar };
  }

  it("clicar no tipo abre a edicao com o tipo atual escolhido", () => {
    render(<Vendedores />);

    fireEvent.click(screen.getByText("Inbound"));

    const { select } = edicaoNa(linhaCom("Alfa Mineração"));
    expect(select.value).toBe("Inbound");
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      "Outbound",
      "Inbound",
      "ReCompra",
    ]);
  });

  it("abrir a edicao e um botao com nome, que o teclado alcanca", () => {
    // Era um `<div onClick>`: fora da ordem de tabulação, sem Enter, e sem
    // nada dizendo a leitor de tela que o selo abre uma edição.
    render(<Vendedores />);

    fireEvent.click(
      screen.getByRole("button", { name: "Editar tipo da nota: Inbound" }),
    );

    expect(edicaoNa(linhaCom("Alfa Mineração")).select.value).toBe("Inbound");
  });

  it("na edicao, o seletor, salvar e cancelar tem nome acessivel", () => {
    // Salvar e cancelar eram só ícone (um check e um X), sem nome: um leitor
    // de tela lia "botão, botão".
    render(<Vendedores />);

    fireEvent.click(screen.getByText("Inbound"));
    const { cel } = edicaoNa(linhaCom("Alfa Mineração"));

    expect(
      within(cel).getByRole("combobox", { name: "Tipo da nota" }),
    ).toBeInTheDocument();
    expect(
      within(cel).getByRole("button", { name: "Salvar tipo" }),
    ).toBeInTheDocument();
    expect(
      within(cel).getByRole("button", { name: "Cancelar edição do tipo" }),
    ).toBeInTheDocument();
  });

  it("nota sem tipo abre a edicao em Outbound", () => {
    render(<Vendedores />);

    fireEvent.click(screen.getByText("Não definido"));

    expect(edicaoNa(linhaCom("10/02/2026")).select.value).toBe("Outbound");
  });

  it("salvar grava o tipo escolhido na nota daquela linha e mostra o novo tipo", async () => {
    vi.mocked(updateNotaTipo).mockResolvedValue({});
    render(<Vendedores />);

    fireEvent.click(screen.getByText("Inbound"));
    const { select, salvar } = edicaoNa(linhaCom("Alfa Mineração"));
    fireEvent.change(select, { target: { value: "ReCompra" } });
    await act(async () => {
      fireEvent.click(salvar);
    });

    expect(updateNotaTipo).toHaveBeenCalledWith(11, "ReCompra");
    const cel = celula(linhaCom("Alfa Mineração"), "Tipo da Nota");
    expect(within(cel).queryByRole("combobox")).not.toBeInTheDocument();
    expect(cel).toHaveTextContent("ReCompra");
  });

  it("cancelar fecha a edicao sem gravar e sem mudar o tipo", () => {
    render(<Vendedores />);

    fireEvent.click(screen.getByText("Inbound"));
    const { select, cancelar } = edicaoNa(linhaCom("Alfa Mineração"));
    fireEvent.change(select, { target: { value: "Outbound" } });
    fireEvent.click(cancelar);

    expect(updateNotaTipo).not.toHaveBeenCalled();
    const cel = celula(linhaCom("Alfa Mineração"), "Tipo da Nota");
    expect(within(cel).queryByRole("combobox")).not.toBeInTheDocument();
    expect(cel).toHaveTextContent("Inbound");
  });

  it("se gravar falha, o toast avisa e a edicao continua aberta com a escolha", async () => {
    vi.mocked(updateNotaTipo).mockRejectedValue(new Error("rede"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Vendedores />);

    fireEvent.click(screen.getByText("Inbound"));
    const { select, salvar } = edicaoNa(linhaCom("Alfa Mineração"));
    fireEvent.change(select, { target: { value: "ReCompra" } });
    await act(async () => {
      fireEvent.click(salvar);
    });

    expect(ESTADO.toastErro).toHaveBeenCalledWith(
      "Não foi possível salvar o tipo da nota.",
    );
    expect(edicaoNa(linhaCom("Alfa Mineração")).select.value).toBe("ReCompra");
  });
});
