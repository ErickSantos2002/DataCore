import { describe, expect, it } from "vitest";

import {
  mesesPorExtenso,
  nomeDoTrimestre,
  trimestreEmApuracao,
  valorDoTrimestre,
} from "./trimestre";

/**
 * Qual trimestre o painel mede. "auto" segue o calendário; "AAAA-TN" fixa um —
 * com ano, para que fixar o T4 no dia 2 de janeiro mostre o T4 que acabou, e
 * não o T4 vazio do ano novo.
 */
describe("trimestre em apuração", () => {
  it.each([
    [new Date(2026, 0, 1), 1, [1, 2, 3]],
    [new Date(2026, 2, 31), 1, [1, 2, 3]],
    [new Date(2026, 3, 1), 2, [4, 5, 6]],
    [new Date(2026, 8, 30), 3, [7, 8, 9]],
    [new Date(2026, 9, 1), 4, [10, 11, 12]],
    [new Date(2026, 11, 31), 4, [10, 11, 12]],
  ])("auto em %s é o %iº trimestre", (hoje, trimestre, meses) => {
    expect(trimestreEmApuracao("auto", hoje as Date)).toEqual({
      ano: 2026,
      trimestre,
      meses,
      fixado: false,
    });
  });

  it("fixado usa o ano e o trimestre gravados, não os de hoje", () => {
    expect(trimestreEmApuracao("2026-T4", new Date(2027, 0, 2))).toEqual({
      ano: 2026,
      trimestre: 4,
      meses: [10, 11, 12],
      fixado: true,
    });
  });

  it("aceita t minúsculo e espaço em volta", () => {
    expect(
      trimestreEmApuracao(" 2026-t3 ", new Date(2026, 9, 1)).trimestre,
    ).toBe(3);
  });

  it.each([undefined, "", "10,11,12", "2026-T5", "lixo"])(
    "valor %j cai no automático — o painel nunca fica sem trimestre",
    (valor) => {
      const t = trimestreEmApuracao(valor, new Date(2026, 9, 1));
      expect(t.fixado).toBe(false);
      expect(t.trimestre).toBe(4);
    },
  );

  it("monta o valor gravado e os rótulos da tela", () => {
    expect(valorDoTrimestre(2026, 3)).toBe("2026-T3");
    expect(nomeDoTrimestre({ ano: 2026, trimestre: 4 })).toBe(
      "4º trimestre de 2026",
    );
    expect(mesesPorExtenso([10, 11, 12])).toBe("out, nov, dez");
  });
});
