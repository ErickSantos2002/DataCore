import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Estoque from "./Estoque";

/**
 * Caracterização do topo de Estoque — cabeçalho, KPIs, estatísticas, o estado
 * de carregando e os três filtros de seleção (Situação, Saldo, Filtros
 * Personalizados) —, antes de decompor a tela.
 *
 * Ao contrário de Vendedores, aqui a conta é TODA do navegador: o
 * `EstoqueContext` entrega a lista inteira de produtos e a tela filtra, soma e
 * ordena. Então os números do fixture (`estoque/produtosFalsos.ts`, com a
 * tabela dos seis produtos no docblock) são conferidos de ponta a ponta.
 */

const { ESTADO } = vi.hoisted(() => ({
  ESTADO: { carregando: false, vazio: false, topSemUnidade: false },
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

vi.mock("../context/EstoqueContext", async () => {
  const { PRODUTOS_ESTOQUE } = await import("./estoque/produtosFalsos");
  // O Kit calibração (KT) é o de maior valor; aqui sem unidade, como os seis
  // produtos do Tiny de códigos 374 a 380. Lista pronta: uma nova a cada
  // render muda a identidade que o `usePaginacao` observa.
  const TOP_SEM_UNIDADE = PRODUTOS_ESTOQUE.map((p) =>
    p.id === 5 ? { ...p, unidade: null } : p,
  );
  return {
    useEstoque: () => ({
      produtos: ESTADO.vazio
        ? []
        : ESTADO.topSemUnidade
          ? TOP_SEM_UNIDADE
          : PRODUTOS_ESTOQUE,
      carregando: ESTADO.carregando,
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
  ESTADO.carregando = false;
  ESTADO.vazio = false;
  ESTADO.topSemUnidade = false;
});

/** O cartão cujo rótulo é `rotulo` — escopa a busca do valor. */
function cartao(rotulo: string): HTMLElement {
  const alvo = screen
    .getByText(rotulo)
    .closest("div.rounded-xl") as HTMLElement | null;
  if (!alvo) throw new Error(`cartao "${rotulo}" nao encontrado`);
  return alvo;
}

/** O valor de uma linha de "Estatísticas do Estoque". */
function estatistica(rotulo: string): string {
  const linha = screen.getByText(rotulo).parentElement as HTMLElement;
  return linha.textContent!.replace(rotulo, "").trim();
}

/** O `<select>` do filtro de rótulo `rotulo`, pelo bloco do rótulo — os
 *  `<label>` da tela não têm `htmlFor`. */
function seletor(rotulo: string): HTMLSelectElement {
  const bloco = screen.getByText(rotulo, { selector: "label" })
    .parentElement as HTMLElement;
  return bloco.querySelector("select") as HTMLSelectElement;
}

function nomesNaTabela(): string[] {
  const corpo = document.querySelector("tbody") as HTMLElement;
  return within(corpo)
    .getAllByRole("row")
    .map((linha) => linha.querySelector("td")?.textContent ?? "");
}

describe("cabecalho de Estoque", () => {
  it("mostra o titulo, o usuario logado com o papel e a frase de apoio", () => {
    render(<Estoque />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Estoque - Dashboard",
    );
    expect(screen.getByText("erick").parentElement).toHaveTextContent(
      "Bem-vindo, erick (admin)",
    );
    expect(
      screen.getByText(
        "Confira a posição atual do estoque e visualize os produtos disponíveis.",
      ),
    ).toBeInTheDocument();
  });
});

describe("KPIs de Estoque", () => {
  it("Produtos Ativos conta a situacao A", () => {
    render(<Estoque />);

    expect(cartao("Produtos Ativos")).toHaveTextContent("4");
  });

  it("Produtos sem Saldo conta so saldo zero, e nao o negativo", () => {
    render(<Estoque />);

    expect(cartao("Produtos sem Saldo")).toHaveTextContent("1");
  });

  it("Valor Total em Estoque soma saldo vezes preco, com o negativo abatendo", () => {
    // 2.500 + 500 + 0 − 160 + 3.600 + 0
    render(<Estoque />);

    expect(cartao("Valor Total em Estoque")).toHaveTextContent("R$ 6.440,00");
  });

  it("Produto Top e o de maior saldo vezes preco, com valor e unidade", () => {
    render(<Estoque />);

    const topo = cartao("Produto Top");
    expect(topo).toHaveTextContent("Kit calibração");
    expect(topo).toHaveTextContent("R$ 3.600,00 (KT)");
  });
});

describe("estatisticas de Estoque", () => {
  it.each([
    ["Total de Produtos", "6"],
    // (250 + 5 + 3,5 + 80 + 1200 + 0) / 6 = 256,4166… — no formato brasileiro,
    // como os cartões ao lado. Saía "R$ 256.42", com ponto, via `toFixed`.
    ["Preço Médio", "R$ 256,42"],
    // (10 + 100 + 0 − 2 + 3 + 50) / 6 = 26,833…
    ["Saldo Médio", "26,8"],
    ["Maior Preço", "R$ 1.200,00"],
  ])("%s mostra %s", (rotulo, esperado) => {
    render(<Estoque />);

    expect(estatistica(rotulo)).toBe(esperado);
  });
});

describe("Produto Top sem unidade", () => {
  it("mostra o valor, sem parenteses e sem 'null'", () => {
    // A API devolve `null` na unidade de produto cadastrado sem ela, e a nota
    // escrevia "R$ 3.600,00 (null)".
    ESTADO.topSemUnidade = true;
    render(<Estoque />);

    const topo = cartao("Produto Top");
    expect(topo).toHaveTextContent("Kit calibração");
    expect(topo).toHaveTextContent("R$ 3.600,00");
    expect(topo).not.toHaveTextContent("null");
    expect(topo).not.toHaveTextContent("(");
  });
});

describe("Produto Top sem produto", () => {
  it("diz N/A, sem valor nem parenteses soltos", () => {
    // Saía "R$ ()": valor e unidade vazios, e os parênteses sozinhos.
    ESTADO.vazio = true;
    render(<Estoque />);

    const topo = cartao("Produto Top");
    expect(topo).toHaveTextContent("N/A");
    expect(topo).not.toHaveTextContent("()");
  });
});

describe("estatisticas de Estoque sem produto", () => {
  it("zeram no mesmo formato, e sem NaN nem -Infinity", () => {
    ESTADO.vazio = true;
    render(<Estoque />);

    expect(estatistica("Total de Produtos")).toBe("0");
    expect(estatistica("Preço Médio")).toBe("R$ 0,00");
    expect(estatistica("Saldo Médio")).toBe("0,0");
    expect(estatistica("Maior Preço")).toBe("R$ 0,00");
  });
});

describe("carregando em Estoque", () => {
  it("enquanto o contexto carrega, a tela mostra so a frase de espera", () => {
    ESTADO.carregando = true;
    render(<Estoque />);

    // Frase completa com ponto, e não reticências — a mesma troca de Serviços e
    // Vendedores.
    expect(
      screen.getByText("Carregando dados do estoque."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Produtos Ativos")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("filtros de selecao em Estoque", () => {
  it("Situacao Inativo deixa so os inativos, na tabela e nos KPIs", () => {
    render(<Estoque />);

    fireEvent.change(seletor("Situação"), { target: { value: "I" } });

    expect(nomesNaTabela()).toEqual(["Kit calibração", "Sensor antigo"]);
    expect(cartao("Produtos Ativos")).toHaveTextContent("0");
    expect(estatistica("Total de Produtos")).toBe("2");
  });

  it("Situacao Ativo deixa so os ativos", () => {
    render(<Estoque />);

    fireEvent.change(seletor("Situação"), { target: { value: "A" } });

    expect(nomesNaTabela()).toEqual([
      "Bafômetro Phoebus Premium Edition XL",
      "Bocal",
      "Brinde",
      "Tubo descartável",
    ]);
  });

  it.each([
    [
      "comSaldo",
      [
        "Bafômetro Phoebus Premium Edition XL",
        "Brinde",
        "Kit calibração",
        "Tubo descartável",
      ],
    ],
    ["semSaldo", ["Bocal"]],
    ["Negativo", ["Sensor antigo"]],
  ])("Saldo %s deixa so os produtos daquele saldo", (valor, esperados) => {
    render(<Estoque />);

    fireEvent.change(seletor("Saldo"), { target: { value: valor } });

    expect(nomesNaTabela()).toEqual(esperados);
  });

  it("Filtros Personalizados Principais deixa so os codigos da lista", () => {
    render(<Estoque />);

    fireEvent.change(seletor("Filtros Personalizados"), {
      target: { value: "rapido" },
    });

    expect(nomesNaTabela()).toEqual([
      "Bafômetro Phoebus Premium Edition XL",
      "Bocal",
      "Kit calibração",
    ]);
  });

  it("as opcoes de cada filtro, na ordem", () => {
    render(<Estoque />);

    const opcoes = (rotulo: string) =>
      Array.from(seletor(rotulo).options).map((o) => [o.value, o.textContent]);

    expect(opcoes("Situação")).toEqual([
      ["todos", "Todos"],
      ["A", "Ativo"],
      ["I", "Inativo"],
    ]);
    expect(opcoes("Saldo")).toEqual([
      ["todos", "Todos"],
      ["comSaldo", "Somente com saldo"],
      ["semSaldo", "Somente sem saldo"],
      ["Negativo", "Somente saldo negativo"],
    ]);
    expect(opcoes("Filtros Personalizados")).toEqual([
      ["nenhum", "Nenhum"],
      ["rapido", "Principais"],
    ]);
  });
});
