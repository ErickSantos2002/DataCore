import { describe, expect, it } from "vitest";

import type { Execucao, Importacao } from "../../services/operacao";
import {
  agruparPorDia,
  contarProblemas,
  demorouMaisQueOCostume,
  descreverContagens,
  ehProblema,
  formatarDuracao,
  horarioLocal,
  horariosLegiveis,
  resumoDaDuracao,
  rotuloDaExecucao,
  rotuloDoEstado,
  tempoAte,
} from "./importacoes";
import { noFuso } from "../../test/fuso";

/**
 * A conta pura da tela de Importações.
 *
 * Duas coisas aqui merecem teste mais do que as outras, porque são as que
 * erram calado: a **conversão de fuso** (a VPS é UTC e a tela é Brasília — o
 * número errado continua sendo um horário plausível) e o **critério de base
 * estatística** (mediana de duas execuções parece igual a mediana de trinta).
 */

const IMPORTACAO_BASE: Importacao = {
  job: "extrair_notas",
  rotulo: "Notas fiscais",
  descricao: "Baixa do Tiny ERP as notas de venda emitidas.",
  fonte: "Tiny ERP",
  horarios: ["04:00", "15:00"],
  unidade_systemd: "tiny-extrator-notas.timer",
  ativo: true,
  ordem: 1,
  estado: "ok",
  mensagem: "A carga de Notas fiscais rodou normalmente.",
  ultima_execucao_id: 71,
  ultimo_inicio: "2026-09-19T04:00:06Z",
  ultimo_fim: "2026-09-19T04:03:17Z",
  ultimo_resultado: "sucesso",
  ultimos_erros: 0,
  ultimas_contagens: { criada: 4, inalterada: 50 },
  ultima_duracao_seg: 191.4,
  proxima_execucao: "2026-09-19T15:00:00Z",
  execucoes_na_media: 20,
  duracao_mediana_seg: 172.1,
  duracao_min_seg: 159.4,
  duracao_max_seg: 201.9,
  execucoes_30d: 22,
  falhas_30d: 0,
};

const EXECUCAO_BASE: Execucao = {
  id: 71,
  job: "extrair_notas",
  inicio: "2026-09-19T04:00:06Z",
  fim: "2026-09-19T04:03:17Z",
  resultado: "sucesso",
  erros: 0,
  contagens: { criada: 4, inalterada: 50 },
  detalhe: null,
  argumentos: null,
  origem: "agendada",
  duracao_seg: 191.4,
};

describe("horário da VPS na tela", () => {
  it("converte UTC para o fuso de quem olha", () => {
    // 04:00 UTC é 01:00 em Brasília. Mostrar "04:00" faria a tela dizer que a
    // carga roda às quatro da manhã — plausível o bastante para ninguém notar.
    const referencia = new Date("2026-09-19T12:00:00Z");
    expect(horarioLocal("04:00", referencia)).toBe(
      noFuso({ brasilia: "01:00", utc: "04:00" }),
    );
    expect(horarioLocal("15:00", referencia)).toBe(
      noFuso({ brasilia: "12:00", utc: "15:00" }),
    );
  });

  it("devolve o texto cru quando não é um horário", () => {
    expect(horarioLocal("todo dia")).toBe("todo dia");
  });

  it("junta vários horários numa frase", () => {
    const referencia = new Date("2026-09-19T12:00:00Z");
    expect(horariosLegiveis(["04:00", "15:00"], referencia)).toBe(
      noFuso({ brasilia: "01:00 e 12:00", utc: "04:00 e 15:00" }),
    );
    expect(horariosLegiveis(["04:30"], referencia)).toBe(
      noFuso({ brasilia: "01:30", utc: "04:30" }),
    );
    expect(horariosLegiveis([], referencia)).toBe("sem horário definido");
  });
});

describe("duração em linguagem de gente", () => {
  it("usa segundos abaixo de um minuto", () => {
    expect(formatarDuracao(12.4)).toBe("12 s");
  });

  it("mostra segundos enquanto eles significam algo", () => {
    expect(formatarDuracao(191.4)).toBe("3 min 11 s");
  });

  it("abandona os segundos quando a carga é longa", () => {
    // 2065,8 s = 34 min 26 s. Numa carga de meia hora, o resto em segundos é
    // precisão que ninguém usa.
    expect(formatarDuracao(2065.8)).toBe("34 min");
  });

  it("passa para horas quando passa de uma", () => {
    expect(formatarDuracao(26850)).toBe("7 h 28 min");
  });

  it("não inventa número quando não há duração", () => {
    expect(formatarDuracao(null)).toBe("—");
    expect(formatarDuracao(undefined)).toBe("—");
  });
});

describe("estado da importação", () => {
  it("separa problema de normalidade", () => {
    expect(ehProblema("falha")).toBe(true);
    expect(ehProblema("atrasada")).toBe(true);
    expect(ehProblema("inacabada")).toBe(true);
    // Rodando não é problema: piscar aviso durante uma carga de 35 minutos
    // treina qualquer um a ignorar a tela.
    expect(ehProblema("rodando")).toBe(false);
    expect(ehProblema("ok")).toBe(false);
    expect(ehProblema(null)).toBe(false);
  });

  it("dá tom diferente para interrompida e para falha", () => {
    expect(rotuloDoEstado("inacabada").tom).toBe("alerta");
    expect(rotuloDoEstado("falha").tom).toBe("erro");
  });

  it("conta as cargas com problema", () => {
    const importacoes: Importacao[] = [
      IMPORTACAO_BASE,
      { ...IMPORTACAO_BASE, job: "importar_nfse", estado: "falha" },
      { ...IMPORTACAO_BASE, job: "dbt_build", estado: "rodando" },
      { ...IMPORTACAO_BASE, job: "extrair_contas", estado: "atrasada" },
    ];
    expect(contarProblemas(importacoes)).toBe(2);
  });
});

describe("resumo da duração", () => {
  it("diz a mediana junto com o tamanho da amostra", () => {
    // 172,1 s é a MEDIANA; 191,4 s é quanto durou a última. Os dois valores são
    // diferentes de propósito no fixture: trocar um pelo outro é o erro fácil,
    // e uma asserção com números iguais passaria verde por cima dele.
    expect(resumoDaDuracao(IMPORTACAO_BASE)).toBe(
      "2 min 52 s (mediana de 20 execuções)",
    );
  });

  it("admite quando não há base", () => {
    // O cartão precisa poder dizer "não sei" — inventar média de zero execução
    // é o tipo de número que a tela mostra com cara de certo.
    const semBase = {
      ...IMPORTACAO_BASE,
      execucoes_na_media: 0,
      duracao_mediana_seg: null,
    };
    expect(resumoDaDuracao(semBase)).toBe("ainda sem base para comparar");
  });

  it("concorda com o singular", () => {
    const uma = {
      ...IMPORTACAO_BASE,
      execucoes_na_media: 1,
      duracao_mediana_seg: 60,
    };
    expect(resumoDaDuracao(uma)).toBe("1 min (mediana de 1 execução)");
  });
});

describe("carga que demorou fora do normal", () => {
  it("não opina com base pequena", () => {
    const poucaBase = {
      ...IMPORTACAO_BASE,
      execucoes_na_media: 4,
      ultima_duracao_seg: 9999,
    };
    expect(demorouMaisQueOCostume(poucaBase)).toBe(false);
  });

  it("acusa quando passa do dobro do maior tempo já visto", () => {
    const lenta = { ...IMPORTACAO_BASE, ultima_duracao_seg: 500 };
    expect(demorouMaisQueOCostume(lenta)).toBe(true);
  });

  it("fica quieta numa variação comum", () => {
    // O dbt varia de 11 a 17 segundos: um dia de 16 s é dia normal, e um
    // critério por múltiplo da mediana acusaria isso todo dia.
    const dbt = {
      ...IMPORTACAO_BASE,
      ultima_duracao_seg: 16.7,
      duracao_mediana_seg: 13.1,
      duracao_min_seg: 11.2,
      duracao_max_seg: 16.7,
      execucoes_na_media: 9,
    };
    expect(demorouMaisQueOCostume(dbt)).toBe(false);
  });
});

describe("o que a carga trouxe", () => {
  it("ordena pelo maior e formata em português", () => {
    expect(descreverContagens({ criada: 4, inalterada: 1050 })).toBe(
      "1.050 inalterada · 4 criada",
    );
  });

  it("ignora valor que não é número", () => {
    expect(descreverContagens({ criada: 2, detalhe: "texto" })).toBe(
      "2 criada",
    );
  });

  it("não inventa frase para contagem vazia", () => {
    expect(descreverContagens({})).toBe("—");
    expect(descreverContagens(null)).toBe("—");
  });
});

describe("histórico", () => {
  it("agrupa por dia mantendo a ordem recebida", () => {
    const execucoes: Execucao[] = [
      { ...EXECUCAO_BASE, id: 3, inicio: "2026-09-19T18:00:00Z" },
      { ...EXECUCAO_BASE, id: 2, inicio: "2026-09-19T13:00:00Z" },
      { ...EXECUCAO_BASE, id: 1, inicio: "2026-09-18T13:00:00Z" },
    ];
    const dias = agruparPorDia(execucoes);
    expect(dias).toHaveLength(2);
    expect(dias[0].dia).toBe("19/09/2026");
    expect(dias[0].execucoes.map((e) => e.id)).toEqual([3, 2]);
    expect(dias[1].dia).toBe("18/09/2026");
  });

  it("agrupa pelo dia de QUEM OLHA, não pelo dia em UTC", () => {
    // A madrugada é onde quase toda carga roda, e é justamente onde os dois
    // calendários discordam: 04:00 UTC do dia 19 é 01:00 do dia 19 aqui, mas
    // 01:00 UTC do dia 19 ainda é 22:00 do dia 18. Agrupar pelo dia UTC jogaria
    // a carga da noite para o dia seguinte — e o "dia 15" que alguém procura na
    // tela não bateria com o dia 15 que o filtro do backend recorta.
    // Em UTC os dois calendários coincidem e as duas caem no dia 19: é em
    // Brasília que este teste enxerga alguma coisa.
    const execucoes: Execucao[] = [
      { ...EXECUCAO_BASE, id: 2, inicio: "2026-09-19T04:00:00Z" },
      { ...EXECUCAO_BASE, id: 1, inicio: "2026-09-19T01:00:00Z" },
    ];
    const dias = agruparPorDia(execucoes);
    expect(dias.map((d) => d.dia)).toEqual(
      noFuso({
        brasilia: ["19/09/2026", "18/09/2026"],
        utc: ["19/09/2026"],
      }),
    );
  });

  it("trata execução sem fim antes de olhar o resultado", () => {
    // Uma linha sem `fim` tem `resultado` nulo, não 'falha' — se a ordem dos
    // testes se invertesse, ela cairia no caso de sucesso e a tela diria que
    // uma carga morta por deploy terminou bem.
    const interrompida: Execucao = {
      ...EXECUCAO_BASE,
      fim: null,
      resultado: null,
      duracao_seg: null,
    };
    expect(rotuloDaExecucao(interrompida)).toEqual({
      texto: "Interrompida",
      tom: "alerta",
    });
  });

  it("chama de falha quem terminou com erro", () => {
    const falhou: Execucao = {
      ...EXECUCAO_BASE,
      resultado: "falha",
      erros: 1,
    };
    expect(rotuloDaExecucao(falhou).tom).toBe("erro");
  });

  it("chama de falha quem terminou 'sucesso' mas contou erros", () => {
    // `extrair_notas` sai com código 0 quando errou alguns registros e trouxe o
    // resto. O registro diz sucesso; a tela não pode dizer que foi tudo bem.
    const comErros: Execucao = { ...EXECUCAO_BASE, erros: 3 };
    expect(rotuloDaExecucao(comErros).tom).toBe("erro");
  });
});

describe("próxima execução", () => {
  it("conta em minutos, horas e dias", () => {
    const agora = new Date("2026-09-19T12:00:00Z");
    expect(tempoAte("2026-09-19T12:25:00Z", agora)).toBe("em 25 min");
    expect(tempoAte("2026-09-19T15:00:00Z", agora)).toBe("em 3 h");
    expect(tempoAte("2026-09-21T12:00:00Z", agora)).toBe("em 2 d");
  });

  it("não promete precisão de segundos", () => {
    const agora = new Date("2026-09-19T12:00:00Z");
    expect(tempoAte("2026-09-19T12:00:30Z", agora)).toBe("a qualquer momento");
  });

  it("aceita ausência de próxima execução", () => {
    expect(tempoAte(null)).toBe("—");
  });
});
