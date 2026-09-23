import type { ReactNode } from "react";

const MENSAGEM_VAZIO_PADRAO = "Nenhum dado para exibir.";

export interface ChartEmptyProps {
  /**
   * Altura em pixels do gráfico que está sendo substituído — o mesmo número
   * que vai no `height` do `ResponsiveContainer`. Obrigatório de propósito:
   * um valor padrão daria certo num gráfico e erraria em todos os outros, e
   * o cartão pularia de tamanho conforme o dado chega ou some.
   */
  height: number;
  /**
   * Frase completa dizendo o que houve, com ponto final. Aceita nó, e não só
   * texto: quando o vazio tem uma saída ("Limpar filtros"), a frase e o botão
   * que a resolve moram no mesmo lugar em que a pessoa está olhando.
   */
  message?: ReactNode;
}

/**
 * Estado vazio de gráfico — o irmão do `TableEmpty`. Ocupa exatamente o
 * espaço que o gráfico ocuparia e escreve, no meio dele, o que houve.
 *
 * ```tsx
 * {categorias.length === 0 ? (
 *   <ChartEmpty height={300} message="Nenhuma conta para montar este gráfico." />
 * ) : (
 *   <ResponsiveContainer width="100%" height={300}>…</ResponsiveContainer>
 * )}
 * ```
 *
 * Existe porque gráfico sem dado não desenha nada útil: o de barras pinta um
 * eixo em branco e o de pizza não pinta coisa alguma. Uma moldura vazia
 * dentro de um cartão com título lê como tela quebrada, não como "não há o
 * que mostrar" — e quem olha não sabe se deve esperar, recarregar ou mexer
 * no filtro.
 *
 * **Uma frase serve para os dois vazios.** Lista vazia e falha de
 * carregamento chegam aqui iguais: nos dois casos não há dado para plotar. A
 * causa não é assunto do cartão do gráfico — na falha, o `Alert` no topo da
 * página já a explica, e repetir "não foi possível carregar" dentro de cada
 * gráfico diria a mesma coisa mais três vezes e ainda estaria errado quando
 * o vazio veio do filtro. É o mesmo tratamento que o `TableEmpty` já dá.
 */
export function ChartEmpty({ height, message = MENSAGEM_VAZIO_PADRAO }: ChartEmptyProps) {
  return (
    <div
      style={{ height: `${height}px` }}
      className="flex items-center justify-center rounded-lg border border-dashed border-borda px-4 text-center text-sm text-conteudo-muted"
    >
      {message}
    </div>
  );
}
