import { describe, expect, it } from "vitest";

import {
  converterParaNumero,
  formatarDinheiro,
  formatarDinheiroAbreviado,
  mascaraDeDinheiro,
} from "./dinheiro";

describe("converterParaNumero", () => {
  it("número já pronto passa direto", () => {
    expect(converterParaNumero(1500.5)).toBe(1500.5);
    expect(converterParaNumero(0)).toBe(0);
    expect(converterParaNumero(-50)).toBe(-50);
  });

  it("formato brasileiro: a vírgula é o decimal e o ponto é o milhar", () => {
    expect(converterParaNumero("1.234,56")).toBe(1234.56);
    expect(converterParaNumero("1.234.567,89")).toBe(1234567.89);
    expect(converterParaNumero("0,50")).toBe(0.5);
    expect(converterParaNumero("-1.000,25")).toBe(-1000.25);
  });

  it("formato americano: o ponto é o decimal", () => {
    expect(converterParaNumero("1234.56")).toBe(1234.56);
    expect(converterParaNumero("1000.00")).toBe(1000);
    expect(converterParaNumero("0.5")).toBe(0.5);
    expect(converterParaNumero("300")).toBe(300);
  });

  it("ponto de milhar SEM casa decimal é milhar, e não decimal", () => {
    // Este é o defeito que o módulo fecha: `1.234` não tem vírgula, então o
    // ponto era lido como decimal e a nota de mil duzentos e trinta e quatro
    // reais virava R$ 1,23 na tela, no KPI e na planilha.
    expect(converterParaNumero("1.234")).toBe(1234);
    expect(converterParaNumero("12.000")).toBe(12000);
    expect(converterParaNumero("1.234.567")).toBe(1234567);
    expect(converterParaNumero("-12.000")).toBe(-12000);
  });

  it("uma ou duas casas depois do ponto continuam sendo decimal", () => {
    // A régua é o tamanho do grupo: três dígitos agrupados é milhar, uma ou
    // duas casas é centavo.
    expect(converterParaNumero("1.23")).toBe(1.23);
    expect(converterParaNumero("1.2")).toBe(1.2);
    expect(converterParaNumero("1234.5")).toBe(1234.5);
  });

  it("o R$ e os espaços vêm junto sem atrapalhar", () => {
    expect(converterParaNumero("R$ 1.500,50")).toBe(1500.5);
    expect(converterParaNumero(" R$1.234 ")).toBe(1234);
  });

  it("o que não é número vale zero, e nunca NaN", () => {
    expect(converterParaNumero("")).toBe(0);
    expect(converterParaNumero(null)).toBe(0);
    expect(converterParaNumero(undefined)).toBe(0);
    expect(converterParaNumero("sem valor")).toBe(0);
  });
});

describe("formatarDinheiro", () => {
  // O `Intl` separa o símbolo do número com espaço DURO (U+00A0), não com
  // espaço comum. Escrito aqui explicitamente porque é a pegadinha que faz um
  // `toContain("R$ 100,00")` falhar contra um texto idêntico na tela — quem
  // for comparar textContent na mão precisa normalizar o espaço antes.
  const ESPACO_DURO = "\u00A0";

  it("escreve em real, com dois decimais", () => {
    expect(formatarDinheiro(1234.5)).toBe(`R$${ESPACO_DURO}1.234,50`);
    expect(formatarDinheiro(0)).toBe(`R$${ESPACO_DURO}0,00`);
  });

  it("zero é zero, e não travessão", () => {
    // Diferente do `formatarMoeda` da tela de Financeiro, que troca zero por
    // travessão porque lá zero quase sempre é mês que ainda não aconteceu.
    // Aqui zero é valor apurado: comissão zerada é uma informação.
    expect(formatarDinheiro(0)).not.toBe("—");
    expect(formatarDinheiro(0)).toContain("0,00");
  });

  it("negativo sai com sinal", () => {
    expect(formatarDinheiro(-250)).toBe(`-R$${ESPACO_DURO}250,00`);
  });
});

describe("mascaraDeDinheiro", () => {
  it("agrupa o milhar com ponto enquanto se digita", () => {
    expect(mascaraDeDinheiro("1234567")).toBe("1.234.567");
    expect(mascaraDeDinheiro("100")).toBe("100");
  });

  it("preserva o que vem depois da vírgula", () => {
    expect(mascaraDeDinheiro("1234,5")).toBe("1.234,5");
    expect(mascaraDeDinheiro("1234,")).toBe("1.234,");
  });

  it("descarta o que não é dígito nem vírgula", () => {
    expect(mascaraDeDinheiro("R$ 12a34")).toBe("1.234");
  });

  it("o que ela escreve, o converterParaNumero lê de volta igual", () => {
    // As duas precisam fechar: a máscara escreve ponto de milhar, e é o
    // `PONTO_DE_MILHAR` do conversor que impede que "1.234.567" volte como
    // 1,234. É a discordância entre máscara e parse que faz o Centro de Custo
    // ler um valor sem centavos dividido por mil.
    for (const digitado of ["1234567", "1234567,89", "999", "0,50"]) {
      const mascarado = mascaraDeDinheiro(digitado);
      expect(converterParaNumero(mascarado)).toBe(
        converterParaNumero(digitado.replace(",", ".")),
      );
    }
  });
});

describe("formatarDinheiroAbreviado", () => {
  // O dos eixos e balões dos gráficos. Havia oito cópias, uma por tela, e
  // todas escreviam "R$ 2.5M" e "R$ 3.4K" — ponto decimal e sufixo do inglês —,
  // cada uma com a sua regra abaixo de mil. Decisão do Erick (22/09): o
  // padrão do português, "R$ 2,5 mi" e "R$ 3,4 mil".
  const d = (texto: string) => texto.replace(/ /g, "\u00A0");

  it("milhão, milhar e unidade, com vírgula e sufixo em português", () => {
    expect(formatarDinheiroAbreviado(2_500_000)).toBe(d("R$ 2,5 mi"));
    expect(formatarDinheiroAbreviado(3_400)).toBe(d("R$ 3,4 mil"));
    expect(formatarDinheiroAbreviado(999.5)).toBe(d("R$ 999,5"));
    expect(formatarDinheiroAbreviado(0)).toBe(d("R$ 0"));
  });

  it("uma casa no maximo, e sem casa quando e redondo", () => {
    expect(formatarDinheiroAbreviado(15_684_661.84)).toBe(d("R$ 15,7 mi"));
    expect(formatarDinheiroAbreviado(1_000_000)).toBe(d("R$ 1 mi"));
    expect(formatarDinheiroAbreviado(250_000)).toBe(d("R$ 250 mil"));
  });

  it("arredonda para a unidade de cima quando cruza a fronteira", () => {
    // As cópias comparavam `>= 1_000_000` antes de arredondar: 999.999 saía
    // "R$ 1000.0K".
    expect(formatarDinheiroAbreviado(999_999)).toBe(d("R$ 1 mi"));
  });

  it("negativo leva o sinal, e nao cai na regra de unidade", () => {
    // As cópias só olhavam `valor >= 1_000`: −2.500.000 caía no ramo de
    // unidade e saía "R$ -2500000.00".
    expect(formatarDinheiroAbreviado(-2_500_000)).toBe(d("-R$ 2,5 mi"));
    expect(formatarDinheiroAbreviado(-3_400)).toBe(d("-R$ 3,4 mil"));
  });
});
