/**
 * Dinheiro que vem em texto da API do Tiny.
 *
 * A API entrega valor e saldo ora como número, ora como string — e a string
 * vem em dois formatos: o brasileiro (`1.234,56`) e o americano
 * (`1234.56`). A conversão mora aqui, e não copiada dentro de cada contexto,
 * porque o defeito abaixo existia idêntico nas duas cópias de Contas: corrigir
 * uma e esquecer a outra é exatamente como as gêmeas divergiram.
 */

/**
 * Ponto como separador de MILHAR: grupos de exatamente três dígitos, do
 * segundo grupo em diante — `1.234`, `1.234.567`, `-12.000`.
 *
 * É o que distingue `1.234` (mil duzentos e trinta e quatro) de `1.23` (um
 * real e vinte e três centavos): no formato americano o que vem depois do
 * ponto decimal tem uma ou duas casas, nunca três agrupadas até o fim.
 */
const PONTO_DE_MILHAR = /^-?\d{1,3}(\.\d{3})+$/;

/**
 * `"1.234,56"` → `1234.56` · `"1234.56"` → `1234.56` · `"1.234"` → `1234`.
 *
 * O terceiro caso é o defeito que este módulo existe para fechar: `1.234`
 * não tem vírgula, então o ponto era lido como separador decimal e a nota de
 * mil duzentos e trinta e quatro reais virava **R$ 1,23** na tela, no KPI e
 * na planilha. Era o pior defeito de dinheiro das duas telas de Contas.
 *
 * O que não é número — `null`, `""`, `"sem valor"` — vale zero, para a tela
 * mostrar R$ 0,00 em vez de `NaN`.
 */
export function converterParaNumero(
  valor: string | number | undefined | null,
): number {
  if (typeof valor === "number") return valor;
  if (!valor) return 0;

  const texto = valor.toString().replace(/R\$/g, "").replace(/\s/g, "");

  // Tem vírgula: é o formato brasileiro. O ponto só pode ser milhar.
  if (texto.includes(",")) {
    return parseFloat(texto.replace(/\./g, "").replace(",", ".")) || 0;
  }
  // Só ponto, em grupos de três: também é milhar, e não decimal.
  if (PONTO_DE_MILHAR.test(texto)) {
    return parseFloat(texto.replace(/\./g, "")) || 0;
  }
  // Sobra o formato americano, em que o ponto é mesmo o decimal.
  return parseFloat(texto) || 0;
}

/**
 * Dinheiro escrito em real, sempre com os dois decimais.
 *
 * Zero sai como `R$ 0,00`, e não como travessão: aqui zero é valor apurado —
 * uma comissão zerada, um custo que deu zero — e trocá-lo por travessão
 * apagaria a informação. A tela de Financeiro tem o seu próprio
 * `formatarMoeda`, que faz o contrário, porque lá zero quase sempre é mês que
 * ainda não aconteceu.
 */
export function formatarDinheiro(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const ABREVIADO = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * Dinheiro abreviado, para eixo e balão de gráfico: "R$ 2,5 mi", "R$ 3,4 mil",
 * "R$ 999,5".
 *
 * Eram oito cópias, uma por tela, todas com "R$ 2.5M" e "R$ 3.4K" — ponto
 * decimal e sufixo do inglês —, cada uma com a sua regra abaixo de mil, e
 * nenhuma com negativo: `valor >= 1_000` mandava −2.500.000 para o ramo de
 * unidade. O `Intl` resolve vírgula, sinal e a fronteira (999.999 vira
 * "R$ 1 mi", e não "R$ 1000.0K"). Decisão do Erick (22/09). O espaço é o duro
 * do `Intl`, como em `formatarDinheiro`: no eixo, "R$" não se separa do número.
 */
export function formatarDinheiroAbreviado(valor: number): string {
  return ABREVIADO.format(valor);
}

/**
 * A máscara de um campo de dinheiro, aplicada a cada tecla.
 *
 * Agrupa o milhar com ponto e preserva o que vier depois da vírgula. Mora
 * aqui, junto do `converterParaNumero`, porque as duas funções precisam
 * concordar sobre o que é ponto de milhar: quando a máscara escreve
 * `1.234.567` e o parse lê `1,234`, o valor entra na conta dividido por mil —
 * que é exatamente o defeito que o Centro de Custo tem hoje, por usarem
 * leituras diferentes.
 */
export function mascaraDeDinheiro(valor: string): string {
  const limpo = valor.replace(/[^\d,]/g, "");
  const [inteiro = "", decimal] = limpo.split(",");
  const agrupado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimal !== undefined ? `${agrupado},${decimal}` : agrupado;
}
