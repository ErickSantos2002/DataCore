import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Vendedores from "./Vendedores";
import type { RecorteComercial } from "./comercial/useComercial";

/**
 * Caracterização do topo de Vendedores — cabeçalho, os quatro KPIs, o estado
 * de carregando e o recorte que o papel "vendas" manda —, antes de decompor a
 * tela.
 *
 * ⚠️ **Vendedores mede a MERCADORIA.** Os KPIs leem `faturamento_produtos`, e
 * não `faturamento` (o total da nota, que Vendas mostra). O resumo falso daqui
 * põe os dois com valores bem distintos — trocar um pelo outro na tela tem de
 * derrubar a asserção, e com os dois iguais passaria.
 *
 * Resumo do fixture:
 *   - faturamento_produtos 12.345,67 · faturamento 99.999,00 · 7 notas
 *     → ticket 12.345,67 / 7 = 1.763,67 (e não 99.999 / 7 = 14.285,57)
 *   - produto do topo "Bocal Alfa", R$ 5.000; o segundo, "Bocal Beta", R$ 900
 *     — o KPI é o PRIMEIRO do `por_produto`, e não o segundo.
 */

const { ESTADO } = vi.hoisted(() => ({
  ESTADO: {
    usuario: { id: 1, username: "erick", role: "admin" } as {
      id: number;
      username: string;
      role: string;
    },
    carregando: false,
    vazio: false,
    recortes: [] as RecorteComercial[],
  },
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: ESTADO.usuario }),
}));

vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { criarHooksFalsos, RESUMO_FALSO } = await import(
    "./comercial/hooksFalsos"
  );
  const cheio = {
    ...RESUMO_FALSO,
    kpis: {
      ...RESUMO_FALSO.kpis,
      faturamento_produtos: 12345.67,
      faturamento: 99999,
      notas: 7,
    },
    por_produto: [
      {
        chave: "A1",
        codigo: "A1",
        descricao: "Bocal Alfa",
        quantidade: 10,
        valor: 5000,
        notas: 3,
      },
      {
        chave: "B2",
        codigo: "B2",
        descricao: "Bocal Beta",
        quantidade: 4,
        valor: 900,
        notas: 2,
      },
    ],
  };
  // Dois vendedores com "erick" no nome e um sem — o papel "vendas" filtra
  // por continência do username, e não por igualdade.
  const falsos = criarHooksFalsos(
    [
      {
        id: 1,
        valor_nota: 1,
        nome_vendedor: "Erick Santos",
        data_emissao: "2026-01-01",
      },
      {
        id: 2,
        valor_nota: 1,
        nome_vendedor: "ERICK S.",
        data_emissao: "2026-01-02",
      },
      {
        id: 3,
        valor_nota: 1,
        nome_vendedor: "Maria Lima",
        data_emissao: "2026-01-03",
      },
    ],
    () => (ESTADO.vazio ? RESUMO_FALSO : cheio),
  );
  return {
    ...real,
    ...falsos,
    useResumoComercial: (recorte: RecorteComercial) => {
      ESTADO.recortes.push(recorte);
      const resposta = falsos.useResumoComercial(recorte);
      return { ...resposta, carregando: ESTADO.carregando };
    },
  };
});

vi.mock("../components/ToastProvider", () => ({
  useToast: () => ({
    sucesso: vi.fn(),
    erro: vi.fn(),
    aviso: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock("recharts", () => {
  const semDesenho = () => null;
  const caixa = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ResponsiveContainer: caixa,
    BarChart: caixa,
    LineChart: caixa,
    PieChart: caixa,
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
  ESTADO.usuario = { id: 1, username: "erick", role: "admin" };
  ESTADO.carregando = false;
  ESTADO.vazio = false;
  ESTADO.recortes.length = 0;
});

/** O cartão de KPI cujo rótulo é `rotulo` — escopa a busca do valor. */
function cartao(rotulo: string): HTMLElement {
  const alvo = screen
    .getByText(rotulo)
    .closest("div.rounded-xl") as HTMLElement | null;
  if (!alvo) throw new Error(`cartao de KPI "${rotulo}" nao encontrado`);
  return alvo;
}

describe("cabecalho de Vendedores", () => {
  it("mostra o titulo, o usuario logado com o papel e a frase de apoio", () => {
    render(<Vendedores />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Vendedores - Dashboard",
    );
    expect(screen.getByText("erick").parentElement).toHaveTextContent(
      "Bem-vindo, erick (admin)",
    );
    expect(
      screen.getByText(
        "Acompanhe suas métricas de vendas, evolução e gerencie suas notas.",
      ),
    ).toBeInTheDocument();
  });
});

describe("KPIs de Vendedores", () => {
  it("Faturamento Total e a soma da MERCADORIA, e nao do total da nota", () => {
    render(<Vendedores />);

    expect(cartao("Faturamento Total")).toHaveTextContent("R$ 12.345,67");
  });

  it("Numero de Vendas e a contagem de notas do resumo", () => {
    render(<Vendedores />);

    expect(cartao("Número de Vendas")).toHaveTextContent("7");
  });

  it("Ticket Medio divide a mercadoria pelo numero de notas", () => {
    render(<Vendedores />);

    expect(cartao("Ticket Médio")).toHaveTextContent("R$ 1.763,67");
  });

  it("Produto Top e o primeiro do ranking por produto, com o valor dele", () => {
    render(<Vendedores />);

    const topo = cartao("Produto Top");
    expect(topo).toHaveTextContent("Bocal Alfa");
    // Com as duas casas, como os outros três cartões: saía "R$ 5.000".
    expect(topo).toHaveTextContent("R$ 5.000,00");
    expect(topo).not.toHaveTextContent("Bocal Beta");
  });

  it("com resumo vazio, os KPIs zeram e o Produto Top diz N/A", () => {
    // Ticket com zero notas é 0, e não NaN: a divisão é protegida na tela.
    ESTADO.vazio = true;
    render(<Vendedores />);

    expect(cartao("Faturamento Total")).toHaveTextContent("R$ 0,00");
    expect(cartao("Número de Vendas")).toHaveTextContent("0");
    expect(cartao("Ticket Médio")).toHaveTextContent("R$ 0,00");
    expect(cartao("Produto Top")).toHaveTextContent("N/A");
    // Sem produto não há valor: a nota dizia "R$ 0". Como Clientes e Estoque.
    expect(cartao("Produto Top")).not.toHaveTextContent("R$");
  });
});

describe("carregando em Vendedores", () => {
  it("enquanto o resumo carrega, a tela mostra so a frase de espera", () => {
    ESTADO.carregando = true;
    render(<Vendedores />);

    // Frase completa com ponto, e não reticências — convenção de interface do
    // repositório, a mesma troca que Serviços fez.
    expect(screen.getByText("Carregando suas vendas.")).toBeInTheDocument();
    expect(screen.queryByText("Faturamento Total")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("recorte por papel em Vendedores", () => {
  it("quem e do papel vendas pede so os vendedores cujo nome contem o username, sem caixa", () => {
    ESTADO.usuario = { id: 9, username: "erick", role: "vendas" };
    render(<Vendedores />);

    const ultimo = ESTADO.recortes[ESTADO.recortes.length - 1];
    expect(ultimo.vendedores).toEqual(["Erick Santos", "ERICK S."]);
  });

  it("os outros papeis nao restringem vendedor nenhum", () => {
    ESTADO.usuario = { id: 1, username: "erick", role: "financeiro" };
    render(<Vendedores />);

    const ultimo = ESTADO.recortes[ESTADO.recortes.length - 1];
    expect(ultimo.vendedores).toEqual([]);
  });
});
