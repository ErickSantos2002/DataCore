import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkSheet } from "xlsx";

import Vendedores from "./Vendedores";
import { fetchVendas, type NotaVenda } from "../services/notasapi";
import { baixarPlanilha } from "../lib/planilha";

/**
 * Caracterização da exportação de Vendedores, antes de decompor a tela.
 *
 * Exportar NÃO usa a página da tela: a tela percorre `fetchVendas` de 500 em
 * 500 até o total e manda tudo para `baixarPlanilha`. O que se prende aqui:
 *   - o laço — quantas páginas pede e com qual recorte, busca e ordem;
 *   - o que entra em cada coluna, com valores distintos campo a campo;
 *   - o nome do arquivo e o ajuste da folha (largura e formato contábil nas
 *     colunas de valor, sem o qual o Excel lê o valor como texto e não soma);
 *   - a falha, que vira toast.
 *
 * ⚠️ O "Numero" sai com `substring(2)` do número da nota: 991001 vira 1001.
 * É o que a tela faz hoje, e está preso como está — não é endosso.
 */

const { ESTADO } = vi.hoisted(() => ({
  ESTADO: {
    toastErro: null as null | ReturnType<typeof vi.fn>,
  },
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { criarHooksFalsos } = await import("./comercial/hooksFalsos");
  return {
    ...real,
    ...criarHooksFalsos([
      {
        id: 1,
        valor_nota: 1,
        data_emissao: "2026-01-10",
        nome_vendedor: "Vendedor A",
        cliente: { nome: "Alfa Mineração", cpf_cnpj: "11.222.333/0001-44" },
        itens: [{ codigo: "B1", descricao: "Bocal" }],
      },
    ]),
  };
});

vi.mock("../services/notasapi", async (original) => {
  const real = await original<typeof import("../services/notasapi")>();
  return { ...real, fetchVendas: vi.fn(), updateNotaTipo: vi.fn() };
});

vi.mock("../lib/planilha", () => ({ baixarPlanilha: vi.fn() }));

vi.mock("../components/ToastProvider", () => ({
  useToast: () => ({
    sucesso: vi.fn(),
    erro: ESTADO.toastErro,
    aviso: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock("../components/ModalObservacoesDaNota", () => ({
  default: () => null,
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

const NOTA_COMPLETA: NotaVenda = {
  id: 7,
  numero: 991001,
  data_emissao: "2026-03-05",
  valor_nota: 1500.25,
  valor_produtos: 1234.5,
  cliente: { id: 1, nome: "Alfa Mineração", cpf_cnpj: "11.222.333/0001-44" },
  nome_vendedor: "Vendedor A",
  tipo: "Inbound",
  itens: [
    { codigo: "B1", descricao: "Bocal", quantidade: "10", valor_total: "100" },
    {
      codigo: "F1",
      descricao: "Bafômetro",
      quantidade: "1",
      valor_total: "1134.5",
    },
  ] as NotaVenda["itens"],
  tem_observacoes: false,
};

const NOTA_VAZIA = {
  id: 8,
  data_emissao: "",
  valor_nota: 0,
  valor_produtos: 0,
  cliente: null,
  nome_vendedor: "",
  tipo: null,
  itens: [],
} as unknown as NotaVenda;

beforeEach(() => {
  ESTADO.toastErro = vi.fn();
  vi.mocked(fetchVendas).mockReset();
  vi.mocked(baixarPlanilha).mockReset();
});

async function exportar() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Exportar Excel/ }));
  });
}

/** O primeiro argumento da última chamada a `baixarPlanilha`. */
function folhas() {
  const chamadas = vi.mocked(baixarPlanilha).mock.calls;
  const chamada = chamadas[chamadas.length - 1];
  if (!chamada) throw new Error("baixarPlanilha nao foi chamado");
  return { folhas: chamada[0], nome: chamada[1] };
}

describe("exportacao de Vendedores", () => {
  it("percorre as paginas de 500 em 500 ate o total, com recorte, busca e ordem da tela", async () => {
    vi.mocked(fetchVendas)
      .mockResolvedValueOnce({
        itens: [NOTA_COMPLETA],
        total: 700,
        valor_total: 0,
        limite: 500,
        offset: 0,
      })
      .mockResolvedValueOnce({
        itens: [NOTA_VAZIA],
        total: 700,
        valor_total: 0,
        limite: 500,
        offset: 500,
      });
    render(<Vendedores />);

    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
      target: { value: "  Alfa  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ordenar por Valor" }));
    await exportar();

    expect(fetchVendas).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetchVendas).mock.calls[0][0]).toMatchObject({
      busca: "Alfa",
      ordenar_por: "valor_produtos",
      direcao: "desc",
      limite: 500,
      offset: 0,
    });
    expect(vi.mocked(fetchVendas).mock.calls[1][0]).toMatchObject({
      offset: 500,
    });
    expect(folhas().folhas[0].linhas).toHaveLength(2);
  });

  it("cada campo da nota vai para a coluna que leva o nome dele", async () => {
    vi.mocked(fetchVendas).mockResolvedValueOnce({
      itens: [NOTA_COMPLETA],
      total: 1,
      valor_total: 0,
      limite: 500,
      offset: 0,
    });
    render(<Vendedores />);

    await exportar();

    const [folha] = folhas().folhas;
    expect(folha.nome).toBe("Minhas Vendas");
    expect(folha.linhas[0]).toEqual({
      Numero: 1001,
      Data: "05/03/2026",
      Cliente: "Alfa Mineração",
      CNPJ: "11.222.333/0001-44",
      "Valor Produtos": 1234.5,
      "Valor Nota": 1500.25,
      Tipo: "Inbound",
      Vendedor: "Vendedor A",
      Produtos: "Bocal, Bafômetro",
    });
  });

  it("a nota sem dado sai com as reservas de cada coluna", async () => {
    vi.mocked(fetchVendas).mockResolvedValueOnce({
      itens: [NOTA_VAZIA],
      total: 1,
      valor_total: 0,
      limite: 500,
      offset: 0,
    });
    render(<Vendedores />);

    await exportar();

    expect(folhas().folhas[0].linhas[0]).toEqual({
      Numero: "",
      Data: "",
      Cliente: "",
      CNPJ: "",
      "Valor Produtos": 0,
      "Valor Nota": 0,
      Tipo: "Não definido",
      Vendedor: "",
      Produtos: "",
    });
  });

  it("o arquivo leva o usuario e o dia, e a folha ganha largura e formato contabil nas colunas de valor", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 15, 23, 30));
    vi.mocked(fetchVendas).mockResolvedValueOnce({
      itens: [NOTA_COMPLETA],
      total: 1,
      valor_total: 0,
      limite: 500,
      offset: 0,
    });
    render(<Vendedores />);

    await exportar();
    vi.useRealTimers();

    const {
      folhas: [folha],
      nome,
    } = folhas();
    expect(nome).toBe("vendas_erick_2026-09-15.xlsx");

    const planilha: WorkSheet = {
      A2: { t: "n", v: 1001 },
      E2: { t: "n", v: 1234.5 },
      F2: { t: "n", v: 1500.25 },
      G2: { t: "s", v: "Inbound" },
    };
    folha.ajustar!(planilha);
    expect(planilha["!cols"]).toEqual([
      { wch: 10 },
      { wch: 12 },
      { wch: 40 },
      { wch: 18 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
      { wch: 50 },
    ]);
    expect(planilha.E2.z).toBe("#,##0.00");
    expect(planilha.F2.z).toBe("#,##0.00");
    expect(planilha.A2.z).toBeUndefined();
    expect(planilha.G2.z).toBeUndefined();
  });

  it("enquanto exporta, o botao diz que esta exportando, desabilita e nao dispara de novo", async () => {
    // `exportando` existia na casca e ninguém lia: o botão seguia clicável
    // durante a busca de todas as páginas, sem nada dizendo que algo
    // acontecia — a pessoa clicava de novo e a busca inteira recomeçava.
    let liberar: () => void = () => {};
    vi.mocked(fetchVendas).mockImplementationOnce(
      () =>
        new Promise((resolver) => {
          liberar = () =>
            resolver({
              itens: [NOTA_COMPLETA],
              total: 1,
              valor_total: 0,
              limite: 500,
              offset: 0,
            });
        }),
    );
    render(<Vendedores />);

    fireEvent.click(screen.getByRole("button", { name: /Exportar Excel/ }));
    const botao = screen.getByRole("button", { name: /Exportando/ });
    expect(botao).toBeDisabled();
    fireEvent.click(botao);
    expect(fetchVendas).toHaveBeenCalledTimes(1);

    await act(async () => {
      liberar();
    });
    expect(
      screen.getByRole("button", { name: /Exportar Excel/ }),
    ).toBeEnabled();
    expect(baixarPlanilha).toHaveBeenCalledTimes(1);
  });

  it("com a tabela vazia, exportar fica desabilitado", () => {
    // Sem nenhuma linha, o clique gerava uma planilha só com o cabeçalho —
    // arquivo vazio que sai por e-mail parecendo resultado.
    render(<Vendedores />);

    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
      target: { value: "zzz-nao-existe" },
    });

    expect(
      screen.getByRole("button", { name: /Exportar Excel/ }),
    ).toBeDisabled();
  });

  it("se a busca falha, o toast avisa e nenhuma planilha sai", async () => {
    vi.mocked(fetchVendas).mockRejectedValueOnce(new Error("rede"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Vendedores />);

    await exportar();

    expect(ESTADO.toastErro).toHaveBeenCalledWith(
      "Não foi possível exportar as vendas.",
    );
    expect(baixarPlanilha).not.toHaveBeenCalled();
  });
});
