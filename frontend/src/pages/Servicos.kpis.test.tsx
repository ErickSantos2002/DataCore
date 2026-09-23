import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Servicos from "./Servicos";

/**
 * Caracterização dos quatro KPIs de Serviços, antes de decompor a tela.
 *
 * A fonte mudou: a tela não lê mais as notas no navegador (o
 * `ServicosContext` foi apagado). Os quatro números saem somados do banco,
 * em `useResumoDeServicos` (`servicos/useServicos`), e o falso da fábrica
 * `criarHooksFalsosDeServicos` (`servicos/hooksFalsos`) refaz essa soma sobre
 * o fixture. Por isso o que este arquivo prova é **o desenho**: que cada
 * número do resumo chega no cartão certo, com o formato certo.
 *
 * Os `vi.mock` abaixo são cópia do cabeçalho de `Servicos.paginacao.test.tsx`
 * — é a mesma tela, com as mesmas dependências, e duplicar o cabeçalho custa
 * menos que um helper compartilhado que acopla os dois arquivos.
 *
 * As três notas têm valores escolhidos para que os quatro números saiam
 * distintos entre si:
 *   - faturamento total: 1000 + 500 + 700 = R$ 2.200,00
 *   - número de NFS-e: 3
 *   - ticket médio: 2200 / 3 = R$ 733,33
 *   - top cliente: Alfa Mineração (1000 + 700 = 1700), maior que Beta
 *     Logística (500) — `formatarDinheiroAbreviado` mostra "R$ 1,7 mil"
 *
 * ⚠️ Valor distinto **não basta**: a lição de Produtos é que uma troca
 * simétrica entre dois campos (`totalFaturado` e `ticketMedio` trocados entre
 * si em `Servicos.tsx`, símbolo `kpis`) mantém o conjunto de valores na tela
 * e escapa de qualquer `screen.getByText` solto. Por isso toda asserção aqui
 * é escopada ao cartão do rótulo, via `cartaoDoKpi` — prende valor a rótulo,
 * e a troca simétrica derruba os dois lados.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const { SERVICOS_ENRIQUECIDOS } = vi.hoisted(() => ({
  SERVICOS_ENRIQUECIDOS: [
    {
      id: 1,
      numero_nfse: "1001",
      data_emissao: "2026-01-10",
      valor_servico: 1000,
      razao_social_tomador: "Alfa Mineração",
      cpf_cnpj_tomador: "11.222.333/0001-44",
      cidade_tomador: "Recife",
      uf_tomador: "PE",
      discriminacao_servico: "Calibração de bafômetro",
      valor_servico_numero: 1000,
      mes: "janeiro",
      ano: 2026,
    },
    {
      id: 2,
      numero_nfse: "1002",
      data_emissao: "2026-02-10",
      valor_servico: 500,
      razao_social_tomador: "Beta Logística",
      cpf_cnpj_tomador: "55.666.777/0001-88",
      cidade_tomador: "Olinda",
      uf_tomador: "PE",
      discriminacao_servico: "Manutenção preventiva",
      valor_servico_numero: 500,
      mes: "fevereiro",
      ano: 2026,
    },
    {
      id: 3,
      numero_nfse: "1003",
      data_emissao: "2026-03-10",
      valor_servico: 700,
      razao_social_tomador: "Alfa Mineração",
      cpf_cnpj_tomador: "11.222.333/0001-44",
      cidade_tomador: "Recife",
      uf_tomador: "PE",
      discriminacao_servico: "Inspeção de equipamentos",
      valor_servico_numero: 700,
      mes: "marco",
      ano: 2026,
    },
  ],
}));

// A tela deixou de ler o `ServicosContext` (item 9.4): os agregados vêm somados
// do banco e a tabela vem paginada. O falso mora em `servicos/hooksFalsos`.
vi.mock("./servicos/useServicos", async (original) => {
  const real = await original<typeof import("./servicos/useServicos")>();
  const { criarHooksFalsosDeServicos } = await import("./servicos/hooksFalsos");
  return { ...real, ...criarHooksFalsosDeServicos(SERVICOS_ENRIQUECIDOS) };
});

/**
 * Dublê do recharts.
 *
 * Em jsdom o `ResponsiveContainer` mede 0x0 e o recharts de verdade não
 * desenha nada — os gráficos de Serviços ficariam invisíveis ao teste sem
 * quebrar (recharts engole a falta de tamanho em silêncio). Como este arquivo
 * não olha para gráfico nenhum, o dublê só precisa devolver algo renderizável
 * para cada peça importada, sem reproduzir o comportamento real delas.
 */
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
 * O bloco do cartão de um KPI, achado pelo TEXTO do rótulo.
 *
 * O rótulo e o valor são irmãos dentro do mesmo `<div>` (`Servicos.tsx`,
 * bloco "KPIs"), então o pai do rótulo é o menor escopo que contém os dois.
 * É esse escopo que prende valor a rótulo: `screen.getByText("R$ 733,33")`
 * solto acharia o número em qualquer cartão, e trocar dois KPIs de lugar
 * passaria verde.
 */
function cartaoDoKpi(rotulo: string): HTMLElement {
  const etiqueta = screen.getByText(rotulo);
  if (!etiqueta.parentElement) throw new Error(`KPI "${rotulo}" sem cartao`);
  return etiqueta.parentElement;
}

/**
 * O bloco de um filtro, achado pelo TEXTO do rótulo.
 *
 * Não dá para usar `getByLabelText`: os `<label>` da tela são irmãos do campo,
 * não estão associados a ele por `htmlFor`. É lacuna de acessibilidade real,
 * registrada no documento de divergências, e consertá-la é mudança de markup
 * numa tela que segue em PENDENTES_FASE_3. Mesmo contorno de
 * `Servicos.periodo.test.tsx`, símbolo `blocoDoFiltro`.
 */
function campoData(rotulo: "Início" | "Fim"): HTMLInputElement {
  const etiqueta = screen.getByText(rotulo);
  const campo = etiqueta.parentElement?.querySelector("input");
  if (!campo) throw new Error(`campo "${rotulo}" nao existe`);
  return campo as HTMLInputElement;
}

/**
 * Escolhe uma opção num dos três multiselects do topo.
 *
 * O nome acessível do gatilho fechado é o rótulo mais o placeholder
 * (`aria-labelledby` do rótulo + o texto do botão), mesmo molde de
 * `Servicos.multiselect.test.tsx`, símbolo `abrir`.
 */
function escolherNoFiltro(
  rotulo: string,
  placeholder: string,
  opcao: string,
): void {
  fireEvent.click(
    screen.getByRole("button", { name: `${rotulo} ${placeholder}` }),
  );
  fireEvent.click(screen.getByRole("checkbox", { name: opcao }));
}

/** Rótulo do cartão -> valor que ele tem de mostrar, sobre o fixture inteiro. */
const KPIS_SEM_FILTRO: Array<[string, string]> = [
  ["Faturamento Total", "R$ 2.200,00"],
  ["NFS-e Emitidas", "3"],
  ["Ticket Médio", "R$ 733,33"],
  ["Top Cliente", "R$ 1,7 mil"],
];

/**
 * Os mesmos quatro, com o período estreitado a janeiro e fevereiro (a nota de
 * março, Alfa/R$ 700, fica de fora):
 *   - faturamento: 1000 + 500 = R$ 1.500,00
 *   - notas: 2
 *   - ticket médio: 1500 / 2 = R$ 750,00
 *   - top cliente: Alfa com 1000 -> "R$ 1 mil"
 */
const KPIS_COM_FILTRO: Array<[string, string]> = [
  ["Faturamento Total", "R$ 1.500,00"],
  ["NFS-e Emitidas", "2"],
  ["Ticket Médio", "R$ 750,00"],
  ["Top Cliente", "R$ 1 mil"],
];

describe("KPIs de Serviços", () => {
  it.each(KPIS_SEM_FILTRO)("o cartao %s mostra %s", (rotulo, valor) => {
    render(<Servicos />);

    expect(within(cartaoDoKpi(rotulo)).getByText(valor)).toBeInTheDocument();
  });

  it("Top Cliente mostra o nome de quem mais faturou, e o nome inteiro no title", () => {
    render(<Servicos />);

    const cartao = within(cartaoDoKpi("Top Cliente"));
    // O nome vem truncado por CSS, então o `title` é o que a pessoa lê ao
    // parar o mouse — e é a única cópia íntegra do nome na tela.
    expect(cartao.getByText("Alfa Mineração")).toHaveAttribute(
      "title",
      "Alfa Mineração",
    );
    // Beta faturou menos (500 contra 1700) e não pode aparecer no cartão.
    expect(cartao.queryByText("Beta Logística")).not.toBeInTheDocument();
  });

  it.each(KPIS_COM_FILTRO)(
    "com o periodo estreitado, o cartao %s passa a mostrar %s",
    (rotulo, valor) => {
      // Os KPIs têm de sair do RECORTE, e não da base inteira. O falso da
      // fábrica filtra o resumo pelas datas antes de somar, igual ao SQL; se a
      // tela deixasse de mandar as datas no recorte (ou lesse um resumo sem
      // filtro), os números continuariam os de `KPIS_SEM_FILTRO`.
      render(<Servicos />);

      fireEvent.change(campoData("Início"), {
        target: { value: "2026-01-01" },
      });
      fireEvent.change(campoData("Fim"), { target: { value: "2026-02-28" } });

      expect(within(cartaoDoKpi(rotulo)).getByText(valor)).toBeInTheDocument();
    },
  );

  // ── OS TRÊS MULTISELECTS CHEGAM AO RECORTE ──────────────────────────────
  // O teste do período acima prova que a DATA entra na consulta; os três
  // multiselects não tinham equivalente — `Servicos.multiselect.test.tsx`
  // prova o comportamento do primitivo (abrir, buscar, marcar, limpar), não
  // o efeito da escolha sobre o resultado. Com `cliente: filtroCidade` e
  // `cidade: filtroCliente` trocados na chamada de `recorteDeServicos`
  // (`Servicos.tsx`), a pessoa escolhia "Alfa Mineração" no filtro de
  // cliente, a consulta saía com `cidade=Alfa Mineração`, o servidor não
  // casava nada e a tela ia a zero — 48 testes verdes.
  //
  // Os três casos levam a resultados distintos entre si, então uma troca
  // entre dois filtros quaisquer derruba os dois lados: o rótulo de cliente
  // não casa com nenhuma cidade, o de cidade não casa com nenhum tipo, e a
  // tela iria a "R$ 0,00" com "0" notas.

  it.each([
    [
      "Cliente (Tomador)",
      "Todos os clientes",
      "Alfa Mineração (11.222.333/0001-44)",
      "R$ 1.700,00",
      "2",
    ],
    ["Cidade do Serviço", "Todas as cidades", "Olinda/PE", "R$ 500,00", "1"],
    [
      "Tipo de Serviço",
      "Todos os tipos",
      "Inspeção de equipamentos",
      "R$ 700,00",
      "1",
    ],
  ])(
    "o filtro %s chega ao recorte e muda os KPIs",
    (rotulo, placeholder, opcao, faturamento, notas) => {
      render(<Servicos />);

      escolherNoFiltro(rotulo, placeholder, opcao);

      expect(
        within(cartaoDoKpi("Faturamento Total")).getByText(faturamento),
      ).toBeInTheDocument();
      expect(
        within(cartaoDoKpi("NFS-e Emitidas")).getByText(notas),
      ).toBeInTheDocument();
    },
  );

  it("com o periodo estreitado, os numeros da base inteira somem da tela", () => {
    render(<Servicos />);

    fireEvent.change(campoData("Início"), { target: { value: "2026-01-01" } });
    fireEvent.change(campoData("Fim"), { target: { value: "2026-02-28" } });

    expect(screen.queryByText("R$ 2.200,00")).not.toBeInTheDocument();
    expect(screen.queryByText("R$ 733,33")).not.toBeInTheDocument();
  });
});
