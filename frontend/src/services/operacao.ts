import { criarHttp } from "./http";

/**
 * As chamadas da tela de Importações.
 *
 * Arquivo próprio, e não mais uma seção do `notasapi.ts`, porque o assunto é
 * outro: aqui não se lê dado de negócio nenhum — nem nota, nem valor, nem
 * cliente. Só se pergunta se as cargas que trazem esses dados rodaram.
 *
 * O backend é o mesmo (`VITE_NOTAS_URL`), então a instância se cria igual: o
 * interceptor do token mora em `criarHttp`.
 */

const baseURL =
  import.meta.env.VITE_NOTAS_URL || "https://tinyapi.healthsafetytech.com";

const api = criarHttp(baseURL);

/** Estados que a view `operacao.avisos_cargas` sabe atribuir. */
export type EstadoDaImportacao =
  | "ok"
  | "rodando"
  | "falha"
  | "inacabada"
  | "atrasada"
  | "sem_registro";

export interface Importacao {
  job: string;
  rotulo: string;
  descricao: string;
  fonte: string;
  /** Horários em UTC, no formato "04:00". A tela converte para Brasília. */
  horarios: string[];
  unidade_systemd: string;
  ativo: boolean;
  ordem: number;

  estado: EstadoDaImportacao | null;
  mensagem: string | null;

  ultima_execucao_id: number | null;
  ultimo_inicio: string | null;
  ultimo_fim: string | null;
  ultimo_resultado: string | null;
  ultimos_erros: number | null;
  ultimas_contagens: Record<string, unknown> | null;
  ultima_duracao_seg: number | null;

  proxima_execucao: string | null;

  /**
   * Quantas execuções sustentam a mediana. Vem junto de propósito: número
   * calculado sobre três execuções não merece a mesma confiança que um
   * calculado sobre trinta, e a tela mostra a diferença em vez de esconder.
   */
  execucoes_na_media: number;
  duracao_mediana_seg: number | null;
  duracao_min_seg: number | null;
  duracao_max_seg: number | null;
  execucoes_30d: number;
  falhas_30d: number;
}

export interface Execucao {
  id: number;
  job: string;
  inicio: string;
  fim: string | null;
  resultado: string | null;
  erros: number;
  contagens: Record<string, unknown>;
  detalhe: string | null;
  argumentos: string | null;
  /** `agendada` = o timer disparou; `manual` = alguém rodou à mão. */
  origem: "agendada" | "manual";
  duracao_seg: number | null;
}

export interface PaginaDeExecucoes {
  itens: Execucao[];
  /** Do FILTRO, não da página — é o que impede a tela de somar a página. */
  total: number;
}

export interface FiltroDeExecucoes {
  job?: string;
  /** Dia em horário de Brasília, "2026-09-15". O backend converte antes de cortar. */
  de?: string;
  ate?: string;
  origem?: "agendada" | "manual";
  apenasProblemas?: boolean;
  pagina?: number;
  tamanho?: number;
}

export async function fetchImportacoes(): Promise<Importacao[]> {
  const response = await api.get<Importacao[]>("/operacao/importacoes");
  return response.data;
}

export async function fetchExecucoes(
  filtro: FiltroDeExecucoes = {},
): Promise<PaginaDeExecucoes> {
  const params: Record<string, unknown> = {};
  if (filtro.job) params.job = filtro.job;
  if (filtro.de) params.de = filtro.de;
  if (filtro.ate) params.ate = filtro.ate;
  if (filtro.origem) params.origem = filtro.origem;
  if (filtro.apenasProblemas) params.apenas_problemas = true;
  if (filtro.pagina) params.pagina = filtro.pagina;
  if (filtro.tamanho) params.tamanho = filtro.tamanho;

  const response = await api.get<PaginaDeExecucoes>("/operacao/execucoes", {
    params,
  });
  return response.data;
}
