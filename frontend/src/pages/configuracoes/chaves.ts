/** As chaves que a página trata em seção própria. Qualquer outra cai em
 *  "Usadas por outros sistemas".
 *
 *  MESES_ANALISE está aqui só para não aparecer como "de outro sistema" entre o
 *  deploy e a migração 003, que a apaga. Depois da 003, pode sair da lista. */
export const CHAVES_DO_PAINEL: ReadonlySet<string> = new Set([
  "META",
  "TRIMESTRE_APURACAO",
  "ANIMACAO_META",
  "MESES_ANALISE",
]);
