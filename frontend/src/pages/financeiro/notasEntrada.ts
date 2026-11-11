/**
 * A conta pura da aba Notas de Entrada — rótulos, período e mês, sem React.
 *
 * O que é nota de entrada não se decide aqui: é o backend que classifica, pelo CFOP
 * do item (`backend/app/core/notas_entrada.py`). O `tipo_nota` do Tiny engana — grava
 * "N" até em nota de compra.
 */
import type {
  SituacaoDeEntrada,
  TipoDeEntrada,
} from "../../services/notasEntrada";

export const ITENS_POR_PAGINA = 20;

export const TIPOS: TipoDeEntrada[] = [
  "compra",
  "devolucao",
  "conserto",
  "outras",
];

export const ROTULO_DO_TIPO: Record<TipoDeEntrada, string> = {
  compra: "Compra",
  devolucao: "Devolução de venda",
  conserto: "Conserto / reparo",
  outras: "Outras entradas",
};

export const SITUACOES: SituacaoDeEntrada[] = [
  "emitida",
  "registrada",
  "pendente",
  "cancelada",
];

/** Sem escolha, a cancelada fica de fora — como no faturamento. */
export const SITUACOES_PADRAO: SituacaoDeEntrada[] = [
  "emitida",
  "registrada",
  "pendente",
];

/** Os mesmos grupos das abas do Tiny, em "Notas fiscais de entrada". */
export const ROTULO_DA_SITUACAO: Record<SituacaoDeEntrada, string> = {
  emitida: "Emitidas",
  registrada: "Registradas",
  pendente: "Pendentes",
  cancelada: "Canceladas",
};

export const VARIANTE_DA_SITUACAO: Record<
  SituacaoDeEntrada,
  "success" | "info" | "warning" | "muted"
> = {
  emitida: "success",
  registrada: "info",
  pendente: "warning",
  cancelada: "muted",
};

/** O ano escolhido, ou o histórico inteiro (desde 2015). */
export type Periodo = number | "todos";

/** O recorte de datas do período, no formato que a API lê. */
export function datasDoPeriodo(periodo: Periodo): {
  data_inicio?: string;
  data_fim?: string;
} {
  if (periodo === "todos") return {};
  return { data_inicio: `${periodo}-01-01`, data_fim: `${periodo}-12-31` };
}

const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/**
 * "2026-03" → "mar/26". Por texto, e não por `new Date`: "2026-03-01" lido como
 * UTC vira 28 de fevereiro a oeste de Greenwich (o defeito que `lib/datas.ts`
 * existe para evitar).
 */
export function rotuloDoMes(mes: string): string {
  const [ano, numero] = mes.split("-");
  const indice = Number(numero) - 1;
  if (!ano || !(indice >= 0 && indice < 12)) return mes;
  return `${MESES_CURTOS[indice]}/${ano.slice(2)}`;
}

/** Liga/desliga uma situação, sem deixar a lista vazia (vazia = nada na tela). */
export function alternarSituacao(
  atuais: SituacaoDeEntrada[],
  situacao: SituacaoDeEntrada,
): SituacaoDeEntrada[] {
  if (!atuais.includes(situacao))
    return SITUACOES.filter((s) => s === situacao || atuais.includes(s));
  const restantes = atuais.filter((s) => s !== situacao);
  return restantes.length ? restantes : atuais;
}
