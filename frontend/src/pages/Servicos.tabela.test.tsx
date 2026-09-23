import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Servicos from "./Servicos";
import type { PedidoDaTabelaDeServicos } from "./servicos/useServicos";
import { conferirAriaSort } from "../test/ordenacaoAcessivel";

/**
 * Caracterização da tabela de Serviços, antes de decompor a tela.
 *
 * A paginação já tem cobertura própria em `Servicos.paginacao.test.tsx` —
 * este arquivo cobre o que falta: as colunas, a pesquisa, o pedido de
 * ordenação e o estado vazio.
 *
 * ⚠️ **A busca e a ordenação deixaram de ser da tela.** Elas viajam no
 * `PedidoDaTabelaDeServicos` para `usePaginaDeServicos`, e quem as aplica é o
 * Postgres. Então:
 *   - a busca é observável pelo resultado, porque o falso da fábrica
 *     `criarHooksFalsosDeServicos` refaz o `ILIKE` do SQL sobre o fixture;
 *   - a ordenação **não é**: o falso devolve o fixture na ordem em que ele
 *     está, de propósito. Afirmar sobre a ordem das linhas aqui seria afirmar
 *     sobre o falso, não sobre a tela. O que a tela ainda decide, e o que este
 *     arquivo prende, é **qual ordem ela pede** — daí o `PEDIDOS`, que guarda
 *     o pedido de cada render.
 * O arquivo original (branch `fase-3-servicos`) afirmava a ordem das linhas
 * depois do clique; essa asserção não sobrevive à fonte nova e está trocada
 * pela do pedido, com a divergência registrada no relatório da task.
 *
 * Fixture: três serviços com número, cliente, data, cidade e valor todos
 * distintos entre si:
 *   - 3001 / Alfa Mineração / 2026-01-10 / Recife-PE / R$ 1.000,00.
 *     Único serviço usado pelo teste de colunas.
 *   - 1002 / Beta Logística / 2026-02-15 / Olinda-PE / R$ 500,00.
 *   - 2003 / Gama Extração / 2026-03-20 / sem cidade nem UF / R$ 750,00.
 *     Único serviço com "Gama" no nome do cliente — usado pela pesquisa — e
 *     o único sem cidade, como toda NFS-e de 2025 chega da API.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const { SERVICOS_ENRIQUECIDOS, PEDIDOS } = vi.hoisted(() => ({
  SERVICOS_ENRIQUECIDOS: [
    {
      id: 1,
      numero_nfse: 3001,
      data_emissao: "2026-01-10",
      valor_servico: 1000,
      razao_social_tomador: "Alfa Mineração",
      cpf_cnpj_tomador: "11.222.333/0001-44",
      cidade_tomador: "Recife",
      uf_tomador: "PE",
      discriminacao_servico: "Calibração de bafômetro",
      valor_servico_numero: 1000,
      mes: "janeiro",
      ano: 2026,
    },
    {
      id: 2,
      numero_nfse: 1002,
      data_emissao: "2026-02-15",
      valor_servico: 500,
      razao_social_tomador: "Beta Logística",
      cpf_cnpj_tomador: "55.666.777/0001-88",
      cidade_tomador: "Olinda",
      uf_tomador: "PE",
      discriminacao_servico: "Manutenção preventiva",
      valor_servico_numero: 500,
      mes: "fevereiro",
      ano: 2026,
    },
    {
      id: 3,
      numero_nfse: 2003,
      data_emissao: "2026-03-20",
      valor_servico: 750,
      razao_social_tomador: "Gama Extração",
      cpf_cnpj_tomador: "22.333.444/0001-55",
      // Sem cidade e sem UF, como chega da API a NFS-e emitida desde 2025. A
      // API manda `null`; aqui vai `undefined` porque o `ServicoDoFixture` do
      // falso (que não é nosso) só aceita esse. O `null` tem prova própria em
      // `servicos/servicos.test.ts`.
      cidade_tomador: undefined,
      uf_tomador: undefined,
      discriminacao_servico: "Inspeção de equipamentos",
      valor_servico_numero: 750,
      mes: "marco",
      ano: 2026,
    },
  ],
  /** Todo pedido que a tela mandou para a página, na ordem dos renders. */
  PEDIDOS: [] as PedidoDaTabelaDeServicos[],
}));

// A tela deixou de ler o `ServicosContext` (item 9.4): os agregados vêm somados
// do banco e a tabela vem paginada. O falso mora em `servicos/hooksFalsos`.
// O `usePaginaDeServicos` do falso é embrulhado — não substituído — só para
// anotar o pedido: o falso continua sendo quem responde.
vi.mock("./servicos/useServicos", async (original) => {
  const real = await original<typeof import("./servicos/useServicos")>();
  const { criarHooksFalsosDeServicos } = await import("./servicos/hooksFalsos");
  const falsos = criarHooksFalsosDeServicos(SERVICOS_ENRIQUECIDOS);
  return {
    ...real,
    ...falsos,
    usePaginaDeServicos: (
      recorte: Parameters<typeof falsos.usePaginaDeServicos>[0],
      pedido: PedidoDaTabelaDeServicos,
    ) => {
      PEDIDOS.push(pedido);
      return falsos.usePaginaDeServicos(recorte, pedido);
    },
  };
});

/**
 * Dublê do recharts (mesmo do molde de `Servicos.kpis.test.tsx`) — nenhum
 * teste aqui olha para gráfico, o dublê só precisa devolver algo renderizável.
 */
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

beforeEach(() => {
  PEDIDOS.length = 0;
});

/** O último pedido que a tela mandou — o que sobrou depois de tudo assentar. */
function ultimoPedido(): PedidoDaTabelaDeServicos {
  const pedido = PEDIDOS[PEDIDOS.length - 1];
  if (!pedido) throw new Error("a tela nao pediu pagina nenhuma");
  return pedido;
}

/** O `<tbody>` da tabela, escopado — o card "Top Cliente" também mostra nome
 * de cliente, então uma busca sem escopo acha as duas ocorrências e
 * `getByText` reclama de duplicidade. */
function corpoDaTabela(): HTMLElement {
  const corpo = document.querySelector("tbody");
  if (!corpo) throw new Error("tbody nao encontrado");
  return corpo as HTMLElement;
}

/** As linhas de dado da tabela — o `<tbody>`, sem o cabeçalho. */
function linhasDaTabela(): HTMLElement[] {
  return within(corpoDaTabela()).queryAllByRole("row");
}

/** Texto de um nó, com o espaço em branco do JSX normalizado. */
function textoDe(elemento: Element): string {
  return (elemento.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * O índice da coluna cujo cabeçalho tem exatamente este rótulo.
 *
 * É a peça que prende **valor a coluna**, e não valor a linha. A lição de
 * Produtos: `within(linha).getByText(valor)` passa verde mesmo com duas
 * colunas trocadas de lugar, porque o valor continua na linha. Achar o índice
 * pelo cabeçalho e ler a célula desse índice faz a troca falhar dos dois
 * lados.
 */
function indiceDaColuna(rotulo: string): number {
  const cabecalho = document.querySelector("thead");
  if (!cabecalho) throw new Error("thead nao encontrado");
  const colunas = within(cabecalho as HTMLElement).getAllByRole("columnheader");
  const indice = colunas.findIndex((coluna) => textoDe(coluna) === rotulo);
  if (indice < 0) throw new Error(`coluna "${rotulo}" nao existe`);
  return indice;
}

/** A célula da linha que está sob o cabeçalho de rótulo dado. */
function celula(linha: HTMLElement, rotulo: string): HTMLElement {
  return within(linha).getAllByRole("cell")[indiceDaColuna(rotulo)];
}

/**
 * O botão que ordena por esta coluna.
 *
 * O clique de ordenação mora num `<button>` dentro do `<th>`, e não no `<th>`
 * (`TabelaDeServicos.tsx`, símbolo `TabelaDeServicos`): um `<th>` sozinho não
 * entra na ordem de tabulação. `aria-label="Ordenar por ..."` é o nome
 * acessível do botão, mesmo molde de `Produtos.tabela.test.tsx`.
 */
function botaoDeOrdenar(rotulo: string): HTMLElement {
  return screen.getByRole("button", { name: `Ordenar por ${rotulo}` });
}

/** A `<tr>` que contém o texto dado, procurado só dentro do `<tbody>`. */
function linhaContendo(texto: string): HTMLElement {
  const alvo = within(corpoDaTabela()).getByText(texto);
  const linha = alvo.closest("tr");
  if (!linha) throw new Error(`linha nao encontrada para "${texto}"`);
  return linha as HTMLElement;
}

/**
 * O bloco de um filtro, achado pelo TEXTO do rótulo — os `<label>` da tela não
 * têm `htmlFor`, então `getByLabelText` não acha o campo. Mesmo contorno de
 * `Servicos.periodo.test.tsx`, símbolo `blocoDoFiltro`.
 */
function campoData(rotulo: "Início" | "Fim"): HTMLInputElement {
  const campo = screen.getByText(rotulo).parentElement?.querySelector("input");
  if (!campo) throw new Error(`campo "${rotulo}" nao existe`);
  return campo as HTMLInputElement;
}

/** Esvazia a tabela pelo PERÍODO, sem tocar no campo de pesquisa — assim o
 *  teste do estado vazio não depende da plantação do teste da busca. */
function filtrarParaVazio(): void {
  fireEvent.change(campoData("Início"), { target: { value: "2030-01-01" } });
  fireEvent.change(campoData("Fim"), { target: { value: "2030-01-02" } });
}

/**
 * A linha da Alfa, coluna por coluna.
 *
 * A célula de cliente traz dois `<p>` colados (razão social e documento), sem
 * espaço entre eles — daí o texto emendado.
 */
const LINHA_DA_ALFA: Array<[string, string]> = [
  ["Número NFS-e", "3001"],
  ["Cliente (Tomador)", "Alfa Mineração11.222.333/0001-44"],
  ["Data Emissão", "10/01/2026"],
  ["Cidade/UF", "Recife/PE"],
  ["Valor", "R$ 1.000,00"],
  ["Descrição", "Ver Observações"],
];

/** Rótulo do cabeçalho -> campo que a tela manda em `ordenarPor`. */
const ORDENACAO_POR_COLUNA: Array<
  [string, PedidoDaTabelaDeServicos["ordenarPor"]]
> = [
  ["Número NFS-e", "numero"],
  ["Cliente (Tomador)", "cliente"],
  ["Data Emissão", "data_emissao"],
  ["Cidade/UF", "cidade"],
  ["Valor", "valor"],
];

describe("tabela de Serviços", () => {
  it("cada cabecalho diz ao leitor de tela a direcao da ordem", () => {
    // O botão "Ordenar por" dentro do `<th>` mostrava a direção só na seta:
    // o leitor de tela não sabia se a coluna estava crescente, decrescente
    // ou fora de uso. Ver `src/test/ordenacaoAcessivel.ts`.
    render(<Servicos />);
    conferirAriaSort("Valor");
  });

  it.each(LINHA_DA_ALFA)(
    "a coluna %s da linha da Alfa mostra %s",
    (rotulo, valor) => {
      render(<Servicos />);

      // Escopado pela linha do número "3001" (único na tabela) — não por
      // `screen.getByText("Alfa Mineração")` puro, que também acharia o card
      // "Top Cliente" (o cliente com maior faturamento no fixture é a Alfa).
      expect(textoDe(celula(linhaContendo("3001"), rotulo))).toBe(valor);
    },
  );

  it("a nota sem cidade mostra travessao na coluna Cidade/UF, e nao uma barra solta", () => {
    // O React não imprime `null`, então a célula saía "/" — em toda linha de
    // 2025 em diante, conferido no navegador em 15/09.
    render(<Servicos />);

    expect(textoDe(celula(linhaContendo("2003"), "Cidade/UF"))).toBe("—");
  });

  it("a celula de descricao traz o botao que abre as observacoes", () => {
    render(<Servicos />);

    const cel = celula(linhaContendo("3001"), "Descrição");
    expect(
      within(cel).getByRole("button", { name: "Ver Observações" }),
    ).toBeInTheDocument();
  });

  // ── O MODAL DE OBSERVAÇÕES ──────────────────────────────────────────────
  // O teste acima prova que o botão existe na célula certa, e só isso —
  // ninguém clicava nele nem conferia o que abria. Com
  // `setObservacoesSelecionadas(servico.razao_social_tomador)`, a pessoa
  // clicava esperando a discriminação do serviço e o modal mostrava
  // "Alfa Mineração": 54 testes verdes.
  //
  // O agravante é que este modal SE MOVEU nesta branch — saiu de dentro do
  // `<tbody>` de `Servicos.tsx` (onde era HTML inválido) para irmão do `Card`
  // em `TabelaDeServicos.tsx`. Mover sem um teste que observe o
  // comportamento movido é exatamente o que a regra "caracterização antes de
  // mover uma linha" existe para impedir: nada provava que ele ainda abria.

  it.each([
    ["3001", "Calibração de bafômetro"],
    ["1002", "Manutenção preventiva"],
  ])(
    "clicar em Ver Observações na linha %s abre o modal com a discriminacao dela",
    (numero, discriminacao) => {
      // Duas linhas, e não uma: com uma só, um modal que mostrasse sempre a
      // primeira nota (ou o nome do cliente daquela linha) passaria verde.
      render(<Servicos />);

      const cel = celula(linhaContendo(numero), "Descrição");
      fireEvent.click(
        within(cel).getByRole("button", { name: "Ver Observações" }),
      );

      expect(screen.getByText("Observações da Nota")).toBeInTheDocument();
      expect(screen.getByText(discriminacao)).toBeInTheDocument();
    },
  );

  it("o modal so aparece depois do clique, e o Fechar o tira da tela", () => {
    render(<Servicos />);

    expect(screen.queryByText("Observações da Nota")).not.toBeInTheDocument();

    const cel = celula(linhaContendo("3001"), "Descrição");
    fireEvent.click(
      within(cel).getByRole("button", { name: "Ver Observações" }),
    );
    expect(screen.getByText("Observações da Nota")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(screen.queryByText("Observações da Nota")).not.toBeInTheDocument();
  });

  it("as linhas saem na ordem em que a pagina chegou, sem a tela reordenar", () => {
    // O falso devolve o fixture na ordem em que ele está (Alfa, Beta, Gama) —
    // a ordenação é do servidor. Se a tela voltasse a ordenar por conta
    // própria, esta ordem mudaria.
    render(<Servicos />);

    const linhas = linhasDaTabela();
    expect(linhas).toHaveLength(3);
    expect(textoDe(celula(linhas[0], "Número NFS-e"))).toBe("3001");
    expect(textoDe(celula(linhas[1], "Número NFS-e"))).toBe("1002");
    expect(textoDe(celula(linhas[2], "Número NFS-e"))).toBe("2003");
  });

  it("a pesquisa filtra, reduzindo as linhas", () => {
    render(<Servicos />);

    expect(linhasDaTabela()).toHaveLength(3);

    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
      target: { value: "Gama" },
    });

    // O termo tem de chegar ao servidor: é ele quem procura.
    expect(ultimoPedido().busca).toBe("Gama");

    const linhas = linhasDaTabela();
    expect(linhas).toHaveLength(1);
    expect(textoDe(celula(linhas[0], "Cliente (Tomador)"))).toBe(
      "Gama Extração22.333.444/0001-55",
    );
  });

  it("a tela comeca pedindo data de emissao, da mais nova para a mais velha", () => {
    render(<Servicos />);

    expect(ultimoPedido().ordenarPor).toBe("data_emissao");
    expect(ultimoPedido().direcao).toBe("desc");
  });

  it.each(ORDENACAO_POR_COLUNA)(
    "clicar no cabecalho %s faz a tela pedir a ordem por %s",
    (rotulo, campo) => {
      // Prende rótulo do cabeçalho ao campo pedido — trocar dois `campo` de
      // lugar em `COLUNAS` (`TabelaDeServicos.tsx`) derruba dois casos.
      render(<Servicos />);

      fireEvent.click(botaoDeOrdenar(rotulo));

      expect(ultimoPedido().ordenarPor).toBe(campo);
    },
  );

  it("clicar duas vezes na mesma coluna inverte a direcao pedida", () => {
    render(<Servicos />);

    // Primeiro clique: troca de campo, e `alternarOrdenacao` começa em desc.
    fireEvent.click(botaoDeOrdenar("Número NFS-e"));
    expect(ultimoPedido().ordenarPor).toBe("numero");
    expect(ultimoPedido().direcao).toBe("desc");

    // Segundo clique: mesmo campo, inverte para asc. O botão é buscado de
    // novo porque o primeiro clique remonta o cabeçalho (a seta entra).
    fireEvent.click(botaoDeOrdenar("Número NFS-e"));
    expect(ultimoPedido().ordenarPor).toBe("numero");
    expect(ultimoPedido().direcao).toBe("asc");
  });

  it("a seta de ordenacao aparece no cabecalho clicado, e so nele", () => {
    // Cada cabeçalho já nasce com um ícone; o da coluna ordenada ganha um
    // segundo, a seta. Contar os `<svg>` prende o indicador ao cabeçalho sem
    // depender do nome da classe que o lucide gera.
    render(<Servicos />);

    const colunas = within(
      document.querySelector("thead") as HTMLElement,
    ).getAllByRole("columnheader");
    const svgsDe = (rotulo: string) =>
      colunas[indiceDaColuna(rotulo)].querySelectorAll("svg").length;

    expect(svgsDe("Data Emissão")).toBe(2);
    expect(svgsDe("Número NFS-e")).toBe(1);

    fireEvent.click(botaoDeOrdenar("Número NFS-e"));

    expect(svgsDe("Número NFS-e")).toBe(2);
    expect(svgsDe("Data Emissão")).toBe(1);
  });

  it.each(ORDENACAO_POR_COLUNA.map(([rotulo]) => rotulo))(
    "o cabecalho %s recebe foco de teclado",
    (rotulo) => {
      // `getByRole("button", ...)` sozinho NÃO prova acessibilidade de
      // teclado: um `<th role="button" aria-label="...">` satisfaria a busca
      // e continuaria fora da ordem de tabulação. Quem prova é o foco — o
      // `focus()` do jsdom só muda `document.activeElement` para elemento
      // que de fato é focável, então um `<th>` disfarçado deixa o foco no
      // `<body>` e derruba esta asserção.
      render(<Servicos />);

      const botao = botaoDeOrdenar(rotulo);
      botao.focus();

      expect(document.activeElement).toBe(botao);
    },
  );

  it("o estado vazio aparece com frase completa quando o filtro de data nao acha nada", () => {
    render(<Servicos />);

    filtrarParaVazio();

    expect(linhasDaTabela()).toHaveLength(1);
    expect(
      screen.getByText("Nenhum resultado encontrado."),
    ).toBeInTheDocument();
  });

  it("com a tabela vazia, os dois botoes de exportar ficam desabilitados", () => {
    // Os dois: exportar sem nenhuma linha gerava planilha e PDF só com o
    // cabeçalho. As duas metades da asserção importam — com a tabela cheia
    // os botões têm de continuar habilitados, senão um `disabled` fixo
    // passaria por conserto.
    render(<Servicos />);

    expect(screen.getByRole("button", { name: /^excel$/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^pdf$/i })).toBeEnabled();

    // Esvazia pelo PERÍODO, e não pela pesquisa, para não acoplar este teste
    // à plantação do teste da busca.
    filtrarParaVazio();

    expect(linhasDaTabela()).toHaveLength(1);
    expect(screen.getByRole("button", { name: /^excel$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^pdf$/i })).toBeDisabled();
  });
});
