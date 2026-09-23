/** A regra de negócio da tela de Meta do trimestre.
 *
 * Fica fora do componente porque não é aparência: é a conta que decide o
 * bônus da equipe. Um arquivo próprio deixa a conta legível, testável pelo
 * que ela é, e difícil de "simplificar" sem querer no meio de um refactor
 * visual.
 */

/** Valor da chave META, como ele vem da tabela de configurações.
 *
 * A chave é texto livre, e ao longo do tempo foi digitada de três formas
 * diferentes — todas em produção, todas válidas:
 *
 *   "12666666.72"     ponto decimal, jeito americano
 *   "12.666.666,72"   milhar com ponto e decimal com vírgula, jeito brasileiro
 *   "12666666,72"     decimal com vírgula, sem separador de milhar
 *
 * Qualquer coisa que não vire número — vazio, ausente, prosa — vale zero, e
 * a tela mostra os três degraus zerados em vez de `NaN`.
 */
export function parseValor(raw?: string): number {
  if (!raw) return 0;
  let s = raw.trim();
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export interface DegrausDaMeta {
  /** A meta do trimestre: a META anual dividida por 4. */
  trimestre: number;
  /** Degrau que paga 55% de PL — 90% da meta do trimestre. */
  degrau55: number;
  /** Degrau que paga 85% de PL — 120% da meta do trimestre. */
  degrau85: number;
  /** Degrau que paga 100% de PL — 140% da meta do trimestre. */
  degrau100: number;
}

/** Divide a META ANUAL por 4 e abre os três degraus de bonificação.
 *
 * A divisão por 4 é a parte silenciosa: a configuração guarda a meta do ANO,
 * e esta tela mede o TRIMESTRE. Sem ela, a meta quadruplica e nenhum degrau
 * é alcançado nunca — sem erro, sem aviso, só um número errado na parede.
 */
export function degrausDaMeta(metaAnual?: string): DegrausDaMeta {
  const trimestre = parseValor(metaAnual) / 4;
  return {
    trimestre,
    degrau55: trimestre * 0.9,
    degrau85: trimestre * 1.2,
    degrau100: trimestre * 1.4,
  };
}

/** O degrau mais alto que o valor já alcançou — "55%", "85%", "100%" — ou
 *  `null` quando nem o primeiro foi batido. É o PL que a equipe leva se o
 *  trimestre fechar com esse valor. */
export function faixaAlcancada(
  valor: number,
  { degrau55, degrau85, degrau100 }: DegrausDaMeta,
): string | null {
  if (valor >= degrau100) return "100%";
  if (valor >= degrau85) return "85%";
  if (valor >= degrau55) return "55%";
  return null;
}

/** Os meses do trimestre em apuração, como vêm da chave MESES_ANALISE.
 *
 * Mesmo parse do DashboardContext, de propósito: é ele quem decide quais
 * meses entram no `total`, e a projeção precisa medir o MESMO período. Um
 * parse divergente aqui projetaria o faturamento de três meses sobre um
 * calendário de quatro. Também não deduplica pelo mesmo motivo — se a
 * configuração repetir um mês, o contexto soma o mês duas vezes, e os dias
 * têm que ser contados duas vezes para a razão continuar honesta.
 */
export function mesesDoTrimestre(raw?: string): number[] {
  return (raw?.split(",") ?? [])
    .map((m) => Number(m.trim()))
    .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
}

/** Como a projeção chegou ao número.
 *
 *  `sazonal` — pela forma do mesmo trimestre no ano anterior, corrigida pelo
 *  crescimento medido até aqui. É o método bom, e o padrão.
 *
 *  `linear` — a queda, quando não há ano anterior com que comparar. A tela é
 *  obrigada a dizer que caiu: número que finge ser sazonal é pior que número
 *  assumidamente grosseiro.
 */
export type MetodoDaProjecao = "sazonal" | "linear";

export interface ProjecaoDeFechamento {
  /** false quando não há como projetar sem inventar número. */
  disponivel: boolean;
  /** Quanto o trimestre fecha, pela conta do método abaixo. */
  projetado: number;
  /** Qual dos dois métodos produziu o número. */
  metodo: MetodoDaProjecao;
  /** Realizado ÷ mesmo período do ano anterior. `null` no método linear. */
  fatorCrescimento: number | null;
  /** O ano cuja forma a projeção usou (ou usaria). */
  anoAnterior: number;
  /** Dias do trimestre já vividos (o mês corrente entra pelo dia de hoje). */
  diasDecorridos: number;
  /** Dias que o trimestre inteiro tem. */
  diasTotais: number;
}

export interface EntradaDaProjecao {
  /** O faturamento apurado do trimestre até agora. */
  realizado: number;
  /** Os meses do trimestre, 1-based, como em MESES_ANALISE. */
  meses: number[];
  /** Hoje. Parâmetro, e não `new Date()` aqui dentro, para o teste poder
   *  parar o relógio em qualquer dia do trimestre. */
  hoje: Date;
  /** Faturamento de cada mês do ano ANTERIOR, índice 0 = janeiro. É a forma
   *  sazonal. Ausente ou zerado, a projeção cai no método linear. */
  totaisAnoAnterior?: number[];
}

/** Teto do fator de crescimento.
 *
 * O fator multiplica o que falta do trimestre. Se o mesmo período do ano
 * passado tiver faturado quase nada — um mês em que o ERP não sincronizou,
 * um trimestre em que a empresa nem vendia aquele produto — o fator explode
 * e a projeção vira ficção. Triplicar o ano anterior já é um crescimento
 * absurdo; acima disso o que está errado é o denominador, não a empresa.
 */
const TETO_DO_FATOR = 3;

/** Projeta o fechamento do trimestre pela FORMA do mesmo trimestre do ano
 *  anterior, corrigida pelo crescimento do ano corrente.
 *
 * A conta anterior era uma regra de três sobre dias — realizado × (dias do
 * trimestre ÷ dias decorridos) — e assumia que todo mês do trimestre vende
 * no mesmo ritmo. Não vende. Em 2025, o trimestre de julho a setembro se
 * repartiu em 44,0% / 31,8% / 24,2%: setembro valeu 55% de julho. Projetar
 * linear no fim de agosto superestimava o fechamento em cerca de 12%, e o
 * erro só apareceria com o trimestre fechado — num painel que decide
 * bonificação.
 *
 * A conta agora é:
 *
 *     fator      = realizado ÷ (mesmo período do ano anterior)
 *     falta      = (período que resta, no ano anterior) × fator
 *     projetado  = realizado + falta
 *
 * O fator responde "quanto este ano está acima ou abaixo do anterior"; o
 * período que resta, medido no ano anterior, carrega a forma sazonal. O mês
 * corrente é repartido: a parte já decorrida é realizado e não se estima, a
 * parte que falta entra pelo mês correspondente do ano anterior, proporcional
 * aos dias que restam. Os dias saem do calendário do ano CORRENTE, o mesmo
 * que define `diasTotais` — fevereiro bissexto incluso.
 *
 * Como `falta` nunca é negativa, a projeção nunca fica abaixo do realizado.
 * Com o trimestre encerrado não resta período nenhum, e ela é o próprio
 * realizado.
 *
 * Sem ano anterior — série ausente, zerada, ou sem faturamento na parte que
 * falta — não há forma nem fator para calcular, e a conta cai no método
 * linear de antes. Isso é reportado em `metodo`, e a tela é obrigada a dizer.
 *
 * Sem mês configurado, ou antes de o trimestre começar (zero dia decorrido),
 * não há nem ritmo nem período comparável — devolve `disponivel: false` em
 * vez de um número. Número inventado num painel de meta é pior que card
 * faltando.
 */
export function projecaoDeFechamento({
  realizado,
  meses,
  hoje,
  totaisAnoAnterior = [],
}: EntradaDaProjecao): ProjecaoDeFechamento {
  const ano = hoje.getFullYear();
  const mesDeHoje = hoje.getMonth() + 1;
  const anoAnterior = ano - 1;

  let diasTotais = 0;
  let diasDecorridos = 0;
  // O mesmo trimestre do ano anterior, partido no ponto em que hoje está:
  // o que já teria acontecido, e o que ainda faltaria.
  let anteriorDecorrido = 0;
  let anteriorRestante = 0;

  for (const mes of meses) {
    // Dia 0 do mês seguinte é o último dia deste mês — inclusive em fevereiro
    // bissexto, sem tabela de dias por mês escrita à mão.
    const diasNoMes = new Date(ano, mes, 0).getDate();
    const noAnoAnterior = totaisAnoAnterior[mes - 1] ?? 0;
    diasTotais += diasNoMes;

    if (mes < mesDeHoje) {
      diasDecorridos += diasNoMes;
      anteriorDecorrido += noAnoAnterior;
    } else if (mes === mesDeHoje) {
      const diasVividos = Math.min(hoje.getDate(), diasNoMes);
      diasDecorridos += diasVividos;
      const fracao = diasVividos / diasNoMes;
      anteriorDecorrido += noAnoAnterior * fracao;
      anteriorRestante += noAnoAnterior * (1 - fracao);
    } else {
      anteriorRestante += noAnoAnterior;
    }
  }

  const base = { anoAnterior, diasDecorridos, diasTotais };

  if (diasTotais === 0 || diasDecorridos === 0) {
    return {
      ...base,
      disponivel: false,
      projetado: 0,
      metodo: "linear",
      fatorCrescimento: null,
    };
  }

  const linear = {
    ...base,
    disponivel: true,
    projetado: realizado * (diasTotais / diasDecorridos),
    metodo: "linear" as const,
    fatorCrescimento: null,
  };

  // Sem base do ano anterior não há fator. Sem faturamento no que resta do
  // ano anterior não há forma — e um trimestre inteiro zerado ali é muito
  // mais provavelmente dado que falta do que venda que não houve. Nos dois
  // casos a projeção cai no linear em vez de fingir sazonalidade. O
  // trimestre já encerrado é a exceção: ali não resta período nenhum, e é
  // isso mesmo que a projeção tem que dizer.
  const trimestreEncerrado = diasDecorridos >= diasTotais;
  if (anteriorDecorrido <= 0) return linear;
  if (anteriorRestante <= 0 && !trimestreEncerrado) return linear;

  const fator = Math.min(
    Math.max(realizado / anteriorDecorrido, 0),
    TETO_DO_FATOR,
  );

  return {
    ...base,
    disponivel: true,
    projetado: realizado + anteriorRestante * fator,
    metodo: "sazonal",
    fatorCrescimento: fator,
  };
}
