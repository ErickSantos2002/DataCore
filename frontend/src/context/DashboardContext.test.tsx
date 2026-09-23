/**
 * O DashboardContext lendo o faturamento da camada `gold`.
 *
 * Este caminho não tinha teste nenhum: `Dashboard.test.tsx` mocka o contexto
 * inteiro (testa a tela, não a busca) e `providers-por-rota` só confere que o
 * provider está montado na rota. Ou seja, a função que traz o número do
 * faturamento para a tela principal podia mudar sem nada acusar — e mudou, na
 * migração para `/faturamento/mensal`.
 *
 * O que estes testes travam é o contrato com a API nova: doze linhas por ano,
 * `mes` 1-based, `total` já somado. E os dois jeitos silenciosos de errar isso:
 * mês fora de faixa virando índice inválido, e falha de rede virando "a empresa
 * não faturou".
 */

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchFaturamentoMensal = vi.hoisted(() => vi.fn());
vi.mock("../services/notasapi", () => ({ fetchFaturamentoMensal }));

const estadoConfiguracoes = vi.hoisted(() => ({
  atual: [{ id: 1, chave: "MESES_ANALISE", valor: "7,8,9" }],
}));
vi.mock("./ConfiguracoesContext", () => ({
  useConfiguracoes: () => ({
    configuracoes: estadoConfiguracoes.atual,
    carregando: false,
    editarConfiguracao: vi.fn(),
    criarConfiguracao: vi.fn(),
  }),
}));

import { DashboardProvider, useDashboard } from "./DashboardContext";

/** Doze meses com o valor que o teste pedir; o resto zerado. */
function dozeMeses(valores: Partial<Record<number, number>> = {}) {
  return Array.from({ length: 12 }, (_, i) => ({
    ano: 2026,
    mes: i + 1,
    produto: 0,
    servico: 0,
    total: valores[i + 1] ?? 0,
  }));
}

function Espiao() {
  const { totalAno, serieMensal, dados, total, carregando } = useDashboard();
  if (carregando) return <p>carregando</p>;
  return (
    <div>
      <p data-testid="totalAno">{totalAno}</p>
      <p data-testid="totalTrimestre">{total}</p>
      <p data-testid="mesesNaSerie">{serieMensal.length}</p>
      <p data-testid="mesesEmApuracao">{dados.map((d) => d.total).join(",")}</p>
    </div>
  );
}

describe("DashboardContext lendo /faturamento/mensal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // MARÇO de 2026, de propósito: um mês que não é o mês real em que estes
    // testes rodam. Se a data falsa não valesse, o teste do gráfico passaria
    // por coincidência de calendário e quebraria sozinho no mês seguinte.
    vi.setSystemTime(new Date(2026, 2, 15));
  });

  it("soma o ano a partir das doze linhas da API", async () => {
    fetchFaturamentoMensal.mockResolvedValue(
      dozeMeses({ 1: 100, 2: 200, 3: 50 }),
    );

    render(
      <DashboardProvider>
        <Espiao />
      </DashboardProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("totalAno")).toHaveTextContent("350"),
    );
  });

  it("pede o ano corrente e o anterior, uma requisição cada", async () => {
    fetchFaturamentoMensal.mockResolvedValue(dozeMeses());

    render(
      <DashboardProvider>
        <Espiao />
      </DashboardProvider>,
    );

    await waitFor(() =>
      expect(fetchFaturamentoMensal).toHaveBeenCalledTimes(2),
    );
    expect(fetchFaturamentoMensal).toHaveBeenCalledWith(2026);
    expect(fetchFaturamentoMensal).toHaveBeenCalledWith(2025);
  });

  it("o gráfico para no mês corrente, sem barras vazias de mês futuro", async () => {
    fetchFaturamentoMensal.mockResolvedValue(dozeMeses());

    render(
      <DashboardProvider>
        <Espiao />
      </DashboardProvider>,
    );

    // Março = 3 meses, não 12: barra vazia de mês futuro sugeriria queda onde
    // só há calendário.
    await waitFor(() =>
      expect(screen.getByTestId("mesesNaSerie")).toHaveTextContent("3"),
    );
  });

  it("usa MESES_ANALISE para o trimestre em apuração", async () => {
    fetchFaturamentoMensal.mockResolvedValue(
      dozeMeses({ 7: 10, 8: 20, 9: 30 }),
    );

    render(
      <DashboardProvider>
        <Espiao />
      </DashboardProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("mesesEmApuracao")).toHaveTextContent(
        "10,20,30",
      ),
    );
    expect(screen.getByTestId("totalTrimestre")).toHaveTextContent("60");
  });

  it("ignora mês fora de 1..12 em vez de criar índice inválido", async () => {
    // `totais[-1] = x` em JS NÃO estoura: cria a propriedade "-1" no array e o
    // valor some do gráfico sem erro nenhum. É o tipo de defeito que só
    // aparece como "o total não bate" semanas depois.
    fetchFaturamentoMensal.mockResolvedValue([
      { ano: 2026, mes: 0, produto: 0, servico: 0, total: 999 },
      { ano: 2026, mes: 13, produto: 0, servico: 0, total: 888 },
      { ano: 2026, mes: 1, produto: 0, servico: 0, total: 7 },
    ]);

    render(
      <DashboardProvider>
        <Espiao />
      </DashboardProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("totalAno")).toHaveTextContent("7"),
    );
  });

  it("falha da API vira zero na tela, e não derruba o dashboard", async () => {
    // ⚠️ Zero aqui é o comportamento que já existia, e ele NÃO distingue "a API
    // caiu" de "a empresa não faturou" — o mesmo defeito que o erroDeCarga.test
    // fechou para vendas, serviços e contas. Fica travado como está para a
    // mudança de fonte de dados não escondê-lo; corrigir é outro item.
    fetchFaturamentoMensal.mockRejectedValue(new Error("500"));

    render(
      <DashboardProvider>
        <Espiao />
      </DashboardProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("totalAno")).toHaveTextContent("0"),
    );
  });
});
