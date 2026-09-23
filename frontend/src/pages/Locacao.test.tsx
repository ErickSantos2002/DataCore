import type { ReactNode } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Locacao from "./Locacao";
import { AuthContext } from "../context/AuthContext";
import type { NotaLocacao } from "../services/notasapi";
import { diaLocal } from "../lib/datas";

/**
 * Teste de caracterização da tela de Locação.
 *
 * Fixa o comportamento que existia ANTES da migração para o design system.
 * A tela não tinha teste nenhum, e o que ela faz — somar o valor das notas,
 * casar o texto da busca, ordenar por quatro campos e montar a planilha —
 * só está escrito nela mesma. Um refactor que mude qualquer um dos quatro
 * muda um número que alguém usa para cobrar aluguel de equipamento.
 *
 * Tudo é observado pela tela renderizada, nunca por função exportada de
 * propósito para o teste: assim o teste sobrevive a quebrar a página em
 * componentes, que é exatamente o passo seguinte. Os seletores também são
 * deliberadamente tolerantes de estrutura — o cabeçalho de coluna é achado
 * pelo papel `columnheader` e clicado no `<button>` de dentro quando ele
 * existir, o campo de busca pelo papel `textbox` — para que a migração possa
 * trocar `<th onClick>` por primitivo sem reescrever o teste.
 */

const fetchLocacaoMock = vi.hoisted(() => vi.fn());
vi.mock("../services/notasapi", () => ({
  fetchLocacao: fetchLocacaoMock,
}));

/** O que a exportação de fato mandou para o `xlsx`, sem tocar em disco. */
const planilha = vi.hoisted(() => ({
  linhas: [] as Record<string, unknown>[],
  aba: "",
  arquivo: "",
}));
vi.mock("xlsx", () => ({
  utils: {
    json_to_sheet: (linhas: Record<string, unknown>[]) => {
      planilha.linhas = linhas;
      return { planilha: true };
    },
    book_new: () => ({ livro: true }),
    book_append_sheet: (_livro: unknown, _aba: unknown, nome: string) => {
      planilha.aba = nome;
    },
  },
  writeFile: (_livro: unknown, nome: string) => {
    planilha.arquivo = nome;
  },
}));

const USUARIO = { id: 1, username: "erick", role: "admin" };

function Molde({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        user: USUARIO,
        token: "t",
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        error: null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Nota com os campos que a tela lê; o resto do payload não importa aqui. */
function nota(campos: Partial<NotaLocacao> & { id: number }): NotaLocacao {
  return {
    numero: null,
    data_emissao: "2026-01-01T00:00:00",
    valor_nota: 0,
    descricao_situacao: null,
    natureza_operacao: null,
    nome_vendedor: null,
    cliente: null,
    ...campos,
  };
}

/**
 * Quatro notas escolhidas para que as oito ordenações possíveis (quatro
 * campos × duas direções) produzam oito sequências diferentes — se duas
 * batessem, um comparador trocado passaria batido.
 */
const NOTAS: NotaLocacao[] = [
  nota({
    id: 1,
    numero: "1002",
    data_emissao: "2026-03-10T00:00:00",
    valor_nota: 300,
    cliente: { nome: "Beta Mineração", cpf_cnpj: "22.222.222/0001-22" },
    descricao_situacao: "Autorizada",
    natureza_operacao: "Locação de equipamento",
    nome_vendedor: "Ana Lima",
  }),
  nota({
    id: 2,
    numero: "1010",
    data_emissao: "2026-01-05T00:00:00",
    valor_nota: "1500.50",
    cliente: { nome: "Alfa Transportes", cpf_cnpj: "11.111.111/0001-11" },
    descricao_situacao: "Cancelada",
    nome_vendedor: "Bruno Sá",
  }),
  nota({
    id: 3,
    numero: "1001",
    data_emissao: "2026-05-20T00:00:00",
    valor_nota: null,
    cliente: null,
    descricao_situacao: null,
    nome_vendedor: null,
  }),
  nota({
    id: 4,
    numero: null,
    data_emissao: "2026-02-01T00:00:00",
    valor_nota: 200,
    cliente: { nome: "Gama Energia", cpf_cnpj: "33.333.333/0001-33" },
    descricao_situacao: "Autorizada",
    nome_vendedor: "Ana Lima",
  }),
];

async function montar(notas: NotaLocacao[] = NOTAS) {
  fetchLocacaoMock.mockResolvedValue(notas);
  const resultado = render(<Locacao />, { wrapper: Molde });
  await screen.findByRole("table");
  return resultado;
}

/** Valor de um KPI, achado pelo rótulo e lido no elemento ao lado. */
function kpi(rotulo: string): string {
  const etiqueta = screen.getByText(rotulo);
  const valor = etiqueta.nextElementSibling;
  if (!valor)
    throw new Error(`KPI "${rotulo}" não tem valor ao lado do rótulo`);
  return valor.textContent?.trim() ?? "";
}

/** Linhas de dado da tabela — sem a linha de cabeçalho. */
function linhasDaTabela(): HTMLElement[] {
  return within(screen.getByRole("table")).getAllByRole("row").slice(1);
}

/** A coluna "Número" de cada linha, na ordem em que a tela as desenhou. */
function numerosNaTela(): string[] {
  return linhasDaTabela().map((linha) =>
    (within(linha).getAllByRole("cell")[0].textContent ?? "").trim(),
  );
}

/** Clica no cabeçalho da coluna — no `<button>` de dentro quando existir. */
function ordenarPor(coluna: string) {
  const cabecalho = screen
    .getAllByRole("columnheader")
    .find((celula) => celula.textContent?.includes(coluna));
  if (!cabecalho) throw new Error(`coluna "${coluna}" não existe na tabela`);
  fireEvent.click(cabecalho.querySelector("button") ?? cabecalho);
}

function buscar(termo: string) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: termo } });
}

beforeEach(() => {
  fetchLocacaoMock.mockReset();
  planilha.linhas = [];
  planilha.aba = "";
  planilha.arquivo = "";
});

describe("Locação — carregamento", () => {
  it("mostra o aviso de carregando enquanto a busca das notas não volta", async () => {
    fetchLocacaoMock.mockReturnValue(new Promise(() => {}));
    render(<Locacao />, { wrapper: Molde });

    expect(screen.getByText(/carregando loca/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("mostra a mensagem de erro quando a busca falha, e a tabela fica vazia", async () => {
    const console_error = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    fetchLocacaoMock.mockRejectedValue(new Error("500"));
    render(<Locacao />, { wrapper: Molde });

    expect(
      await screen.findByText("Não foi possível carregar as notas de locação."),
    ).toBeInTheDocument();
    expect(linhasDaTabela()).toHaveLength(1);
    expect(
      screen.getByText("Nenhuma nota de locação encontrada."),
    ).toBeInTheDocument();
    console_error.mockRestore();
  });

  it("com a lista vazia diz que não há nota, e zera os três KPIs", async () => {
    await montar([]);

    expect(
      screen.getByText("Nenhuma nota de locação encontrada."),
    ).toBeInTheDocument();
    expect(kpi("Valor Total em Locação")).toBe("R$ 0,00");
    expect(kpi("Quantidade de Notas")).toBe("0");
    expect(kpi("Valor Médio")).toBe("R$ 0,00");
  });

  it("uma resposta que não é lista vira lista vazia, em vez de quebrar a tela", async () => {
    // A API já devolveu objeto de erro no lugar do array; a tela trata.
    fetchLocacaoMock.mockResolvedValue({ detail: "sem permissão" });
    render(<Locacao />, { wrapper: Molde });

    await screen.findByRole("table");
    expect(kpi("Quantidade de Notas")).toBe("0");
  });
});

describe("Locação — KPIs", () => {
  it("soma o valor de todas as notas, conta quantas são e divide uma pela outra", async () => {
    await montar();

    // 300 + 1500,50 + 0 (null) + 200 = 2000,50 · 2000,50 / 4 = 500,125
    expect(kpi("Valor Total em Locação")).toBe("R$ 2.000,50");
    expect(kpi("Quantidade de Notas")).toBe("4");
    expect(kpi("Valor Médio")).toBe("R$ 500,13");
  });

  it("valor em texto entra pelo parseFloat, e o que não é número vale zero", async () => {
    await montar([
      nota({ id: 1, valor_nota: "1500.50" }),
      nota({ id: 2, valor_nota: null }),
      nota({ id: 3, valor_nota: "sem valor" }),
      // parseFloat para no primeiro caractere que não cabe no número: o
      // separador de milhar brasileiro vira ponto decimal e "1.234,56" some
      // quase inteiro, virando 1,234. É o comportamento de hoje.
      nota({ id: 4, valor_nota: "1.234,56" }),
    ]);

    expect(kpi("Valor Total em Locação")).toBe("R$ 1.501,73");
    expect(kpi("Quantidade de Notas")).toBe("4");
  });

  it("os KPIs somam a base inteira, e não o que a busca deixou na tabela", async () => {
    await montar();
    buscar("Alfa");

    expect(numerosNaTela()).toEqual(["1010"]);
    expect(kpi("Valor Total em Locação")).toBe("R$ 2.000,50");
    expect(kpi("Quantidade de Notas")).toBe("4");
  });
});

describe("Locação — busca", () => {
  it("casa nome do cliente sem diferenciar caixa", async () => {
    await montar();
    buscar("alfa tRANsportes");
    expect(numerosNaTela()).toEqual(["1010"]);
  });

  it("casa pedaço do CNPJ", async () => {
    await montar();
    buscar("33.333");
    expect(numerosNaTela()).toEqual(["—"]);
  });

  it("casa o número da nota", async () => {
    await montar();
    buscar("1002");
    expect(numerosNaTela()).toEqual(["1002"]);
  });

  it("casa o nome do vendedor, e traz as duas notas dele", async () => {
    await montar();
    buscar("ana lima");
    // Ordem padrão (emissão, mais nova primeiro): 10/03 antes de 01/02.
    expect(numerosNaTela()).toEqual(["1002", "—"]);
  });

  it("casa o valor pelo número cru, não pelo valor formatado", async () => {
    await montar();

    // `String(1500.5)` é "1500.5" — é essa string que a busca varre.
    buscar("1500.5");
    expect(numerosNaTela()).toEqual(["1010"]);

    // O que a tela mostra na coluna Valor ("R$ 1.500,50") não casa com nada.
    buscar("1.500,50");
    expect(
      screen.getByText("Nenhuma nota de locação encontrada."),
    ).toBeInTheDocument();
  });

  it("ignora situação, natureza da operação e data", async () => {
    await montar();

    buscar("Autorizada");
    expect(
      screen.getByText("Nenhuma nota de locação encontrada."),
    ).toBeInTheDocument();

    buscar("Locação de equipamento");
    expect(
      screen.getByText("Nenhuma nota de locação encontrada."),
    ).toBeInTheDocument();

    buscar("2026-03-10");
    expect(
      screen.getByText("Nenhuma nota de locação encontrada."),
    ).toBeInTheDocument();

    buscar("10/03/2026");
    expect(
      screen.getByText("Nenhuma nota de locação encontrada."),
    ).toBeInTheDocument();
  });

  it("busca vazia devolve a lista inteira", async () => {
    await montar();
    buscar("Alfa");
    expect(numerosNaTela()).toHaveLength(1);

    buscar("");
    expect(numerosNaTela()).toHaveLength(4);
  });

  it("nota sem cliente, sem número e sem vendedor não casa com nada, mas continua na lista", async () => {
    await montar();
    // A nota 1001 não tem cliente nem vendedor; só o próprio número a acha.
    buscar("1001");
    expect(numerosNaTela()).toEqual(["1001"]);
  });
});

describe("Locação — ordenação", () => {
  it("começa por data de emissão, da mais nova para a mais antiga", async () => {
    await montar();
    expect(numerosNaTela()).toEqual(["1001", "1002", "—", "1010"]);
  });

  // Coluna nova sempre entra em decrescente; "Data" é a exceção, porque já
  // é a coluna ordenada quando a tela abre — nela o primeiro clique alterna
  // para crescente em vez de recomeçar.
  const DECRESCENTE: Record<string, string[]> = {
    Número: ["1010", "1002", "1001", "—"],
    Data: ["1001", "1002", "—", "1010"],
    Cliente: ["—", "1002", "1010", "1001"],
    Valor: ["1010", "1002", "—", "1001"],
  };
  const CRESCENTE: Record<string, string[]> = {
    Número: ["—", "1001", "1002", "1010"],
    Data: ["1010", "—", "1002", "1001"],
    Cliente: ["1001", "1010", "1002", "—"],
    Valor: ["1001", "—", "1002", "1010"],
  };

  it.each(["Número", "Cliente", "Valor"])(
    "por %s: primeiro clique decrescente, segundo crescente, terceiro decrescente",
    async (coluna) => {
      await montar();

      ordenarPor(coluna);
      expect(numerosNaTela()).toEqual(DECRESCENTE[coluna]);

      ordenarPor(coluna);
      expect(numerosNaTela()).toEqual(CRESCENTE[coluna]);

      // Terceiro clique volta ao decrescente — a seta alterna, não cicla.
      ordenarPor(coluna);
      expect(numerosNaTela()).toEqual(DECRESCENTE[coluna]);
    },
  );

  it("por Data: como já é a coluna ordenada, o primeiro clique vai para crescente", async () => {
    await montar();
    expect(numerosNaTela()).toEqual(DECRESCENTE.Data);

    ordenarPor("Data");
    expect(numerosNaTela()).toEqual(CRESCENTE.Data);

    ordenarPor("Data");
    expect(numerosNaTela()).toEqual(DECRESCENTE.Data);
  });

  it("trocar de coluna sempre recomeça em decrescente", async () => {
    await montar();

    ordenarPor("Valor");
    ordenarPor("Valor"); // agora Valor está em crescente
    expect(numerosNaTela()).toEqual(["1001", "—", "1002", "1010"]);

    ordenarPor("Cliente");
    expect(numerosNaTela()).toEqual(["—", "1002", "1010", "1001"]);
  });

  it("Situação e Vendedor não ordenam", async () => {
    await montar();
    const antes = numerosNaTela();

    ordenarPor("Situação");
    expect(numerosNaTela()).toEqual(antes);

    ordenarPor("Vendedor");
    expect(numerosNaTela()).toEqual(antes);
  });

  it("a busca e a ordenação valem juntas", async () => {
    await montar();
    buscar("ana lima");
    ordenarPor("Valor");
    expect(numerosNaTela()).toEqual(["1002", "—"]);

    ordenarPor("Valor");
    expect(numerosNaTela()).toEqual(["—", "1002"]);
  });

  it("notas empatadas mantêm a ordem em que a API as mandou — nas duas direções", async () => {
    // O comparador devolve 0 no empate e o `Array.prototype.sort` é estável,
    // então o bloco empatado sai na ordem da API: 1 antes de 2, nas duas
    // direções. Ordenar por uma coluna não embaralha o que essa coluna não
    // distingue.
    //
    // Até o commit que consertou o comparador ele era `aVal > bVal ? 1 : -1`
    // e nunca devolvia 0: para valores iguais respondia "o primeiro vem
    // antes" nas duas perguntas, e o bloco empatado saía invertido — 2 antes
    // de 1.
    await montar([
      nota({
        id: 1,
        numero: "1",
        valor_nota: 100,
        data_emissao: "2026-04-01T00:00:00",
      }),
      nota({
        id: 2,
        numero: "2",
        valor_nota: 100,
        data_emissao: "2026-04-01T00:00:00",
      }),
      nota({
        id: 3,
        numero: "3",
        valor_nota: 500,
        data_emissao: "2026-04-02T00:00:00",
      }),
    ]);

    // Decrescente: a de 500 sobe, e as duas de 100 ficam na ordem da API.
    ordenarPor("Valor");
    expect(numerosNaTela()).toEqual(["3", "1", "2"]);

    // Crescente: a de 500 desce, e o par empatado continua na ordem da API.
    ordenarPor("Valor");
    expect(numerosNaTela()).toEqual(["1", "2", "3"]);
  });

  it("com empate total, as duas direções devolvem a ordem da API", async () => {
    // Quando TODAS as notas empatam não há segunda ordem para a seta
    // mostrar: as duas direções devolvem a lista como a API a mandou. Isso é
    // o certo, e não resto do defeito — o que mudou é qual sequência sai.
    // Antes as duas direções devolviam a lista de trás para frente
    // (["3","2","1"]); agora devolvem ["1","2","3"].
    await montar([
      nota({ id: 1, numero: "1", valor_nota: 100 }),
      nota({ id: 2, numero: "2", valor_nota: 100 }),
      nota({ id: 3, numero: "3", valor_nota: 100 }),
    ]);

    ordenarPor("Valor");
    expect(numerosNaTela()).toEqual(["1", "2", "3"]);

    ordenarPor("Valor");
    expect(numerosNaTela()).toEqual(["1", "2", "3"]);
  });

  it("ordenar por Cliente não embaralha as notas do mesmo cliente", async () => {
    // O caso da base real, com os números e os nomes que ela tem: duas notas
    // da Mineração e uma da APERAM. Com o comparador velho o par da Mineração
    // saía invertido em relação à ordem que a API mandou.
    const MINERACAO = {
      nome: "Mineracao Riacho dos Machados Ltda. ",
      cpf_cnpj: "44.555.666/0001-77",
    };
    await montar([
      nota({ id: 1, numero: "008406", cliente: MINERACAO }),
      nota({ id: 2, numero: "008188", cliente: MINERACAO }),
      nota({
        id: 3,
        numero: "007948",
        cliente: {
          nome: "APERAM BIOENERGIA LTDA.",
          cpf_cnpj: "77.888.999/0002-00",
        },
      }),
    ]);

    ordenarPor("Cliente");
    expect(numerosNaTela()).toEqual(["008406", "008188", "007948"]);

    ordenarPor("Cliente");
    expect(numerosNaTela()).toEqual(["007948", "008406", "008188"]);
  });
});

describe("Locação — exportação para Excel", () => {
  it("exporta sete colunas com rótulo em português, na aba Locação", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /exportar/i }));

    await waitFor(() => expect(planilha.linhas).toHaveLength(4));
    expect(Object.keys(planilha.linhas[0])).toEqual([
      "Número",
      "Data",
      "Cliente",
      "CNPJ",
      "Valor",
      "Situação",
      "Vendedor",
    ]);
    expect(planilha.aba).toBe("Locação");
  });

  it("exporta o que está na tabela: filtrado e na ordem escolhida", async () => {
    await montar();
    buscar("ana lima");
    ordenarPor("Valor");
    fireEvent.click(screen.getByRole("button", { name: /exportar/i }));

    expect(planilha.linhas).toEqual([
      {
        Número: "1002",
        Data: "10/03/2026",
        Cliente: "Beta Mineração",
        CNPJ: "22.222.222/0001-22",
        Valor: 300,
        Situação: "Autorizada",
        Vendedor: "Ana Lima",
      },
      {
        Número: "",
        Data: "01/02/2026",
        Cliente: "Gama Energia",
        CNPJ: "33.333.333/0001-33",
        Valor: 200,
        Situação: "Autorizada",
        Vendedor: "Ana Lima",
      },
    ]);
  });

  it("campo ausente vira string vazia, e valor ausente vira o número zero", async () => {
    await montar([NOTAS[2]]);
    fireEvent.click(screen.getByRole("button", { name: /exportar/i }));

    expect(planilha.linhas).toEqual([
      {
        Número: "1001",
        Data: "20/05/2026",
        Cliente: "",
        CNPJ: "",
        Valor: 0,
        Situação: "",
        Vendedor: "",
      },
    ]);
  });

  it("o arquivo se chama locacao_ mais o dia local", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /exportar/i }));

    // Antes, este teste calculava a data esperada com o mesmo
    // `new Date().toISOString()` que a tela usava — concordava com a tela por
    // construção, certa ou errada, e por isso o defeito de UTC atravessou a
    // migração inteira. Agora afirma o dia local, que é o comportamento que a
    // tela deve ter, e não o que ela por acaso tem.
    const hoje = diaLocal(new Date());
    expect(planilha.arquivo).toBe(`locacao_${hoje}.xlsx`);
  });

  it("sem nota nenhuma, o botão de exportar fica desabilitado", async () => {
    await montar([]);
    expect(screen.getByRole("button", { name: /exportar/i })).toBeDisabled();
  });

  it("quando a busca não acha nada, o botão de exportar também fica desabilitado", async () => {
    await montar();
    expect(screen.getByRole("button", { name: /exportar/i })).toBeEnabled();

    buscar("nada que exista");
    expect(screen.getByRole("button", { name: /exportar/i })).toBeDisabled();
  });
});

describe("Locação — cabeçalho e linhas", () => {
  it("apresenta a tela e diz quem está logado", async () => {
    await montar();

    expect(
      screen.getByRole("heading", { name: "Locação" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/erick/)).toBeInTheDocument();
  });

  it("mostra data, valor, situação e vendedor de cada nota", async () => {
    await montar([NOTAS[0]]);
    const linha = linhasDaTabela()[0];

    expect(within(linha).getByText("10/03/2026")).toBeInTheDocument();
    expect(within(linha).getByText(/R\$\s*300,00/)).toBeInTheDocument();
    expect(within(linha).getByText("Autorizada")).toBeInTheDocument();
    expect(within(linha).getByText("Ana Lima")).toBeInTheDocument();
    expect(
      within(linha).getByText(/22\.222\.222\/0001-22/),
    ).toBeInTheDocument();
  });

  it("preenche o buraco de cada campo ausente com o texto de hoje", async () => {
    await montar([NOTAS[2]]);
    const linha = linhasDaTabela()[0];

    expect(within(linha).getAllByText("Não informado")).toHaveLength(2);
    expect(within(linha).getByText("—")).toBeInTheDocument();
    expect(within(linha).getByText(/R\$\s*0,00/)).toBeInTheDocument();
  });
});
