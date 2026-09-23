import { describe, expect, it } from "vitest";

import { periodoDoMes, periodoDoPreset } from "./periodo";

/**
 * A conta dos presets de período, compartilhada por Contas e pelas cinco telas
 * que a adotaram na Fase 4.
 *
 * Os casos abaixo vieram de `pages/contas/contas.test.ts`, onde nasceram com a
 * Fase 3. Subiram junto com a função.
 */

const AGORA = new Date("2026-08-31T12:00:00Z");

describe("periodoDoPreset", () => {
  it("Todos limpa as duas pontas", () => {
    expect(periodoDoPreset("todos", AGORA)).toEqual({ inicio: "", fim: "" });
  });

  it("Personalizado não mexe em nada — devolve nulo", () => {
    expect(periodoDoPreset("custom", AGORA)).toBeNull();
  });

  it("Últimos 7 dias conta sete dias para trás", () => {
    // A janela é a mesma que as cinco telas já calculavam — `setDate(hoje.getDate()
    // - 7)` com o fim em hoje —, mas as duas pontas agora saem do DIA LOCAL. As
    // cópias antigas montavam as pontas com `toISOString` (UTC), e por isso
    // divergiam do dia local a partir das 21h em Brasília. O ramo nasce aqui
    // porque Contas não tinha esta opção, e sem ele a escolha cairia no
    // `default` e viraria "Todos" — silenciosamente.
    expect(periodoDoPreset("7dias", AGORA)).toEqual({
      inicio: "2026-08-24",
      fim: "2026-08-31",
    });
  });

  it("Últimos 30 dias conta 30 dias para trás", () => {
    expect(periodoDoPreset("30dias", AGORA)).toEqual({
      inicio: "2026-08-01",
      fim: "2026-08-31",
    });
  });

  it("Mês atual é o mês INTEIRO, do dia 1 ao último — e não até hoje", () => {
    expect(
      periodoDoPreset("mesAtual", new Date("2026-03-15T12:00:00Z")),
    ).toEqual({
      inicio: "2026-03-01",
      fim: "2026-03-31",
    });
    expect(
      periodoDoPreset("mesAtual", new Date("2026-02-10T12:00:00Z")),
    ).toEqual({
      inicio: "2026-02-01",
      fim: "2026-02-28",
    });
    expect(periodoDoPreset("mesAtual", AGORA)).toEqual({
      inicio: "2026-08-01",
      fim: "2026-08-31",
    });
  });

  it("Mês passado é o mês anterior INTEIRO", () => {
    expect(
      periodoDoPreset("mesPassado", new Date("2026-03-15T12:00:00Z")),
    ).toEqual({
      inicio: "2026-02-01",
      fim: "2026-02-28",
    });
  });

  it("Mês passado atravessa a virada do ano — em janeiro é dezembro do ano anterior", () => {
    // Com `periodoDoMes(ano, mes - 1)` cru, janeiro viraria o índice -1 e o
    // rótulo do mês sairia "0": `2026-00-01`, uma data que o `<input type=date>`
    // recusa em silêncio e deixa o campo vazio.
    expect(
      periodoDoPreset("mesPassado", new Date("2026-01-15T12:00:00Z")),
    ).toEqual({
      inicio: "2025-12-01",
      fim: "2025-12-31",
    });
  });

  it("Mês passado não escorrega quando hoje é dia 31", () => {
    // O caminho curto — tomar HOJE e recuar um mês — estoura: 31 de março
    // recuado vira 31 de fevereiro, que o JavaScript normaliza para 3 de
    // março, e "mês passado" devolveria março de novo. Por isso a conta parte
    // do dia 1, não do dia de hoje.
    expect(
      periodoDoPreset("mesPassado", new Date("2026-03-31T12:00:00Z")),
    ).toEqual({
      inicio: "2026-02-01",
      fim: "2026-02-28",
    });
  });

  it("Ano atual pega o ano inteiro", () => {
    expect(periodoDoPreset("anoAtual", AGORA)).toEqual({
      inicio: "2026-01-01",
      fim: "2026-12-31",
    });
  });

  it("na virada do dia, as duas pontas saem do dia LOCAL", () => {
    // 01/09 às 02h em Greenwich ainda é 31/08 às 23h em Brasília. Antes o
    // início vinha de `getFullYear`/`getMonth` (local) e o fim de
    // `toISOString` (UTC), e o "mês atual" atravessava a virada: 01/08 a
    // 01/09. Agora as duas pontas contam o mesmo dia — o do relógio de quem
    // olha a tela.
    const viradaDoMes = new Date("2026-09-01T02:00:00Z");
    const foraDoUtc = viradaDoMes.getTimezoneOffset() !== 0;

    expect(periodoDoPreset("mesAtual", viradaDoMes)).toEqual(
      foraDoUtc
        ? { inicio: "2026-08-01", fim: "2026-08-31" }
        : { inicio: "2026-09-01", fim: "2026-09-30" },
    );
    expect(periodoDoPreset("30dias", viradaDoMes)).toEqual(
      foraDoUtc
        ? { inicio: "2026-08-01", fim: "2026-08-31" }
        : { inicio: "2026-08-02", fim: "2026-09-01" },
    );
    expect(periodoDoPreset("7dias", viradaDoMes)).toEqual(
      foraDoUtc
        ? { inicio: "2026-08-24", fim: "2026-08-31" }
        : { inicio: "2026-08-25", fim: "2026-09-01" },
    );
    // "Mês passado" anda junto: às 23h de 31/08 em Brasília ainda é julho que
    // ficou para trás, não agosto.
    expect(periodoDoPreset("mesPassado", viradaDoMes)).toEqual(
      foraDoUtc
        ? { inicio: "2026-07-01", fim: "2026-07-31" }
        : { inicio: "2026-08-01", fim: "2026-08-31" },
    );
  });

  it("na virada do ano, o ano atual é o ano LOCAL — e não o de Greenwich", () => {
    const viradaDoAno = new Date("2026-01-01T02:00:00Z");
    const foraDoUtc = viradaDoAno.getTimezoneOffset() !== 0;

    expect(periodoDoPreset("anoAtual", viradaDoAno)).toEqual(
      foraDoUtc
        ? { inicio: "2025-01-01", fim: "2025-12-31" }
        : { inicio: "2026-01-01", fim: "2026-12-31" },
    );
    expect(periodoDoPreset("mesAtual", viradaDoAno)).toEqual(
      foraDoUtc
        ? { inicio: "2025-12-01", fim: "2025-12-31" }
        : { inicio: "2026-01-01", fim: "2026-01-31" },
    );
  });
});

describe("periodoDoMes", () => {
  it("acerta o último dia do mês curto", () => {
    expect(periodoDoMes(2026, 1)).toEqual({
      inicio: "2026-02-01",
      fim: "2026-02-28",
    });
  });
});
