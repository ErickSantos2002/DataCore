import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import autoTable from "jspdf-autotable";

import Servicos from "./Servicos";
import { baixarPlanilha } from "../lib/planilha";
import type {
  PedidoDaTabelaDeServicos,
  RecorteDeServicos,
} from "./servicos/useServicos";

/**
 * As duas exportações de Serviços: o retorno na tela, o recorte que viaja e o
 * que sai dentro do arquivo.
 *
 * Exportar não usa a página que está na tela: `todosOsServicos`
 * (`servicos/useServicos.ts`) busca o recorte INTEIRO do servidor, de mil em
 * mil, e num recorte grande isso demora. O que este arquivo prende é:
 *   - o que a tela faz durante essa espera — os dois botões desabilitam, o
 *     que roda diz que está exportando, e um segundo clique não dispara a
 *     busca de novo;
 *   - **qual recorte, busca e ordem viajam** para `todosOsServicos`, anotados
 *     em `BUSCA.pedidos`. Sem isso, `{ ...recorte, dataInicio: "", dataFim: "" }`
 *     em `buscarTudo` (`Servicos.tsx`) passava verde: a pessoa filtrava um mês,
 *     via 47 notas na tela, clicava em Excel e recebia a base inteira sem
 *     nenhum aviso de que o filtro tinha sido ignorado;
 *   - **o que entra no arquivo** — a planilha pelos argumentos de
 *     `baixarPlanilha` e o PDF pelos do `autoTable`, que é onde o cabeçalho
 *     do relatório encontra o corpo pela primeira vez.
 *
 * Para haver "durante", a busca do falso fica **pendente** até o teste
 * liberá-la: `BUSCA.liberar` resolve a promessa, e só então o `finally` de
 * `exportarExcel`/`exportarPDF` devolve os botões.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

/** Dublê de `baixarPlanilha` — nenhum `.xlsx` de verdade é gerado aqui. */
vi.mock("../lib/planilha", () => ({
  baixarPlanilha: vi.fn(),
}));

/** Dublê do jsPDF: a montagem do documento não é o assunto deste arquivo, e
 *  o `doc.save` de verdade tentaria baixar arquivo no jsdom. */
vi.mock("jspdf", () => ({
  default: class {
    setFontSize() {}
    text() {}
    save() {}
  },
}));

vi.mock("jspdf-autotable", () => ({ default: vi.fn() }));

const { SERVICOS, BUSCA } = vi.hoisted(() => ({
  /**
   * Duas notas, com número, cliente, documento, data, cidade, valor e
   * discriminação todos distintos entre si — a exportação copia os sete
   * campos, e com valor repetido uma troca de colunas manteria o conjunto.
   * A segunda é de março para o filtro de período ter o que estreitar.
   */
  SERVICOS: [
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
    },
    {
      id: 2,
      numero_nfse: 2002,
      data_emissao: "2026-03-20",
      valor_servico: 500,
      razao_social_tomador: "Beta Logística",
      cpf_cnpj_tomador: "55.666.777/0001-88",
      cidade_tomador: "Olinda",
      uf_tomador: "PE",
      discriminacao_servico: "Manutenção preventiva",
    },
  ],
  /**
   * Quantas vezes a tela pediu o recorte inteiro, o que ela mandou em cada
   * pedido, e como liberar a espera.
   */
  BUSCA: {
    chamadas: 0,
    liberar: null as null | (() => void),
    pedidos: [] as Array<{
      recorte: RecorteDeServicos;
      pedido: Pick<
        PedidoDaTabelaDeServicos,
        "busca" | "ordenarPor" | "direcao"
      >;
    }>,
  },
}));

vi.mock("./servicos/useServicos", async (original) => {
  const real = await original<typeof import("./servicos/useServicos")>();
  const { criarHooksFalsosDeServicos } = await import("./servicos/hooksFalsos");
  const falsos = criarHooksFalsosDeServicos(SERVICOS);
  return {
    ...real,
    ...falsos,
    // O `todosOsServicos` do falso resolve na hora e IGNORA os argumentos;
    // este fica pendente de propósito — é essa espera que o `exportando`
    // cobre — e anota o que recebeu, que é a única prova de que o recorte da
    // tela chega inteiro à exportação.
    todosOsServicos: (
      recorte: RecorteDeServicos,
      pedido: Pick<
        PedidoDaTabelaDeServicos,
        "busca" | "ordenarPor" | "direcao"
      >,
    ) => {
      BUSCA.chamadas += 1;
      BUSCA.pedidos.push({ recorte, pedido });
      return new Promise((resolve) => {
        BUSCA.liberar = () => resolve(SERVICOS);
      });
    },
  };
});

/** Dublê do recharts — nenhum teste aqui olha para gráfico. */
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
  BUSCA.chamadas = 0;
  BUSCA.liberar = null;
  BUSCA.pedidos.length = 0;
  vi.mocked(baixarPlanilha).mockClear();
  vi.mocked(autoTable).mockClear();
});

/** Libera a busca pendente e deixa o `finally` das exportações rodar. */
async function terminarABusca(): Promise<void> {
  const liberar = BUSCA.liberar;
  if (!liberar) throw new Error("a tela nao pediu o recorte inteiro");
  await act(async () => {
    liberar();
  });
}

const botao = (nome: RegExp | string) =>
  screen.getByRole("button", { name: nome });

/**
 * O botão que está exportando agora.
 *
 * O nome acessível é "Carregando... Exportando...", e não só o rótulo: o
 * `loading` do `Button` põe um `Spinner` dentro, e o `Spinner` tem
 * `aria-label="Carregando..."`. Mesmo desenho do botão de entrar
 * (`Login.tsx`), que é o molde da casa para ação em curso. Daí a busca por
 * pedaço do nome.
 */
const botaoExportando = () => botao(/Exportando\.\.\./);

/**
 * O campo de data de um dos dois extremos do período, achado pelo TEXTO do
 * rótulo — os `<label>` da tela não têm `htmlFor`, então `getByLabelText` não
 * acha o campo. Mesmo contorno de `Servicos.tabela.test.tsx`, símbolo
 * `campoData`.
 */
function campoData(rotulo: "Início" | "Fim"): HTMLInputElement {
  const campo = screen.getByText(rotulo).parentElement?.querySelector("input");
  if (!campo) throw new Error(`campo "${rotulo}" nao existe`);
  return campo as HTMLInputElement;
}

/** O que a tela mandou na última vez que pediu o recorte inteiro. */
function ultimaBusca(): (typeof BUSCA.pedidos)[number] {
  const ultima = BUSCA.pedidos[BUSCA.pedidos.length - 1];
  if (!ultima) throw new Error("a tela nao pediu o recorte inteiro");
  return ultima;
}

/** As abas que `baixarPlanilha` recebeu, e o nome do arquivo. */
function planilhaBaixada(): {
  abas: Array<{ nome: string; linhas: Record<string, unknown>[] }>;
  arquivo: string;
} {
  const chamada = vi.mocked(baixarPlanilha).mock.calls[0];
  if (!chamada) throw new Error("nenhuma planilha foi baixada");
  const [abas, arquivo] = chamada as unknown as [
    Array<{ nome: string; linhas: Record<string, unknown>[] }>,
    string,
  ];
  return { abas, arquivo };
}

/** O cabeçalho e o corpo que o `autoTable` recebeu. */
function tabelaDoPdf(): { head: string[][]; body: (string | number)[][] } {
  const chamada = vi.mocked(autoTable).mock.calls[0];
  if (!chamada) throw new Error("nenhum PDF foi montado");
  const opcoes = chamada[1] as {
    head: string[][];
    body: (string | number)[][];
  };
  return { head: opcoes.head, body: opcoes.body };
}

describe("exportacao de Serviços", () => {
  it("enquanto o Excel exporta, o botao dele avisa e os dois ficam desabilitados", async () => {
    render(<Servicos />);

    expect(botao(/^excel$/i)).toBeEnabled();
    expect(botao(/^pdf$/i)).toBeEnabled();

    fireEvent.click(botao(/^excel$/i));

    // O rótulo troca só no botão que roda: com um `boolean` no lugar da união
    // `ExportacaoEmCurso`, o botão do PDF também diria "Exportando...".
    expect(botaoExportando()).toBeDisabled();
    expect(screen.queryByRole("button", { name: /^excel$/i })).toBeNull();
    expect(botao(/^pdf$/i)).toBeDisabled();

    await terminarABusca();

    expect(botao(/^excel$/i)).toBeEnabled();
    expect(botao(/^pdf$/i)).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /Exportando\.\.\./ }),
    ).toBeNull();
  });

  it("enquanto o PDF exporta, o botao dele avisa e os dois ficam desabilitados", async () => {
    render(<Servicos />);

    fireEvent.click(botao(/^pdf$/i));

    expect(botaoExportando()).toBeDisabled();
    expect(screen.queryByRole("button", { name: /^pdf$/i })).toBeNull();
    expect(botao(/^excel$/i)).toBeDisabled();

    await terminarABusca();

    expect(botao(/^excel$/i)).toBeEnabled();
    expect(botao(/^pdf$/i)).toBeEnabled();
  });

  it("clicar de novo durante a exportacao nao dispara a busca outra vez", async () => {
    // O motivo do conserto: sem retorno na tela a pessoa clicava de novo, e
    // cada clique refazia a busca do recorte INTEIRO, página a página.
    render(<Servicos />);

    fireEvent.click(botao(/^excel$/i));
    expect(BUSCA.chamadas).toBe(1);

    // O clique num botão desabilitado não chega ao `onClick`; o segundo
    // clique é no PDF porque o do Excel já não existe com esse nome.
    fireEvent.click(botaoExportando());
    fireEvent.click(botao(/^pdf$/i));

    expect(BUSCA.chamadas).toBe(1);

    await terminarABusca();

    // Terminada a exportação, os botões voltam a valer.
    fireEvent.click(botao(/^excel$/i));
    expect(BUSCA.chamadas).toBe(2);

    await terminarABusca();
  });
});

/**
 * O recorte que sai da tela e entra na exportação.
 *
 * O falso de `todosOsServicos` ignora os argumentos de propósito — quem
 * filtra de verdade é o Postgres —, então nada aqui pode ser afirmado pelo
 * conteúdo do arquivo. O que dá para afirmar, e é o que importa, é **o que a
 * tela pediu**: o mesmo padrão de `Servicos.tabela.test.tsx`, que embrulha
 * `usePaginaDeServicos` para anotar o pedido.
 */
describe("o que a exportacao de Serviços pede ao servidor", () => {
  it("leva o periodo que esta nos filtros, e nao a base inteira", async () => {
    // O cenário: a pessoa escolhe janeiro, a tela mostra uma nota, ela clica
    // em Excel — e a planilha tem de ser de janeiro. Com as duas datas
    // zeradas em `buscarTudo`, ela receberia a base inteira sem nenhum aviso.
    render(<Servicos />);

    fireEvent.change(campoData("Início"), { target: { value: "2026-01-01" } });
    fireEvent.change(campoData("Fim"), { target: { value: "2026-01-31" } });

    fireEvent.click(botao(/^excel$/i));

    expect(ultimaBusca().recorte).toEqual({
      clientes: [],
      cidades: [],
      tipos: [],
      dataInicio: "2026-01-01",
      dataFim: "2026-01-31",
    });

    await terminarABusca();
  });

  it("leva a busca e a ordem que a tabela esta usando", async () => {
    // Mesma brecha pelo outro lado: digitar "Alfa", exportar e receber tudo.
    // A ordem também viaja — um PDF que corta em 30 linhas depende dela para
    // decidir QUAIS 30 saem.
    render(<Servicos />);

    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
      target: { value: "Alfa" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Ordenar por Número NFS-e" }),
    );

    fireEvent.click(botao(/^pdf$/i));

    expect(ultimaBusca().pedido).toEqual({
      busca: "Alfa",
      ordenarPor: "numero",
      direcao: "desc",
    });

    await terminarABusca();
  });
});

/**
 * O conteúdo dos dois arquivos, lido nos dublês que os recebem.
 *
 * `linhasDaPlanilha` e `linhasDoPdf` têm teste de conta em
 * `servicos/servicos.test.ts`; o que falta lá — e só existe aqui — é a
 * amarra entre as duas metades do PDF, que vivem em arquivos diferentes: o
 * cabeçalho (`Servicos.tsx`, símbolo `exportarPDF`) e o corpo
 * (`servicos/servicos.ts`, símbolo `linhasDoPdf`).
 */
describe("o conteudo dos arquivos de Serviços", () => {
  it("a planilha sai com uma aba e as sete colunas preenchidas linha a linha", async () => {
    render(<Servicos />);

    fireEvent.click(botao(/^excel$/i));
    await terminarABusca();

    const { abas, arquivo } = planilhaBaixada();

    expect(abas).toHaveLength(1);
    expect(abas[0].nome).toBe("Serviços");
    expect(abas[0].linhas).toEqual([
      {
        "Número NFS-e": 3001,
        Cliente: "Alfa Mineração",
        "CNPJ/CPF": "11.222.333/0001-44",
        "Data Emissão": "10/01/2026",
        Cidade: "Recife/PE",
        Valor: 1000,
        Descrição: "Calibração de bafômetro",
      },
      {
        "Número NFS-e": 2002,
        Cliente: "Beta Logística",
        "CNPJ/CPF": "55.666.777/0001-88",
        "Data Emissão": "20/03/2026",
        Cidade: "Olinda/PE",
        Valor: 500,
        Descrição: "Manutenção preventiva",
      },
    ]);
    expect(arquivo).toMatch(/^servicos_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it("o cabecalho do PDF e o corpo dizem a mesma coluna, na mesma posicao", async () => {
    // O `head` do `autoTable` mora em `Servicos.tsx` e o corpo em
    // `servicos.ts`; nada os ligava. Trocar "Cliente" com "Data" só no
    // cabeçalho fazia todo PDF sair com o nome do cliente embaixo de "Data" —
    // e 23 testes ficavam verdes. Aqui os dois são lidos JUNTOS e emparelhados
    // posição a posição: rótulo fora de ordem desemparelha e derruba.
    render(<Servicos />);

    fireEvent.click(botao(/^pdf$/i));
    await terminarABusca();

    const { head, body } = tabelaDoPdf();

    expect(head[0].map((rotulo, coluna) => [rotulo, body[0][coluna]])).toEqual([
      ["NFS-e", 3001],
      ["Cliente", "Alfa Mineração"],
      ["Data", "10/01/2026"],
      // Com milhar e vírgula, como o PDF de Clientes: saía "R$ 1000.00".
      ["Valor", "R$ 1.000,00"],
      ["Cidade", "Recife/PE"],
    ]);
    expect(head[0]).toHaveLength(body[0].length);
  });
});
