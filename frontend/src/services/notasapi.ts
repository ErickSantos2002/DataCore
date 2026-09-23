import { criarHttp } from "./http";

const baseURL =
  import.meta.env.VITE_NOTAS_URL || "https://tinyapi.healthsafetytech.com";

// O interceptor que injeta o token mora em criarHttp, compartilhado com a API
// de autenticacao. As instancias e que sao duas: sao dois backends distintos.
const api = criarHttp(baseURL);

// ── Tipos ────────────────────────────────────────────────────────────────────
//
// Derivados do que as telas e contexts de fato leem de cada resposta — nao de
// documentacao da API, que nao existe. Onde nenhum consumidor le o retorno, ele
// fica `unknown` de proposito: e mais honesto do que inventar uma forma. Quando
// a Fase 3 migrar as telas, as interfaces locais duplicadas (`Nota` aparece em
// quatro arquivos) devem convergir para as daqui.

export type Params = Record<string, unknown>;

export interface Cliente {
  id: number;
  nome: string;
  cpf_cnpj: string;
  email?: string;
  fone?: string;
}

export interface ItemNota {
  descricao: string;
  quantidade: string;
  valor_total: string;
  valor_unitario?: string;
  codigo?: string;
}

export type TipoNota = "Outbound" | "Inbound" | "ReCompra";

export interface Marcador {
  descricao: string;
}

/**
 * Uma nota que conta como faturamento, pela regua da camada `gold`.
 *
 * `natureza_operacao`, `descricao_situacao` e `marcadores` NAO estao mais
 * aqui: eram os campos com que o navegador refazia a decisao de "isto e
 * venda?" — decisao que agora e do banco. Sem eles no tipo, uma tela nova nao
 * consegue reimplementar a regua sem antes pedir os campos de volta, e pedir
 * de volta e uma conversa.
 */
export interface NotaVenda {
  id: number;
  numero?: number;
  data_emissao: string;
  valor_nota: number;
  valor_produtos?: number;
  cliente: Cliente | null;
  nome_vendedor: string;
  tipo?: TipoNota | null;
  itens: ItemNota[];
  /**
   * SE ha observacao — nao o texto.
   *
   * O campo livre e o mais pesado e o mais sensivel da nota (numero de serie,
   * chave de acesso, nome de quem recebeu), e so e lido quando alguem abre o
   * modal. O texto vem de `fetchObservacoesDaVenda` nessa hora.
   */
  tem_observacoes?: boolean;
}

export interface NotaLocacao {
  id: number;
  numero: string | null;
  data_emissao: string;
  valor_nota: number | string | null;
  descricao_situacao: string | null;
  natureza_operacao: string | null;
  nome_vendedor: string | null;
  cliente: { nome: string; cpf_cnpj: string } | null;
  marcadores?: Marcador[];
}

/**
 * Uma nota de servico que conta como faturamento, pela regua do `gold`.
 *
 * Os tres valores chegam como NUMERO. Na origem sao texto, e em duas
 * convencoes (`1.234,56` e `1234.56`) — o `gold` ja converteu, com macro
 * testada, e o navegador nao precisa mais adivinhar qual e qual.
 */
export interface NotaServico {
  id: number;
  numero_nfse: number;
  data_emissao: string;
  valor_servico: number;
  valor_total_recebido?: number;
  valor_iss?: number;
  razao_social_tomador: string;
  cpf_cnpj_tomador: string;
  email_tomador?: string;
  telefone_tomador?: string;
  cidade_tomador: string;
  uf_tomador: string;
  discriminacao_servico: string;
  status?: string;
}

export interface Configuracao {
  id: number;
  chave: string;
  valor: string;
}

export interface ProdutoEstoque {
  id: number;
  nome: string;
  codigo: string;
  unidade: string;
  preco: number;
  saldo: number;
  situacao: "A" | "I"; // A = Ativo, I = Inativo
}

export interface ContaPagar {
  id: number;
  id_tiny: number;
  data_emissao: string;
  vencimento: string;
  competencia: string | null;
  valor: string | number;
  saldo: string | number;
  nro_documento: string | null;
  historico: string | null;
  categoria: string | null;
  situacao: string | null;
  ocorrencia: string;
  dia_vencimento: number | null;
  numero_parcelas: number | null;
  dia_semana_vencimento: number | null;
  cliente_codigo: string | null;
  cliente_nome: string;
  cliente_tipo_pessoa: string | null;
  cliente_cpf_cnpj: string | null;
  cliente_ie: string | null;
  cliente_rg: string | null;
  cliente_fone: string | null;
  cliente_email: string | null;
  cliente_endereco: string | null;
  cliente_numero: string | null;
  cliente_complemento: string | null;
  cliente_bairro: string | null;
  cliente_cep: string | null;
  cliente_cidade: string | null;
  cliente_uf: string | null;
  cliente_pais: string | null;
  liquidacao: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ContaReceber {
  id: number;
  id_tiny: number;
  data: string;
  vencimento: string;
  competencia: string | null;
  valor: string | number;
  saldo: string | number;
  link_boleto: string | null;
  nro_documento: string | null;
  serie_documento: string | null;
  nro_banco: string | null;
  historico: string | null;
  categoria: string | null;
  forma_pagamento: string | null;
  portador: string | null;
  situacao: string | null;
  liquidacao: string | null;
  ocorrencia: string;
  dia_vencimento: number | null;
  numero_parcelas: number | null;
  dia_vencimento_semanal: number | null;
  cliente_codigo: string | null;
  cliente_nome: string;
  cliente_tipo_pessoa: string | null;
  cliente_cpf_cnpj: string | null;
  cliente_ie: string | null;
  cliente_rg: string | null;
  cliente_endereco: string | null;
  cliente_numero: string | null;
  cliente_complemento: string | null;
  cliente_bairro: string | null;
  cliente_cep: string | null;
  cliente_cidade: string | null;
  cliente_uf: string | null;
  cliente_pais: string | null;
  cliente_fone: string | null;
  cliente_email: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ResumoProdutoMes {
  mes: number;
  quantidade: number;
  receita: number;
}

/** O miolo salvo em `config_json` do centro de custo. Os numeros voltam da API
 *  ora como number, ora como string — a tela normaliza os dois. */
export interface ConfigCentroCusto {
  servicos_aduaneiros?:
    | { mes_ano?: string; valor?: number | string | null; nf?: string }[]
    | null;
  participacao_pct?: number | string | null;
  unidades_importadas?: number | string | null;
  custos_diretos?:
    | { descricao?: string; valor?: number | string | null }[]
    | null;
  estimativa_custos_variaveis_anual?: number | string | null;
  participacao_overhead_pct?: number | string | null;
  unidades_lote_mes?: number | string | null;
  quantidade_planejada?: number | string | null;
  preco_unitario_planejado?: number | string | null;
}

export interface CentroCustoConfig {
  config_json?: ConfigCentroCusto | null;
}

// ── Notas Fiscais ────────────────────────────────────────────────────────────
//
// `fetchNotas` (/notas_fiscais/) e `fetchItensNota` (/itens_nota/) foram apagadas em
// 2026-09-08: nenhuma tela as chamava, e os dois endpoints passaram a devolver uma
// PAGINA — `{ itens, total, limite, offset }` — em vez da tabela inteira. Uma funcao
// morta que promete a lista completa e pior que nenhuma: quem a encontrasse pronta
// escreveria uma tela em cima de um contrato que nao existe mais.

/**
 * As notas que contam como faturamento, ja filtradas pelo banco.
 *
 * Trocou `/notas_fiscais/vendas/` por `/faturamento/vendas` (item 9.2). O
 * endpoint antigo reimplementava a regua em Python — CFOP procurado como
 * substring dentro de um campo de texto livre, e lista fixa de marcadores
 * comparada sem normalizar caixa — e devolvia a nota inteira, com marcadores,
 * enderecos de entrega e formas de envio aninhados: ~9,7 MB. O novo le a
 * camada `gold` e manda ~1,8 MB.
 */
export interface PaginaDeVendas {
  itens: NotaVenda[];
  /** Quantas notas o FILTRO encontrou — nao quantas vieram nesta pagina. */
  total: number;
  /** O faturamento do filtro inteiro, somado pelo banco. */
  valor_total: number;
  limite: number;
  offset: number;
}

export const fetchVendas = async (
  params: Params = {},
): Promise<PaginaDeVendas> => {
  const response = await api.get<PaginaDeVendas>("/faturamento/vendas", {
    params,
  });
  return response.data;
};

/**
 * Os cinco recortes que as telas do Comercial desenham, somados pelo banco.
 *
 * Antes cada tela baixava as 4.330 notas com os itens dentro e calculava KPI,
 * evolucao mensal e tres rankings percorrendo array no navegador. As quatro
 * faziam a mesma coisa sobre o mesmo conjunto, cruzando os mesmos quatro
 * filtros — e cada uma com a sua copia da conta.
 *
 * A resposta deixa de crescer com o numero de notas: e do tamanho do que a
 * tela desenha.
 */
export interface ResumoComercial {
  kpis: {
    /** Soma de `valor_nota` — o que Vendas e Clientes mostram. */
    faturamento: number;
    /** Soma de `valor_produtos` — o que Vendedores mostra. */
    faturamento_produtos: number;
    notas: number;
    ticket_medio: number;
    maior_venda: number;
    menor_venda: number;
    /** Desvio padrao POPULACIONAL — a mesma conta que a tela fazia. */
    desvio_padrao_venda: number;
    /** Linhas de item somadas; a tela divide por `notas` para "itens por venda". */
    itens: number;
  };
  evolucao_mensal: {
    ano: number;
    mes: number;
    /** Soma de `valor_nota` — Vendas e Clientes desenham este. */
    total: number;
    /** Soma de `valor_produtos` — Vendedores desenha este. */
    total_produtos: number;
    notas: number;
    /**
     * Itens vendidos no mes — Produtos desenha este.
     *
     * Respeita o filtro de produto no nivel do ITEM, e nao da nota: em Vendas o
     * filtro escolhe as notas em que o produto aparece (e soma a nota inteira);
     * aqui ele escolhe os itens.
     */
    quantidade: number;
  }[];
  por_produto: {
    /** O codigo, ou '#' + descricao quando o item nao tem codigo. */
    chave: string;
    codigo: string | null;
    descricao: string | null;
    quantidade: number;
    valor: number;
    notas: number;
  }[];
  por_vendedor: {
    nome: string;
    valor: number;
    valor_produtos: number;
    notas: number;
  }[];
  por_cliente: {
    /** CPF/CNPJ so com digitos — a chave que junta cadastro duplicado. */
    documento: string;
    nome: string | null;
    /** Como esta no cadastro, com mascara. */
    cpf_cnpj: string | null;
    email: string | null;
    fone: string | null;
    valor: number;
    valor_produtos: number;
    notas: number;
    ultima_compra: string | null;
  }[];
  /**
   * A evolucao mensal dos CINCO maiores clientes do recorte, uma serie por
   * cliente. Nao se remonta a partir de `por_cliente` nem de
   * `evolucao_mensal`: um soma o periodo todo, o outro soma todos os clientes.
   */
  evolucao_por_cliente: {
    documento: string;
    ano: number;
    mes: number;
    total: number;
  }[];
}

export const fetchResumoComercial = async (
  params: Params = {},
): Promise<ResumoComercial> => {
  const response = await api.get<ResumoComercial>("/faturamento/resumo", {
    params,
  });
  return response.data;
};

/**
 * As opcoes dos multiselects, montadas pelo banco.
 *
 * ⚠️ A lista de produtos tem uma linha por CODIGO, e nao por grafia. A tela
 * montava a dela com um `Map` chaveado pelo codigo — so a ultima grafia de
 * cada codigo sobrevivia — mas filtrava comparando `descricao (codigo)`.
 * Medido em 2026-09-09: eram 184 grafias para 127 produtos, o multiselect
 * oferecia 97 opcoes, e 35,5% do valor dos itens estava fora do alcance de
 * quem filtrava por produto — sem erro e sem aviso.
 */
export interface FiltrosComerciais {
  clientes: { id: number; nome: string | null; cpf_cnpj: string | null }[];
  vendedores: string[];
  produtos: {
    chave: string;
    codigo: string | null;
    descricao: string | null;
    valor: number;
  }[];
}

export const fetchFiltrosComerciais = async (): Promise<FiltrosComerciais> => {
  const response = await api.get<FiltrosComerciais>("/faturamento/filtros");
  return response.data;
};

/** O texto das observacoes de uma nota, buscado quando o modal abre. */
export const fetchObservacoesDaVenda = async (
  idNota: number,
): Promise<string | null> => {
  const response = await api.get<{ id: number; observacoes: string | null }>(
    `/faturamento/vendas/${idNota}/observacoes`,
  );
  return response.data.observacoes;
};

/** Faturamento mes a mes de um ano, ja somado pelo banco.
 *
 * Vem da camada `gold`, onde a regra do que conta como faturamento ja foi
 * aplicada — o oposto de `fetchVendas`, que devolve as notas e deixa a tela
 * filtrar e somar. Sao sempre doze linhas, com zero nos meses sem nota, entao
 * quem consome nao precisa preencher buraco.
 *
 * `produto` e NF-e, `servico` e NFS-e, `total` e a soma dos dois — o numero
 * que o dashboard mostra como faturamento da empresa.
 */
export interface FaturamentoMensalAPI {
  ano: number;
  /** 1 = janeiro. */
  mes: number;
  produto: number;
  servico: number;
  total: number;
  /** Quantas NOTAS de produto (NF-e) no mes — nao linhas de item. */
  quantidade_produto: number;
  /** Quantas NOTAS de servico (NFS-e) no mes. */
  quantidade_servico: number;
}

/**
 * O faturamento mes a mes de um ano, ou de uma faixa quando `anoFim` e dado.
 *
 * A faixa existe para a tela de Financeiro, que compara cinco anos lado a
 * lado: uma requisicao de sessenta linhas no lugar de cinco requisicoes, e
 * sem a tela precisar decidir qual e a janela.
 */
export const fetchFaturamentoMensal = async (
  ano: number,
  anoFim?: number,
): Promise<FaturamentoMensalAPI[]> => {
  const response = await api.get<FaturamentoMensalAPI[]>(
    "/faturamento/mensal",
    { params: anoFim === undefined ? { ano } : { ano, ano_fim: anoFim } },
  );
  return response.data;
};

// Notas com marcador "Locação"
export const fetchLocacao = async (
  params: Params = {},
): Promise<NotaLocacao[]> => {
  const response = await api.get<NotaLocacao[]>("/notas_fiscais/locacao/", {
    params,
  });
  return response.data;
};

// `fetchClientes` (/clientes/) foi apagada em 2026-09-09, junto com o
// `DataContext` que era seu unico chamador. As quatro telas do Comercial pediam
// os 2.084 cadastros para cruzar com as notas no navegador; hoje o cliente vem
// dentro de `/faturamento/resumo`, agregado pelo banco e so quem comprou no
// recorte. `/clientes/` passou a devolver uma PAGINA, e uma funcao morta que
// promete a lista completa e pior que nenhuma: quem a encontrasse pronta
// escreveria uma tela em cima de um contrato que nao existe mais.

// Notas Fiscais de Serviço
export interface PaginaDeServicos {
  itens: NotaServico[];
  /** Do FILTRO, nao da pagina. */
  total: number;
  valor_total: number;
  limite: number;
  offset: number;
}

export const fetchNotasServico = async (
  params: Params = {},
): Promise<PaginaDeServicos> => {
  const response = await api.get<PaginaDeServicos>("/faturamento/servicos", {
    params,
  });
  return response.data;
};

/**
 * O que a tela de Servicos desenha, somado pelo banco (item 9.4).
 *
 * A tela baixava as 5.004 notas para calcular KPI, evolucao mensal, ranking de
 * cliente e distribuicao por cidade no navegador.
 */
export interface ResumoDeServicos {
  kpis: { faturamento: number; notas: number; ticket_medio: number };
  evolucao_mensal: { ano: number; mes: number; total: number; notas: number }[];
  por_cliente: { nome: string; valor: number; notas: number }[];
  por_cidade: { nome: string; valor: number; notas: number }[];
  opcoes: { clientes: string[]; cidades: string[]; tipos: string[] };
}

export const fetchResumoDeServicos = async (
  params: Params = {},
): Promise<ResumoDeServicos> => {
  const response = await api.get<ResumoDeServicos>(
    "/faturamento/servicos/resumo",
    {
      params,
    },
  );
  return response.data;
};

// Buscar todas as configurações
export const fetchConfiguracoes = async (): Promise<Configuracao[]> => {
  const response = await api.get<Configuracao[]>("/configuracoes/");
  return response.data;
};

/** `unknown`: o ConfiguracoesContext descarta o retorno e atualiza o estado
 *  local com o valor que ele mesmo mandou. */
export const updateConfiguracao = async (
  chave: string,
  valor: string,
): Promise<unknown> => {
  const response = await api.put(`/configuracoes/${chave}`, { valor });
  return response.data;
};

// Criar nova configuração (opcional)
export const createConfiguracao = async (
  chave: string,
  valor: string,
): Promise<Configuracao> => {
  const response = await api.post<Configuracao>("/configuracoes/", {
    chave,
    valor,
  });
  return response.data;
};

// Estoque
export const fetchEstoque = async (
  params: Params = {},
): Promise<ProdutoEstoque[]> => {
  const response = await api.get<ProdutoEstoque[]>("/estoque/", { params });
  return response.data;
};

/** `unknown`: o DataContext descarta o retorno e atualiza a nota em memoria. */
export const updateNotaTipo = async (
  notaId: number,
  tipo: string,
): Promise<unknown> => {
  const response = await api.patch(`/notas_fiscais/${notaId}/tipo`, { tipo });
  return response.data;
};

// Contas a Pagar
export const fetchContasPagar = async (
  params: Params = {},
): Promise<ContaPagar[]> => {
  const response = await api.get<ContaPagar[]>("/contas_pagar/", { params });
  return response.data;
};

// Contas a Receber
export const fetchContasReceber = async (
  params: Params = {},
): Promise<ContaReceber[]> => {
  const response = await api.get<ContaReceber[]>("/contas_receber/", {
    params,
  });
  return response.data;
};

// Centro de Custo — resumo por produto/ano
export const fetchResumoProduto = async (
  produto: string,
  ano: number,
): Promise<ResumoProdutoMes[]> => {
  const response = await api.get<ResumoProdutoMes[]>(
    "/centro_custo/resumo_produto/",
    { params: { produto, ano, exato: true } },
  );
  return response.data;
};

// Centro de Custo — config manual (CMV, frete, etc.)
export const fetchCentroCustoConfig = async (
  produto: string,
  ano: number,
): Promise<CentroCustoConfig | null> => {
  const response = await api.get<CentroCustoConfig | null>(
    "/centro_custo/config/",
    { params: { produto, ano } },
  );
  return response.data;
};

/** `unknown`: a tela so olha o erro; o corpo da resposta nao e lido. */
export const salvarCentroCustoConfig = async (payload: {
  produto: string;
  ano: number;
  cmv_unitario: number | null;
  frete_unitario: number | null;
  outros_custos_unitario: number | null;
  config_json?: ConfigCentroCusto | null;
}): Promise<unknown> => {
  const response = await api.post("/centro_custo/config/", payload);
  return response.data;
};

// ── Contas: o que a tela desenha, somado pelo banco (item 9.4) ───────────────
//
// As duas telas de Contas baixavam a tabela inteira para calcular KPI,
// evolucao, pizza de categorias e ranking de contraparte no navegador. Medido
// em 2026-09-09: 7,9 MB em Contas a Pagar e 11,2 MB em Contas a Receber — as
// duas respostas mais pesadas do sistema, maiores que a lista de notas de venda
// que motivou a Fase 9 inteira.

export type TipoDeContas = "contas_pagar" | "contas_receber";

export interface FiltrosDeContasAPI extends Params {
  situacao?: string[];
  categoria?: string[];
  contraparte?: string[];
  data_inicio?: string;
  data_fim?: string;
}

export interface ResumoDeContas {
  kpis: {
    total_aberto: number;
    total_quitado: number;
    contas_vencidas: number;
    a_vencer_30: number;
    media_mensal: number;
    contas: number;
  };
  /** As duas series vem juntas; qual o grafico desenha e decisao da tela. */
  por_ano: { ano: number; quitado: number; aberto: number }[];
  por_mes: { ano: number; mes: number; quitado: number; aberto: number }[];
  por_categoria: { nome: string; valor: number }[];
  por_contraparte: { nome: string; valor: number }[];
  opcoes: { situacao: string[]; categoria: string[]; contraparte: string[] };
}

export const fetchResumoDeContas = async (
  tipo: TipoDeContas,
  params: FiltrosDeContasAPI = {},
): Promise<ResumoDeContas> => {
  const response = await api.get<ResumoDeContas>(`/${tipo}/resumo`, { params });
  return response.data;
};

/** Uma conta como a tabela a mostra — treze colunas, e nao as trinta da linha. */
export interface ContaDaTela {
  id: number;
  id_tiny: number | null;
  /** `contas_receber.data` e `contas_pagar.data_emissao` sob um nome so. */
  emissao: string | null;
  vencimento: string | null;
  situacao: string | null;
  categoria: string | null;
  cliente_nome: string | null;
  cliente_cpf_cnpj: string | null;
  cliente_cidade: string | null;
  cliente_uf: string | null;
  nro_documento: string | null;
  historico: string | null;
  liquidacao: string | null;
  /** Numero, e nao o texto que o navegador convertia: a coluna e `numeric`. */
  valor: number;
  saldo: number;
  quitada: boolean;
  /** Venceu e nao foi paga — a mesma regra que decide o KPI de vencidas. */
  vencida: boolean;
  // As tres colunas que existem em uma das tabelas e nao na outra, e que so a
  // PLANILHA usa. Ausentes na tela que nao as tem.
  forma_pagamento?: string | null;
  portador?: string | null;
  ocorrencia?: string | null;
}

export interface PaginaDeContas {
  itens: ContaDaTela[];
  /** Do FILTRO, nao da pagina. */
  total: number;
  total_aberto: number;
  total_quitado: number;
  limite: number;
  offset: number;
}

export const fetchPaginaDeContas = async (
  tipo: TipoDeContas,
  params: Params = {},
): Promise<PaginaDeContas> => {
  const response = await api.get<PaginaDeContas>(`/${tipo}/pagina`, { params });
  return response.data;
};
