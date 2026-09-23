/**
 * O corte dos relatórios em PDF (Clientes e Serviços).
 *
 * O PDF leva só as primeiras linhas da tabela, na ordem em que ela está: é um
 * relatório para ler e imprimir, e centenas de linhas de `autoTable` eram o
 * problema que o corte evitava. A planilha leva todas.
 *
 * Até 22/09 o corte era calado — quem abria o PDF lia o recorte inteiro — e o
 * número 30 estava repetido nas duas telas. Decisão do Erick: mantém o corte, e
 * o PDF diz que cortou.
 */
export const LINHAS_NO_PDF = 30;

/**
 * A frase que vai no cabeçalho do PDF quando a tabela passa do limite; `null`
 * quando cabe inteira.
 *
 * "Primeiras", e não "maiores": o PDF segue a ordem que a pessoa deixou na
 * tabela, que pode ser por nome ou por data.
 */
export function avisoDoCorteDoPdf(total: number): string | null {
  if (total <= LINHAS_NO_PDF) return null;
  return `As ${LINHAS_NO_PDF} primeiras de ${total} linhas, na ordem da tabela. A planilha leva todas.`;
}
