import { describe, expect, it } from "vitest";

import { ANOS, seriesDaApi, somaDoAno } from "./financeiro";

/**
 * A distribuição das linhas de `GET /faturamento/mensal` nas séries da tela.
 *
 * É a peça que substituiu `somarVendas`/`somarServicos`, e o lugar onde um
 * erro de índice não daria erro nenhum: a API numera o mês a partir de 1 e o
 * array a partir de 0, então esquecer o `-1` jogaria janeiro em fevereiro e a
 * tela continuaria somando o mesmo total do ano — certo no KPI, torto no
 * gráfico.
 */

/** Uma linha da API, com os campos não citados zerados. */
function mes(
  ano: number,
  mes: number,
  campos: Partial<{
    produto: number;
    servico: number;
    quantidade_produto: number;
    quantidade_servico: number;
  }> = {},
) {
  return {
    ano,
    mes,
    produto: 0,
    servico: 0,
    quantidade_produto: 0,
    quantidade_servico: 0,
    ...campos,
  };
}

describe("seriesDaApi", () => {
  it("põe janeiro no índice 0 e dezembro no 11", () => {
    const { vendas } = seriesDaApi([
      mes(2025, 1, { produto: 10 }),
      mes(2025, 12, { produto: 20 }),
    ]);

    expect(vendas[2025][0]).toBe(10);
    expect(vendas[2025][11]).toBe(20);
    // O meio continua zerado: nada escorregou de mês.
    expect(vendas[2025].slice(1, 11)).toEqual(Array(10).fill(0));
  });

  it("separa produto de serviço em séries diferentes", () => {
    const { vendas, servicos } = seriesDaApi([
      mes(2025, 3, { produto: 100, servico: 7 }),
    ]);

    expect(vendas[2025][2]).toBe(100);
    expect(servicos[2025][2]).toBe(7);
  });

  it("soma a quantidade dos doze meses em um número por ano", () => {
    const { notasDeVenda, notasDeServico } = seriesDaApi([
      mes(2025, 1, { quantidade_produto: 2, quantidade_servico: 1 }),
      mes(2025, 2, { quantidade_produto: 3 }),
      mes(2026, 1, { quantidade_produto: 5 }),
    ]);

    expect(notasDeVenda[2025]).toBe(5);
    expect(notasDeServico[2025]).toBe(1);
    expect(notasDeVenda[2026]).toBe(5);
  });

  it("descarta ano fora da janela em vez de somá-lo no primeiro", () => {
    // O caso que a soma no navegador também tratava: a base começa antes de
    // 2022, e 2021 não pode aparecer dentro de 2022.
    const { vendas, notasDeVenda } = seriesDaApi([
      mes(2021, 1, { produto: 999, quantidade_produto: 9 }),
      mes(2022, 1, { produto: 1 }),
    ]);

    expect(somaDoAno(vendas, 2022)).toBe(1);
    expect(notasDeVenda[2022]).toBe(0);
    expect(vendas[2021]).toBeUndefined();
  });

  it("ignora mês fora de 1..12, que escreveria fora da série", () => {
    const { vendas } = seriesDaApi([
      mes(2025, 0, { produto: 50 }),
      mes(2025, 13, { produto: 60 }),
      mes(2025, 6, { produto: 7 }),
    ]);

    expect(somaDoAno(vendas, 2025)).toBe(7);
    expect(vendas[2025]).toHaveLength(12);
  });

  it("sem nenhuma linha, entrega a janela inteira zerada", () => {
    // É o estado inicial do hook e o estado de falha: a tela precisa de doze
    // posições por ano para desenhar, e não de objeto vazio.
    const { vendas, servicos, notasDeVenda } = seriesDaApi([]);

    for (const ano of ANOS) {
      expect(vendas[ano]).toEqual(Array(12).fill(0));
      expect(servicos[ano]).toEqual(Array(12).fill(0));
      expect(notasDeVenda[ano]).toBe(0);
    }
  });

  it("acumula linhas repetidas do mesmo mês em vez de sobrescrever", () => {
    const { vendas } = seriesDaApi([
      mes(2025, 5, { produto: 10 }),
      mes(2025, 5, { produto: 5 }),
    ]);

    expect(vendas[2025][4]).toBe(15);
  });
});
