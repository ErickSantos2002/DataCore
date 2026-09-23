import { describe, expect, it } from "vitest";

import type { NotaLocacao } from "../../services/notasapi";
import {
  dataDaNota,
  linhasDaPlanilha,
  nomeDoArquivo,
  paraNumero,
  tomDaSituacao,
} from "./notasDeLocacao";

/**
 * A conta da Locação, testada como conta.
 *
 * O arquivo de tela (`Locacao.test.tsx`) já fixa os KPIs, a busca, a
 * ordenação e as colunas da planilha pelo que a tela mostra. Aqui ficam as
 * regras que a tela não consegue exercitar sozinha: o mapa de cor da
 * situação (a base real só tem uma situação, "Emitida DANFE"), o nome do
 * arquivo numa data fixa, e a data que sai no Excel — esta última varrida
 * em cinco fusos, porque o defeito que ela já teve só aparecia a oeste de
 * Greenwich.
 */

function nota(campos: Partial<NotaLocacao> & { id: number }): NotaLocacao {
  return {
    numero: null,
    data_emissao: "2026-07-10",
    valor_nota: 0,
    descricao_situacao: null,
    natureza_operacao: null,
    nome_vendedor: null,
    cliente: null,
    ...campos,
  };
}

describe("valor da nota", () => {
  it.each([
    ["número já numérico", 49000, 49000],
    ["string decimal com ponto", "1500.50", 1500.5],
    ["string vazia", "", 0],
    ["nulo", null, 0],
    ["indefinido", undefined, 0],
    ["texto que não é número", "sem valor", 0],
    // parseFloat para no primeiro caractere que não cabe: o separador de
    // milhar brasileiro vira ponto decimal e o resto da string é jogado fora.
    ["valor formatado em português", "1.234,56", 1.234],
  ])("%s vira %s", (_rotulo, entrada, esperado) => {
    expect(paraNumero(entrada as number | string | null | undefined)).toBe(
      esperado,
    );
  });
});

describe("data da nota na tela", () => {
  it("converte na string, sem passar por Date", () => {
    expect(dataDaNota("2026-07-10")).toBe("10/07/2026");
    expect(dataDaNota("2026-07-10T14:57:00")).toBe("10/07/2026");
  });

  it("sem data, mostra o travessão em vez de string vazia", () => {
    expect(dataDaNota(null)).toBe("—");
    expect(dataDaNota("")).toBe("—");
  });
});

describe("cor do selo de situação", () => {
  it.each([
    ["Cancelada", "danger"],
    ["Denegada", "danger"],
    ["Rejeitada pela SEFAZ", "danger"],
    ["Aguardando autorização", "warning"],
    ["Pendente", "warning"],
    ["Emitida DANFE", "success"],
    ["Autorizada", "success"],
    ["Registrada", "success"],
  ])("%s é %s", (situacao, esperado) => {
    expect(tomDaSituacao(situacao)).toBe(esperado);
  });

  it("não diferencia caixa", () => {
    expect(tomDaSituacao("CANCELADA")).toBe("danger");
  });

  it("sem situação, o selo fica neutro — não verde", () => {
    // Antes da migração toda situação saía verde, inclusive a ausente e a
    // cancelada. Verde é a cor de "deu certo"; nenhuma das duas deu.
    expect(tomDaSituacao(null)).toBe("muted");
    expect(tomDaSituacao("")).toBe("muted");
  });
});

describe("arquivo exportado", () => {
  it("o arquivo se chama locacao_ mais o dia local", () => {
    // O instante anterior deste teste era "2026-08-28T12:00:00Z" — meio-dia,
    // que cai no mesmo dia em São Paulo e em UTC, e por isso nunca exercitou a
    // virada. Um teste de data que escolhe o meio-dia não testa fuso: foi assim
    // que o defeito de UTC sobreviveu aqui mesmo com teste de caracterização.
    //
    // Este é construído em hora LOCAL, então a asserção vale nos dois fusos —
    // o dia local de um instante local é sempre o mesmo dia.
    const vinteETresHoras = new Date(2026, 7, 28, 23, 0, 0);
    expect(nomeDoArquivo(vinteETresHoras)).toBe("locacao_2026-08-28.xlsx");
  });
});

/**
 * Roda `corpo` com o fuso do processo fixado, e devolve o fuso como estava.
 *
 * Sem isto a asserção só valeria a oeste de Greenwich: em UTC,
 * `new Date("2026-07-10")` cai no próprio dia 10 e o defeito não aparece.
 * Um teste que só falha no fuso do Brasil passa no CI e não protege nada.
 */
function noFuso<T>(fuso: string, corpo: () => T): T {
  const anterior = process.env.TZ;
  process.env.TZ = fuso;
  try {
    return corpo();
  } finally {
    if (anterior === undefined) delete process.env.TZ;
    else process.env.TZ = anterior;
  }
}

describe("data na planilha", () => {
  /** Greenwich no meio, e os dois extremos do mundo de cada lado. */
  const FUSOS = [
    "America/Sao_Paulo",
    "Pacific/Midway",
    "UTC",
    "Asia/Tokyo",
    "Pacific/Kiritimati",
  ];

  it.each(FUSOS)("em %s, a planilha leva a data que a tela mostra", (fuso) => {
    const naPlanilha = noFuso(
      fuso,
      () =>
        linhasDaPlanilha([nota({ id: 1, data_emissao: "2026-07-10" })])[0].Data,
    );

    expect(naPlanilha).toBe("10/07/2026");
    expect(naPlanilha).toBe(dataDaNota("2026-07-10"));
  });

  it.each(FUSOS)(
    "em %s, as três datas do arquivo conferido saem no dia certo",
    (fuso) => {
      const datas = noFuso(fuso, () =>
        linhasDaPlanilha([
          nota({ id: 1, data_emissao: "2026-07-10" }),
          nota({ id: 2, data_emissao: "2026-05-22" }),
          nota({ id: 3, data_emissao: "2026-03-24" }),
        ]).map((linha) => linha.Data),
      );

      expect(datas).toEqual(["10/07/2026", "22/05/2026", "24/03/2026"]);
    },
  );

  it("com hora junto, os dois caminhos concordam", () => {
    const naPlanilha = linhasDaPlanilha([
      nota({ id: 1, data_emissao: "2026-07-10T14:57:00" }),
    ])[0].Data;
    expect(naPlanilha).toBe(dataDaNota("2026-07-10T14:57:00"));
  });
});
