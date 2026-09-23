/**
 * A comissão dos vendedores, sem React.
 *
 * Regra do sistema de comissionamento do 2º quadrimestre: cada canal de venda
 * tem a sua alíquota, a faixa sai do total do vendedor no mês, e sobre isso
 * entram o bônus por desempenho e o rateio de 1% — que é um piso, não um
 * acréscimo.
 *
 * Tudo o que decide dinheiro mora aqui, fora do componente, porque é a parte
 * que precisa ser conferida número a número contra o fechamento que o
 * Financeiro já fez na planilha.
 */

import { converterParaNumero } from "../../lib/dinheiro";

/** Os três canais de venda, cada um com a sua regra de alíquota. */
export type CanalDeVenda = "inbound" | "recompra" | "outbound";

/** Prospecção da origem: maior esforço, maior alíquota, e fixa. */
export const ALIQUOTA_OUTBOUND = 0.015;

/** Adicional do Inbound Plus, sobre a parcela negociada. Ainda inativo. */
export const ADICIONAL_INBOUND_PLUS = 0.0025;

/** Prêmio por recompra ativada proativamente. Ainda inativo. */
export const PREMIO_POR_RECOMPRA_ATIVA = 100;

/** A fração do faturamento da empresa que vira piso de comissão. */
export const FRACAO_DO_RATEIO = 0.01;

/**
 * Os dois incentivos existem na regra publicada mas ainda não foram
 * confirmados: ninguém sabe ao certo o que conta como "negociação extra" nem
 * o que caracteriza uma recompra ativada. A conta está pronta e testada; o
 * que esta constante decide é se ela entra no valor a pagar.
 *
 * Ligar é trocar `false` por `true` — e conferir os dois testes que hoje
 * afirmam que os campos não mudam nada.
 */
export const INCENTIVOS_ATIVOS = false;

export interface FaturamentoDoVendedor {
  id: string;
  nome: string;
  /** Leads vindos do marketing. */
  inbound: number;
  /** Clientes que já compraram antes. */
  recompra: number;
  /** Clientes minerados desde a origem. */
  outbound: number;
  /** Parcela do inbound com negociação extra. Inativo por ora. */
  inboundPlus: number;
  /** Quantas recompras foram ativadas proativamente. Inativo por ora. */
  recomprasAtivas: number;
}

export function vendedorVazio(id: string): FaturamentoDoVendedor {
  return {
    id,
    nome: "",
    inbound: 0,
    recompra: 0,
    outbound: 0,
    inboundPlus: 0,
    recomprasAtivas: 0,
  };
}

/**
 * A alíquota do inbound sobe em quatro degraus conforme o vendedor fatura
 * mais no mês: 0,75% até 500 mil, 1% até 750 mil, 1,25% até 1 milhão, 1,5%
 * daí para cima.
 */
export function aliquotaDeInbound(totalDoVendedor: number): number {
  if (totalDoVendedor >= 1_000_000) return 0.015;
  if (totalDoVendedor >= 750_000) return 0.0125;
  if (totalDoVendedor >= 500_000) return 0.01;
  return 0.0075;
}

/**
 * A recompra tem só dois degraus e para em 1% — não acompanha o inbound até
 * 1,5%. Vender para quem já é cliente custa menos esforço.
 */
export function aliquotaDeRecompra(totalDoVendedor: number): number {
  return totalDoVendedor >= 500_000 ? 0.01 : 0.005;
}

/** As alíquotas dos três canais para um dado total do vendedor. */
export function aliquotasDoVendedor(
  totalDoVendedor: number,
): Record<CanalDeVenda, number> {
  return {
    inbound: aliquotaDeInbound(totalDoVendedor),
    recompra: aliquotaDeRecompra(totalDoVendedor),
    outbound: ALIQUOTA_OUTBOUND,
  };
}

/**
 * O prêmio fixo por faixa de faturamento do mês.
 *
 * Abaixo de 200 mil não há bônus — é o piso de entrada da regra.
 */
export function bonusPorDesempenho(totalDoVendedor: number): number {
  if (totalDoVendedor >= 1_000_000) return 1_500;
  if (totalDoVendedor >= 500_000) return 750;
  if (totalDoVendedor >= 400_000) return 500;
  if (totalDoVendedor >= 200_000) return 250;
  return 0;
}

/**
 * O mínimo garantido: 1% do faturamento da empresa dividido igualmente entre
 * todos os vendedores ativos.
 *
 * Divide pela lista inteira, não só por quem vendeu: o rateio existe
 * justamente para proteger quem ainda não formou carteira.
 */
export function rateioPorVendedor(
  faturamentoTotal: number,
  quantidadeDeVendedores: number,
): number {
  if (quantidadeDeVendedores <= 0) return 0;
  return (faturamentoTotal * FRACAO_DO_RATEIO) / quantidadeDeVendedores;
}

export interface ComissaoDoVendedor {
  id: string;
  nome: string;
  /** Soma dos três canais — é ela que decide a faixa. */
  total: number;
  aliquotas: Record<CanalDeVenda, number>;
  comissao: number;
  bonus: number;
  rateio: number;
  /** O maior entre comissão + bônus e o rateio. */
  recebe: number;
  /** Verdadeiro quando foi o piso que valeu, e não o esforço do mês. */
  peloRateio: boolean;
}

export interface FechamentoDeComissao {
  linhas: ComissaoDoVendedor[];
  /** O piso, igual para todos. */
  rateio: number;
  totalAPagar: number;
}

export interface OpcoesDoCalculo {
  /** Sobrescreve `INCENTIVOS_ATIVOS`; existe para o teste dos incentivos. */
  incentivosAtivos?: boolean;
}

/**
 * O fechamento do mês: uma linha por vendedor e o total a pagar.
 *
 * O `recebe` é `max(comissão + bônus, rateio)`, e não a soma dos dois: o
 * rateio é piso, não acréscimo. Somá-lo pagaria duas vezes a quem já bateu
 * meta.
 */
export function calcularComissoes(
  vendedores: FaturamentoDoVendedor[],
  faturamentoTotal: number,
  opcoes: OpcoesDoCalculo = {},
): FechamentoDeComissao {
  const incentivos = opcoes.incentivosAtivos ?? INCENTIVOS_ATIVOS;
  const rateio = rateioPorVendedor(faturamentoTotal, vendedores.length);

  const linhas = vendedores.map((vendedor) => {
    const total = vendedor.inbound + vendedor.recompra + vendedor.outbound;
    const aliquotas = aliquotasDoVendedor(total);

    const comissao =
      vendedor.inbound * aliquotas.inbound +
      vendedor.recompra * aliquotas.recompra +
      vendedor.outbound * aliquotas.outbound +
      // O adicional do Plus incide só sobre a parcela negociada, nunca sobre
      // o inbound inteiro.
      (incentivos ? vendedor.inboundPlus * ADICIONAL_INBOUND_PLUS : 0);

    const bonus =
      bonusPorDesempenho(total) +
      (incentivos ? vendedor.recomprasAtivas * PREMIO_POR_RECOMPRA_ATIVA : 0);

    const ganho = comissao + bonus;

    return {
      id: vendedor.id,
      nome: vendedor.nome,
      total,
      aliquotas,
      comissao,
      bonus,
      rateio,
      recebe: Math.max(ganho, rateio),
      peloRateio: rateio > ganho,
    };
  });

  return {
    linhas,
    rateio,
    totalAPagar: linhas.reduce((soma, linha) => soma + linha.recebe, 0),
  };
}

/**
 * O vendedor como a tela o guarda: tudo texto, do jeito que foi digitado.
 *
 * A máscara de dinheiro escreve ponto de milhar enquanto se digita, e é por
 * isso que a leitura precisa ser a do `src/lib/dinheiro.ts` — um parse que
 * trate `1.234.567` como decimal entrega a conta dividida por mil, que é o
 * defeito que o Centro de Custo carrega até hoje.
 */
export interface VendedorDigitado {
  id: string;
  nome: string;
  inbound: string;
  recompra: string;
  outbound: string;
  inboundPlus: string;
  recomprasAtivas: string;
}

export function vendedorDigitadoVazio(id: string): VendedorDigitado {
  return {
    id,
    nome: "",
    inbound: "",
    recompra: "",
    outbound: "",
    inboundPlus: "",
    recomprasAtivas: "",
  };
}

/** Do que foi digitado para o que a conta usa. */
export function lerVendedorDigitado(
  digitado: VendedorDigitado,
): FaturamentoDoVendedor {
  return {
    id: digitado.id,
    nome: digitado.nome,
    inbound: converterParaNumero(digitado.inbound),
    recompra: converterParaNumero(digitado.recompra),
    outbound: converterParaNumero(digitado.outbound),
    inboundPlus: converterParaNumero(digitado.inboundPlus),
    // Contagem, não dinheiro: cinco recompras ativadas são 5, e nunca 5,00.
    recomprasAtivas: parseInt(digitado.recomprasAtivas, 10) || 0,
  };
}
