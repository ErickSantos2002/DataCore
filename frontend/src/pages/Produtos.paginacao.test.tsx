import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { baixarPlanilha } from "../lib/planilha";
import Produtos from "./Produtos";

/**
 * Caracterização da PAGINAÇÃO COMO ELA VIVE em Produtos.
 *
 * Não é a tela, e não é o MultiSelect (esse tem arquivo próprio ao lado):
 * é o rodapé. O que se fixa aqui é o contrato que a adoção do `Pagination`
 * do design system tem de preservar — quantas linhas cabem numa página, o
 * que a frase de contagem diz, e o que os botões fazem nos extremos.
 *
 * Produtos AGREGA: `produtosAgregados` soma os `itens` das notas por
 * `codigo`, então uma nota com 17 itens de código distinto vira 17 linhas de
 * tabela. É por isso que o fixture é uma nota só.
 *
 * A ordenação padrão da tabela é por `quantidadeVendida` decrescente. O
 * comparador de `produtosTabela` (`aVal > bVal ? 1 : -1`) nunca devolve 0,
 * então com quantidades empatadas o resultado depende de como o V8 quebra o
 * empate — não é o comportamento da tela, é um acidente do motor JS. Por
 * isso cada item tem uma quantidade distinta (17 a 1, decrescente com o
 * código): a ordenação fica determinística e a página 1 sai exatamente
 * "Produto 01".."Produto 15", igual à intenção original do fixture.
 *
 * Página de 15 itens, 17 produtos: duas páginas, a segunda com 2.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

/** Dublê de `baixarPlanilha` — os testes de exportação leem os dois
 * argumentos que chegam nela (as abas e o nome do arquivo), sem gerar
 * `.xlsx` de verdade. */
vi.mock("../lib/planilha", () => ({
  baixarPlanilha: vi.fn(),
}));

// `vitest.config.ts` não liga `clearMocks`, e mais de um teste aqui exporta:
// sem isto o segundo veria a chamada do primeiro e o `toHaveBeenCalledTimes(1)`
// passaria a contar duas.
beforeEach(() => {
  vi.mocked(baixarPlanilha).mockClear();
});

// Só um teste daqui fixa o relógio; devolvê-lo sempre evita que a escolha dele
// vaze para os vizinhos na ordem em que o vitest resolver rodá-los.
afterEach(() => {
  vi.useRealTimers();
});

const { NOTAS } = vi.hoisted(() => {
  const ITENS = Array.from({ length: 17 }, (_, i) => ({
    codigo: `P${String(i + 1).padStart(2, "0")}`,
    descricao: `Produto ${String(i + 1).padStart(2, "0")}`,
    quantidade: String(17 - i),
    valor_total: "100",
  }));
  return {
    NOTAS: [
      {
        id: 1,
        data_emissao: "2026-01-10",
        valor_nota: 1200,
        cliente: { nome: "Alfa Mineração", cpf_cnpj: "11.222.333/0001-44" },
        nome_vendedor: "Vendedor A",
        itens: ITENS,
      },
    ],
  };
});

// A tela deixou de ler o `DataContext` (item 9.4): a agregação vem somada do
// banco. O falso mora em `comercial/hooksFalsos`, e para esta tela o que importa
// é o `por_produto` — é ele que virou a tabela.
vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { criarHooksFalsos, resumoDeProdutos } = await import(
    "./comercial/hooksFalsos"
  );
  return { ...real, ...criarHooksFalsos(NOTAS, resumoDeProdutos) };
});

// O `BarChart` escreve a série que recebeu: é o único jeito de contar quantas
// barras o "Top 10" desenha. Os outros dublês seguem mudos — nenhum outro
// teste deste arquivo olha para gráfico.
vi.mock("recharts", () => {
  const semDesenho = () => null;
  return {
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    BarChart: ({
      data,
      children,
    }: {
      data?: unknown[];
      children?: React.ReactNode;
    }) => (
      <div
        data-testid="grafico-ranking"
        data-serie={JSON.stringify(data ?? [])}
      >
        {children}
      </div>
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

/** O `<tbody>` da tabela, escopado — o card "Produto Mais Vendido" também
 * mostra o nome do produto, então uma busca sem escopo por "Produto 01"
 * acha os dois e `getByText` reclama de elemento duplicado. */
function corpoDaTabela(): HTMLElement {
  const corpo = document.querySelector("tbody");
  if (!corpo) throw new Error("tbody nao encontrado");
  return corpo as HTMLElement;
}

/** As linhas de dado da tabela — o `<tbody>`, sem o cabeçalho. */
function linhasDaTabela(): HTMLElement[] {
  return within(corpoDaTabela()).queryAllByRole("row");
}

describe("paginacao em Produtos", () => {
  it("corta a tabela em 15 linhas por pagina", () => {
    render(<Produtos />);

    expect(linhasDaTabela()).toHaveLength(15);
    expect(within(corpoDaTabela()).getByText("Produto 01")).toBeInTheDocument();
    expect(
      within(corpoDaTabela()).queryByText("Produto 16"),
    ).not.toBeInTheDocument();
  });

  it("a frase de contagem diz o intervalo e o total", () => {
    render(<Produtos />);

    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 1 a 15 de 17 produtos",
    );
  });

  it("Proximo leva a segunda pagina, que tem o resto", () => {
    render(<Produtos />);

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

    expect(linhasDaTabela()).toHaveLength(2);
    expect(within(corpoDaTabela()).getByText("Produto 16")).toBeInTheDocument();
    expect(
      within(corpoDaTabela()).queryByText("Produto 01"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 16 a 17 de 17 produtos",
    );
  });

  it("Anterior volta para a primeira", () => {
    render(<Produtos />);

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));

    expect(within(corpoDaTabela()).getByText("Produto 01")).toBeInTheDocument();
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 1 a 15 de 17 produtos",
    );
  });

  it("os extremos desabilitam", () => {
    render(<Produtos />);

    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
  });

  it("com filtro que nao casa nada, a tabela diz que esta vazia", () => {
    render(<Produtos />);

    fireEvent.change(screen.getByPlaceholderText("Pesquisar produto..."), {
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
    // como "Mostrando 11 a 3 de 3 produtos".
    render(<Produtos />);

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 16 a 17",
    );

    fireEvent.change(screen.getByPlaceholderText("Pesquisar produto..."), {
      target: { value: "Produto 0" },
    });

    expect(screen.getByText(/Mostrando/)).toHaveTextContent("Mostrando 1 a ");
    expect(linhasDaTabela().length).toBeGreaterThan(0);
  });

  it("exportar leva o recorte inteiro, nao so a pagina visivel", () => {
    // A versao classica desse defeito: exportar `produtosPaginados` (a
    // pagina que a pessoa esta olhando) em vez de `produtosTabela` (o
    // filtrado/ordenado inteiro que `linhasDaPlanilha`, em produtos.ts,
    // recebe). Com 17 produtos e pagina de 15, a diferenca so aparece com
    // mais de uma pagina — por isso este teste mora aqui, e nao em
    // produtos.test.ts, que testa a conta pura isolada da tela e nao
    // alcancaria o fio entre os dois.
    render(<Produtos />);

    fireEvent.click(screen.getByRole("button", { name: /exportar excel/i }));

    expect(baixarPlanilha).toHaveBeenCalledTimes(1);
    const [abas] = vi.mocked(baixarPlanilha).mock.calls[0];
    expect(abas[0].linhas).toHaveLength(17);
  });

  it("exporta uma aba chamada Produtos, num arquivo carimbado com o dia", () => {
    // Os dois testes de planilha olhavam só a QUANTIDADE de linhas. Trocar o
    // nome da aba por "Planilha1", ou tirar a data do nome do arquivo, passava
    // verde. Sem a data, duas exportações em dias diferentes viram o mesmo
    // `produtos.xlsx` e a segunda sobrescreve a primeira na pasta de
    // Downloads, sem aviso nenhum.
    //
    // O relógio é fixado para que o nome esperado seja uma constante, e não a
    // mesma expressão que a tela usa — repetir `diaLocal(new Date())` na
    // asserção provaria apenas que dois lados calculam igual, inclusive
    // quando os dois estão errados. Meio-dia LOCAL de propósito: a asserção
    // não é sobre fuso, e assim o dia é o mesmo em `UTC` e em
    // `America/Sao_Paulo`.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0));

    render(<Produtos />);
    fireEvent.click(screen.getByRole("button", { name: /exportar excel/i }));

    const [abas, arquivo] = vi.mocked(baixarPlanilha).mock.calls[0];
    expect(abas).toHaveLength(1);
    expect(abas[0].nome).toBe("Produtos");
    expect(arquivo).toBe("produtos_2026-03-15.xlsx");
  });

  it("o Top 10 do grafico recebe dez produtos, e nao os dezessete nem tres", () => {
    // O `10` de `rankingPorValor(produtosAgregados, 10)` em `Produtos.tsx` era
    // um número que ninguém conferia: trocá-lo por `3` deixava o card com o
    // título "Top 10 Produtos (Valor)" desenhando três barras. A conta pura
    // `rankingPorValor` está testada com limite 2 — o buraco era o argumento
    // na casca, e só a tela renderizada o alcança.
    //
    // Este é o único fixture de Produtos com mais de dez produtos, por isso o
    // teste mora aqui. A afirmação é sobre a CONTAGEM: os dezessete têm o
    // mesmo valor total, então a identidade de quem entra no corte depende do
    // desempate do `sort` e não é comportamento da tela.
    render(<Produtos />);

    const serie = JSON.parse(
      screen.getByTestId("grafico-ranking").dataset.serie ?? "[]",
    );

    expect(serie).toHaveLength(10);
  });
});
