import type {
  EstadoDaImportacao,
  Execucao,
  Importacao,
} from "../../services/operacao";

/**
 * As contas da tela de Importações — funções puras, sem React e sem rede.
 *
 * ⚠️ FUSO, que aqui é o detalhe que mais engana. A VPS roda em **UTC** e o
 * catálogo guarda os horários como o `OnCalendar` os escreve: `04:00` é uma da
 * manhã em Recife. Mostrar o número cru faria a tela dizer que a carga de notas
 * roda às quatro da manhã — plausível o bastante para ninguém desconfiar.
 *
 * O filtro por dia é cortado no backend em `America/Sao_Paulo` (ver o módulo
 * `operacao.py`). Aqui a exibição usa o fuso de quem está olhando, como o resto
 * do app. Os dois coincidem para qualquer pessoa no Brasil, que é toda a
 * empresa; se um dia alguém abrir a tela de outro continente, o dia do filtro e
 * o dia exibido podem discordar em execuções perto da meia-noite.
 */

const FUSO_DA_VPS = "UTC";

export type TomDoEstado = "ok" | "erro" | "alerta" | "neutro" | "info";

export interface RotuloDeEstado {
  texto: string;
  tom: TomDoEstado;
}

const ROTULOS: Record<EstadoDaImportacao, RotuloDeEstado> = {
  ok: { texto: "Em dia", tom: "ok" },
  rodando: { texto: "Rodando agora", tom: "info" },
  falha: { texto: "Falhou", tom: "erro" },
  // "Inacabada" não é falha: o job começou e nunca fechou a linha, o que quase
  // sempre é deploy no meio da carga. Rodar de novo costuma resolver — por isso
  // alerta, e não erro.
  inacabada: { texto: "Interrompida", tom: "alerta" },
  // A mais perigosa das três, porque é 100% silenciosa: sem esta regra, uma
  // carga que simplesmente PARA nunca viraria aviso nenhum.
  atrasada: { texto: "Atrasada", tom: "erro" },
  sem_registro: { texto: "Sem registro", tom: "neutro" },
};

export function rotuloDoEstado(
  estado: EstadoDaImportacao | null | undefined,
): RotuloDeEstado {
  if (!estado) return { texto: "Desconhecido", tom: "neutro" };
  return ROTULOS[estado] ?? { texto: estado, tom: "neutro" };
}

/** Um estado que merece a atenção de quem abriu a tela. */
export function ehProblema(
  estado: EstadoDaImportacao | null | undefined,
): boolean {
  return estado === "falha" || estado === "atrasada" || estado === "inacabada";
}

/**
 * `"04:00"` em UTC vira `"01:00"` em Brasília.
 *
 * A conversão passa por uma data real de propósito: o horário sozinho não sabe
 * de fuso, e escrever `hora - 3` grudaria na tela a premissa de que o Brasil
 * não tem mais horário de verão. Se voltar a ter, isto continua certo.
 */
export function horarioLocal(
  horarioUtc: string,
  referencia: Date = new Date(),
): string {
  const partes = /^(\d{1,2}):(\d{2})/.exec(horarioUtc);
  if (!partes) return horarioUtc;

  const instante = new Date(
    Date.UTC(
      referencia.getUTCFullYear(),
      referencia.getUTCMonth(),
      referencia.getUTCDate(),
      Number(partes[1]),
      Number(partes[2]),
    ),
  );
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(instante);
}

/** `["04:00","15:00"]` em UTC vira `"01:00 e 12:00"`. */
export function horariosLegiveis(
  horariosUtc: string[],
  referencia: Date = new Date(),
): string {
  const locais = horariosUtc.map((h) => horarioLocal(h, referencia));
  if (locais.length === 0) return "sem horário definido";
  if (locais.length === 1) return locais[0];
  return `${locais.slice(0, -1).join(", ")} e ${locais[locais.length - 1]}`;
}

/** O mesmo horário como a VPS o conhece — para quem for mexer no timer. */
export function horariosNaVps(horariosUtc: string[]): string {
  return horariosUtc.length ? `${horariosUtc.join(", ")} ${FUSO_DA_VPS}` : "—";
}

/**
 * Segundos como alguém fala: `12 s`, `3 min 11 s`, `35 min`, `7 h 27 min`.
 *
 * Acima de um minuto os segundos só aparecem enquanto ainda significam algo;
 * numa carga de 35 minutos, "35 min 3 s" é precisão que ninguém usa.
 */
export function formatarDuracao(segundos: number | null | undefined): string {
  if (segundos === null || segundos === undefined || Number.isNaN(segundos)) {
    return "—";
  }
  if (segundos < 60) return `${Math.round(segundos)} s`;

  const minutos = Math.floor(segundos / 60);
  if (segundos < 600) {
    const resto = Math.round(segundos % 60);
    return resto ? `${minutos} min ${resto} s` : `${minutos} min`;
  }
  if (segundos < 3600) return `${minutos} min`;

  const horas = Math.floor(segundos / 3600);
  const minutosRestantes = Math.round((segundos % 3600) / 60);
  return minutosRestantes ? `${horas} h ${minutosRestantes} min` : `${horas} h`;
}

/** `"2026-09-18T04:30:03Z"` vira `"18/09/2026, 01:30"`, no fuso de quem olha. */
export function formatarInstante(iso: string | null | undefined): string {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

/** Só o dia, para agrupar o histórico: `"18/09/2026"`. */
export function formatarDia(iso: string | null | undefined): string {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(data);
}

/**
 * Quanto falta para a próxima execução, em linguagem de gente: `em 3 h`,
 * `em 25 min`, `a qualquer momento`.
 */
export function tempoAte(
  iso: string | null | undefined,
  agora: Date = new Date(),
): string {
  if (!iso) return "—";
  const alvo = new Date(iso);
  if (Number.isNaN(alvo.getTime())) return "—";

  const segundos = (alvo.getTime() - agora.getTime()) / 1000;
  if (segundos <= 60) return "a qualquer momento";
  if (segundos < 3600) return `em ${Math.round(segundos / 60)} min`;
  if (segundos < 86400) return `em ${Math.round(segundos / 3600)} h`;
  return `em ${Math.round(segundos / 86400)} d`;
}

/**
 * O que a carga trouxe, como frase: `4 criadas · 50 inalteradas`.
 *
 * As chaves vêm do próprio job e variam entre eles (`criada`, `pagar: criada`,
 * `nos`, `concluidos`). Não há vocabulário fixo para traduzir, então a frase
 * mostra o que veio, ordenado pelo que é maior — inventar rótulo por chave
 * conhecida daria uma tela que mente quando um job novo aparece.
 */
export function descreverContagens(
  contagens: Record<string, unknown> | null | undefined,
): string {
  if (!contagens) return "—";
  const pares = Object.entries(contagens).filter(
    ([, valor]) => typeof valor === "number",
  ) as [string, number][];
  if (pares.length === 0) return "—";

  return pares
    .sort((a, b) => b[1] - a[1])
    .map(([chave, valor]) => `${valor.toLocaleString("pt-BR")} ${chave}`)
    .join(" · ");
}

/**
 * Quanto a carga costuma demorar, com a honestidade do tamanho da amostra.
 *
 * Usa MEDIANA, não média, e só de execuções agendadas — o backend já filtra.
 * O motivo está medido: a média crua de `extrair_contas` dava 36 minutos com
 * um máximo de 7h27, porque somava os backfills de 2015-2019 e os testes de
 * um segundo. Nenhum dos dois números descrevia a carga diária, que leva 34
 * minutos de forma estável.
 */
export function resumoDaDuracao(importacao: Importacao): string {
  const { duracao_mediana_seg, execucoes_na_media } = importacao;
  if (!execucoes_na_media || duracao_mediana_seg === null) {
    return "ainda sem base para comparar";
  }
  const base =
    execucoes_na_media === 1 ? "1 execução" : `${execucoes_na_media} execuções`;
  return `${formatarDuracao(duracao_mediana_seg)} (mediana de ${base})`;
}

/**
 * A última execução saiu muito fora do que é normal para esta carga?
 *
 * O critério é o dobro do maior tempo já visto entre as agendadas — e não um
 * múltiplo da mediana, que dispararia à toa em job rápido: o dbt varia de 11 a
 * 17 segundos, e 2× a mediana já seria "lenta" num dia comum.
 *
 * Com menos de cinco execuções na base, devolve `false`: a essa altura a faixa
 * do "normal" ainda é chute, e alarme baseado em chute é alarme que se desliga.
 */
export function demorouMaisQueOCostume(importacao: Importacao): boolean {
  const { ultima_duracao_seg, duracao_max_seg, execucoes_na_media } =
    importacao;
  if (execucoes_na_media < 5) return false;
  if (ultima_duracao_seg === null || duracao_max_seg === null) return false;
  if (duracao_max_seg <= 0) return false;
  return ultima_duracao_seg > duracao_max_seg * 2;
}

export interface DiaDeExecucoes {
  dia: string;
  execucoes: Execucao[];
}

/**
 * Agrupa o histórico por dia, preservando a ordem em que veio (mais recente
 * primeiro). É o que transforma a lista corrida em "o que aconteceu no dia 15".
 */
export function agruparPorDia(execucoes: Execucao[]): DiaDeExecucoes[] {
  const dias: DiaDeExecucoes[] = [];
  for (const execucao of execucoes) {
    const dia = formatarDia(execucao.inicio);
    const ultimo = dias[dias.length - 1];
    if (ultimo && ultimo.dia === dia) {
      ultimo.execucoes.push(execucao);
    } else {
      dias.push({ dia, execucoes: [execucao] });
    }
  }
  return dias;
}

/** Como terminou uma execução do histórico, para o selo da linha. */
export function rotuloDaExecucao(execucao: Execucao): RotuloDeEstado {
  if (execucao.fim === null) {
    return { texto: "Interrompida", tom: "alerta" };
  }
  if (execucao.resultado === "falha" || execucao.erros > 0) {
    return { texto: "Falhou", tom: "erro" };
  }
  return { texto: "Sucesso", tom: "ok" };
}

/** Quantas cargas estão com problema agora — o contador do topo da tela. */
export function contarProblemas(importacoes: Importacao[]): number {
  return importacoes.filter((i) => ehProblema(i.estado)).length;
}
