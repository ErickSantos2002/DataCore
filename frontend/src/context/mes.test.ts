import { describe, expect, it } from "vitest";

import { rotuloDoMes } from "./mes";

describe("rótulo do mês", () => {
  it("escreve o mês por extenso com inicial maiúscula e o ano", () => {
    expect(rotuloDoMes(1, 2026)).toBe("Janeiro/2026");
    expect(rotuloDoMes(9, 2025)).toBe("Setembro/2025");
  });
});
