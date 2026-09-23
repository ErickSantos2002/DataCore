/**
 * Data de calendário — o dia que a string diz, em qualquer fuso.
 *
 * Uma data que o backend manda como `2026-01-15` (ou `2026-01-15T09:30:00`)
 * é dia de calendário, não instante: não tem hora, não tem fuso, e o dia
 * certo é o que está escrito. Passar por `new Date(...)` estraga isso — o
 * ECMAScript lê a forma `YYYY-MM-DD` como meia-noite em UTC, e a oeste de
 * Greenwich meia-noite em UTC ainda é o dia anterior. Foi assim que a
 * planilha da Locação saiu com 09/07 onde a tela mostrava 10/07.
 *
 * Por isso a conversão é feita na própria string, sem `Date` nenhum. É a
 * mesma regra para as duas telas que já leem data assim (Locação, pela nota
 * fiscal; Usuários, pelo `created_at`), e o lugar para as próximas.
 */

/** `AAAA-MM-DD` no começo da string — o resto (hora, `Z`, offset) é ignorado. */
const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * `"2026-07-10"`, `"2026-07-10T14:57:00"` e `"2026-07-10T02:00:00Z"` viram
 * `"10/07/2026"` — em Brasília, em Tóquio ou em UTC, sempre o mesmo dia.
 *
 * Sem data, ou com uma string que não começa por uma data ISO, devolve o
 * travessão: a tabela mostra `—`, e não `Invalid Date` no meio do português.
 */
export function dataDeCalendario(data: string | null | undefined): string {
  if (!data) return "—";
  const casou = DATA_ISO.exec(data);
  if (!casou) return "—";
  const [, ano, mes, dia] = casou;
  return `${dia}/${mes}/${ano}`;
}

/**
 * O dia do calendário de um instante, no fuso de quem está olhando.
 *
 * Existe porque `toISOString().split("T")[0]` devolve o dia em **UTC**: às 23h
 * de 28/08 em São Paulo já são 02h de 29/08 em UTC, e o nome do arquivo
 * exportado saía com a data do dia seguinte. O defeito foi corrigido em Contas
 * na Fase 1 e reencontrado em mais sete lugares no item 3 da Fase 4 — seis
 * telas não migradas e, o mais instrutivo dos sete, `pages/locacao`, que é
 * migrada e cujos testes pregavam o defeito em vez de pegá-lo.
 *
 * Veio de `pages/contas/contas.ts`, onde nasceu, e subiu para cá quando
 * apareceu a segunda cópia (`dataDeHoje`, em `financeiro/AbaComissao.tsx`).
 */
export function diaLocal(instante: Date): string {
  const ano = instante.getFullYear();
  const mes = String(instante.getMonth() + 1).padStart(2, "0");
  const dia = String(instante.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/**
 * `"2026-07-10"` como `Date` no fuso de quem olha — meia-noite LOCAL.
 *
 * A inversa de `diaLocal`, e existe pelo mesmo motivo dela: `new Date("2026-07-10")`
 * é meia-noite em **UTC**, que a oeste de Greenwich ainda é dia 9. Quem compara
 * essa data com "hoje menos noventa dias" erra por um dia nas bordas — e erra
 * calado, porque o resultado continua sendo uma data plausível.
 *
 * Devolve `null` para o que não começa com uma data ISO, e não `Invalid Date`:
 * quem chama testa `if (data)` e não precisa saber de `isNaN(+data)`.
 */
export function dataDeCalendarioComoDate(
  data: string | null | undefined,
): Date | null {
  if (!data) return null;
  const casou = DATA_ISO.exec(data);
  if (!casou) return null;
  const [, ano, mes, dia] = casou;
  return new Date(Number(ano), Number(mes) - 1, Number(dia));
}
