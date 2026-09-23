import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Vendas from "./Vendas";
import { fetchVendas, type NotaVenda } from "../services/notasapi";
import { baixarPlanilha } from "../lib/planilha";
import { ESTADO_VENDAS, reiniciarEstadoDeVendas } from "./vendas/vendasFalsas";

/**
 * Caracterização da exportação de Vendas, antes de decompor a tela.
 *
 * Exportar NÃO usa a página da tela: a tela percorre `fetchVendas` de 500 em
 * 500 até o total e manda tudo para `baixarPlanilha`. O que se prende aqui:
 *   - o laço — quantas páginas pede e com qual recorte, busca e ordem;
 *   - o que entra em cada coluna, com valores distintos campo a campo;
 *   - o nome do arquivo, no dia local;
 *   - a falha, que hoje só escreve no console.
 *
 * A coluna "Data" saía com um dia a menos em Brasília: a tela a montava com
 * `new Date("2026-03-05")`, que é meia-noite em UTC — em São Paulo ainda é dia
 * 4. O teste só fica vermelho rodando a oeste de Greenwich, e é por isso que a
 * suíte roda nos dois fusos.
 */

const { TOAST } = vi.hoisted(() => ({
  TOAST: { erro: null as null | ReturnType<typeof vi.fn> },
}));

vi.mock("../components/ToastProvider", () => ({
  useToast: () => ({
    sucesso: vi.fn(),
    erro: TOAST.erro,
    aviso: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { hooksDeVendas } = await import("./vendas/vendasFalsas");
  return { ...real, ...hooksDeVendas() };
});

vi.mock("../services/notasapi", async (original) => {
  const real = await original<typeof import("../services/notasapi")>();
  return { ...real, fetchVendas: vi.fn() };
});

vi.mock("../lib/planilha", () => ({ baixarPlanilha: vi.fn() }));

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
  data_emissao: "2026-02-10",
  valor_nota: 0,
  cliente: null,
  nome_vendedor: "",
  itens: [],
} as unknown as NotaVenda;

/** Uma resposta de `fetchVendas` com `total` notas, das quais vêm só estas. */
const resposta = (itens: NotaVenda[], total: number) => ({
  itens,
  total,
  valor_total: 0,
  limite: 500,
  offset: 0,
});

beforeEach(() => {
  TOAST.erro = vi.fn();
  reiniciarEstadoDeVendas();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 15, 15, 0, 0));
  vi.mocked(fetchVendas).mockReset();
  vi.mocked(baixarPlanilha).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

async function exportar() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Exportar Excel/ }));
  });
}

/** Os parâmetros da chamada `i` a `fetchVendas`. */
function parametros(i: number) {
  const chamada = vi.mocked(fetchVendas).mock.calls[i];
  if (!chamada?.[0]) throw new Error(`fetchVendas sem a chamada ${i}`);
  return chamada[0];
}

function planilha() {
  const chamada = vi.mocked(baixarPlanilha).mock.calls[0];
  if (!chamada) throw new Error("baixarPlanilha nao foi chamado");
  const [abas, arquivo] = chamada;
  return { abas, arquivo };
}

describe("exportacao de Vendas", () => {
  it("percorre as paginas de 500 em 500 ate o total", async () => {
    vi.mocked(fetchVendas).mockResolvedValue(resposta([NOTA_COMPLETA], 1200));
    render(<Vendas />);
    await exportar();

    const offsets = vi.mocked(fetchVendas).mock.calls.map((c) => c[0]?.offset);
    expect(offsets).toEqual([0, 500, 1000]);
    expect(parametros(0)).toMatchObject({
      limite: 500,
      ordenar_por: "data_emissao",
      direcao: "desc",
    });
    expect(planilha().abas[0].linhas).toHaveLength(3);
  });

  it("leva o recorte, a busca sem espaco das pontas e a ordem escolhida", async () => {
    vi.mocked(fetchVendas).mockResolvedValue(resposta([NOTA_COMPLETA], 1));
    render(<Vendas />);

    fireEvent.click(
      screen.getByRole("button", { name: "Vendedores Todos os vendedores" }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Vendedor B" }));
    // Fecha o dropdown: ele tem o próprio "Pesquisar...".
    fireEvent.mouseDown(document.body);
    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
      // "kit" casa com a nota do Vendedor B no fixture: um recorte sem nota
      // deixaria o botão desabilitado, e o clique não exportaria.
      target: { value: "  kit  " },
    });
    fireEvent.click(screen.getByText("Valor"));
    await exportar();

    expect(parametros(0)).toMatchObject({
      vendedor: ["Vendedor B"],
      busca: "kit",
      ordenar_por: "valor",
      direcao: "desc",
    });
  });

  it("sem busca, o parametro nao vai", async () => {
    vi.mocked(fetchVendas).mockResolvedValue(resposta([NOTA_COMPLETA], 1));
    render(<Vendas />);
    await exportar();
    expect(parametros(0).busca).toBeUndefined();
  });

  it("uma aba 'Vendas', nome do arquivo no dia local, e as seis colunas", async () => {
    vi.mocked(fetchVendas).mockResolvedValue(
      resposta([NOTA_COMPLETA, NOTA_VAZIA], 2),
    );
    render(<Vendas />);
    await exportar();

    const { abas, arquivo } = planilha();
    expect(arquivo).toBe("vendas_2026-09-15.xlsx");
    expect(abas.map((a) => a.nome)).toEqual(["Vendas"]);

    const [completa, vazia] = abas[0].linhas;
    expect(Object.keys(completa)).toEqual([
      "Data",
      "Cliente",
      "CNPJ",
      "Valor",
      "Vendedor",
      "Produtos",
    ]);
    expect(completa).toMatchObject({
      Data: "05/03/2026",
      Cliente: "Alfa Mineração",
      CNPJ: "11.222.333/0001-44",
      Valor: 1500.25,
      Vendedor: "Vendedor A",
      Produtos: "Bocal, Bafômetro",
    });
    expect(vazia).toMatchObject({
      Data: "10/02/2026",
      Cliente: "",
      CNPJ: "",
      Valor: 0,
      Vendedor: "",
      Produtos: "",
    });
  });

  it("a falha da busca nao gera planilha, nao derruba a tela e avisa", async () => {
    const console = vi
      .spyOn(globalThis.console, "error")
      .mockImplementation(() => {});
    vi.mocked(fetchVendas).mockRejectedValue(new Error("rede"));
    render(<Vendas />);
    await exportar();

    expect(baixarPlanilha).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /Exportar Excel/ }),
    ).toBeEnabled();
    // Só escrevia no console: a pessoa clicava, o botão girava e nada
    // acontecia. Toast, porque é retorno de uma ação que ela acabou de tomar.
    expect(TOAST.erro).toHaveBeenCalledWith(
      "Não foi possível exportar as vendas.",
    );
    console.mockRestore();
  });
  it("durante a exportacao o botao desabilita, e volta quando termina", async () => {
    // Nada impedia o segundo clique: cada um disparava o laço inteiro de novo,
    // e saíam duas planilhas.
    let terminar: (valor: ReturnType<typeof resposta>) => void = () => {};
    vi.mocked(fetchVendas).mockReturnValue(
      new Promise((resolver) => {
        terminar = resolver;
      }),
    );
    render(<Vendas />);
    await exportar();

    const botao = screen.getByRole("button", { name: /Exportar Excel/ });
    expect(botao).toBeDisabled();
    fireEvent.click(botao);
    expect(fetchVendas).toHaveBeenCalledTimes(1);

    await act(async () => terminar(resposta([NOTA_COMPLETA], 1)));
    expect(
      screen.getByRole("button", { name: /Exportar Excel/ }),
    ).toBeEnabled();
    expect(baixarPlanilha).toHaveBeenCalledTimes(1);
  });

  it("sem nota no recorte, o botao desabilita e nada sai", async () => {
    // Saía planilha só com o cabeçalho.
    ESTADO_VENDAS.vazio = true;
    render(<Vendas />);

    expect(
      screen.getByRole("button", { name: /Exportar Excel/ }),
    ).toBeDisabled();
    await exportar();
    expect(fetchVendas).not.toHaveBeenCalled();
  });
});
