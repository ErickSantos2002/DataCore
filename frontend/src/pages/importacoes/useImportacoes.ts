import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchExecucoes,
  fetchImportacoes,
  type Execucao,
  type FiltroDeExecucoes,
  type Importacao,
} from "../../services/operacao";
import type { FiltroDoHistorico } from "./HistoricoDeExecucoes";

/**
 * Os dados da tela de Importações: os cartões e o histórico, buscados
 * separadamente porque mudam por motivos diferentes.
 *
 * Os cartões se atualizam sozinhos a cada minuto — é uma tela que alguém deixa
 * aberta justamente quando está esperando uma carga terminar, e ter que apertar
 * F5 para saber se acabou tira metade da utilidade. O histórico não: ele é
 * consulta, e recarregar por baixo de quem está lendo a linha do dia 15 é pior
 * do que deixar parado.
 *
 * O estado guarda **a que recorte** o dado pertence, e `carregando` sai daí em
 * vez de ser um `useState` próprio — é o padrão de `useServicos`, e o que
 * mantém o hook sem `setState` no corpo do efeito.
 */

const INTERVALO_DE_ATUALIZACAO = 60_000;

export const FILTRO_VAZIO: FiltroDoHistorico = {
  job: "",
  de: "",
  ate: "",
  origem: "",
  apenasProblemas: false,
};

export const TAMANHO_DA_PAGINA = 25;

interface EstadoDosCartoes {
  importacoes: Importacao[];
  erro: string | null;
}

interface EstadoDoHistorico {
  chave: string;
  execucoes: Execucao[];
  total: number;
}

function paramsDoFiltro(
  filtro: FiltroDoHistorico,
  pagina: number,
): FiltroDeExecucoes {
  return {
    job: filtro.job || undefined,
    de: filtro.de || undefined,
    ate: filtro.ate || undefined,
    origem: filtro.origem || undefined,
    apenasProblemas: filtro.apenasProblemas || undefined,
    pagina,
    tamanho: TAMANHO_DA_PAGINA,
  };
}

export function useImportacoes() {
  const [cartoes, setCartoes] = useState<EstadoDosCartoes | null>(null);
  const [historico, setHistorico] = useState<EstadoDoHistorico | null>(null);
  const [pagina, setPagina] = useState(1);
  const [filtro, setFiltro] = useState<FiltroDoHistorico>(FILTRO_VAZIO);

  // O fetch com `.then` dentro do próprio efeito, e não uma função `async`
  // chamada dali, é o que o `react-hooks/set-state-in-effect` aceita — e é o
  // mesmo desenho de `useServicos`. Com `await`, o lint vê o `setState` como
  // se fosse síncrono no corpo do efeito e reprova.
  useEffect(() => {
    let vivo = true;

    const buscar = () => {
      fetchImportacoes()
        .then((dados) => {
          if (vivo) setCartoes({ importacoes: dados, erro: null });
        })
        .catch((falha) => {
          console.error("Erro ao buscar as importações:", falha);
          // Mantém na tela o último estado conhecido e avisa que ele
          // envelheceu. Apagar os cartões por uma falha de rede esconderia
          // justamente a carga com problema que a pessoa veio ver — e a
          // mensagem fala do que ela perdeu, não do erro de rede.
          if (vivo) {
            setCartoes((anterior) => ({
              importacoes: anterior?.importacoes ?? [],
              erro: "Não consegui falar com o servidor — o que está na tela pode estar desatualizado.",
            }));
          }
        });
    };

    buscar();
    const id = setInterval(buscar, INTERVALO_DE_ATUALIZACAO);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);

  const chave = useMemo(
    () => JSON.stringify(paramsDoFiltro(filtro, pagina)),
    [filtro, pagina],
  );

  useEffect(() => {
    let vivo = true;
    fetchExecucoes(JSON.parse(chave) as FiltroDeExecucoes)
      .then((resposta) => {
        // `vivo` protege da resposta lenta de um filtro já trocado: sem isto,
        // quem filtra rápido vê a lista do recorte anterior sobrescrever a do
        // recorte pedido.
        if (vivo) {
          setHistorico({
            chave,
            execucoes: resposta.itens,
            total: resposta.total,
          });
        }
      })
      .catch((falha) => {
        console.error("Erro ao buscar o histórico de execuções:", falha);
        if (vivo) setHistorico({ chave, execucoes: [], total: 0 });
      });
    return () => {
      vivo = false;
    };
  }, [chave]);

  /** Trocar o filtro volta para a primeira página — senão a tela abre vazia. */
  const trocarFiltro = useCallback((novo: FiltroDoHistorico) => {
    setFiltro(novo);
    setPagina(1);
  }, []);

  return {
    importacoes: cartoes?.importacoes ?? [],
    carregandoCartoes: cartoes === null,
    erro: cartoes?.erro ?? null,
    execucoes: historico?.execucoes ?? [],
    total: historico?.total ?? 0,
    pagina,
    setPagina,
    // Enquanto a chave do estado não for a chave pedida, o que está na tela é
    // do recorte anterior — e a tabela deve dizer que está buscando.
    carregandoHistorico: historico === null || historico.chave !== chave,
    filtro,
    trocarFiltro,
  };
}
