import type { ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ContasPagar from "./ContasPagar";
import { AuthContext } from "../context/AuthContext";
import type { ContaPagar } from "../context/ContasPagarContext";
import { conferirAriaSort } from "../test/ordenacaoAcessivel";

/**
 * Teste de caracterização da tela de Contas a Pagar.
 *
 * Fixa o comportamento que existe HOJE, antes da migração para o design
 * system. A tela é gêmea de Contas a Receber — 83% das linhas são iguais —
 * e as duas vão migrar em par, compartilhando quase tudo. Por isso este
 * arquivo é minucioso de propósito: na hora de unificar, é ele que diz
 * quais diferenças entre as duas são de propósito e quais são alguém ter
 * editado uma e esquecido a outra.
 *
 * Tudo é observado pela tela renderizada — nunca por função exportada de
 * propósito para o teste. O que a tela entrega a uma biblioteca de fora
 * (o `xlsx` e o `recharts`) é observado no que ela ENTREGA: as duas são
 * substituídas por dublês que guardam os dados recebidos. É o mesmo dado
 * que o usuário vê no gráfico e na planilha, sem depender de SVG medido em
 * jsdom (o `ResponsiveContainer` mede zero aqui e não desenha nada).
 *
 * Os dados entram pelo `ContasPagarProvider` de verdade, com só o serviço
 * dublê: o enriquecimento (valor_numero, saldo_numero, vencida, ano) mora
 * no contexto e faz parte do que a tela mostra.
 *
 * Onde o comportamento de hoje parece errado, o teste fixa o que a tela
 * FAZ, com um comentário marcando a suspeita. Quem decide se é defeito é
 * o Erick.
 *
 * O relógio fica parado em 2026-03-15T12:00:00Z — meio-dia em UTC, 09h em
 * Brasília, o mesmo dia de calendário nos dois fusos. Onde o fuso muda o
 * resultado (só nos presets de período) há um bloco próprio que fixa o que
 * CADA fuso mostra.
 */

// --- Dublê do serviço -------------------------------------------------------

/**
 * O servidor, falso. A tela deixou de receber contas e passou a receber
 * agregados (item 9.4), e havia duas saidas: reescrever estas ~2.000 linhas
 * alimentando a tela com agregados prontos, ou pôr um servidor falso no lugar
 * do de verdade e deixar os testes como estavam.
 *
 * Esta e a segunda. `contas/servidorFalso` reproduz `core/contas_agregado.py`,
 * e e a unica copia dessa conta em TypeScript. O que ele NAO prova e que o SQL
 * esta certo — um duble e a copia, nao o original; quem prova o SQL e a
 * verificacao que roda contra o banco de producao.
 *
 * O que estes testes provam continua sendo o que sempre provaram: que a tela
 * desenha corretamente o que recebe, e que o clique certo pede o recorte certo.
 */
const servidor = vi.hoisted(() => ({
  contas: [] as Record<string, unknown>[],
  modo: "ok" as "ok" | "falha" | "pendente",
  chamadas: 0,
}));

vi.mock("../services/notasapi", async () => {
  const { criarServidorDeContas } = await import("./contas/servidorFalso");
  const falso = criarServidorDeContas(() => servidor.contas as never[], {
    campoDaEmissao: "data_emissao",
    quitadas: ["pago"],
  });
  const responder = <T,>(real: () => Promise<T>): Promise<T> => {
    if (servidor.modo === "falha") return Promise.reject(new Error("500"));
    if (servidor.modo === "pendente") return new Promise<T>(() => {});
    return real();
  };
  return {
    fetchResumoDeContas: (tipo: string, params: Record<string, unknown>) => {
      servidor.chamadas += 1;
      return responder(() => falso.fetchResumoDeContas(tipo, params));
    },
    fetchPaginaDeContas: (tipo: string, params: Record<string, unknown>) =>
      responder(() => falso.fetchPaginaDeContas(tipo, params)),
  };
});

// --- Dublê do xlsx ----------------------------------------------------------

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

// --- Dublê do recharts ------------------------------------------------------

/**
 * Guarda os dados que a tela entregou a cada gráfico.
 *
 * Os dois `BarChart` são separados pelas séries que cada um desenha:
 * a evolução tem duas barras ("pago" e "aberto"), o top de fornecedores
 * tem uma só ("valor"). O `BarChart` clicável ainda desenha um botão por
 * ponto, para que o drill-down (`handleClickEvolucao`) possa ser exercido
 * como o usuário o exerce — clicando na barra.
 */
const graficos = vi.hoisted(() => ({
  barras: new Map<string, Record<string, unknown>[]>(),
  pizza: [] as Record<string, unknown>[],
}));

vi.mock("recharts", async () => {
  const { Children, isValidElement } = await import("react");

  const Bar = (_props: { dataKey: string; name?: string }) => null;
  const XAxis = (_props: { dataKey?: string }) => null;
  const Vazio = () => null;

  const filhosDe = (children: ReactNode) =>
    Children.toArray(children).filter(isValidElement) as unknown as Array<{
      type: unknown;
      props: Record<string, unknown>;
    }>;

  const BarChart = ({
    data,
    onClick,
    children,
  }: {
    data?: Record<string, unknown>[];
    onClick?: (evento: { activeLabel: string }) => void;
    children?: ReactNode;
  }) => {
    const filhos = filhosDe(children);
    const series = filhos
      .filter((f) => f.type === Bar)
      .map((f) => String(f.props.dataKey));
    const chaveX = filhos.find((f) => f.type === XAxis)?.props.dataKey as
      | string
      | undefined;
    graficos.barras.set(series.join(","), data ?? []);

    return (
      <div>
        {onClick
          ? (data ?? []).map((ponto, indice) => {
              const rotulo = chaveX ? String(ponto[chaveX]) : String(indice);
              return (
                <button
                  key={rotulo}
                  type="button"
                  onClick={() => onClick({ activeLabel: rotulo })}
                >
                  {`barra ${rotulo}`}
                </button>
              );
            })
          : null}
      </div>
    );
  };

  const Pie = ({ data }: { data?: Record<string, unknown>[] }) => {
    graficos.pizza = data ?? [];
    return null;
  };

  return {
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    PieChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    BarChart,
    Bar,
    XAxis,
    Pie,
    YAxis: Vazio,
    Tooltip: Vazio,
    Legend: Vazio,
    CartesianGrid: Vazio,
    Cell: Vazio,
  };
});

// --- Molde ------------------------------------------------------------------

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

// --- Massa de teste ---------------------------------------------------------

/** Conta com os campos que a tela lê; o resto do payload não importa aqui. */
function conta(campos: Partial<ContaPagar> & { id: number }): ContaPagar {
  return {
    id_tiny: 100 + campos.id,
    data_emissao: "2026-01-01",
    vencimento: "2026-01-31",
    competencia: null,
    valor: "0",
    saldo: "0",
    nro_documento: null,
    historico: null,
    categoria: null,
    situacao: null,
    ocorrencia: "U",
    dia_vencimento: null,
    numero_parcelas: null,
    dia_semana_vencimento: null,
    cliente_codigo: null,
    cliente_nome: "Fornecedor Padrao",
    cliente_tipo_pessoa: null,
    cliente_cpf_cnpj: null,
    cliente_ie: null,
    cliente_rg: null,
    cliente_fone: null,
    cliente_email: null,
    cliente_endereco: null,
    cliente_numero: null,
    cliente_complemento: null,
    cliente_bairro: null,
    cliente_cep: null,
    cliente_cidade: null,
    cliente_uf: null,
    cliente_pais: null,
    liquidacao: null,
    created_at: null,
    updated_at: null,
    ...campos,
  };
}

/**
 * Hoje, parado: 15/03/2026 ao meio-dia em UTC (09h em Brasília).
 *
 * A janela de "a vencer em 30 dias" que sai daí é 15/03 a 14/04, e as seis
 * contas abaixo foram escolhidas para cair uma em cada borda dela.
 */
const HOJE = new Date("2026-03-15T12:00:00Z");

const CONTAS: ContaPagar[] = [
  conta({
    id: 1,
    id_tiny: 101,
    cliente_nome: "Alfa Papelaria",
    categoria: "Material",
    data_emissao: "2026-01-10",
    vencimento: "2026-02-10", // no passado -> vencida
    valor: "1000.00",
    saldo: "1000.00",
    situacao: "pendente",
    nro_documento: "NF-001",
    historico: "Compra de papel A4",
    cliente_cpf_cnpj: "11.111.111/0001-11",
    cliente_cidade: "Recife",
    cliente_uf: "PE",
  }),
  conta({
    id: 2,
    id_tiny: 102,
    cliente_nome: "Beta Energia",
    categoria: "Energia",
    data_emissao: "2026-01-20",
    vencimento: "2026-01-25", // no passado, mas paga -> não vencida
    valor: "500.00",
    saldo: "0.00",
    situacao: "pago",
    liquidacao: "2026-01-24",
    nro_documento: "NF-002",
    historico: "Conta de luz de janeiro",
    cliente_cpf_cnpj: "22.222.222/0001-22",
    cliente_cidade: "Olinda",
    cliente_uf: "PE",
  }),
  conta({
    id: 3,
    id_tiny: 103,
    cliente_nome: "Gama Serviços",
    categoria: "Serviços",
    data_emissao: "2026-02-05",
    vencimento: "2026-03-15", // vence HOJE
    valor: "300.00",
    saldo: "300.00",
    situacao: "aberto",
    nro_documento: "NF-003",
    historico: "Manutenção predial",
  }),
  conta({
    id: 4,
    id_tiny: 104,
    cliente_nome: "Alfa Papelaria",
    categoria: "Material",
    data_emissao: "2026-02-15",
    vencimento: "2026-04-14", // exatamente hoje + 30
    valor: "2000.00",
    saldo: "1500.00",
    situacao: "pendente",
    nro_documento: "NF-004",
    historico: "Compra de toner",
  }),
  conta({
    id: 5,
    id_tiny: 105,
    cliente_nome: "Delta Transportes",
    categoria: "Frete",
    data_emissao: "2026-03-01",
    vencimento: "2026-04-15", // hoje + 31, fora da janela
    valor: "700.00",
    saldo: "700.00",
    situacao: "pendente",
    nro_documento: "NF-005",
    // Sem a palavra "Frete" de propósito: assim a busca por "Frete" só pode
    // casar pela CATEGORIA, e não também pelo histórico.
    historico: "Entrega de mercadoria",
  }),
  conta({
    id: 6,
    id_tiny: 106,
    cliente_nome: "Beta Energia",
    categoria: "Energia",
    data_emissao: "2026-03-10",
    vencimento: "2026-03-01", // no passado -> vencida
    valor: "400,50", // valor no formato brasileiro, com vírgula
    saldo: "400,50",
    situacao: "pendente",
    nro_documento: "NF-006",
    historico: "Conta de luz atrasada",
  }),
];

/** Duas contas de 2025 e uma de 2026 — força o gráfico ao modo anual. */
const CONTAS_DOIS_ANOS: ContaPagar[] = [
  conta({
    id: 1,
    id_tiny: 201,
    data_emissao: "2025-06-10",
    vencimento: "2025-07-10",
    valor: "100.00",
    saldo: "100.00",
    situacao: "pendente",
  }),
  conta({
    id: 2,
    id_tiny: 202,
    data_emissao: "2025-08-10",
    vencimento: "2025-09-10",
    valor: "200.00",
    saldo: "150.00",
    situacao: "pago",
  }),
  conta({
    id: 3,
    id_tiny: 203,
    data_emissao: "2026-02-10",
    vencimento: "2026-03-20",
    valor: "400.00",
    saldo: "400.00",
    situacao: "pendente",
  }),
];

/** 17 contas iguais em tudo menos o id — só para exercitar a paginação. */
const DEZESSETE: ContaPagar[] = Array.from({ length: 17 }, (_, i) =>
  conta({
    id: i + 1,
    id_tiny: 900 + i + 1,
    cliente_nome: `Fornecedor ${String(i + 1).padStart(2, "0")}`,
    data_emissao: "2026-03-01",
    vencimento: `2026-04-${String(i + 1).padStart(2, "0")}`,
    valor: "10.00",
    saldo: "10.00",
    situacao: "pendente",
  }),
);

// --- Ferramentas de leitura da tela -----------------------------------------

/** Texto normalizado: o `R$` da moeda vem com espaço duro (U+00A0). */
const texto = (elemento: Element | null | undefined) =>
  (elemento?.textContent ?? "").replace(/\s+/g, " ").trim();

async function montar(contas: ContaPagar[] = CONTAS) {
  servidor.contas = contas as never[];
  servidor.modo = "ok";
  const resultado = render(<ContasPagar />, { wrapper: Molde });
  await screen.findByRole("table");
  return resultado;
}

/**
 * Deixa as buscas disparadas pela interacao terminarem.
 *
 * Clicar num filtro deixou de recalcular um `useMemo` e passou a PEDIR o
 * recorte ao banco (item 9.4). Mesmo com o servidor falso respondendo na hora,
 * a resposta chega numa microtask — e uma asserção logo depois do clique leria
 * a tela do recorte anterior.
 */
async function assentar() {
  await act(async () => {
    await Promise.resolve();
  });
}

/** Valor de um KPI, achado pelo rótulo e lido no elemento ao lado. */
function kpi(rotulo: string): string {
  const etiqueta = screen.getByText(rotulo);
  const valor = etiqueta.nextElementSibling;
  if (!valor)
    throw new Error(`KPI "${rotulo}" não tem valor ao lado do rótulo`);
  return texto(valor);
}

/**
 * O cartão de filtros — achado subindo do título "Filtros" até o bloco que
 * contém o `<select>` de período. Assim os rótulos "Situação" e "Categoria"
 * do filtro não se confundem com as colunas de mesmo nome da tabela.
 */
function painelDeFiltros(): HTMLElement {
  let no: HTMLElement | null = screen.getByRole("heading", { name: "Filtros" });
  while (no && within(no).queryAllByRole("combobox").length === 0) {
    no = no.parentElement;
  }
  if (!no) throw new Error("painel de filtros não encontrado");
  return no;
}

/** O bloco de um filtro (rótulo + controle), achado pelo rótulo. */
function filtro(rotulo: string): HTMLElement {
  const etiqueta = within(painelDeFiltros()).getByText(rotulo);
  if (!etiqueta.parentElement) throw new Error(`filtro "${rotulo}" sem bloco`);
  return etiqueta.parentElement;
}

/** Abre (ou fecha) a lista de um multi-select — o primeiro botão do bloco. */
async function alternarLista(rotulo: string) {
  fireEvent.click(within(filtro(rotulo)).getAllByRole("button")[0]);
  await assentar();
}

async function selecionar(rotulo: string, ...opcoes: string[]) {
  await alternarLista(rotulo);
  for (const opcao of opcoes) {
    fireEvent.click(
      within(filtro(rotulo)).getByRole("checkbox", { name: opcao }),
    );
    await assentar();
  }
  await alternarLista(rotulo);
  await assentar();
}

async function opcoesDoFiltro(rotulo: string): Promise<string[]> {
  await alternarLista(rotulo);
  const nomes = within(filtro(rotulo))
    .queryAllByRole("checkbox")
    .map((caixa) => texto(caixa.closest("label")));
  await alternarLista(rotulo);
  return nomes;
}

function rotuloDoBotaoDoFiltro(rotulo: string): string {
  return texto(within(filtro(rotulo)).getAllByRole("button")[0]);
}

/**
 * Os `<label>` da tela não têm `htmlFor`, então `getByLabelText` não acha
 * campo nenhum: o teste desce do rótulo para o `<input>` do mesmo bloco.
 */
function campoData(rotulo: "Data Início" | "Data Fim"): HTMLInputElement {
  const campo = filtro(rotulo).querySelector("input");
  if (!campo) throw new Error(`campo "${rotulo}" não existe`);
  return campo as HTMLInputElement;
}

async function definirData(rotulo: "Data Início" | "Data Fim", valor: string) {
  fireEvent.change(campoData(rotulo), { target: { value: valor } });
  await assentar();
}

function seletorDePreset(): HTMLSelectElement {
  return within(painelDeFiltros()).getByRole("combobox") as HTMLSelectElement;
}

async function escolherPreset(valor: string) {
  fireEvent.change(seletorDePreset(), { target: { value: valor } });
  await assentar();
}

/** O cartão da tabela — para não confundir a busca com a do multi-select. */
function cartaoDaTabela(): HTMLElement {
  let no: HTMLElement | null = screen.getByRole("heading", {
    name: "Detalhamento de Contas",
  });
  while (no && within(no).queryAllByRole("table").length === 0) {
    no = no.parentElement;
  }
  if (!no) throw new Error("cartão da tabela não encontrado");
  return no;
}

async function buscar(termo: string) {
  fireEvent.change(
    within(cartaoDaTabela()).getByPlaceholderText("Pesquisar..."),
    {
      target: { value: termo },
    },
  );
  await assentar();
}

/** Linhas de DADO — sem o cabeçalho e sem a linha de "nenhuma conta". */
function linhasDaTabela(): HTMLElement[] {
  return within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .filter((linha) => within(linha).queryAllByRole("cell").length > 1);
}

function celulasDaLinha(linha: HTMLElement): string[] {
  return within(linha)
    .getAllByRole("cell")
    .map((celula) => texto(celula));
}

/** A coluna "ID Tiny" de cada linha, na ordem em que a tela as desenhou. */
function idsNaTela(): string[] {
  return linhasDaTabela().map((linha) => celulasDaLinha(linha)[0]);
}

function cabecalhos(): string[] {
  return screen.getAllByRole("columnheader").map((celula) => texto(celula));
}

async function ordenarPor(coluna: string) {
  const cabecalho = screen
    .getAllByRole("columnheader")
    .find((celula) => texto(celula) === coluna);
  if (!cabecalho) throw new Error(`coluna "${coluna}" não existe na tabela`);
  fireEvent.click(cabecalho.querySelector("button") ?? cabecalho);
  await assentar();
}

async function exportar() {
  fireEvent.click(screen.getByRole("button", { name: /exportar excel/i }));
  await assentar();
}

// --- Leitura dos gráficos ---------------------------------------------------

type PontoEvolucao = { label: string; pago: number; aberto: number };
type PontoFornecedor = { nome: string; valor: number };
type PontoCategoria = { name: string; value: number };

const evolucao = () =>
  (graficos.barras.get("pago,aberto") ?? []) as unknown as PontoEvolucao[];
const fornecedores = () =>
  (graficos.barras.get("valor") ?? []) as unknown as PontoFornecedor[];
const categorias = () => graficos.pizza as unknown as PontoCategoria[];

/** Só os meses que têm algum valor — o gráfico mensal sempre tem os 12. */
const mesesComValor = () =>
  evolucao().filter((ponto) => ponto.pago !== 0 || ponto.aberto !== 0);

async function clicarNaBarra(rotulo: string) {
  fireEvent.click(screen.getByRole("button", { name: `barra ${rotulo}` }));
  await assentar();
}

const tituloDaEvolucao = () =>
  texto(
    screen.getAllByRole("heading").find((h) => texto(h).startsWith("Evolução")),
  );

// --- Preparação -------------------------------------------------------------

beforeEach(() => {
  // Só o relógio é falso; os timers de verdade continuam rodando, senão o
  // `findByRole` de dentro do `montar` nunca resolveria.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(HOJE);
  servidor.contas = [];
  servidor.modo = "ok";
  servidor.chamadas = 0;
  planilha.linhas = [];
  planilha.aba = "";
  planilha.arquivo = "";
  graficos.barras.clear();
  graficos.pizza = [];
});

afterEach(() => {
  vi.useRealTimers();
});

// ============================================================================

describe("Contas a Pagar — carregamento e lista vazia", () => {
  it("mostra o aviso de carregando, e nenhuma tabela, enquanto a busca não volta", async () => {
    servidor.modo = "pendente";
    render(<ContasPagar />, { wrapper: Molde });

    expect(
      screen.getByText("Carregando contas a pagar..."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("busca as contas uma vez só ao abrir a tela", async () => {
    await montar();

    expect(servidor.chamadas).toBe(1);
  });

  it("falha na busca avisa em bloco, e a tabela fica vazia", async () => {
    // O `catch` do contexto só fazia `console.error`: quem olhava a tela via
    // uma lista vazia e não ficava sabendo que a API caiu (defeito 1.10).
    // O aviso é um `Alert` no fluxo da página, do mesmo jeito que na gêmea e
    // na tela de Locação.
    const erroNoConsole = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    servidor.modo = "falha";
    render(<ContasPagar />, { wrapper: Molde });

    await screen.findByRole("table");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as contas a pagar.",
    );
    expect(linhasDaTabela()).toHaveLength(0);
    expect(screen.getByText("Nenhuma conta encontrada.")).toBeInTheDocument();
    erroNoConsole.mockRestore();
  });

  it("busca que dá certo não desenha aviso nenhum", async () => {
    await montar();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sem nenhuma conta, os cinco KPIs vão a zero e a tabela diz que está vazia", async () => {
    await montar([]);

    expect(kpi("Total em Aberto")).toBe("R$ 0,00");
    expect(kpi("Total Pago")).toBe("R$ 0,00");
    expect(kpi("Contas Vencidas")).toBe("0");
    expect(kpi("A Vencer (30 dias)")).toBe("0");
    // `mesesComDados` é 0 e a média cai no ramo do zero, sem dividir por zero.
    expect(kpi("Média Mensal Faturada")).toBe("R$ 0,00");
    expect(linhasDaTabela()).toHaveLength(0);
    expect(screen.getByText("Nenhuma conta encontrada.")).toBeInTheDocument();
  });

  it("sem conta nenhuma a paginação some inteira, em vez de dobrar a frase de vazio", async () => {
    // A tela mostrava "Nenhuma conta encontrada." (tabela) e logo abaixo
    // "Nenhum resultado encontrado." (`Pagination`), com Anterior/Próxima
    // desabilitados e um botão "1" que não levava a lugar nenhum.
    await montar([]);

    expect(screen.getByText("Nenhuma conta encontrada.")).toBeInTheDocument();
    expect(
      screen.queryByText("Nenhum resultado encontrado."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Anterior" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Próxima" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "1" })).not.toBeInTheDocument();
  });

  it("sem conta nenhuma, os gráficos sem dado dizem isso em vez de virar moldura vazia", async () => {
    // A pizza de categoria não desenhava nada e o Top 10 desenhava um eixo
    // em branco: moldura vazia dentro de cartão com título lê como tela
    // quebrada. A evolução segue desenhando — tem os 12 meses zerados.
    await montar([]);

    expect(
      screen.getAllByText("Nenhuma conta para montar este gráfico."),
    ).toHaveLength(2);
    expect(evolucao()).toHaveLength(12);
  });

  it("na falha de carregamento o gráfico usa a MESMA frase — a causa está no Alert", async () => {
    // Não há frase de erro dentro do gráfico: a distinção entre "a API caiu"
    // e "não há conta" já mora no `Alert` vermelho no topo da página, e
    // repeti-la em cada cartão diria a mesma coisa mais duas vezes.
    const erroNoConsole = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    servidor.modo = "falha";
    render(<ContasPagar />, { wrapper: Molde });
    await screen.findByRole("table");

    expect(
      screen.getAllByText("Nenhuma conta para montar este gráfico."),
    ).toHaveLength(2);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as contas a pagar.",
    );
    erroNoConsole.mockRestore();
  });

  it("sem nenhuma conta, o gráfico cai no modo mensal do ano corrente, com 12 meses zerados", async () => {
    // Sem ano nenhum na base, o `?? new Date().getFullYear()` assume — e o
    // título anuncia 2026 mesmo não havendo dado nenhum de 2026.
    await montar([]);

    expect(tituloDaEvolucao()).toBe("Evolução Mensal — 2026");
    expect(evolucao()).toHaveLength(12);
    expect(mesesComValor()).toEqual([]);
    expect(categorias()).toEqual([]);
    expect(fornecedores()).toEqual([]);
  });

  it("sem nenhuma conta, os multi-selects não têm opção nenhuma", async () => {
    await montar([]);

    await alternarLista("Situação");
    expect(
      within(filtro("Situação")).getByText("Nenhum resultado encontrado"),
    ).toBeInTheDocument();
    await alternarLista("Situação");
  });
});

describe("Contas a Pagar — cabeçalho", () => {
  it("mostra o título da tela e quem está logado", async () => {
    await montar();

    expect(
      screen.getByRole("heading", { name: "Contas a Pagar" }),
    ).toBeInTheDocument();
    expect(screen.getByText("erick")).toBeInTheDocument();
    expect(screen.getByText(/\(admin\)/)).toBeInTheDocument();
  });
});

describe("Contas a Pagar — KPIs", () => {
  it("os cinco KPIs saem com o número conferido na mão", async () => {
    await montar();

    // Em aberto = SALDO das não pagas: 1000 + 300 + 1500 + 700 + 400,50.
    expect(kpi("Total em Aberto")).toBe("R$ 3.900,50");
    // Pago = (valor − saldo) de TODAS: a 102 quitada (500) e a 104, que está
    // em aberto mas já teve 500 pagos (2000 − 1500). As outras não tiveram
    // pagamento nenhum.
    expect(kpi("Total Pago")).toBe("R$ 1.000,00");
    // Vencidas: 101 (10/02) e 106 (01/03), ambas antes de 15/03.
    expect(kpi("Contas Vencidas")).toBe("2");
    // A vencer: 103 (vence hoje) e 104 (vence em hoje+30).
    expect(kpi("A Vencer (30 dias)")).toBe("2");
    // Média faturada = (3900,50 + 1000) / 3 meses de emissão = 1633,50 — e
    // 4900,50 é a soma dos valores das seis contas.
    expect(kpi("Média Mensal Faturada")).toBe("R$ 1.633,50");
  });

  it("Total em Aberto é o SALDO das não pagas e Total Pago é `valor − saldo` de todas", async () => {
    // Antes uma conta em aberto de 1000 com 750 já pagos aparecia como 250
    // em "aberto" e os 750 não apareciam em lugar nenhum; e uma paga entrava
    // pelo valor CHEIO, ainda que o saldo dissesse outra coisa (defeito 1.1).
    await montar([
      conta({ id: 1, valor: "1000.00", saldo: "250.00", situacao: "pendente" }),
      conta({ id: 2, valor: "800.00", saldo: "0.00", situacao: "pago" }),
    ]);

    expect(kpi("Total em Aberto")).toBe("R$ 250,00");
    expect(kpi("Total Pago")).toBe("R$ 1.550,00");
    // Os dois somados são o faturado: 1000 + 800.
    expect(kpi("Média Mensal Faturada")).toBe("R$ 1.800,00");
  });

  it("vencer HOJE não é vencer: a comparação com hoje é estritamente menor", async () => {
    await montar([
      conta({ id: 1, vencimento: "2026-03-14", situacao: "pendente" }),
      conta({ id: 2, vencimento: "2026-03-15", situacao: "pendente" }),
    ]);

    expect(kpi("Contas Vencidas")).toBe("1");
  });

  it("a janela de 30 dias inclui hoje e o trigésimo dia, e para no trigésimo primeiro", async () => {
    await montar([
      conta({ id: 1, vencimento: "2026-03-14", situacao: "pendente" }), // ontem
      conta({ id: 2, vencimento: "2026-03-15", situacao: "pendente" }), // hoje
      conta({ id: 3, vencimento: "2026-04-14", situacao: "pendente" }), // hoje+30
      conta({ id: 4, vencimento: "2026-04-15", situacao: "pendente" }), // hoje+31
    ]);

    expect(kpi("A Vencer (30 dias)")).toBe("2");
  });

  it("conta paga dentro da janela não entra em A Vencer", async () => {
    await montar([
      conta({ id: 1, vencimento: "2026-03-20", situacao: "pendente" }),
      conta({ id: 2, vencimento: "2026-03-21", situacao: "pago" }),
    ]);

    expect(kpi("A Vencer (30 dias)")).toBe("1");
  });

  it("nesta tela só 'pago' quita — 'recebido', que a gêmea aceita, fica em aberto", async () => {
    // A Contas a Receber trata `recebido` OU `pago` como quitado. Aqui só
    // `pago`. É a divergência mais importante entre as duas telas.
    await montar([
      conta({ id: 1, valor: "100.00", saldo: "90.00", situacao: "recebido" }),
      conta({ id: 2, valor: "200.00", saldo: "0.00", situacao: "pago" }),
    ]);

    // Os 90 que faltam entram no aberto porque "recebido" não quita aqui —
    // na gêmea entrariam em zero. Os 10 já pagos contam nos dois dialetos.
    expect(kpi("Total em Aberto")).toBe("R$ 90,00");
    expect(kpi("Total Pago")).toBe("R$ 210,00");
  });

  it("'PAGO' em maiúsculas quita igual, porque a comparação é em minúsculas", async () => {
    await montar([
      conta({ id: 1, valor: "100.00", saldo: "0.00", situacao: "PAGO" }),
      conta({ id: 2, valor: "50.00", saldo: "0.00", situacao: "Pago" }),
    ]);

    expect(kpi("Total Pago")).toBe("R$ 150,00");
    expect(kpi("Total em Aberto")).toBe("R$ 0,00");
  });

  it("situação desconhecida, vazia e nula caem todas em aberto", async () => {
    // Valor e saldo propositalmente diferentes: assim a asserção do "em
    // aberto" só fecha se ele estiver mesmo somando o SALDO.
    await montar([
      conta({ id: 1, valor: "100.00", saldo: "10.00", situacao: "cancelado" }),
      conta({ id: 2, valor: "200.00", saldo: "20.00", situacao: "" }),
      conta({ id: 3, valor: "300.00", saldo: "30.00", situacao: null }),
    ]);

    expect(kpi("Total em Aberto")).toBe("R$ 60,00");
    // O que já foi pago conta mesmo sem situação de quitada: 90 + 180 + 270.
    expect(kpi("Total Pago")).toBe("R$ 540,00");
  });

  it("a média mensal conta meses DISTINTOS de emissão, não lançamentos", async () => {
    // Três contas, dois meses de emissão: 300 / 2 = 150.
    await montar([
      conta({
        id: 1,
        data_emissao: "2026-01-05",
        valor: "100.00",
        saldo: "100.00",
      }),
      conta({
        id: 2,
        data_emissao: "2026-01-25",
        valor: "100.00",
        saldo: "100.00",
      }),
      conta({
        id: 3,
        data_emissao: "2026-02-01",
        valor: "100.00",
        saldo: "100.00",
      }),
    ]);

    expect(kpi("Média Mensal Faturada")).toBe("R$ 150,00");
  });

  it("a média mensal faturada é o faturado do mês, e não uma mistura de grandezas", async () => {
    // O numerador era `totalAberto + totalPago`: saldo de umas somado a valor
    // de outras. Com uma paga de 900 e uma em aberto de 500 com saldo 100, a
    // média dava 1000 — nem o faturado (1400) nem o que saiu (1300).
    await montar([
      conta({
        id: 1,
        data_emissao: "2026-01-05",
        valor: "900.00",
        saldo: "0.00",
        situacao: "pago",
      }),
      conta({
        id: 2,
        data_emissao: "2026-01-06",
        valor: "500.00",
        saldo: "100.00",
        situacao: "pendente",
      }),
    ]);

    expect(kpi("Total Pago")).toBe("R$ 1.300,00");
    expect(kpi("Total em Aberto")).toBe("R$ 100,00");
    expect(kpi("Média Mensal Faturada")).toBe("R$ 1.400,00");
  });

  it("o mês da média vem da EMISSÃO, não do vencimento", async () => {
    // Duas contas emitidas no mesmo mês, vencendo em meses diferentes:
    // continua sendo um mês só de dados.
    await montar([
      conta({
        id: 1,
        data_emissao: "2026-01-05",
        vencimento: "2026-02-05",
        valor: "100.00",
        saldo: "100.00",
      }),
      conta({
        id: 2,
        data_emissao: "2026-01-06",
        vencimento: "2026-09-06",
        valor: "100.00",
        saldo: "100.00",
      }),
    ]);

    expect(kpi("Média Mensal Faturada")).toBe("R$ 200,00");
  });

  it("os KPIs seguem os filtros, mas ignoram a busca da tabela", async () => {
    await montar();

    await buscar("Alfa");
    expect(idsNaTela()).toEqual(["101", "104"]);
    expect(kpi("Total em Aberto")).toBe("R$ 3.900,50");
    expect(kpi("Total Pago")).toBe("R$ 1.000,00");

    await buscar("");
    await selecionar("Fornecedor", "Alfa Papelaria");
    expect(kpi("Total em Aberto")).toBe("R$ 2.500,00");
    // Nenhuma das duas está paga, mas a 104 já teve 500 pagos (2000 − 1500).
    expect(kpi("Total Pago")).toBe("R$ 500,00");
    expect(kpi("Contas Vencidas")).toBe("1");
  });
});

describe("Contas a Pagar — situação na tabela", () => {
  it("cada situação vira uma etiqueta, e a vencida ACRESCENTA sem engolir", async () => {
    await montar();

    // 102 está paga; 101 e 106 venceram e mostram "pendente · Vencida";
    // 103 continua "aberto"; 104 e 105 continuam "pendente".
    const porId = new Map(
      linhasDaTabela().map((l) => [celulasDaLinha(l)[0], celulasDaLinha(l)[7]]),
    );
    // O selo mostra o texto cru que a API mandou, e não o literal "Pago".
    expect(porId.get("102")).toBe("pago");
    expect(porId.get("101")).toBe("pendente · Vencida");
    expect(porId.get("106")).toBe("pendente · Vencida");
    expect(porId.get("103")).toBe("aberto");
    expect(porId.get("104")).toBe("pendente");
    expect(porId.get("105")).toBe("pendente");
  });

  it("situação desconhecida aparece como veio da API", async () => {
    await montar([
      conta({ id: 1, vencimento: "2026-12-01", situacao: "cancelado" }),
    ]);

    expect(celulasDaLinha(linhasDaTabela()[0])[7]).toBe("cancelado");
  });

  it("situação nula vira travessão curto, e a categoria nula também", async () => {
    await montar([
      conta({
        id: 1,
        vencimento: "2026-12-01",
        situacao: null,
        categoria: null,
      }),
    ]);

    expect(celulasDaLinha(linhasDaTabela()[0])[4]).toBe("-");
    expect(celulasDaLinha(linhasDaTabela()[0])[7]).toBe("-");
  });

  it("situação vazia mostra o travessão, do mesmo jeito que a nula", async () => {
    // `situacao ?? "-"` só cobria `null`; a string vazia passava e desenhava
    // uma pílula colorida sem texto nenhum dentro.
    await montar([conta({ id: 1, vencimento: "2026-12-01", situacao: "" })]);

    expect(celulasDaLinha(linhasDaTabela()[0])[7]).toBe("-");
  });

  it("uma conta paga nunca aparece como vencida, mesmo com vencimento antigo", async () => {
    await montar([
      conta({ id: 1, vencimento: "2020-01-01", situacao: "pago" }),
    ]);

    expect(celulasDaLinha(linhasDaTabela()[0])[7]).toBe("pago");
    expect(kpi("Contas Vencidas")).toBe("0");
  });

  it("a tabela mostra id, as duas datas, fornecedor, categoria, valor, saldo e situação", async () => {
    await montar([CONTAS[0]]);

    expect(cabecalhos()).toEqual([
      "ID Tiny",
      "Vencimento",
      "Emissão",
      "Fornecedor",
      "Categoria",
      "Valor",
      "Saldo",
      "Situação",
    ]);
    // A célula do fornecedor leva o CPF/CNPJ numa segunda linha, como a da
    // gêmea: é o que desempata dois cadastros com o mesmo nome.
    expect(celulasDaLinha(linhasDaTabela()[0])).toEqual([
      "101",
      "10/02/2026",
      "10/01/2026",
      "Alfa Papelaria11.111.111/0001-11",
      "Material",
      "R$ 1.000,00",
      "R$ 1.000,00",
      "pendente · Vencida",
    ]);
  });
});

describe("Contas a Pagar — dinheiro", () => {
  it("converte o valor em texto do jeito brasileiro e do jeito americano", async () => {
    await montar([
      conta({
        id: 1,
        valor: "1.234,56",
        saldo: "1.234,56",
        situacao: "pendente",
      }),
      conta({
        id: 2,
        valor: "1234.56",
        saldo: "1234.56",
        situacao: "pendente",
      }),
    ]);

    const valores = linhasDaTabela().map((l) => celulasDaLinha(l)[5]);
    expect(valores).toEqual(["R$ 1.234,56", "R$ 1.234,56"]);
    expect(kpi("Total em Aberto")).toBe("R$ 2.469,12");
  });

  it("ponto de milhar sem centavo é milhar, e não decimal", async () => {
    // "1.234" não tem vírgula: o ponto era lido como decimal e a conta de
    // mil duzentos e trinta e quatro reais virava R$ 1,23.
    await montar([
      conta({ id: 1, valor: "1.234", saldo: "1.234", situacao: "pendente" }),
    ]);

    expect(celulasDaLinha(linhasDaTabela()[0])[5]).toBe("R$ 1.234,00");
    expect(kpi("Total em Aberto")).toBe("R$ 1.234,00");
  });

  it("engole o R$ e os espaços que vierem colados no número", async () => {
    await montar([
      conta({
        id: 1,
        valor: "R$ 2.000,00",
        saldo: "R$ 2.000,00",
        situacao: "pendente",
      }),
    ]);

    expect(celulasDaLinha(linhasDaTabela()[0])[5]).toBe("R$ 2.000,00");
  });

  it("valor negativo passa inteiro, com o sinal", async () => {
    await montar([
      conta({
        id: 1,
        valor: "-250.75",
        saldo: "-250.75",
        situacao: "pendente",
      }),
    ]);

    expect(celulasDaLinha(linhasDaTabela()[0])[5]).toBe("-R$ 250,75");
    expect(kpi("Total em Aberto")).toBe("-R$ 250,75");
  });

  it("valor ausente, zero ou ilegível vira zero, sem quebrar a tela", async () => {
    await montar([
      conta({ id: 1, valor: "", saldo: "", situacao: "pendente" }),
      conta({ id: 2, valor: 0, saldo: 0, situacao: "pendente" }),
      conta({
        id: 3,
        valor: "sem valor",
        saldo: "sem valor",
        situacao: "pendente",
      }),
    ]);

    expect(linhasDaTabela().map((l) => celulasDaLinha(l)[5])).toEqual([
      "R$ 0,00",
      "R$ 0,00",
      "R$ 0,00",
    ]);
    expect(kpi("Total em Aberto")).toBe("R$ 0,00");
  });

  it("valor que já vem número passa direto, sem passar pelo parse", async () => {
    await montar([
      conta({ id: 1, valor: 1234.5, saldo: 1234.5, situacao: "pendente" }),
    ]);

    expect(celulasDaLinha(linhasDaTabela()[0])[5]).toBe("R$ 1.234,50");
  });
});

describe("Contas a Pagar — filtros", () => {
  it("as opções de cada multi-select são distintas, ordenadas e sem as vazias", async () => {
    await montar();

    expect(await opcoesDoFiltro("Situação")).toEqual([
      "aberto",
      "pago",
      "pendente",
    ]);
    expect(await opcoesDoFiltro("Categoria")).toEqual([
      "Energia",
      "Frete",
      "Material",
      "Serviços",
    ]);
    expect(await opcoesDoFiltro("Fornecedor")).toEqual([
      "Alfa Papelaria",
      "Beta Energia",
      "Delta Transportes",
      "Gama Serviços",
    ]);
  });

  it("vazio e nulo somem das TRÊS listas — inclusive da de fornecedor", async () => {
    // Situação e categoria já passavam por `.filter(Boolean)`; o fornecedor
    // não, e um `cliente_nome` vazio virava a opção "(vazio)" ao lado dos
    // cadastros de verdade.
    await montar([
      conta({ id: 1, situacao: "", categoria: "", cliente_nome: "" }),
      conta({ id: 2, situacao: null, categoria: null, cliente_nome: "Zeta" }),
    ]);

    expect(await opcoesDoFiltro("Situação")).toEqual([]);
    expect(await opcoesDoFiltro("Categoria")).toEqual([]);
    expect(await opcoesDoFiltro("Fornecedor")).toEqual(["Zeta"]);
  });

  it("filtro de situação isolado", async () => {
    await montar();
    await selecionar("Situação", "pago");

    expect(idsNaTela()).toEqual(["102"]);
  });

  it("filtro de categoria isolado", async () => {
    await montar();
    await selecionar("Categoria", "Material");

    expect(idsNaTela()).toEqual(["101", "104"]);
  });

  it("filtro de fornecedor isolado", async () => {
    await montar();
    await selecionar("Fornecedor", "Beta Energia");

    expect(idsNaTela()).toEqual(["102", "106"]);
  });

  it("duas opções do mesmo filtro somam (é OU dentro do filtro)", async () => {
    await montar();
    await selecionar("Categoria", "Material", "Frete");

    expect(idsNaTela()).toEqual(["101", "104", "105"]);
  });

  it("filtros diferentes se cortam (é E entre filtros)", async () => {
    await montar();
    await selecionar("Categoria", "Material", "Energia");
    await selecionar("Situação", "pendente");

    // Material + Energia = 101, 102, 104, 106; das quais pendentes: 101, 104, 106.
    expect(idsNaTela()).toEqual(["101", "106", "104"]);
  });

  it("o gatilho do multi-select se anuncia com o rótulo E com o que está escolhido", async () => {
    // O `<label>` era solto e o gatilho é um `<button>`: o leitor de tela
    // anunciava só "Todas", sem dizer de qual campo (defeito 1.14).
    await montar();
    expect(
      screen.getByRole("button", { name: "Situação Todas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Categoria Todas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fornecedor Todos" }),
    ).toBeInTheDocument();

    await selecionar("Fornecedor", "Beta Energia");
    expect(
      screen.getByRole("button", { name: "Fornecedor 1 selecionado(s)" }),
    ).toBeInTheDocument();
  });

  it("a contagem no botão do filtro diz quantas opções estão marcadas", async () => {
    await montar();

    expect(rotuloDoBotaoDoFiltro("Situação")).toBe("Todas");
    expect(rotuloDoBotaoDoFiltro("Fornecedor")).toBe("Todos");

    await selecionar("Situação", "pago", "aberto");
    expect(rotuloDoBotaoDoFiltro("Situação")).toBe("2 selecionado(s)");
  });

  it("Limpar seleção devolve a lista inteira", async () => {
    await montar();
    await selecionar("Categoria", "Material");
    expect(idsNaTela()).toHaveLength(2);

    await alternarLista("Categoria");
    fireEvent.click(
      within(filtro("Categoria")).getByRole("button", {
        name: "Limpar seleção",
      }),
    );
    await assentar();
    await alternarLista("Categoria");

    expect(idsNaTela()).toHaveLength(6);
  });

  it("a pesquisa de dentro do multi-select filtra as opções, sem filtrar a tabela", async () => {
    await montar();

    await alternarLista("Fornecedor");
    fireEvent.change(
      within(filtro("Fornecedor")).getByPlaceholderText("Pesquisar..."),
      {
        target: { value: "beta" },
      },
    );
    expect(
      within(filtro("Fornecedor"))
        .getAllByRole("checkbox")
        .map((c) => texto(c.closest("label"))),
    ).toEqual(["Beta Energia"]);
    await alternarLista("Fornecedor");

    expect(idsNaTela()).toHaveLength(6);
  });

  it("o filtro de data olha a EMISSÃO, não o vencimento", async () => {
    // A conta 101 é emitida em 10/01 e vence em 10/02. Um intervalo que
    // cobre só fevereiro não a pega — prova que quem manda é a emissão.
    await montar();

    await definirData("Data Início", "2026-02-01");
    await definirData("Data Fim", "2026-02-28");
    expect(idsNaTela()).toEqual(["103", "104"]);
  });

  it("as duas pontas do intervalo são inclusivas", async () => {
    await montar();

    await definirData("Data Início", "2026-01-10"); // dia exato da emissão da 101
    await definirData("Data Fim", "2026-03-10"); // dia exato da emissão da 106
    expect(idsNaTela()).toEqual(["102", "101", "106", "103", "104", "105"]);

    await definirData("Data Início", "2026-01-11");
    await definirData("Data Fim", "2026-03-09");
    expect(idsNaTela()).toEqual(["102", "103", "104", "105"]);
  });

  it("só a data início, ou só a data fim, já filtra sozinha", async () => {
    await montar();

    await definirData("Data Início", "2026-03-01");
    expect(idsNaTela()).toEqual(["106", "105"]);

    await definirData("Data Início", "");
    await definirData("Data Fim", "2026-01-31");
    expect(idsNaTela()).toEqual(["102", "101"]);
  });

  it("mexer numa data joga o período rápido para Personalizado", async () => {
    await montar();

    expect(seletorDePreset()).toHaveValue("todos");
    await definirData("Data Início", "2026-02-01");
    expect(seletorDePreset()).toHaveValue("custom");
    // E o "custom" não é sobrescrito pelo efeito: a data digitada fica.
    expect(campoData("Data Início")).toHaveValue("2026-02-01");
  });

  it("filtro e busca valem juntos", async () => {
    await montar();
    await selecionar("Categoria", "Material", "Energia");
    await buscar("luz");

    // Material + Energia = 101, 102, 104, 106; "luz" está no histórico de
    // 102 e 106.
    expect(idsNaTela()).toEqual(["102", "106"]);
  });
});

describe("Contas a Pagar — presets de período", () => {
  it("'Todos' deixa as duas datas em branco", async () => {
    await montar();

    expect(campoData("Data Início")).toHaveValue("");
    expect(campoData("Data Fim")).toHaveValue("");
    expect(idsNaTela()).toHaveLength(6);
  });

  it("'Últimos 7 dias' vai de 08/03 a 15/03 com o relógio em 15/03/2026", async () => {
    await montar();
    await escolherPreset("7dias");

    expect(campoData("Data Início")).toHaveValue("2026-03-08");
    expect(campoData("Data Fim")).toHaveValue("2026-03-15");
    // Emissão de 10/03 (106) é a única dentro da janela.
    expect(idsNaTela()).toEqual(["106"]);
  });

  it("'Últimos 30 dias' vai de 13/02 a 15/03 com o relógio em 15/03/2026", async () => {
    await montar();
    await escolherPreset("30dias");

    expect(campoData("Data Início")).toHaveValue("2026-02-13");
    expect(campoData("Data Fim")).toHaveValue("2026-03-15");
    // Emissões de 15/02 (104), 01/03 (105) e 10/03 (106) sobrevivem.
    expect(idsNaTela()).toEqual(["106", "104", "105"]);
  });

  it("'Mês atual' vai do dia 1º ao ÚLTIMO dia do mês, e não até hoje", async () => {
    // Hoje é 15/03. Antes o fim era 15/03 e a conta emitida em 20/03 sumia
    // do "mês atual"; agora o preset é o mês do calendário inteiro.
    await montar([
      ...CONTAS,
      conta({
        id: 7,
        id_tiny: 107,
        data_emissao: "2026-03-20",
        vencimento: "2026-05-20",
      }),
    ]);
    await escolherPreset("mesAtual");

    expect(campoData("Data Início")).toHaveValue("2026-03-01");
    expect(campoData("Data Fim")).toHaveValue("2026-03-31");
    expect(idsNaTela()).toEqual(["106", "105", "107"]);
  });

  it("'Ano atual' pega o ano inteiro, do 1º de janeiro ao 31 de dezembro", async () => {
    await montar();
    await escolherPreset("anoAtual");

    expect(campoData("Data Início")).toHaveValue("2026-01-01");
    expect(campoData("Data Fim")).toHaveValue("2026-12-31");
    expect(idsNaTela()).toHaveLength(6);
  });

  it("'Personalizado' escolhido na mão não mexe nas datas que já estavam lá", async () => {
    await montar();
    await escolherPreset("anoAtual");
    await escolherPreset("custom");

    expect(campoData("Data Início")).toHaveValue("2026-01-01");
    expect(campoData("Data Fim")).toHaveValue("2026-12-31");
  });

  it("voltar para 'Todos' limpa o intervalo de novo", async () => {
    await montar();
    await escolherPreset("mesAtual");
    await escolherPreset("todos");

    expect(campoData("Data Início")).toHaveValue("");
    expect(campoData("Data Fim")).toHaveValue("");
    expect(idsNaTela()).toHaveLength(6);
  });
});

describe("Contas a Pagar — presets e o fuso horário", () => {
  /**
   * As duas pontas do preset saem do DIA LOCAL. No meio do dia isso não muda
   * nada; na virada da meia-noite, o preset acompanha o relógio de quem olha
   * a tela — e não o de Greenwich.
   */
  const ATRASADO_EM_RELACAO_A_UTC = new Date().getTimezoneOffset() > 0;

  it("no meio do dia os presets dão o mesmo em qualquer fuso", async () => {
    // 12:00Z é 09:00 em Brasília: o mesmo dia de calendário nos dois.
    await montar();

    await escolherPreset("mesAtual");
    expect(campoData("Data Início")).toHaveValue("2026-03-01");
    expect(campoData("Data Fim")).toHaveValue("2026-03-31");

    await escolherPreset("anoAtual");
    expect(campoData("Data Início")).toHaveValue("2026-01-01");
    expect(campoData("Data Fim")).toHaveValue("2026-12-31");
  });

  it("na virada do ano, o mês e o ano são os do calendário LOCAL, nas duas pontas", async () => {
    // 01/01/2026 às 02:00Z ainda é 31/12/2025 às 23:00 em Brasília.
    // Em UTC:      mês atual = 01/01/2026 a 01/01/2026, ano = 2026 inteiro.
    // Em Brasília: mês atual = 01/12/2025 a 31/12/2025, ano = 2025 inteiro.
    // Antes o começo era o mês local (dezembro) e o fim era o dia em UTC (1º
    // de janeiro): o intervalo atravessava a virada e o rótulo mentia.
    vi.setSystemTime(new Date("2026-01-01T02:00:00Z"));
    await montar([]);

    await escolherPreset("mesAtual");
    expect(campoData("Data Início")).toHaveValue(
      ATRASADO_EM_RELACAO_A_UTC ? "2025-12-01" : "2026-01-01",
    );
    expect(campoData("Data Fim")).toHaveValue(
      ATRASADO_EM_RELACAO_A_UTC ? "2025-12-31" : "2026-01-31",
    );

    await escolherPreset("anoAtual");
    expect(campoData("Data Início")).toHaveValue(
      ATRASADO_EM_RELACAO_A_UTC ? "2025-01-01" : "2026-01-01",
    );
    expect(campoData("Data Fim")).toHaveValue(
      ATRASADO_EM_RELACAO_A_UTC ? "2025-12-31" : "2026-12-31",
    );
  });

  it("'Últimos 30 dias' na virada termina no dia LOCAL, e não no dia em Greenwich", async () => {
    // Em UTC os 30 dias terminam em 01/01/2026; em Brasília, em 31/12/2025.
    // As duas pontas andam juntas dentro de cada fuso.
    vi.setSystemTime(new Date("2026-01-01T02:00:00Z"));
    await montar([]);

    await escolherPreset("30dias");
    expect(campoData("Data Início")).toHaveValue(
      ATRASADO_EM_RELACAO_A_UTC ? "2025-12-01" : "2025-12-02",
    );
    expect(campoData("Data Fim")).toHaveValue(
      ATRASADO_EM_RELACAO_A_UTC ? "2025-12-31" : "2026-01-01",
    );
  });

  it("vencida e a janela de 30 dias seguem o dia LOCAL de quem olha a tela", async () => {
    // 15/03 às 02:00Z ainda é 14/03 às 23h em Brasília. O "hoje" dos KPIs é
    // meia-noite local, e o vencimento também é montado com
    // `new Date(ano, mes-1, dia)` (meia-noite local): as duas pontas andam
    // juntas, mas o DIA de referência é outro em cada fuso.
    //   Em UTC:      hoje = 15/03 -> a de 14/03 já venceu; a janela é 15/03
    //                a 14/04 e pega só a de 15/03.
    //   Em Brasília: hoje = 14/03 -> nenhuma venceu; a janela é 14/03 a
    //                13/04 e pega as duas.
    // Isso não é o bug de fuso das planilhas: aqui o dia local é justamente
    // o certo. Fica fixado para que a migração não troque por `toISOString`.
    vi.setSystemTime(new Date("2026-03-15T02:00:00Z"));
    await montar([
      conta({ id: 1, vencimento: "2026-03-14", situacao: "pendente" }),
      conta({ id: 2, vencimento: "2026-03-15", situacao: "pendente" }),
    ]);

    expect(kpi("Contas Vencidas")).toBe(ATRASADO_EM_RELACAO_A_UTC ? "0" : "1");
    expect(kpi("A Vencer (30 dias)")).toBe(
      ATRASADO_EM_RELACAO_A_UTC ? "2" : "1",
    );
  });

  it("as datas da tabela são lidas da string, então não andam para trás em nenhum fuso", async () => {
    await montar([CONTAS[0]]);

    expect(celulasDaLinha(linhasDaTabela()[0])[2]).toBe("10/01/2026");
    expect(celulasDaLinha(linhasDaTabela()[0])[1]).toBe("10/02/2026");
  });
});

describe("Contas a Pagar — busca da tabela", () => {
  it("procura no fornecedor, na categoria, no nº do documento e no histórico", async () => {
    await montar();

    await buscar("Delta");
    expect(idsNaTela()).toEqual(["105"]);

    // "Frete" só existe na categoria — o fornecedor da 105 é "Delta
    // Transportes". Com "Energia" o teste ficaria cego: casaria pelo nome do
    // fornecedor mesmo se a busca deixasse de olhar a categoria.
    await buscar("Frete");
    expect(idsNaTela()).toEqual(["105"]);

    await buscar("NF-004");
    expect(idsNaTela()).toEqual(["104"]);

    await buscar("toner");
    expect(idsNaTela()).toEqual(["104"]);
  });

  it("não procura no valor, nas datas, no id nem na situação", async () => {
    await montar();

    await buscar("2000");
    expect(screen.getByText("Nenhuma conta encontrada.")).toBeInTheDocument();

    await buscar("2026-01-10");
    expect(screen.getByText("Nenhuma conta encontrada.")).toBeInTheDocument();

    await buscar("10/01/2026");
    expect(screen.getByText("Nenhuma conta encontrada.")).toBeInTheDocument();

    await buscar("101");
    expect(screen.getByText("Nenhuma conta encontrada.")).toBeInTheDocument();

    await buscar("pendente");
    expect(screen.getByText("Nenhuma conta encontrada.")).toBeInTheDocument();
  });

  it("não diferencia maiúscula de minúscula", async () => {
    await montar();
    await buscar("aLFa pAPELARIA");

    expect(idsNaTela()).toEqual(["101", "104"]);
  });

  it("ignora acento: 'servicos' acha 'Serviços'", async () => {
    // A busca só baixava a caixa: quem digitava sem acento não achava nem a
    // categoria "Serviços" nem o fornecedor "Gama Serviços".
    await montar();

    await buscar("Serviços");
    expect(idsNaTela()).toEqual(["103"]);

    await buscar("servicos");
    expect(idsNaTela()).toEqual(["103"]);

    // E quem não está lá continua não aparecendo.
    await buscar("servicais");
    expect(screen.getByText("Nenhuma conta encontrada.")).toBeInTheDocument();
  });

  it("conta sem categoria, sem documento e sem histórico só é achada pelo fornecedor", async () => {
    await montar([
      conta({
        id: 1,
        cliente_nome: "Solo Ltda",
        categoria: null,
        nro_documento: null,
        historico: null,
      }),
    ]);

    await buscar("Solo");
    expect(idsNaTela()).toEqual(["101"]);

    await buscar("qualquer coisa");
    expect(linhasDaTabela()).toHaveLength(0);
  });

  it("busca em branco devolve a lista inteira", async () => {
    await montar();
    await buscar("Delta");
    expect(idsNaTela()).toHaveLength(1);

    await buscar("");
    expect(idsNaTela()).toHaveLength(6);
  });
});

describe("Contas a Pagar — ordenação", () => {
  it("cada cabecalho diz ao leitor de tela a direcao da ordem", async () => {
    // O botão "Ordenar por" dentro do `<th>` mostrava a direção só na seta:
    // o leitor de tela não sabia se a coluna estava crescente, decrescente
    // ou fora de uso. Ver `src/test/ordenacaoAcessivel.ts`.
    await montar();
    conferirAriaSort("Valor");
  });

  const DECRESCENTE: Record<string, string[]> = {
    "ID Tiny": ["106", "105", "104", "103", "102", "101"],
    Fornecedor: ["103", "105", "102", "106", "101", "104"],
    Categoria: ["103", "101", "104", "105", "102", "106"],
    Valor: ["104", "101", "105", "102", "106", "103"],
    Saldo: ["104", "101", "105", "106", "103", "102"],
    Emissão: ["106", "105", "104", "103", "102", "101"],
    Vencimento: ["105", "104", "103", "106", "101", "102"],
    Situação: ["101", "104", "105", "106", "102", "103"],
  };
  const CRESCENTE: Record<string, string[]> = {
    "ID Tiny": ["101", "102", "103", "104", "105", "106"],
    Fornecedor: ["101", "104", "102", "106", "105", "103"],
    Categoria: ["102", "106", "105", "101", "104", "103"],
    Valor: ["103", "106", "102", "105", "101", "104"],
    Saldo: ["102", "103", "106", "105", "101", "104"],
    Emissão: ["101", "102", "103", "104", "105", "106"],
    Vencimento: ["102", "101", "106", "103", "104", "105"],
    Situação: ["103", "102", "101", "104", "105", "106"],
  };

  it("a tela abre ordenada por vencimento, do mais antigo para o mais novo", async () => {
    await montar();

    expect(idsNaTela()).toEqual(CRESCENTE.Vencimento);
  });

  it.each(Object.keys(DECRESCENTE))(
    "por %s: primeiro clique decrescente, segundo crescente, terceiro decrescente",
    async (coluna) => {
      await montar();

      await ordenarPor(coluna);
      expect(idsNaTela()).toEqual(DECRESCENTE[coluna]);

      await ordenarPor(coluna);
      expect(idsNaTela()).toEqual(CRESCENTE[coluna]);

      await ordenarPor(coluna);
      expect(idsNaTela()).toEqual(DECRESCENTE[coluna]);
    },
  );

  it("trocar de coluna sempre recomeça em decrescente", async () => {
    await montar();

    await ordenarPor("Valor");
    await ordenarPor("Valor"); // Valor está em crescente
    expect(idsNaTela()).toEqual(CRESCENTE.Valor);

    await ordenarPor("Fornecedor");
    expect(idsNaTela()).toEqual(DECRESCENTE.Fornecedor);
  });

  it("o comparador devolve 0 no empate, então o bloco empatado sai na ordem da API", async () => {
    // Aqui — ao contrário de Locação e Usuários antes do conserto — o
    // comparador JÁ devolve 0: a subtração dos números e o `localeCompare`
    // das strings devolvem 0 no empate, e o `sort` é estável. As duas
    // direções entregam a mesma sequência quando tudo empata.
    const iguais = [1, 2, 3].map((n) =>
      conta({
        id: n,
        id_tiny: n,
        cliente_nome: "Zeta",
        categoria: "Unica",
        valor: "100.00",
        saldo: "100.00",
        data_emissao: "2026-01-05",
        vencimento: "2026-02-05",
        situacao: "pendente",
      }),
    );
    await montar(iguais);

    await ordenarPor("Valor");
    expect(idsNaTela()).toEqual(["1", "2", "3"]);
    await ordenarPor("Valor");
    expect(idsNaTela()).toEqual(["1", "2", "3"]);

    await ordenarPor("Fornecedor");
    expect(idsNaTela()).toEqual(["1", "2", "3"]);
    await ordenarPor("Fornecedor");
    expect(idsNaTela()).toEqual(["1", "2", "3"]);
  });

  it("campo nulo vira string vazia e vai para o começo do crescente", async () => {
    await montar([
      conta({ id: 1, id_tiny: 1, categoria: "Beta", vencimento: "2026-12-01" }),
      conta({ id: 2, id_tiny: 2, categoria: null, vencimento: "2026-12-02" }),
      conta({ id: 3, id_tiny: 3, categoria: "Alfa", vencimento: "2026-12-03" }),
    ]);

    await ordenarPor("Categoria"); // decrescente
    expect(idsNaTela()).toEqual(["1", "3", "2"]);
    await ordenarPor("Categoria"); // crescente
    expect(idsNaTela()).toEqual(["2", "3", "1"]);
  });

  it("a ordenação vale sobre o que a busca e o filtro deixaram", async () => {
    await montar();
    await selecionar("Categoria", "Material", "Energia");
    await ordenarPor("Valor");

    expect(idsNaTela()).toEqual(["104", "101", "102", "106"]);

    await buscar("luz");
    expect(idsNaTela()).toEqual(["102", "106"]);
  });

  it("a seta só aparece na coluna que está ordenando", async () => {
    await montar();

    const setas = () =>
      screen
        .getAllByRole("columnheader")
        .filter((c) => c.querySelector("svg") !== null)
        .map((c) => texto(c));

    expect(setas()).toEqual(["Vencimento"]);
    await ordenarPor("Valor");
    expect(setas()).toEqual(["Valor"]);
  });
});

describe("Contas a Pagar — paginação", () => {
  it("mostra 15 linhas por página e guarda o resto na segunda", async () => {
    await montar(DEZESSETE);

    expect(linhasDaTabela()).toHaveLength(15);
    expect(
      screen.getByText("Mostrando 1 a 15 de 17 registros"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await assentar();
    expect(linhasDaTabela()).toHaveLength(2);
    expect(
      screen.getByText("Mostrando 16 a 17 de 17 registros"),
    ).toBeInTheDocument();
  });

  it("com uma página só, a contagem continua na tela e os botões travam", async () => {
    // A frase "Mostrando..." morava dentro do bloco que só existe com duas
    // páginas ou mais: com 15 contas ou menos ninguém lia contagem nenhuma
    // (defeito 1.7). O `Pagination` do design system mostra sempre.
    await montar(CONTAS);

    expect(
      screen.getByText("Mostrando 1 a 6 de 6 registros"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
  });

  it("Anterior e Próxima ficam desabilitados nas pontas", async () => {
    await montar(DEZESSETE);

    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await assentar();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
  });

  it("dá para pular direto pelo número da página", async () => {
    await montar(DEZESSETE);

    fireEvent.click(screen.getAllByRole("button", { name: "2" })[0]);
    await assentar();
    expect(linhasDaTabela()).toHaveLength(2);
  });

  it("filtrar estando na página 2 volta para a página 1, sem deixar a tabela órfã", async () => {
    await montar(DEZESSETE);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await assentar();
    expect(linhasDaTabela()).toHaveLength(2);

    await selecionar("Situação", "pendente");
    expect(linhasDaTabela()).toHaveLength(15);
    expect(
      screen.getByText("Mostrando 1 a 15 de 17 registros"),
    ).toBeInTheDocument();
  });

  it("buscar estando na página 2 também volta para a página 1", async () => {
    await montar(DEZESSETE);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await assentar();

    await buscar("Fornecedor 1");
    // "Fornecedor 10".."Fornecedor 17" = 8 linhas, cabem na página 1.
    expect(linhasDaTabela()).toHaveLength(8);
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 1 a 8 de 8 registros",
    );
  });

  it("ordenar estando na página 2 volta para a página 1", async () => {
    // A ordenação era o único handler que não chamava `setPagina(1)`: quem
    // estava na página 2 continuava na 2, agora de uma lista reordenada.
    await montar(DEZESSETE);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await assentar();
    expect(idsNaTela()[0]).toBe("916");

    await ordenarPor("ID Tiny");
    expect(idsNaTela()[0]).toBe("917");
    expect(linhasDaTabela()).toHaveLength(15);
  });

  it("mexer no período também volta para a página 1", async () => {
    await montar(DEZESSETE);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await assentar();

    await escolherPreset("anoAtual");
    expect(
      screen.getByText("Mostrando 1 a 15 de 17 registros"),
    ).toBeInTheDocument();
  });

  it("a exportação leva a lista inteira, não só a página que está na tela", async () => {
    await montar(DEZESSETE);
    await exportar();

    expect(planilha.linhas).toHaveLength(17);
  });
});

describe("Contas a Pagar — gráfico de evolução", () => {
  it("com um ano só na base, agrupa por mês e diz o ano no título", async () => {
    await montar();

    expect(tituloDaEvolucao()).toBe("Evolução Mensal — 2026");
    expect(evolucao()).toHaveLength(12);
    expect(evolucao()[0].label).toBe("Jan");
    expect(evolucao()[11].label).toBe("Dez");
    expect(mesesComValor()).toEqual([
      // Jan: 102 quitada (500 saíram) e 101 intocada (saldo 1000).
      { label: "Jan", pago: 500, aberto: 1000 },
      // Fev: 103 (300 em aberto) + 104, que está em aberto mas já teve 500
      // pagos e 1500 por pagar — ela entra nas duas barras.
      { label: "Fev", pago: 500, aberto: 1800 },
      // Mar: 105 (700) + 106 (400,50), nenhuma com pagamento parcial.
      { label: "Mar", pago: 0, aberto: 1100.5 },
    ]);
  });

  it("o mês do gráfico vem da EMISSÃO, não do vencimento", async () => {
    await montar([
      conta({
        id: 1,
        data_emissao: "2026-01-31",
        vencimento: "2026-07-31",
        valor: "100.00",
        saldo: "100.00",
        situacao: "pendente",
      }),
    ]);

    expect(mesesComValor()).toEqual([{ label: "Jan", pago: 0, aberto: 100 }]);
  });

  it("com mais de um ano, troca para anual e ordena os anos crescendo", async () => {
    await montar(CONTAS_DOIS_ANOS);

    expect(tituloDaEvolucao()).toBe("Evolução Anual");
    expect(evolucao()).toEqual([
      // 2025: a 202 está paga mas com saldo 150 sobrando, então só os 50 que
      // de fato saíram entram; a 201 continua inteira em aberto (saldo 100).
      { label: "2025", pago: 50, aberto: 100 },
      { label: "2026", pago: 0, aberto: 400 },
    ]);
  });

  it("o gráfico anual soma a MESMA base dos KPIs, e fecha com eles", async () => {
    // A conta 202 tem valor 200 e saldo 150: entrava como 200 no "pago"
    // porque estava marcada como paga, e os 150 sobrando não apareciam em
    // lugar nenhum (defeito 1.1). Agora ela entra pelos 50 que saíram.
    await montar(CONTAS_DOIS_ANOS);

    expect(evolucao()[0]).toEqual({ label: "2025", pago: 50, aberto: 100 });
    expect(kpi("Total Pago")).toBe("R$ 50,00");
    expect(kpi("Total em Aberto")).toBe("R$ 500,00");
    const somaDoGrafico = evolucao().reduce((t, p) => t + p.pago + p.aberto, 0);
    expect(somaDoGrafico).toBe(550);
  });

  it("clicar numa barra do modo mensal filtra o mês inteiro daquele ano", async () => {
    await montar();
    await clicarNaBarra("Fev");

    expect(campoData("Data Início")).toHaveValue("2026-02-01");
    expect(campoData("Data Fim")).toHaveValue("2026-02-28"); // 2026 não é bissexto
    expect(seletorDePreset()).toHaveValue("custom");
    expect(idsNaTela()).toEqual(["103", "104"]);
  });

  it("o último dia do mês é calculado, não chutado em 30", async () => {
    await montar();

    await clicarNaBarra("Jan");
    expect(campoData("Data Fim")).toHaveValue("2026-01-31");

    await clicarNaBarra("Abr");
    expect(campoData("Data Fim")).toHaveValue("2026-04-30");
  });

  it("clicar numa barra do modo anual filtra o ano inteiro — e o gráfico vira mensal", async () => {
    await montar(CONTAS_DOIS_ANOS);
    await clicarNaBarra("2025");

    expect(campoData("Data Início")).toHaveValue("2025-01-01");
    expect(campoData("Data Fim")).toHaveValue("2025-12-31");
    expect(seletorDePreset()).toHaveValue("custom");
    expect(idsNaTela()).toEqual(["201", "202"]);
    expect(tituloDaEvolucao()).toBe("Evolução Mensal — 2025");
  });

  it("clicar num mês sem nada esvazia a tabela em vez de não fazer nada", async () => {
    await montar();
    await clicarNaBarra("Set");

    expect(campoData("Data Início")).toHaveValue("2026-09-01");
    expect(campoData("Data Fim")).toHaveValue("2026-09-30");
    expect(screen.getByText("Nenhuma conta encontrada.")).toBeInTheDocument();
    expect(kpi("Total em Aberto")).toBe("R$ 0,00");
  });

  it("clicar na barra estando na página 2 volta para a página 1", async () => {
    await montar(DEZESSETE);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await assentar();

    await clicarNaBarra("Mar");
    expect(
      screen.getByText("Mostrando 1 a 15 de 17 registros"),
    ).toBeInTheDocument();
  });

  it("o gráfico segue os filtros", async () => {
    await montar();
    await selecionar("Categoria", "Energia");

    expect(mesesComValor()).toEqual([
      { label: "Jan", pago: 500, aberto: 0 },
      { label: "Mar", pago: 0, aberto: 400.5 },
    ]);
  });
});

describe("Contas a Pagar — gráficos de categoria e de fornecedores", () => {
  it("a pizza agrupa a categoria pelo VALOR e ordena do maior para o menor", async () => {
    await montar();

    expect(categorias()).toEqual([
      { name: "Material", value: 3000 }, // 1000 + 2000
      { name: "Energia", value: 900.5 }, // 500 + 400,50
      { name: "Frete", value: 700 },
      { name: "Serviços", value: 300 },
    ]);
  });

  it("a pizza soma o valor cheio de uma conta em aberto quase paga", async () => {
    // Ela vale 1000 e falta 1: os 999 já pagos mais o 1 que falta dão os
    // 1000 da fatia — a mesma soma dos dois KPIs do topo.
    await montar([
      conta({
        id: 1,
        categoria: "Material",
        valor: "1000.00",
        saldo: "1.00",
        situacao: "pendente",
      }),
    ]);

    expect(categorias()).toEqual([{ name: "Material", value: 1000 }]);
    expect(kpi("Total em Aberto")).toBe("R$ 1,00");
    expect(kpi("Total Pago")).toBe("R$ 999,00");
  });

  it("a pizza e o top de fornecedores FECHAM com o painel de KPIs", async () => {
    // Os gráficos somavam sempre `valor_numero` e o painel somava outra
    // coisa: o topo da tela e o gráfico logo abaixo não batiam, e nada
    // avisava (defeito 1.1). Uma conta marcada como paga com saldo sobrando
    // é o caso em que os dois discordavam.
    await montar([
      conta({
        id: 1,
        categoria: "Material",
        cliente_nome: "Alfa",
        valor: "1000.00",
        saldo: "300.00",
        situacao: "pago",
      }),
      conta({
        id: 2,
        categoria: "Frete",
        cliente_nome: "Beta",
        valor: "500.00",
        saldo: "500.00",
        situacao: "pendente",
      }),
    ]);

    expect(categorias()).toEqual([
      { name: "Material", value: 700 },
      { name: "Frete", value: 500 },
    ]);
    expect(fornecedores()).toEqual([
      { nome: "Alfa", valor: 700 },
      { nome: "Beta", valor: 500 },
    ]);
    expect(kpi("Total Pago")).toBe("R$ 700,00");
    expect(kpi("Total em Aberto")).toBe("R$ 500,00");
    expect(kpi("Média Mensal Faturada")).toBe("R$ 1.200,00");
  });

  it("categoria nula e categoria vazia são a MESMA fatia: 'Sem categoria'", async () => {
    // MUDOU em 2026-09-09, de propósito. Enquanto a pizza era montada no
    // navegador, `null` virava "Sem categoria" e `""` virava uma fatia com
    // rótulo vazio — duas fatias para a mesma ausência, e uma delas sem nome
    // na legenda. O SQL apara e junta as duas (`NULLIF(trim(categoria), '')`),
    // que é também o que faz a opção do filtro alcançar a linha gravada com
    // espaço sobrando.
    await montar([
      conta({ id: 1, categoria: null, valor: "10.00" }),
      conta({ id: 2, categoria: "", valor: "20.00" }),
    ]);

    expect(categorias()).toEqual([{ name: "Sem categoria", value: 30 }]);
  });

  it("a pizza mostra 8 fatias: as 7 maiores e uma de Outros com o resto", async () => {
    // Antes cortava na oitava e o resto sumia do gráfico, com o percentual
    // das oito calculado sobre um total que não era o total.
    await montar(
      Array.from({ length: 10 }, (_, i) =>
        conta({
          id: i + 1,
          categoria: `Cat ${i}`,
          valor: String((i + 1) * 10),
        }),
      ),
    );

    expect(categorias()).toHaveLength(8);
    expect(categorias()[0]).toEqual({ name: "Cat 9", value: 100 });
    expect(categorias()[6]).toEqual({ name: "Cat 3", value: 40 });
    // Cat 2 + Cat 1 + Cat 0 = 30 + 20 + 10.
    expect(categorias()[7]).toEqual({ name: "Outros", value: 60 });
    const soma = categorias().reduce((total, fatia) => total + fatia.value, 0);
    expect(soma).toBe(550);
  });

  it("o top de fornecedores agrupa pelo VALOR e ordena do maior para o menor", async () => {
    await montar();

    expect(fornecedores()).toEqual([
      { nome: "Alfa Papelaria", valor: 3000 },
      { nome: "Beta Energia", valor: 900.5 },
      { nome: "Delta Transportes", valor: 700 },
      { nome: "Gama Serviços", valor: 300 },
    ]);
  });

  it("o top de fornecedores para em 10, os 10 maiores", async () => {
    await montar(
      Array.from({ length: 12 }, (_, i) =>
        conta({
          id: i + 1,
          cliente_nome: `F${String(i).padStart(2, "0")}`,
          valor: String((i + 1) * 10),
        }),
      ),
    );

    expect(fornecedores()).toHaveLength(10);
    expect(fornecedores()[0]).toEqual({ nome: "F11", valor: 120 });
    expect(fornecedores()[9]).toEqual({ nome: "F02", valor: 30 });
  });

  it("os dois gráficos seguem os filtros, e ignoram a busca da tabela", async () => {
    await montar();

    await buscar("Alfa");
    expect(categorias()).toHaveLength(4);
    expect(fornecedores()).toHaveLength(4);

    await buscar("");
    await selecionar("Fornecedor", "Alfa Papelaria");
    expect(categorias()).toEqual([{ name: "Material", value: 3000 }]);
    expect(fornecedores()).toEqual([{ nome: "Alfa Papelaria", valor: 3000 }]);
  });
});

describe("Contas a Pagar — exportação para Excel", () => {
  it("exporta dezesseis colunas, com estes rótulos e nesta ordem, na aba Contas a Pagar", async () => {
    await montar();
    await exportar();

    expect(Object.keys(planilha.linhas[0])).toEqual([
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
    ]);
    expect(planilha.aba).toBe("Contas a Pagar");
  });

  it("cada célula sai com o valor exato — número cru no dinheiro, dd/mm/aaaa nas datas", async () => {
    await montar([CONTAS[1]]);
    await exportar();

    expect(planilha.linhas).toEqual([
      {
        "ID Tiny": 102,
        Fornecedor: "Beta Energia",
        CPF_CNPJ: "22.222.222/0001-22",
        Categoria: "Energia",
        "Nº Documento": "NF-002",
        Histórico: "Conta de luz de janeiro",
        Valor: 500,
        Saldo: 0,
        Emissão: "20/01/2026",
        Vencimento: "25/01/2026",
        Liquidação: "24/01/2026",
        Situação: "pago",
        Vencida: "Não",
        Ocorrência: "U",
        Cidade: "Olinda",
        UF: "PE",
      },
    ]);
  });

  it("as datas da planilha são o dia que a API escreveu, em qualquer fuso", async () => {
    // `dataDeCalendario` lê a string e não passa por `Date` nenhum, então
    // não há o clássico "planilha um dia antes" aqui. Roda igual em TZ=UTC
    // e em TZ=America/Sao_Paulo.
    await montar([
      conta({
        id: 1,
        data_emissao: "2026-01-01",
        vencimento: "2026-12-31",
        liquidacao: "2026-07-10",
      }),
    ]);
    await exportar();

    expect(planilha.linhas[0]["Emissão"]).toBe("01/01/2026");
    expect(planilha.linhas[0]["Vencimento"]).toBe("31/12/2026");
    expect(planilha.linhas[0]["Liquidação"]).toBe("10/07/2026");
  });

  it("campo de texto ausente vira string vazia, e data ausente vira o travessão", async () => {
    // O traço da planilha era o hífen "-", enquanto o resto do sistema
    // (`dataDeCalendario`) usa o travessão "—". Agora é o mesmo caractere
    // porque é a mesma função.
    await montar([conta({ id: 1, vencimento: "2026-12-01" })]);
    await exportar();

    expect(planilha.linhas[0]).toMatchObject({
      CPF_CNPJ: "",
      Categoria: "",
      "Nº Documento": "",
      Histórico: "",
      Liquidação: "—",
      Situação: "",
      Vencida: "Não",
      Cidade: "",
      UF: "",
    });
  });

  it("na planilha a Situação é a real, e o vencimento vira a coluna Vencida", async () => {
    // Antes as duas vencidas saíam com "Vencida" na `Situação` e ninguém
    // mais distinguia uma "pendente" vencida de uma "aberto" vencida.
    await montar([
      CONTAS[0], // pendente, vencida
      conta({
        id: 9,
        id_tiny: 109,
        vencimento: "2026-01-05",
        situacao: "aberto",
      }), // vencida
      CONTAS[2], // aberto, vence hoje -> não vencida
    ]);
    await exportar();

    expect(planilha.linhas.map((l) => l["Situação"])).toEqual([
      "aberto",
      "pendente",
      "aberto",
    ]);
    expect(planilha.linhas.map((l) => l["Vencida"])).toEqual([
      "Sim",
      "Sim",
      "Não",
    ]);
  });

  it("exporta o que está filtrado, buscado e na ordem escolhida", async () => {
    await montar();
    await selecionar("Categoria", "Material");
    await ordenarPor("Valor"); // decrescente

    await exportar();
    expect(planilha.linhas.map((l) => l["Nº Documento"])).toEqual([
      "NF-004",
      "NF-001",
    ]);

    // "papel" sozinho casaria também com o fornecedor "Alfa Papelaria";
    // "papel a4" só existe no histórico da NF-001.
    await buscar("papel a4");
    await exportar();
    expect(planilha.linhas.map((l) => l["Nº Documento"])).toEqual(["NF-001"]);
  });

  it("sem nada para exportar, o botão fica desabilitado", async () => {
    // Antes o clique passava e escrevia um arquivo sem nenhuma linha.
    await montar([]);

    expect(
      screen.getByRole("button", { name: /exportar excel/i }),
    ).toBeDisabled();
  });

  it("o arquivo se chama contas_a_pagar_ mais a data LOCAL de hoje", async () => {
    await montar();
    await exportar();

    expect(planilha.arquivo).toBe("contas_a_pagar_2026-03-15.xlsx");
  });

  it("na virada do dia o nome leva a data de quem exporta, e não a de Greenwich", async () => {
    // 15/03 às 02h em Greenwich ainda é 14/03 às 23h em Brasília.
    vi.setSystemTime(new Date("2026-03-15T02:00:00Z"));
    await montar();
    await exportar();

    expect(planilha.arquivo).toBe(
      new Date().getTimezoneOffset() > 0
        ? "contas_a_pagar_2026-03-14.xlsx"
        : "contas_a_pagar_2026-03-15.xlsx",
    );
  });
});
