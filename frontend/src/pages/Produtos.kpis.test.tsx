import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Produtos from "./Produtos";

/**
 * Caracterização dos quatro KPIs de Produtos e dos dois gráficos.
 *
 * Os KPIs saem de `calcularKpis` (`produtos/produtos.ts`) e são desenhados por
 * `produtos/KpisDeProdutos.tsx`; a evolução e o ranking saem de
 * `evolucaoDoResumo` e `rankingPorValor` (mesmo arquivo) e chegam a
 * `produtos/GraficosDeProdutos.tsx`. A citação anterior era a
 * `Produtos.tsx:551-625` da tela pré-decomposição — hoje o arquivo tem 247
 * linhas e nada disso mora mais lá.
 *
 * Os gráficos entraram na Task 3 de 2026-09-10: eram o maior buraco da rede
 * junto do recorte — plantar `dadosEvolucao → []` deixava os 45 testes verdes.
 *
 * Os mocks de `useAuth` e `recharts` vêm de `Produtos.multiselect.test.tsx` —
 * molde que já monta a tela com sucesso. O mock de dados é o da fonte NOVA:
 * a tela deixou de ler o `DataContext` (item 9.4) e passou a receber o
 * resumo já agregado pelo Postgres via `useComercial` — o falso mora em
 * `comercial/hooksFalsos` (ver o docblock de lá para o porquê de mocar o
 * hook, e não a rede). Este arquivo nasceu contra a fonte antiga; a Task 1
 * de 2026-09-10 trocou só a falsificação, sem mexer no fixture nem nas
 * asserções.
 *
 * As duas notas abaixo têm itens de códigos diferentes (P1 e P2), com
 * quantidade e valor escolhidos para que os quatro números saiam distintos
 * entre si:
 *   - quantidade total vendida: 3 + 5 = 8
 *   - faturamento total: 300 + 1000 = R$ 1.300,00
 *   - ticket médio: 1300 / 8 = R$ 162,50
 *   - produto mais vendido: P2 "Tubo descartável" (5 > 3), Qtd: 5
 *
 * Nenhum dos quatro coincide com outro — e isso NÃO é suficiente. Até a
 * revisão final de 10/09/2026 este docblock afirmava que uma troca entre eles
 * "faria pelo menos um teste falhar", e escolhia como exemplo justamente o
 * caso que não funcionava: trocar `totalFaturado` e `ticketMedio` entre si no
 * retorno de `calcularKpis` (`produtos/produtos.ts`) deixava os 1524 testes
 * verdes, com o card "Faturamento Total" informando R$ 162,50.
 *
 * A assimetria explica. Mexer em UM lado derruba, porque `getByText` passa a
 * achar duas ocorrências de um número e nenhuma do outro; a troca SIMÉTRICA —
 * que é o que um refactor desatento produz — sobrevive a qualquer asserção que
 * só pergunte se o número está na página, porque o CONJUNTO de valores
 * continua o mesmo. Por isso os quatro testes abaixo leem pelo `valorDoKpi`:
 * o que se afirma é o par rótulo→valor, não a presença do valor.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const { NOTAS } = vi.hoisted(() => ({
  NOTAS: [
    {
      id: 1,
      data_emissao: "2026-01-10",
      valor_nota: 300,
      cliente: { nome: "Alfa Mineração", cpf_cnpj: "11.222.333/0001-44" },
      nome_vendedor: "Vendedor A",
      itens: [
        {
          codigo: "P1",
          descricao: "Bafômetro Phoebus",
          quantidade: "3",
          valor_total: "300",
        },
      ],
    },
    {
      id: 2,
      data_emissao: "2026-02-10",
      valor_nota: 1000,
      cliente: { nome: "Beta Logística", cpf_cnpj: "55.666.777/0001-88" },
      nome_vendedor: "Vendedor B",
      itens: [
        {
          codigo: "P2",
          descricao: "Tubo descartável",
          quantidade: "5",
          valor_total: "1000",
        },
      ],
    },
  ],
}));

// A tela deixou de ler o `DataContext` (item 9.4): a agregação vem somada do
// banco. O falso mora em `comercial/hooksFalsos`, e para esta tela o que
// importa é o `por_produto` — é ele que virou a tabela.
vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { criarHooksFalsos, resumoDeProdutos } = await import(
    "./comercial/hooksFalsos"
  );
  return { ...real, ...criarHooksFalsos(NOTAS, resumoDeProdutos) };
});

/**
 * Dublê do recharts.
 *
 * Em jsdom o `ResponsiveContainer` mede 0x0 e o recharts de verdade não
 * desenha nada — os gráficos de Produtos ficariam invisíveis ao teste sem
 * quebrar (recharts engole a falta de tamanho em silêncio). Por isso o dublê
 * dos dois gráficos desta tela ESCREVE a série que recebeu num atributo: sem
 * isso não há como afirmar o que chegou até eles, e a revisão da Task 2
 * mostrou o preço disso — trocar a evolução da tela por `[]` deixava os 45
 * testes verdes. As peças de dentro (eixos, barras, linha) continuam mudas,
 * porque o que se prova aqui é o dado, não o desenho.
 */
vi.mock("recharts", () => {
  const semDesenho = () => null;
  const comSerie =
    (id: string) =>
    ({ data, children }: { data?: unknown[]; children?: React.ReactNode }) => (
      <div data-testid={id} data-serie={JSON.stringify(data ?? [])}>
        {children}
      </div>
    );
  return {
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    BarChart: comSerie("grafico-ranking"),
    LineChart: comSerie("grafico-evolucao"),
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
 * A série que chegou a um dos dois gráficos, lida do dublê do recharts.
 *
 * Ler o atributo (e não uma exportação da tela) é o que mantém o teste sobre a
 * tela renderizada: o caminho percorrido é o mesmo da pessoa que abre a página
 * — resumo do servidor, conta pura, componente de gráfico.
 */
function serieDoGrafico(id: string): Record<string, unknown>[] {
  return JSON.parse(screen.getByTestId(id).dataset.serie ?? "[]");
}

/**
 * Os três `<p>` de um card de KPI, achados A PARTIR do rótulo.
 *
 * A anatomia do `KpiCard` (`design-system/ui/data/KpiCard.tsx`) é fixa e está
 * documentada lá: rótulo, valor e nota são irmãos, nessa ordem. Andar do
 * rótulo para o irmão seguinte é o que amarra um ao outro — perguntar
 * `getByText("R$ 1.300,00")` prova só que o número está em algum lugar da
 * página, e foi por isso que a troca simétrica entre faturamento e ticket
 * médio atravessou a suíte inteira sem um vermelho.
 */
function paragrafosDoKpi(rotulo: string): Element[] {
  const etiqueta = screen.getByText(rotulo);
  const cartao = etiqueta.parentElement;
  if (!cartao)
    throw new Error(`o rotulo "${rotulo}" nao esta dentro de um card`);
  return Array.from(cartao.querySelectorAll("p"));
}

/** O valor do card — o `<p>` logo abaixo do rótulo. */
function valorDoKpi(rotulo: string): string {
  const [etiqueta, valor] = paragrafosDoKpi(rotulo);
  if (etiqueta.textContent !== rotulo || !valor) {
    throw new Error(`o card "${rotulo}" nao tem valor logo abaixo do rotulo`);
  }
  return valor.textContent ?? "";
}

/** A nota de rodapé do card — o terceiro `<p>`, quando existe. */
function notaDoKpi(rotulo: string): string {
  const nota = paragrafosDoKpi(rotulo)[2];
  if (!nota) throw new Error(`o card "${rotulo}" nao tem nota`);
  return nota.textContent ?? "";
}

describe("gráficos de Produtos", () => {
  it("a evolução recebe um ponto por mês, com a quantidade de itens do mês", () => {
    render(<Produtos />);

    // Janeiro tem as 3 unidades da nota 1 e fevereiro as 5 da nota 2 — os
    // mesmos números do KPI de quantidade, separados por mês.
    const serie = serieDoGrafico("grafico-evolucao");
    expect(serie.map((ponto) => ponto.total)).toEqual([3, 5]);
    expect(String(serie[0].mes)).toMatch(/jan/i);
    expect(String(serie[1].mes)).toMatch(/fev/i);
  });

  it("o ranking recebe os produtos do maior valor para o menor", () => {
    render(<Produtos />);

    // O card se chama "Top 10 Produtos (Valor)": a primeira barra tem de ser a
    // de quem mais faturou. Com o `sort` invertido, seria o item mais barato
    // com o título intacto.
    expect(serieDoGrafico("grafico-ranking")).toEqual([
      { produto: "Tubo descartável", valor: 1000 },
      { produto: "Bafômetro Phoebus", valor: 300 },
    ]);
  });
});

describe("KPIs de Produtos", () => {
  it("quantidade total vendida soma as quantidades dos itens", () => {
    render(<Produtos />);

    expect(valorDoKpi("Quantidade Total Vendida")).toBe("8");
  });

  it("faturamento total soma o valor dos itens, e nao mostra o ticket medio", () => {
    render(<Produtos />);

    // Ler pelo rótulo, e não `getByText("R$ 1.300,00")`: os dois cards de
    // dinheiro trocados entre si mantêm os mesmos dois números na página, e a
    // pessoa passa a ler que a empresa faturou R$ 162,50 no período.
    expect(valorDoKpi("Faturamento Total")).toBe("R$ 1.300,00");
  });

  it("ticket médio por produto divide faturamento pela quantidade", () => {
    render(<Produtos />);

    expect(valorDoKpi("Ticket Médio por Produto")).toBe("R$ 162,50");
  });

  it("produto mais vendido é o de maior quantidade, com a quantidade dele", () => {
    render(<Produtos />);

    // A tabela também lista "Tubo descartável" (é um dos dois produtos), então
    // `getByText` acharia as duas ocorrências. Partir do rótulo do card
    // resolve a ambiguidade e, de quebra, prende o nome ao card certo.
    expect(valorDoKpi("Produto Mais Vendido")).toBe("Tubo descartável");
    expect(notaDoKpi("Produto Mais Vendido")).toBe("Qtd: 5");
  });
});
