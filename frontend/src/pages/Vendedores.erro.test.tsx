import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Vendedores from "./Vendedores";
import type {
  PedidoDaTabela,
  RecorteComercial,
} from "./comercial/useComercial";

/**
 * O que a tela de Vendedores diz quando a busca falha.
 *
 * `useResumoComercial` e `useVendasPaginadas` já caíam no `catch`, gravavam o
 * vazio e devolviam `erro` — e a casca descartava os dois. Com a API caída, a
 * pessoa via "R$ 0,00", "0" vendas, "N/A", três gráficos vazios e "Nenhum
 * resultado encontrado.", e lia "não vendi nada nesse período". Mesmo defeito
 * que Serviços teve (`Servicos.erro.test.tsx`), e mesmo conserto: `Alert
 * variant="danger"` no fluxo da página, e não toast, que some em 4 s.
 *
 * ⚠️ A frase é da tela, e não a do hook: `comercial/useComercial.ts` — que é da
 * outra frente e não se toca — grava a mensagem SEM acento ("Nao foi
 * possivel..."), e a interface é em português com acento.
 *
 * `hooksFalsos.ts` devolve `erro: null` sempre; os dois hooks falsos são
 * embrulhados, e `FALHA` troca o retorno pelo que o `catch` de verdade grava.
 */

const { FALHA, FRASE } = vi.hoisted(() => ({
  FALHA: { resumo: false, pagina: false },
  FRASE:
    "Não foi possível carregar as vendas. Confira a conexão e recarregue a página.",
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { criarHooksFalsos, RESUMO_FALSO } = await import(
    "./comercial/hooksFalsos"
  );
  const falsos = criarHooksFalsos([
    {
      id: 1,
      valor_nota: 100,
      valor_produtos: 90,
      data_emissao: "2026-01-10",
      cliente: { nome: "Alfa Mineração", cpf_cnpj: "11.222.333/0001-44" },
      nome_vendedor: "Vendedor A",
      itens: [],
    },
  ]);
  const PAGINA_VAZIA = {
    itens: [],
    total: 0,
    valor_total: 0,
    limite: 15,
    offset: 0,
  };
  return {
    ...real,
    ...falsos,
    useResumoComercial: (recorte: RecorteComercial) => {
      const bom = falsos.useResumoComercial(recorte);
      if (!FALHA.resumo) return bom;
      return {
        ...bom,
        resumo: RESUMO_FALSO,
        erro: "Nao foi possivel carregar os dados do periodo.",
      };
    },
    useVendasPaginadas: (recorte: RecorteComercial, pedido: PedidoDaTabela) => {
      const bom = falsos.useVendasPaginadas(recorte, pedido);
      if (!FALHA.pagina) return bom;
      return {
        ...bom,
        pagina: PAGINA_VAZIA,
        erro: "Nao foi possivel carregar as notas.",
      };
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
  FALHA.resumo = false;
  FALHA.pagina = false;
});

describe("falha de rede na tela de Vendedores", () => {
  it("o resumo falhando, a tela avisa em bloco", () => {
    FALHA.resumo = true;
    render(<Vendedores />);

    expect(screen.getByRole("alert")).toHaveTextContent(FRASE);
  });

  it("a pagina da tabela falhando, a tela avisa em bloco tambem", () => {
    FALHA.pagina = true;
    render(<Vendedores />);

    expect(screen.getByRole("alert")).toHaveTextContent(FRASE);
  });

  it("as duas falhando, o aviso aparece uma vez so", () => {
    FALHA.resumo = true;
    FALHA.pagina = true;
    render(<Vendedores />);

    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("o aviso nao repete a frase sem acento do hook", () => {
    FALHA.resumo = true;
    render(<Vendedores />);

    expect(screen.queryByText(/Nao foi possivel/)).not.toBeInTheDocument();
  });

  it("busca que da certo nao desenha aviso nenhum", () => {
    render(<Vendedores />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
