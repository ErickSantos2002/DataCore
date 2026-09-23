import { describe, expect, it } from "vitest";

import {
  EQUIPE_PADRAO,
  calcularComissaoDeServico,
  comissaoBaseDeServico,
} from "./comissaoDeServico";

/**
 * A escada de metas de serviço, tirada das fórmulas da planilha de
 * fechamento. Os degraus são mutuamente exclusivos e cada um soma um prêmio
 * fixo a 1% do faturamento — menos o primeiro, que paga só R$ 250.
 */

describe("comissão de serviço — a escada de metas", () => {
  it.each([
    ["nada abaixo do primeiro degrau", 0, 0],
    ["80.000 exatos ainda não pagam", 80_000, 0],
    ["um centavo acima abre o degrau de 250", 80_000.01, 250],
    ["100.000 exatos ainda são o degrau fixo", 100_000, 250],
    ["acima de 100.000 passa a valer 1%", 100_000.01, 1_000.0001],
    ["124.999,99 ainda é só o 1%", 124_999.99, 1_249.9999],
    ["150.000 exatos pagam 1% + 500", 150_000, 2_000],
    ["175.000 exatos pagam 1% + 750", 175_000, 2_500],
    ["199.999,99 ainda é o degrau de 750", 199_999.99, 2_749.9999],
    ["200.000 abre o último degrau", 200_000, 3_000],
    ["acima disso segue 1% + 1.000", 500_000, 6_000],
  ])("%s", (_rotulo, faturamento, esperada) => {
    expect(comissaoBaseDeServico(faturamento)).toBeCloseTo(esperada, 4);
  });

  it("125.000 exatos pagam o degrau, e não zero", () => {
    // Na planilha este valor caía no vão entre dois degraus: um abria com
    // `>125000` e o outro fechava com `>=125000`, então o valor exato escapava
    // dos dois e pagava zero. Mesmo buraco em 150.000 e 175.000. Aqui os três
    // estão fechados — é a correção que o Erick autorizou.
    expect(comissaoBaseDeServico(125_000)).toBeCloseTo(1_500, 4);
    expect(comissaoBaseDeServico(150_000)).toBeCloseTo(2_000, 4);
    expect(comissaoBaseDeServico(175_000)).toBeCloseTo(2_500, 4);
  });
});

describe("comissão de serviço — repartição por papel", () => {
  it("cada papel recebe a base multiplicada pelo próprio percentual", () => {
    const { base, linhas } = calcularComissaoDeServico(200_000, EQUIPE_PADRAO);

    expect(base).toBeCloseTo(3_000, 4);
    expect(linhas.map((l) => l.valor)).toEqual([3_000, 2_250, 1_500]);
  });

  it("o total pago é a soma das pessoas, não a base", () => {
    // Os percentuais somam 225%: a base NÃO é um bolo repartido, é um valor
    // de referência multiplicado por pessoa. Quem ler "Comissão Total" como
    // o que sai do caixa vai errar por mais do que o dobro.
    const { base, totalAPagar } = calcularComissaoDeServico(
      200_000,
      EQUIPE_PADRAO,
    );

    expect(totalAPagar).toBeCloseTo(6_750, 4);
    expect(totalAPagar).toBeGreaterThan(base);
  });

  it("sem ninguém na equipe não paga nada, e a base continua existindo", () => {
    const { base, totalAPagar } = calcularComissaoDeServico(200_000, []);

    expect(base).toBeCloseTo(3_000, 4);
    expect(totalAPagar).toBe(0);
  });

  it("os três papéis vêm com o percentual preenchido e o nome em branco", () => {
    // O percentual é regra e vem no código; o nome é pessoa e se digita no
    // mês. Guardar nome de funcionário aqui seria versionar quanto cada um
    // recebe.
    expect(
      EQUIPE_PADRAO.map((papel) => [papel.nome, papel.percentual]),
    ).toEqual([
      ["", 1],
      ["", 0.75],
      ["", 0.5],
    ]);
  });
});

describe("comissão de serviço — um fechamento de ponta a ponta", () => {
  /** Faturamento no último degrau da escada, com número redondo. */
  const FATURAMENTO = 300_000;

  it("a base é 1% do faturamento mais o prêmio do degrau", () => {
    // 300.000 × 1% + 1.000.
    expect(comissaoBaseDeServico(FATURAMENTO)).toBeCloseTo(4_000, 4);
  });

  it("os três papéis saem da mesma base, e o total é maior que ela", () => {
    const { linhas, totalAPagar } = calcularComissaoDeServico(
      FATURAMENTO,
      EQUIPE_PADRAO,
    );

    expect(linhas[0].valor).toBeCloseTo(4_000, 3); // 100%
    expect(linhas[1].valor).toBeCloseTo(3_000, 3); // 75%
    expect(linhas[2].valor).toBeCloseTo(2_000, 3); // 50%
    // 225% da base: é o que sai do caixa, e não os 4.000.
    expect(totalAPagar).toBeCloseTo(9_000, 3);
  });
});
