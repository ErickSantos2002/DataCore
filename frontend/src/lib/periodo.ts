import { diaLocal } from "./datas";

/**
 * Os presets de período, compartilhados por Contas e pelas cinco telas que os
 * adotaram na Fase 4.
 *
 * Moraram em `pages/contas/contas.ts` até 04/09/2026, quando cinco telas
 * passaram a precisar deles. Antes disso as cinco carregavam uma cópia do
 * cálculo, byte a byte idêntica entre si, que montava as datas em UTC — e por
 * isso "Ano atual" virava o ano seguinte na virada.
 */

export interface Periodo {
  inicio: string;
  fim: string;
}

/**
 * As sete opções do "Período Rápido", na ordem em que aparecem.
 *
 * Compartilhada para que o app inteiro ofereça o mesmo menu. Antes eram duas
 * listas: Contas sem "Últimos 7 dias", e as cinco telas sem "Mês atual" — e com
 * "Mês atual" como RÓTULO da chave `30dias`, que devolvia o mês corrente. O
 * rótulo mentia para quem lia o código.
 */
export const PRESETS_DE_PERIODO = [
  { value: "todos", label: "Todos" },
  { value: "7dias", label: "Últimos 7 dias" },
  { value: "30dias", label: "Últimos 30 dias" },
  { value: "mesAtual", label: "Mês atual" },
  { value: "mesPassado", label: "Mês passado" },
  { value: "anoAtual", label: "Ano atual" },
  { value: "custom", label: "Personalizado" },
];

/**
 * O intervalo que cada preset de período impõe às duas datas.
 *
 * `null` para "custom": o preset personalizado não mexe nas datas que a
 * pessoa digitou.
 *
 * As duas pontas saem do DIA LOCAL. Antes o início vinha de
 * `getFullYear`/`getMonth` (local) e o fim de `toISOString` (UTC), e perto da
 * meia-noite os dois discordavam: em Brasília, às 23h de 31/08, "Mês atual"
 * virava 01/08 a 01/09, e na virada do ano "Ano atual" virava o ano passado
 * inteiro (defeito 1.3).
 */
export function periodoDoPreset(preset: string, agora: Date): Periodo | null {
  if (preset === "custom") return null;

  const hoje = new Date(agora);

  switch (preset) {
    case "7dias": {
      const seteDiasAtras = new Date(hoje);
      seteDiasAtras.setDate(hoje.getDate() - 7);
      return { inicio: diaLocal(seteDiasAtras), fim: diaLocal(hoje) };
    }
    case "30dias": {
      const trintaDiasAtras = new Date(hoje);
      trintaDiasAtras.setDate(hoje.getDate() - 30);
      return { inicio: diaLocal(trintaDiasAtras), fim: diaLocal(hoje) };
    }
    // O mês INTEIRO, do dia 1 ao último. Terminava HOJE, e então uma conta
    // emitida dia 20 sumia do "mês atual" enquanto hoje fosse dia 15 — sem
    // que o rótulo dissesse que o preset não olha para a frente. "Ano atual"
    // sempre foi o ano inteiro; agora os dois combinam.
    case "mesAtual":
      return periodoDoMes(hoje.getFullYear(), hoje.getMonth());
    // O mês anterior inteiro. A conta parte do DIA 1 do mês corrente, não de
    // hoje: recuar um mês a partir do dia 31 estoura — 31 de março vira 31 de
    // fevereiro, que o JavaScript normaliza para 3 de março, e o "mês passado"
    // devolveria março de novo. Partindo do dia 1, o construtor também resolve
    // a virada do ano sozinho: mês -1 de 2026 é dezembro de 2025.
    case "mesPassado": {
      const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      return periodoDoMes(mesAnterior.getFullYear(), mesAnterior.getMonth());
    }
    case "anoAtual":
      return {
        inicio: `${hoje.getFullYear()}-01-01`,
        fim: `${hoje.getFullYear()}-12-31`,
      };
    case "todos":
    default:
      return { inicio: "", fim: "" };
  }
}

/** O mês inteiro, para o preset e para o clique numa barra do gráfico mensal. */
export function periodoDoMes(ano: number, indiceDoMes: number): Periodo {
  const mes = String(indiceDoMes + 1).padStart(2, "0");
  const ultimoDia = new Date(ano, indiceDoMes + 1, 0).getDate();
  return { inicio: `${ano}-${mes}-01`, fim: `${ano}-${mes}-${ultimoDia}` };
}
