import { describe, expect, it } from "vitest";

import { alternarSituacao, datasDoPeriodo, rotuloDoMes } from "./notasEntrada";

describe("notasEntrada", () => {
  it("rótulo do mês sai do texto, sem virar o mês no fuso", () => {
    expect(rotuloDoMes("2026-03")).toBe("mar/26");
    expect(rotuloDoMes("2025-12")).toBe("dez/25");
    expect(rotuloDoMes("lixo")).toBe("lixo");
  });

  it("período: um ano vira o ano inteiro; 'todos' não recorta", () => {
    expect(datasDoPeriodo(2025)).toEqual({
      data_inicio: "2025-01-01",
      data_fim: "2025-12-31",
    });
    expect(datasDoPeriodo("todos")).toEqual({});
  });

  it("alternar situação mantém a ordem e nunca esvazia", () => {
    expect(alternarSituacao(["emitida"], "cancelada")).toEqual([
      "emitida",
      "cancelada",
    ]);
    expect(alternarSituacao(["emitida", "registrada"], "emitida")).toEqual([
      "registrada",
    ]);
    expect(alternarSituacao(["emitida"], "emitida")).toEqual(["emitida"]);
  });
});
