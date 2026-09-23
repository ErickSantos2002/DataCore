import { useEffect, useMemo, useState } from "react";

import {
  fetchNotasServico,
  fetchResumoDeServicos,
  type PaginaDeServicos,
  type Params,
  type ResumoDeServicos,
} from "../../services/notasapi";

/**
 * O que a tela de Servicos desenha, somado pelo banco.
 *
 * Substitui o `ServicosContext`, que baixava as 5.004 notas para a tela
 * calcular KPI, evolucao mensal, ranking de cliente e distribuicao por cidade
 * no navegador (item 9.4).
 *
 * O que ficou na tela e o que sempre foi desenho: a troca para escala anual
 * acima de 24 meses, o corte do top dez e o rotulo abreviado do grafico.
 */

export interface RecorteDeServicos {
  /** Rotulos `Razao social (documento)`, como o multiselect os mostra. */
  clientes: string[];
  /** Rotulos `Cidade/UF`. */
  cidades: string[];
  /** Os 50 primeiros caracteres da discriminacao. */
  tipos: string[];
  dataInicio: string;
  dataFim: string;
}

export const RECORTE_VAZIO: RecorteDeServicos = {
  clientes: [],
  cidades: [],
  tipos: [],
  dataInicio: "",
  dataFim: "",
};

export function paramsDoRecorte(recorte: RecorteDeServicos): Params {
  const params: Params = {};
  if (recorte.clientes.length) params.cliente = recorte.clientes;
  if (recorte.cidades.length) params.cidade = recorte.cidades;
  if (recorte.tipos.length) params.tipo = recorte.tipos;
  if (recorte.dataInicio) params.data_inicio = recorte.dataInicio;
  if (recorte.dataFim) params.data_fim = recorte.dataFim;
  return params;
}

const RESUMO_VAZIO: ResumoDeServicos = {
  kpis: { faturamento: 0, notas: 0, ticket_medio: 0 },
  evolucao_mensal: [],
  por_cliente: [],
  por_cidade: [],
  opcoes: { clientes: [], cidades: [], tipos: [] },
};

const PAGINA_VAZIA: PaginaDeServicos = {
  itens: [],
  total: 0,
  valor_total: 0,
  limite: 0,
  offset: 0,
};

export function useResumoDeServicos(recorte: RecorteDeServicos): {
  resumo: ResumoDeServicos;
  carregando: boolean;
  erro: string | null;
} {
  // O estado guarda a QUAL recorte o resumo pertence: "carregando" vira
  // derivado, e nao ha `setState` no corpo do efeito.
  const [estado, setEstado] = useState<{
    chave: string;
    resumo: ResumoDeServicos;
    erro: string | null;
  } | null>(null);

  const chave = useMemo(() => JSON.stringify(paramsDoRecorte(recorte)), [recorte]);

  useEffect(() => {
    let vivo = true;
    fetchResumoDeServicos(JSON.parse(chave) as Params)
      .then((dados) => {
        if (vivo) setEstado({ chave, resumo: dados, erro: null });
      })
      .catch((falha) => {
        console.error("Erro ao buscar o resumo de servicos:", falha);
        if (vivo) {
          setEstado({
            chave,
            resumo: RESUMO_VAZIO,
            erro: "Não foi possível carregar as notas de serviço.",
          });
        }
      });
    return () => {
      vivo = false;
    };
  }, [chave]);

  return {
    resumo: estado?.resumo ?? RESUMO_VAZIO,
    carregando: estado === null,
    erro: estado?.erro ?? null,
  };
}

export interface PedidoDaTabelaDeServicos {
  busca: string;
  ordenarPor: "numero" | "data_emissao" | "cliente" | "cidade" | "valor";
  direcao: "asc" | "desc";
  pagina: number;
  porPagina: number;
}

export function usePaginaDeServicos(
  recorte: RecorteDeServicos,
  pedido: PedidoDaTabelaDeServicos,
): { pagina: PaginaDeServicos; carregando: boolean; erro: string | null } {
  const [estado, setEstado] = useState<{
    chave: string;
    pagina: PaginaDeServicos;
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
    fetchNotasServico(JSON.parse(chave) as Params)
      .then((dados) => {
        if (vivo) setEstado({ chave, pagina: dados, erro: null });
      })
      .catch((falha) => {
        console.error("Erro ao buscar as notas de servico:", falha);
        if (vivo) {
          setEstado({
            chave,
            pagina: PAGINA_VAZIA,
            erro: "Não foi possível carregar as notas de serviço.",
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
    erro: estado?.erro ?? null,
  };
}

/**
 * TODAS as notas do recorte, pagina a pagina — so para exportar.
 *
 * A planilha e o PDF sempre levaram a lista filtrada inteira. Exportar so a
 * pagina visivel seria ler a primeira pagina como se fosse o total, num arquivo
 * que alguem manda por e-mail.
 */
export async function todosOsServicos(
  recorte: RecorteDeServicos,
  pedido: Pick<PedidoDaTabelaDeServicos, "busca" | "ordenarPor" | "direcao">,
): Promise<PaginaDeServicos["itens"]> {
  const porPagina = 1000;
  const todas: PaginaDeServicos["itens"] = [];
  let offset = 0;
  for (;;) {
    const resposta = await fetchNotasServico({
      ...paramsDoRecorte(recorte),
      busca: pedido.busca.trim() || undefined,
      ordenar_por: pedido.ordenarPor,
      direcao: pedido.direcao,
      limite: porPagina,
      offset,
    });
    todas.push(...resposta.itens);
    offset += porPagina;
    if (offset >= resposta.total) return todas;
  }
}
