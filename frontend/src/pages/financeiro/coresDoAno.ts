import type { Ano } from "./financeiro";

/**
 * A cor de um ano — a mesma no pill que o liga, no cartão de KPI e na barra
 * do gráfico.
 *
 * **Não sai da rampa de séries do `chartTheme`, e isso é deliberado.** A rampa
 * tem seis cores das quais três são azuis, e cinco anos consecutivos caíam em
 * dois azuis com 14° de matiz entre si — 2022 e 2025 ficavam indistinguíveis
 * no comparativo mensal, onde a cor é a única pista de qual barra é de qual
 * ano. A rampa serve bem a duas ou três séries; cinco passam do que ela tem
 * de matiz distinto.
 *
 * A escolha aqui é um matiz por ano, todos de token: cinza, âmbar, vermelho,
 * azul e verde. O ano corrente fica em verde e o mais antigo em cinza, que é
 * como a série é lida — o de agora em destaque, o velho recuando. O vermelho
 * no meio é identidade, não juízo: numa comparação de anos nenhuma das cinco
 * cores carrega significado sozinha, e o rótulo do ano vem junto em todo
 * lugar em que a cor aparece.
 *
 * Antes eram cinco hexadecimais soltos no topo da tela (`#a16207`, `#7c3aed`,
 * …), escolhidos à mão e sem relação nenhuma com a paleta do sistema.
 */
const TOKEN_DO_ANO: Record<Ano, { nome: string; reserva: string }> = {
  2022: { nome: "--color-slate-500", reserva: "#64748b" },
  2023: { nome: "--color-warning-500", reserva: "#f59e0b" },
  2024: { nome: "--color-danger-500", reserva: "#ef4444" },
  2025: { nome: "--color-primary-500", reserva: "#1f89ca" },
  2026: { nome: "--color-success-500", reserva: "#10b981" },
};

/**
 * A leitura é em tempo de execução, como no `chartTheme`: o recharts recebe
 * cor por prop, e prop não enxerga classe do Tailwind. A reserva importa —
 * em jsdom o CSS dos tokens não carrega e a propriedade volta vazia.
 */
export function corDoAno(ano: Ano): string {
  const { nome, reserva } = TOKEN_DO_ANO[ano];
  if (typeof document === "undefined") return reserva;
  const valor = getComputedStyle(document.documentElement)
    .getPropertyValue(nome)
    .trim();
  return valor || reserva;
}
