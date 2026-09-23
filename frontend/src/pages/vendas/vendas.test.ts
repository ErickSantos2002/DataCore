import { describe, expect, it } from "vitest";

import type { ResumoComercial } from "../../services/notasapi";
import { intervaloDeComparacao } from "./vendas";

/**
 * O intervalo que o comparativo de Vendas busca quando o último período ainda
 * não fechou.
 *
 * O comparativo punha o último ponto contra o penúltimo: com o ano em curso,
 * 2026 até setembro contra 2025 inteiro dava "−32%", e no dia 3 do mês a
 * variação mensal saía perto de −100%. Decisão do Erick (22/09): comparar o
 * MESMO intervalo do período anterior. A evolução vem por mês, sem dia, então
 * o intervalo equivalente é uma segunda busca — e esta conta diz qual.
 *
 * Cada "hoje" é construído em hora LOCAL às 23h30: em `TZ=America/Sao_Paulo`
 * esse instante já é o dia seguinte em UTC, e uma conta que passasse por
 * `toISOString` erraria o dia (ver `lib/datas.ts`).
 */

function meses(
  ...pares: [number, number][]
): ResumoComercial["evolucao_mensal"] {
  return pares.map(([ano, mes]) => ({
    ano,
    mes,
    total: 1,
    total_produtos: 1,
    notas: 1,
    quantidade: 1,
  }));
}

/** 26 meses, de jan/2024 a fev/2026: a evolução vira anual. */
const VINTE_E_SEIS = meses(
  ...Array.from(
    { length: 26 },
    (_, i) => [2024 + Math.floor(i / 12), (i % 12) + 1] as [number, number],
  ),
);

const SEM_DATAS = { dataInicio: "", dataFim: "" };
const as2330 = (ano: number, mes: number, dia: number) =>
  new Date(ano, mes - 1, dia, 23, 30);

describe("intervaloDeComparacao — mes a mes", () => {
  it("mes em curso compara com os mesmos dias do mes anterior", () => {
    expect(
      intervaloDeComparacao(
        meses([2026, 6], [2026, 7], [2026, 8]),
        SEM_DATAS,
        as2330(2026, 8, 20),
      ),
    ).toEqual({
      anterior: { dataInicio: "2026-07-01", dataFim: "2026-07-20" },
      ate: "até dia 20",
    });
  });

  it("com o ultimo mes ja fechado, nao ha o que buscar", () => {
    expect(
      intervaloDeComparacao(
        meses([2026, 6], [2026, 7], [2026, 8]),
        SEM_DATAS,
        as2330(2026, 9, 22),
      ),
    ).toBeNull();
  });

  it("recorte que termina no ultimo dia do mes tambem e fechado", () => {
    expect(
      intervaloDeComparacao(
        meses([2026, 7], [2026, 8]),
        { dataInicio: "", dataFim: "2026-08-31" },
        as2330(2026, 8, 31),
      ),
    ).toBeNull();
  });

  it("recorte que termina no meio do mes, no passado, e aberto ate ali", () => {
    // Quem escolhe 01/07 a 15/08 compara 1 a 15 de agosto com 1 a 15 de julho.
    expect(
      intervaloDeComparacao(
        meses([2026, 7], [2026, 8]),
        { dataInicio: "2026-07-01", dataFim: "2026-08-15" },
        as2330(2026, 9, 22),
      ),
    ).toEqual({
      anterior: { dataInicio: "2026-07-01", dataFim: "2026-07-15" },
      ate: "até dia 15",
    });
  });

  it("recorte que comeca no meio do mes leva o comeco junto", () => {
    expect(
      intervaloDeComparacao(
        meses([2026, 7], [2026, 8]),
        { dataInicio: "2026-07-10", dataFim: "" },
        as2330(2026, 8, 20),
      ),
    ).toEqual({
      anterior: { dataInicio: "2026-07-01", dataFim: "2026-07-20" },
      ate: "até dia 20",
    });
  });

  it("recorte que comeca dentro do ultimo mes desloca o comeco tambem", () => {
    expect(
      intervaloDeComparacao(
        meses([2026, 7], [2026, 8]),
        { dataInicio: "2026-08-10", dataFim: "" },
        as2330(2026, 8, 20),
      ),
    ).toEqual({
      anterior: { dataInicio: "2026-07-10", dataFim: "2026-07-20" },
      ate: "até dia 20",
    });
  });

  it("fim no futuro vale ate hoje, que e onde os dados acabam", () => {
    // O preset "Mês atual" manda o fim do mês; o dado só existe até hoje.
    expect(
      intervaloDeComparacao(
        meses([2026, 8], [2026, 9]),
        { dataInicio: "2026-08-01", dataFim: "2026-09-30" },
        as2330(2026, 9, 22),
      ),
    ).toEqual({
      anterior: { dataInicio: "2026-08-01", dataFim: "2026-08-22" },
      ate: "até dia 22",
    });
  });

  it("dia 30 num mes seguido de um mais curto para no ultimo dia dele", () => {
    // 30/03 − 1 mês não é 02/03, que é onde `setMonth` escorrega. (No dia 31
    // março já fechou, e compara-se o mês inteiro.)
    expect(
      intervaloDeComparacao(
        meses([2026, 2], [2026, 3]),
        SEM_DATAS,
        as2330(2026, 3, 30),
      ),
    ).toEqual({
      anterior: { dataInicio: "2026-02-01", dataFim: "2026-02-28" },
      ate: "até dia 30",
    });
  });

  it("no ultimo dia do mes, o mes ja esta inteiro e nao ha o que buscar", () => {
    expect(
      intervaloDeComparacao(
        meses([2026, 2], [2026, 3]),
        SEM_DATAS,
        as2330(2026, 3, 31),
      ),
    ).toBeNull();
  });

  it("janeiro compara com dezembro do ano anterior", () => {
    expect(
      intervaloDeComparacao(
        meses([2025, 12], [2026, 1]),
        SEM_DATAS,
        as2330(2026, 1, 15),
      ),
    ).toEqual({
      anterior: { dataInicio: "2025-12-01", dataFim: "2025-12-15" },
      ate: "até dia 15",
    });
  });

  it("com menos de dois pontos, nao ha comparativo nem busca", () => {
    expect(
      intervaloDeComparacao(meses([2026, 8]), SEM_DATAS, as2330(2026, 8, 20)),
    ).toBeNull();
  });
});

describe("intervaloDeComparacao — por ano", () => {
  it("ano em curso compara com o mesmo intervalo do ano anterior", () => {
    expect(
      intervaloDeComparacao(VINTE_E_SEIS, SEM_DATAS, as2330(2026, 9, 22)),
    ).toEqual({
      anterior: { dataInicio: "2025-01-01", dataFim: "2025-09-22" },
      ate: "até 22/09",
    });
  });

  it("29 de fevereiro compara com 28 de fevereiro do ano anterior", () => {
    const ate2028 = meses(
      ...Array.from(
        { length: 26 },
        (_, i) => [2026 + Math.floor(i / 12), (i % 12) + 1] as [number, number],
      ),
    ).concat(meses([2028, 1], [2028, 2]));
    expect(
      intervaloDeComparacao(ate2028, SEM_DATAS, as2330(2028, 2, 29)),
    ).toEqual({
      anterior: { dataInicio: "2027-01-01", dataFim: "2027-02-28" },
      ate: "até 29/02",
    });
  });

  it("com o ano fechado em 31/12, nao ha o que buscar", () => {
    expect(
      intervaloDeComparacao(
        VINTE_E_SEIS,
        { dataInicio: "", dataFim: "2026-12-31" },
        as2330(2027, 1, 5),
      ),
    ).toBeNull();
  });
});
