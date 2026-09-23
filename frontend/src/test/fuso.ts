/**
 * O esperado de um teste que depende do fuso de quem olha.
 *
 * A suíte roda duas vezes, em `TZ=UTC` e em `TZ=America/Sao_Paulo`, e a tela de
 * Importações mostra o horário da VPS no fuso do navegador. Os testes cravavam
 * o resultado de Brasília ("01:00") e falhavam em UTC, onde a tela está certa
 * em dizer "04:00".
 *
 * Os dois esperados ficam escritos no teste, e não recalculados com
 * `toLocaleTimeString`: refazer a conta da tela para conferir a tela passaria
 * junto com qualquer defeito dela.
 *
 * Em outro fuso lança em vez de escolher um dos dois — um esperado de Brasília
 * conferido em Lisboa falharia por motivo nenhum, ou pior, passaria.
 */
export function noFuso<T>(esperado: { brasilia: T; utc: T }): T {
  // Setembro: Brasília sem horário de verão desde 2019, então −3 h fixo.
  const minutos = new Date("2026-09-19T12:00:00Z").getTimezoneOffset();
  if (minutos === 180) return esperado.brasilia;
  if (minutos === 0) return esperado.utc;
  throw new Error(
    `Teste de fuso rodando com deslocamento de ${minutos} min: a suíte só conhece UTC e America/Sao_Paulo.`,
  );
}
