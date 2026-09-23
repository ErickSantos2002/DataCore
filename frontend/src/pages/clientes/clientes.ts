import type {
  FiltrosComerciais,
  ResumoComercial,
} from "../../services/notasapi";
import { dataDeCalendarioComoDate, diaLocal } from "../../lib/datas";
import type { OpcaoDeMultiSelect } from "../../design-system/ui/forms/buscaDeMultiSelect";
import type { RecorteComercial } from "../comercial/useComercial";
import { LINHAS_NO_PDF } from "../../lib/pdf";

/**
 * A conta pura da tela de Clientes, separada de `Clientes.tsx`.
 *
 * Cada função aqui é um `useMemo` que saiu do componente sem mudar de
 * comportamento. Os `useMemo` continuam na casca: `usePaginacao` volta para a
 * página 1 quando a lista muda de IDENTIDADE.
 *
 * A carteira vem do banco já consolidada por documento
 * (`resumo.por_cliente`), mas a tabela é ordenada e pesquisada AQUI, no
 * navegador — ao contrário de Vendedores, que pede a página ao servidor.
 *
 * Onde a lógica movida tem cara de defeito, o comentário registra o achado sem
 * corrigir — corrigir junto de mover impede saber qual dos dois quebrou.
 *
 * Morreram na decomposição o que a tela calculava e não desenhava: a
 * "distribuição de faturamento" (top 8 + "Outros") e a evolução mensal dos
 * cinco maiores clientes (`evolucao_por_cliente`), junto com as oito cores
 * cravadas de `CORES`. Nenhum gráfico lia os dois arrays.
 */

type LinhaDoResumo = ResumoComercial["por_cliente"][number];
type Cadastro = FiltrosComerciais["clientes"][number];
type ProdutoDoFiltro = FiltrosComerciais["produtos"][number];

export interface ClienteDaCarteira {
  nome: string;
  cpf_cnpj: string;
  /** O documento em dígitos — a chave que junta cadastro repetido. */
  cpfCnpjNormalizado: string;
  email?: string;
  fone?: string;
  totalCompradoPeriodo: number;
  numeroComprasPeriodo: number;
  ticketMedioPeriodo: number;
  ultimaCompra: Date | null;
  status: "ativo" | "inativo";
}

const soDigitos = (texto: string | null | undefined) =>
  (texto ?? "").replace(/\D/g, "");

/**
 * As opções do multiselect de cliente: uma por DOCUMENTO, que é o `valor`.
 * Dois cadastros com o mesmo CNPJ viram uma opção só, com o rótulo do último.
 */
export function opcoesDeCliente(clientes: Cadastro[]): OpcaoDeMultiSelect[] {
  return Array.from(
    new Map(
      clientes.map((c) => [
        soDigitos(c.cpf_cnpj),
        { valor: soDigitos(c.cpf_cnpj), rotulo: `${c.nome} (${c.cpf_cnpj})` },
      ]),
    ).values(),
  );
}

/** O recorte filtra por ID, e o multiselect guarda o documento: um documento
 *  pode ter mais de um cadastro, e todos têm de entrar. */
export function idsPorDocumento(clientes: Cadastro[]): Map<string, number[]> {
  const mapa = new Map<string, number[]>();
  clientes.forEach((c) => {
    const doc = soDigitos(c.cpf_cnpj);
    mapa.set(doc, [...(mapa.get(doc) ?? []), c.id]);
  });
  return mapa;
}

export const rotuloDoProduto = (p: {
  descricao: string | null;
  codigo: string | null;
}) => `${p.descricao} (${p.codigo ?? "sem código"})`;

/** O rótulo é o que o multiselect de produto guarda; o servidor filtra pela
 *  chave, e a casca traduz um no outro. */
export function chavePorRotulo(
  produtos: ProdutoDoFiltro[],
): Map<string, string> {
  const mapa = new Map<string, string>();
  produtos.forEach((p) => mapa.set(rotuloDoProduto(p), p.chave));
  return mapa;
}

export interface FiltrosDeClientes {
  cliente: string[];
  vendedor: string[];
  produto: string[];
  dataInicio: string;
  dataFim: string;
}

export function recorteDosFiltros(
  filtros: FiltrosDeClientes,
  idsDoDocumento: Map<string, number[]>,
  chaveDoRotulo: Map<string, string>,
): RecorteComercial {
  return {
    clientes: filtros.cliente.flatMap((doc) => idsDoDocumento.get(doc) ?? []),
    vendedores: filtros.vendedor,
    produtos: filtros.produto
      .map((r) => chaveDoRotulo.get(r))
      .filter((c): c is string => c !== undefined),
    dataInicio: filtros.dataInicio,
    dataFim: filtros.dataFim,
  };
}

/**
 * A carteira do recorte, com ticket e status.
 *
 * Ativo é quem comprou nos últimos noventa dias contados de `hoje` — e não do
 * período escolhido —, com o 90º dia dentro: em 15/09, a compra de 17/06 conta.
 *
 * A conta é por DIA. O limite era "agora menos 90 dias", com hora, e a compra
 * é meia-noite: a compra de 17/06 saía inativa às 15h de 15/09 e ativa se a
 * mesma tela abrisse à meia-noite e meia — o status mudava ao longo do dia.
 */
export function carteiraDoResumo(
  porCliente: LinhaDoResumo[],
  hoje: Date,
): ClienteDaCarteira[] {
  // O dia de 90 dias atrás, em hora local e sem hora: `new Date(a, m, d - 90)`
  // normaliza a virada de mês e de ano.
  const limite = diaLocal(
    new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 90),
  );

  return porCliente.map((c) => {
    const ultimaCompra = c.ultima_compra
      ? dataDeCalendarioComoDate(c.ultima_compra)
      : null;
    return {
      nome: c.nome ?? "Não informado",
      cpf_cnpj: c.cpf_cnpj ?? "",
      cpfCnpjNormalizado: c.documento,
      email: c.email ?? undefined,
      fone: c.fone ?? undefined,
      totalCompradoPeriodo: c.valor,
      numeroComprasPeriodo: c.notas,
      ticketMedioPeriodo: c.notas > 0 ? c.valor / c.notas : 0,
      ultimaCompra,
      status:
        ultimaCompra && diaLocal(ultimaCompra) >= limite ? "ativo" : "inativo",
    };
  });
}

export interface KpisDeClientes {
  clientesAtivos: number;
  clientesInativos: number;
  topCliente: ClienteDaCarteira | undefined;
  /** O ticket da carteira: o valor somado sobre as notas somadas. */
  ticketMedioPorNota: number;
}

export function kpisDaCarteira(carteira: ClienteDaCarteira[]): KpisDeClientes {
  const clientesAtivos = carteira.filter((c) => c.status === "ativo").length;
  const valor = carteira.reduce((acc, c) => acc + c.totalCompradoPeriodo, 0);
  const notas = carteira.reduce((acc, c) => acc + c.numeroComprasPeriodo, 0);
  return {
    clientesAtivos,
    clientesInativos: carteira.length - clientesAtivos,
    // O ranking já vem ordenado por valor: o topo é a primeira linha.
    topCliente: carteira[0],
    // Era a média do ticket de cada cliente: um cliente de uma nota pesava
    // igual a um de duzentas, e o rótulo não dizia qual das duas contas era.
    // Decisão do Erick (22/09): o ticket da carteira.
    ticketMedioPorNota: notas > 0 ? valor / notas : 0,
  };
}

/** Uma barra do Top 10: o nome inteiro, que o eixo corta e o balão mostra. */
export interface BarraDoRanking {
  nomeCompleto: string;
  valor: number;
}

export function rankingDeClientes(
  carteira: ClienteDaCarteira[],
): BarraDoRanking[] {
  return carteira.slice(0, 10).map((c) => ({
    nomeCompleto: c.nome,
    valor: c.totalCompradoPeriodo,
  }));
}

const DINHEIRO = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

/**
 * As quatro linhas de "Estatísticas do Período", já como texto.
 *
 * A taxa no formato brasileiro: saía com `toFixed` — "75.0%", com ponto, ao
 * lado de "R$ 123.456,78" com vírgula.
 */
export function estatisticasDaCarteira(
  carteira: ClienteDaCarteira[],
  kpis: KpisDeClientes,
  faturamento: number,
): { label: string; value: string | number }[] {
  return [
    { label: "Total de Clientes", value: carteira.length },
    {
      label: "Taxa de Ativação",
      value:
        carteira.length > 0
          ? `${((kpis.clientesAtivos / carteira.length) * 100).toLocaleString(
              "pt-BR",
              { minimumFractionDigits: 1, maximumFractionDigits: 1 },
            )}%`
          : "0%",
    },
    {
      label: "Faturamento Total",
      value: `R$ ${faturamento.toLocaleString("pt-BR", DINHEIRO)}`,
    },
    {
      label: "Notas no Período",
      value: carteira.reduce((acc, c) => acc + c.numeroComprasPeriodo, 0),
    },
  ];
}

export type CampoDeOrdenacao =
  | "nome"
  | "ultimaCompra"
  | "totalComprado"
  | "numeroCompras"
  | "status";

export interface OrdenacaoDeClientes {
  campo: CampoDeOrdenacao;
  direcao: "asc" | "desc";
}

/** Número compara por subtração; texto em ordem natural, sem caixa nem acento,
 *  e sem o espaço das pontas — o Tiny devolve nome como " ZETA ", e o espaço
 *  ordenava antes de qualquer letra. */
function comparar(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).trim().localeCompare(String(b).trim(), "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * A tabela: pesquisa por nome, e-mail, telefone ou documento (com máscara ou
 * pelos dígitos), e a ordem.
 *
 * Duas regras de ordem que a tela antiga não tinha, as mesmas de Estoque:
 *   - o nome compara com `localeCompare`: com `toLowerCase` e `>`, "Ágil" ia
 *     para depois de "Zeta", e o espaço da frente jogava o nome para o topo;
 *   - **empate desempata pelo nome**, crescente em qualquer direção: o
 *     comparador antigo nunca devolvia 0 (`a > b ? 1 : -1`), e oito clientes
 *     com duas notas saíam na ordem que o motor quisesse.
 */
export function buscarEOrdenar(
  carteira: ClienteDaCarteira[],
  pesquisa: string,
  ordenacao: OrdenacaoDeClientes,
): ClienteDaCarteira[] {
  let filtrados = [...carteira];

  if (pesquisa) {
    const termo = pesquisa.toLowerCase();
    const termoNumerico = soDigitos(pesquisa);
    filtrados = filtrados.filter(
      (c) =>
        c.nome.toLowerCase().includes(termo) ||
        (c.email ?? "").toLowerCase().includes(termo) ||
        (c.fone ?? "").includes(termo) ||
        c.cpf_cnpj.toLowerCase().includes(termo) ||
        (termoNumerico !== "" && soDigitos(c.cpf_cnpj).includes(termoNumerico)),
    );
  }

  const valorDe = (c: ClienteDaCarteira): string | number => {
    switch (ordenacao.campo) {
      case "nome":
        return c.nome;
      case "ultimaCompra":
        return c.ultimaCompra?.getTime() || 0;
      case "totalComprado":
        return c.totalCompradoPeriodo;
      case "numeroCompras":
        return c.numeroComprasPeriodo;
      case "status":
        return c.status;
    }
  };

  const sinal = ordenacao.direcao === "asc" ? 1 : -1;
  filtrados.sort(
    (a, b) =>
      sinal * comparar(valorDe(a), valorDe(b)) || comparar(a.nome, b.nome),
  );

  return filtrados;
}

/** O primeiro clique numa coluna é decrescente; clicar na que já está
 *  decrescente inverte. */
export function proximaOrdenacao(
  atual: OrdenacaoDeClientes,
  campo: CampoDeOrdenacao,
): OrdenacaoDeClientes {
  return {
    campo,
    direcao: atual.campo === campo && atual.direcao === "desc" ? "asc" : "desc",
  };
}

/** A última compra como a tabela mostra: no fuso de quem olha, como a
 *  planilha e o PDF. */
export function dataDaUltimaCompra(ultimaCompra: Date | null): string {
  return ultimaCompra ? ultimaCompra.toLocaleDateString("pt-BR") : "Nunca";
}

/** As linhas da planilha: a tabela como está — pesquisada e na ordem. */
export function linhasDaPlanilha(
  carteira: ClienteDaCarteira[],
): Record<string, unknown>[] {
  return carteira.map((c) => ({
    Nome: c.nome,
    "CPF/CNPJ": c.cpf_cnpj,
    Email: c.email || "",
    Telefone: c.fone || "",
    "Última Compra": c.ultimaCompra
      ? c.ultimaCompra.toLocaleDateString("pt-BR")
      : "Nunca",
    "Total Comprado": c.totalCompradoPeriodo,
    "Número de Compras": c.numeroComprasPeriodo,
    "Ticket Médio": c.ticketMedioPeriodo,
    Status: c.status === "ativo" ? "Ativo" : "Inativo",
  }));
}

export const CABECALHO_DO_PDF = [
  "Nome",
  "CPF/CNPJ",
  "Última Compra",
  "Total",
  "Status",
];

/**
 * As linhas do PDF.
 *
 * O total no formato brasileiro, como a tabela: saía com `toFixed` —
 * "R$ 50000.50", sem milhar e com ponto.
 *
 * Corta em `LINHAS_NO_PDF`; a casca põe o aviso do corte no cabeçalho.
 */
export function linhasDoPdf(carteira: ClienteDaCarteira[]): string[][] {
  return carteira
    .slice(0, LINHAS_NO_PDF)
    .map((c) => [
      c.nome.substring(0, 25),
      c.cpf_cnpj,
      c.ultimaCompra ? c.ultimaCompra.toLocaleDateString("pt-BR") : "Nunca",
      `R$ ${c.totalCompradoPeriodo.toLocaleString("pt-BR", DINHEIRO)}`,
      c.status === "ativo" ? "Ativo" : "Inativo",
    ]);
}
