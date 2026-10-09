import type { BadgeProps } from "../../design-system/ui/core/Badge";
import { dataDeCalendario, diaLocal } from "../../lib/datas";
import type { ChaveDeFaixa, CodigoDeStatus, EmpresaDaLista } from "../../services/inadimplencia";

/**
 * A regra da página de Inadimplência que não depende de desenho. Os números vêm
 * somados do backend (`core/inadimplencia.py`); aqui ficam rótulo, cor e formato.
 */

export const STATUS: Record<CodigoDeStatus, { rotulo: string; variante: NonNullable<BadgeProps["variant"]> }> = {
  sem_contato: { rotulo: "Sem contato", variante: "muted" },
  em_contato: { rotulo: "Em contato", variante: "info" },
  respondeu: { rotulo: "Respondeu", variante: "info" },
  promessa: { rotulo: "Promessa de pagamento", variante: "primary" },
  quebrada: { rotulo: "Promessa quebrada", variante: "danger" },
  negociacao: { rotulo: "Em negociação", variante: "warning" },
  contestado: { rotulo: "Contestado", variante: "warning" },
  juridico: { rotulo: "Jurídico / Protesto", variante: "danger" },
  perda: { rotulo: "Perda", variante: "secondary" },
  pago: { rotulo: "Pago", variante: "success" },
};

/** Os que o financeiro escolhe — os outros três só o sistema põe. */
export const STATUS_MANUAIS: CodigoDeStatus[] = [
  "em_contato", "respondeu", "promessa", "negociacao", "contestado", "juridico", "perda",
];

export const CANAIS = [
  { value: "telefone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "presencial", label: "Presencial" },
  { value: "outro", label: "Outro" },
];

/** As quatro faixas, na ordem da barra. Âmbar é atraso; vermelho escurece com a idade. */
export const FAIXAS: { chave: ChaveDeFaixa; rotulo: string; cor: string; tipo: string }[] = [
  { chave: "atraso", rotulo: "1–30 dias", cor: "var(--color-warning-500)", tipo: "Atraso" },
  { chave: "31_60", rotulo: "31–60 dias", cor: "var(--color-danger-400)", tipo: "Inadimplente" },
  { chave: "61_90", rotulo: "61–90 dias", cor: "var(--color-danger-600)", tipo: "Inadimplente" },
  { chave: "90_mais", rotulo: "Mais de 90 dias", cor: "var(--color-danger-700)", tipo: "Inadimplente" },
];

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIA = 86_400_000;

function meiaNoite(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function diasDeAtraso(vencimento: string | null, hoje: Date): number {
  if (!vencimento) return 0;
  const [a, m, d] = vencimento.slice(0, 10).split("-").map(Number);
  const dias = Math.round((meiaNoite(hoje) - new Date(a, m - 1, d).getTime()) / DIA);
  return Math.max(0, dias);
}

export function haQuantosDias(iso: string | null, agora: Date): string {
  if (!iso) return "nunca";
  const dias = Math.round((meiaNoite(agora) - meiaNoite(new Date(iso))) / DIA);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

export function formatarPercentual(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function nomeDoMes(mes: string): string {
  const [a, m] = mes.split("-");
  return `${MESES[Number(m) - 1]}/${a.slice(2)}`;
}

export function linhasDaPlanilhaDeEmpresas(empresas: EmpresaDaLista[]): Record<string, unknown>[] {
  return empresas.map((e) => ({
    Empresa: e.nome,
    "CNPJ/CPF": e.documento ?? "",
    Filiais: e.filiais,
    Títulos: e.titulos,
    "Valor devido": e.valor_devido,
    "Valor inadimplente": e.valor_inadimplente,
    "Maior atraso (dias)": e.maior_atraso,
    Status: e.status ? STATUS[e.status].rotulo : "",
    "Próxima data": e.proxima_data ? dataDeCalendario(e.proxima_data) : "",
    // instante com fuso: o dia é o de quem olha, não o do UTC (como a coluna "há quantos dias")
    "Último contato": e.ultimo_contato ? dataDeCalendario(diaLocal(new Date(e.ultimo_contato))) : "",
  }));
}

export function mensagemDeErro(falha: unknown): string {
  const detalhe = (falha as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detalhe === "string" ? detalhe : "Não foi possível gravar. Tente de novo.";
}
