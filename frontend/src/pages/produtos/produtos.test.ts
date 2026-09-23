import { describe, expect, it } from "vitest";

import {
  calcularKpis,
  evolucaoDoResumo,
  indicesDeRotulo,
  linhasDaPlanilha,
  ordenarEBuscar,
  produtosDoResumo,
  rankingPorValor,
  recorteDeProdutos,
  rotuloDoCliente,
  rotuloDoProduto,
  type ProdutoAgregado,
} from "./produtos";

/**
 * A conta pura de Produtos, testada como conta.
 *
 * Os cinco arquivos `Produtos.*.test.tsx` já caracterizam a tela renderizada
 * — filtros, KPIs, gráfico e tabela pelo que a pessoa vê. Aqui ficam as
 * bordas que a tela não exercita facilmente: lista vazia, empate no "mais
 * vendido", pesquisa sem resultado, e — desde que a fonte virou o resumo
 * agregado do Postgres — as traduções entre o rótulo que a tela mostra e o
 * id/chave que o servidor filtra. Nenhuma delas foi corrigida ao mover — só
 * registradas, quando têm cara de defeito.
 */

describe("rotuloDoCliente", () => {
  it("junta nome e documento no formato que o multi-select mostra", () => {
    expect(
      rotuloDoCliente({
        nome: "Alfa Mineração",
        cpf_cnpj: "11.222.333/0001-44",
      }),
    ).toBe("Alfa Mineração (11.222.333/0001-44)");
  });
});

describe("rotuloDoProduto", () => {
  it("junta descrição e código", () => {
    expect(
      rotuloDoProduto({ descricao: "Bafômetro Phoebus", codigo: "P1" }),
    ).toBe("Bafômetro Phoebus (P1)");
  });

  it("sem código, escreve 'sem código' em vez de deixar o parêntese vazio", () => {
    // A fonte nova devolve `codigo: null` para item mal cadastrado no Tiny —
    // antes esses itens nem chegavam à tela, agora chegam e precisam de um
    // rótulo que a pessoa consiga escolher no multi-select.
    expect(
      rotuloDoProduto({ descricao: "Item sem código", codigo: null }),
    ).toBe("Item sem código (sem código)");
  });
});

describe("indicesDeRotulo", () => {
  it("mapeia o rótulo de volta para o id do cliente e a chave do produto", () => {
    const indices = indicesDeRotulo({
      clientes: [
        { id: 7, nome: "Alfa Mineração", cpf_cnpj: "11.222.333/0001-44" },
        { id: 9, nome: "Beta Logística", cpf_cnpj: "55.666.777/0001-88" },
      ],
      vendedores: ["Vendedor A"],
      produtos: [
        { chave: "P1", codigo: "P1", descricao: "Bafômetro Phoebus", valor: 0 },
        { chave: "#Tubo", codigo: null, descricao: "Tubo", valor: 0 },
      ],
    });

    expect(indices.idPorRotulo.get("Alfa Mineração (11.222.333/0001-44)")).toBe(
      7,
    );
    expect(indices.idPorRotulo.get("Beta Logística (55.666.777/0001-88)")).toBe(
      9,
    );
    expect(indices.chavePorRotulo.get("Bafômetro Phoebus (P1)")).toBe("P1");
    expect(indices.chavePorRotulo.get("Tubo (sem código)")).toBe("#Tubo");
  });
});

describe("recorteDeProdutos", () => {
  const INDICES = {
    idPorRotulo: new Map([["Alfa Mineração (11.222.333/0001-44)", 7]]),
    chavePorRotulo: new Map([["Bafômetro Phoebus (P1)", "P1"]]),
  };

  it("troca os rótulos escolhidos pelos ids e chaves que o servidor filtra", () => {
    const recorte = recorteDeProdutos(
      {
        empresa: ["Alfa Mineração (11.222.333/0001-44)"],
        vendedor: ["Vendedor A"],
        produto: ["Bafômetro Phoebus (P1)"],
        dataInicio: "2026-01-01",
        dataFim: "2026-12-31",
      },
      INDICES,
    );

    expect(recorte).toEqual({
      clientes: [7],
      vendedores: ["Vendedor A"],
      produtos: ["P1"],
      dataInicio: "2026-01-01",
      dataFim: "2026-12-31",
    });
  });

  it("descarta rótulo que não está no índice, em vez de mandar buraco para o servidor", () => {
    // O índice só é montado depois que `useFiltrosComerciais` responde. Um
    // rótulo que não casa vira `undefined` no `map`, e mandar esse `undefined`
    // no array faria a query string levar um filtro vazio — que não casa com
    // nada e zeraria a tela (ver `paramsDoRecorte`).
    const recorte = recorteDeProdutos(
      {
        empresa: ["Empresa que nao existe no indice"],
        vendedor: [],
        produto: ["Produto que nao existe no indice"],
        dataInicio: "",
        dataFim: "",
      },
      INDICES,
    );

    expect(recorte.clientes).toEqual([]);
    expect(recorte.produtos).toEqual([]);
  });
});

describe("produtosDoResumo", () => {
  it("renomeia os campos do resumo e deriva o valor médio, que o servidor não manda", () => {
    const agregados = produtosDoResumo([
      {
        chave: "P1",
        codigo: "P1",
        descricao: "Bafômetro Phoebus",
        quantidade: 5,
        valor: 500,
        notas: 2,
      },
    ]);

    expect(agregados).toEqual([
      {
        chave: "P1",
        codigo: "P1",
        descricao: "Bafômetro Phoebus",
        quantidadeVendida: 5,
        valorTotal: 500,
        valorMedio: 100,
        numeroVendas: 2,
      },
    ]);
  });

  it("com quantidade zero o valor médio é zero, e não NaN nem Infinity", () => {
    const [agregado] = produtosDoResumo([
      {
        chave: "P1",
        codigo: "P1",
        descricao: "Devolvido",
        quantidade: 0,
        valor: 300,
        notas: 1,
      },
    ]);

    expect(agregado.valorMedio).toBe(0);
  });

  it("item sem código fica com código vazio, mas guarda a chave que o distingue", () => {
    // A fonte nova inclui item sem código (36 itens, 0,12% do valor), que a
    // agregação antiga descartava. Os dois ficam com `codigo: ""` — e era só
    // isso que a conversão devolvia, então `TabelaDeProdutos` os renderizava
    // com a mesma `key` do React. A `chave` do resumo vem junto agora, e é
    // ela que os separa.
    const agregados = produtosDoResumo([
      {
        chave: "#Tubo",
        codigo: null,
        descricao: "Tubo",
        quantidade: 1,
        valor: 10,
        notas: 1,
      },
      {
        chave: "#Filtro",
        codigo: null,
        descricao: null,
        quantidade: 2,
        valor: 20,
        notas: 1,
      },
    ]);

    expect(agregados.map((p) => p.codigo)).toEqual(["", ""]);
    expect(agregados.map((p) => p.chave)).toEqual(["#Tubo", "#Filtro"]);
    expect(agregados[1].descricao).toBe("");
  });
});

describe("calcularKpis", () => {
  it("com lista vazia devolve zeros e produtoMaisVendido nulo, sem dividir por zero", () => {
    // `ticketMedio` é totalFaturado / totalProdutosVendidos — com lista
    // vazia os dois são 0, e só não vira NaN por causa da guarda
    // `totalProdutosVendidos > 0` (achado confirmado no brief, não corrigido).
    const kpis = calcularKpis([]);

    expect(kpis).toEqual({
      totalProdutosVendidos: 0,
      totalFaturado: 0,
      ticketMedio: 0,
      produtoMaisVendido: null,
      totalProdutosUnicos: 0,
    });
  });

  it("com lista cheia devolve os cinco números, cada um no seu campo", () => {
    // O único teste com `toEqual` sobre o objeto inteiro era o da lista vazia,
    // onde os cinco campos valem 0 ou `null` — qualquer troca entre eles passa
    // ali. Foi assim que duas plantações atravessaram a suíte de 1524 testes:
    // trocar `totalFaturado` e `ticketMedio` entre si (a tela passava a dizer
    // que a empresa faturou R$ 162,50) e dobrar `totalProdutosUnicos`.
    //
    // Os cinco valores abaixo são distintos entre si de propósito: 8, 1300,
    // 162,5 e 2 não coincidem, então nenhuma troca entre campos sobrevive.
    const agregados: ProdutoAgregado[] = [
      {
        chave: "P1",
        codigo: "P1",
        descricao: "Bafômetro Phoebus",
        quantidadeVendida: 3,
        valorTotal: 300,
        valorMedio: 100,
        numeroVendas: 1,
      },
      {
        chave: "P2",
        codigo: "P2",
        descricao: "Tubo descartável",
        quantidadeVendida: 5,
        valorTotal: 1000,
        valorMedio: 200,
        numeroVendas: 1,
      },
    ];

    expect(calcularKpis(agregados)).toEqual({
      totalProdutosVendidos: 8,
      totalFaturado: 1300,
      ticketMedio: 162.5,
      produtoMaisVendido: agregados[1],
      totalProdutosUnicos: 2,
    });
  });

  it("com empate na quantidade vendida, o primeiro da lista ganha o mais vendido", () => {
    // O reduce usa `>` estrito: um produto empatado com o atual líder não o
    // substitui, então quem aparece primeiro na lista de agregados vence o
    // empate — não é o de maior valorTotal nem o de menor código.
    const agregados: ProdutoAgregado[] = [
      {
        chave: "P1",
        codigo: "P1",
        descricao: "Primeiro no empate",
        quantidadeVendida: 5,
        valorTotal: 100,
        valorMedio: 20,
        numeroVendas: 1,
      },
      {
        chave: "P2",
        codigo: "P2",
        descricao: "Segundo no empate",
        quantidadeVendida: 5,
        valorTotal: 500,
        valorMedio: 100,
        numeroVendas: 1,
      },
    ];

    const kpis = calcularKpis(agregados);

    expect(kpis.produtoMaisVendido?.codigo).toBe("P1");
  });
});

describe("evolucaoDoResumo", () => {
  it("desenha um ponto por mês, com o mês certo — jan é 1, e não 0", () => {
    // `mes` chega do banco de 1 a 12 e o `Date` do JS conta de 0 a 11. É por
    // isso que a conversão faz `m.mes - 1`; sem isso janeiro viraria
    // fevereiro e dezembro viraria janeiro do ano seguinte.
    const pontos = evolucaoDoResumo([
      {
        ano: 2026,
        mes: 1,
        total: 0,
        total_produtos: 0,
        notas: 1,
        quantidade: 7,
      },
      {
        ano: 2026,
        mes: 12,
        total: 0,
        total_produtos: 0,
        notas: 1,
        quantidade: 3,
      },
    ]);

    expect(pontos).toHaveLength(2);
    expect(pontos[0].mes).toMatch(/jan/i);
    expect(pontos[0].mes).toContain("2026");
    expect(pontos[1].mes).toMatch(/dez/i);
    expect(pontos[0].total).toBe(7);
    expect(pontos[1].total).toBe(3);
  });

  it("passando de 24 meses, agrupa por ano e soma as quantidades do ano", () => {
    // O banco devolve mês a mês; agrupar acima de 24 é decisão da TELA (um
    // gráfico com 40 rótulos mensais fica ilegível), e por isso sobreviveu ao
    // `evolucaoPorMes` que morreu quando a agregação virou do Postgres.
    const meses = Array.from({ length: 25 }, (_, i) => ({
      ano: 2025 + Math.floor(i / 12),
      mes: (i % 12) + 1,
      total: 0,
      total_produtos: 0,
      notas: 1,
      quantidade: 1,
    }));

    const pontos = evolucaoDoResumo(meses);

    expect(pontos.map((p) => p.mes)).toEqual(["2025", "2026", "2027"]);
    expect(pontos.map((p) => p.total)).toEqual([12, 12, 1]);
  });

  it("com exatamente 24 meses continua mensal", () => {
    // A fronteira é `> 24`, e não `>= 24`: com dois anos cheios o gráfico
    // ainda mostra mês a mês.
    const meses = Array.from({ length: 24 }, (_, i) => ({
      ano: 2025 + Math.floor(i / 12),
      mes: (i % 12) + 1,
      total: 0,
      total_produtos: 0,
      notas: 1,
      quantidade: 1,
    }));

    expect(evolucaoDoResumo(meses)).toHaveLength(24);
  });
});

describe("rankingPorValor", () => {
  /**
   * Três produtos em que a ordem por VALOR é o inverso da ordem por
   * QUANTIDADE, e nenhuma das duas é a ordem de entrada.
   *
   * Sem esse cuidado o teste passaria lendo o campo errado: com um catálogo em
   * que quem mais fatura também é quem mais sai, ordenar por quantidade daria
   * o mesmo resultado.
   */
  const CATALOGO: ProdutoAgregado[] = [
    {
      chave: "P1",
      codigo: "P1",
      descricao: "Bafômetro Digital",
      quantidadeVendida: 10,
      valorTotal: 400,
      valorMedio: 40,
      numeroVendas: 3,
    },
    {
      chave: "P2",
      codigo: "P2",
      descricao: "Tubo Coletor de Amostra",
      quantidadeVendida: 2,
      valorTotal: 1500,
      valorMedio: 750,
      numeroVendas: 1,
    },
    {
      chave: "P3",
      codigo: "P3",
      descricao: "Detector de Gás Portátil",
      quantidadeVendida: 30,
      valorTotal: 12,
      valorMedio: 0.4,
      numeroVendas: 1,
    },
  ];

  it("põe na frente quem mais faturou, e não quem faturou menos", () => {
    // A revisão da Task 2 inverteu o `sort` para ascendente e os 45 testes
    // continuaram verdes: o gráfico "Top 10 Produtos (Valor)" passaria a
    // desenhar os dez produtos MAIS BARATOS com o título intacto — a primeira
    // barra viraria o item de R$ 12,00 no lugar do de R$ 1.500,00.
    expect(rankingPorValor(CATALOGO, 10).map((p) => p.codigo)).toEqual([
      "P2",
      "P1",
      "P3",
    ]);
  });

  it("corta no limite pedido, ficando com os de maior valor", () => {
    // Trocar `.slice(0, limite)` por `.slice(0, 1)` também passava verde. O
    // limite é o "10" do título do gráfico: se ele não for respeitado, o
    // rótulo mente sobre quantas barras estão ali.
    expect(rankingPorValor(CATALOGO, 2).map((p) => p.codigo)).toEqual([
      "P2",
      "P1",
    ]);
  });
});

describe("ordenarEBuscar", () => {
  /**
   * Três produtos em que os quatro campos numéricos e de descrição dão quatro
   * ordens DIFERENTES entre si, e nenhuma delas é a ordem de entrada.
   *
   * É o que faz cada `case` do `switch` ser observável: a revisão da Task 2
   * trocou o `case "valorTotal"` para ler `valorMedio` e os 45 testes ficaram
   * verdes, porque só o ramo `quantidadeVendida` era exercitado. Com um
   * catálogo em que dois campos concordassem na ordem, a plantação voltaria a
   * passar.
   *
   *   descrição ↓ P2, P3, P1  ·  quantidade ↓ P2, P1, P3
   *   valor total ↓ P1, P3, P2  ·  valor médio ↓ P3, P1, P2
   *
   * O código é a exceção de propósito: P1, P2, P3 entram nessa ordem, então
   * a ASCENDENTE por código coincide com a ordem de entrada — e por isso o
   * teste de código afirma a DESCENDENTE, que não coincide com nada.
   */
  const CATALOGO: ProdutoAgregado[] = [
    {
      chave: "P1",
      codigo: "P1",
      descricao: "Bafômetro Digital",
      quantidadeVendida: 10,
      valorTotal: 1000,
      valorMedio: 100,
      numeroVendas: 4,
    },
    {
      chave: "P2",
      codigo: "P2",
      descricao: "Tubo Coletor de Amostra",
      quantidadeVendida: 20,
      valorTotal: 800,
      valorMedio: 40,
      numeroVendas: 2,
    },
    {
      chave: "P3",
      codigo: "P3",
      descricao: "Máscara de Solda",
      quantidadeVendida: 5,
      valorTotal: 900,
      valorMedio: 180,
      numeroVendas: 1,
    },
  ];

  /** Os códigos na ordem em que a tabela os mostraria. */
  function ordemPor(campo: string): string[] {
    return ordenarEBuscar(CATALOGO, "", { campo, direcao: "desc" }).map(
      (p) => p.codigo,
    );
  }

  it("ordena por código, e não pela ordem de entrada", () => {
    // O `switch` de `ordenarEBuscar` não tinha `case "codigo"`: clicar no
    // cabeçalho da coluna Código mudava o estado de ordenação e caía no
    // `default: return 0`, deixando a tabela exatamente como estava.
    // O catálogo entra P1, P2, P3 — a ordem de entrada é a ASCENDENTE por
    // código, então só a descendente prova que o `case` existe.
    expect(ordemPor("codigo")).toEqual(["P3", "P2", "P1"]);
    expect(
      ordenarEBuscar(CATALOGO, "", { campo: "codigo", direcao: "asc" }).map(
        (p) => p.codigo,
      ),
    ).toEqual(["P1", "P2", "P3"]);
  });

  it("ordena por descrição, de Z para A", () => {
    expect(ordemPor("descricao")).toEqual(["P2", "P3", "P1"]);
  });

  it("ordena por quantidade vendida, da maior para a menor", () => {
    expect(ordemPor("quantidadeVendida")).toEqual(["P2", "P1", "P3"]);
  });

  it("ordena por valor total, e não pelo preço unitário médio", () => {
    // Cenário do defeito: a pessoa clica em "Valor Total" esperando ver
    // primeiro quem mais faturou, e sobe ao topo um item de baixo giro e alto
    // preço unitário (aqui, P3 — R$ 180 a unidade, R$ 900 no total).
    expect(ordemPor("valorTotal")).toEqual(["P1", "P3", "P2"]);
  });

  it("ordena por valor médio, e não pelo faturamento", () => {
    expect(ordemPor("valorMedio")).toEqual(["P3", "P1", "P2"]);
  });

  it("a pesquisa acha pelo código, e não só pela descrição", () => {
    // O `filter` da pesquisa tem dois ramos, descrição e código, e só o da
    // descrição era exercitado: apagar `p.codigo?.toLowerCase().includes(...)`
    // ficava verde na suíte inteira. Cenário: a pessoa digita "P2" no campo
    // "Pesquisar produto..." e a tabela responde "Nenhum resultado
    // encontrado." com o produto P2 listado logo acima, antes de ela digitar.
    //
    // Nenhuma das três descrições do catálogo contém "p2", então este termo só
    // pode casar pelo código — é o que torna o ramo observável.
    expect(
      ordenarEBuscar(CATALOGO, "P2", { campo: "codigo", direcao: "desc" }).map(
        (p) => p.codigo,
      ),
    ).toEqual(["P2"]);
  });

  it("com pesquisa que não acha nada devolve lista vazia", () => {
    const agregados: ProdutoAgregado[] = [
      {
        chave: "P1",
        codigo: "P1",
        descricao: "Bafômetro Phoebus",
        quantidadeVendida: 5,
        valorTotal: 500,
        valorMedio: 100,
        numeroVendas: 1,
      },
    ];

    const resultado = ordenarEBuscar(
      agregados,
      "termo que nao existe em nenhum produto",
      {
        campo: "quantidadeVendida",
        direcao: "desc",
      },
    );

    expect(resultado).toEqual([]);
  });
});

describe("linhasDaPlanilha", () => {
  /**
   * Uma linha cujos seis valores são distintos entre si — inclusive o código,
   * que é texto, e a descrição. Valor repetido deixaria uma troca de coluna
   * passar despercebida, que é exatamente o defeito que este bloco fecha.
   */
  const UMA_LINHA: ProdutoAgregado[] = [
    {
      chave: "P1",
      codigo: "P1",
      descricao: "Produto A",
      quantidadeVendida: 3,
      valorTotal: 300,
      valorMedio: 100,
      numeroVendas: 2,
    },
  ];

  it("exporta as seis colunas na ordem em que a tabela mostra", () => {
    expect(Object.keys(linhasDaPlanilha(UMA_LINHA)[0])).toEqual([
      "Código",
      "Produto",
      "Quantidade Vendida",
      "Valor Total",
      "Valor Médio",
      "Número de Vendas",
    ]);
  });

  it("cada cabecalho leva o valor do campo que ele nomeia", () => {
    // Até a revisão final de 10/09/2026, os dois testes desta planilha
    // olhavam só `Object.keys` e `toHaveLength`: NENHUM valor era conferido.
    // Trocar "Valor Total" por `p.valorMedio`, ou o "Código" pela descrição,
    // ou os dois valores entre si, passava verde na suíte inteira.
    //
    // Cenário: a pessoa filtra o trimestre, exporta, abre o `.xlsx` e manda
    // para a chefia. A coluna "Valor Total" traz o preço unitário médio —
    // números 5 a 200 vezes menores que o faturamento real, com o cabeçalho
    // certo por cima. A tela na frente dela mostra os valores corretos, então
    // nada denuncia a divergência.
    //
    // `toEqual` sobre o objeto inteiro, e não campo a campo: a troca simétrica
    // entre duas colunas mantém o conjunto de valores e só a comparação do
    // objeto todo a pega.
    expect(linhasDaPlanilha(UMA_LINHA)[0]).toEqual({
      Código: "P1",
      Produto: "Produto A",
      "Quantidade Vendida": 3,
      "Valor Total": 300,
      "Valor Médio": 100,
      "Número de Vendas": 2,
    });
  });

  it("exporta o recorte inteiro, nao so uma pagina", () => {
    // A versao classica desse defeito: trocar o recorte completo (o que
    // `ordenarEBuscar` devolve) pela pagina que `usePaginacao` recorta para
    // a tabela. Aqui o recorte tem mais itens do que cabe numa pagina de 15
    // para provar que nada corta a lista antes de exportar.
    const agregados: ProdutoAgregado[] = Array.from({ length: 20 }, (_, i) => ({
      chave: `P${i + 1}`,
      codigo: `P${i + 1}`,
      descricao: `Produto ${i + 1}`,
      quantidadeVendida: 1,
      valorTotal: 1,
      valorMedio: 1,
      numeroVendas: 1,
    }));

    expect(linhasDaPlanilha(agregados)).toHaveLength(20);
  });
});

describe("ordenarEBuscar — empate", () => {
  /**
   * O comparador nunca devolvia 0: num empate respondia −1 para (a, b) E para
   * (b, a), e a ordem final dependia da ordem em que os produtos chegavam — a
   * mesma tabela, com os mesmos números, mudava de uma carga para outra.
   * Agora o empate desempata pela descrição e, nela empatada, pelo código,
   * como em Estoque.
   *
   * Três produtos com o MESMO valor total, quantidade e valor médio; duas
   * ordens de entrada, e a tabela tem de sair igual nas duas.
   */
  const empatado = (codigo: string, descricao: string): ProdutoAgregado => ({
    chave: codigo,
    codigo,
    descricao,
    quantidadeVendida: 3,
    valorTotal: 600,
    valorMedio: 200,
    numeroVendas: 1,
  });
  const UMA_ORDEM = [
    empatado("B2", "Bocal"),
    empatado("A1", "Alfa"),
    empatado("B1", "Bocal"),
  ];
  const OUTRA_ORDEM = [...UMA_ORDEM].reverse();

  const codigos = (
    entrada: ProdutoAgregado[],
    campo: string,
    direcao: "asc" | "desc",
  ) => ordenarEBuscar(entrada, "", { campo, direcao }).map((p) => p.codigo);

  it.each(["valorTotal", "quantidadeVendida", "valorMedio"])(
    "empatados em %s saem pela descricao e pelo codigo, venham na ordem que vierem",
    (campo) => {
      for (const direcao of ["desc", "asc"] as const) {
        expect(codigos(UMA_ORDEM, campo, direcao)).toEqual(["A1", "B1", "B2"]);
        expect(codigos(OUTRA_ORDEM, campo, direcao)).toEqual([
          "A1",
          "B1",
          "B2",
        ]);
      }
    },
  );

  it("descricao empatada desempata pelo codigo, nos dois sentidos da coluna", () => {
    // A direção vale para a coluna clicada; o desempate é sempre crescente.
    expect(codigos(UMA_ORDEM, "descricao", "asc")).toEqual(["A1", "B1", "B2"]);
    expect(codigos(OUTRA_ORDEM, "descricao", "desc")).toEqual([
      "B1",
      "B2",
      "A1",
    ]);
  });
});
