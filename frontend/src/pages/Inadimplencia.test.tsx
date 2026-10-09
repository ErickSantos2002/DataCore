import type { ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Inadimplencia from "./Inadimplencia";
import { textoDoTooltip } from "./inadimplencia/AbaIndicadores";
import { AuthContext } from "../context/AuthContext";
import { diaLocal } from "../lib/datas";
import type { DetalheDaEmpresa, EmpresaDaLista, Indicadores, ResumoDeInadimplencia } from "../services/inadimplencia";
import type { ContaDaTela } from "../services/notasapi";

const falso = vi.hoisted(() => ({ atual: null as null | ReturnType<typeof import("./inadimplencia/servidorFalso").criarServidorDeInadimplencia> }));

vi.mock("../services/inadimplencia", async () => {
  const { criarServidorDeInadimplencia } = await import("./inadimplencia/servidorFalso");
  falso.atual = criarServidorDeInadimplencia();
  return falso.atual.servico;
});

const planilha = vi.hoisted(() => ({ linhas: [] as unknown[] }));
vi.mock("../lib/planilha", () => ({
  baixarPlanilha: (abas: { linhas: unknown[] }[]) => { planilha.linhas = abas[0].linhas; },
}));

/** Dublê do recharts: em jsdom o gráfico mede 0x0 e não desenha; aqui cada ponto vira um item de lista. */
vi.mock("recharts", () => {
  const semDesenho = () => null;
  type Dado = Record<string, unknown>;
  type Props = { data?: Dado[]; children?: ReactNode };
  return {
    ResponsiveContainer: ({ children }: Props) => <div>{children}</div>,
    BarChart: ({ data = [], children }: Props) => (
      <div>
        <ul>{data.map((d, i) => <li key={i}>{Object.entries(d).map(([k, v]) => `${k}=${String(v)}`).join(" ")}</li>)}</ul>
        {children}
      </div>
    ),
    Bar: semDesenho, Cell: semDesenho, XAxis: semDesenho, YAxis: semDesenho,
    Tooltip: semDesenho, CartesianGrid: semDesenho, ReferenceLine: semDesenho,
  };
});

function Molde({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={{ user: { id: 1, username: "ana", role: "financeiro" }, token: "t",
      loading: false, login: vi.fn(), entrarComToken: vi.fn(), logout: vi.fn(), error: null }}>
      {children}
    </AuthContext.Provider>
  );
}

const RESUMO: ResumoDeInadimplencia = {
  total_a_receber: 10000, total_vencido: 4000, em_atraso: 1000, inadimplente: 3000,
  inadimplencia_carteira: 0.3, recuperado: 0.8, titulos_vencidos: 12, titulos_inadimplentes: 8,
  empresas_inadimplentes: 3,
  faixas: [
    { faixa: "atraso", titulos: 4, empresas: 2, valor: 1000 },
    { faixa: "31_60", titulos: 3, empresas: 2, valor: 1500 },
    { faixa: "61_90", titulos: 1, empresas: 1, valor: 500 },
    { faixa: "90_mais", titulos: 4, empresas: 1, valor: 1000 },
  ],
  sem_contato: 2, promessas_7_dias: 1, promessas_quebradas: 0, em_negociacao: 0,
};

function empresa(campos: Partial<EmpresaDaLista> & { empresa: string; nome: string }): EmpresaDaLista {
  return { documento: "11.111.111/0001-11", filiais: 1, titulos: 1, valor_devido: 100,
           valor_inadimplente: 100, maior_atraso: 40, status: "sem_contato", proxima_data: null,
           ultimo_contato: null, ...campos };
}

const EMPRESAS = [
  empresa({ empresa: "11111111", nome: "Alfa Ltda", valor_devido: 2000, maior_atraso: 95, status: "promessa", proxima_data: "2026-10-15", ultimo_contato: "2026-10-01T10:00:00Z" }),
  empresa({ empresa: "22222222", nome: "Beta SA", documento: "22.222.222 · 3 filiais", filiais: 3, titulos: 5, valor_devido: 1500, maior_atraso: 45 }),
];

/** O último pedido de lista que o servidor falso recebeu (sem `.at`, a lib do projeto é anterior ao ES2022). */
function ultimoPedido() {
  const p = falso.atual!.estado.pedidos;
  return p[p.length - 1];
}

async function assentar() { await act(async () => { await Promise.resolve(); }); }

async function montar() {
  render(<Inadimplencia />, { wrapper: Molde });
  await assentar();
  await assentar();
}

beforeEach(() => {
  const e = falso.atual!.estado;
  Object.assign(e, { modo: "ok", resumo: RESUMO, empresas: EMPRESAS, pedidos: [], eventos: [],
                     observacoes: [], erroDeGravacao: null, pedidosResumo: [], pedidosIndicadores: [] });
});

describe("Inadimplência — aba Cobrança", () => {
  it("mostra os cards do resumo", async () => {
    await montar();
    expect(screen.getByText("Inadimplente (mais de 30 dias)")).toBeInTheDocument();
    expect(screen.getByText("30,0%")).toBeInTheDocument();
    expect(screen.getByText("80,0%")).toBeInTheDocument();
  });

  it("a lista mostra nome, CNPJ, status e próxima data, como a tabela de Contas", async () => {
    await montar();
    const linhas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(linhas).toHaveLength(2);
    expect(within(linhas[0]).getByText("Alfa Ltda")).toBeInTheDocument();
    expect(within(linhas[0]).getByText("11.111.111/0001-11")).toBeInTheDocument();
    expect(within(linhas[0]).getByText("Promessa de pagamento")).toBeInTheDocument();
    expect(within(linhas[0]).getByText("15/10/2026")).toBeInTheDocument();
    expect(within(linhas[1]).getByText("22.222.222 · 3 filiais")).toBeInTheDocument();
    expect(within(linhas[1]).getByText("nunca")).toBeInTheDocument();
  });

  it("clicar numa faixa filtra a lista por ela", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /61–90 dias/ }));
    await assentar();
    expect(ultimoPedido()?.faixa).toBe("61_90");
  });

  it("buscar volta para a página 1 e manda a busca", async () => {
    await montar();
    fireEvent.change(screen.getByLabelText("Pesquisar empresas"), { target: { value: "beta" } });
    await assentar();
    const ultimo = ultimoPedido();
    expect(ultimo.busca).toBe("beta");
    expect(ultimo.offset).toBe(0);
  });

  it("ordenar pelo cabeçalho pede a ordenação ao servidor", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /Maior atraso/ }));
    await assentar();
    expect(ultimoPedido()?.ordenar_por).toBe("maior_atraso");
  });

  it("exportar leva todas as empresas do filtro", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /Exportar/ }));
    await assentar();
    expect(planilha.linhas).toHaveLength(2);
  });

  it("digitar na busca mantém a lista anterior na tela enquanto carrega", async () => {
    await montar();
    expect(screen.getByRole("button", { name: "Alfa Ltda" })).toBeInTheDocument();
    falso.atual!.estado.modo = "pendente";
    fireEvent.change(screen.getByLabelText("Pesquisar empresas"), { target: { value: "be" } });
    await assentar();
    expect(screen.getByRole("button", { name: "Alfa Ltda" })).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma empresa encontrada.")).toBeNull();
  });

  it("card de status liga também as empresas só em atraso", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: "Filtrar: Sem contato" }));
    await assentar();
    expect(ultimoPedido()).toMatchObject({ status: ["sem_contato"], incluir_atraso: true });
  });

  it("card de promessas filtra promessa e ordena pela data prometida, a mais próxima primeiro", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: "Filtrar: Promessas nos próximos 7 dias" }));
    await assentar();
    expect(ultimoPedido()).toMatchObject({
      status: ["promessa"], incluir_atraso: true, ordenar_por: "proxima_data", direcao: "asc",
    });
  });

  it("o filtro de Status não oferece Pago (a lista só tem ciclos abertos)", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /^Status/, expanded: false }));
    const grupo = screen.getByRole("group", { name: "Status" });
    expect(within(grupo).getByRole("checkbox", { name: "Promessa de pagamento" })).toBeInTheDocument();
    expect(within(grupo).queryByRole("checkbox", { name: "Pago" })).toBeNull();
  });

  it("falha de carregamento avisa em bloco", async () => {
    falso.atual!.estado.modo = "falha";
    await montar();
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar");
  });
});

function ultimoPedidoDoResumo() {
  const p = falso.atual!.estado.pedidosResumo;
  return p[p.length - 1];
}

function escolher(rotulo: string, valor: string) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
}

describe("Inadimplência — filtros da aba Cobrança", () => {
  it("a barra tem os filtros de data e de contato, com os padrões da spec", async () => {
    await montar();
    expect(screen.getByLabelText("Filtrar data por")).toHaveValue("vencimento");
    const opcoes = within(screen.getByLabelText("Filtrar data por")).getAllByRole("option").map((o) => o.textContent);
    expect(opcoes).toEqual(["Vencimento", "Emissão", "Promessa", "Último contato"]);
    expect(screen.getByLabelText("Período Rápido")).toHaveValue("todos");
    expect(screen.getByLabelText("Faixa de atraso")).toHaveValue("");
    expect(screen.getByLabelText("Sem contato há mais de")).toHaveValue("");
    expect(ultimoPedido().data_tipo).toBeUndefined();
    expect(ultimoPedido().data_inicio).toBeUndefined();
  });

  it("tipo de data e datas vão para a lista e para o resumo; mexer na data vira Personalizado", async () => {
    await montar();
    escolher("Filtrar data por", "emissao");
    escolher("Data Início", "2026-09-01");
    escolher("Data Fim", "2026-09-30");
    await assentar();
    expect(screen.getByLabelText("Período Rápido")).toHaveValue("custom");
    const esperado = { data_tipo: "emissao", data_inicio: "2026-09-01", data_fim: "2026-09-30" };
    expect(ultimoPedido()).toMatchObject(esperado);
    expect(ultimoPedidoDoResumo()).toMatchObject(esperado);
  });

  it("sem data nenhuma o tipo de data não vai (nada a recortar)", async () => {
    await montar();
    escolher("Filtrar data por", "promessa");
    await assentar();
    expect(ultimoPedido().data_tipo).toBeUndefined();
  });

  it("Próximos 7 dias vai de hoje até hoje + 7", async () => {
    await montar();
    escolher("Período Rápido", "proximos7");
    await assentar();
    const hoje = new Date();
    const mais7 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 7);
    expect(screen.getByLabelText("Data Início")).toHaveValue(diaLocal(hoje));
    expect(ultimoPedido()).toMatchObject({ data_tipo: "vencimento", data_inicio: diaLocal(hoje), data_fim: diaLocal(mais7) });
  });

  it("sem contato há mais de manda 7, 15, 30 ou nunca", async () => {
    await montar();
    const opcoes = within(screen.getByLabelText("Sem contato há mais de")).getAllByRole("option").map((o) => o.textContent);
    expect(opcoes).toEqual(["Qualquer", "7 dias", "15 dias", "30 dias", "Nunca contatado"]);
    for (const v of ["7", "15", "30", "nunca"]) {
      escolher("Sem contato há mais de", v);
      await assentar();
      expect(ultimoPedido().sem_contato).toBe(v);
      expect(ultimoPedidoDoResumo().sem_contato).toBe(v);
    }
    escolher("Sem contato há mais de", "");
    await assentar();
    expect(ultimoPedido().sem_contato).toBeUndefined();
  });

  it("o select de faixa e a barra colorida são o mesmo estado", async () => {
    await montar();
    escolher("Faixa de atraso", "61_90");
    await assentar();
    expect(ultimoPedido().faixa).toBe("61_90");
    expect(ultimoPedidoDoResumo().faixa).toBe("61_90");
    expect(screen.getByRole("button", { name: /61–90 dias/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Mais de 90 dias/ }));
    await assentar();
    expect(screen.getByLabelText("Faixa de atraso")).toHaveValue("90_mais");
    fireEvent.click(screen.getByRole("button", { name: /Mais de 90 dias/ }));
    await assentar();
    expect(screen.getByLabelText("Faixa de atraso")).toHaveValue("");
    expect(ultimoPedido().faixa).toBeUndefined();
  });

  it("o resumo recebe status e faixa mas não a busca", async () => {
    await montar();
    fireEvent.change(screen.getByLabelText("Pesquisar empresas"), { target: { value: "beta" } });
    await assentar();
    expect(ultimoPedidoDoResumo()).not.toHaveProperty("busca");
    fireEvent.click(screen.getByRole("button", { name: "Filtrar: Promessas quebradas" }));
    await assentar();
    expect(ultimoPedidoDoResumo()).toMatchObject({ status: ["quebrada"] });
    expect(ultimoPedidoDoResumo()).not.toHaveProperty("incluir_atraso");
  });

  it("mudar qualquer filtro volta para a página 1", async () => {
    falso.atual!.estado.empresas = Array.from({ length: 40 }, (_, i) =>
      empresa({ empresa: String(10000000 + i), nome: `Empresa ${i}` }));
    await montar();
    const controles: [string, string][] = [
      ["Filtrar data por", "emissao"], ["Período Rápido", "mesAtual"], ["Data Início", "2026-01-01"],
      ["Data Fim", "2026-12-31"], ["Faixa de atraso", "31_60"], ["Sem contato há mais de", "15"],
    ];
    for (const [rotulo, valor] of controles) {
      fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
      await assentar();
      expect(ultimoPedido().offset).toBeGreaterThan(0);
      escolher(rotulo, valor);
      await assentar();
      expect(ultimoPedido().offset, rotulo).toBe(0);
    }
  });

  it("a nota do Recuperado aparece só com filtro de data ativo", async () => {
    await montar();
    expect(screen.queryByText(/histórico todo, não segue o filtro/)).toBeNull();
    escolher("Data Início", "2026-09-01");
    await assentar();
    expect(screen.getByText(/histórico todo, não segue o filtro/)).toBeInTheDocument();
  });

  it("trocar filtro não troca a tela por um spinner (a barra de filtros fica)", async () => {
    await montar();
    falso.atual!.estado.modo = "pendente";
    escolher("Sem contato há mais de", "7");
    await assentar();
    expect(screen.getByLabelText("Sem contato há mais de")).toHaveValue("7");
    expect(screen.getByText("30,0%")).toBeInTheDocument();
  });

  it("exportar usa os mesmos filtros, sem a paginação", async () => {
    await montar();
    escolher("Sem contato há mais de", "nunca");
    escolher("Data Início", "2026-09-01");
    await assentar();
    fireEvent.click(screen.getByRole("button", { name: /Exportar/ }));
    await assentar();
    expect(ultimoPedido()).toMatchObject({ sem_contato: "nunca", data_inicio: "2026-09-01", limite: 1000, offset: 0 });
  });
});

const DETALHE: DetalheDaEmpresa = {
  empresa: "11111111", nome: "Alfa Ltda", documento: "11.111.111 · 2 filiais", valor_devido: 2000,
  valor_inadimplente: 1500, maior_atraso: 95, telefone: "(11) 0000-0000", email: "fin@alfa.exemplo",
  observacao: "Só boleto por e-mail", observacao_por: "ana", observacao_em: "2026-10-01T10:00:00Z",
  filiais: [
    { cnpj: "11111111000111", nome: "Alfa Ltda - A", titulos: 1, valor_vencido: 1500 },
    { cnpj: "11111111000222", nome: "Alfa Ltda - B", titulos: 1, valor_vencido: 500 },
  ],
  ciclo: { id: 1, status: "promessa", promessa_data: "2026-10-15", promessa_valor: 1000,
           promessa_condicoes: "Metade agora", aberto_em: "2026-09-01T00:00:00Z", aberto_por: "sistema",
           encerrado_em: null, ultimo_contato_em: "2026-10-01T10:00:00Z" },
  ciclos_anteriores: [],
  eventos: [
    { id: 2, ciclo_id: 1, ocorrido_em: "2026-10-01T10:00:00Z", registrado_em: "2026-10-01T10:05:00Z",
      registrado_por: "ana", tipo: "contato", canal: "telefone", filial_cnpj: "11111111000111",
      status_anterior: "sem_contato", status_novo: "promessa", promessa_data: "2026-10-15",
      promessa_valor: 1000, promessa_condicoes: "Metade agora", anotacao: "Falei com a Joana",
      valor_inadimplente: 1500 },
    { id: 1, ciclo_id: 1, ocorrido_em: "2026-09-01T00:00:00Z", registrado_em: "2026-09-01T00:00:00Z",
      registrado_por: "sistema", tipo: "sistema", canal: null, filial_cnpj: null, status_anterior: null,
      status_novo: "sem_contato", promessa_data: null, promessa_valor: null, promessa_condicoes: null,
      anotacao: "Cobrança aberta: título com 31 dias de atraso.", valor_inadimplente: 1500 },
  ],
};

function titulo(c: Partial<ContaDaTela> & { id: number }): ContaDaTela {
  return { id_tiny: c.id, emissao: "2026-06-01", vencimento: "2026-07-01", situacao: "aberto",
           categoria: "Serviços", cliente_nome: "Alfa Ltda - A", cliente_cpf_cnpj: "11.111.111/0001-11",
           cliente_cidade: null, cliente_uf: null, nro_documento: null, historico: null, liquidacao: null,
           valor: 1500, saldo: 1500, quitada: false, vencida: true, forma_pagamento: null,
           portador: null, ocorrencia: null, ...c };
}

describe("Inadimplência — modal da empresa", () => {
  beforeEach(() => {
    falso.atual!.estado.detalhes = { "11111111": DETALHE };
    falso.atual!.estado.titulos = { "11111111": [
      titulo({ id: 1 }),
      titulo({ id: 2, cliente_nome: "Alfa Ltda - B", cliente_cpf_cnpj: "11.111.111/0002-22", saldo: 500, valor: 500 }),
      titulo({ id: 3, vencimento: "2099-01-01", vencida: false }),
    ] };
  });

  async function abrir() {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: "Alfa Ltda" }));
    await assentar(); await assentar();
    return screen.getByRole("dialog");
  }

  it("abre com cabeçalho, contato do Tiny e observação", async () => {
    const modal = await abrir();
    expect(within(modal).getByText("11.111.111 · 2 filiais")).toBeInTheDocument();
    expect(within(modal).getByText("(11) 0000-0000")).toBeInTheDocument();
    expect(within(modal).getByText("Só boleto por e-mail")).toBeInTheDocument();
  });

  it("abre no modal largo (size full) para a tabela de títulos caber", async () => {
    const modal = await abrir();
    expect(modal.className).toContain("max-w-7xl");
  });

  it("aba Títulos agrupa por filial com subtotal e põe os a vencer por último", async () => {
    const modal = await abrir();
    const grupos = within(modal).getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(grupos[0]).toMatch(/Alfa Ltda - A/);
    expect(grupos[grupos.length - 1]).toMatch(/A vencer/);
    expect(within(modal).getAllByText(/Vencida/).length).toBeGreaterThan(0);
  });

  it("aba Cobrança mostra a linha do tempo, do mais novo ao mais velho", async () => {
    const modal = await abrir();
    fireEvent.click(within(modal).getByRole("tab", { name: "Cobrança" }));
    const itens = within(modal).getAllByRole("listitem");
    expect(itens[0]).toHaveTextContent("Falei com a Joana");
    expect(itens[0]).toHaveTextContent("ana");
    expect(itens[1]).toHaveTextContent("Sistema");
  });

  it("editar a observação grava e mostra a nova", async () => {
    const modal = await abrir();
    fireEvent.click(within(modal).getByRole("button", { name: "Editar observação" }));
    fireEvent.change(within(modal).getByLabelText("Observação"), { target: { value: "Pagam dia 10" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Salvar observação" }));
    await assentar();
    expect(falso.atual!.estado.observacoes).toEqual([{ empresa: "11111111", texto: "Pagam dia 10" }]);
    expect(within(modal).getByText("Pagam dia 10")).toBeInTheDocument();
  });

  it("o que foi digitado no contato sobrevive à troca de aba", async () => {
    const modal = await abrir();
    fireEvent.click(within(modal).getByRole("button", { name: "Registrar contato" }));
    fireEvent.change(within(modal).getByLabelText("Anotação"), { target: { value: "Ligar amanhã" } });
    fireEvent.click(within(modal).getByRole("tab", { name: "Títulos" }));
    fireEvent.click(within(modal).getByRole("tab", { name: "Cobrança" }));
    expect(within(modal).getByLabelText("Anotação")).toHaveValue("Ligar amanhã");
  });

  it("a mesma filial com CNPJ pontuado e sem pontuação vira um grupo só", async () => {
    falso.atual!.estado.titulos = { "11111111": [
      titulo({ id: 1 }),
      titulo({ id: 2, cliente_cpf_cnpj: "11111111000111" }),
    ] };
    const modal = await abrir();
    expect(within(modal).getAllByRole("heading", { level: 3 })).toHaveLength(1);
  });

  it("o campo Condições limita a 1000 caracteres", async () => {
    const modal = await abrir();
    fireEvent.click(within(modal).getByRole("button", { name: "Registrar contato" }));
    fireEvent.change(within(modal).getByLabelText("Novo status"), { target: { value: "promessa" } });
    expect(within(modal).getByLabelText("Condições")).toHaveAttribute("maxlength", "1000");
  });

  async function formulario() {
    const modal = await abrir();
    fireEvent.click(within(modal).getByRole("button", { name: "Registrar contato" }));
    return modal;
  }

  it("registra contato com promessa", async () => {
    const modal = await formulario();
    fireEvent.change(within(modal).getByLabelText("Canal"), { target: { value: "telefone" } });
    fireEvent.change(within(modal).getByLabelText("Novo status"), { target: { value: "promessa" } });
    fireEvent.change(within(modal).getByLabelText("Data prometida"), { target: { value: "2099-01-10" } });
    fireEvent.change(within(modal).getByLabelText("Valor prometido"), { target: { value: "1.500,50" } });
    fireEvent.change(within(modal).getByLabelText("Anotação"), { target: { value: "Falei com a Joana" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Gravar" }));
    await assentar();
    const [{ empresa, dados }] = falso.atual!.estado.eventos;
    expect(empresa).toBe("11111111");
    expect(dados).toMatchObject({ canal: "telefone", status_novo: "promessa", anotacao: "Falei com a Joana",
                                  promessa: { data: "2099-01-10", valor: 1500.5 } });
  });

  it("os campos da promessa só aparecem com o status Promessa", async () => {
    const modal = await formulario();
    expect(within(modal).queryByLabelText("Data prometida")).toBeNull();
    fireEvent.change(within(modal).getByLabelText("Novo status"), { target: { value: "promessa" } });
    expect(within(modal).getByLabelText("Data prometida")).toBeInTheDocument();
  });

  it("trocar de Promessa para outro status não manda a promessa", async () => {
    const modal = await formulario();
    fireEvent.change(within(modal).getByLabelText("Novo status"), { target: { value: "promessa" } });
    fireEvent.change(within(modal).getByLabelText("Data prometida"), { target: { value: "2099-01-10" } });
    fireEvent.change(within(modal).getByLabelText("Novo status"), { target: { value: "negociacao" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Gravar" }));
    await assentar();
    const [{ dados }] = falso.atual!.estado.eventos;
    expect(dados.status_novo).toBe("negociacao");
    expect(dados.promessa).toBeNull();
  });

  it("os status do sistema não são oferecidos", async () => {
    const modal = await formulario();
    const opcoes = within(within(modal).getByLabelText("Novo status")).getAllByRole("option").map((o) => o.textContent);
    expect(opcoes).not.toContain("Pago");
    expect(opcoes).not.toContain("Promessa quebrada");
    expect(opcoes).not.toContain("Sem contato");
  });

  it("sem canal nem status, não grava e avisa", async () => {
    const modal = await formulario();
    fireEvent.click(within(modal).getByRole("button", { name: "Gravar" }));
    await assentar();
    expect(falso.atual!.estado.eventos).toHaveLength(0);
    expect(within(modal).getByText("Escolha o canal do contato ou um novo status.")).toBeInTheDocument();
  });

  it("erro do backend aparece no modal e o que foi digitado fica", async () => {
    falso.atual!.estado.erroDeGravacao = "A data prometida já passou.";
    const modal = await formulario();
    fireEvent.change(within(modal).getByLabelText("Canal"), { target: { value: "email" } });
    fireEvent.change(within(modal).getByLabelText("Anotação"), { target: { value: "Texto longo" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Gravar" }));
    await assentar();
    expect(within(modal).getByRole("alert")).toHaveTextContent("A data prometida já passou.");
    expect(within(modal).getByLabelText("Anotação")).toHaveValue("Texto longo");
  });

  it.each(["abc", "0"])("valor prometido inválido (%s) avisa e não grava", async (texto) => {
    const modal = await formulario();
    fireEvent.change(within(modal).getByLabelText("Novo status"), { target: { value: "promessa" } });
    fireEvent.change(within(modal).getByLabelText("Data prometida"), { target: { value: "2099-01-10" } });
    fireEvent.change(within(modal).getByLabelText("Valor prometido"), { target: { value: texto } });
    fireEvent.click(within(modal).getByRole("button", { name: "Gravar" }));
    await assentar();
    expect(falso.atual!.estado.eventos).toHaveLength(0);
    expect(within(modal).getByText("Valor prometido inválido.")).toBeInTheDocument();
  });

  it("valor prometido vazio segue com valor nulo", async () => {
    const modal = await formulario();
    fireEvent.change(within(modal).getByLabelText("Novo status"), { target: { value: "promessa" } });
    fireEvent.change(within(modal).getByLabelText("Data prometida"), { target: { value: "2099-01-10" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Gravar" }));
    await assentar();
    expect(falso.atual!.estado.eventos[0].dados.promessa).toMatchObject({ data: "2099-01-10", valor: null });
  });

  it("ocorrido_em vai com fuso e representa o instante digitado", async () => {
    const modal = await formulario();
    fireEvent.change(within(modal).getByLabelText("Quando"), { target: { value: "2026-10-09T14:30" } });
    fireEvent.change(within(modal).getByLabelText("Canal"), { target: { value: "telefone" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Gravar" }));
    await assentar();
    const enviado = falso.atual!.estado.eventos[0].dados.ocorrido_em;
    expect(enviado).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    expect(new Date(enviado).getTime()).toBe(new Date(2026, 9, 9, 14, 30).getTime());
  });
});

const INDICADORES: Indicadores = {
  mensal: [
    { mes: "2026-07", em_apuracao: false, valor: 1000, inadimplente: 100, titulos: 10, titulos_inadimplentes: 1, taxa: 0.1 },
    { mes: "2026-08", em_apuracao: false, valor: 1000, inadimplente: 158, titulos: 10, titulos_inadimplentes: 2, taxa: 0.158 },
    { mes: "2026-09", em_apuracao: true, valor: 300, inadimplente: 120, titulos: 3, titulos_inadimplentes: 1, taxa: 0.4 },
  ],
  anual: [
    { ano: 2025, ano_corrente: false, valor: 10000, inadimplente: 840, titulos: 100, titulos_inadimplentes: 9, taxa: 0.084 },
    { ano: 2026, ano_corrente: true, valor: 7500, inadimplente: 742, titulos: 80, titulos_inadimplentes: 8, taxa: 0.099 },
  ],
  total: { valor: 51000, inadimplente: 3417, titulos: 900, titulos_inadimplentes: 80, taxa: 0.067 },
  desde: "2015-01-01",
  ultimo_fechado: { mes: "2026-08", em_apuracao: false, valor: 1000, inadimplente: 158, titulos: 10, titulos_inadimplentes: 2, taxa: 0.158 },
  media_12_meses: 0.129,
  opcoes: { categorias: ["Locação", "Venda"], formas_pagamento: ["Boleto", "Pix"], ufs: ["PE", "SP"] },
};

/** O último pedido de indicadores que o servidor falso recebeu. */
function ultimoPedidoDeIndicadores() {
  const p = falso.atual!.estado.pedidosIndicadores;
  return p[p.length - 1];
}

describe("Inadimplência — aba Indicadores", () => {
  beforeEach(() => { falso.atual!.estado.indicadores = INDICADORES; });

  async function abrirIndicadores() {
    await montar();
    fireEvent.click(screen.getByRole("tab", { name: "Indicadores" }));
    await assentar(); await assentar();
  }

  it("cards: último mês fechado, média de 12 meses, ano corrente e total", async () => {
    await abrirIndicadores();
    expect(screen.getByText("Último mês fechado (ago/26)")).toBeInTheDocument();
    expect(screen.getByText("15,8%")).toBeInTheDocument();
    expect(screen.getByText("12,9%")).toBeInTheDocument();
    expect(screen.getByText("Ano 2026 (até agora)")).toBeInTheDocument();
    expect(screen.getByText(/pior que 2025/)).toBeInTheDocument();
    expect(screen.getByText("Total — desde 2015")).toBeInTheDocument();
  });

  it("o mês em apuração aparece marcado e não como número fechado", async () => {
    await abrirIndicadores();
    expect(screen.getByText(/set\/26.*em apuração/)).toBeInTheDocument();
  });

  it("só busca os indicadores quando a aba é aberta", async () => {
    const espiao = vi.spyOn(falso.atual!.servico, "fetchIndicadores");
    await montar();
    expect(espiao).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "Indicadores" }));
    await assentar();
    expect(espiao).toHaveBeenCalledTimes(1);
  });

  function comAno(taxaAtual: number | null, taxaAnterior: number | null): Indicadores {
    return { ...INDICADORES, anual: [
      { ...INDICADORES.anual[0], taxa: taxaAnterior },
      { ...INDICADORES.anual[1], taxa: taxaAtual },
    ] };
  }

  it.each([
    [0.099, 0.084, /▲ pior que 2025 \(8,4%\)/],
    [0.07, 0.084, /▼ melhor que 2025 \(8,4%\)/],
    [0.0991, 0.0994, /igual a 2025 \(9,9%\)/],
    [0.0295, 0.0285, /igual a 2025 \(2,9%\)/],
    [0.0045, 0.004, /igual a 2025 \(0,4%\)/],
  ])("compara com o ano anterior (%s vs %s)", async (atual, anterior, esperado) => {
    falso.atual!.estado.indicadores = comAno(atual, anterior);
    await abrirIndicadores();
    expect(screen.getByText(esperado)).toBeInTheDocument();
  });

  it("sem taxa no ano anterior, não mostra comparação", async () => {
    falso.atual!.estado.indicadores = comAno(0.099, null);
    await abrirIndicadores();
    expect(screen.queryByText(/pior que|melhor que|igual a/)).not.toBeInTheDocument();
  });

  it("tooltip usa os rótulos da spec", () => {
    const texto = textoDoTooltip(INDICADORES.mensal[2]);
    expect(texto).toContain("Taxa: 40,0%");
    expect(texto).toContain("Valor vencido: ");
    expect(texto).toContain("Não pago em 30 dias: ");
    expect(texto).toContain("(em apuração)");
  });
});

describe("Inadimplência — filtros da aba Indicadores", () => {
  beforeEach(() => { falso.atual!.estado.indicadores = INDICADORES; });
  afterEach(() => vi.useRealTimers());

  async function abrirIndicadores() {
    await montar();
    fireEvent.click(screen.getByRole("tab", { name: "Indicadores" }));
    await assentar(); await assentar();
  }

  function marcar(rotulo: string, opcao: string) {
    const botao = screen.getByRole("button", { name: new RegExp(`^${rotulo}`) });
    if (botao.getAttribute("aria-expanded") !== "true") fireEvent.click(botao);
    fireEvent.click(within(screen.getByRole("group", { name: rotulo })).getByRole("checkbox", { name: opcao }));
  }

  it("sem filtro, o pedido vai vazio e o período rápido é Tudo", async () => {
    await abrirIndicadores();
    expect(screen.getByLabelText("Período rápido")).toHaveValue("tudo");
    expect(ultimoPedidoDeIndicadores()).toEqual({});
  });

  it("mês inicial e final vão como AAAA-MM e viram Personalizado", async () => {
    await abrirIndicadores();
    escolher("Mês inicial", "2025-01");
    escolher("Mês final", "2025-06");
    await assentar();
    expect(screen.getByLabelText("Período rápido")).toHaveValue("custom");
    expect(ultimoPedidoDeIndicadores()).toEqual({ mes_inicio: "2025-01", mes_fim: "2025-06" });
  });

  it.each([
    ["12meses", "2025-01", "2025-12"],
    ["esteAno", "2025-01", "2025-12"],
    ["anoPassado", "2024-01", "2024-12"],
  ])("o preset %s calcula os meses pelo dia local", async (preset, inicio, fim) => {
    // 31/12/2025 às 23h30 local: em UTC (a oeste de Greenwich) já é 2026
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2025, 11, 31, 23, 30));
    await abrirIndicadores();
    escolher("Período rápido", preset);
    await assentar();
    expect(screen.getByLabelText("Mês inicial")).toHaveValue(inicio);
    expect(screen.getByLabelText("Mês final")).toHaveValue(fim);
    expect(ultimoPedidoDeIndicadores()).toEqual({ mes_inicio: inicio, mes_fim: fim });
    escolher("Período rápido", "tudo");
    await assentar();
    expect(ultimoPedidoDeIndicadores()).toEqual({});
  });

  it("categoria, forma e UF usam as opções da API e o Sem … manda __sem__", async () => {
    await abrirIndicadores();
    marcar("Categoria", "Venda");
    marcar("Categoria", "Sem categoria");
    marcar("Forma de pagamento", "Sem forma");
    marcar("UF do cliente", "PE");
    await assentar();
    expect(ultimoPedidoDeIndicadores()).toEqual({
      categoria: ["Venda", "__sem__"], forma_pagamento: ["__sem__"], uf: ["PE"],
    });
  });

  it("o cliente vai depois de uma pausa na digitação, sem espaços nas pontas", async () => {
    await abrirIndicadores();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "alf" } });
    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: " alfa " } });
    await assentar();
    expect(ultimoPedidoDeIndicadores()).toEqual({});
    await act(async () => { vi.advanceTimersByTime(500); });
    await assentar();
    expect(ultimoPedidoDeIndicadores()).toEqual({ cliente: "alfa" });
    expect(falso.atual!.estado.pedidosIndicadores.filter((p) => p.cliente === "alf")).toHaveLength(0);
  });

  it("o card do total diz o recorte: desde, período ou No recorte", async () => {
    await abrirIndicadores();
    expect(screen.getByText("Total — desde 2015")).toBeInTheDocument();
    escolher("Mês inicial", "2025-01");
    escolher("Mês final", "2025-06");
    await assentar();
    expect(screen.getByText("Período: jan/25 – jun/25")).toBeInTheDocument();
    marcar("UF do cliente", "SP");
    await assentar();
    expect(screen.getByText("No recorte")).toBeInTheDocument();
  });

  it("limpar filtros volta tudo ao padrão", async () => {
    await abrirIndicadores();
    escolher("Período rápido", "anoPassado");
    marcar("Categoria", "Venda");
    await assentar();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await assentar();
    expect(screen.getByLabelText("Período rápido")).toHaveValue("tudo");
    expect(ultimoPedidoDeIndicadores()).toEqual({});
  });

  it("recorte sem título vencido: gráfico vazio e cards com traço", async () => {
    falso.atual!.estado.indicadores = {
      ...INDICADORES, mensal: [], anual: [], desde: null, ultimo_fechado: null, media_12_meses: null,
      total: { valor: 0, inadimplente: 0, titulos: 0, titulos_inadimplentes: 0, taxa: null },
    };
    await abrirIndicadores();
    expect(screen.getByText("Nenhum título vencido neste recorte.")).toBeInTheDocument();
    expect(screen.getByText(/^Último mês fechado/)).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });

  it("trocar o filtro mantém os números anteriores à mostra enquanto carrega", async () => {
    await abrirIndicadores();
    falso.atual!.estado.modo = "pendente";
    marcar("Categoria", "Venda");
    await assentar();
    expect(screen.getByText("Taxa mensal")).toBeInTheDocument();
    expect(screen.getByText("15,8%")).toBeInTheDocument();
  });
});
