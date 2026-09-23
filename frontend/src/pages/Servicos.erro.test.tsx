import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Servicos from "./Servicos";
import type {
  PedidoDaTabelaDeServicos,
  RecorteDeServicos,
} from "./servicos/useServicos";

/**
 * O que a tela de Serviços diz quando a busca falha.
 *
 * Os dois hooks (`useResumoDeServicos` e `usePaginaDeServicos`, em
 * `servicos/useServicos.ts`) já caíam no `catch`, gravavam `RESUMO_VAZIO` e
 * `PAGINA_VAZIA` e devolviam `erro` com a frase pronta — e a casca descartava
 * os dois. Com a API de notas caída, a pessoa via uma tela inteira e
 * plausível: "R$ 0,00", "0" NFS-e, "N/A" no Top Cliente, três gráficos
 * vazios, "Nenhum resultado encontrado." e os dois botões de exportar
 * desabilitados. Ela lia "não houve serviços nesse período" e ia embora.
 * Nada dizia que a rede tinha falhado.
 *
 * O aviso é `Alert variant="danger"` no fluxo da página, e não `Toast`: o
 * estado é permanente até recarregar, e um toast some em quatro segundos e
 * deixa a pessoa diante da tela vazia sem explicação. Mesmo padrão da gêmea
 * já migrada (`contas/TelaDeContas.tsx`) e da tela de Locação; o
 * `role="alert"` do primitivo anuncia sozinho.
 *
 * Este arquivo existe porque `hooksFalsos.ts` — que é da outra frente e não
 * se toca — devolve `erro: null` sempre. Os dois hooks falsos são
 * **embrulhados**, não substituídos: quem responde continua sendo o falso, e
 * `FALHA` só troca o retorno pelo que o `catch` do hook de verdade grava.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const { SERVICOS, FALHA, FRASE } = vi.hoisted(() => ({
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
  ],
  /** Qual das duas buscas falha neste teste. */
  FALHA: { resumo: false, pagina: false },
  /** A frase que os dois hooks gravam no `catch` — é ela que tem de aparecer. */
  FRASE: "Não foi possível carregar as notas de serviço.",
}));

vi.mock("./servicos/useServicos", async (original) => {
  const real = await original<typeof import("./servicos/useServicos")>();
  const { criarHooksFalsosDeServicos } = await import("./servicos/hooksFalsos");
  const falsos = criarHooksFalsosDeServicos(SERVICOS);

  // O que o `catch` de cada hook grava: o vazio, e não a ausência de dado —
  // é essa combinação (tela plausível + zero) que fazia a falha passar por
  // "não há serviço nesse período".
  const RESUMO_VAZIO = {
    kpis: { faturamento: 0, notas: 0, ticket_medio: 0 },
    evolucao_mensal: [],
    por_cliente: [],
    por_cidade: [],
    opcoes: { clientes: [], cidades: [], tipos: [] },
  };
  const PAGINA_VAZIA = {
    itens: [],
    total: 0,
    valor_total: 0,
    limite: 0,
    offset: 0,
  };

  return {
    ...real,
    ...falsos,
    useResumoDeServicos: (recorte: RecorteDeServicos) => {
      // O falso é chamado sempre, e não dentro do `if`: ele usa `useMemo`, e
      // pular a chamada mudaria a ordem dos hooks entre renders.
      const bom = falsos.useResumoDeServicos(recorte);
      if (!FALHA.resumo) return bom;
      return { resumo: RESUMO_VAZIO, carregando: false, erro: FRASE };
    },
    usePaginaDeServicos: (
      recorte: RecorteDeServicos,
      pedido: PedidoDaTabelaDeServicos,
    ) => {
      const bom = falsos.usePaginaDeServicos(recorte, pedido);
      if (!FALHA.pagina) return bom;
      return { pagina: PAGINA_VAZIA, carregando: false, erro: FRASE };
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
  FALHA.resumo = false;
  FALHA.pagina = false;
});

describe("falha de rede na tela de Serviços", () => {
  it("o resumo falhando, a tela avisa em bloco e nao finge que nao ha servico", () => {
    FALHA.resumo = true;
    render(<Servicos />);

    expect(screen.getByRole("alert")).toHaveTextContent(FRASE);
    // As duas metades importam: sem a segunda, um aviso que aparecesse SEMPRE
    // passaria por conserto. É a tela zerada com o aviso em cima que separa
    // "a API caiu" de "não houve serviço nesse período" — o "N/A" do Top
    // Cliente é o sinal do resumo vazio que o `catch` gravou.
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("a pagina da tabela falhando, a tela avisa em bloco tambem", () => {
    // A tabela é uma consulta à parte, e falha sozinha: os KPIs continuam
    // certos e só a lista some. Sem ler este segundo `erro`, esse caso ficava
    // mudo mesmo com o primeiro tratado.
    FALHA.pagina = true;
    render(<Servicos />);

    expect(screen.getByRole("alert")).toHaveTextContent(FRASE);
    expect(
      screen.getByText("Nenhum resultado encontrado."),
    ).toBeInTheDocument();
  });

  it("as duas falhando, o aviso aparece uma vez so", () => {
    // Duas buscas que caem pela mesma queda de rede são um evento só; dois
    // blocos vermelhos idênticos empilhados diriam a mesma coisa duas vezes.
    FALHA.resumo = true;
    FALHA.pagina = true;
    render(<Servicos />);

    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("busca que da certo nao desenha aviso nenhum", () => {
    render(<Servicos />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(FRASE)).not.toBeInTheDocument();
  });
});
