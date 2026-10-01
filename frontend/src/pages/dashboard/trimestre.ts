/** Qual trimestre o painel da meta mede.
 *
 * A configuração TRIMESTRE_APURACAO vale "auto" (o trimestre do calendário em
 * que hoje está) ou "AAAA-TN" (um trimestre fixado — para olhar o fechamento
 * de um que já acabou). O ano faz parte do valor porque, sem ele, fixar o T4 no
 * dia 2 de janeiro mostraria o T4 vazio do ano novo.
 *
 * Valor ausente ou inválido vale "auto": o painel nunca fica sem trimestre. Quem
 * impede valor inválido de ser gravado é o backend.
 */

export type NumeroDoTrimestre = 1 | 2 | 3 | 4;

export interface TrimestreEmApuracao {
  ano: number;
  trimestre: NumeroDoTrimestre;
  /** Os três meses, 1-based: [7, 8, 9]. */
  meses: number[];
  /** true quando a configuração fixa um trimestre em vez de seguir o calendário. */
  fixado: boolean;
}

export const MESES_CURTOS = [
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
] as const;

const FIXADO = /^(\d{4})-T([1-4])$/i;

function mesesDe(trimestre: NumeroDoTrimestre): number[] {
  const primeiro = (trimestre - 1) * 3 + 1;
  return [primeiro, primeiro + 1, primeiro + 2];
}

export function trimestreEmApuracao(
  valor: string | undefined,
  hoje: Date,
): TrimestreEmApuracao {
  const fixado = valor?.trim().match(FIXADO);
  if (fixado) {
    const trimestre = Number(fixado[2]) as NumeroDoTrimestre;
    return {
      ano: Number(fixado[1]),
      trimestre,
      meses: mesesDe(trimestre),
      fixado: true,
    };
  }
  const trimestre = (Math.floor(hoje.getMonth() / 3) + 1) as NumeroDoTrimestre;
  return {
    ano: hoje.getFullYear(),
    trimestre,
    meses: mesesDe(trimestre),
    fixado: false,
  };
}

export function valorDoTrimestre(
  ano: number,
  trimestre: NumeroDoTrimestre,
): string {
  return `${ano}-T${trimestre}`;
}

export function nomeDoTrimestre({
  ano,
  trimestre,
}: Pick<TrimestreEmApuracao, "ano" | "trimestre">): string {
  return `${trimestre}º trimestre de ${ano}`;
}

export function mesesPorExtenso(meses: number[]): string {
  return meses.map((m) => MESES_CURTOS[m - 1]).join(", ");
}
