/**
 * A regra de bonificação (PL) do Gerenciamento Financeiro, sem React.
 *
 * É a conta mais sensível do sistema: o número que sai daqui é o percentual
 * do salário que cada funcionário recebe no trimestre. Não estava escrita em
 * lugar nenhum além do componente da aba.
 */

/** As dez faixas de bônus, de 5 em 5 pontos. */
export const FAIXAS = [55, 60, 65, 70, 75, 80, 85, 90, 95, 100] as const;

/**
 * O multiplicador da META trimestral para uma faixa de bônus.
 *
 * A curva tem DOIS trechos, com âncoras em 55% → 0,9 · 85% → 1,2 · 100% →
 * 1,4: abaixo de 85 sobe 0,05 por faixa, acima de 85 sobe 0,0666. Trocar por
 * uma reta única mantém as pontas batendo e muda todas as faixas do meio — o
 * PL de todo mundo, em silêncio. As faixas do meio estão fixadas em teste.
 */
export function multiplicador(bonus: number): number {
  return bonus <= 85
    ? 0.9 + (bonus - 55) * (0.3 / 30)
    : 1.2 + (bonus - 85) * (0.2 / 15);
}

/**
 * Dinheiro da aba Meta — o do `src/lib/dinheiro.ts`.
 *
 * ⚠️ NÃO é o `formatarMoeda` da tela, que devolve travessão para zero. Aqui
 * zero é valor apurado — trimestre que ainda não faturou nada tem alvo e
 * falta em reais —, e travessão no lugar de "R$ 0,00" apagaria a informação.
 */
export { formatarDinheiro } from "../../lib/dinheiro";

/**
 * Lê o valor cru da chave META da tabela de configurações.
 *
 * A chave já teve todos estes formatos: `12000000.00`, `12.000.000,00`,
 * `12000000,00`, `12.000.000` e `12000000`. Todos valem o mesmo, e todos têm
 * que dar a mesma meta — por isso a leitura decide pelo separador e não pelo
 * palpite. O que não é número vale zero, para a tela mostrar R$ 0,00 em vez
 * de `NaN` no dia em que alguém digitar "a definir" na configuração.
 */
export function lerValorDaMeta(cru: string | undefined): number {
  if (!cru) return 0;
  let texto = cru.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  if (texto.includes(",")) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if ((texto.match(/\./g) || []).length > 1) {
    texto = texto.replace(/\./g, "");
  }
  const numero = parseFloat(texto);
  return isNaN(numero) ? 0 : numero;
}

export interface FaixaDeBonificacao {
  /** O percentual do salário que a faixa paga. */
  bonus: number;
  multiplicador: number;
  /** O faturamento TRIMESTRAL necessário. */
  alvo: number;
  batida: boolean;
  /** Quanto falta para o alvo; zero quando já foi batido. */
  falta: number;
  /** Fração do alvo, em percentual, capada em 100. */
  progresso: number;
  /** O faturamento anual caso a faixa seja batida em todos os trimestres. */
  anualProjetado: number;
  /** Crescimento dessa projeção contra o ano passado; `null` sem base. */
  crescimentoAnual: number | null;
}

/**
 * As dez faixas, já apuradas contra o faturamento do trimestre.
 *
 * `alvo > 0` na condição de batida é o guarda que impede a empresa inteira de
 * aparecer com PL de 100% no dia em que a chave META sumir da tabela: alvo
 * zerado não conta como meta atingida.
 *
 * O progresso é capado em 100 porque a barra é uma barra — sem o cap ela
 * vaza do trilho no trimestre em que a meta é batida com folga.
 */
export function faixasDeBonificacao(
  metaAnual: number,
  faturamentoDoTrimestre: number,
  faturamentoAnoPassado: number,
): FaixaDeBonificacao[] {
  // A META é definida de forma ANUAL, mas o PL é apurado por TRIMESTRE.
  const metaTrimestral = metaAnual / 4;

  return FAIXAS.map((bonus) => {
    const mult = multiplicador(bonus);
    const alvo = metaTrimestral * mult;
    const anualProjetado = metaAnual * mult;
    return {
      bonus,
      multiplicador: mult,
      alvo,
      batida: alvo > 0 && faturamentoDoTrimestre >= alvo,
      falta: Math.max(alvo - faturamentoDoTrimestre, 0),
      progresso:
        alvo > 0 ? Math.min((faturamentoDoTrimestre / alvo) * 100, 100) : 0,
      anualProjetado,
      crescimentoAnual:
        faturamentoAnoPassado > 0
          ? ((anualProjetado - faturamentoAnoPassado) / faturamentoAnoPassado) *
            100
          : null,
    };
  });
}

/**
 * A faixa que vale — a MAIS ALTA batida, não a primeira.
 *
 * Como as faixas vêm em ordem crescente, quem bate a de 75% também bateu as
 * quatro anteriores; pegar a primeira pagaria 55% a quem tem direito a 75%.
 */
export function faixaAtual(
  faixas: FaixaDeBonificacao[],
): FaixaDeBonificacao | null {
  return [...faixas].reverse().find((faixa) => faixa.batida) ?? null;
}

/** A primeira ainda não batida — a que a tela mostra como próxima. */
export function proximaFaixa(
  faixas: FaixaDeBonificacao[],
): FaixaDeBonificacao | null {
  return faixas.find((faixa) => !faixa.batida) ?? null;
}
