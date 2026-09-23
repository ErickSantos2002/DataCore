import { describe, expect, it } from "vitest";

import {
  degrausDaMeta,
  faixaAlcancada,
  mesesDoTrimestre,
  projecaoDeFechamento,
} from "./metaTrimestral";

/**
 * A conta da Meta do trimestre, testada como conta.
 *
 * O arquivo de tela (`Dashboard.test.tsx`) já fixa o parse da META, a
 * divisão por 4 e os três degraus pelo que a tela mostra. Aqui ficam as
 * regras que a tela não consegue exercitar sozinha porque dependem do
 * calendário — a projeção de fechamento, sobretudo. Projeção errada num
 * painel de meta não quebra nada: só mostra um número plausível e errado
 * por meses a fio.
 *
 * A projeção tem dois métodos, e cada um tem o seu bloco aqui. O SAZONAL é o
 * bom: usa a forma do mesmo trimestre do ano anterior, corrigida pelo
 * crescimento medido até agora. O LINEAR é a queda para quando não há ano
 * anterior com que comparar — regra de três sobre dias, que assume que todo
 * mês do trimestre vende no mesmo ritmo. Os testes do linear vieram intactos
 * de quando ele era o único método; o que mudou foi o nome do bloco, porque
 * ele deixou de ser "a" projeção para ser a queda dela.
 */

/** Junho (30) + julho (31) + agosto (31) — o trimestre em uso hoje. */
const TRIMESTRE = [6, 7, 8];
const DIAS_DO_TRIMESTRE = 92;

describe("meses do trimestre", () => {
  it("lê a lista da chave MESES_ANALISE, com ou sem espaço", () => {
    expect(mesesDoTrimestre("6,7,8")).toEqual([6, 7, 8]);
    expect(mesesDoTrimestre(" 6 , 7 , 8 ")).toEqual([6, 7, 8]);
  });

  it("descarta o que não é mês do calendário", () => {
    // 0, 13 e "abril" nao sao mes 1..12 — entrariam no calendario da
    // projecao como dia nenhum, ou como um mes que nao existe.
    expect(mesesDoTrimestre("0,6,13,abril,7")).toEqual([6, 7]);
    expect(mesesDoTrimestre("")).toEqual([]);
    expect(mesesDoTrimestre(undefined)).toEqual([]);
  });
});

describe("faixa de PL alcançada", () => {
  const degraus = degrausDaMeta("12000000"); // 2,7 mi / 3,6 mi / 4,2 mi

  it.each([
    ["abaixo do primeiro degrau", 2_699_999, null],
    ["exatamente no primeiro degrau", 2_700_000, "55%"],
    ["entre o primeiro e o segundo", 3_000_000, "55%"],
    ["exatamente no segundo degrau", 3_600_000, "85%"],
    ["exatamente no terceiro degrau", 4_200_000, "100%"],
    ["acima do terceiro degrau", 9_000_000, "100%"],
  ])("com %s devolve %s", (_rotulo, valor, esperado) => {
    expect(faixaAlcancada(valor as number, degraus)).toBe(esperado);
  });
});

describe("projeção de fechamento — o método linear, sem o ano anterior", () => {
  it("projeta pela regra de três sobre os dias do trimestre", () => {
    // 31/07: junho inteiro (30) + julho inteiro (31) = 61 dias de 92.
    // R$ 1.220.000 em 61 dias sao R$ 20.000/dia; 92 dias fecham 1.840.000.
    const projecao = projecaoDeFechamento({
      realizado: 1_220_000,
      meses: TRIMESTRE,
      hoje: new Date(2026, 6, 31),
    });

    expect(projecao.disponivel).toBe(true);
    expect(projecao.diasDecorridos).toBe(61);
    expect(projecao.diasTotais).toBe(DIAS_DO_TRIMESTRE);
    expect(projecao.projetado).toBeCloseTo(1_840_000, 2);
  });

  it("não muda de patamar na virada do mês, mantido o mesmo ritmo diário", () => {
    // Esta e a razao de a conta ser por DIA e nao por mes fechado. Contando
    // mes fechado, no dia 1º de agosto o divisor pularia de 2 para 3 meses
    // enquanto o faturamento de agosto ainda e de um dia — e a projecao
    // despencaria toda virada de mes para subir de novo ao longo dela.
    const emJulho = projecaoDeFechamento({
      realizado: 61 * 20_000,
      meses: TRIMESTRE,
      hoje: new Date(2026, 6, 31),
    });
    const emAgosto = projecaoDeFechamento({
      realizado: 62 * 20_000,
      meses: TRIMESTRE,
      hoje: new Date(2026, 7, 1),
    });

    expect(emAgosto.projetado).toBeCloseTo(emJulho.projetado, 2);
  });

  it("com o trimestre inteiro decorrido, a projeção é o próprio realizado", () => {
    const projecao = projecaoDeFechamento({
      realizado: 4_000_000,
      meses: TRIMESTRE,
      hoje: new Date(2026, 7, 31),
    });

    expect(projecao.diasDecorridos).toBe(DIAS_DO_TRIMESTRE);
    expect(projecao.projetado).toBe(4_000_000);
  });

  it("depois que o trimestre acaba, continua sendo o próprio realizado", () => {
    const projecao = projecaoDeFechamento({
      realizado: 4_000_000,
      meses: TRIMESTRE,
      hoje: new Date(2026, 10, 15),
    });

    expect(projecao.diasDecorridos).toBe(DIAS_DO_TRIMESTRE);
    expect(projecao.projetado).toBe(4_000_000);
  });

  it("no primeiro dia do trimestre, projeta sobre um dia só", () => {
    const projecao = projecaoDeFechamento({
      realizado: 50_000,
      meses: TRIMESTRE,
      hoje: new Date(2026, 5, 1),
    });

    expect(projecao.diasDecorridos).toBe(1);
    expect(projecao.projetado).toBeCloseTo(50_000 * DIAS_DO_TRIMESTRE, 2);
  });

  it("antes de o trimestre começar, não há ritmo — e não há projeção", () => {
    const projecao = projecaoDeFechamento({
      realizado: 0,
      meses: TRIMESTRE,
      hoje: new Date(2026, 4, 20),
    });

    expect(projecao.disponivel).toBe(false);
    expect(projecao.projetado).toBe(0);
    expect(projecao.diasDecorridos).toBe(0);
  });

  it("sem mês configurado, não há trimestre para projetar", () => {
    const projecao = projecaoDeFechamento({
      realizado: 1_000_000,
      meses: [],
      hoje: new Date(2026, 6, 31),
    });

    expect(projecao.disponivel).toBe(false);
    expect(projecao.projetado).toBe(0);
    expect(projecao.diasTotais).toBe(0);
  });

  it("realizado zero projeta zero, sem virar NaN", () => {
    const projecao = projecaoDeFechamento({
      realizado: 0,
      meses: TRIMESTRE,
      hoje: new Date(2026, 6, 31),
    });

    expect(projecao.disponivel).toBe(true);
    expect(projecao.projetado).toBe(0);
  });

  it("conta fevereiro pelo ano: 29 dias em ano bissexto, 28 no comum", () => {
    // O trimestre nao e sempre jun/jul/ago — MESES_ANALISE e configuravel.
    const bissexto = projecaoDeFechamento({
      realizado: 1_000_000,
      meses: [1, 2, 3],
      hoje: new Date(2028, 2, 31),
    });
    const comum = projecaoDeFechamento({
      realizado: 1_000_000,
      meses: [1, 2, 3],
      hoje: new Date(2026, 2, 31),
    });

    expect(bissexto.diasTotais).toBe(91); // 31 + 29 + 31
    expect(comum.diasTotais).toBe(90); //   31 + 28 + 31
  });

  it("a projeção nunca fica abaixo do que já foi realizado", () => {
    for (const dia of [1, 7, 15, 30]) {
      const projecao = projecaoDeFechamento({
        realizado: 3_333_333,
        meses: TRIMESTRE,
        hoje: new Date(2026, 6, dia),
      });
      expect(projecao.projetado).toBeGreaterThanOrEqual(3_333_333);
    }
  });
});

/**
 * O método sazonal — o que a tela usa quando há ano anterior.
 *
 * Doze posições, índice 0 = janeiro. Junho, julho e agosto do "ano passado"
 * com forma decrescente: 1,0 mi / 0,8 mi / 0,6 mi. Somam 2,4 mi.
 */
function anoAnterior(jun: number, jul: number, ago: number): number[] {
  const totais = Array<number>(12).fill(0);
  totais[5] = jun;
  totais[6] = jul;
  totais[7] = ago;
  return totais;
}

const FORMA = anoAnterior(1_000_000, 800_000, 600_000);

describe("projeção de fechamento — o método sazonal", () => {
  it("estima o que falta pelo ano anterior, corrigido pelo crescimento", () => {
    // 31/07: junho e julho decorridos (1,8 mi no ano anterior), agosto por
    // vir (0,6 mi). Realizado 2,0 mi contra 1,8 mi é fator 1,1111; agosto
    // entra por 0,6 mi x 1,1111 = 666.666,67.
    const projecao = projecaoDeFechamento({
      realizado: 2_000_000,
      meses: TRIMESTRE,
      hoje: new Date(2026, 6, 31),
      totaisAnoAnterior: FORMA,
    });

    expect(projecao.metodo).toBe("sazonal");
    expect(projecao.fatorCrescimento).toBeCloseTo(2 / 1.8, 6);
    expect(projecao.projetado).toBeCloseTo(2_666_666.67, 2);
    expect(projecao.anoAnterior).toBe(2025);
  });

  it("fica ABAIXO do linear quando o trimestre desacelera — que é o ponto", () => {
    // O linear projetaria 2,0 mi x 92/61 = 3.016.393,44, porque assume que
    // agosto vende como junho. Nesta forma agosto vale 60% de junho.
    const sazonal = projecaoDeFechamento({
      realizado: 2_000_000,
      meses: TRIMESTRE,
      hoje: new Date(2026, 6, 31),
      totaisAnoAnterior: FORMA,
    });
    const linear = projecaoDeFechamento({
      realizado: 2_000_000,
      meses: TRIMESTRE,
      hoje: new Date(2026, 6, 31),
    });

    expect(linear.projetado).toBeCloseTo(3_016_393.44, 2);
    expect(sazonal.projetado).toBeLessThan(linear.projetado);
  });

  it("com o ano anterior plano, o sazonal e o linear dão o mesmo número", () => {
    // Um ano anterior sem sazonalidade nenhuma (10 mil/dia em todos os três
    // meses) é exatamente a hipótese que o linear faz. Os dois métodos têm
    // que coincidir ali — se não coincidirem, um dos dois está torto.
    const plano = anoAnterior(300_000, 310_000, 310_000);

    const sazonal = projecaoDeFechamento({
      realizado: 1_220_000,
      meses: TRIMESTRE,
      hoje: new Date(2026, 6, 31),
      totaisAnoAnterior: plano,
    });

    expect(sazonal.metodo).toBe("sazonal");
    expect(sazonal.projetado).toBeCloseTo(1_220_000 * (92 / 61), 2);
  });

  it("não muda de patamar na virada do mês", () => {
    // O ano que segue EXATAMENTE a forma do anterior (fator 1) tem que
    // projetar o trimestre anterior inteiro — 2,4 mi — em qualquer dia. Se a
    // conta escorregasse na virada do mês, 31/07 e 01/08 dariam números
    // diferentes com o mesmo comportamento por trás.
    const em31DeJulho = projecaoDeFechamento({
      realizado: 1_800_000,
      meses: TRIMESTRE,
      hoje: new Date(2026, 6, 31),
      totaisAnoAnterior: FORMA,
    });
    const em1DeAgosto = projecaoDeFechamento({
      realizado: 1_800_000 + 600_000 / 31,
      meses: TRIMESTRE,
      hoje: new Date(2026, 7, 1),
      totaisAnoAnterior: FORMA,
    });

    expect(em31DeJulho.projetado).toBeCloseTo(2_400_000, 2);
    expect(em1DeAgosto.projetado).toBeCloseTo(2_400_000, 2);
  });

  it("no mês corrente, só a parte que FALTA é estimada", () => {
    // 15/08: os quinze dias vividos de agosto já estão no realizado e não se
    // reestimam. Só os dezesseis que restam entram pelo ano anterior —
    // 620.000 x 16/31 = 320.000, vezes o fator.
    const projecao = projecaoDeFechamento({
      realizado: 2_100_000, // = 1,8 mi + 620.000 x 15/31, ou seja, fator 1
      meses: TRIMESTRE,
      hoje: new Date(2026, 7, 15),
      totaisAnoAnterior: anoAnterior(1_000_000, 800_000, 620_000),
    });

    expect(projecao.fatorCrescimento).toBeCloseTo(1, 6);
    expect(projecao.projetado).toBeCloseTo(2_420_000, 2);
  });

  it("com o trimestre encerrado, a projeção é o próprio realizado", () => {
    const projecao = projecaoDeFechamento({
      realizado: 4_000_000,
      meses: TRIMESTRE,
      hoje: new Date(2026, 7, 31),
      totaisAnoAnterior: FORMA,
    });

    expect(projecao.diasDecorridos).toBe(DIAS_DO_TRIMESTRE);
    expect(projecao.projetado).toBeCloseTo(4_000_000, 2);
  });

  it("depois que o trimestre acaba, continua sendo o próprio realizado", () => {
    const projecao = projecaoDeFechamento({
      realizado: 4_000_000,
      meses: TRIMESTRE,
      hoje: new Date(2026, 10, 15),
      totaisAnoAnterior: FORMA,
    });

    expect(projecao.projetado).toBeCloseTo(4_000_000, 2);
  });

  it("a projeção nunca fica abaixo do que já foi realizado", () => {
    for (const [mes, dia] of [
      [5, 1],
      [5, 30],
      [6, 15],
      [7, 1],
      [7, 20],
      [7, 31],
    ] as const) {
      const projecao = projecaoDeFechamento({
        realizado: 3_333_333,
        meses: TRIMESTRE,
        hoje: new Date(2026, mes, dia),
        totaisAnoAnterior: FORMA,
      });
      expect(projecao.projetado).toBeGreaterThanOrEqual(3_333_333);
    }
  });

  it("antes de o trimestre começar, não há projeção — nem com o ano anterior", () => {
    const projecao = projecaoDeFechamento({
      realizado: 0,
      meses: TRIMESTRE,
      hoje: new Date(2026, 4, 20),
      totaisAnoAnterior: FORMA,
    });

    expect(projecao.disponivel).toBe(false);
    expect(projecao.projetado).toBe(0);
  });

  it("um ano anterior quase zerado não explode a projeção", () => {
    // Dois reais no período decorrido dariam fator de um milhão, e uma
    // projeção de um trilhão. O teto de 3x é o que separa "a empresa cresceu"
    // de "o denominador está errado".
    const projecao = projecaoDeFechamento({
      realizado: 2_000_000,
      meses: TRIMESTRE,
      hoje: new Date(2026, 6, 31),
      totaisAnoAnterior: anoAnterior(1, 1, 1_000_000),
    });

    expect(projecao.fatorCrescimento).toBe(3);
    expect(projecao.projetado).toBeCloseTo(5_000_000, 2);
  });
});

describe("projeção de fechamento — quando o sazonal não dá e cai no linear", () => {
  /** A queda tem que ser DECLARADA: `metodo: "linear"` é o que faz a tela
   *  dizer, com todas as letras, que o número não é sazonal. Entregar o
   *  número linear com cara de sazonal seria pior do que não projetar. */
  function caiuNoLinear(totaisAnoAnterior?: number[]) {
    const projecao = projecaoDeFechamento({
      realizado: 1_220_000,
      meses: TRIMESTRE,
      hoje: new Date(2026, 6, 31),
      totaisAnoAnterior,
    });

    expect(projecao.metodo).toBe("linear");
    expect(projecao.fatorCrescimento).toBeNull();
    expect(projecao.projetado).toBeCloseTo(1_840_000, 2);
    return projecao;
  }

  it("sem série do ano anterior", () => {
    caiuNoLinear(undefined);
    caiuNoLinear([]);
  });

  it("com o ano anterior inteiro zerado", () => {
    caiuNoLinear(anoAnterior(0, 0, 0));
  });

  it("quando o período já decorrido do ano anterior faturou zero", () => {
    // Sem base decorrida não há como medir crescimento: o fator seria uma
    // divisão por zero.
    caiuNoLinear(anoAnterior(0, 0, 900_000));
  });

  it("quando o que resta do ano anterior faturou zero", () => {
    // Um agosto zerado no ano passado é muito mais provavelmente dado que
    // faltou do que mês em que a empresa não vendeu. Projetar por essa forma
    // travaria a projeção no realizado e mostraria uma meta perdida que não
    // se perdeu.
    caiuNoLinear(anoAnterior(1_000_000, 800_000, 0));
  });
});

describe("projeção de fechamento — o trimestre de 2025 que motivou a troca", () => {
  it("com os números reais, o sazonal fica ~R$ 389 mil abaixo do linear", () => {
    // Julho, agosto e setembro de 2025 na Health & Safety: 1.206.528,39 /
    // 871.656,30 / 664.141,03 — 44,0% / 31,8% / 24,2% do trimestre. Setembro
    // vale 55% de julho. Em 28/08, com 59 dos 92 dias apurados, o linear
    // projeta 3.295.610,81 porque acha que setembro vende como julho.
    const REAL_2025 = Array<number>(12).fill(0);
    REAL_2025[6] = 1_206_528.39;
    REAL_2025[7] = 871_656.3;
    REAL_2025[8] = 664_141.03;

    const realizado = 2_113_489.54;
    const entrada = {
      realizado,
      meses: [7, 8, 9],
      hoje: new Date(2026, 7, 28),
    };

    const linear = projecaoDeFechamento(entrada);
    const sazonal = projecaoDeFechamento({
      ...entrada,
      totaisAnoAnterior: REAL_2025,
    });

    expect(linear.diasDecorridos).toBe(59);
    expect(linear.diasTotais).toBe(92);
    expect(linear.projetado).toBeCloseTo(3_295_610.81, 2);

    expect(sazonal.fatorCrescimento).toBeCloseTo(1.060014, 6);
    expect(sazonal.projetado).toBeCloseTo(2_906_904.92, 2);
    expect(linear.projetado - sazonal.projetado).toBeCloseTo(388_705.89, 2);
  });
});
