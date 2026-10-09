import type { ContaDaTela, Params } from "./notasapi";
import { criarHttp } from "./http";

/**
 * As chamadas da página de Inadimplência. Arquivo próprio, como `operacao.ts`: o
 * backend é o mesmo (`VITE_NOTAS_URL`), o assunto é outro.
 */
const baseURL =
  import.meta.env.VITE_NOTAS_URL || "https://tinyapi.healthsafetytech.com";
const api = criarHttp(baseURL);

export type CodigoDeStatus =
  | "sem_contato" | "em_contato" | "respondeu" | "promessa" | "quebrada"
  | "negociacao" | "contestado" | "juridico" | "perda" | "pago";

export type ChaveDeFaixa = "atraso" | "31_60" | "61_90" | "90_mais";

export interface Faixa { faixa: ChaveDeFaixa; titulos: number; empresas: number; valor: number }

export interface ResumoDeInadimplencia {
  total_a_receber: number;
  total_vencido: number;
  em_atraso: number;
  inadimplente: number;
  inadimplencia_carteira: number;
  recuperado: number | null;
  titulos_vencidos: number;
  titulos_inadimplentes: number;
  empresas_inadimplentes: number;
  faixas: Faixa[];
  sem_contato: number;
  promessas_7_dias: number;
  promessas_quebradas: number;
  em_negociacao: number;
}

export interface EmpresaDaLista {
  empresa: string;
  nome: string;
  documento: string | null;
  filiais: number;
  titulos: number;
  valor_devido: number;
  valor_inadimplente: number;
  maior_atraso: number;
  status: CodigoDeStatus | null;
  proxima_data: string | null;
  ultimo_contato: string | null;
}

export interface PaginaDeEmpresas { itens: EmpresaDaLista[]; total: number; limite: number; offset: number }

/** Qual data o período recorta: vencimento e emissão cortam títulos; promessa e contato, empresas. */
export type TipoDeData = "vencimento" | "emissao" | "promessa" | "contato";
/** "Sem contato há mais de": 7, 15 ou 30 dias, ou "nunca" contatado. */
export type SemContato = "7" | "15" | "30" | "nunca";

/** O recorte que a lista e os cards compartilham (a busca e a ordenação são só da lista). */
export interface FiltrosDoResumo extends Params {
  status?: CodigoDeStatus[];
  faixa?: ChaveDeFaixa;
  data_tipo?: TipoDeData;
  data_inicio?: string;
  data_fim?: string;
  sem_contato?: SemContato;
}

export interface FiltrosDeEmpresas extends FiltrosDoResumo {
  busca?: string;
  incluir_atraso?: boolean;
  ordenar_por?: string;
  direcao?: "asc" | "desc";
  limite?: number;
  offset?: number;
}

export interface Filial { cnpj: string; nome: string; titulos: number; valor_vencido: number }

export interface Ciclo {
  id: number;
  status: CodigoDeStatus;
  promessa_data: string | null;
  promessa_valor: number | null;
  promessa_condicoes: string | null;
  aberto_em: string;
  aberto_por: string;
  encerrado_em: string | null;
  ultimo_contato_em: string | null;
}

/** Anexo de um evento da cobrança (imagem ou PDF). O arquivo só sai por `baixarAnexo`, com o token. */
export interface AnexoDoEvento {
  id: number;
  nome_original: string;
  tipo: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  tamanho: number;
  enviado_por: string;
  enviado_em: string;
}

export interface Evento {
  id: number;
  ciclo_id: number;
  ocorrido_em: string;
  registrado_em: string;
  registrado_por: string;
  tipo: "contato" | "status" | "observacao" | "sistema";
  canal: string | null;
  filial_cnpj: string | null;
  status_anterior: CodigoDeStatus | null;
  status_novo: CodigoDeStatus | null;
  promessa_data: string | null;
  promessa_valor: number | null;
  promessa_condicoes: string | null;
  anotacao: string | null;
  valor_inadimplente: number | null;
  anexos: AnexoDoEvento[];
}

export interface DetalheDaEmpresa {
  empresa: string;
  nome: string;
  documento: string | null;
  valor_devido: number;
  valor_inadimplente: number;
  maior_atraso: number;
  telefone: string | null;
  email: string | null;
  observacao: string | null;
  observacao_por: string | null;
  observacao_em: string | null;
  filiais: Filial[];
  ciclo: Ciclo | null;
  ciclos_anteriores: Ciclo[];
  eventos: Evento[];
}

/** A resposta do registro de contato: o detalhe novo e o id do evento gravado (para os anexos). */
export interface DetalheComEventoNovo extends DetalheDaEmpresa { evento_id: number }

export interface PontoDeTaxa {
  valor: number;
  inadimplente: number;
  titulos: number;
  titulos_inadimplentes: number;
  taxa: number | null;
}
export interface MesDeTaxa extends PontoDeTaxa { mes: string; em_apuracao: boolean }
export interface AnoDeTaxa extends PontoDeTaxa { ano: number; ano_corrente: boolean }
/** As opções dos selects da aba Indicadores: da base inteira, sem os filtros, sem nulos nem vazios. */
export interface OpcoesDosIndicadores { categorias: string[]; formas_pagamento: string[]; ufs: string[] }
export interface Indicadores {
  mensal: MesDeTaxa[];
  anual: AnoDeTaxa[];
  total: PontoDeTaxa;
  desde: string | null;
  ultimo_fechado: MesDeTaxa | null;
  media_12_meses: number | null;
  opcoes: OpcoesDosIndicadores;
}

/** O recorte de TÍTULOS da aba Indicadores. Meses em `AAAA-MM`; listas vazias não vão; `__sem__` = nulo ou vazio. */
export interface FiltrosDeIndicadores extends Params {
  mes_inicio?: string;
  mes_fim?: string;
  categoria?: string[];
  forma_pagamento?: string[];
  uf?: string[];
  cliente?: string;
}

export interface NovoEvento {
  ocorrido_em: string;
  canal?: string | null;
  filial_cnpj?: string | null;
  status_novo?: CodigoDeStatus | null;
  promessa?: { data: string; valor?: number | null; condicoes?: string | null } | null;
  anotacao?: string | null;
}

const url = (empresa: string) => `/inadimplencia/empresas/${encodeURIComponent(empresa)}`;

export const fetchResumo = async (params: FiltrosDoResumo = {}) =>
  (await api.get<ResumoDeInadimplencia>("/inadimplencia/resumo", { params })).data;
export const fetchEmpresas = async (params: FiltrosDeEmpresas) =>
  (await api.get<PaginaDeEmpresas>("/inadimplencia/empresas", { params })).data;
export const fetchDetalhe = async (empresa: string) =>
  (await api.get<DetalheDaEmpresa>(url(empresa))).data;
export const fetchTitulos = async (empresa: string) =>
  (await api.get<ContaDaTela[]>(`${url(empresa)}/titulos`)).data;
export const fetchIndicadores = async (params: FiltrosDeIndicadores = {}) =>
  (await api.get<Indicadores>("/inadimplencia/indicadores", { params })).data;
export const registrarEvento = async (empresa: string, dados: NovoEvento) =>
  (await api.post<DetalheComEventoNovo>(`${url(empresa)}/eventos`, dados)).data;
export const gravarObservacao = async (empresa: string, texto: string) =>
  (await api.put<DetalheDaEmpresa>(`${url(empresa)}/observacao`, { texto })).data;

/** Envia de 1 a 5 arquivos para um evento (multipart, campo `arquivos` repetido). O axios deixa o
 *  navegador pôr o `Content-Type` com o boundary; o backend exige o Content-Length, que o navegador põe. */
export const enviarAnexos = async (eventoId: number, arquivos: File[]) => {
  const corpo = new FormData();
  arquivos.forEach((a) => corpo.append("arquivos", a, a.name));
  return (await api.post<AnexoDoEvento[]>(`/inadimplencia/eventos/${eventoId}/anexos`, corpo)).data;
};
/** O arquivo como Blob, buscado com o Bearer — não existe link público do anexo. */
export const baixarAnexo = async (anexoId: number) =>
  (await api.get<Blob>(`/inadimplencia/anexos/${anexoId}`, { responseType: "blob" })).data;
export const apagarAnexo = async (anexoId: number) => {
  await api.delete(`/inadimplencia/anexos/${anexoId}`);
};
