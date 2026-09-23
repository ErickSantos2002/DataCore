import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchFiltrosComerciais,
  fetchResumoComercial,
  fetchVendas,
  type FiltrosComerciais,
  type PaginaDeVendas,
  type Params,
  type ResumoComercial,
} from "../../services/notasapi";

/**
 * O recorte que as quatro telas do Comercial cruzam.
 *
 * Cliente por **id** e produto por **codigo** — nao pelo rotulo que a tela
 * escreve. O rotulo era `${descricao} (${codigo})`, e era o que ia para o
 * filtro; como a lista de opcoes era um `Map` chaveado so pelo codigo, cada
 * codigo aparecia com uma unica grafia e as outras ficavam inalcancaveis.
 * Medido em 2026-09-09: 184 grafias para 127 produtos, 97 opcoes oferecidas,
 * e 35,5% do valor dos itens fora do alcance de quem filtrava por produto.
 */
export interface RecorteComercial {
  clientes: number[];
  vendedores: string[];
  /** Chaves de produto: o codigo, ou '#' + descricao quando nao ha codigo. */
  produtos: string[];
  dataInicio: string;
  dataFim: string;
}

export const RECORTE_VAZIO: RecorteComercial = {
  clientes: [],
  vendedores: [],
  produtos: [],
  dataInicio: "",
  dataFim: "",
};

/**
 * O recorte virado query string.
 *
 * Lista vazia e string vazia NAO viram parametro: `cliente_id=` chegaria ao
 * backend como um filtro de um item vazio, que nao casa com nada, e a tela
 * ficaria zerada em vez de completa.
 */
export function paramsDoRecorte(recorte: RecorteComercial): Params {
  const params: Params = {};
  if (recorte.clientes.length) params.cliente_id = recorte.clientes;
  if (recorte.vendedores.length) params.vendedor = recorte.vendedores;
  if (recorte.produtos.length) params.produto = recorte.produtos;
  if (recorte.dataInicio) params.data_inicio = recorte.dataInicio;
  if (recorte.dataFim) params.data_fim = recorte.dataFim;
  return params;
}

/** O resumo zerado — o que a tela desenha antes da primeira resposta e depois de uma falha. */
const RESUMO_VAZIO: ResumoComercial = {
  kpis: {
    faturamento: 0,
    faturamento_produtos: 0,
    notas: 0,
    ticket_medio: 0,
    maior_venda: 0,
    menor_venda: 0,
    desvio_padrao_venda: 0,
    itens: 0,
  },
  evolucao_mensal: [],
  evolucao_por_cliente: [],
  por_produto: [],
  por_vendedor: [],
  por_cliente: [],
};

/**
 * Os cinco recortes agregados, somados pelo banco.
 *
 * Substitui o `DataContext`, que baixava as 4.330 notas com os itens dentro
 * para cada tela refazer as mesmas contas no navegador. O que trafega agora
 * tem o tamanho do que a tela desenha, e nao o do historico da empresa.
 *
 * ⚠️ O numero nao muda por causa desta migracao: cada recorte foi conferido
 * contra a conta que a tela fazia, ao centavo (verificacao de 2026-09-09,
 * repositorio interno). O que muda e o filtro de produto, que passa a alcancar
 * todas as grafias de cada codigo.
 */
export function useResumoComercial(recorte: RecorteComercial): {
  resumo: ResumoComercial;
  /** Primeira carga: a tela ainda nao tem numero nenhum para mostrar. */
  carregando: boolean;
  /** Ha uma busca em andamento para um recorte mais novo que o que esta na tela. */
  atualizando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
} {
  // O estado guarda a QUAL recorte o resumo pertence. Com isso, "carregando" e
  // "atualizando" sao derivados em vez de mais um estado a manter em sincronia —
  // e nao ha `setCarregando(true)` no corpo do efeito, que dispara render em
  // cascata (regra `react-hooks/set-state-in-effect`).
  const [estado, setEstado] = useState<{
    chave: string;
    resumo: ResumoComercial;
    erro: string | null;
  } | null>(null);
  const [recarga, setRecarga] = useState(0);

  // A dependencia e o TEXTO dos parametros, e nao o objeto: `recorte` e
  // recriado a cada render da tela que o guarda em estado, e um objeto novo com
  // o mesmo conteudo dispararia uma busca por render.
  const chave = useMemo(
    () => JSON.stringify(paramsDoRecorte(recorte)),
    [recorte],
  );

  useEffect(() => {
    let vivo = true;
    fetchResumoComercial(JSON.parse(chave) as Params)
      .then((dados) => {
        if (vivo) setEstado({ chave, resumo: dados, erro: null });
      })
      .catch((falha) => {
        console.error("Erro ao buscar o resumo comercial:", falha);
        // Zerado, e nao o resultado anterior: numero velho ao lado de um aviso
        // de falha e pior que zero, porque parece atual.
        if (vivo) {
          setEstado({
            chave,
            resumo: RESUMO_VAZIO,
            erro: "Nao foi possivel carregar os dados do periodo.",
          });
        }
      });
    return () => {
      vivo = false;
    };
  }, [chave, recarga]);

  const recarregar = useCallback(async () => {
    setRecarga((n) => n + 1);
  }, []);

  return {
    // Enquanto o recorte novo nao chega, a tela segue mostrando o anterior: um
    // spinner de tela cheia a cada clique de filtro apagaria o grafico que a
    // pessoa esta comparando. O `atualizando` esta ai para quem quiser sinalizar
    // isso de forma discreta.
    resumo: estado?.resumo ?? RESUMO_VAZIO,
    carregando: estado === null,
    atualizando: estado === null || estado.chave !== chave,
    erro: estado?.erro ?? null,
    recarregar,
  };
}

/** As opcoes dos multiselects. Nao dependem do recorte: sao o universo das vendas. */
export function useFiltrosComerciais(): {
  opcoes: FiltrosComerciais;
  carregando: boolean;
} {
  const [opcoes, setOpcoes] = useState<FiltrosComerciais>({
    clientes: [],
    vendedores: [],
    produtos: [],
  });
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    fetchFiltrosComerciais()
      .then((dados) => {
        if (vivo) setOpcoes(dados);
      })
      .catch((falha) => console.error("Erro ao buscar as opcoes de filtro:", falha))
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  return { opcoes, carregando };
}

/**
 * As colunas por que a tabela pode ordenar.
 *
 * Lista fechada, e igual à do backend: o `ORDER BY` é a única parte da consulta
 * que não pode ser bind param, então o que entra ali sai de um dicionário e
 * nunca do texto que chega na query string.
 *
 * `valor` é o total da nota e `valor_produtos` é só a mercadoria — Vendedores
 * ordena pelo segundo, porque é o que ela soma.
 */
export type CampoDeOrdenacao =
  | "data_emissao"
  | "cliente"
  | "valor"
  | "valor_produtos"
  | "vendedor"
  | "numero"
  | "tipo";

export interface PedidoDaTabela {
  busca: string;
  ordenarPor: CampoDeOrdenacao;
  direcao: "asc" | "desc";
  pagina: number;
  porPagina: number;
}

const PAGINA_VAZIA: PaginaDeVendas = {
  itens: [],
  total: 0,
  valor_total: 0,
  limite: 0,
  offset: 0,
};

/**
 * Uma pagina da tabela de notas, filtrada, buscada e ordenada pelo banco.
 *
 * A ordenacao vai junto de proposito: ordenar no navegador so ordena o que
 * chegou, e com paginacao no servidor isso significaria "as cem mais recentes,
 * ordenadas por valor" — que parece o ranking de valor e nao e.
 */
export function useVendasPaginadas(
  recorte: RecorteComercial,
  pedido: PedidoDaTabela,
): {
  pagina: PaginaDeVendas;
  carregando: boolean;
  atualizando: boolean;
  erro: string | null;
} {
  const [estado, setEstado] = useState<{
    chave: string;
    pagina: PaginaDeVendas;
    erro: string | null;
  } | null>(null);

  const chave = useMemo(
    () =>
      JSON.stringify({
        ...paramsDoRecorte(recorte),
        busca: pedido.busca.trim() || undefined,
        ordenar_por: pedido.ordenarPor,
        direcao: pedido.direcao,
        limite: pedido.porPagina,
        offset: Math.max(0, (pedido.pagina - 1) * pedido.porPagina),
      }),
    [recorte, pedido],
  );

  useEffect(() => {
    let vivo = true;
    fetchVendas(JSON.parse(chave) as Params)
      .then((dados) => {
        if (vivo) setEstado({ chave, pagina: dados, erro: null });
      })
      .catch((falha) => {
        console.error("Erro ao buscar as notas:", falha);
        if (vivo) {
          setEstado({
            chave,
            pagina: PAGINA_VAZIA,
            erro: "Nao foi possivel carregar as notas.",
          });
        }
      });
    return () => {
      vivo = false;
    };
  }, [chave]);

  return {
    pagina: estado?.pagina ?? PAGINA_VAZIA,
    carregando: estado === null,
    atualizando: estado === null || estado.chave !== chave,
    erro: estado?.erro ?? null,
  };
}
