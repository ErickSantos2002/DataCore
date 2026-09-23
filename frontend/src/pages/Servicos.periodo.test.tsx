import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import Servicos from "./Servicos";

/**
 * O preset de período em Servicos, depois da adoção do `periodoDoPreset`.
 *
 * O que se fixa aqui é a fiação: escolher no `<select>` de período tem de
 * escrever as duas datas nos campos. A conta em si mora em `src/lib/periodo.ts`
 * e tem teste unitário próprio; este arquivo prova que a tela chama a conta.
 *
 * Os `vi.mock` e os fixtures abaixo são cópia do `Servicos.paginacao.test.tsx` —
 * é a mesma tela, com as mesmas dependências, e duplicar o cabeçalho custa
 * menos que um helper compartilhado que acopla os dois arquivos.
 *
 * O relógio é fixado em 15/03/2026: as asserções falam de "mês atual" e "ano
 * atual", e sem relógio fixo o teste passaria hoje e falharia em abril.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const { SERVICOS_ENRIQUECIDOS } = vi.hoisted(() => ({
  SERVICOS_ENRIQUECIDOS: Array.from({ length: 17 }, (_, i) => ({
    id: i + 1,
    numero_nfse: String(1000 + i + 1),
    data_emissao: `2026-01-${String(i + 1).padStart(2, "0")}`,
    valor_servico: 100 + i,
    razao_social_tomador: `Cliente ${String(i + 1).padStart(2, "0")}`,
    cpf_cnpj_tomador: `11.111.111/0001-${String(i + 1).padStart(2, "0")}`,
    cidade_tomador: "Recife",
    uf_tomador: "PE",
    discriminacao_servico: `Servico ${String(i + 1).padStart(2, "0")}`,
    valor_servico_numero: 100 + i,
    mes: "janeiro",
    ano: 2026,
  })),
}));

// A tela deixou de ler o `ServicosContext` (item 9.4): os agregados vêm somados
// do banco e a tabela vem paginada. O falso mora em `servicos/hooksFalsos`.
vi.mock("./servicos/useServicos", async (original) => {
  const real = await original<typeof import("./servicos/useServicos")>();
  const { criarHooksFalsosDeServicos } = await import("./servicos/hooksFalsos");
  return { ...real, ...criarHooksFalsosDeServicos(SERVICOS_ENRIQUECIDOS) };
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
 * O preset de período em Servicos, depois da adoção do `periodoDoPreset`.
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

function campoData(rotulo: "Início" | "Fim"): HTMLInputElement {
  const campo = blocoDoFiltro(rotulo).querySelector("input");
  if (!campo) throw new Error(`campo "${rotulo}" nao existe`);
  return campo as HTMLInputElement;
}

function seletorDePreset(): HTMLSelectElement {
  const campo = blocoDoFiltro("Período").querySelector("select");
  if (!campo) throw new Error("seletor de preset nao existe");
  return campo as HTMLSelectElement;
}

function escolherPreset(valor: string): void {
  fireEvent.change(seletorDePreset(), { target: { value: valor } });
}

describe("preset de periodo em Servicos", () => {
  it("oferece as sete opcoes, na ordem da lista compartilhada", () => {
    render(<Servicos />);
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
    render(<Servicos />);
    escolherPreset("mesAtual");

    expect(campoData("Início")).toHaveValue("2026-03-01");
    expect(campoData("Fim")).toHaveValue("2026-03-31");
  });

  it("Ultimos 30 dias conta 30 dias para tras", () => {
    render(<Servicos />);
    escolherPreset("30dias");

    expect(campoData("Início")).toHaveValue("2026-02-13");
    expect(campoData("Fim")).toHaveValue("2026-03-15");
  });

  it("Últimos 7 dias mantém a janela, agora contada no dia local", () => {
    render(<Servicos />);
    escolherPreset("7dias");

    expect(campoData("Início")).toHaveValue("2026-03-08");
    expect(campoData("Fim")).toHaveValue("2026-03-15");
  });

  it("Ano atual vai do 1 de janeiro ao 31 de dezembro", () => {
    // Antes terminava HOJE, porque o `switch` não sobrescrevia o `fim` que já
    // tinha sido inicializado com a data de hoje.
    render(<Servicos />);
    escolherPreset("anoAtual");

    expect(campoData("Início")).toHaveValue("2026-01-01");
    expect(campoData("Fim")).toHaveValue("2026-12-31");
  });

  it("Todos limpa as duas datas", () => {
    render(<Servicos />);
    escolherPreset("anoAtual");

    expect(campoData("Início")).toHaveValue("2026-01-01");
    expect(campoData("Fim")).toHaveValue("2026-12-31");

    escolherPreset("todos");

    expect(campoData("Início")).toHaveValue("");
    expect(campoData("Fim")).toHaveValue("");
  });

  it("Personalizado nao mexe nas datas que ja estavam la", () => {
    render(<Servicos />);
    escolherPreset("anoAtual");
    escolherPreset("custom");

    expect(campoData("Início")).toHaveValue("2026-01-01");
    expect(campoData("Fim")).toHaveValue("2026-12-31");
  });
});
