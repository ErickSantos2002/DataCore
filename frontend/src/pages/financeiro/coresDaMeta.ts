import { FAIXAS } from "./meta";

/**
 * A cor do disco de uma faixa de bonificação: bronze na de 55%, ouro na de
 * 100%, interpolando entre as duas no caminho.
 *
 * Os dois extremos saem dos tokens `--medalha-bronze` e `--medalha-ouro`, que
 * existem justamente para isto e trocam de valor por tema — no claro são tons
 * mais escuros, para ter contraste sobre superfície branca. Antes eram dois
 * hexadecimais cravados no componente, que no tema claro ficavam ilegíveis.
 *
 * A leitura é em tempo de execução, como no `chartTheme`: a interpolação
 * acontece em JavaScript e precisa do valor, não da `var()`. A reserva
 * importa — em jsdom o CSS dos tokens não carrega e a propriedade volta
 * vazia.
 */
const BRONZE_RESERVA = "#b26b26";
const OURO_RESERVA = "#a8850b";

function lerToken(nome: string, reserva: string): string {
  if (typeof document === "undefined") return reserva;
  const valor = getComputedStyle(document.documentElement)
    .getPropertyValue(nome)
    .trim();
  return valor || reserva;
}

/** `#rrggbb` → `[r, g, b]`; devolve `null` para o que não for hexadecimal. */
function componentes(cor: string): [number, number, number] | null {
  const achado = cor.match(/^#([0-9a-f]{6})$/i);
  if (!achado) return null;
  const inteiro = parseInt(achado[1], 16);
  return [(inteiro >> 16) & 255, (inteiro >> 8) & 255, inteiro & 255];
}

const PRIMEIRA = FAIXAS[0];
const ULTIMA = FAIXAS[FAIXAS.length - 1];

export function corDaFaixa(bonus: number): string {
  const bronze = componentes(lerToken("--medalha-bronze", BRONZE_RESERVA));
  const ouro = componentes(lerToken("--medalha-ouro", OURO_RESERVA));
  if (!bronze || !ouro) return `var(--medalha-ouro, ${OURO_RESERVA})`;

  const passo = Math.min(
    Math.max((bonus - PRIMEIRA) / (ULTIMA - PRIMEIRA), 0),
    1,
  );
  const misturar = (de: number, para: number) =>
    Math.round(de + (para - de) * passo);
  return `rgb(${misturar(bronze[0], ouro[0])}, ${misturar(bronze[1], ouro[1])}, ${misturar(bronze[2], ouro[2])})`;
}
