import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Estoque from "./Estoque";
import { baixarPlanilha } from "../lib/planilha";

/**
 * Caracterização da tabela "Detalhamento do Estoque", antes de decompor a tela:
 * as sete colunas, a ordem (que aqui é do NAVEGADOR, então a ordem das linhas
 * é observável), a pesquisa, a exportação e o botão da solicitação de compras.
 *
 * A paginação tem arquivo próprio (`Estoque.paginacao.test.tsx`) e o
 * multiselect de produto também (`Estoque.multiselect.test.tsx`).
 *
 * Fixture: os seis produtos de `estoque/produtosFalsos.ts` — cabem numa página.
 *
 * ⚠️ O código ordena como TEXTO: "900" vem antes de "4" na ordem decrescente
 * porque "9" > "4", e "P2" vem antes de todos. Preso como está; não é endosso.
 */

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const { ESTADO } = vi.hoisted(() => ({
  ESTADO: { comEspaco: false, semUnidade: false },
}));

vi.mock("../context/EstoqueContext", async () => {
  const { PRODUTOS_ESTOQUE } = await import("./estoque/produtosFalsos");
  // Nome com espaço nas pontas, como o Tiny devolve " VIDRO - PHOEBUS "
  // (visto no navegador em 15/09).
  const COM_ESPACO = {
    id: 99,
    nome: " Vidro ",
    codigo: "V1",
    unidade: "UN",
    preco: 1,
    saldo: 1,
    situacao: "A" as const,
  };
  // Unidade nula, como os seis produtos cadastrados no Tiny sem ela (códigos
  // 374 a 380, vistos em tiny.estoque em 22/09): a API devolve `null` apesar
  // do tipo dizer `string`.
  const SEM_UNIDADE = {
    id: 98,
    nome: "Bateria de lítio",
    codigo: "380",
    unidade: null,
    preco: 1,
    saldo: 1,
    situacao: "A" as const,
  };
  // Listas prontas, e não montadas a cada chamada: array novo a cada render
  // muda a identidade que o `usePaginacao` observa.
  const COM_O_ESPACO = [...PRODUTOS_ESTOQUE, COM_ESPACO];
  const COM_A_SEM_UNIDADE = [...PRODUTOS_ESTOQUE, SEM_UNIDADE];
  return {
    useEstoque: () => ({
      produtos: ESTADO.comEspaco
        ? COM_O_ESPACO
        : ESTADO.semUnidade
          ? COM_A_SEM_UNIDADE
          : PRODUTOS_ESTOQUE,
      carregando: false,
      atualizarProdutos: vi.fn(),
    }),
  };
});

vi.mock("../lib/planilha", () => ({ baixarPlanilha: vi.fn() }));

/** Dublê do modal: o assunto aqui é se a tela o abre, com quais produtos e
 *  quem solicita, e se o fechar volta. O modal tem testes próprios. */
vi.mock("../components/SolicitacaoComprasModal", () => ({
  default: ({
    aberto,
    fechar,
    produtos,
    solicitante,
  }: {
    aberto: boolean;
    fechar: () => void;
    produtos: unknown[];
    solicitante: string;
  }) =>
    aberto ? (
      <div role="dialog" aria-label="Solicitação de compras">
        <p>
          {produtos.length} produtos · solicitante {solicitante}
        </p>
        <button onClick={fechar}>Fechar solicitação</button>
      </div>
    ) : null,
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
  ESTADO.comEspaco = false;
  ESTADO.semUnidade = false;
  vi.mocked(baixarPlanilha).mockReset();
});

function linhas(): HTMLElement[] {
  const corpo = document.querySelector("tbody") as HTMLElement;
  return within(corpo).getAllByRole("row");
}

function nomes(): string[] {
  return linhas().map((l) => l.querySelector("td")?.textContent ?? "");
}

function linhaCom(texto: string): HTMLElement {
  const linha = linhas().find((l) => l.textContent?.includes(texto));
  if (!linha) throw new Error(`linha com "${texto}" nao encontrada`);
  return linha;
}

function celula(linha: HTMLElement, rotulo: string): HTMLElement {
  const cabecalhos = Array.from(document.querySelectorAll("thead th"));
  const indice = cabecalhos.findIndex(
    (th) => th.textContent?.trim() === rotulo,
  );
  if (indice < 0) throw new Error(`coluna "${rotulo}" nao encontrada`);
  return linha.querySelectorAll("td")[indice] as HTMLElement;
}

/** Clica onde a pessoa clica: no botão de ordenar, se a coluna tem um, e no
 *  próprio `<th>` quando não tem (Unidade, Valor Total). */
function clicarNoCabecalho(rotulo: string) {
  const botao = screen.queryByRole("button", { name: `Ordenar por ${rotulo}` });
  fireEvent.click(botao ?? screen.getByRole("columnheader", { name: rotulo }));
}

describe("colunas da tabela de Estoque", () => {
  it("o cabecalho traz as sete colunas, nesta ordem", () => {
    render(<Estoque />);

    expect(
      Array.from(document.querySelectorAll("thead th")).map((th) =>
        th.textContent?.trim(),
      ),
    ).toEqual([
      "Nome",
      "Código-SKU",
      "Unidade",
      "Preço",
      "Saldo",
      "Situação",
      "Valor Total",
    ]);
  });

  it.each([
    ["Nome", "Sensor antigo"],
    ["Código-SKU", "900"],
    ["Unidade", "PC"],
    ["Preço", "R$ 80,00"],
    ["Saldo", "-2"],
    ["Situação", "Inativo"],
    ["Valor Total", "R$ -160,00"],
  ])("na linha do Sensor antigo, a coluna %s mostra %s", (rotulo, esperado) => {
    render(<Estoque />);

    expect(celula(linhaCom("Sensor antigo"), rotulo)).toHaveTextContent(
      esperado,
    );
  });

  it("preco com centavos e saldo com milhar saem no formato brasileiro", () => {
    render(<Estoque />);

    expect(celula(linhaCom("Bocal"), "Preço")).toHaveTextContent("R$ 3,50");
    expect(celula(linhaCom("Kit calibração"), "Valor Total")).toHaveTextContent(
      "R$ 3.600,00",
    );
    expect(celula(linhaCom("Kit calibração"), "Situação")).toHaveTextContent(
      "Inativo",
    );
    expect(celula(linhaCom("Brinde"), "Situação")).toHaveTextContent("Ativo");
  });
});

describe("ordem da tabela de Estoque", () => {
  it("a tela abre em ordem alfabetica de nome, sem diferenciar caixa", () => {
    render(<Estoque />);

    expect(nomes()).toEqual([
      "Bafômetro Phoebus Premium Edition XL",
      "Bocal",
      "Brinde",
      "Kit calibração",
      "Sensor antigo",
      "Tubo descartável",
    ]);
  });

  it("espaco nas pontas do nome nao joga o produto para o topo da ordem", () => {
    // " VIDRO - PHOEBUS " abria a tabela, antes de "(PACOTE..." e de "4G...":
    // o espaço ordena antes de qualquer letra.
    ESTADO.comEspaco = true;
    render(<Estoque />);

    expect(nomes().map((n) => n.trim())).toEqual([
      "Bafômetro Phoebus Premium Edition XL",
      "Bocal",
      "Brinde",
      "Kit calibração",
      "Sensor antigo",
      "Tubo descartável",
      "Vidro",
    ]);
  });

  it("clicar em Nome, que ja esta crescente, inverte", () => {
    render(<Estoque />);

    clicarNoCabecalho("Nome");

    expect(nomes()[0]).toBe("Tubo descartável");
    expect(nomes()[5]).toBe("Bafômetro Phoebus Premium Edition XL");
  });

  it("o primeiro clique em Preco ordena do maior ao menor, o segundo inverte", () => {
    render(<Estoque />);

    clicarNoCabecalho("Preço");
    expect(nomes()).toEqual([
      "Kit calibração",
      "Bafômetro Phoebus Premium Edition XL",
      "Sensor antigo",
      "Tubo descartável",
      "Bocal",
      "Brinde",
    ]);

    clicarNoCabecalho("Preço");
    expect(nomes()[0]).toBe("Brinde");
    expect(nomes()[5]).toBe("Kit calibração");
  });

  it("Saldo ordena pelo numero, com o negativo por ultimo no decrescente", () => {
    render(<Estoque />);

    clicarNoCabecalho("Saldo");

    expect(nomes()).toEqual([
      "Tubo descartável",
      "Brinde",
      "Bafômetro Phoebus Premium Edition XL",
      "Kit calibração",
      "Bocal",
      "Sensor antigo",
    ]);
  });

  it("Codigo-SKU ordena em ordem natural, com o numero dentro do texto lido como numero", () => {
    // Ordenava como TEXTO: "900" vinha antes de "163" e "77" antes de "4" no
    // decrescente, porque "9" > "1" e "7" > "4". O código é SKU, e quem procura
    // o 163 espera achá-lo depois do 77.
    render(<Estoque />);

    clicarNoCabecalho("Código-SKU");

    expect(linhas().map((l) => celula(l, "Código-SKU").textContent)).toEqual([
      "P2",
      "900",
      "163",
      "77",
      "4",
      "1",
    ]);
  });

  it("Situacao decrescente poe os inativos primeiro, e o empate sai em ordem de nome", () => {
    // O comparador nunca devolvia 0 (`aVal > bVal ? 1 : -1`): em empate a ordem
    // dependia do motor, e não de regra nenhuma. Agora o empate desempata pelo
    // nome — "Kit calibração" antes de "Sensor antigo", embora o Sensor venha
    // antes no catálogo.
    render(<Estoque />);

    clicarNoCabecalho("Situação");

    expect(nomes()).toEqual([
      "Kit calibração",
      "Sensor antigo",
      "Bafômetro Phoebus Premium Edition XL",
      "Bocal",
      "Brinde",
      "Tubo descartável",
    ]);
  });

  it.each(["Nome", "Código-SKU", "Preço", "Saldo", "Situação"])(
    "a coluna %s ordena por um botao, que o teclado alcanca, e o th diz a direcao",
    (rotulo) => {
      // O clique morava no `<th>`, fora da ordem de tabulação e sem Enter.
      render(<Estoque />);

      const botao = screen.getByRole("button", {
        name: `Ordenar por ${rotulo}`,
      });
      expect(botao.closest("th")).toHaveAttribute(
        "aria-sort",
        rotulo === "Nome" ? "ascending" : "none",
      );

      fireEvent.click(botao);

      // Nome já estava crescente e inverte; as outras recebem o primeiro
      // clique, que é decrescente.
      expect(botao.closest("th")).toHaveAttribute("aria-sort", "descending");
    },
  );

  it("Unidade e Valor Total nao ordenam", () => {
    render(<Estoque />);
    const antes = nomes();

    clicarNoCabecalho("Unidade");
    clicarNoCabecalho("Valor Total");

    expect(nomes()).toEqual(antes);
  });
});

describe("pesquisa da tabela de Estoque", () => {
  it.each([
    ["nome, sem caixa", "SENSOR", ["Sensor antigo"]],
    ["codigo", "163", ["Bocal"]],
    ["unidade", "cx", ["Tubo descartável"]],
  ])("acha pelo %s", (_caso, termo, esperados) => {
    render(<Estoque />);

    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
      target: { value: termo },
    });

    expect(nomes()).toEqual(esperados);
  });

  it("produto sem unidade nao derruba a pesquisa, e segue achavel pelo nome", () => {
    // A pesquisa lia `p.unidade.toLowerCase()`: com um produto de unidade nula
    // no estoque, qualquer termo que não batesse com o nome nem com o código
    // dele lançava TypeError e a tela inteira caía.
    ESTADO.semUnidade = true;
    render(<Estoque />);
    const campo = screen.getByPlaceholderText("Pesquisar...");

    fireEvent.change(campo, { target: { value: "SENSOR" } });
    expect(nomes()).toEqual(["Sensor antigo"]);

    fireEvent.change(campo, { target: { value: "bateria" } });
    expect(nomes()).toEqual(["Bateria de lítio"]);
  });
});

describe("exportacao de Estoque", () => {
  it("exporta a tabela como esta — filtrada, pesquisada e na ordem — com as sete colunas", () => {
    render(<Estoque />);

    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
      target: { value: "o" },
    });
    clicarNoCabecalho("Preço");
    fireEvent.click(screen.getByRole("button", { name: /Exportar Excel/ }));

    const [abas, arquivo] = vi.mocked(baixarPlanilha).mock.calls[0];
    expect(arquivo).toMatch(/^estoque_\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(abas[0].nome).toBe("Estoque");
    expect(abas[0].linhas.map((l) => l.Nome)).toEqual(nomes());
    expect(abas[0].linhas.find((l) => l.Nome === "Sensor antigo")).toEqual({
      Nome: "Sensor antigo",
      "Código-SKU": "900",
      Unidade: "PC",
      Preço: 80,
      Saldo: -2,
      Situação: "Inativo",
      "Valor Total": -160,
    });
  });
});

describe("exportar com a tabela vazia em Estoque", () => {
  it("fica desabilitado, e volta quando a pesquisa acha de novo", () => {
    // Sem nenhuma linha, o clique gerava planilha só com o cabeçalho —
    // arquivo vazio que sai por e-mail parecendo resultado.
    render(<Estoque />);
    const campo = screen.getByPlaceholderText("Pesquisar...");

    fireEvent.change(campo, { target: { value: "zzz-nao-existe" } });
    expect(
      screen.getByRole("button", { name: /Exportar Excel/ }),
    ).toBeDisabled();

    fireEvent.change(campo, { target: { value: "" } });
    expect(
      screen.getByRole("button", { name: /Exportar Excel/ }),
    ).toBeEnabled();
  });
});

describe("solicitacao de compras em Estoque", () => {
  it("o botao abre o modal com o estoque inteiro e o usuario como solicitante, e fechar o tira", () => {
    render(<Estoque />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Solicitação de Compras" }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "6 produtos · solicitante erick",
    );

    fireEvent.click(screen.getByRole("button", { name: "Fechar solicitação" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("o modal recebe o estoque inteiro, e nao o filtrado", () => {
    // Pelo FILTRO de situação, e não pela pesquisa: a pesquisa só age sobre a
    // tabela, e com ela este teste passava mesmo se o modal recebesse a lista
    // filtrada (plantação cega na primeira versão).
    render(<Estoque />);

    const bloco = screen.getByText("Situação", { selector: "label" })
      .parentElement as HTMLElement;
    fireEvent.change(bloco.querySelector("select") as HTMLSelectElement, {
      target: { value: "I" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Solicitação de Compras" }),
    );

    expect(screen.getByRole("dialog")).toHaveTextContent("6 produtos");
  });
});
