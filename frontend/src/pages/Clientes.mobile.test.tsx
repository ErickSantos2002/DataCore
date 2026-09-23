import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Clientes from "./Clientes";

/**
 * Caracterização do que `isMobile` controla em Clientes, depois de a cópia
 * local virar `src/hooks/useIsMobile.ts` (item 5 da Fase 4).
 *
 * O arquivo nasceu junto com aquela troca e ficou para trás quando ela subiu:
 * falsificava o `../context/DataContext`, que outra frente apagou ao trocar a
 * fonte de dados desta tela pelo resumo agregado do Postgres. O que ele afirma
 * é o mesmo de antes — só a falsificação mudou.
 *
 * Por que este arquivo tem um dublê de recharts diferente dos outros testes de
 * Clientes: nos demais o `ResponsiveContainer` é `<div>{children}</div>`, que
 * joga fora as props. Aqui a prop `height` É o que se quer observar — ela vale
 * 420 em celular e 300 no resto —, então o dublê a expõe num atributo. Com o
 * dublê comum, este teste passaria verde sem provar nada.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

// Os fixtures moram dentro de `vi.hoisted` porque a fábrica do `vi.mock`
// abaixo roda antes dos imports deste arquivo — declarados como `const` solto,
// chegariam à fábrica ainda na zona morta temporal.
const { CADASTROS, NOTAS } = vi.hoisted(() => ({
  CADASTROS: [
    {
      nome: "Alfa Mineração",
      cpf_cnpj: "11.222.333/0001-44",
      email: "contato@alfa.com",
      fone: "81999990000",
    },
  ],
  NOTAS: [
    {
      id: 1,
      numero: 1001,
      data_emissao: "2026-01-10",
      valor_nota: 1000,
      valor_produtos: 1000,
      cliente: {
        id: 1,
        nome: "Alfa Mineração",
        cpf_cnpj: "11.222.333/0001-44",
      },
      nome_vendedor: "Vendedor A",
      tipo: null,
      itens: [
        {
          codigo: "P1",
          descricao: "Bafômetro Phoebus",
          quantidade: "2",
          valor_total: "1000",
        },
      ],
      tem_observacoes: false,
    },
  ],
}));

// A tela deixou de ler o `DataContext` (item 9.4): a agregação por cliente vem
// somada do banco, e aquele context nem existe mais. O falso mora em
// `comercial/hooksFalsos` — o mesmo que `Clientes.paginacao.test.tsx` usa.
// Trocar a falsificação não mexe no que este arquivo afirma: o que `isMobile`
// controla aqui (altura do gráfico, largura do tooltip) não depende de onde o
// dado veio.
vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { criarHooksFalsos, resumoDeClientes } = await import(
    "./comercial/hooksFalsos"
  );
  return {
    ...real,
    ...criarHooksFalsos(NOTAS, (ns) => resumoDeClientes(ns, CADASTROS)),
  };
});

vi.mock("recharts", () => {
  const semDesenho = () => null;
  return {
    // Expõe `height` — é a prop que `isMobile` controla, e o dublê dos outros
    // arquivos a descartaria.
    ResponsiveContainer: ({
      children,
      height,
    }: {
      children?: ReactNode;
      height?: number;
    }) => (
      <div data-testid="grafico" data-height={String(height)}>
        {children}
      </div>
    ),
    BarChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    LineChart: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    PieChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Bar: semDesenho,
    Line: semDesenho,
    Pie: semDesenho,
    Cell: semDesenho,
    XAxis: semDesenho,
    YAxis: semDesenho,
    // Chama `content` de verdade — é o que renderiza a caixa cuja `maxWidth`
    // o teste abaixo observa. O dublê comum (`semDesenho`) nunca a monta.
    Tooltip: ({ content }: { content?: (p: never) => ReactNode }) =>
      content
        ? content({
            active: true,
            payload: [
              { payload: { nomeCompleto: "Alfa Mineração", valor: 1000 } },
            ],
          } as never)
        : null,
    CartesianGrid: semDesenho,
    Legend: semDesenho,
  };
});

/** A jsdom fixa `innerWidth` em 1024. A propriedade é gravável, então o teste
 *  ajusta e dispara o `resize` à mão. **Restaurar é obrigatório**: `innerWidth`
 *  é global, e um teste que o deixa em 375 contamina todos os seguintes do
 *  arquivo de um jeito difícil de rastrear. */
const LARGURA_ORIGINAL = window.innerWidth;

function redimensionarPara(largura: number) {
  Object.defineProperty(window, "innerWidth", {
    value: largura,
    writable: true,
    configurable: true,
  });
  fireEvent(window, new Event("resize"));
}

afterEach(() => {
  Object.defineProperty(window, "innerWidth", {
    value: LARGURA_ORIGINAL,
    writable: true,
    configurable: true,
  });
});

describe("Clientes — o que muda em tela pequena", () => {
  it("o grafico e mais alto em celular do que no desktop", () => {
    render(<Clientes />);
    // 1024 na jsdom: desktop.
    expect(screen.getAllByTestId("grafico")[0]).toHaveAttribute(
      "data-height",
      "300",
    );

    redimensionarPara(375);

    expect(screen.getAllByTestId("grafico")[0]).toHaveAttribute(
      "data-height",
      "420",
    );
  });

  it("voltar para o desktop devolve a altura menor", () => {
    render(<Clientes />);
    redimensionarPara(375);
    expect(screen.getAllByTestId("grafico")[0]).toHaveAttribute(
      "data-height",
      "420",
    );

    redimensionarPara(1024);

    expect(screen.getAllByTestId("grafico")[0]).toHaveAttribute(
      "data-height",
      "300",
    );
  });

  it("639 e celular e 640 nao — o limite e exclusivo", () => {
    render(<Clientes />);

    redimensionarPara(639);
    expect(screen.getAllByTestId("grafico")[0]).toHaveAttribute(
      "data-height",
      "420",
    );

    redimensionarPara(640);
    expect(screen.getAllByTestId("grafico")[0]).toHaveAttribute(
      "data-height",
      "300",
    );
  });

  it("a largura do tooltip acompanha o resize, como o resto da tela", () => {
    render(<Clientes />);
    // "Alfa Mineração" também aparece no card do cliente e na linha da
    // tabela — o parágrafo do tooltip é o único com `font-weight: 600`
    // inline (Clientes.tsx: `<p style={{ fontWeight: 600, ... }}>`).
    const tooltip = () =>
      screen
        .getAllByText("Alfa Mineração")
        .find((el) => el.style.fontWeight === "600")!
        .closest("div")!;
    expect(tooltip()).toHaveStyle({ maxWidth: "280px" });

    redimensionarPara(375);

    // Este teste prova que o tooltip é responsivo — não que a resposta vem
    // do hook. Verificado por experimento: ele passa igual com a
    // implementação antiga (`window.innerWidth < 640 ? 220 : 280` lido
    // direto no render do tooltip), porque a caixa acompanhava o resize pelo
    // mesmo re-render acidental que fazia o gráfico de `Vendas` funcionar.
    // Não distingue a correção; quem impede essa regressão de voltar é o
    // `guarda-usemobile`, não este teste.
    expect(tooltip()).toHaveStyle({ maxWidth: "220px" });
  });
});
