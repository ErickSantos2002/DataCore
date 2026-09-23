/** Rótulo de mês para a tela.
 *
 * Era a última função viva de `faturamento.ts`, que sumiu quando o dashboard
 * passou a ler o faturamento já somado do `gold`. Ela nunca foi régua — é
 * formatação — e ficar num arquivo chamado "faturamento" convidaria alguém a
 * voltar a pôr regra de negócio ali.
 */

/** "Junho/2026" — o rótulo que a tela usa para o mês, com inicial maiúscula.
 *  Sai do `toLocaleString` e não de uma lista escrita à mão para o nome
 *  seguir o idioma configurado, como já era antes. */
export function rotuloDoMes(mes: number, ano: number): string {
  const nome = new Date(ano, mes - 1, 1).toLocaleString("pt-BR", {
    month: "long",
  });
  return `${nome[0].toUpperCase()}${nome.slice(1)}/${ano}`;
}
