import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Vendedores from "./Vendedores";

/**
 * Os três gráficos de Vendedores: que estão na tela, sob o título certo, e que
 * cada um recebe o array certo.
 *
 * Mesmo dublê de `Servicos.graficos.test.tsx`: cada peça que recebe dado anota
 * no DOM o array (`data-dados`) e a série (`data-serie`). A asserção prende
 * **título do cartão → array recebido**, que é a única forma de a troca de dois
 * `data` derrubar alguma coisa — com o recharts de verdade o jsdom mede 0x0 e
 * não desenha nada, em silêncio.
 *
 * Os arrays do resumo falso são escolhidos para sair distintos em forma e em
 * conteúdo:
 *   - evolução: `total_produtos` (a MERCADORIA) diferente de `total` em todo
 *     mês — trocar a série pelo total da nota derruba;
 *   - top produtos: SEIS produtos, para provar o corte em cinco;
 *   - pizza: NOVE clientes, para provar o corte em oito, com `valor_produtos`
 *     diferente de `valor`.
 */

const { ESTADO } = vi.hoisted(() => ({
  ESTADO: { meses: 2, vazio: false },
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { criarHooksFalsos, RESUMO_FALSO } = await import(
    "./comercial/hooksFalsos"
  );

  const resumo = () =>
    ESTADO.vazio
      ? RESUMO_FALSO
      : {
          ...RESUMO_FALSO,
          evolucao_mensal: Array.from({ length: ESTADO.meses }, (_, i) => ({
            ano: 2024 + Math.floor(i / 12),
            mes: (i % 12) + 1,
            total: 1000 + i,
            total_produtos: 10 + i,
            notas: 1,
            quantidade: 1,
          })),
          por_produto: Array.from({ length: 6 }, (_, i) => ({
            chave: `P${i}`,
            codigo: `P${i}`,
            descricao: i === 2 ? null : `Produto ${i}`,
            quantidade: 1,
            valor: 600 - i * 100,
            notas: 1,
          })),
          por_cliente: Array.from({ length: 9 }, (_, i) => ({
            documento: String(i),
            nome: i === 1 ? null : `Cliente ${i}`,
            cpf_cnpj: null,
            email: null,
            fone: null,
            valor: 9000 - i,
            valor_produtos: 90 - i,
            notas: 1,
            ultima_compra: null,
          })),
        };

  return { ...real, ...criarHooksFalsos([], resumo) };
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
  const comDados =
    (nome: string) =>
    ({
      data,
      dataKey,
      children,
    }: {
      data?: unknown[];
      dataKey?: string;
      children?: React.ReactNode;
    }) => (
      <div
        data-grafico={nome}
        {...(data ? { "data-dados": JSON.stringify(data) } : {})}
        {...(dataKey ? { "data-serie": dataKey } : {})}
      >
        {children}
      </div>
    );
  return {
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    LineChart: comDados("LineChart"),
    BarChart: comDados("BarChart"),
    PieChart: comDados("PieChart"),
    Line: comDados("Line"),
    Bar: comDados("Bar"),
    Pie: comDados("Pie"),
    Cell: semDesenho,
    XAxis: semDesenho,
    YAxis: semDesenho,
    Tooltip: semDesenho,
    CartesianGrid: semDesenho,
    Legend: semDesenho,
  };
});

beforeEach(() => {
  ESTADO.meses = 2;
  ESTADO.vazio = false;
});

/** O cartão do gráfico pelo título — sobe do `<h3>` até o container dele. */
function cartaoDoGrafico(titulo: string): HTMLElement {
  const alvo = screen.getByRole("heading", { name: titulo }).parentElement;
  if (!alvo) throw new Error(`cartao "${titulo}" nao encontrado`);
  return alvo;
}

/** O array que a peça `nome` recebeu dentro do cartão. */
function dadosEm(cartao: HTMLElement, nome: string): Record<string, unknown>[] {
  const peca = cartao.querySelector(`[data-grafico="${nome}"][data-dados]`);
  if (!peca) throw new Error(`${nome} sem dados neste cartao`);
  return JSON.parse(peca.getAttribute("data-dados")!);
}

function serieEm(cartao: HTMLElement): string | null {
  return (
    cartao.querySelector("[data-serie]")?.getAttribute("data-serie") ?? null
  );
}

describe("graficos de Vendedores", () => {
  it("Evolucao das Vendas desenha a mercadoria mes a mes, na serie total", () => {
    render(<Vendedores />);

    const cartao = cartaoDoGrafico("Evolução das Vendas");
    const dados = dadosEm(cartao, "LineChart");

    expect(serieEm(cartao)).toBe("total");
    expect(dados.map((d) => d.total)).toEqual([10, 11]);
    // O rótulo do mês é o `toLocaleDateString` pt-BR, "jan. de 2024".
    expect(dados.map((d) => d.mes)).toEqual(["jan. de 2024", "fev. de 2024"]);
  });

  it("acima de 24 meses, a evolucao vira anual e soma a mercadoria de cada ano", () => {
    // 25 meses: 2024 inteiro (12), 2025 inteiro (12) e janeiro de 2026.
    ESTADO.meses = 25;
    render(<Vendedores />);

    const dados = dadosEm(cartaoDoGrafico("Evolução das Vendas"), "LineChart");

    const soma = (de: number, ate: number) =>
      Array.from({ length: ate - de }, (_, i) => 10 + de + i).reduce(
        (a, b) => a + b,
        0,
      );
    expect(dados.map((d) => [d.mes, d.total])).toEqual([
      ["2024", soma(0, 12)],
      ["2025", soma(12, 24)],
      ["2026", 34],
    ]);
  });

  it("com exatamente 24 meses, a evolucao continua mensal", () => {
    ESTADO.meses = 24;
    render(<Vendedores />);

    expect(
      dadosEm(cartaoDoGrafico("Evolução das Vendas"), "LineChart"),
    ).toHaveLength(24);
  });

  it("Top Produtos Vendidos recebe so os cinco primeiros, e nomeia o produto sem descricao", () => {
    render(<Vendedores />);

    const cartao = cartaoDoGrafico("Top Produtos Vendidos");

    expect(serieEm(cartao)).toBe("valor");
    expect(dadosEm(cartao, "BarChart")).toEqual([
      { produto: "Produto 0", valor: 600 },
      { produto: "Produto 1", valor: 500 },
      { produto: "Sem descrição", valor: 400 },
      { produto: "Produto 3", valor: 300 },
      { produto: "Produto 4", valor: 200 },
    ]);
  });

  it("Distribuicao de Clientes recebe os oito primeiros, pela mercadoria, e nomeia quem nao tem nome", () => {
    render(<Vendedores />);

    const cartao = cartaoDoGrafico("Distribuição de Clientes");
    const dados = dadosEm(cartao, "Pie");

    expect(serieEm(cartao)).toBe("value");
    expect(dados).toHaveLength(8);
    expect(dados.slice(0, 3)).toEqual([
      { name: "Cliente 0", value: 90 },
      { name: "Não informado", value: 89 },
      { name: "Cliente 2", value: 88 },
    ]);
    expect(dados[7]).toEqual({ name: "Cliente 7", value: 83 });
  });

  it.each([
    "Evolução das Vendas",
    "Top Produtos Vendidos",
    "Distribuição de Clientes",
  ])(
    "sem dado no periodo, %s diz que nao ha o que mostrar, em vez de moldura muda",
    (titulo) => {
      // Gráfico sem dado não desenha nada útil: a linha e as barras pintam um
      // eixo em branco e a pizza não pinta coisa alguma. A moldura vazia sob um
      // título lia como tela quebrada. Item 6 do checklist de tela migrada.
      ESTADO.vazio = true;
      render(<Vendedores />);

      const cartao = cartaoDoGrafico(titulo);
      expect(cartao).toHaveTextContent(
        "Nenhuma venda no período para montar este gráfico.",
      );
      expect(cartao.querySelector("[data-grafico]")).toBeNull();
    },
  );
});
