import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Produtos from "./Produtos";

/**
 * Caracterização da tabela de Produtos SOBRE A FONTE AGREGADA (item 9.4): a
 * tela deixou de ler o `DataContext` e passou a receber o resumo já somado
 * pelo Postgres via `useComercial`. O falso mora em `comercial/hooksFalsos`
 * (ver o docblock de lá para o porquê de mocar o hook, e não a rede). Este
 * arquivo nasceu contra a fonte antiga; a Task 1 de 2026-09-10 trocou a
 * falsificação e, onde a decomposição de `main` ainda não tinha chegado
 * aqui, adaptou a forma de interagir com a tela — nunca o que ela está
 * provando. A decomposição chegou na Task 2, e a tela é hoje uma casca sobre
 * `pages/produtos/`. Ver o relatório da task para as duas divergências.
 *
 * A paginação já tem cobertura própria em `Produtos.paginacao.test.tsx` — este
 * arquivo cobre o que falta: as seis colunas, a pesquisa, o estado vazio, o
 * recorte que a tela manda para o servidor e os dois cabeçalhos ordenáveis
 * que este fixture consegue discriminar — "Quantidade" e "Código". Os outros
 * três moram em `Produtos.ordenacao.test.tsx`, pelo motivo explicado abaixo.
 *
 * Os mocks de `useAuth` e `recharts` vêm do mesmo molde da Task 1
 * (`Produtos.kpis.test.tsx` / `Produtos.multiselect.test.tsx`).
 *
 * Fixture: três produtos, com os seis números de P1 distintos entre si — é
 * P1 que o teste das colunas afirma célula a célula, e valor repetido dentro
 * da linha deixaria uma troca de coluna passar. P3 não serve para isso: com
 * uma unidade vendida o valor total e o valor médio dele são os mesmos
 * R$ 50,00.
 *
 * O que este fixture NÃO discrimina é a ordenação por valor: `valorTotal` e
 * `valorMedio` decrescentes dão os dois a mesma ordem P2, P1, P3, que ainda
 * por cima é a ordem inicial da tabela. Os cliques nesses dois cabeçalhos
 * moram em `Produtos.ordenacao.test.tsx`, com um catálogo em que os cinco
 * campos ordenáveis dão cinco ordens diferentes.
 *   - P1 "Bafômetro Digital": duas notas (3 + 2 = 5 un., R$ 300 + R$ 200 =
 *     R$ 500,00), valor médio R$ 100,00, 2 vendas (notas distintas).
 *   - P2 "Tubo Coletor de Amostra": uma nota, 10 un., R$ 1.500,00, valor
 *     médio R$ 150,00, 1 venda. Único produto com "Tubo" na descrição —
 *     usado pela pesquisa.
 *   - P3 "Detector de Gás Portátil": uma nota, 1 un., R$ 50,00, valor médio
 *     R$ 50,00, 1 venda.
 *
 * A ordenação padrão da tabela é por quantidadeVendida decrescente (mesmo
 * comportamento documentado em Produtos.paginacao.test.tsx), o que dá a
 * ordem inicial P2 (10) > P1 (5) > P3 (1) — sem empate, então determinística.
 *
 * As quatro notas têm datas de emissão espalhadas entre 2026-01-10 e
 * 2026-04-10, faixa usada pelo teste do estado vazio para filtrar por
 * período sem tocar na busca.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const { NOTAS } = vi.hoisted(() => ({
  NOTAS: [
    {
      id: 1,
      data_emissao: "2026-01-10",
      valor_nota: 300,
      cliente: { nome: "Alfa Mineração", cpf_cnpj: "11.222.333/0001-44" },
      nome_vendedor: "Vendedor A",
      itens: [
        {
          codigo: "P1",
          descricao: "Bafômetro Digital",
          quantidade: "3",
          valor_total: "300",
        },
      ],
    },
    {
      id: 2,
      data_emissao: "2026-02-10",
      valor_nota: 200,
      cliente: { nome: "Beta Logística", cpf_cnpj: "55.666.777/0001-88" },
      nome_vendedor: "Vendedor B",
      itens: [
        {
          codigo: "P1",
          descricao: "Bafômetro Digital",
          quantidade: "2",
          valor_total: "200",
        },
      ],
    },
    {
      id: 3,
      data_emissao: "2026-03-10",
      valor_nota: 1500,
      cliente: { nome: "Gama Extração", cpf_cnpj: "22.333.444/0001-55" },
      nome_vendedor: "Vendedor A",
      itens: [
        {
          codigo: "P2",
          descricao: "Tubo Coletor de Amostra",
          quantidade: "10",
          valor_total: "1500",
        },
      ],
    },
    {
      id: 4,
      data_emissao: "2026-04-10",
      valor_nota: 50,
      cliente: { nome: "Delta Engenharia", cpf_cnpj: "33.444.555/0001-66" },
      nome_vendedor: "Vendedor B",
      itens: [
        {
          codigo: "P3",
          descricao: "Detector de Gás Portátil",
          quantidade: "1",
          valor_total: "50",
        },
      ],
    },
  ],
}));

// A tela deixou de ler o `DataContext` (item 9.4): a agregação vem somada do
// banco. O falso mora em `comercial/hooksFalsos`, e para esta tela o que
// importa é o `por_produto` — é ele que virou a tabela.
vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { criarHooksFalsos, resumoDeProdutos } = await import(
    "./comercial/hooksFalsos"
  );
  return { ...real, ...criarHooksFalsos(NOTAS, resumoDeProdutos) };
});

/**
 * Dublê do recharts (mesmo do molde da Task 1) — nenhum teste aqui olha
 * para gráfico, o dublê só precisa devolver algo renderizável.
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

/** O `<tbody>` da tabela, escopado — o card "Produto Mais Vendido" também
 * mostra descrição de produto, então uma busca sem escopo por texto de
 * produto acha as duas ocorrências e `getByText` reclama de duplicidade.
 * Mesmo helper de `Produtos.paginacao.test.tsx`. */
function corpoDaTabela(): HTMLElement {
  const corpo = document.querySelector("tbody");
  if (!corpo) throw new Error("tbody nao encontrado");
  return corpo as HTMLElement;
}

/** As linhas de dado da tabela — o `<tbody>`, sem o cabeçalho. */
function linhasDaTabela(): HTMLElement[] {
  return within(corpoDaTabela()).queryAllByRole("row");
}

/** Os rótulos das colunas, na ordem em que o `<thead>` os desenha. */
function cabecalhosDaTabela(): string[] {
  const cabecalho = document.querySelector("thead");
  if (!cabecalho) throw new Error("thead nao encontrado");
  return within(cabecalho as HTMLElement)
    .getAllByRole("columnheader")
    .map((celula) => celula.textContent?.trim() ?? "");
}

/** O texto de cada célula de uma linha, na ordem das colunas. */
function celulasDaLinha(linha: HTMLElement): string[] {
  return within(linha)
    .getAllByRole("cell")
    .map((celula) => celula.textContent?.trim() ?? "");
}

/**
 * Os dois campos `input[type="date"]` do filtro de período (Data Início e
 * Data Fim), na ordem em que aparecem no DOM.
 *
 * `FiltrosDeProdutos` usa o `Input` do design system, que liga o `<label>`
 * ao `<input>` com `htmlFor` gerado por `useId` (Input.tsx:33-37) — então
 * `getByLabelText` já alcançaria os dois. Este helper por `querySelectorAll`
 * é anterior a essa migração e ficou, no mesmo espírito de `corpoDaTabela()`.
 */
function inputsDeData(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll('input[type="date"]'));
}

/**
 * A `<tr>` que contém o texto dado, procurado só dentro do `<tbody>`.
 *
 * Escopar por linha (em vez de `getAllByText` com índice) é o que sobrevive
 * à refatoração: as nove tasks seguintes vão reordenar colunas e trocar a
 * tabela de componente, mas "a linha que tem P1" continua sendo a linha que
 * tem P1 — um índice numérico quebraria a cada reordenação, mesmo sem bug
 * nenhum na tela.
 *
 * Isso vale para achar a LINHA. Dentro dela, o teste das seis colunas afirma
 * por índice de propósito: é a ordem das células que prova a associação com o
 * cabeçalho, e reordenar coluna é mudança de tela que deve mesmo aparecer no
 * diff do teste.
 */
function linhaContendo(texto: string): HTMLElement {
  const celula = within(corpoDaTabela()).getByText(texto);
  const linha = celula.closest("tr");
  if (!linha) throw new Error(`linha nao encontrada para "${texto}"`);
  return linha as HTMLElement;
}

/**
 * Escolhe uma opção num dos três multi-selects do topo.
 *
 * `rotulo` + `placeholder` formam o nome acessível do botão fechado (o
 * `aria-labelledby` do rótulo mais o valor), e `opcao` casa com o texto do
 * checkbox dentro do painel. Mesmo caminho de `Produtos.multiselect.test.tsx`.
 */
function escolherNoFiltro(rotulo: string, placeholder: string, opcao: RegExp) {
  fireEvent.click(
    screen.getByRole("button", { name: `${rotulo} ${placeholder}` }),
  );
  fireEvent.click(screen.getByRole("checkbox", { name: opcao }));
}

/**
 * O botão de ordenação de uma coluna, achado pelo nome acessível.
 *
 * O clique mora num `<button>` dentro do `<th>`, e não no `<th>` em si (ver o
 * docblock de `produtos/TabelaDeProdutos.tsx`): um `<th>` não recebe foco de
 * teclado. Procurar pelo papel, e não por `closest("th")`, é o que amarra o
 * conserto — o evento borbulha do alvo para os ancestrais e nunca desce para
 * dentro de um filho, então um teste que clicasse no `<th>` deixaria de
 * alcançar o `onClick` e o defeito não teria como voltar sem ninguém ver.
 */
function botaoDeOrdenar(rotulo: string): HTMLElement {
  return screen.getByRole("button", { name: `Ordenar por ${rotulo}` });
}

describe("tabela de Produtos", () => {
  it("as seis colunas mostram o valor certo para um produto conhecido", () => {
    // Até a revisão final de 10/09/2026 este teste fazia
    // `within(linha).getByText("R$ 500,00")` seis vezes. Isso prova que os
    // seis valores estão EM ALGUM LUGAR da linha, não que cada um está na sua
    // célula: trocar "Valor Total" com "Valor Médio" (e "Quantidade" com
    // "Nº Vendas") em `produtos/TabelaDeProdutos.tsx` — procurar por `celula`
    // — passava verde nas oito suítes de Produtos. Quem abrisse a tela para
    // saber quanto o produto faturou leria R$ 100,00 em vez de R$ 500,00 e
    // decidiria sobre isso, com o cabeçalho certo por cima.
    //
    // A associação é entre CABEÇALHO e CÉLULA, então são duas afirmações: a
    // ordem dos rótulos e o conteúdo das células nessa mesma ordem. Uma sem a
    // outra ainda deixa passar — só as células deixa escapar a troca dos
    // rótulos, só os rótulos deixa escapar a troca dos valores. Comparar o
    // array inteiro com `toEqual`, e não valor a valor, é o que fecha a troca
    // simétrica: mexer nos dois lados mantém o conjunto e muda a ordem.
    render(<Produtos />);

    expect(cabecalhosDaTabela()).toEqual([
      "Código",
      "Produto",
      "Quantidade",
      "Valor Total",
      "Valor Médio",
      "Nº Vendas",
    ]);

    expect(celulasDaLinha(linhaContendo("P1"))).toEqual([
      "P1",
      "Bafômetro Digital",
      "5",
      "R$ 500,00",
      "R$ 100,00",
      "2",
    ]);
  });

  it("a pesquisa filtra pela descricao, reduzindo as linhas", () => {
    render(<Produtos />);

    expect(linhasDaTabela()).toHaveLength(3);

    fireEvent.change(screen.getByPlaceholderText("Pesquisar produto..."), {
      target: { value: "Tubo" },
    });

    expect(linhasDaTabela()).toHaveLength(1);
    expect(
      within(corpoDaTabela()).getByText("Tubo Coletor de Amostra"),
    ).toBeInTheDocument();
    expect(
      within(corpoDaTabela()).queryByText("Bafômetro Digital"),
    ).not.toBeInTheDocument();
    expect(
      within(corpoDaTabela()).queryByText("Detector de Gás Portátil"),
    ).not.toBeInTheDocument();
  });

  it("o cabecalho ordenavel alcanca o teclado", () => {
    // O defeito: o `onClick` de ordenacao morava no `<th>`, que nao entra na
    // ordem de tabulacao — quem navega por teclado nao conseguia reordenar a
    // tabela de jeito nenhum. Chamar `focus()` num `<th>` deixa o
    // `activeElement` no `<body>`; num `<button>`, nao.
    //
    // A asserção olha o foco, e nao so a existencia do botao: um `<th>` com
    // `role="button"` satisfaria o `getByRole` e continuaria inalcancavel.
    render(<Produtos />);

    const botao = botaoDeOrdenar("Quantidade");
    botao.focus();

    expect(document.activeElement).toBe(botao);
  });

  it("clicar no cabecalho de quantidade ordena, e clicar de novo inverte", () => {
    render(<Produtos />);

    // Ordem inicial (quantidadeVendida decrescente): P2 (10), P1 (5), P3 (1).
    let linhas = linhasDaTabela();
    expect(within(linhas[0]).getByText("P2")).toBeInTheDocument();
    expect(within(linhas[2]).getByText("P3")).toBeInTheDocument();

    const colQuantidade = botaoDeOrdenar("Quantidade");

    // Primeiro clique: a tabela ja estava ordenada por quantidadeVendida
    // desc, entao alternarOrdenacao inverte para asc.
    fireEvent.click(colQuantidade);
    linhas = linhasDaTabela();
    expect(within(linhas[0]).getByText("P3")).toBeInTheDocument();
    expect(within(linhas[2]).getByText("P2")).toBeInTheDocument();

    // Segundo clique: inverte de volta para desc.
    fireEvent.click(colQuantidade);
    linhas = linhasDaTabela();
    expect(within(linhas[0]).getByText("P2")).toBeInTheDocument();
    expect(within(linhas[2]).getByText("P3")).toBeInTheDocument();
  });

  it("clicar no cabecalho de codigo reordena a tabela pelo codigo", () => {
    // Este teste era, ate a Task 4, a caracterizacao de um DEFEITO: o `switch`
    // de `ordenarEBuscar` (`produtos/produtos.ts`, procurar pelo
    // `case "descricao"` — sem numero de linha de proposito, porque o `case`
    // novo desloca tudo abaixo dele) nao tinha `case "codigo"` e caia no
    // `default: return 0`, entao o clique mudava o estado de ordenacao sem
    // mexer numa linha. O `case` entrou, e a asserção virou a do conserto.
    //
    // Alternar a DIRECAO e o que prova o conserto: a ordem inicial da tabela
    // (quantidadeVendida desc) e P2, P1, P3 — nem a ascendente nem a
    // descendente por codigo coincidem com ela, entao nenhum dos dois cliques
    // pode passar por acidente.
    render(<Produtos />);

    const colCodigo = botaoDeOrdenar("Código");

    // Primeiro clique num campo novo: `alternarOrdenacao` (`Produtos.tsx`)
    // sempre comeca em desc.
    fireEvent.click(colCodigo);
    let linhas = linhasDaTabela();
    expect(within(linhas[0]).getByText("P3")).toBeInTheDocument();
    expect(within(linhas[1]).getByText("P2")).toBeInTheDocument();
    expect(within(linhas[2]).getByText("P1")).toBeInTheDocument();

    // Segundo clique no mesmo campo: inverte para asc.
    fireEvent.click(colCodigo);
    linhas = linhasDaTabela();
    expect(within(linhas[0]).getByText("P1")).toBeInTheDocument();
    expect(within(linhas[1]).getByText("P2")).toBeInTheDocument();
    expect(within(linhas[2]).getByText("P3")).toBeInTheDocument();
  });

  it("o estado vazio aparece com frase completa quando o filtro nao acha nada", () => {
    render(<Produtos />);

    // Esvazia a tabela pelo filtro de PERIODO, nao pela busca: empresa,
    // vendedor, produto e data viram o recorte que vai para o servidor
    // (`recorteDeProdutos`, em `produtos/produtos.ts`) — quatro mecanismos
    // independentes de `pesquisaTabela`, que so entra depois, no
    // `ordenarEBuscar` da tabela. A citação anterior falava de `notasFiltradas`
    // e `filtrarNotas`, que morreram quando a fonte virou o resumo agregado.
    // Um intervalo fora do range das notas (2026-01-10 a
    // 2026-04-10) esvazia `produtosAgregados` sem tocar no campo de pesquisa,
    // o que mantem este teste desacoplado da plantacao de "pesquisa filtra".
    const [dataInicio, dataFim] = inputsDeData();
    fireEvent.change(dataInicio, { target: { value: "2030-01-01" } });
    fireEvent.change(dataFim, { target: { value: "2030-01-02" } });

    expect(linhasDaTabela()).toHaveLength(1);
    expect(
      screen.getByText("Nenhum resultado encontrado."),
    ).toBeInTheDocument();

    // A frase tem de abranger as SEIS colunas. Com `colSpan` menor ela
    // encolhe para debaixo das primeiras e o resto da largura fica em branco,
    // como se a tabela tivesse uma linha cortada pela metade — cosmético, mas
    // nada via, porque o `getByText` acima passa com qualquer `colSpan`.
    expect(within(corpoDaTabela()).getByRole("cell")).toHaveAttribute(
      "colspan",
      "6",
    );
  });

  // Este teste era, ate a Task 4, a caracterizacao de um DEFEITO: o `Button`
  // de "Exportar Excel" em `produtos/TabelaDeProdutos.tsx` nunca levava
  // `disabled`, e um clique com a tabela vazia gerava uma planilha so com
  // cabecalho. O `disabled={total === 0}` entrou, e a asserção virou a do
  // conserto.
  it("com a tabela vazia, o botao de exportar fica desabilitado", () => {
    render(<Produtos />);

    // Com as tres linhas do fixture ele continua clicavel — sem esta primeira
    // asserção, um `disabled` cravado em `true` passaria no teste inteiro.
    expect(
      screen.getByRole("button", { name: /exportar excel/i }),
    ).toBeEnabled();

    // Mesmo filtro de periodo do teste do estado vazio, para nao acoplar
    // esta plantacao a "pesquisa filtra".
    const [dataInicio, dataFim] = inputsDeData();
    fireEvent.change(dataInicio, { target: { value: "2030-01-01" } });
    fireEvent.change(dataFim, { target: { value: "2030-01-02" } });

    expect(linhasDaTabela()).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: /exportar excel/i }),
    ).toBeDisabled();
  });

  it("com a busca sem resultado, o botao de exportar tambem desabilita", () => {
    // `total` e o recorte inteiro (filtro + busca), e nao a pagina. Trocar
    // por `produtos.length === 0` daria o mesmo resultado aqui, mas trocar
    // por uma leitura do filtro de periodo nao — este caso e o que separa os
    // dois caminhos que esvaziam a tabela.
    render(<Produtos />);

    fireEvent.change(screen.getByPlaceholderText("Pesquisar produto..."), {
      target: { value: "termo que nao existe em produto nenhum" },
    });

    expect(linhasDaTabela()).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: /exportar excel/i }),
    ).toBeDisabled();
  });
});

/**
 * O recorte que a tela manda para o servidor.
 *
 * Estes cinco casos existem porque a revisão da Task 2 plantou `vendedor: []`,
 * `produto: []` e `dataFim: ""` no recorte de `Produtos.tsx` e os 45 testes
 * ficaram verdes: nada observava o que sai daqui. Cenário do pior deles — a
 * pessoa escolhe um fim de período, o campo mostra a data, e a query vai sem
 * `data_fim`: o Postgres devolve tudo até o fim do histórico e os KPIs incham,
 * com a suíte verde.
 *
 * Por que pela TELA, e não por um teste de `recorteDeProdutos`: a conta pura já
 * está coberta em `produtos/produtos.test.ts`, e o buraco não estava nela — era
 * a chamada em `Produtos.tsx` que podia passar o campo errado. Quem enxerga
 * isso é o falso de `comercial/hooksFalsos`, que APLICA o recorte antes de
 * montar o resumo: se o recorte sai capenga, sobram notas que deviam ter ficado
 * de fora, e isso aparece nas linhas da tabela. Também por isso as asserções
 * olham a quantidade somada, e não só quais linhas ficaram — o filtro tem de
 * chegar ao agregado, não apenas esconder linha.
 *
 * As datas são digitadas em vez de vir de um preset: as quatro notas do fixture
 * são todas de 2026, então "Ano atual" não cortaria nada e o teste não veria
 * diferença nenhuma entre mandar e não mandar a data.
 */
describe("recorte de Produtos", () => {
  it("escolher a empresa recorta o agregado por cliente", () => {
    render(<Produtos />);
    expect(linhasDaTabela()).toHaveLength(3);

    escolherNoFiltro("Empresas", "Todas as empresas", /Alfa Mineração/);

    const linhas = linhasDaTabela();
    expect(linhas).toHaveLength(1);
    expect(within(linhas[0]).getByText("P1")).toBeInTheDocument();
    // 3 un., e não as 5 das duas notas de P1: a nota de Beta ficou fora.
    expect(within(linhas[0]).getByText("3")).toBeInTheDocument();
  });

  it("escolher o vendedor recorta o agregado por vendedor", () => {
    render(<Produtos />);

    escolherNoFiltro("Vendedores", "Todos os vendedores", /Vendedor A/);

    // Vendedor A vendeu as notas 1 (P1, 3 un.) e 3 (P2); P3 é do Vendedor B.
    expect(linhasDaTabela()).toHaveLength(2);
    expect(
      within(corpoDaTabela()).queryByText("Detector de Gás Portátil"),
    ).not.toBeInTheDocument();
    expect(within(linhaContendo("P1")).getByText("3")).toBeInTheDocument();
  });

  it("escolher o produto recorta o agregado por produto", () => {
    render(<Produtos />);

    escolherNoFiltro(
      "Produtos",
      "Todos os produtos",
      /Tubo Coletor de Amostra/,
    );

    const linhas = linhasDaTabela();
    expect(linhas).toHaveLength(1);
    expect(within(linhas[0]).getByText("P2")).toBeInTheDocument();
  });

  it("a data de início corta as notas anteriores a ela", () => {
    render(<Produtos />);

    const [dataInicio] = inputsDeData();
    fireEvent.change(dataInicio, { target: { value: "2026-03-01" } });

    // Sobram as notas 3 (10/03) e 4 (10/04); as de janeiro e fevereiro saem.
    expect(linhasDaTabela()).toHaveLength(2);
    expect(
      within(corpoDaTabela()).queryByText("Bafômetro Digital"),
    ).not.toBeInTheDocument();
  });

  it("a data de fim corta as notas posteriores a ela", () => {
    render(<Produtos />);

    const [, dataFim] = inputsDeData();
    fireEvent.change(dataFim, { target: { value: "2026-02-28" } });

    // Sobram as notas 1 (10/01) e 2 (10/02), as duas de P1 — 3 + 2 = 5 un.
    const linhas = linhasDaTabela();
    expect(linhas).toHaveLength(1);
    expect(within(linhas[0]).getByText("P1")).toBeInTheDocument();
    expect(within(linhas[0]).getByText("5")).toBeInTheDocument();
    expect(
      within(corpoDaTabela()).queryByText("Tubo Coletor de Amostra"),
    ).not.toBeInTheDocument();
  });
});
