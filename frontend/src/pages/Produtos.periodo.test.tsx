import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Produtos from "./Produtos";

/**
 * O preset de período em Produtos, depois da adoção do `periodoDoPreset`.
 *
 * O que se fixa aqui é a fiação: escolher no `<select>` de período tem de
 * escrever as duas datas nos campos. A conta em si mora em `src/lib/periodo.ts`
 * e tem teste unitário próprio; este arquivo prova que a tela chama a conta.
 *
 * Os `vi.mock` e os fixtures abaixo são cópia do `Produtos.paginacao.test.tsx` —
 * é a mesma tela, com as mesmas dependências, e duplicar o cabeçalho custa
 * menos que um helper compartilhado que acopla os dois arquivos.
 *
 * O relógio é fixado em 15/03/2026: as asserções falam de "mês atual" e "ano
 * atual", e sem relógio fixo o teste passaria hoje e falharia em abril.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const { NOTAS } = vi.hoisted(() => {
  const ITENS = Array.from({ length: 17 }, (_, i) => ({
    codigo: `P${String(i + 1).padStart(2, "0")}`,
    descricao: `Produto ${String(i + 1).padStart(2, "0")}`,
    quantidade: String(17 - i),
    valor_total: "100",
  }));
  return {
    NOTAS: [
      {
        id: 1,
        data_emissao: "2026-01-10",
        valor_nota: 1200,
        cliente: { nome: "Alfa Mineração", cpf_cnpj: "11.222.333/0001-44" },
        nome_vendedor: "Vendedor A",
        itens: ITENS,
      },
    ],
  };
});

// A tela deixou de ler o `DataContext` (item 9.4): a agregação vem somada do
// banco. O falso mora em `comercial/hooksFalsos`, e para esta tela o que importa
// é o `por_produto` — é ele que virou a tabela.
vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { criarHooksFalsos, resumoDeProdutos } = await import(
    "./comercial/hooksFalsos"
  );
  return { ...real, ...criarHooksFalsos(NOTAS, resumoDeProdutos) };
});

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

/**
 * O preset de período em Produtos, depois da adoção do `periodoDoPreset`.
 *
 * O relógio é fixado em 15/03/2026 porque as asserções falam de "mês atual" e
 * "ano atual": sem relógio fixo o teste passaria hoje e falharia em abril.
 * Só o `Date` é falso — os timers de verdade continuam rodando.
 */
const HOJE = new Date("2026-03-15T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(HOJE);
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * O bloco de um filtro, achado pelo TEXTO do rótulo.
 *
 * Não dá para usar `getByLabelText`: as cinco telas não têm um único
 * `htmlFor` — os `<label>` são irmãos do campo, não estão associados a ele.
 * É lacuna de acessibilidade real, registrada no documento de divergências,
 * e consertá-la é mudança de markup numa tela que segue em PENDENTES_FASE_3.
 * Este é o mesmo contorno que `ContasPagar.test.tsx:435` usa.
 */
function blocoDoFiltro(rotulo: string): HTMLElement {
  const etiqueta = screen.getByText(rotulo);
  if (!etiqueta.parentElement) throw new Error(`filtro "${rotulo}" sem bloco`);
  return etiqueta.parentElement;
}

function campoData(rotulo: "Data Início" | "Data Fim"): HTMLInputElement {
  const campo = blocoDoFiltro(rotulo).querySelector("input");
  if (!campo) throw new Error(`campo "${rotulo}" nao existe`);
  return campo as HTMLInputElement;
}

function seletorDePreset(): HTMLSelectElement {
  const campo = blocoDoFiltro("Período Rápido").querySelector("select");
  if (!campo) throw new Error("seletor de preset nao existe");
  return campo as HTMLSelectElement;
}

function escolherPreset(valor: string): void {
  fireEvent.change(seletorDePreset(), { target: { value: valor } });
}

describe("preset de periodo em Produtos", () => {
  it("oferece as sete opcoes, na ordem da lista compartilhada", () => {
    render(<Produtos />);
    expect(Array.from(seletorDePreset().options).map((o) => o.value)).toEqual([
      "todos",
      "7dias",
      "30dias",
      "mesAtual",
      "mesPassado",
      "anoAtual",
      "custom",
    ]);
  });

  it("Mes atual vai do dia 1 ao ULTIMO dia do mes, e nao ate hoje", () => {
    // Este é o caso que muda. Antes, "Mês atual" era o RÓTULO da chave
    // `30dias`, e devolvia 01/03 a 15/03 — o mês até hoje. Agora a chave
    // `mesAtual` existe e devolve o mês do calendário inteiro.
    render(<Produtos />);
    escolherPreset("mesAtual");

    expect(campoData("Data Início")).toHaveValue("2026-03-01");
    expect(campoData("Data Fim")).toHaveValue("2026-03-31");
  });

  it("Ultimos 30 dias conta 30 dias para tras", () => {
    render(<Produtos />);
    escolherPreset("30dias");

    expect(campoData("Data Início")).toHaveValue("2026-02-13");
    expect(campoData("Data Fim")).toHaveValue("2026-03-15");
  });

  it("Últimos 7 dias mantém a janela, agora contada no dia local", () => {
    render(<Produtos />);
    escolherPreset("7dias");

    expect(campoData("Data Início")).toHaveValue("2026-03-08");
    expect(campoData("Data Fim")).toHaveValue("2026-03-15");
  });

  it("Ano atual vai do 1 de janeiro ao 31 de dezembro", () => {
    // Antes terminava HOJE, porque o `switch` não sobrescrevia o `fim` que já
    // tinha sido inicializado com a data de hoje.
    render(<Produtos />);
    escolherPreset("anoAtual");

    expect(campoData("Data Início")).toHaveValue("2026-01-01");
    expect(campoData("Data Fim")).toHaveValue("2026-12-31");
  });

  it("Todos limpa as duas datas", () => {
    render(<Produtos />);
    escolherPreset("anoAtual");

    expect(campoData("Data Início")).toHaveValue("2026-01-01");
    expect(campoData("Data Fim")).toHaveValue("2026-12-31");

    escolherPreset("todos");

    expect(campoData("Data Início")).toHaveValue("");
    expect(campoData("Data Fim")).toHaveValue("");
  });

  it("digitar a data de inicio na mao leva o preset para Personalizado", () => {
    // O `onChange` do `<select>` estava coberto; o caminho inverso, não.
    // Tirar o `setPresetPeriodo("custom")` do `onDataInicio` (`Produtos.tsx`)
    // passava verde na suíte inteira. Cenário: a pessoa escolhe "Este ano",
    // depois digita 01/03/2026 em "Data Início" — o select continua escrito
    // "Este ano" enquanto o intervalo consultado é outro. E como o efeito só
    // reage a MUDANÇA de preset, nada volta a alinhar os dois: o rótulo mente
    // até alguém trocar o preset de novo.
    render(<Produtos />);
    escolherPreset("anoAtual");
    expect(seletorDePreset()).toHaveValue("anoAtual");

    fireEvent.change(campoData("Data Início"), {
      target: { value: "2026-03-01" },
    });

    expect(seletorDePreset()).toHaveValue("custom");
    // A data digitada tem de sobreviver: se o preset virasse outro que não
    // "custom", o efeito reescreveria as duas datas por cima.
    expect(campoData("Data Início")).toHaveValue("2026-03-01");
    expect(campoData("Data Fim")).toHaveValue("2026-12-31");
  });

  it("digitar a data de fim na mao tambem leva o preset para Personalizado", () => {
    // O outro lado do mesmo fio — `onDataFim` repete a decisão de
    // `onDataInicio` e some com a mesma facilidade.
    render(<Produtos />);
    escolherPreset("anoAtual");

    fireEvent.change(campoData("Data Fim"), {
      target: { value: "2026-06-30" },
    });

    expect(seletorDePreset()).toHaveValue("custom");
    expect(campoData("Data Início")).toHaveValue("2026-01-01");
    expect(campoData("Data Fim")).toHaveValue("2026-06-30");
  });

  it("Personalizado nao mexe nas datas que ja estavam la", () => {
    render(<Produtos />);
    escolherPreset("anoAtual");
    escolherPreset("custom");

    expect(campoData("Data Início")).toHaveValue("2026-01-01");
    expect(campoData("Data Fim")).toHaveValue("2026-12-31");
  });
});
