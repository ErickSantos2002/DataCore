import type { ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ContasReceber from "./ContasReceber";
import { AuthContext } from "../context/AuthContext";
import type { ContaReceber } from "../services/notasapi";
import { conferirAriaSort } from "../test/ordenacaoAcessivel";

/**
 * Teste de caracterização da tela de Contas a Receber.
 *
 * Fixa o comportamento que existe HOJE, antes da migração para o design
 * system. A tela é gêmea de Contas a Pagar (83% das linhas são iguais) e as
 * duas vão migrar em par: este arquivo é o que vai dizer, na hora de
 * unificar, quais diferenças entre elas são de propósito e quais são alguém
 * ter editado uma e esquecido a outra. Por isso ele desce ao número: cada
 * KPI tem a conta feita por fora, cada preset de período tem a data
 * concreta, cada célula da planilha tem o valor exato.
 *
 * Tudo é observado pela tela renderizada, nunca por função exportada de
 * propósito para o teste: assim o teste sobrevive a quebrar a página em
 * componentes, que é o passo seguinte. O que é do contexto
 * (`ContasReceberContext`) entra pelo provider de verdade, com só o serviço
 * mockado — porque `valor_numero`, `saldo_numero` e `vencida`, que a tela
 * inteira usa, nascem lá e não na tela.
 *
 * Onde o comportamento de hoje parece errado, o teste fixa o que a tela FAZ,
 * com um comentário marcando a suspeita. Quem decide se é defeito é o Erick.
 */

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
    campoDaEmissao: "data",
    quitadas: ["recebido", "pago"],
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

/**
 * Dublê do recharts.
 *
 * Em jsdom o `ResponsiveContainer` mede 0x0 e o recharts de verdade não
 * desenha barra nenhuma — não dá para ler o que o gráfico recebeu nem para
 * clicar numa barra. O dublê troca cada gráfico por uma LISTA com um item
 * por ponto, escrito como `chave=valor` na ordem em que a tela montou o
 * objeto. Assim o teste fixa o que interessa (o que agrupa, como ordena,
 * quantos itens mostra) sem depender de pixel.
 *
 * O clique devolve `{ activeLabel }`, que é o que o recharts entrega ao
 * `onClick` do `BarChart` — é o contrato que `handleClickEvolucao` lê.
 */
type DadoGrafico = Record<string, unknown>;
type PropsGrafico = {
  data?: DadoGrafico[];
  children?: ReactNode;
  onClick?: (estado: { activeLabel?: string }) => void;
};
vi.mock("recharts", () => {
  const semDesenho = () => null;
  const serie = (dado: DadoGrafico) =>
    Object.entries(dado)
      .map(([chave, valor]) => `${chave}=${String(valor)}`)
      .join(" ");
  const rotulo = (dado: DadoGrafico) => {
    const texto = Object.values(dado).find((v) => typeof v === "string");
    return typeof texto === "string" ? texto : undefined;
  };
  const Lista = ({ data = [], onClick }: PropsGrafico) => (
    <ul>
      {data.map((dado, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => onClick?.({ activeLabel: rotulo(dado) })}
          >
            {serie(dado)}
          </button>
        </li>
      ))}
    </ul>
  );
  return {
    ResponsiveContainer: ({ children }: PropsGrafico) => <div>{children}</div>,
    BarChart: ({ data, onClick, children }: PropsGrafico) => (
      <div>
        <Lista data={data} onClick={onClick} />
        {children}
      </div>
    ),
    PieChart: ({ children }: PropsGrafico) => <div>{children}</div>,
    Pie: ({ data }: PropsGrafico) => <Lista data={data} />,
    Bar: semDesenho,
    Cell: semDesenho,
    XAxis: semDesenho,
    YAxis: semDesenho,
    Tooltip: semDesenho,
    CartesianGrid: semDesenho,
    Legend: semDesenho,
  };
});

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

/** Conta com os campos que a tela lê; o resto do payload não importa aqui. */
function conta(campos: Partial<ContaReceber> & { id: number }): ContaReceber {
  return {
    id_tiny: campos.id,
    data: "2026-01-10",
    vencimento: "2026-01-20",
    competencia: null,
    valor: 0,
    saldo: 0,
    link_boleto: null,
    nro_documento: null,
    serie_documento: null,
    nro_banco: null,
    historico: null,
    categoria: null,
    forma_pagamento: null,
    portador: null,
    situacao: null,
    liquidacao: null,
    ocorrencia: "U",
    dia_vencimento: null,
    numero_parcelas: null,
    dia_vencimento_semanal: null,
    cliente_codigo: null,
    cliente_nome: "Cliente Sem Nome",
    cliente_tipo_pessoa: null,
    cliente_cpf_cnpj: null,
    cliente_ie: null,
    cliente_rg: null,
    cliente_endereco: null,
    cliente_numero: null,
    cliente_complemento: null,
    cliente_bairro: null,
    cliente_cep: null,
    cliente_cidade: null,
    cliente_uf: null,
    cliente_pais: null,
    cliente_fone: null,
    cliente_email: null,
    created_at: null,
    updated_at: null,
    ...campos,
  };
}

/**
 * O relógio de todos os testes: 31/08/2026, meio-dia em UTC.
 *
 * Meio-dia de propósito — em UTC e em America/Sao_Paulo (UTC-3) é o MESMO
 * dia de calendário, então nada aqui muda de resultado conforme o fuso. Os
 * casos em que a tela DEPENDE do fuso estão isolados no bloco "fuso", com o
 * relógio na virada do dia.
 */
const AGORA = new Date("2026-08-31T12:00:00Z");

/**
 * As seis contas de referência. Escolhidas para que cada KPI dê um número
 * conferido na mão e para que as oito ordenações da tabela produzam oito
 * sequências diferentes.
 *
 *  101 · recebido  · emissão 10/01 · vence 20/01 · valor 1000   · saldo 0
 *  102 · pago      · emissão 15/02 · vence 20/02 · valor 500,50 · saldo 0
 *  103 · pendente  · emissão 05/03 · vence 30/08 (ONTEM: vencida)
 *  104 · pendente  · emissão 01/08 · vence 31/08 (HOJE: não vencida)
 *  105 · aberto    · emissão 10/08 · vence 30/09 (hoje + 30 exatos)
 *  106 · aberto    · emissão 20/08 · vence 01/10 (hoje + 31: fora da janela)
 */
const CONTAS: ContaReceber[] = [
  conta({
    id: 101,
    data: "2026-01-10",
    vencimento: "2026-01-20",
    valor: "1000.00",
    saldo: "0",
    situacao: "recebido",
    categoria: "Serviços",
    cliente_nome: "Alfa Transportes",
    cliente_cpf_cnpj: "11.111.111/0001-11",
    nro_documento: "NF-001",
    historico: "Mensalidade janeiro",
    forma_pagamento: "Boleto",
    portador: "Banco Um",
    cliente_cidade: "Recife",
    cliente_uf: "PE",
    liquidacao: "2026-01-18",
  }),
  conta({
    id: 102,
    data: "2026-02-15",
    vencimento: "2026-02-20",
    valor: "500.50",
    saldo: "0",
    situacao: "pago",
    categoria: "Locação",
    cliente_nome: "Beta Mineração",
    nro_documento: "NF-002",
    historico: "Aluguel fevereiro",
  }),
  conta({
    id: 103,
    data: "2026-03-05",
    vencimento: "2026-08-30",
    valor: "300",
    saldo: "300",
    situacao: "pendente",
    categoria: "Serviços",
    cliente_nome: "Gama Energia",
    historico: "Contrato anual",
  }),
  conta({
    id: 104,
    data: "2026-08-01",
    vencimento: "2026-08-31",
    valor: "200",
    saldo: "200",
    situacao: "pendente",
    categoria: "Locação",
    cliente_nome: "Alfa Transportes",
  }),
  conta({
    id: 105,
    data: "2026-08-10",
    vencimento: "2026-09-30",
    valor: "400",
    saldo: "400",
    situacao: "aberto",
    categoria: "Produtos",
    cliente_nome: "Delta Ltda",
  }),
  conta({
    id: 106,
    data: "2026-08-20",
    vencimento: "2026-10-01",
    valor: "100",
    saldo: "100",
    situacao: "aberto",
    categoria: null,
    cliente_nome: "Delta Ltda",
  }),
];

async function montar(contas: ContaReceber[] = CONTAS) {
  servidor.contas = contas as never[];
  servidor.modo = "ok";
  const resultado = render(<ContasReceber />, { wrapper: Molde });
  await screen.findByRole("table");
  return resultado;
}

/** Texto de um elemento, com o espaço fino do `R$` virando espaço normal. */
function texto(elemento: Element | null | undefined): string {
  return (elemento?.textContent ?? "").replace(/\u00a0/g, " ").trim();
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

/** Linhas de DADO — sem o cabeçalho e sem a linha de "nenhuma conta". */
function linhasDaTabela(): HTMLElement[] {
  return within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .filter((linha) => within(linha).queryAllByRole("cell").length > 1);
}

/** A coluna "ID Tiny" de cada linha, na ordem em que a tela desenhou. */
function idsNaTela(): string[] {
  return linhasDaTabela().map((linha) =>
    texto(within(linha).getAllByRole("cell")[0]),
  );
}

/** O conteúdo das oito células de uma linha. */
function celulasDaLinha(linha: HTMLElement): string[] {
  return within(linha)
    .getAllByRole("cell")
    .map((celula) => texto(celula));
}

/**
 * O bloco de um filtro (rótulo + campo), achado pelo texto do `<label>`.
 *
 * Pelo rótulo e não por `getByLabelText` porque nenhum `<label>` da tela tem
 * `htmlFor`: o rótulo não está amarrado ao campo. Isso é achado para o
 * relatório — quem usa leitor de tela não sabe qual campo é qual — e o
 * seletor aqui é o mínimo que funciona sem mexer na tela.
 */
function blocoDoFiltro(rotulo: string): HTMLElement {
  const etiqueta = screen.getByText(rotulo, { selector: "label" });
  const bloco = etiqueta.parentElement;
  if (!bloco) throw new Error(`filtro "${rotulo}" não tem bloco`);
  return bloco;
}

async function abrirFiltro(rotulo: string) {
  fireEvent.click(within(blocoDoFiltro(rotulo)).getByRole("button"));
  await assentar();
}

/** Abre o multi-select e marca uma opção pelo texto dela. */
async function marcarOpcao(rotulo: string, opcao: string) {
  const bloco = blocoDoFiltro(rotulo);
  if (within(bloco).queryAllByRole("checkbox").length === 0)
    await abrirFiltro(rotulo);
  fireEvent.click(within(bloco).getByRole("checkbox", { name: opcao }));
  await assentar();
}

async function opcoesDoFiltro(rotulo: string): Promise<string[]> {
  const bloco = blocoDoFiltro(rotulo);
  if (within(bloco).queryAllByRole("checkbox").length === 0)
    await abrirFiltro(rotulo);
  return within(bloco)
    .getAllByRole("checkbox")
    .map((caixa) => texto(caixa.parentElement));
  await assentar();
}

function campoDeData(rotulo: string): HTMLInputElement {
  const campo = blocoDoFiltro(rotulo).querySelector("input");
  if (!campo) throw new Error(`filtro "${rotulo}" não tem campo de data`);
  return campo as HTMLInputElement;
}

async function preencherData(rotulo: string, valor: string) {
  fireEvent.change(campoDeData(rotulo), { target: { value: valor } });
  await assentar();
}

async function escolherPreset(valor: string) {
  fireEvent.change(
    within(blocoDoFiltro("Período Rápido")).getByRole("combobox"),
    {
      target: { value: valor },
    },
  );
  await assentar();
}

/**
 * O campo de busca DA TABELA — achado subindo do botão de exportar.
 *
 * Não dá para pedir por `getByPlaceholderText("Pesquisar...")`: cada
 * multi-select aberto põe um campo com o mesmo placeholder na tela.
 */
function campoDeBusca(): HTMLInputElement {
  const seletor = 'input[placeholder="Pesquisar..."]';
  let no: HTMLElement | null = screen.getByRole("button", {
    name: /exportar excel/i,
  }).parentElement;
  while (no && !no.querySelector(seletor)) no = no.parentElement;
  const campo = no?.querySelector(seletor);
  if (!campo) throw new Error("campo de busca da tabela não está na tela");
  return campo as HTMLInputElement;
}

async function buscar(termo: string) {
  fireEvent.change(campoDeBusca(), { target: { value: termo } });
  await assentar();
}

/** Clica no cabeçalho da coluna — no `<button>` de dentro quando existir. */
async function ordenarPor(coluna: string) {
  const cabecalho = screen
    .getAllByRole("columnheader")
    .find((celula) => texto(celula) === coluna);
  if (!cabecalho) throw new Error(`coluna "${coluna}" não existe na tabela`);
  fireEvent.click(cabecalho.querySelector("button") ?? cabecalho);
  await assentar();
}

/** O cartão de um gráfico: sobe do título até o ancestral que tem a lista. */
function cartaoDoGrafico(titulo: string | RegExp): HTMLElement {
  const cabecalho = screen.getByRole("heading", { name: titulo });
  let no: HTMLElement | null = cabecalho.parentElement;
  while (no && within(no).queryAllByRole("list").length === 0)
    no = no.parentElement;
  if (!no) throw new Error(`gráfico "${String(titulo)}" não está na tela`);
  return no;
}

function itensDoGrafico(titulo: string | RegExp): string[] {
  return within(cartaoDoGrafico(titulo))
    .getAllByRole("listitem")
    .map((item) => texto(item));
}

/** Clica na barra cujo rótulo do eixo X é `chave`. */
async function clicarNaBarra(titulo: string | RegExp, chave: string) {
  const barra = within(cartaoDoGrafico(titulo))
    .getAllByRole("button")
    .find((botao) => texto(botao).startsWith(`label=${chave} `));
  if (!barra) throw new Error(`barra "${chave}" não está no gráfico`);
  fireEvent.click(barra);
  await assentar();
}

async function exportar() {
  fireEvent.click(screen.getByRole("button", { name: /exportar excel/i }));
  await assentar();
}

/** Verdadeiro quando a suíte roda fora do UTC (TZ=America/Sao_Paulo). */
function foraDoUtcAgora(): boolean {
  return new Date().getTimezoneOffset() !== 0;
}

beforeEach(() => {
  // Só o `Date` é falsificado: os timers de verdade continuam correndo,
  // senão o `findBy...` do testing-library nunca resolve.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
  servidor.contas = [];
  servidor.modo = "ok";
  servidor.chamadas = 0;
  planilha.linhas = [];
  planilha.aba = "";
  planilha.arquivo = "";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Contas a Receber — carregamento e lista vazia", () => {
  it("mostra o aviso de carregando, e mais nada, enquanto a busca não volta", async () => {
    servidor.modo = "pendente";
    render(<ContasReceber />, { wrapper: Molde });

    expect(
      screen.getByText("Carregando contas a receber..."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Total a Receber")).not.toBeInTheDocument();
  });

  it("busca as contas uma vez só ao abrir a tela", async () => {
    await montar();

    expect(servidor.chamadas).toBe(1);
  });

  it("falha na busca avisa em bloco, e a tabela fica vazia", async () => {
    // O `catch` do contexto só escrevia no console: a tela abria zerada e
    // quem usava não distinguia "a API caiu" de "não há conta nenhuma"
    // (defeito 1.10). O aviso é um `Alert` no fluxo da página — estado
    // permanente até recarregar —, e não um toast que some em 4 segundos.
    const console_error = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    servidor.modo = "falha";
    render(<ContasReceber />, { wrapper: Molde });

    await screen.findByRole("table");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as contas a receber.",
    );
    expect(linhasDaTabela()).toHaveLength(0);
    console_error.mockRestore();
  });

  it("busca que dá certo não desenha aviso nenhum", async () => {
    await montar();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sem nenhuma conta, a tabela diz que está vazia", async () => {
    await montar([]);

    expect(linhasDaTabela()).toHaveLength(0);
    expect(screen.getByText("Nenhuma conta encontrada.")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((c) => texto(c))).toEqual([
      "ID Tiny",
      "Vencimento",
      "Emissão",
      "Cliente",
      "Categoria",
      "Valor",
      "Saldo",
      "Situação",
    ]);
  });

  it("sem conta nenhuma a paginação some inteira, em vez de dobrar a frase de vazio", async () => {
    // Empilhavam-se duas mensagens: "Nenhuma conta encontrada." da tabela e
    // "Nenhum resultado encontrado." do `Pagination`, mais Anterior/Próxima
    // desabilitados e um botão de página "1" que levava à mesma página vazia.
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
    // O de categoria e o de Top 10 não desenhavam nada e um eixo em branco,
    // respectivamente: moldura vazia dentro de cartão com título lê como
    // tela quebrada. A evolução continua desenhando — ela tem os 12 meses
    // zerados, então tem dado.
    await montar([]);

    expect(
      screen.getAllByText("Nenhuma conta para montar este gráfico."),
    ).toHaveLength(2);
    expect(itensDoGrafico(/Evolução/)).toHaveLength(12);
  });

  it("na falha de carregamento o gráfico usa a MESMA frase — a causa está no Alert", async () => {
    // Não há frase de erro dentro do gráfico: repetir "não foi possível
    // carregar" em cada cartão diria a mesma coisa mais duas vezes, e a
    // distinção já mora no `Alert` vermelho no topo da página.
    const console_error = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    servidor.modo = "falha";
    render(<ContasReceber />, { wrapper: Molde });
    await screen.findByRole("table");

    expect(
      screen.getAllByText("Nenhuma conta para montar este gráfico."),
    ).toHaveLength(2);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as contas a receber.",
    );
    console_error.mockRestore();
  });

  it("sem nenhuma conta, os cinco KPIs ficam zerados — inclusive a média", async () => {
    // `mesesComDados` é 0 e a média cai no ramo do zero em vez de virar NaN.
    await montar([]);

    expect(kpi("Total a Receber")).toBe("R$ 0,00");
    expect(kpi("Total Recebido")).toBe("R$ 0,00");
    expect(kpi("Contas Vencidas")).toBe("0");
    expect(kpi("A Vencer (30 dias)")).toBe("0");
    expect(kpi("Média Mensal Faturada")).toBe("R$ 0,00");
  });

  it("sem nenhuma conta, o gráfico cai no ano do relógio e desenha os 12 meses zerados", async () => {
    await montar([]);

    expect(
      screen.getByRole("heading", { name: "Evolução Mensal — 2026" }),
    ).toBeInTheDocument();
    expect(itensDoGrafico(/Evolução/)).toHaveLength(12);
    expect(itensDoGrafico(/Evolução/)[0]).toBe("label=Jan recebido=0 aberto=0");
  });

  it("sem nenhuma conta, o botão de exportar fica desabilitado", async () => {
    // Antes ele clicava e escrevia um arquivo sem linha nenhuma. A tela de
    // Locação já desabilitava nesse caso.
    await montar([]);

    expect(
      screen.getByRole("button", { name: /exportar excel/i }),
    ).toBeDisabled();
  });

  it("uma busca que não casa com nada também desabilita o exportar", async () => {
    // O botão olha o recorte inteiro, e não a página: filtrar até sobrar
    // zero linha é o mesmo caso de não ter conta nenhuma.
    await montar();
    expect(
      screen.getByRole("button", { name: /exportar excel/i }),
    ).toBeEnabled();

    await buscar("nao existe esse cliente");
    expect(linhasDaTabela()).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: /exportar excel/i }),
    ).toBeDisabled();

    await buscar("");
    expect(
      screen.getByRole("button", { name: /exportar excel/i }),
    ).toBeEnabled();
  });

  it("apresenta a tela e diz quem está logado", async () => {
    await montar();

    expect(
      screen.getByRole("heading", { name: "Contas a Receber", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("erick")).toBeInTheDocument();
    expect(screen.getByText(/\(admin\)/)).toBeInTheDocument();
  });
});

describe("Contas a Receber — KPIs", () => {
  it("os cinco KPIs, com a conta feita por fora", async () => {
    await montar();

    // Recebido = (valor − saldo) de TODAS: (1000-0) + (500,50-0) + 0 + 0 +
    // 0 + 0 = 1500,50
    expect(kpi("Total Recebido")).toBe("R$ 1.500,50");
    // A receber = SALDO das não quitadas: 300 + 200 + 400 + 100 = 1000
    expect(kpi("Total a Receber")).toBe("R$ 1.000,00");
    // Vencida = só a 103 (venceu 30/08, hoje é 31/08)
    expect(kpi("Contas Vencidas")).toBe("1");
    // A vencer = 104 (vence hoje) e 105 (vence no 30º dia)
    expect(kpi("A Vencer (30 dias)")).toBe("2");
    // Média faturada = (1000 + 1500,50) / 4 meses de emissão = 625,125.
    // E os dois somados são o faturado: 1000 + 500,50 + 300 + 200 + 400 +
    // 100 = 2500,50.
    expect(kpi("Média Mensal Faturada")).toBe("R$ 625,13");
  });

  it("o recebimento parcial de uma conta em aberto aparece no Total Recebido", async () => {
    // Antes uma nota de R$ 1.000 com R$ 750 já recebidos aparecia como
    // R$ 250 em "a receber" e os R$ 750 não apareciam em lugar nenhum: o
    // KPI de recebido só olhava as quitadas, e pelo valor cheio (defeito
    // 1.1).
    await montar([
      conta({ id: 1, valor: "1000", saldo: "250", situacao: "pendente" }),
      conta({ id: 2, valor: "800", saldo: "0", situacao: "recebido" }),
    ]);

    expect(kpi("Total a Receber")).toBe("R$ 250,00");
    expect(kpi("Total Recebido")).toBe("R$ 1.550,00");
    // Os dois somados são o faturado: 1000 + 800.
    expect(kpi("Média Mensal Faturada")).toBe("R$ 1.800,00");
  });

  it("vencida é ESTRITAMENTE antes de hoje: a que vence hoje não é vencida", async () => {
    await montar([
      conta({ id: 1, vencimento: "2026-08-30", situacao: "pendente" }),
      conta({ id: 2, vencimento: "2026-08-31", situacao: "pendente" }),
      conta({ id: 3, vencimento: "2026-09-01", situacao: "pendente" }),
    ]);

    expect(kpi("Contas Vencidas")).toBe("1");
  });

  it("uma conta paga com vencimento no passado não conta como vencida", async () => {
    await montar([
      conta({ id: 1, vencimento: "2020-01-01", situacao: "pago" }),
      conta({ id: 2, vencimento: "2020-01-01", situacao: "recebido" }),
      conta({ id: 3, vencimento: "2020-01-01", situacao: "pendente" }),
    ]);

    expect(kpi("Contas Vencidas")).toBe("1");
  });

  it("a vencer em 30 dias inclui HOJE e inclui o trigésimo dia, e para no 31º", async () => {
    // Hoje é 31/08/2026; hoje + 30 dias é 30/09/2026.
    await montar([
      conta({ id: 1, vencimento: "2026-08-30", situacao: "pendente" }),
      conta({ id: 2, vencimento: "2026-08-31", situacao: "pendente" }),
      conta({ id: 3, vencimento: "2026-09-30", situacao: "pendente" }),
      conta({ id: 4, vencimento: "2026-10-01", situacao: "pendente" }),
    ]);

    expect(kpi("A Vencer (30 dias)")).toBe("2");
  });

  it("a vencer em 30 dias ignora as já recebidas dentro da janela", async () => {
    await montar([
      conta({ id: 1, vencimento: "2026-09-10", situacao: "pendente" }),
      conta({ id: 2, vencimento: "2026-09-10", situacao: "recebido" }),
      conta({ id: 3, vencimento: "2026-09-10", situacao: "pago" }),
    ]);

    expect(kpi("A Vencer (30 dias)")).toBe("1");
  });

  it("a média mensal conta os meses distintos da EMISSÃO, não do vencimento", async () => {
    // Três contas emitidas no mesmo mês e vencendo em três meses diferentes:
    // um mês só, então a média é a soma inteira.
    await montar([
      conta({
        id: 1,
        data: "2026-05-01",
        vencimento: "2026-06-01",
        valor: "100",
        saldo: "100",
        situacao: "pendente",
      }),
      conta({
        id: 2,
        data: "2026-05-20",
        vencimento: "2026-07-01",
        valor: "200",
        saldo: "200",
        situacao: "pendente",
      }),
      conta({
        id: 3,
        data: "2026-05-31",
        vencimento: "2026-08-01",
        valor: "300",
        saldo: "300",
        situacao: "pendente",
      }),
    ]);

    expect(kpi("Média Mensal Faturada")).toBe("R$ 600,00");
  });

  it("a média mensal divide por mês do calendário, não por mês corrido", async () => {
    // 31/12 e 01/01 são meses distintos, mesmo com um dia de distância:
    // 600 / 2 = 300.
    await montar([
      conta({
        id: 1,
        data: "2025-12-31",
        valor: "300",
        saldo: "300",
        situacao: "pendente",
      }),
      conta({
        id: 2,
        data: "2026-01-01",
        valor: "300",
        saldo: "300",
        situacao: "pendente",
      }),
    ]);

    expect(kpi("Média Mensal Faturada")).toBe("R$ 300,00");
  });

  it("a média mensal faturada é o que a empresa faturou no mês, e não uma mistura", async () => {
    // O exemplo do levantamento: uma nota de R$ 1.000 com R$ 900 já
    // recebidos e uma nota de R$ 1.000 quitada, as duas emitidas em janeiro.
    // A tela mostrava R$ 1.100 — nem o faturado (R$ 2.000) nem o que entrou
    // (R$ 1.900), porque somava saldo com valor cheio (defeito 1.2).
    await montar([
      conta({
        id: 1,
        data: "2026-01-05",
        valor: "1000",
        saldo: "100",
        situacao: "pendente",
      }),
      conta({
        id: 2,
        data: "2026-01-06",
        valor: "1000",
        saldo: "0",
        situacao: "recebido",
      }),
    ]);

    expect(kpi("Total Recebido")).toBe("R$ 1.900,00");
    expect(kpi("Total a Receber")).toBe("R$ 100,00");
    expect(kpi("Média Mensal Faturada")).toBe("R$ 2.000,00");
  });

  it("os KPIs seguem os filtros", async () => {
    await montar();
    await marcarOpcao("Situação", "pendente");

    expect(kpi("Total a Receber")).toBe("R$ 500,00");
    expect(kpi("Total Recebido")).toBe("R$ 0,00");
    expect(kpi("Contas Vencidas")).toBe("1");
    expect(kpi("A Vencer (30 dias)")).toBe("1");
    // 500 / 2 meses de emissão (março e agosto) = 250
    expect(kpi("Média Mensal Faturada")).toBe("R$ 250,00");
  });

  it("os KPIs NÃO seguem a busca da tabela", async () => {
    // A busca só encolhe a tabela; os cinco KPIs continuam falando da base
    // filtrada inteira. É o comportamento de hoje.
    await montar();
    await buscar("gama");

    expect(idsNaTela()).toEqual(["103"]);
    expect(kpi("Total a Receber")).toBe("R$ 1.000,00");
    expect(kpi("Total Recebido")).toBe("R$ 1.500,50");
    expect(kpi("Contas Vencidas")).toBe("1");
  });
});

describe("Contas a Receber — situação", () => {
  it("recebido e pago valem a mesma coisa, em qualquer caixa", async () => {
    await montar([
      conta({ id: 1, valor: "100", saldo: "0", situacao: "recebido" }),
      conta({ id: 2, valor: "200", saldo: "0", situacao: "pago" }),
      conta({ id: 3, valor: "400", saldo: "0", situacao: "PAGO" }),
      conta({ id: 4, valor: "800", saldo: "0", situacao: "Recebido" }),
    ]);

    expect(kpi("Total Recebido")).toBe("R$ 1.500,00");
    expect(kpi("Total a Receber")).toBe("R$ 0,00");
  });

  it("a caixa alta vale para a conta mas não para o rótulo: a badge mostra o texto cru", async () => {
    await montar([
      conta({ id: 1, valor: "100", saldo: "0", situacao: "PAGO" }),
    ]);

    expect(kpi("Total Recebido")).toBe("R$ 100,00");
    expect(celulasDaLinha(linhasDaTabela()[0])[7]).toBe("PAGO");
  });

  it("situação desconhecida é tratada como conta em aberto", async () => {
    await montar([
      conta({
        id: 1,
        vencimento: "2026-12-01",
        valor: "900",
        saldo: "700",
        situacao: "cancelado",
      }),
    ]);

    expect(kpi("Total a Receber")).toBe("R$ 700,00");
    // Os 200 que já entraram contam mesmo com a situação desconhecida: o
    // recebido é `valor − saldo`, e não depende de a conta estar quitada.
    expect(kpi("Total Recebido")).toBe("R$ 200,00");
    expect(celulasDaLinha(linhasDaTabela()[0])[7]).toBe("cancelado");
  });

  it("situação vazia entra no aberto e mostra o travessão, igual à nula", async () => {
    // A badge de fallback mostrava `situacao ?? "-"`, e string vazia não é
    // nula: a célula ficava com uma pílula cinza sem texto nenhum dentro.
    await montar([
      conta({
        id: 1,
        vencimento: "2026-12-01",
        valor: "900",
        saldo: "700",
        situacao: "",
      }),
    ]);

    expect(kpi("Total a Receber")).toBe("R$ 700,00");
    expect(celulasDaLinha(linhasDaTabela()[0])[7]).toBe("-");
  });

  it("situação nula entra no aberto e mostra o travessão curto", async () => {
    await montar([
      conta({
        id: 1,
        vencimento: "2026-12-01",
        valor: "900",
        saldo: "700",
        situacao: null,
      }),
    ]);

    expect(kpi("Total a Receber")).toBe("R$ 700,00");
    expect(celulasDaLinha(linhasDaTabela()[0])[7]).toBe("-");
  });

  it("conta vencida mostra Vencida SEM apagar a situação de verdade", async () => {
    // A badge de vencida vinha antes da de pendente e escrevia só "Vencida":
    // depois do vencimento "pendente" e "aberto" viravam a mesma palavra na
    // tela. Agora "Vencida" é acréscimo, e não substituto.
    await montar([
      conta({ id: 1, vencimento: "2026-08-30", situacao: "pendente" }),
      conta({ id: 2, vencimento: "2026-08-30", situacao: "aberto" }),
      conta({ id: 3, vencimento: "2026-08-30", situacao: null }),
    ]);

    expect(celulasDaLinha(linhasDaTabela()[0])[7]).toBe("pendente · Vencida");
    expect(celulasDaLinha(linhasDaTabela()[1])[7]).toBe("aberto · Vencida");
    // Sem situação nenhuma vinda da API, sobra só o estado calculado.
    expect(celulasDaLinha(linhasDaTabela()[2])[7]).toBe("Vencida");
  });

  it("pendente e aberto ainda no prazo mostram o próprio texto", async () => {
    await montar([
      conta({ id: 1, vencimento: "2026-12-01", situacao: "pendente" }),
      conta({ id: 2, vencimento: "2026-12-01", situacao: "aberto" }),
    ]);

    expect(celulasDaLinha(linhasDaTabela()[0])[7]).toBe("pendente");
    expect(celulasDaLinha(linhasDaTabela()[1])[7]).toBe("aberto");
  });
});

describe("Contas a Receber — opções dos filtros", () => {
  it("as situações são as distintas da base, sem repetição e sem vazio", async () => {
    await montar();

    expect(await opcoesDoFiltro("Situação")).toEqual([
      "aberto",
      "pago",
      "pendente",
      "recebido",
    ]);
  });

  it("situação nula e vazia não viram opção — e a conta some de qualquer seleção", async () => {
    // Suspeita: o filtro compara `c.situacao ?? ""`, mas o "" foi tirado da
    // lista de opções. Uma conta sem situação não tem como ser filtrada: ela
    // só aparece quando o filtro está inteiramente vazio.
    await montar([
      conta({ id: 1, situacao: null }),
      conta({ id: 2, situacao: "" }),
      conta({ id: 3, situacao: "pendente" }),
    ]);

    expect(await opcoesDoFiltro("Situação")).toEqual(["pendente"]);
    await marcarOpcao("Situação", "pendente");
    expect(idsNaTela()).toEqual(["3"]);
  });

  it("as categorias são as distintas, na ordem do alfabeto brasileiro", async () => {
    // `.sort()` sem `localeCompare` ordenava por código UTF-16 e jogava
    // "Água" depois de "Zinco" na lista que a pessoa lê.
    await montar([
      conta({ id: 1, categoria: "Zinco" }),
      conta({ id: 2, categoria: "Água" }),
      conta({ id: 3, categoria: "Boletos" }),
      conta({ id: 4, categoria: "Boletos" }),
      conta({ id: 5, categoria: null }),
    ]);

    expect(await opcoesDoFiltro("Categoria")).toEqual([
      "Água",
      "Boletos",
      "Zinco",
    ]);
  });

  it("os clientes são os distintos, e o nome vazio NÃO vira opção", async () => {
    // A lista de clientes era a única que deixava o vazio passar: um cliente
    // sem nome virava uma opção clicável escrita "(vazio)", ao lado dos
    // cadastros de verdade. Agora as três listas tratam o vazio igual.
    await montar([
      conta({ id: 1, cliente_nome: "Zeta" }),
      conta({ id: 2, cliente_nome: "" }),
      conta({ id: 3, cliente_nome: "Alfa" }),
      conta({ id: 4, cliente_nome: "Alfa" }),
    ]);

    expect(await opcoesDoFiltro("Cliente")).toEqual(["Alfa", "Zeta"]);
  });

  it("as opções saem da base inteira, e não do que sobrou dos outros filtros", async () => {
    await montar();
    await marcarOpcao("Situação", "pendente");

    expect(idsNaTela()).toEqual(["103", "104"]);
    expect(await opcoesDoFiltro("Categoria")).toEqual([
      "Locação",
      "Produtos",
      "Serviços",
    ]);
  });
});

describe("Contas a Receber — cada filtro isolado", () => {
  it("situação: uma opção", async () => {
    await montar();
    await marcarOpcao("Situação", "aberto");

    expect(idsNaTela()).toEqual(["105", "106"]);
  });

  it("situação: duas opções somam (é OU, não E)", async () => {
    await montar();
    await marcarOpcao("Situação", "aberto");
    await marcarOpcao("Situação", "pago");

    expect(idsNaTela()).toEqual(["102", "105", "106"]);
  });

  it("o gatilho do multi-select se anuncia com o rótulo E com o que está escolhido", async () => {
    // O `<label>` era solto: quem usa leitor de tela ouvia só "Todas" e não
    // sabia de qual campo (defeito 1.14). `<label for>` no botão resolveria
    // metade e estragaria a outra — o nome viraria só "Situação" e sumiria o
    // estado. `aria-labelledby` com o rótulo e o valor anuncia os dois.
    await montar();
    expect(
      screen.getByRole("button", { name: "Situação Todas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Categoria Todas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cliente Todos" }),
    ).toBeInTheDocument();

    await marcarOpcao("Situação", "aberto");
    expect(
      screen.getByRole("button", { name: "Situação 1 selecionado(s)" }),
    ).toBeInTheDocument();
  });

  it("o botão do multi-select conta quantas opções estão marcadas", async () => {
    await montar();
    expect(texto(within(blocoDoFiltro("Situação")).getByRole("button"))).toBe(
      "Todas",
    );

    await marcarOpcao("Situação", "aberto");
    expect(
      texto(within(blocoDoFiltro("Situação")).getAllByRole("button")[0]),
    ).toBe("1 selecionado(s)");
  });

  it("Limpar seleção devolve a lista inteira", async () => {
    await montar();
    await marcarOpcao("Situação", "aberto");
    expect(idsNaTela()).toEqual(["105", "106"]);

    fireEvent.click(
      within(blocoDoFiltro("Situação")).getByRole("button", {
        name: "Limpar seleção",
      }),
    );
    await assentar();
    expect(idsNaTela()).toEqual(["101", "102", "103", "104", "105", "106"]);
  });

  it("a busca de dentro do multi-select filtra as opções sem diferenciar caixa", async () => {
    await montar();
    await abrirFiltro("Situação");
    fireEvent.change(
      within(blocoDoFiltro("Situação")).getByPlaceholderText("Pesquisar..."),
      { target: { value: "PEND" } },
    );
    await assentar();

    expect(await opcoesDoFiltro("Situação")).toEqual(["pendente"]);
  });

  it("categoria: uma opção — e a conta sem categoria fica de fora", async () => {
    await montar();
    await marcarOpcao("Categoria", "Serviços");

    expect(idsNaTela()).toEqual(["101", "103"]);
  });

  it("cliente: uma opção", async () => {
    await montar();
    await marcarOpcao("Cliente", "Alfa Transportes");

    expect(idsNaTela()).toEqual(["101", "104"]);
  });

  it("os três multi-selects juntos são interseção", async () => {
    await montar();
    await marcarOpcao("Situação", "pendente");
    await marcarOpcao("Categoria", "Locação");
    await marcarOpcao("Cliente", "Alfa Transportes");

    expect(idsNaTela()).toEqual(["104"]);
  });

  it("combinação sem nenhuma conta esvazia a tabela e zera os KPIs", async () => {
    await montar();
    await marcarOpcao("Situação", "recebido");
    await marcarOpcao("Categoria", "Produtos");

    expect(linhasDaTabela()).toHaveLength(0);
    expect(kpi("Total a Receber")).toBe("R$ 0,00");
    expect(kpi("Média Mensal Faturada")).toBe("R$ 0,00");
  });
});

describe("Contas a Receber — filtro por data", () => {
  it("as datas filtram pela EMISSÃO, não pelo vencimento", async () => {
    // A 103 vence em 30/08 mas foi emitida em 05/03: agosto não a pega.
    await montar();
    await preencherData("Data Início", "2026-08-01");
    await preencherData("Data Fim", "2026-08-31");

    expect(idsNaTela()).toEqual(["104", "105", "106"]);
  });

  it("as duas bordas são inclusivas", async () => {
    await montar();
    await preencherData("Data Início", "2026-02-15");
    await preencherData("Data Fim", "2026-03-05");

    expect(idsNaTela()).toEqual(["102", "103"]);
  });

  it("só a data de início já corta o começo", async () => {
    await montar();
    await preencherData("Data Início", "2026-08-01");

    expect(idsNaTela()).toEqual(["104", "105", "106"]);
  });

  it("só a data de fim já corta o fim", async () => {
    await montar();
    await preencherData("Data Fim", "2026-02-15");

    expect(idsNaTela()).toEqual(["101", "102"]);
  });

  it("mexer numa data joga o período rápido para Personalizado", async () => {
    await montar();
    await escolherPreset("mesAtual");
    await preencherData("Data Início", "2026-01-01");

    expect(
      (
        within(blocoDoFiltro("Período Rápido")).getByRole(
          "combobox",
        ) as HTMLSelectElement
      ).value,
    ).toBe("custom");
    // A data de fim que o preset tinha posto continua lá.
    expect(campoDeData("Data Fim").value).toBe("2026-08-31");
    expect(idsNaTela()).toEqual(["101", "102", "103", "104", "105", "106"]);
  });
});

describe("Contas a Receber — presets de período", () => {
  it("Todos deixa as duas datas em branco e não filtra nada", async () => {
    await montar();

    expect(campoDeData("Data Início").value).toBe("");
    expect(campoDeData("Data Fim").value).toBe("");
    expect(idsNaTela()).toHaveLength(6);
  });

  it("Últimos 7 dias vai de hoje-7 até hoje — 24/08 a 31/08 de 2026", async () => {
    await montar();
    await escolherPreset("7dias");

    expect(campoDeData("Data Início").value).toBe("2026-08-24");
    expect(campoDeData("Data Fim").value).toBe("2026-08-31");
    // Nenhuma emissão cai nessa janela — a mais recente (106) é de 20/08.
    expect(idsNaTela()).toEqual([]);
  });

  it("Últimos 30 dias vai de hoje-30 até hoje — 01/08 a 31/08 de 2026", async () => {
    await montar();
    await escolherPreset("30dias");

    expect(campoDeData("Data Início").value).toBe("2026-08-01");
    expect(campoDeData("Data Fim").value).toBe("2026-08-31");
    expect(idsNaTela()).toEqual(["104", "105", "106"]);
  });

  it("Mês atual vai do dia 1 ao último dia do mês — 01/08 a 31/08 de 2026", async () => {
    await montar();
    await escolherPreset("mesAtual");

    expect(campoDeData("Data Início").value).toBe("2026-08-01");
    expect(campoDeData("Data Fim").value).toBe("2026-08-31");
    expect(idsNaTela()).toEqual(["104", "105", "106"]);
  });

  it("Mês atual mostra o mês inteiro, inclusive o que foi emitido depois de hoje", async () => {
    // Com o relógio no dia 15, a conta emitida dia 20 continua no "mês
    // atual": o preset é o mês do calendário, não o pedaço já vivido dele.
    vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));
    await montar([
      conta({ id: 1, data: "2026-03-10" }),
      conta({ id: 2, data: "2026-03-20" }),
      conta({ id: 3, data: "2026-04-01" }),
    ]);
    await escolherPreset("mesAtual");

    expect(campoDeData("Data Início").value).toBe("2026-03-01");
    expect(campoDeData("Data Fim").value).toBe("2026-03-31");
    expect(idsNaTela()).toEqual(["1", "2"]);
  });

  it("Mês passado é o mês anterior inteiro — julho, com o relógio em agosto", async () => {
    // O preset que fecha o mês: quem olha o resultado de julho no dia 5 de
    // agosto não quer "últimos 30 dias", que arrasta os primeiros dias de
    // agosto para dentro da conta. As duas pontas do mês anterior, e nada fora
    // dele — por isso o 30/06 e o 01/08 ficam de fora.
    await montar([
      conta({ id: 1, data: "2026-06-30" }),
      conta({ id: 2, data: "2026-07-01" }),
      conta({ id: 3, data: "2026-07-31" }),
      conta({ id: 4, data: "2026-08-01" }),
    ]);
    await escolherPreset("mesPassado");

    expect(campoDeData("Data Início").value).toBe("2026-07-01");
    expect(campoDeData("Data Fim").value).toBe("2026-07-31");
    expect(idsNaTela()).toEqual(["2", "3"]);
  });

  it("Ano atual vai de 01/01 a 31/12 — o único preset que olha para a frente", async () => {
    await montar([
      conta({ id: 1, data: "2025-12-31" }),
      conta({ id: 2, data: "2026-01-01" }),
      conta({ id: 3, data: "2026-12-31" }),
      conta({ id: 4, data: "2027-01-01" }),
    ]);
    await escolherPreset("anoAtual");

    expect(campoDeData("Data Início").value).toBe("2026-01-01");
    expect(campoDeData("Data Fim").value).toBe("2026-12-31");
    expect(idsNaTela()).toEqual(["2", "3"]);
  });

  it("escolher Personalizado no select NÃO mexe nas datas que já estavam lá", async () => {
    await montar();
    await escolherPreset("anoAtual");
    await escolherPreset("custom");

    expect(campoDeData("Data Início").value).toBe("2026-01-01");
    expect(campoDeData("Data Fim").value).toBe("2026-12-31");
  });

  it("voltar para Todos limpa as datas que o preset anterior tinha posto", async () => {
    await montar();
    await escolherPreset("mesAtual");
    await escolherPreset("todos");

    expect(campoDeData("Data Início").value).toBe("");
    expect(campoDeData("Data Fim").value).toBe("");
    expect(idsNaTela()).toHaveLength(6);
  });
});

describe("Contas a Receber — fuso horário", () => {
  /** Verdadeiro quando a suíte está rodando fora do UTC (TZ=America/Sao_Paulo). */
  const foraDoUtc = () => new Date().getTimezoneOffset() !== 0;

  it("as datas da tabela são lidas da string e não andam com o fuso", async () => {
    // Este é o pedaço que a tela acerta: `formatarData` fatia a string em
    // "-" e nunca constrói um `Date`. O dia mostrado é o dia escrito, em
    // TZ=UTC e em TZ=America/Sao_Paulo.
    await montar([
      conta({ id: 1, data: "2026-01-01", vencimento: "2026-03-01" }),
    ]);

    expect(celulasDaLinha(linhasDaTabela()[0])[2]).toBe("01/01/2026");
    expect(celulasDaLinha(linhasDaTabela()[0])[1]).toBe("01/03/2026");
  });

  it("na virada do mês, as duas pontas do Mês atual saem do dia LOCAL", async () => {
    // 01/09 às 02h em Greenwich ainda é 31/08 às 23h em Brasília. Antes o
    // início vinha de `getFullYear`/`getMonth` (local) e o fim de
    // `toISOString` (UTC), e em Brasília o "mês atual" virava 01/08 a 01/09 —
    // um período que atravessava a virada. Agora o mês é o do relógio local.
    vi.setSystemTime(new Date("2026-09-01T02:00:00Z"));
    await montar();
    await escolherPreset("mesAtual");

    expect(campoDeData("Data Início").value).toBe(
      foraDoUtc() ? "2026-08-01" : "2026-09-01",
    );
    expect(campoDeData("Data Fim").value).toBe(
      foraDoUtc() ? "2026-08-31" : "2026-09-30",
    );
  });

  it("na virada do mês, o Últimos 30 dias conta os 30 dias a partir do dia LOCAL", async () => {
    // Em UTC são os 30 dias que terminam em 01/09; em Brasília, os 30 que
    // terminam em 31/08. As duas pontas andam juntas em cada fuso.
    vi.setSystemTime(new Date("2026-09-01T02:00:00Z"));
    await montar();
    await escolherPreset("30dias");

    expect(campoDeData("Data Início").value).toBe(
      foraDoUtc() ? "2026-08-01" : "2026-08-02",
    );
    expect(campoDeData("Data Fim").value).toBe(
      foraDoUtc() ? "2026-08-31" : "2026-09-01",
    );
  });

  it("na virada do ANO, o Ano atual é o ano local nas duas pontas", async () => {
    // 01/01/2026 às 02h em Greenwich ainda é 31/12/2025 em Brasília: lá o
    // "ano atual" é 2025 inteiro, aqui é 2026 inteiro. O que não pode é uma
    // ponta em 2025 e a outra em 2026, que era o que acontecia.
    vi.setSystemTime(new Date("2026-01-01T02:00:00Z"));
    await montar();
    await escolherPreset("anoAtual");

    expect(campoDeData("Data Início").value).toBe(
      foraDoUtc() ? "2025-01-01" : "2026-01-01",
    );
    expect(campoDeData("Data Fim").value).toBe(
      foraDoUtc() ? "2025-12-31" : "2026-12-31",
    );

    await escolherPreset("mesAtual");
    expect(campoDeData("Data Início").value).toBe(
      foraDoUtc() ? "2025-12-01" : "2026-01-01",
    );
    expect(campoDeData("Data Fim").value).toBe(
      foraDoUtc() ? "2025-12-31" : "2026-01-31",
    );
  });

  it("o que é vencido usa o dia LOCAL, e não o dia em UTC", async () => {
    // Mesmo instante do teste acima: em UTC já é 01/09 e a conta de 31/08
    // está vencida; em Brasília ainda é 31/08 e ela não está.
    vi.setSystemTime(new Date("2026-09-01T02:00:00Z"));
    await montar([
      conta({ id: 1, vencimento: "2026-08-31", situacao: "pendente" }),
    ]);

    expect(kpi("Contas Vencidas")).toBe(foraDoUtc() ? "0" : "1");
  });
});

describe("Contas a Receber — busca da tabela", () => {
  it("casa o nome do cliente sem diferenciar caixa", async () => {
    await montar();
    await buscar("aLFa tRANsportes");

    expect(idsNaTela()).toEqual(["101", "104"]);
  });

  it("casa a categoria", async () => {
    await montar();
    await buscar("produtos");

    expect(idsNaTela()).toEqual(["105"]);
  });

  it("casa o número do documento", async () => {
    await montar();
    await buscar("nf-002");

    expect(idsNaTela()).toEqual(["102"]);
  });

  it("casa o histórico", async () => {
    await montar();
    await buscar("contrato anual");

    expect(idsNaTela()).toEqual(["103"]);
  });

  it("ignora acento: mineracao acha Mineração, e vice-versa", async () => {
    // A busca só baixava a caixa. Quem digita sem acento — o normal em
    // teclado apressado — não achava o cliente.
    await montar();
    await buscar("mineração");
    expect(idsNaTela()).toEqual(["102"]);

    await buscar("mineracao");
    expect(idsNaTela()).toEqual(["102"]);

    // A categoria "Serviços" entra pela cedilha, no mesmo caminho.
    await buscar("servicos");
    expect(idsNaTela()).toEqual(["101", "103"]);
  });

  it("NÃO procura em situação, valor, saldo, id nem data", async () => {
    await montar();

    await buscar("recebido");
    expect(linhasDaTabela()).toHaveLength(0);

    await buscar("1000");
    expect(linhasDaTabela()).toHaveLength(0);

    await buscar("101");
    expect(linhasDaTabela()).toHaveLength(0);

    await buscar("2026-01-10");
    expect(linhasDaTabela()).toHaveLength(0);
  });

  it("casa pedaço no meio da palavra, não só o começo", async () => {
    await montar();
    await buscar("nergia");

    expect(idsNaTela()).toEqual(["103"]);
  });

  it("a busca soma ao filtro em vez de substituí-lo", async () => {
    await montar();
    await marcarOpcao("Categoria", "Serviços");
    await buscar("alfa");

    expect(idsNaTela()).toEqual(["101"]);
  });
});

describe("Contas a Receber — ordenação", () => {
  it("cada cabecalho diz ao leitor de tela a direcao da ordem", async () => {
    // O botão "Ordenar por" dentro do `<th>` mostrava a direção só na seta:
    // o leitor de tela não sabia se a coluna estava crescente, decrescente
    // ou fora de uso. Ver `src/test/ordenacaoAcessivel.ts`.
    await montar();
    conferirAriaSort("Valor");
  });

  it("a tabela abre ordenada por vencimento, do mais antigo para o mais novo", async () => {
    await montar();

    expect(idsNaTela()).toEqual(["101", "102", "103", "104", "105", "106"]);
  });

  it("o primeiro clique numa coluna ordena SEMPRE em ordem decrescente", async () => {
    // Inclusive na coluna que já estava ordenada: Vencimento abre crescente
    // e o primeiro clique inverte.
    await montar();
    await ordenarPor("Vencimento");

    expect(idsNaTela()).toEqual(["106", "105", "104", "103", "102", "101"]);
  });

  it("ID Tiny nos dois sentidos", async () => {
    await montar();
    await ordenarPor("ID Tiny");
    expect(idsNaTela()).toEqual(["106", "105", "104", "103", "102", "101"]);

    await ordenarPor("ID Tiny");
    expect(idsNaTela()).toEqual(["101", "102", "103", "104", "105", "106"]);
  });

  it("Cliente nos dois sentidos", async () => {
    await montar();
    await ordenarPor("Cliente");
    expect(idsNaTela()).toEqual(["103", "105", "106", "102", "101", "104"]);

    await ordenarPor("Cliente");
    expect(idsNaTela()).toEqual(["101", "104", "102", "105", "106", "103"]);
  });

  it("Categoria nos dois sentidos — a conta sem categoria vira string vazia", async () => {
    await montar();
    await ordenarPor("Categoria");
    expect(idsNaTela()).toEqual(["101", "103", "105", "102", "104", "106"]);

    await ordenarPor("Categoria");
    expect(idsNaTela()).toEqual(["106", "102", "104", "105", "101", "103"]);
  });

  it("Emissão nos dois sentidos", async () => {
    await montar();
    await ordenarPor("Emissão");
    expect(idsNaTela()).toEqual(["106", "105", "104", "103", "102", "101"]);

    await ordenarPor("Emissão");
    expect(idsNaTela()).toEqual(["101", "102", "103", "104", "105", "106"]);
  });

  it("Valor nos dois sentidos — comparação numérica, não alfabética", async () => {
    await montar();
    await ordenarPor("Valor");
    expect(idsNaTela()).toEqual(["101", "102", "105", "103", "104", "106"]);

    await ordenarPor("Valor");
    expect(idsNaTela()).toEqual(["106", "104", "103", "105", "102", "101"]);
  });

  it("Saldo nos dois sentidos", async () => {
    await montar();
    await ordenarPor("Saldo");
    expect(idsNaTela()).toEqual(["105", "103", "104", "106", "101", "102"]);

    await ordenarPor("Saldo");
    expect(idsNaTela()).toEqual(["101", "102", "106", "104", "103", "105"]);
  });

  it("Situação nos dois sentidos — pela string crua, não pela badge", async () => {
    // A tabela mostra "Vencida" na 103, mas a ordenação usa "pendente".
    await montar();
    await ordenarPor("Situação");
    expect(idsNaTela()).toEqual(["101", "103", "104", "102", "105", "106"]);

    await ordenarPor("Situação");
    expect(idsNaTela()).toEqual(["105", "106", "102", "103", "104", "101"]);
  });

  it("no empate, as duas direções devolvem a ordem que a API mandou", async () => {
    // O comparador devolve 0 no empate (tanto no ramo numérico quanto no
    // `localeCompare`) e o `sort` do JS é estável — então empate não
    // embaralha, nem sai invertido na ordem decrescente.
    await montar([
      conta({ id: 1, vencimento: "2026-05-01", valor: "100", saldo: "100" }),
      conta({ id: 2, vencimento: "2026-05-01", valor: "100", saldo: "100" }),
      conta({ id: 3, vencimento: "2026-05-01", valor: "100", saldo: "100" }),
    ]);

    await ordenarPor("Valor");
    expect(idsNaTela()).toEqual(["1", "2", "3"]);
    await ordenarPor("Valor");
    expect(idsNaTela()).toEqual(["1", "2", "3"]);

    await ordenarPor("Cliente");
    expect(idsNaTela()).toEqual(["1", "2", "3"]);
    await ordenarPor("Cliente");
    expect(idsNaTela()).toEqual(["1", "2", "3"]);
  });

  it("empate parcial não embaralha o grupo empatado", async () => {
    await montar([
      conta({ id: 1, cliente_nome: "Mesmo Cliente" }),
      conta({ id: 2, cliente_nome: "Mesmo Cliente" }),
      conta({ id: 3, cliente_nome: "Outro" }),
    ]);

    await ordenarPor("Cliente");
    expect(idsNaTela()).toEqual(["3", "1", "2"]);
    await ordenarPor("Cliente");
    expect(idsNaTela()).toEqual(["1", "2", "3"]);
  });

  it("a seta aparece só na coluna ordenada", async () => {
    await montar();
    const setas = () =>
      screen
        .getAllByRole("columnheader")
        .filter((c) => c.querySelector("svg"))
        .map((c) => texto(c));

    expect(setas()).toEqual(["Vencimento"]);
    await ordenarPor("Valor");
    expect(setas()).toEqual(["Valor"]);
  });

  it("a ordenação vale para a lista inteira, não só para a página aberta", async () => {
    await montar(paginado(20));
    await ordenarPor("ID Tiny");

    expect(idsNaTela()[0]).toBe("20");
  });
});

/** Vinte contas com vencimentos distintos, para os testes de paginação. */
function paginado(quantas: number): ContaReceber[] {
  return Array.from({ length: quantas }, (_, i) =>
    conta({
      id: i + 1,
      data: "2026-01-01",
      vencimento: `2026-01-${String(i + 1).padStart(2, "0")}`,
      valor: "10",
      saldo: "10",
      situacao: "pendente",
      cliente_nome: `Cliente ${String(i + 1).padStart(2, "0")}`,
    }),
  );
}

describe("Contas a Receber — paginação", () => {
  it("a página tem 15 linhas", async () => {
    await montar(paginado(20));

    expect(linhasDaTabela()).toHaveLength(15);
    expect(idsNaTela()[0]).toBe("1");
    expect(idsNaTela()[14]).toBe("15");
  });

  it("a frase de contagem fala da lista filtrada inteira", async () => {
    await montar(paginado(20));

    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 1 a 15 de 20 registros",
    );
  });

  it("a última página mostra o resto e a contagem acompanha", async () => {
    await montar(paginado(20));
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await assentar();

    expect(linhasDaTabela()).toHaveLength(5);
    expect(idsNaTela()).toEqual(["16", "17", "18", "19", "20"]);
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 16 a 20 de 20 registros",
    );
  });

  it("com uma página só, a frase de contagem aparece e os botões travam", async () => {
    // A frase morava dentro do bloco que só existe com duas páginas ou mais,
    // e quem tinha 15 contas ou menos não lia contagem nenhuma (defeito
    // 1.7). O `Pagination` do design system mostra sempre.
    await montar(paginado(15));

    expect(linhasDaTabela()).toHaveLength(15);
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 1 a 15 de 15 registros",
    );
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
  });

  it("com uma conta só, a contagem também aparece", async () => {
    await montar(paginado(1));

    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 1 a 1 de 1 registros",
    );
  });

  it("Anterior trava na primeira página e Próxima trava na última", async () => {
    await montar(paginado(20));
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await assentar();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
  });

  it("filtrar estando na página 2 volta para a página 1", async () => {
    await montar(paginado(20));
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await assentar();
    expect(idsNaTela()[0]).toBe("16");

    await buscar("Cliente 0");
    expect(idsNaTela()[0]).toBe("1");
    expect(linhasDaTabela()).toHaveLength(9);
  });

  it("ordenar estando na página 2 volta para a página 1", async () => {
    // Todo filtro chamava `setPagina(1)`, menos a ordenação: quem estava na
    // página 2 continuava na 2, agora de uma lista que já não é a mesma.
    await montar(paginado(20));
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await assentar();
    await ordenarPor("ID Tiny");

    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 1 a 15 de 20 registros",
    );
    expect(idsNaTela()[0]).toBe("20");
    expect(idsNaTela()[14]).toBe("6");
  });

  it("mostra no máximo cinco números de página, em janela deslizante", async () => {
    await montar(paginado(90));
    const numeros = () =>
      screen
        .getAllByRole("button")
        .map((b) => texto(b))
        .filter((t) => /^\d+$/.test(t));

    expect(numeros()).toEqual(["1", "2", "3", "4", "5"]);

    fireEvent.click(screen.getByRole("button", { name: "5" }));
    await assentar();
    expect(numeros()).toEqual(["2", "3", "4", "5", "6"]);
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      "Mostrando 61 a 75 de 90 registros",
    );
  });
});

describe("Contas a Receber — gráfico de evolução", () => {
  it("com um ano só na base, agrupa por MÊS e desenha os 12, inclusive os zerados", async () => {
    await montar();

    expect(
      screen.getByRole("heading", { name: "Evolução Mensal — 2026" }),
    ).toBeInTheDocument();
    expect(itensDoGrafico(/Evolução/)).toEqual([
      "label=Jan recebido=1000 aberto=0",
      "label=Fev recebido=500.5 aberto=0",
      "label=Mar recebido=0 aberto=300",
      "label=Abr recebido=0 aberto=0",
      "label=Mai recebido=0 aberto=0",
      "label=Jun recebido=0 aberto=0",
      "label=Jul recebido=0 aberto=0",
      "label=Ago recebido=0 aberto=700",
      "label=Set recebido=0 aberto=0",
      "label=Out recebido=0 aberto=0",
      "label=Nov recebido=0 aberto=0",
      "label=Dez recebido=0 aberto=0",
    ]);
  });

  it("o mês da barra é o da EMISSÃO, e o ano do título também", async () => {
    // A 103 vence em agosto e foi emitida em março: a barra é a de março.
    await montar([CONTAS[2]]);

    expect(
      screen.getByRole("heading", { name: "Evolução Mensal — 2026" }),
    ).toBeInTheDocument();
    expect(itensDoGrafico(/Evolução/)[2]).toBe(
      "label=Mar recebido=0 aberto=300",
    );
  });

  it("com dois anos na base, troca para ANUAL e ordena do mais antigo ao mais novo", async () => {
    await montar([
      conta({
        id: 1,
        data: "2026-05-01",
        valor: "100",
        saldo: "100",
        situacao: "pendente",
      }),
      conta({
        id: 2,
        data: "2024-05-01",
        valor: "700",
        saldo: "0",
        situacao: "recebido",
      }),
      conta({
        id: 3,
        data: "2025-05-01",
        valor: "300",
        saldo: "250",
        situacao: "pendente",
      }),
    ]);

    expect(
      screen.getByRole("heading", { name: "Evolução Anual" }),
    ).toBeInTheDocument();
    // 2025 tem uma conta em aberto de 300 com 50 já recebidos: ela aparece
    // nas duas barras do ano.
    expect(itensDoGrafico(/Evolução/)).toEqual([
      "label=2024 recebido=700 aberto=0",
      "label=2025 recebido=50 aberto=250",
      "label=2026 recebido=0 aberto=100",
    ]);
  });

  it("no modo anual só aparece ano que tem conta — não há barra vazia no meio", async () => {
    await montar([
      conta({
        id: 1,
        data: "2020-01-01",
        valor: "10",
        saldo: "10",
        situacao: "pendente",
      }),
      conta({
        id: 2,
        data: "2026-01-01",
        valor: "20",
        saldo: "20",
        situacao: "pendente",
      }),
    ]);

    expect(itensDoGrafico(/Evolução/)).toEqual([
      "label=2020 recebido=0 aberto=10",
      "label=2026 recebido=0 aberto=20",
    ]);
  });

  it("a barra separa o que entrou (valor − saldo) do que falta (saldo)", async () => {
    // A conta 1 está em aberto e já recebeu 600: ela entra nas DUAS barras.
    // Antes cada conta ia inteira para uma barra só — a quitada pelo valor
    // cheio, a em aberto pelo saldo — e os 600 sumiam do gráfico.
    await montar([
      conta({
        id: 1,
        data: "2026-01-05",
        valor: "1000",
        saldo: "400",
        situacao: "pendente",
      }),
      conta({
        id: 2,
        data: "2026-01-06",
        valor: "1000",
        saldo: "0",
        situacao: "recebido",
      }),
    ]);

    expect(itensDoGrafico(/Evolução/)[0]).toBe(
      "label=Jan recebido=1600 aberto=400",
    );
    // E as duas barras somadas dão os dois KPIs do topo.
    expect(kpi("Total Recebido")).toBe("R$ 1.600,00");
    expect(kpi("Total a Receber")).toBe("R$ 400,00");
  });

  it("clicar numa barra mensal filtra o mês inteiro e vira Personalizado", async () => {
    await montar();
    await clicarNaBarra(/Evolução/, "Ago");

    expect(campoDeData("Data Início").value).toBe("2026-08-01");
    expect(campoDeData("Data Fim").value).toBe("2026-08-31");
    expect(
      (
        within(blocoDoFiltro("Período Rápido")).getByRole(
          "combobox",
        ) as HTMLSelectElement
      ).value,
    ).toBe("custom");
    expect(idsNaTela()).toEqual(["104", "105", "106"]);
  });

  it("o clique acerta o último dia de mês curto — fevereiro de 2026 tem 28", async () => {
    await montar();
    await clicarNaBarra(/Evolução/, "Fev");

    expect(campoDeData("Data Início").value).toBe("2026-02-01");
    expect(campoDeData("Data Fim").value).toBe("2026-02-28");
    expect(idsNaTela()).toEqual(["102"]);
  });

  it("clicar num mês sem nenhuma conta esvazia a tabela", async () => {
    await montar();
    await clicarNaBarra(/Evolução/, "Jun");

    expect(campoDeData("Data Início").value).toBe("2026-06-01");
    expect(campoDeData("Data Fim").value).toBe("2026-06-30");
    expect(linhasDaTabela()).toHaveLength(0);
  });

  it("clicar numa barra anual filtra o ano — e o gráfico vira mensal daquele ano", async () => {
    await montar([
      conta({
        id: 1,
        data: "2025-03-01",
        valor: "100",
        saldo: "100",
        situacao: "pendente",
      }),
      conta({
        id: 2,
        data: "2026-04-01",
        valor: "200",
        saldo: "200",
        situacao: "pendente",
      }),
    ]);
    // Entra em "Personalizado" com as datas ainda em branco: assim os dois
    // anos continuam na base (o gráfico segue anual) e o clique tem de
    // MANTER o preset em custom. Se ele trocasse para qualquer outro, o
    // efeito do período rápido reescreveria as datas por cima do ano clicado.
    await escolherPreset("custom");
    await clicarNaBarra("Evolução Anual", "2025");

    expect(campoDeData("Data Início").value).toBe("2025-01-01");
    expect(campoDeData("Data Fim").value).toBe("2025-12-31");
    // O clique tem de vencer o preset que estava valendo, senão o efeito do
    // "Ano atual" reescreve as datas por cima do ano que foi clicado.
    expect(
      (
        within(blocoDoFiltro("Período Rápido")).getByRole(
          "combobox",
        ) as HTMLSelectElement
      ).value,
    ).toBe("custom");
    expect(idsNaTela()).toEqual(["1"]);
    expect(
      screen.getByRole("heading", { name: "Evolução Mensal — 2025" }),
    ).toBeInTheDocument();
  });

  it("clicar na barra volta para a primeira página", async () => {
    await montar(paginado(20));
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await assentar();
    expect(idsNaTela()[0]).toBe("16");

    await clicarNaBarra(/Evolução/, "Jan");
    expect(idsNaTela()[0]).toBe("1");
  });

  it("o gráfico segue os filtros mas ignora a busca da tabela", async () => {
    await montar();
    await buscar("gama");
    expect(idsNaTela()).toEqual(["103"]);
    expect(itensDoGrafico(/Evolução/)[0]).toBe(
      "label=Jan recebido=1000 aberto=0",
    );

    await marcarOpcao("Cliente", "Gama Energia");
    expect(itensDoGrafico(/Evolução/)[0]).toBe("label=Jan recebido=0 aberto=0");
  });
});

describe("Contas a Receber — gráficos de categoria e de clientes", () => {
  it("categoria soma o VALOR de todas as contas, pagas ou não, e ordena do maior", async () => {
    await montar();

    expect(itensDoGrafico("Distribuição por Categoria")).toEqual([
      "name=Serviços value=1300",
      "name=Locação value=700.5",
      "name=Produtos value=400",
      "name=Sem categoria value=100",
    ]);
  });

  it("categoria mostra 8 fatias, e a última junta tudo o que não coube", async () => {
    // Antes a nona categoria em diante sumia do gráfico, e o percentual das
    // oito era calculado sobre a soma delas — as fatias somavam 100% de um
    // total que não era o total.
    await montar(
      Array.from({ length: 10 }, (_, i) =>
        conta({
          id: i + 1,
          data: "2026-01-01",
          categoria: `Cat ${String(i + 1).padStart(2, "0")}`,
          valor: String((i + 1) * 10),
        }),
      ),
    );

    const fatias = itensDoGrafico("Distribuição por Categoria");
    expect(fatias).toHaveLength(8);
    expect(fatias[0]).toBe("name=Cat 10 value=100");
    expect(fatias[6]).toBe("name=Cat 04 value=40");
    // Cat 03 + Cat 02 + Cat 01 = 60, a soma inteira do que ficou de fora.
    expect(fatias[7]).toBe("name=Outros value=60");
  });

  it("categoria nula e categoria vazia são a MESMA fatia: Sem categoria", async () => {
    // MUDOU em 2026-09-09, de propósito. Enquanto a pizza era montada no
    // navegador, `null` virava "Sem categoria" e `""` virava uma fatia com
    // rótulo vazio — duas fatias para a mesma ausência, e uma delas sem nome na
    // legenda. O SQL apara e junta as duas (`NULLIF(trim(categoria), '')`), que
    // é também o que faz a opção do filtro alcançar a linha gravada com espaço
    // sobrando.
    await montar([
      conta({ id: 1, categoria: null, valor: "100" }),
      conta({ id: 2, categoria: "", valor: "50" }),
    ]);

    expect(itensDoGrafico("Distribuição por Categoria")).toEqual([
      "name=Sem categoria value=150",
    ]);
  });

  it("a pizza e o Top 10 FECHAM com o painel de KPIs", async () => {
    // Os gráficos somavam sempre `valor_numero` e o painel somava outra
    // coisa: o topo da tela e o gráfico logo abaixo não batiam, e nada
    // avisava (defeito 1.1). Uma conta marcada como recebida com saldo
    // sobrando é o caso em que os dois discordavam.
    await montar([
      conta({
        id: 1,
        data: "2026-01-05",
        categoria: "Serviços",
        cliente_nome: "Alfa",
        valor: "1000",
        saldo: "300",
        situacao: "recebido",
      }),
      conta({
        id: 2,
        data: "2026-01-06",
        categoria: "Locação",
        cliente_nome: "Beta",
        valor: "500",
        saldo: "500",
        situacao: "pendente",
      }),
    ]);

    expect(itensDoGrafico("Distribuição por Categoria")).toEqual([
      "name=Serviços value=700",
      "name=Locação value=500",
    ]);
    expect(itensDoGrafico("Top 10 Clientes")).toEqual([
      "nome=Alfa valor=700",
      "nome=Beta valor=500",
    ]);
    expect(kpi("Total Recebido")).toBe("R$ 700,00");
    expect(kpi("Total a Receber")).toBe("R$ 500,00");
    expect(kpi("Média Mensal Faturada")).toBe("R$ 1.200,00");
  });

  it("clientes soma o VALOR por nome e ordena do maior", async () => {
    await montar();

    expect(itensDoGrafico("Top 10 Clientes")).toEqual([
      "nome=Alfa Transportes valor=1200",
      "nome=Beta Mineração valor=500.5",
      "nome=Delta Ltda valor=500",
      "nome=Gama Energia valor=300",
    ]);
  });

  it("clientes para em 10, mesmo com 12 na base", async () => {
    await montar(
      Array.from({ length: 12 }, (_, i) =>
        conta({
          id: i + 1,
          data: "2026-01-01",
          cliente_nome: `Cliente ${String(i + 1).padStart(2, "0")}`,
          valor: String((i + 1) * 10),
        }),
      ),
    );

    const barras = itensDoGrafico("Top 10 Clientes");
    expect(barras).toHaveLength(10);
    expect(barras[0]).toBe("nome=Cliente 12 valor=120");
    expect(barras[9]).toBe("nome=Cliente 03 valor=30");
  });

  it("espaço sobrando junta; caixa diferente ainda não", async () => {
    // MUDOU PELA METADE em 2026-09-09. "Alfa" e "Alfa " eram dois clientes no
    // Top 10 — duas barras com o mesmo rótulo aparente, e o filtro alcançando
    // uma só. O `trim` do SQL junta as duas: medido na base real, são 108
    // contas da Receita Federal em duas grafias que diferem só por espaço.
    //
    // A CAIXA continua separando: "ALFA" segue sendo outro cliente. Unificar
    // por caixa é decidir que dois cadastros são a mesma empresa, e isso é
    // identidade — a mesma fase própria que a `dim_cliente` do gold espera,
    // medindo ranking por ranking. Não entra de carona numa migração.
    await montar([
      conta({ id: 1, cliente_nome: "Alfa", valor: "100" }),
      conta({ id: 2, cliente_nome: "ALFA", valor: "50" }),
      conta({ id: 3, cliente_nome: "Alfa ", valor: "10" }),
    ]);

    expect(itensDoGrafico("Top 10 Clientes")).toEqual([
      "nome=Alfa valor=110",
      "nome=ALFA valor=50",
    ]);
  });
});

describe("Contas a Receber — linha da tabela", () => {
  it("desenha as oito colunas com os dados da conta", async () => {
    await montar([CONTAS[0]]);

    expect(celulasDaLinha(linhasDaTabela()[0])).toEqual([
      "101",
      "20/01/2026",
      "10/01/2026",
      "Alfa Transportes11.111.111/0001-11",
      "Serviços",
      "R$ 1.000,00",
      "R$ 0,00",
      "recebido",
    ]);
  });

  it("sem CPF/CNPJ a segunda linha da célula do cliente não é desenhada", async () => {
    await montar([conta({ id: 1, cliente_nome: "Só o Nome" })]);

    expect(celulasDaLinha(linhasDaTabela()[0])[3]).toBe("Só o Nome");
  });

  it("categoria ausente vira travessão na célula", async () => {
    await montar([conta({ id: 1, categoria: null })]);

    expect(celulasDaLinha(linhasDaTabela()[0])[4]).toBe("-");
  });

  it("data-hora na coluna de data mostra só o dia", async () => {
    // A `formatarData` da tela fatiava a string em "-" e não olhava o "T":
    // a célula mostrava "10T00:00:00/01/2026". Agora é o `dataDeCalendario`
    // de `src/lib/datas.ts`, o mesmo de Locação e Usuários.
    await montar([conta({ id: 1, data: "2026-01-10T00:00:00" })]);

    expect(celulasDaLinha(linhasDaTabela()[0])[2]).toBe("10/01/2026");
  });
});

describe("Contas a Receber — dinheiro", () => {
  it("texto com vírgula decimal e ponto de milhar é lido certo", async () => {
    await montar([
      conta({
        id: 1,
        valor: "1.234,56",
        saldo: "1.234,56",
        situacao: "pendente",
      }),
    ]);

    expect(celulasDaLinha(linhasDaTabela()[0])[5]).toBe("R$ 1.234,56");
    expect(kpi("Total a Receber")).toBe("R$ 1.234,56");
  });

  it("texto com ponto de milhar SEM centavo é lido como milhar", async () => {
    // "1.234" (mil duzentos e trinta e quatro) não tem vírgula: o ponto era
    // lido como decimal e a nota virava R$ 1,23 na tela, no KPI e na
    // planilha. Era o pior defeito de dinheiro das duas telas.
    await montar([
      conta({ id: 1, valor: "1.234", saldo: "1.234", situacao: "pendente" }),
    ]);

    expect(celulasDaLinha(linhasDaTabela()[0])[5]).toBe("R$ 1.234,00");
    expect(kpi("Total a Receber")).toBe("R$ 1.234,00");
  });

  it("uma ou duas casas depois do ponto continuam sendo centavo", async () => {
    // A régua é o tamanho do grupo: três dígitos agrupados é milhar, uma ou
    // duas casas é centavo. "1.23" continua um real e vinte e três.
    await montar([
      conta({ id: 1, valor: "1.23", saldo: "1.23", situacao: "pendente" }),
    ]);

    expect(celulasDaLinha(linhasDaTabela()[0])[5]).toBe("R$ 1,23");
  });

  it("o R$ e os espaços vêm junto sem atrapalhar", async () => {
    await montar([
      conta({
        id: 1,
        valor: "R$ 1.500,50",
        saldo: "R$ 1.500,50",
        situacao: "pendente",
      }),
    ]);

    expect(celulasDaLinha(linhasDaTabela()[0])[5]).toBe("R$ 1.500,50");
  });

  it("valor ausente, vazio ou sem número nenhum vale zero", async () => {
    await montar([
      conta({
        id: 1,
        valor: null as unknown as string,
        saldo: null as unknown as string,
      }),
      conta({ id: 2, valor: "", saldo: "" }),
      conta({ id: 3, valor: "sem valor", saldo: "sem valor" }),
      conta({ id: 4, valor: 0, saldo: 0 }),
    ]);

    for (const linha of linhasDaTabela()) {
      expect(celulasDaLinha(linha)[5]).toBe("R$ 0,00");
      expect(celulasDaLinha(linha)[6]).toBe("R$ 0,00");
    }
    expect(kpi("Total a Receber")).toBe("R$ 0,00");
  });

  it("valor negativo passa direto e diminui o total", async () => {
    await montar([
      conta({ id: 1, valor: "100", saldo: "100", situacao: "pendente" }),
      conta({ id: 2, valor: "-50", saldo: "-50", situacao: "pendente" }),
    ]);

    expect(celulasDaLinha(linhasDaTabela()[1])[5]).toBe("-R$ 50,00");
    expect(kpi("Total a Receber")).toBe("R$ 50,00");
  });

  it("número já vem pronto do backend e não passa pelo parse", async () => {
    await montar([
      conta({ id: 1, valor: 1500.5, saldo: 1500.5, situacao: "pendente" }),
    ]);

    expect(celulasDaLinha(linhasDaTabela()[0])[5]).toBe("R$ 1.500,50");
  });
});

describe("Contas a Receber — exportação para Excel", () => {
  it("exporta dezessete colunas, nesta ordem, na aba Contas a Receber", async () => {
    await montar();
    await exportar();

    expect(planilha.linhas).toHaveLength(6);
    expect(Object.keys(planilha.linhas[0])).toEqual([
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
    expect(planilha.aba).toBe("Contas a Receber");
  });

  it("cada célula da linha, com o valor exato", async () => {
    await montar([CONTAS[0]]);
    await exportar();

    expect(planilha.linhas).toEqual([
      {
        "ID Tiny": 101,
        Cliente: "Alfa Transportes",
        CPF_CNPJ: "11.111.111/0001-11",
        Categoria: "Serviços",
        "Nº Documento": "NF-001",
        Histórico: "Mensalidade janeiro",
        // Valor e Saldo saem como NÚMERO, não como texto formatado.
        Valor: 1000,
        Saldo: 0,
        Emissão: "10/01/2026",
        Vencimento: "20/01/2026",
        Liquidação: "18/01/2026",
        Situação: "recebido",
        Vencida: "Não",
        "Forma Pagamento": "Boleto",
        Portador: "Banco Um",
        Cidade: "Recife",
        UF: "PE",
      },
    ]);
  });

  it("campo de texto ausente vira string vazia, mas data ausente vira travessão", async () => {
    // São dois buracos diferentes para a mesma ideia de "não tem" — célula
    // vazia nas colunas de texto e travessão na Liquidação —, mas é o que a
    // tabela também mostra, e mudar isso seria decisão de produto.
    await montar([conta({ id: 1, vencimento: "2026-12-01" })]);
    await exportar();

    expect(planilha.linhas).toEqual([
      {
        "ID Tiny": 1,
        Cliente: "Cliente Sem Nome",
        CPF_CNPJ: "",
        Categoria: "",
        "Nº Documento": "",
        Histórico: "",
        Valor: 0,
        Saldo: 0,
        Emissão: "10/01/2026",
        Vencimento: "01/12/2026",
        Liquidação: "—",
        Situação: "",
        Vencida: "Não",
        "Forma Pagamento": "",
        Portador: "",
        Cidade: "",
        UF: "",
      },
    ]);
  });

  it("a coluna Situação guarda a situação real, e Vencida é coluna à parte", async () => {
    // Antes a planilha trocava a `Situação` da vencida pelo literal
    // "Vencida" e ninguém mais sabia se ela estava "pendente" ou "aberto".
    await montar([
      conta({ id: 1, vencimento: "2026-08-30", situacao: "pendente" }),
      conta({ id: 2, vencimento: "2026-08-30", situacao: "aberto" }),
      conta({ id: 3, vencimento: "2026-12-01", situacao: "pendente" }),
    ]);
    await exportar();

    expect(planilha.linhas.map((l) => l["Situação"])).toEqual([
      "pendente",
      "aberto",
      "pendente",
    ]);
    expect(planilha.linhas.map((l) => l["Vencida"])).toEqual([
      "Sim",
      "Sim",
      "Não",
    ]);
  });

  it("data com hora sai como o dia também na planilha", async () => {
    await montar([conta({ id: 1, liquidacao: "2026-01-18T10:00:00" })]);
    await exportar();

    expect(planilha.linhas[0]["Liquidação"]).toBe("18/01/2026");
  });

  it("exporta a lista filtrada e ordenada, e não só a página que está na tela", async () => {
    await montar(paginado(20));
    await ordenarPor("ID Tiny");
    await exportar();

    expect(planilha.linhas).toHaveLength(20);
    expect(planilha.linhas.map((l) => l["ID Tiny"]).slice(0, 3)).toEqual([
      20, 19, 18,
    ]);
  });

  it("a busca da tabela entra na planilha", async () => {
    await montar();
    await buscar("alfa");
    await exportar();

    expect(planilha.linhas.map((l) => l["ID Tiny"])).toEqual([101, 104]);
  });

  it("os filtros também entram na planilha", async () => {
    await montar();
    await marcarOpcao("Situação", "aberto");
    await exportar();

    expect(planilha.linhas.map((l) => l["ID Tiny"])).toEqual([105, 106]);
  });

  it("o arquivo se chama contas_a_receber_ mais a data de hoje", async () => {
    await montar();
    await exportar();

    expect(planilha.arquivo).toBe("contas_a_receber_2026-08-31.xlsx");
  });

  it("o nome do arquivo usa a data LOCAL, e não a de Greenwich", async () => {
    // 01/09 às 02h em Greenwich ainda é 31/08 às 23h em Brasília: quem
    // exporta à noite tem de arquivar com a data do dia dele.
    vi.setSystemTime(new Date("2026-09-01T02:00:00Z"));
    await montar();
    await exportar();

    expect(planilha.arquivo).toBe(
      foraDoUtcAgora()
        ? "contas_a_receber_2026-08-31.xlsx"
        : "contas_a_receber_2026-09-01.xlsx",
    );
  });
});
