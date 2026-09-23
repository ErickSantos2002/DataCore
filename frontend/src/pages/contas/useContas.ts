import { useEffect, useMemo, useState } from "react";

import {
  fetchPaginaDeContas,
  fetchResumoDeContas,
  type FiltrosDeContasAPI,
  type PaginaDeContas,
  type Params,
  type ResumoDeContas,
  type TipoDeContas,
} from "../../services/notasapi";
import type { FiltrosDeContas, Ordenacao } from "./contas";
import { ITENS_POR_PAGINA } from "./contas";

/**
 * O que as duas telas de Contas desenham, somado pelo banco.
 *
 * Substitui o `ContasPagarContext` e o `ContasReceberContext`, que baixavam a
 * tabela inteira para a tela calcular KPI, evolucao, pizza e ranking no
 * navegador. Medido em 2026-09-09: **7,9 MB** e **11,2 MB** por abertura — as
 * duas respostas mais pesadas do sistema.
 *
 * As tres grandezas de uma conta (quitado, aberto, faturado) passaram a viver
 * em `core/contas_agregado.py`, escritas uma vez para as duas telas. O que
 * ficou aqui e desenho: escolher entre evolucao anual e mensal, cortar a pizza
 * em sete fatias mais "Outros" e o top dez do ranking.
 */

const RESUMO_VAZIO: ResumoDeContas = {
  kpis: {
    total_aberto: 0,
    total_quitado: 0,
    contas_vencidas: 0,
    a_vencer_30: 0,
    media_mensal: 0,
    contas: 0,
  },
  por_ano: [],
  por_mes: [],
  por_categoria: [],
  por_contraparte: [],
  opcoes: { situacao: [], categoria: [], contraparte: [] },
};

const PAGINA_VAZIA: PaginaDeContas = {
  itens: [],
  total: 0,
  total_aberto: 0,
  total_quitado: 0,
  limite: 0,
  offset: 0,
};

/**
 * Os filtros da tela virados query string.
 *
 * Lista vazia e string vazia NAO viram parametro: `categoria=` chegaria ao
 * backend como um filtro de um item vazio, que nao casa com nada, e a tela
 * ficaria zerada em vez de completa.
 */
export function paramsDosFiltros(filtros: FiltrosDeContas): FiltrosDeContasAPI {
  const params: FiltrosDeContasAPI = {};
  if (filtros.situacao.length) params.situacao = filtros.situacao;
  if (filtros.categoria.length) params.categoria = filtros.categoria;
  if (filtros.contraparte.length) params.contraparte = filtros.contraparte;
  if (filtros.dataInicio) params.data_inicio = filtros.dataInicio;
  if (filtros.dataFim) params.data_fim = filtros.dataFim;
  return params;
}

export function useResumoDeContas(
  tipo: TipoDeContas,
  filtros: FiltrosDeContas,
): {
  resumo: ResumoDeContas;
  carregando: boolean;
  erro: string | null;
} {
  // O estado guarda a QUAL recorte o resumo pertence: assim "carregando" e
  // derivado em vez de mais um estado a manter em sincronia, e nao ha
  // `setCarregando(true)` no corpo do efeito, que dispara render em cascata.
  const [estado, setEstado] = useState<{
    chave: string;
    resumo: ResumoDeContas;
    erro: string | null;
  } | null>(null);

  const chave = useMemo(
    () => JSON.stringify(paramsDosFiltros(filtros)),
    [filtros],
  );

  useEffect(() => {
    let vivo = true;
    fetchResumoDeContas(tipo, JSON.parse(chave) as FiltrosDeContasAPI)
      .then((dados) => {
        if (vivo) setEstado({ chave, resumo: dados, erro: null });
      })
      .catch((falha) => {
        console.error(`Erro ao buscar o resumo de ${tipo}:`, falha);
        // Zerado, e nao o resultado anterior: numero velho ao lado de um aviso
        // de falha e pior que zero, porque parece atual.
        if (vivo) {
          setEstado({
            chave,
            resumo: RESUMO_VAZIO,
            erro:
              tipo === "contas_pagar"
                ? "Não foi possível carregar as contas a pagar."
                : "Não foi possível carregar as contas a receber.",
          });
        }
      });
    return () => {
      vivo = false;
    };
  }, [tipo, chave]);

  return {
    resumo: estado?.resumo ?? RESUMO_VAZIO,
    carregando: estado === null,
    erro: estado?.erro ?? null,
  };
}

export function usePaginaDeContas(
  tipo: TipoDeContas,
  filtros: FiltrosDeContas,
  pesquisa: string,
  ordenacao: Ordenacao,
  pagina: number,
): { pagina: PaginaDeContas; carregando: boolean; erro: string | null } {
  const [estado, setEstado] = useState<{
    chave: string;
    pagina: PaginaDeContas;
    erro: string | null;
  } | null>(null);

  const chave = useMemo(
    () =>
      JSON.stringify({
        ...paramsDosFiltros(filtros),
        busca: pesquisa.trim() || undefined,
        ordenar_por: ordenacao.campo,
        direcao: ordenacao.direcao,
        limite: ITENS_POR_PAGINA,
        offset: Math.max(0, (pagina - 1) * ITENS_POR_PAGINA),
      }),
    [filtros, pesquisa, ordenacao, pagina],
  );

  useEffect(() => {
    let vivo = true;
    fetchPaginaDeContas(tipo, JSON.parse(chave) as Params)
      .then((dados) => {
        if (vivo) setEstado({ chave, pagina: dados, erro: null });
      })
      .catch((falha) => {
        console.error(`Erro ao buscar a pagina de ${tipo}:`, falha);
        if (vivo) {
          setEstado({
            chave,
            pagina: PAGINA_VAZIA,
            erro: "Não foi possível carregar a tabela.",
          });
        }
      });
    return () => {
      vivo = false;
    };
  }, [tipo, chave]);

  return {
    pagina: estado?.pagina ?? PAGINA_VAZIA,
    carregando: estado === null,
    erro: estado?.erro ?? null,
  };
}

/**
 * TODAS as contas do recorte, pagina a pagina — so para a planilha.
 *
 * A exportacao sempre levou a lista filtrada inteira, e nao a pagina visivel.
 * Exportar so o que esta na tela seria o mesmo erro de ler a primeira pagina
 * como se fosse o total, num arquivo que alguem manda por e-mail.
 */
export async function todasAsContas(
  tipo: TipoDeContas,
  filtros: FiltrosDeContas,
  pesquisa: string,
  ordenacao: Ordenacao,
): Promise<PaginaDeContas["itens"]> {
  const porPagina = 1000;
  const todas: PaginaDeContas["itens"] = [];
  let offset = 0;
  for (;;) {
    const resposta = await fetchPaginaDeContas(tipo, {
      ...paramsDosFiltros(filtros),
      busca: pesquisa.trim() || undefined,
      ordenar_por: ordenacao.campo,
      direcao: ordenacao.direcao,
      limite: porPagina,
      offset,
    });
    todas.push(...resposta.itens);
    offset += porPagina;
    if (offset >= resposta.total) return todas;
  }
}
