import { useCallback, useEffect, useState } from "react";

import { fetchFaturamentoMensal } from "../../services/notasapi";
import { ANOS, seriesDaApi, type FaturamentoDaJanela } from "./financeiro";

/**
 * O faturamento da janela da tela, somado pelo banco.
 *
 * Substitui o `VendasContext`, que baixava as 4.352 notas de venda inteiras —
 * com cliente, itens, marcadores e endereços dentro, cerca de 9,7 MB — para a
 * tela somar doze números por ano no navegador. Agora são sessenta linhas.
 *
 * É um hook, e não mais um provider no roteador, porque o dado tem exatamente
 * um consumidor: esta tela. Estado global que só uma tela lê é um provider a
 * mais para montar em toda navegação, e um lugar a mais onde procurar quando o
 * número estiver errado.
 *
 * ⚠️ O número que sai daqui é o da régua do `gold`, e ele **difere** do que a
 * tela mostrava antes: 2023 sobe 7,2% porque quatro notas de exportação
 * passaram a contar, e 2024 cai 3,9% porque onze notas devolvidas ou
 * rejeitadas pararam. O efeito na variação ano a ano é bem maior que no
 * total — 2024 sai de +26,5% para +13,4%. A explicação completa está no
 * repositório interno, em `docs/09-comparacao-reguas.md`.
 */
export function useFaturamento(): FaturamentoDaJanela & {
  carregando: boolean;
  /** A mensagem de falha da última busca, ou `null` quando deu certo. */
  erro: string | null;
  recarregar: () => Promise<void>;
} {
  const [dados, setDados] = useState<FaturamentoDaJanela>(() =>
    seriesDaApi([]),
  );
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // A busca da montagem não liga `carregando` — ele já começa ligado, e
  // ligar de novo dentro do efeito é o que a regra `set-state-in-effect`
  // acusa —, e os setters moram no `.then`: depois de um `await` a regra os
  // lê como síncronos. Quem recarrega à mão passa pela função de baixo.
  const buscar = useCallback(
    () =>
      fetchFaturamentoMensal(ANOS[0], ANOS[ANOS.length - 1]).then(
        (linhas) => {
          setDados(seriesDaApi(linhas));
          setErro(null);
          setCarregando(false);
        },
        (falha) => {
          console.error("Erro ao buscar o faturamento:", falha);
          // Séries zeradas, e não as anteriores: uma tela que mostra o número
          // velho junto do aviso de falha é pior que uma que mostra zero,
          // porque o número velho parece atual.
          setDados(seriesDaApi([]));
          setErro("Não foi possível carregar o faturamento.");
          setCarregando(false);
        },
      ),
    [],
  );

  const recarregar = useCallback(async () => {
    setCarregando(true);
    await buscar();
  }, [buscar]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  return { ...dados, carregando, erro, recarregar };
}
