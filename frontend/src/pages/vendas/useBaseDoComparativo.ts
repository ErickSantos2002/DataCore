import { useEffect, useMemo, useState } from "react";

import { fetchResumoComercial } from "../../services/notasapi";
import {
  paramsDoRecorte,
  type RecorteComercial,
} from "../comercial/useComercial";
import type { IntervaloDeComparacao } from "./vendas";

/**
 * O total do período anterior equivalente, para o comparativo de Vendas com o
 * último período ainda aberto; `null` enquanto a busca não volta, se ela
 * falha, ou quando não há o que buscar (`intervalo` nulo).
 *
 * É uma segunda chamada ao mesmo resumo, com os filtros do recorte e as datas
 * deslocadas: a evolução vem por mês, sem dia, e "1 a 22 de setembro do ano
 * passado" não sai de soma de meses. Mora aqui, e não em
 * `comercial/useComercial.ts`, que é da outra frente — só `paramsDoRecorte`
 * vem de lá, para o filtro sair igual ao da busca principal.
 *
 * O estado guarda a QUAL pedido o total pertence, como `useResumoComercial`:
 * enquanto o recorte muda, o total velho não aparece ao lado do ponto novo, e
 * não há `setState` síncrono no corpo do efeito.
 */
export function useBaseDoComparativo(
  recorte: RecorteComercial,
  intervalo: IntervaloDeComparacao | null,
): number | null {
  const chave = useMemo(
    () =>
      intervalo
        ? JSON.stringify(
            paramsDoRecorte({
              ...recorte,
              dataInicio: intervalo.anterior.dataInicio,
              dataFim: intervalo.anterior.dataFim,
            }),
          )
        : null,
    [recorte, intervalo],
  );
  const [estado, setEstado] = useState<{
    chave: string;
    total: number | null;
  } | null>(null);

  useEffect(() => {
    if (!chave) return;
    let vivo = true;
    fetchResumoComercial(JSON.parse(chave))
      .then((resumo) => {
        const total = resumo.evolucao_mensal.reduce((a, m) => a + m.total, 0);
        if (vivo) setEstado({ chave, total });
      })
      .catch((falha) => {
        console.error(
          "Erro ao buscar o período anterior do comparativo:",
          falha,
        );
        // Sem base, a variação fica em traço: comparar com o período anterior
        // INTEIRO é justamente o número errado que isto veio consertar.
        if (vivo) setEstado({ chave, total: null });
      });
    return () => {
      vivo = false;
    };
  }, [chave]);

  return chave && estado?.chave === chave ? estado.total : null;
}
