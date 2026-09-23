import { useState } from "react";

/**
 * A página de uma tabela paginada NO SERVIDOR, que volta para a 1 quando
 * `chave` muda — o recorte, a busca e a ordem, juntos num texto.
 *
 * O `usePaginacao` faz isso para lista em memória, olhando a identidade da
 * lista; aqui não há lista, e a chave é o que muda. A volta era um
 * `useEffect` em Serviços, Vendas e Vendedores, e o render com a chave nova e
 * a página velha chegava a ser commitado: a busca da tabela, que mora num
 * efeito, pedia ao servidor a página 2 do filtro novo, jogava a resposta fora
 * e pedia a 1 (os pedidos de Vendas em 22/09 eram `[2, 1]`). Ajustando
 * durante o render, como o `usePaginacao`, o React descarta esse render antes
 * do commit, e o efeito da busca nem roda para ele.
 */
export function usePaginaDoRecorte(chave: string) {
  const [pagina, setPagina] = useState(1);
  const [chaveAnterior, setChaveAnterior] = useState(chave);

  if (chave !== chaveAnterior) {
    setChaveAnterior(chave);
    setPagina(1);
  }

  return [pagina, setPagina] as const;
}
