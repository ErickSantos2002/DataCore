import { Card } from "../../design-system/ui";

export interface CabecalhoProdutosProps {
  usuario?: { username?: string; role?: string } | null;
}

/**
 * Cabeçalho da tela de Produtos: título, quem está logado e uma frase sobre
 * o que a tela mostra.
 *
 * Adota os tokens do design system no lugar de `dark:` e paleta crua, como
 * `CabecalhoContas.tsx` já faz para a tela irmã — é o que deixa
 * `src/pages/Produtos.tsx` sair de `PENDENTES_FASE_3` sem acordar o guarda de
 * cores (`src/test/guarda-cores.test.ts`).
 *
 * O texto anterior mandava ver "o plano de 09/09/2026, «Mudança de rumo»" e a
 * "Task 4": nenhum dos dois existe neste repositório. Vieram colados junto do
 * arquivo, copiado verbatim de `79954c07` — uma tentativa anterior de migrar
 * esta tela, com outra numeração de tasks. Quem seguisse o ponteiro pararia na
 * task errada, então a citação saiu em vez de ser remendada.
 */
export function CabecalhoProdutos({ usuario }: CabecalhoProdutosProps) {
  return (
    <Card padding="lg">
      <h1 className="text-3xl font-bold text-conteudo-heading">
        Produtos - Dashboard
      </h1>
      <p className="mt-1 text-sm text-conteudo">
        Bem-vindo, <span className="font-semibold">{usuario?.username}</span> (
        {usuario?.role})
      </p>
      <p className="mt-2 text-sm text-conteudo-muted">
        Análise detalhada de produtos vendidos, quantidades, valores e
        performance.
      </p>
    </Card>
  );
}
