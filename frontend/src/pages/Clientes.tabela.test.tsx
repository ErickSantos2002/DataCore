import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Clientes from "./Clientes";
import {
  ESTADO_CLIENTES,
  HOJE_CLIENTES,
  RESUMO_CLIENTES,
  reiniciarEstadoDeClientes,
} from "./clientes/clientesFalsos";

/**
 * Caracterização do "Detalhamento de Clientes": o que cada linha mostra, a
 * ordem padrão, as cinco colunas ordenáveis e a pesquisa.
 *
 * Clientes ordena e pesquisa NO NAVEGADOR, sobre o `por_cliente` inteiro — ao
 * contrário de Vendedores, que pede a página ao servidor. Então a ordem das
 * linhas é observável aqui de ponta a ponta. Os doze clientes cabem numa página.
 *
 * O clique de ordenar é no TEXTO do cabeçalho, e não no `<th>` nem num botão:
 * assim o teste vale para a tela de hoje e para a decomposta.
 */

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { hooksDeClientes } = await import("./clientes/clientesFalsos");
  return { ...real, ...hooksDeClientes() };
});

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
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(HOJE_CLIENTES);
  reiniciarEstadoDeClientes();
});

afterEach(() => {
  vi.useRealTimers();
});

const NOMES = [
  "Alfa Mineração Recife Ltda",
  "Beta Logística",
  "Não informado",
  "Gama Saúde",
  "Delta Engenharia",
  ...Array.from(
    { length: 7 },
    (_, i) => `Cliente ${String(i + 6).padStart(2, "0")}`,
  ),
];

function linhas(): HTMLElement[] {
  const corpo = screen.getByRole("table").querySelector("tbody");
  if (!corpo) throw new Error("tbody nao encontrado");
  return within(corpo as HTMLElement).queryAllByRole("row");
}

/** O nome do cliente de uma linha — a primeira célula traz nome, documento e
 *  contato colados, então se procura qual nome ela começa. */
function nomeDaLinha(linha: HTMLElement): string {
  const texto = within(linha).getAllByRole("cell")[0].textContent ?? "";
  const nome = NOMES.find((n) => texto.startsWith(n));
  if (!nome) throw new Error(`linha sem nome conhecido: "${texto}"`);
  return nome;
}

const ordemDosNomes = () => linhas().map(nomeDaLinha);

function linhaDe(nome: string): HTMLElement {
  const linha = linhas().find((l) => nomeDaLinha(l) === nome);
  if (!linha) throw new Error(`linha de "${nome}" nao encontrada`);
  return linha;
}

function celulas(nome: string): string[] {
  return within(linhaDe(nome))
    .getAllByRole("cell")
    .map((c) => c.textContent ?? "");
}

function ordenarPor(rotulo: string) {
  const cabecalho = screen.getByRole("table").querySelector("thead")!;
  fireEvent.click(within(cabecalho as HTMLElement).getByText(rotulo));
}

function pesquisar(termo: string) {
  // O campo da tabela é o único "Pesquisar..." fora de dropdown aberto.
  fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
    target: { value: termo },
  });
}

describe("linhas do Detalhamento de Clientes", () => {
  it("o titulo e os cinco cabecalhos, na ordem", () => {
    render(<Clientes />);

    expect(
      screen.getByRole("heading", { name: "Detalhamento de Clientes" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("columnheader").map((c) => c.textContent?.trim()),
    ).toEqual([
      "Cliente",
      "Última Compra",
      "Valor Total",
      "Nº Compras",
      "Status",
    ]);
  });

  it("uma linha completa: nome, documento, e-mail, telefone, data, valor, notas e status", () => {
    render(<Clientes />);

    const [cliente, data, valor, notas, status] = celulas(
      "Alfa Mineração Recife Ltda",
    );
    expect(cliente).toContain("11.222.333/0001-44");
    expect(cliente).toContain("compras@alfa.com");
    expect(cliente).toContain("81999990000");
    expect(data).toBe("10/09/2026");
    expect(valor).toBe("R$ 50.000,50");
    expect(notas).toBe("4");
    expect(status).toBe("Ativo");
  });

  it("sem e-mail ou sem telefone, a linha mostra so o que tem", () => {
    render(<Clientes />);

    const beta = celulas("Beta Logística")[0];
    expect(beta).toContain("8133334444");
    expect(beta).not.toContain("@");

    const semNome = celulas("Não informado")[0];
    expect(semNome).toContain("pessoa@exemplo.com");
    expect(semNome).toContain("123.456.789-01");
  });

  it("sem ultima compra, a data e 'Nunca' e o cliente e inativo", () => {
    render(<Clientes />);

    const [, data, , , status] = celulas("Delta Engenharia");
    expect(data).toBe("Nunca");
    expect(status).toBe("Inativo");
  });

  it.each([
    [0, 30],
    [15, 0],
    [23, 30],
  ])(
    "status: quem comprou ha 90 dias exatos e ativo, as %i:%i como a qualquer hora",
    (hora, minuto) => {
      // O limite era "agora menos 90 dias", COM hora, e a compra é meia-noite:
      // a compra de 17/06 saía inativa às 15h de 15/09 — e ativa se a mesma
      // tela abrisse à meia-noite e meia. Agora a conta é por dia.
      vi.setSystemTime(new Date(2026, 8, 15, hora, minuto));
      render(<Clientes />);

      expect(celulas("Não informado")[4]).toBe("Ativo");
      expect(celulas("Gama Saúde")[4]).toBe("Ativo");
      expect(celulas("Beta Logística")[4]).toBe("Inativo");
    },
  );

  it("status: no dia seguinte sao 91 dias, e a mesma compra fica inativa", () => {
    vi.setSystemTime(new Date(2026, 8, 16, 0, 30));
    render(<Clientes />);

    expect(celulas("Não informado")[4]).toBe("Inativo");
    expect(celulas("Gama Saúde")[4]).toBe("Ativo");
  });

  it("sem cliente no recorte, a tabela diz que esta vazia", () => {
    ESTADO_CLIENTES.vazio = true;
    render(<Clientes />);

    expect(linhas()).toHaveLength(1);
    expect(
      screen.getByText("Nenhum resultado encontrado."),
    ).toBeInTheDocument();
  });
});

describe("ordem do Detalhamento de Clientes", () => {
  it("abre pela ultima compra, da mais recente para 'Nunca'", () => {
    render(<Clientes />);

    expect(ordemDosNomes()).toEqual([
      "Alfa Mineração Recife Ltda",
      "Cliente 12",
      "Cliente 11",
      "Cliente 10",
      "Cliente 09",
      "Cliente 08",
      "Cliente 07",
      "Cliente 06",
      "Gama Saúde",
      "Não informado",
      "Beta Logística",
      "Delta Engenharia",
    ]);
  });

  it("clicar na coluna que ja esta decrescente inverte", () => {
    render(<Clientes />);
    ordenarPor("Última Compra");

    const ordem = ordemDosNomes();
    expect(ordem[0]).toBe("Delta Engenharia");
    expect(ordem[11]).toBe("Alfa Mineração Recife Ltda");
  });

  it("Cliente: o primeiro clique e decrescente, o segundo crescente", () => {
    render(<Clientes />);

    ordenarPor("Cliente");
    let ordem = ordemDosNomes();
    expect(ordem[0]).toBe("Não informado");
    expect(ordem[11]).toBe("Alfa Mineração Recife Ltda");

    ordenarPor("Cliente");
    ordem = ordemDosNomes();
    expect(ordem[0]).toBe("Alfa Mineração Recife Ltda");
    expect(ordem[11]).toBe("Não informado");
  });

  it("Valor Total, nos dois sentidos", () => {
    render(<Clientes />);

    ordenarPor("Valor Total");
    expect(ordemDosNomes()[0]).toBe("Alfa Mineração Recife Ltda");
    expect(ordemDosNomes()[11]).toBe("Cliente 12");

    ordenarPor("Valor Total");
    expect(ordemDosNomes()[0]).toBe("Cliente 12");
    expect(ordemDosNomes()[11]).toBe("Alfa Mineração Recife Ltda");
  });

  it("Nº Compras, nos dois sentidos", () => {
    render(<Clientes />);

    ordenarPor("Nº Compras");
    expect(ordemDosNomes()[0]).toBe("Gama Saúde");
    expect(ordemDosNomes()[11]).toBe("Delta Engenharia");

    ordenarPor("Nº Compras");
    expect(ordemDosNomes()[0]).toBe("Delta Engenharia");
    expect(ordemDosNomes()[11]).toBe("Gama Saúde");
  });

  it("Status: decrescente poe os inativos em cima", () => {
    render(<Clientes />);

    ordenarPor("Status");
    let status = linhas().map(
      (l) => within(l).getAllByRole("cell")[4].textContent,
    );
    // Dois inativos: Beta (janeiro) e Delta (nunca comprou). A compra de 17/06,
    // de 90 dias exatos, é ativa.
    expect(status.slice(0, 2)).toEqual(["Inativo", "Inativo"]);
    expect(status[2]).toBe("Ativo");

    ordenarPor("Status");
    status = linhas().map((l) => within(l).getAllByRole("cell")[4].textContent);
    expect(status[0]).toBe("Ativo");
    expect(status.slice(10)).toEqual(["Inativo", "Inativo"]);
  });
});

describe("pesquisa do Detalhamento de Clientes", () => {
  it("acha pelo nome, sem caixa", () => {
    render(<Clientes />);
    pesquisar("gama");
    expect(ordemDosNomes()).toEqual(["Gama Saúde"]);
  });

  it("acha pelo e-mail", () => {
    render(<Clientes />);
    pesquisar("compras@");
    expect(ordemDosNomes()).toEqual(["Alfa Mineração Recife Ltda"]);
  });

  it("acha pelo telefone", () => {
    render(<Clientes />);
    pesquisar("33334444");
    expect(ordemDosNomes()).toEqual(["Beta Logística"]);
  });

  it("acha pelo documento com mascara e sem mascara", () => {
    render(<Clientes />);

    pesquisar("55.666.777");
    expect(ordemDosNomes()).toEqual(["Beta Logística"]);

    pesquisar("55666777");
    expect(ordemDosNomes()).toEqual(["Beta Logística"]);
  });

  it("o documento com outra pontuacao tambem casa, pelos digitos", () => {
    render(<Clientes />);
    pesquisar("123-456-789");
    expect(ordemDosNomes()).toEqual(["Não informado"]);
  });
});

describe("ordenar pelo teclado no Detalhamento de Clientes", () => {
  // O clique morava no `<th>`, que não entra na ordem de tabulação nem
  // responde a Enter: ordenar era ação só de mouse, e o leitor de tela não
  // sabia qual coluna estava ordenada.
  const ROTULOS = [
    "Cliente",
    "Última Compra",
    "Valor Total",
    "Nº Compras",
    "Status",
  ];

  it("cada coluna ordenavel e um botao com nome", () => {
    render(<Clientes />);
    for (const rotulo of ROTULOS) {
      expect(
        screen.getByRole("button", { name: `Ordenar por ${rotulo}` }),
      ).toBeInTheDocument();
    }
  });

  it("aria-sort diz a coluna e o sentido, e as outras ficam em none", () => {
    render(<Clientes />);

    // O `<th>` que contém o botão: o nome acessível do cabeçalho, no jsdom
    // daqui, sai do texto visível e não do `aria-label` do botão.
    const cabecalho = (rotulo: string) =>
      screen
        .getByRole("button", { name: `Ordenar por ${rotulo}` })
        .closest("th") as HTMLElement;

    expect(cabecalho("Última Compra")).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(cabecalho("Cliente")).toHaveAttribute("aria-sort", "none");

    fireEvent.click(
      screen.getByRole("button", { name: "Ordenar por Cliente" }),
    );
    expect(cabecalho("Cliente")).toHaveAttribute("aria-sort", "descending");
    expect(cabecalho("Última Compra")).toHaveAttribute("aria-sort", "none");

    fireEvent.click(
      screen.getByRole("button", { name: "Ordenar por Cliente" }),
    );
    expect(cabecalho("Cliente")).toHaveAttribute("aria-sort", "ascending");
  });
});

describe("ordem estavel e natural no Detalhamento de Clientes", () => {
  it("empate desempata pelo nome, crescente nos dois sentidos", () => {
    // Oito clientes com 2 notas. O comparador antigo nunca devolvia 0
    // (`a > b ? 1 : -1`): em empate a ordem dependia do motor.
    render(<Clientes />);

    ordenarPor("Nº Compras");
    expect(ordemDosNomes()).toEqual([
      "Gama Saúde",
      "Alfa Mineração Recife Ltda",
      "Beta Logística",
      "Cliente 06",
      "Cliente 07",
      "Cliente 08",
      "Cliente 09",
      "Cliente 10",
      "Cliente 11",
      "Cliente 12",
      "Não informado",
      "Delta Engenharia",
    ]);

    ordenarPor("Nº Compras");
    expect(ordemDosNomes()).toEqual([
      "Delta Engenharia",
      "Cliente 06",
      "Cliente 07",
      "Cliente 08",
      "Cliente 09",
      "Cliente 10",
      "Cliente 11",
      "Cliente 12",
      "Não informado",
      "Beta Logística",
      "Alfa Mineração Recife Ltda",
      "Gama Saúde",
    ]);
  });

  it("o nome ordena sem acento, sem caixa e sem o espaco das pontas", () => {
    // Com `toLowerCase` e `>`, "Ágil" ia para o fim — "á" vem depois de "z" —
    // e o espaço que o Tiny deixa na frente do nome jogava " Zeta" para o topo.
    ESTADO_CLIENTES.resumo = CARTEIRA_COM_ACENTO;
    render(<Clientes />);

    ordenarPor("Cliente");
    ordenarPor("Cliente");

    const primeiras = linhas().map(
      (l) => within(l).getAllByRole("cell")[0].querySelector("p")?.textContent,
    );
    expect(primeiras).toEqual([
      "Ágil Serviços",
      "beta minúscula",
      "Bravo",
      " Zeta",
    ]);
  });
});

const CARTEIRA_COM_ACENTO = {
  ...RESUMO_CLIENTES,
  por_cliente: [" Zeta", "Ágil Serviços", "beta minúscula", "Bravo"].map(
    (nome, i) => ({
      documento: String(i),
      nome,
      cpf_cnpj: null,
      email: null,
      fone: null,
      valor: 100 - i,
      valor_produtos: 1,
      notas: 1,
      ultima_compra: "2026-09-01",
    }),
  ),
};
