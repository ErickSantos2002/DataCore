import type { ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Inadimplencia from "./Inadimplencia";
import { AuthContext } from "../context/AuthContext";
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
                     observacoes: [], erroDeGravacao: null });
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

  it("falha de carregamento avisa em bloco", async () => {
    falso.atual!.estado.modo = "falha";
    await montar();
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar");
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
};

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
});
