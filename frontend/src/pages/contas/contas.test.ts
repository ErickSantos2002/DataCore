import { describe, expect, it } from "vitest";

import { periodoDoMes } from "../../lib/periodo";
import {
  estaEmAberto,
  formatarMoeda,
  linhasDaPlanilha,
  montarCategorias,
  montarContrapartes,
  montarEvolucao,
  nomeDoArquivo,
  periodoDaBarra,
  periodoDoAno,
  proximaOrdenacao,
  type ContaBase,
  type DialetoDeContas,
} from "./contas";

/**
 * O que sobrou da régua das duas telas de Contas, exercitado sem tela.
 *
 * ## O que saiu daqui em 2026-09-09, e por quê
 *
 * Metade deste arquivo testava conta que agora é do banco: `estaQuitada`,
 * `quitadoDe`/`abertoDe`/`faturadoDe`, `filtrarContas`, `calcularKpis`,
 * `opcoesDistintas`, `buscarNasContas`, `ordenarContas` e `fatiaDaPagina`
 * viraram `core/contas_agregado.py` (item 9.4). As telas somavam dez mil contas
 * no navegador para mostrar cinco números — 7,9 MB numa e 11,2 MB na outra.
 *
 * Aquelas garantias não sumiram: elas mudaram de lugar junto com o código, e
 * são conferidas contra o banco de produção, recorte por recorte, comparando o
 * resultado do SQL com a conta refeita em Python do jeito que a tela fazia. Um
 * teste que roda contra fixture não pode dizer nada sobre um SQL.
 *
 * ## O que ficou
 *
 * O DESENHO — o que sempre foi da tela e continua sendo: escolher entre a série
 * anual e a mensal, cortar a pizza em oito fatias com "Outros" no fim, o top
 * dez do ranking, a planilha, a formatação e o estado do clique no cabeçalho.
 * As duas telas continuam passando pelas mesmas funções, e é por isso que os
 * casos abaixo rodam com o dialeto de cada uma.
 */

const RECEBER: DialetoDeContas = { chaveQuitado: "recebido" };
const PAGAR: DialetoDeContas = { chaveQuitado: "pago" };

/** Uma conta como `GET /contas_{pagar,receber}/pagina` a entrega. */
function conta(campos: Partial<ContaBase> & { id: number }): ContaBase {
  return {
    id_tiny: 100 + campos.id,
    emissao: "2026-01-10",
    vencimento: "2026-01-20",
    situacao: null,
    categoria: null,
    cliente_nome: "Sem Nome",
    cliente_cpf_cnpj: null,
    nro_documento: null,
    historico: null,
    liquidacao: null,
    cliente_cidade: null,
    cliente_uf: null,
    valor: 0,
    saldo: 0,
    quitada: false,
    vencida: false,
    ocorrencia: "U",
    ...campos,
  };
}

/** Meio-dia em UTC é o MESMO dia de calendário em UTC e em Brasília. */
const AGORA = new Date("2026-08-31T12:00:00Z");

describe("formatação", () => {
  it("dinheiro sai em real, com vírgula decimal", () => {
    expect(formatarMoeda(1234.5).replace(/\u00a0/g, " ")).toBe("R$ 1.234,50");
    expect(formatarMoeda(-50).replace(/\u00a0/g, " ")).toBe("-R$ 50,00");
  });

  it("a data da planilha sai por `dataDeCalendario`, e aguenta hora e travessão", () => {
    // A `formatarData` daqui fatiava a string em "-" e ignorava o "T": uma
    // data com hora saía "18T10:00:00/01/2026". Agora é a mesma função das
    // telas de Locação e Usuários, e a ausência vira o travessão do resto do
    // sistema em vez do hífen.
    const linha = linhasDaPlanilha(
      [
        conta({
          id: 1,
          emissao: "2026-01-18T10:00:00",
          vencimento: "2026-02-20",
          liquidacao: null,
        }),
      ],
      {
        aba: "x",
        prefixoDoArquivo: "x",
        rotuloDaContraparte: "Cliente",
        colunasProprias: () => ({}),
      },
    )[0];

    expect(linha.Emissão).toBe("18/01/2026");
    expect(linha.Vencimento).toBe("20/02/2026");
    expect(linha.Liquidação).toBe("—");
  });
});

describe("clique numa barra do gráfico", () => {
  it("no modo anual, a barra vira o ano inteiro", () => {
    expect(periodoDaBarra("2025", "anual", null)).toEqual(periodoDoAno("2025"));
    expect(periodoDoAno("2025")).toEqual({
      inicio: "2025-01-01",
      fim: "2025-12-31",
    });
  });

  it("no modo mensal, a barra vira o mês inteiro — e acerta o mês curto", () => {
    expect(periodoDaBarra("Fev", "mensal", 2026)).toEqual({
      inicio: "2026-02-01",
      fim: "2026-02-28",
    });
    expect(periodoDoMes(2024, 1).fim).toBe("2024-02-29");
  });

  it("barra sem rótulo, ou com rótulo que não é mês, não filtra nada", () => {
    expect(periodoDaBarra(undefined, "mensal", 2026)).toBeNull();
    expect(periodoDaBarra("Nubembro", "mensal", 2026)).toBeNull();
    expect(periodoDaBarra("Jan", "mensal", null)).toBeNull();
  });
});

describe("gráfico de evolução", () => {
  // As duas séries chegam do banco somadas; o que se testa aqui é a escolha
  // entre elas e o formato que o recharts desenha.
  const ano = (ano: number, quitado: number, aberto: number) => ({
    ano,
    quitado,
    aberto,
  });
  const mes = (ano: number, mes: number, quitado: number, aberto: number) => ({
    ano,
    mes,
    quitado,
    aberto,
  });

  it("a série de quitado leva o nome do dialeto", () => {
    const porAno = [ano(2026, 10, 0)];
    const porMes = [mes(2026, 1, 10, 0)];

    expect(montarEvolucao(porAno, porMes, RECEBER, AGORA).dados[0]).toEqual({
      label: "Jan",
      recebido: 10,
      aberto: 0,
    });
    expect(montarEvolucao(porAno, porMes, PAGAR, AGORA).dados[0]).toEqual({
      label: "Jan",
      pago: 10,
      aberto: 0,
    });
  });

  it("com um ano só, desenha os doze meses — inclusive os zerados", () => {
    const evolucao = montarEvolucao(
      [ano(2026, 0, 0)],
      [mes(2026, 3, 0, 0)],
      RECEBER,
      AGORA,
    );

    expect(evolucao.modo).toBe("mensal");
    expect(evolucao.ano).toBe(2026);
    expect(evolucao.titulo).toBe("Evolução Mensal — 2026");
    expect(evolucao.dados).toHaveLength(12);
    // O mês sem conta desenha zero, e não some: uma linha que salta o ponto
    // liga dois meses distantes como se fossem vizinhos.
    expect(evolucao.dados[0]).toEqual({ label: "Jan", recebido: 0, aberto: 0 });
  });

  it("com mais de um ano, troca para anual e só desenha ano que tem conta", () => {
    const evolucao = montarEvolucao(
      [ano(2026, 0, 20), ano(2020, 0, 10)],
      [],
      RECEBER,
      AGORA,
    );

    expect(evolucao.modo).toBe("anual");
    expect(evolucao.titulo).toBe("Evolução Anual");
    // Ordenado por ano crescente, seja qual for a ordem em que chegou.
    expect(evolucao.dados).toEqual([
      { label: "2020", recebido: 0, aberto: 10 },
      { label: "2026", recebido: 0, aberto: 20 },
    ]);
  });

  it("sem nenhuma conta, cai no ano do relógio", () => {
    expect(montarEvolucao([], [], RECEBER, AGORA).titulo).toBe(
      "Evolução Mensal — 2026",
    );
  });

  it("uma conta em aberto com recebimento parcial entra nas DUAS séries", () => {
    // Antes cada conta ia inteira para uma barra só — a quitada pelo valor
    // cheio, a em aberto pelo saldo —, e o recebimento parcial de uma conta
    // em aberto não aparecia em barra nenhuma (defeito 1.1). Quem separa as
    // duas grandezas agora é o banco; o que se prova aqui é que a tela desenha
    // as duas séries que ele manda.
    const evolucao = montarEvolucao(
      [ano(2026, 600, 400)],
      [mes(2026, 1, 600, 400)],
      RECEBER,
      AGORA,
    );

    expect(evolucao.dados[0]).toEqual({
      label: "Jan",
      recebido: 600,
      aberto: 400,
    });
  });

  it("mês fora do intervalo 1–12 não derruba o gráfico", () => {
    const evolucao = montarEvolucao(
      [ano(2026, 5, 0)],
      [mes(2026, 13, 5, 0)],
      RECEBER,
      AGORA,
    );
    expect(evolucao.dados).toHaveLength(12);
  });
});

describe("gráficos de categoria e de contraparte", () => {
  // As duas listas chegam do banco já somadas e ordenadas por valor. O que se
  // testa aqui é o CORTE: oito fatias na pizza, dez barras no ranking.
  const linhas = (quantidade: number) =>
    Array.from({ length: quantidade }, (_, i) => ({
      nome: `Cat ${quantidade - i}`,
      valor: (quantidade - i) * 10,
    }));

  it("a pizza para em oito fatias, e as sete maiores levam o nome delas", () => {
    const fatias = montarCategorias(linhas(10));

    expect(fatias).toHaveLength(8);
    expect(fatias[0]).toEqual({ name: "Cat 10", value: 100 });
    expect(fatias[6]).toEqual({ name: "Cat 4", value: 40 });
  });

  it("o que não cabe nas sete maiores vira a fatia Outros, e nada se perde", () => {
    // Antes a nona categoria em diante sumia do gráfico, e o percentual que
    // o recharts escreve em cada fatia era calculado sobre a soma das oito.
    const entrada = linhas(10);
    const fatias = montarCategorias(entrada);

    // Cat 3 + Cat 2 + Cat 1 = 30 + 20 + 10.
    expect(fatias[7]).toEqual({ name: "Outros", value: 60 });
    const soma = fatias.reduce((total, fatia) => total + fatia.value, 0);
    expect(soma).toBe(550);
    expect(entrada.reduce((total, linha) => total + linha.valor, 0)).toBe(550);
  });

  it("com oito categorias ou menos não há fatia Outros nenhuma", () => {
    expect(montarCategorias(linhas(8)).map((f) => f.name)).toEqual([
      "Cat 8",
      "Cat 7",
      "Cat 6",
      "Cat 5",
      "Cat 4",
      "Cat 3",
      "Cat 2",
      "Cat 1",
    ]);
  });

  it("o rótulo é o que o banco mandou, inclusive o vazio", () => {
    // Categoria nula vira "Sem categoria" no SQL; a vazia depois do `trim`
    // também. O que chega aqui, a tela desenha como está.
    expect(
      montarCategorias([
        { nome: "Sem categoria", valor: 100 },
        { nome: "", valor: 50 },
      ]),
    ).toEqual([
      { name: "Sem categoria", value: 100 },
      { name: "", value: 50 },
    ]);
  });

  it("o ranking de contraparte para em dez", () => {
    const entrada = Array.from({ length: 12 }, (_, i) => ({
      nome: `Cliente ${12 - i}`,
      valor: (12 - i) * 10,
    }));

    expect(montarContrapartes(entrada)).toHaveLength(10);
    expect(montarContrapartes(entrada)[0]).toEqual({
      nome: "Cliente 12",
      valor: 120,
    });
  });

  it("nenhum dos dois reordena o que recebeu", () => {
    // A ordem é do banco — `ORDER BY valor DESC`. Reordenar aqui seria uma
    // segunda opinião sobre a mesma coisa, e as duas divergiriam no dia em que
    // o critério de desempate mudasse de um lado só.
    const fora_de_ordem = [
      { nome: "Menor", valor: 1 },
      { nome: "Maior", valor: 99 },
    ];
    expect(montarCategorias(fora_de_ordem).map((f) => f.name)).toEqual([
      "Menor",
      "Maior",
    ]);
    expect(montarContrapartes(fora_de_ordem).map((c) => c.nome)).toEqual([
      "Menor",
      "Maior",
    ]);
  });
});

describe("ordenação", () => {
  // Ordenar a lista é do banco (`ORDER BY` com a página). O que ficou na tela é
  // o ESTADO do clique no cabeçalho — qual coluna e qual direção pedir.

  it("o primeiro clique numa coluna é sempre decrescente, inclusive na já ordenada", () => {
    expect(
      proximaOrdenacao({ campo: "vencimento", direcao: "asc" }, "vencimento"),
    ).toEqual({
      campo: "vencimento",
      direcao: "desc",
    });
    expect(
      proximaOrdenacao({ campo: "vencimento", direcao: "desc" }, "vencimento"),
    ).toEqual({
      campo: "vencimento",
      direcao: "asc",
    });
    expect(
      proximaOrdenacao(
        { campo: "vencimento", direcao: "desc" },
        "valor_numero",
      ),
    ).toEqual({
      campo: "valor_numero",
      direcao: "desc",
    });
  });
});

describe("planilha", () => {
  const FORMATO_RECEBER = {
    aba: "Contas a Receber",
    prefixoDoArquivo: "contas_a_receber",
    rotuloDaContraparte: "Cliente",
    colunasProprias: () => ({
      "Forma Pagamento": "Boleto",
      Portador: "Banco Um",
    }),
  };

  const FORMATO_PAGAR = {
    aba: "Contas a Pagar",
    prefixoDoArquivo: "contas_a_pagar",
    rotuloDaContraparte: "Fornecedor",
    colunasProprias: (c: ContaBase) => ({ Ocorrência: c.ocorrencia }),
  };

  const umaConta = conta({
    id: 1,
    cliente_nome: "Alfa",
    valor: 1000,
    saldo: 0,
    situacao: "recebido",
    emissao: "2026-01-10",
    vencimento: "2026-01-20",
  });

  it("as duas telas exportam as mesmas colunas, na mesma ordem", () => {
    // Só o nome da contraparte e a coluna que existe numa API só é que
    // mudam. `ID Tiny` e `Emissão` existem nas duas.
    expect(
      Object.keys(linhasDaPlanilha([umaConta], FORMATO_RECEBER)[0]),
    ).toEqual([
      "ID Tiny",
      "Cliente",
      "CPF_CNPJ",
      "Categoria",
      "Nº Documento",
      "Histórico",
      "Valor",
      "Saldo",
      "Emissão",
      "Vencimento",
      "Liquidação",
      "Situação",
      "Vencida",
      "Forma Pagamento",
      "Portador",
      "Cidade",
      "UF",
    ]);

    expect(Object.keys(linhasDaPlanilha([umaConta], FORMATO_PAGAR)[0])).toEqual(
      [
        "ID Tiny",
        "Fornecedor",
        "CPF_CNPJ",
        "Categoria",
        "Nº Documento",
        "Histórico",
        "Valor",
        "Saldo",
        "Emissão",
        "Vencimento",
        "Liquidação",
        "Situação",
        "Vencida",
        "Ocorrência",
        "Cidade",
        "UF",
      ],
    );
  });

  it("dinheiro sai como número e data sai como texto dd/mm/aaaa", () => {
    const linha = linhasDaPlanilha([umaConta], FORMATO_RECEBER)[0];
    expect(linha.Valor).toBe(1000);
    expect(linha.Emissão).toBe("10/01/2026");
    expect(linha.Liquidação).toBe("—");
  });

  it("a coluna Situação guarda a situação real, e o vencimento vira coluna própria", () => {
    // Antes a `Situação` da vencida era trocada pelo literal "Vencida", e
    // quem abria a planilha não distinguia mais "pendente" de "aberto".
    const vencida = conta({ id: 2, situacao: "pendente", vencida: true });
    const noPrazo = conta({ id: 3, situacao: "aberto", vencida: false });

    const linhas = linhasDaPlanilha([vencida, noPrazo], FORMATO_RECEBER);
    expect(linhas[0].Situação).toBe("pendente");
    expect(linhas[0].Vencida).toBe("Sim");
    expect(linhas[1].Situação).toBe("aberto");
    expect(linhas[1].Vencida).toBe("Não");
  });

  it("o nome do arquivo usa a data LOCAL, e não a de Greenwich", () => {
    // Às 23h de 31/08 em Brasília já é 01/09 em Greenwich: o arquivo saía
    // com a data de amanhã e quem exportava à noite arquivava errado.
    const viradaDoMes = new Date("2026-09-01T02:00:00Z");
    const foraDoUtc = viradaDoMes.getTimezoneOffset() !== 0;

    expect(nomeDoArquivo("contas_a_receber", AGORA)).toBe(
      "contas_a_receber_2026-08-31.xlsx",
    );
    expect(nomeDoArquivo("contas_a_receber", viradaDoMes)).toBe(
      foraDoUtc
        ? "contas_a_receber_2026-08-31.xlsx"
        : "contas_a_receber_2026-09-01.xlsx",
    );
  });
});
