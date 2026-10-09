import { describe, expect, it } from "vitest";

import {
  STATUS,
  diasDeAtraso,
  formatarPercentual,
  haQuantosDias,
  linhasDaPlanilhaDeEmpresas,
  mensagemDeErro,
  nomeDoMes,
} from "./inadimplencia";

const HOJE = new Date(2026, 9, 9, 15, 0);

describe("inadimplência — regra pura", () => {
  it("dias de atraso contam do vencimento até hoje, sem hora; a vencer é 0", () => {
    expect(diasDeAtraso("2026-10-08", HOJE)).toBe(1);
    expect(diasDeAtraso("2026-09-08", HOJE)).toBe(31);
    expect(diasDeAtraso("2026-10-09", HOJE)).toBe(0);
    expect(diasDeAtraso("2026-10-20", HOJE)).toBe(0);
  });

  it("há quantos dias: hoje, ontem, N dias, nunca", () => {
    expect(haQuantosDias(null, HOJE)).toBe("nunca");
    expect(haQuantosDias("2026-10-09T10:00:00Z", HOJE)).toBe("hoje");
    expect(haQuantosDias("2026-10-08T10:00:00Z", HOJE)).toBe("ontem");
    expect(haQuantosDias("2026-09-27T10:00:00Z", HOJE)).toBe("há 12 dias");
  });

  it("percentual com uma casa, vírgula, e travessão quando não há taxa", () => {
    expect(formatarPercentual(0.158)).toBe("15,8%");
    expect(formatarPercentual(null)).toBe("—");
  });

  it("nome do mês curto", () => {
    expect(nomeDoMes("2026-03")).toBe("mar/26");
  });

  it("todo status tem rótulo e cor", () => {
    for (const s of Object.values(STATUS)) {
      expect(s.rotulo).toBeTruthy();
      expect(s.variante).toBeTruthy();
    }
  });

  it("planilha: dinheiro como número, status pelo rótulo", () => {
    const [linha] = linhasDaPlanilhaDeEmpresas([
      {
        empresa: "11111111", nome: "Alfa", documento: "11.111.111/0001-11", filiais: 1,
        titulos: 2, valor_devido: 300, valor_inadimplente: 200, maior_atraso: 45,
        status: "promessa", proxima_data: "2026-10-15", ultimo_contato: null,
      },
    ]);
    expect(linha).toEqual({
      Empresa: "Alfa", "CNPJ/CPF": "11.111.111/0001-11", Filiais: 1, Títulos: 2,
      "Valor devido": 300, "Valor inadimplente": 200, "Maior atraso (dias)": 45,
      Status: "Promessa de pagamento", "Próxima data": "15/10/2026", "Último contato": "",
    });
  });

  it("mensagem de erro: o detail do backend, senão uma frase padrão", () => {
    expect(mensagemDeErro({ response: { data: { detail: "A data prometida já passou." } } }))
      .toBe("A data prometida já passou.");
    expect(mensagemDeErro(new Error("x"))).toBe("Não foi possível gravar. Tente de novo.");
  });
});
