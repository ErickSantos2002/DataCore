import { useMemo, useState } from "react";

/**
 * Estado de paginação de uma listagem: a página atual, o corte da lista e o
 * total. Feito para casar com o `Pagination` do design system, que quer
 * `page`, `pageSize`, `total` e `onPageChange`.
 *
 * **Volta para a primeira página quando `itens` muda de referência.** É o
 * conserto de um defeito concreto que estava nas seis telas da Fase 4: quem
 * estava na página 7 de 84 produtos e filtrava para 20 continuava na 7 —
 * `slice(60, 70)` num array de 20 devolve nada, então a tabela ficava em
 * branco, e o rodapé escrevia "Mostrando 61 a 20 de 20 registros", com o
 * intervalo invertido. Pior: o botão Próxima comparava `7 === 2` e seguia
 * habilitado, levando à página 8.
 *
 * **O reset olha a identidade de `itens`, não o tamanho** — filtrar pode
 * devolver a mesma quantidade e ainda assim ser outra lista. Isso impõe um
 * contrato ao chamador: **`itens` precisa vir de um `useMemo`** cujas
 * dependências sejam os filtros. Uma lista remontada a cada render **não**
 * degrada em silêncio: o reset roda durante o render, então cada referência
 * nova dispara outro reset, que produz outro render com outra referência
 * nova, e o React aborta com "Too many re-renders". A tela cai em vez de
 * paginar errado — barulhento, e por isso mesmo difícil de ignorar. Nas seis
 * telas o contrato já era verdade antes do hook existir — todas fazem
 * `useMemo(..., [<listaFiltrada>, pesquisaTabela, ordenacao])`.
 *
 * **O estouro depende de onde a lista instável nasce.** Ele acontece porque,
 * nas seis telas, a lista sem `useMemo` é montada dentro do próprio
 * componente que chama o hook — cada render do componente recria o array, o
 * reset dispara, o render seguinte recria de novo, e o loop estoura alto.
 * Uma lista instável que chegasse pronta de um componente **pai**, via prop,
 * não teria esse loop: o pai rerenderiza por outro motivo, entrega uma
 * referência nova, o reset volta a página para 1 uma vez só e para aí — sem
 * estourar nada, calado. É por isso que o contrato do `useMemo` é de quem
 * chama o hook, não de quem o escreveu: o silêncio do estouro aqui não é
 * garantia geral, é o efeito colateral de como as seis telas montam a lista.
 *
 * Resetar ao ordenar é intencional e não é efeito colateral: Contas já fazia
 * isso à mão desde `457e4176`, com nove `setPagina(1)` espalhados pelos
 * pontos de filtro e de ordenação. O hook generaliza a decisão em vez de
 * pedir que cada tela lembre dela.
 *
 * **O reset acontece durante o render, não num `useEffect`.** Com efeito
 * existiria um render em que `itens` já é a lista nova e `pagina` ainda é a
 * antiga — nele `slice(10, 20)` numa lista de 3 devolve vazio, e a tabela
 * pisca no estado vazio antes do efeito corrigir. Ajustando aqui, o React
 * descarta esse render e refaz antes de tocar no DOM: nada chega a ser
 * pintado. É o padrão que a documentação do React recomenda para "ajustar
 * estado quando uma prop muda", e o motivo da regra de lint
 * `react-hooks/set-state-in-effect` existir.
 */
export function usePaginacao<T>(itens: T[], tamanhoDaPagina: number) {
  const [pagina, setPagina] = useState(1);
  const [listaAnterior, setListaAnterior] = useState(itens);

  // Reset durante o render, e nao num efeito: com `useEffect` existiria um
  // render com a lista nova e a pagina velha, em que `slice(10, 20)` numa
  // lista de 3 devolve vazio e a tabela pisca no estado vazio antes de
  // corrigir. Ajustando aqui, o React descarta este render e refaz antes de
  // tocar no DOM, entao o estado intermediario nunca aparece.
  if (itens !== listaAnterior) {
    setListaAnterior(itens);
    setPagina(1);
  }

  const itensDaPagina = useMemo(() => {
    const inicio = (pagina - 1) * tamanhoDaPagina;
    return itens.slice(inicio, inicio + tamanhoDaPagina);
  }, [itens, pagina, tamanhoDaPagina]);

  return { pagina, setPagina, itensDaPagina, total: itens.length };
}
