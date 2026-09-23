import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Servicos from "./Servicos";

/**
 * Os três gráficos de Serviços: que estão na tela, e que cada um recebe o
 * array certo.
 *
 * `servicos/servicos.test.ts` cobre as três contas puras (`evolucaoDoResumo`,
 * `rankingDoResumo`, `cidadesDoResumo`) e cobre bem. O que não existia era
 * qualquer prova da FIAÇÃO — de que a casca entrega cada array ao gráfico
 * certo, e de que os gráficos sequer estão na página. A revisão final mediu:
 * embrulhando o `<GraficosDeServicos …/>` da casca em `{false && …}` os três
 * gráficos desapareciam e 58 testes continuavam verdes; trocar o `data` do
 * `BarChart` com o do `Pie` deixava os dois em branco (os `dataKey` deixam de
 * casar) com o `tsc` limpo.
 *
 * Por isso o dublê do recharts daqui NÃO é o `semDesenho` dos outros
 * arquivos: cada peça que recebe dados anota no DOM o array (`data-dados`) e
 * a série que lê dele (`data-serie`). A asserção então prende **título do
 * cartão → array recebido**, que é a única forma de a troca de dois `data`
 * derrubar alguma coisa.
 *
 * Fixture de duas notas, escolhidas para que os três arrays saiam distintos
 * entre si em forma E em conteúdo — a evolução tem `mes`/`total`, o ranking
 * tem `cliente`/`valor` e a pizza tem `name`/`value`:
 *   - Alfa Mineração / Recife-PE / 2026-01-10 / R$ 1.000,00
 *   - Beta Logística / Olinda-PE / 2026-02-15 / R$ 500,00
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const { SERVICOS } = vi.hoisted(() => ({
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
    {
      id: 2,
      numero_nfse: 2002,
      data_emissao: "2026-02-15",
      valor_servico: 500,
      razao_social_tomador: "Beta Logística",
      cpf_cnpj_tomador: "55.666.777/0001-88",
      cidade_tomador: "Olinda",
      uf_tomador: "PE",
      discriminacao_servico: "Manutenção preventiva",
    },
  ],
}));

// A tela deixou de ler o `ServicosContext` (item 9.4): os agregados vêm somados
// do banco e a tabela vem paginada. O falso mora em `servicos/hooksFalsos`.
vi.mock("./servicos/useServicos", async (original) => {
  const real = await original<typeof import("./servicos/useServicos")>();
  const { criarHooksFalsosDeServicos } = await import("./servicos/hooksFalsos");
  return { ...real, ...criarHooksFalsosDeServicos(SERVICOS) };
});

/**
 * Dublê do recharts que ANOTA o que recebeu.
 *
 * Em jsdom o `ResponsiveContainer` de verdade mede 0x0 e o recharts não
 * desenha nada, em silêncio — daí o dublê. Só as peças que carregam dado
 * ganham atributo: `data` vira `data-dados` (JSON) e `dataKey` vira
 * `data-serie`. Os eixos ficam mudos de propósito: o `XAxis` também tem
 * `dataKey`, e anotá-lo poria dois `[data-serie]` dentro do mesmo cartão.
 */
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

/** O `Card` do gráfico com este título — o `CardTitle` é um `<h3>` filho
 *  direto do card, então o pai do título é o menor escopo que contém o
 *  gráfico daquele cartão e mais nada. */
function cartaoDoGrafico(titulo: string): HTMLElement {
  const cabecalho = screen.getByRole("heading", { name: titulo });
  if (!cabecalho.parentElement)
    throw new Error(`gráfico "${titulo}" sem cartao`);
  return cabecalho.parentElement;
}

/** O array que o gráfico daquele cartão recebeu em `data`. */
function dadosDoGrafico(titulo: string): Record<string, unknown>[] {
  const anotado = cartaoDoGrafico(titulo).querySelector("[data-dados]");
  if (!anotado) throw new Error(`gráfico "${titulo}" nao recebeu dados`);
  return JSON.parse(anotado.getAttribute("data-dados") as string);
}

/** O campo que a série daquele cartão lê de cada ponto (`dataKey`). */
function serieDoGrafico(titulo: string): string | null {
  const anotado = cartaoDoGrafico(titulo).querySelector("[data-serie]");
  return anotado ? anotado.getAttribute("data-serie") : null;
}

/**
 * O campo de data de um dos dois extremos do período, achado pelo TEXTO do
 * rótulo — os `<label>` da tela não têm `htmlFor`, então `getByLabelText` não
 * acha o campo. Mesmo contorno de `Servicos.tabela.test.tsx`, símbolo
 * `campoData`.
 */
function campoData(rotulo: "Início" | "Fim"): HTMLInputElement {
  const campo = screen.getByText(rotulo).parentElement?.querySelector("input");
  if (!campo) throw new Error(`campo "${rotulo}" nao existe`);
  return campo as HTMLInputElement;
}

const EVOLUCAO = "Evolução dos Serviços Emitidos";
const RANKING = "Top 10 Clientes";
const CIDADES = "Distribuição por Cidade do Serviço";

describe("graficos de Serviços", () => {
  it.each([EVOLUCAO, RANKING, CIDADES])(
    "o cartao %s esta na tela",
    (titulo) => {
      // O pior caso da revisão: com o `<GraficosDeServicos …/>` embrulhado em
      // `{false && …}` os três sumiam da página e 58 testes ficavam verdes.
      render(<Servicos />);

      expect(screen.getByRole("heading", { name: titulo })).toBeInTheDocument();
    },
  );

  it("a evolucao recebe um ponto por mes, com o rotulo em portugues", () => {
    render(<Servicos />);

    // `ordem` fica de fora: é um timestamp de `new Date(ano, mes - 1)`, que
    // muda de valor com o fuso da máquina, e a suíte roda nos dois.
    expect(
      dadosDoGrafico(EVOLUCAO).map((ponto) => ({
        mes: ponto.mes,
        total: ponto.total,
      })),
    ).toEqual([
      { mes: "jan. de 2026", total: 1000 },
      { mes: "fev. de 2026", total: 500 },
    ]);
    expect(serieDoGrafico(EVOLUCAO)).toBe("total");
  });

  it("o ranking recebe os clientes, e nao as cidades", () => {
    render(<Servicos />);

    expect(dadosDoGrafico(RANKING)).toEqual([
      {
        cliente: "Alfa Mineração",
        clienteCompleto: "Alfa Mineração",
        valor: 1000,
      },
      {
        cliente: "Beta Logística",
        clienteCompleto: "Beta Logística",
        valor: 500,
      },
    ]);
    expect(serieDoGrafico(RANKING)).toBe("valor");
  });

  it("a pizza recebe as cidades, e nao os clientes", () => {
    // Este par de testes é o que a troca dos dois `data` derruba: os arrays
    // não têm as mesmas chaves, então o ranking com dado de cidade e a pizza
    // com dado de cliente falham os dois — e é exatamente esse par que
    // deixava os dois gráficos em branco na tela, com o `tsc` limpo.
    render(<Servicos />);

    expect(dadosDoGrafico(CIDADES)).toEqual([
      { name: "Recife/PE", value: 1000 },
      { name: "Olinda/PE", value: 500 },
    ]);
    expect(serieDoGrafico(CIDADES)).toBe("value");
  });

  it("com o periodo estreitado, os tres graficos passam a receber so o recorte", () => {
    // Os gráficos saem do RECORTE, e não da base inteira — mesmo motivo dos
    // KPIs em `Servicos.kpis.test.tsx`. Fevereiro deixa só a Beta.
    render(<Servicos />);

    fireEvent.change(campoData("Início"), { target: { value: "2026-02-01" } });
    fireEvent.change(campoData("Fim"), { target: { value: "2026-02-28" } });

    expect(dadosDoGrafico(EVOLUCAO).map((ponto) => ponto.mes)).toEqual([
      "fev. de 2026",
    ]);
    expect(
      dadosDoGrafico(RANKING).map((barra) => barra.clienteCompleto),
    ).toEqual(["Beta Logística"]);
    expect(dadosDoGrafico(CIDADES).map((fatia) => fatia.name)).toEqual([
      "Olinda/PE",
    ]);
  });
});
