import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Produtos from "./Produtos";
import { conferirAriaSort } from "../test/ordenacaoAcessivel";

/**
 * Os cabeçalhos ordenáveis da tabela de Produtos, clicados NA TELA.
 *
 * Existe por causa da revisão final de 10/09/2026: `Produtos.tabela.test.tsx`
 * só clica em "Quantidade" e "Código", e trocar o `campo` das outras três
 * colunas em `produtos/TabelaDeProdutos.tsx` (procurar por `COLUNAS`) passava
 * verde nas oito suítes de Produtos. Cenário do pior deles: a pessoa clica em
 * "Valor Total" para ver quem mais faturou e sobe ao topo um item de baixo
 * giro e alto preço unitário, com o cabeçalho escrito "Valor Total" e a seta
 * apontando para o lado certo.
 *
 * O buraco é só o FIO entre o cabeçalho e o campo: a conta pura
 * `ordenarEBuscar` já tem os cinco `case` cobertos em
 * `produtos/produtos.test.ts`, com um catálogo montado para isso.
 *
 * Arquivo próprio, e não mais um teste em `Produtos.tabela.test.tsx`, por
 * causa do fixture: lá `valorTotal` e `valorMedio` decrescentes dão os dois a
 * mesma ordem — que ainda por cima é a ordem inicial da tabela —, então
 * nenhuma troca entre esses dois campos seria observável. Acrescentar produtos
 * àquele fixture quebraria os dez testes que contam três linhas, por motivo
 * que não é defeito. Mesma decisão de `Produtos.keys.test.tsx`.
 *
 * Fixture: três produtos em que os cinco campos ordenáveis dão CINCO ordens
 * diferentes, e nenhuma delas é a ordem de entrada (é o mesmo catálogo de
 * `ordenarEBuscar` em `produtos/produtos.test.ts`, aqui expresso como notas):
 *
 *   - P1 "Bafômetro Digital": 10 un., R$ 1.000,00 no total, R$ 100,00/un.
 *   - P2 "Tubo Coletor de Amostra": 20 un., R$ 800,00 no total, R$ 40,00/un.
 *   - P3 "Máscara de Solda": 5 un., R$ 900,00 no total, R$ 180,00/un.
 *
 *   código ↓ P3, P2, P1        ·  produto ↓ P2, P3, P1
 *   quantidade ↓ P2, P1, P3    ·  valor total ↓ P1, P3, P2
 *   valor médio ↓ P3, P1, P2
 *
 * "Quantidade" e "Código" ficam de fora daqui — os dois já são clicados em
 * `Produtos.tabela.test.tsx`, e a ordem inicial da tabela é justamente a
 * quantidade decrescente.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const { NOTAS } = vi.hoisted(() => ({
  NOTAS: [
    {
      id: 1,
      data_emissao: "2026-01-10",
      valor_nota: 2700,
      cliente: { nome: "Alfa Mineração", cpf_cnpj: "11.222.333/0001-44" },
      nome_vendedor: "Vendedor A",
      itens: [
        {
          codigo: "P1",
          descricao: "Bafômetro Digital",
          quantidade: "10",
          valor_total: "1000",
        },
        {
          codigo: "P2",
          descricao: "Tubo Coletor de Amostra",
          quantidade: "20",
          valor_total: "800",
        },
        {
          codigo: "P3",
          descricao: "Máscara de Solda",
          quantidade: "5",
          valor_total: "900",
        },
      ],
    },
  ],
}));

vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { criarHooksFalsos, resumoDeProdutos } = await import(
    "./comercial/hooksFalsos"
  );
  return { ...real, ...criarHooksFalsos(NOTAS, resumoDeProdutos) };
});

/** Dublê do recharts — nenhum teste aqui olha para gráfico. */
vi.mock("recharts", () => {
  const semDesenho = () => null;
  const passante = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ResponsiveContainer: passante,
    BarChart: passante,
    LineChart: passante,
    PieChart: passante,
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
 * Os códigos das linhas, na ordem em que a tabela os desenha.
 *
 * Lê a PRIMEIRA célula de cada linha, e não o texto solto: um `getByText`
 * dentro da linha acharia o código em qualquer coluna, e o que se afirma aqui
 * é a ordem das linhas.
 */
function ordemDaTabela(): string[] {
  const corpo = document.querySelector("tbody");
  if (!corpo) throw new Error("tbody nao encontrado");
  return within(corpo as HTMLElement)
    .getAllByRole("row")
    .map(
      (linha) =>
        within(linha).getAllByRole("cell")[0].textContent?.trim() ?? "",
    );
}

/** O botão de ordenação de uma coluna, achado pelo nome acessível. */
function botaoDeOrdenar(rotulo: string): HTMLElement {
  return screen.getByRole("button", { name: `Ordenar por ${rotulo}` });
}

/**
 * Clica num cabeçalho e afirma as duas direções.
 *
 * As duas, e não só a primeira: `alternarOrdenacao` (`Produtos.tsx`) começa
 * sempre em `desc` num campo novo, e um `campo` errado que por acaso desse a
 * mesma ordem decrescente ainda divergiria na volta. Nenhuma das duas ordens
 * afirmadas abaixo coincide com a ordem inicial da tabela.
 */
function afirmarOrdenacao(rotulo: string, desc: string[], asc: string[]) {
  const cabecalho = botaoDeOrdenar(rotulo);

  fireEvent.click(cabecalho);
  expect(ordemDaTabela()).toEqual(desc);

  fireEvent.click(cabecalho);
  expect(ordemDaTabela()).toEqual(asc);
}

describe("cabecalhos ordenaveis de Produtos", () => {
  it("cada cabecalho diz ao leitor de tela a direcao da ordem", () => {
    // O botão "Ordenar por" dentro do `<th>` mostrava a direção só na seta:
    // o leitor de tela não sabia se a coluna estava crescente, decrescente
    // ou fora de uso. Ver `src/test/ordenacaoAcessivel.ts`.
    render(<Produtos />);
    conferirAriaSort("Valor Total");
  });

  it("a ordem inicial e a quantidade vendida decrescente", () => {
    // A âncora dos três testes abaixo: sem ela, um cabeçalho que não
    // ordenasse nada poderia coincidir com a expectativa por acidente.
    render(<Produtos />);

    expect(ordemDaTabela()).toEqual(["P2", "P1", "P3"]);
  });

  it("clicar em Produto ordena pela descricao, e nao pela quantidade", () => {
    // Plantação que passava verde: `campo: "quantidadeVendida"` na coluna
    // "Produto". A tabela ficaria na ordem em que já estava e ninguém veria.
    render(<Produtos />);

    afirmarOrdenacao("Produto", ["P2", "P3", "P1"], ["P1", "P3", "P2"]);
  });

  it("clicar em Valor Total ordena pelo faturamento, e nao pelo preco unitario", () => {
    // Plantação que passava verde: `campo: "valorMedio"` na coluna "Valor
    // Total". P3 (R$ 180,00 a unidade, R$ 900,00 no total) subiria ao topo no
    // lugar de P1 (R$ 1.000,00 no total) — o item de baixo giro passando por
    // quem mais faturou.
    render(<Produtos />);

    afirmarOrdenacao("Valor Total", ["P1", "P3", "P2"], ["P2", "P3", "P1"]);
  });

  it("clicar em Valor Medio ordena pelo preco unitario, e nao pelo faturamento", () => {
    // Plantação que passava verde: `campo: "valorTotal"` na coluna "Valor
    // Médio" — a troca simétrica da anterior.
    render(<Produtos />);

    afirmarOrdenacao("Valor Médio", ["P3", "P1", "P2"], ["P2", "P1", "P3"]);
  });
});
