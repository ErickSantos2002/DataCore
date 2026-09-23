import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import autoTable from "jspdf-autotable";

import Servicos from "./Servicos";

/**
 * O corte do PDF de Serviços em 30 linhas.
 *
 * Cortava sem avisar: quem abria o PDF lia o recorte inteiro. Decisão do Erick
 * (22/09): mantém o corte, e o PDF diz que cortou. Arquivo próprio porque o
 * fixture de `Servicos.exportacao.test.tsx` tem duas notas, e o assunto aqui
 * precisa de 31.
 *
 * O falso de `useServicos` é da outra frente (`servicos/hooksFalsos.ts`):
 * este arquivo só o importa, com 31 notas, e usa o `todosOsServicos` dele,
 * que resolve na hora com todas.
 */

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

vi.mock("../lib/planilha", () => ({ baixarPlanilha: vi.fn() }));

const { PDF } = vi.hoisted(() => ({ PDF: { textos: [] as string[] } }));

vi.mock("jspdf", () => ({
  default: class {
    setFontSize() {}
    text(texto: string) {
      PDF.textos.push(texto);
    }
    save() {}
  },
}));

vi.mock("jspdf-autotable", () => ({ default: vi.fn() }));

const { QUANTAS } = vi.hoisted(() => ({ QUANTAS: { notas: 31 } }));

vi.mock("./servicos/useServicos", async (original) => {
  const real = await original<typeof import("./servicos/useServicos")>();
  const { criarHooksFalsosDeServicos } = await import("./servicos/hooksFalsos");
  const nota = (i: number) => ({
    id: i + 1,
    numero_nfse: 5000 + i,
    data_emissao: "2026-09-10",
    valor_servico: 100 + i,
    razao_social_tomador: `Cliente ${String(i + 1).padStart(2, "0")}`,
    cpf_cnpj_tomador: "11.222.333/0001-44",
    cidade_tomador: "Recife",
    uf_tomador: "PE",
    discriminacao_servico: "Calibração de bafômetro",
  });
  const com31 = criarHooksFalsosDeServicos(
    Array.from({ length: 31 }, (_, i) => nota(i)),
  );
  const com30 = criarHooksFalsosDeServicos(
    Array.from({ length: 30 }, (_, i) => nota(i)),
  );
  const escolher = () => (QUANTAS.notas === 31 ? com31 : com30);
  return {
    ...real,
    useResumoDeServicos: (
      ...args: Parameters<typeof com31.useResumoDeServicos>
    ) => escolher().useResumoDeServicos(...args),
    usePaginaDeServicos: (
      ...args: Parameters<typeof com31.usePaginaDeServicos>
    ) => escolher().usePaginaDeServicos(...args),
    todosOsServicos: (...args: Parameters<typeof com31.todosOsServicos>) =>
      escolher().todosOsServicos(...args),
  };
});

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
  QUANTAS.notas = 31;
  PDF.textos.length = 0;
  vi.mocked(autoTable).mockClear();
});

async function exportarPdf(): Promise<(string | number)[][]> {
  fireEvent.click(await screen.findByRole("button", { name: /^pdf$/i }));
  await waitFor(() => expect(autoTable).toHaveBeenCalled());
  const opcoes = vi.mocked(autoTable).mock.calls[0][1] as {
    body: (string | number)[][];
  };
  return opcoes.body;
}

describe("PDF de Serviços com mais de 30 notas", () => {
  it("leva as 30 primeiras e diz quantas ficaram de fora", async () => {
    render(<Servicos />);
    const corpo = await exportarPdf();

    expect(corpo).toHaveLength(30);
    expect(PDF.textos).toContain(
      "As 30 primeiras de 31 linhas, na ordem da tabela. A planilha leva todas.",
    );
  });

  it("com exatamente 30, nao corta nada e nao avisa", async () => {
    QUANTAS.notas = 30;
    render(<Servicos />);
    const corpo = await exportarPdf();

    expect(corpo).toHaveLength(30);
    expect(PDF.textos.some((t) => t.includes("primeiras"))).toBe(false);
  });
});
