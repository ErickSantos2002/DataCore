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

export interface FiltrosDeEmpresas extends Params {
  busca?: string;
  status?: CodigoDeStatus[];
  faixa?: ChaveDeFaixa;
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

export interface PontoDeTaxa {
  valor: number;
  inadimplente: number;
  titulos: number;
  titulos_inadimplentes: number;
  taxa: number | null;
}
export interface MesDeTaxa extends PontoDeTaxa { mes: string; em_apuracao: boolean }
export interface AnoDeTaxa extends PontoDeTaxa { ano: number; ano_corrente: boolean }
export interface Indicadores {
  mensal: MesDeTaxa[];
  anual: AnoDeTaxa[];
  total: PontoDeTaxa;
  desde: string | null;
  ultimo_fechado: MesDeTaxa | null;
  media_12_meses: number | null;
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

export const fetchResumo = async () =>
  (await api.get<ResumoDeInadimplencia>("/inadimplencia/resumo")).data;
export const fetchEmpresas = async (params: FiltrosDeEmpresas) =>
  (await api.get<PaginaDeEmpresas>("/inadimplencia/empresas", { params })).data;
export const fetchDetalhe = async (empresa: string) =>
  (await api.get<DetalheDaEmpresa>(url(empresa))).data;
export const fetchTitulos = async (empresa: string) =>
  (await api.get<ContaDaTela[]>(`${url(empresa)}/titulos`)).data;
export const fetchIndicadores = async () =>
  (await api.get<Indicadores>("/inadimplencia/indicadores")).data;
export const registrarEvento = async (empresa: string, dados: NovoEvento) =>
  (await api.post<DetalheDaEmpresa>(`${url(empresa)}/eventos`, dados)).data;
export const gravarObservacao = async (empresa: string, texto: string) =>
  (await api.put<DetalheDaEmpresa>(`${url(empresa)}/observacao`, { texto })).data;
