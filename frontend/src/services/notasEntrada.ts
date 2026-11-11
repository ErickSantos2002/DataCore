import { criarHttp } from "./http";

/**
 * As chamadas da aba Notas de Entrada (Gerenciamento Financeiro). O backend é o
 * mesmo das notas (`VITE_NOTAS_URL`); a regra de o que é entrada — CFOP do item
 * começando em 1, 2 ou 3 — mora lá, em `core/notas_entrada.py`.
 */
const baseURL =
  import.meta.env.VITE_NOTAS_URL || "https://tinyapi.healthsafetytech.com";
const api = criarHttp(baseURL);

export type TipoDeEntrada = "compra" | "devolucao" | "conserto" | "outras";
export type SituacaoDeEntrada =
  | "emitida"
  | "registrada"
  | "pendente"
  | "cancelada";

export interface RecorteDeEntradas {
  data_inicio?: string;
  data_fim?: string;
  situacao?: SituacaoDeEntrada[];
  tipo?: TipoDeEntrada[];
  busca?: string;
}

export interface ResumoDeEntradas {
  quantidade: number;
  valor_total: number;
  remetentes: number;
  importacao_quantidade: number;
  importacao_valor: number;
  por_tipo: { tipo: TipoDeEntrada; quantidade: number; valor: number }[];
  por_mes: { mes: string; quantidade: number; valor: number }[];
  maiores_remetentes: {
    remetente: string;
    uf: string | null;
    quantidade: number;
    valor: number;
  }[];
  por_situacao: { situacao: SituacaoDeEntrada; quantidade: number }[];
}

export interface NotaDeEntrada {
  id: number;
  numero: string | null;
  serie: string | null;
  data_emissao: string | null;
  remetente: string;
  cpf_cnpj: string | null;
  uf: string | null;
  tipo: TipoDeEntrada;
  importacao: boolean;
  situacao: SituacaoDeEntrada;
  descricao_situacao: string | null;
  natureza_operacao: string | null;
  cfop: string;
  chave_acesso: string | null;
  valor: number;
}

export interface PaginaDeEntradas {
  itens: NotaDeEntrada[];
  total: number;
  limite: number;
  offset: number;
}

export interface ItemDaEntrada {
  id: number;
  codigo: string | null;
  descricao: string | null;
  unidade: string | null;
  ncm: string | null;
  cfop: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

export async function fetchResumoDeEntradas(
  recorte: RecorteDeEntradas,
): Promise<ResumoDeEntradas> {
  const resposta = await api.get<ResumoDeEntradas>("/notas_entrada/resumo", {
    params: recorte,
  });
  return resposta.data;
}

export async function fetchPaginaDeEntradas(
  recorte: RecorteDeEntradas & {
    ordenar_por?: string;
    direcao?: "asc" | "desc";
    limite?: number;
    offset?: number;
  },
): Promise<PaginaDeEntradas> {
  const resposta = await api.get<PaginaDeEntradas>("/notas_entrada/pagina", {
    params: recorte,
  });
  return resposta.data;
}

export async function fetchItensDaEntrada(
  idNota: number,
): Promise<ItemDaEntrada[]> {
  const resposta = await api.get<ItemDaEntrada[]>(
    `/notas_entrada/${idNota}/itens`,
  );
  return resposta.data;
}
