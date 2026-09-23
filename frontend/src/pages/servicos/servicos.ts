/**
 * A conta pura da tela de Serviços, separada de `Servicos.tsx`.
 *
 * Cada função aqui é um `useMemo` que saiu do componente sem mudar de
 * comportamento — perdeu o `useMemo` em volta e ganhou como parâmetro o que
 * antes vinha do escopo. Os `useMemo` continuam na tela: `usePaginaDeServicos`
 * monta a chave do pedido a partir do `recorte`, e um objeto novo a cada render
 * refaria a busca em laço.
 *
 * ⚠️ **A fonte mudou.** A tela não baixa mais as 5.004 notas para somar no
 * navegador: o Postgres devolve o resumo já agregado (`ResumoDeServicos`) e a
 * tabela vem paginada do servidor. O que sobrou aqui é o que sempre foi
 * desenho — a troca para escala anual acima de 24 meses, o corte do top dez, o
 * rótulo abreviado do gráfico — mais a modelagem das linhas de exportação.
 * As contas que o banco assumiu (`opcoesDeFiltro`, `filtrarServicos`,
 * `calcularKpis`, `rankingDeClientes`, `distribuicaoPorCidade`,
 * `ordenarEBuscar`) morreram nesta migração.
 *
 * O único defeito que a lógica movida trazia — a data de emissão passando por
 * `new Date` nas duas exportações — está corrigido; o docblock de
 * `linhasDaPlanilha` conta qual era.
 *
 * ⚠️ **`converterParaNumero` no valor é rede, e não conserto.** Os três
 * lugares que lêem `valor_servico` (`linhasDaPlanilha`, `linhasDoPdf` e a
 * célula de valor em `TabelaDeServicos.tsx`) passam o campo por
 * `converterParaNumero` (`lib/dinheiro.ts`); o `origin/main` usava o campo
 * cru. Com `valor_servico: number`, como `services/notasapi.ts` o declara, a
 * função é **identidade** — nenhuma mudança de comportamento, e foi por isso
 * que entrou no commit que só move sem disparar o portão. O que ela protege é
 * o dia em que a API do Tiny devolver `"1.234,56"` como texto: `Number` puro
 * leria 1,23. Está aqui registrado porque a revisão final o apontou como o
 * único desvio daquele commit sem linha no ledger.
 */

import type { ResumoDeServicos } from "../../services/notasapi";
import { dataDeCalendario } from "../../lib/datas";
import { converterParaNumero } from "../../lib/dinheiro";
import type {
  PedidoDaTabelaDeServicos,
  RecorteDeServicos,
} from "./useServicos";
import { LINHAS_NO_PDF } from "../../lib/pdf";

const DUAS_CASAS = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

/** Os campos que a tela lê de um serviço (NFS-e), como a página do servidor os
 *  entrega. É um subconjunto de `NotaServico`: a tabela não precisa saber de
 *  ISS, e-mail nem status para desenhar as seis colunas. */
export interface Servico {
  id: number;
  numero_nfse: number;
  data_emissao: string;
  valor_servico: number;
  razao_social_tomador: string;
  cpf_cnpj_tomador: string;
  /** `null` de fato: a importação parou de trazer a cidade em 2025, e a API
   *  devolve `null` em toda NFS-e daquele ano. Ver `rotuloDaCidade`. */
  cidade_tomador: string | null;
  uf_tomador: string | null;
  discriminacao_servico: string;
}

/**
 * "Cidade/UF" do tomador, para a tabela e as duas exportações.
 *
 * As três montavam `${cidade}/${uf}` direto, e desde 2025 a API manda
 * `cidade_tomador: null` (1276 de 1276 notas daquele ano, 868 das 1133 de
 * 2026). A planilha e o PDF saíam com "null/null" em toda linha e a tabela com
 * uma barra solta, porque o React não imprime `null` — conferido abrindo os
 * dois arquivos em 15/09. A parte que falta some com a barra; faltando as
 * duas, travessão, pelo mesmo motivo de `dataDeCalendario`: diz "não tem".
 *
 * Aceita `undefined` também: é como o falso dos testes representa o campo.
 */
export function rotuloDaCidade(
  cidade: string | null | undefined,
  uf: string | null | undefined,
): string {
  const partes = [cidade, uf].map((parte) => parte?.trim()).filter(Boolean);
  return partes.length ? partes.join("/") : "—";
}

/** Os quatro números do topo da tela. */
export interface KpisDeServico {
  totalFaturado: number;
  totalServicos: number;
  ticketMedio: number;
  topCliente: { nome: string; valor: number } | null;
}

/** Um ponto do gráfico de evolução mensal (ou anual, quando agrupado). */
export interface PontoDeEvolucao {
  mes: string;
  total: number;
  ordem: number;
  /** Só existe nos pontos mensais — o agrupamento anual não carrega ano por ponto. */
  ano?: number;
}

/** Uma barra do ranking de clientes. */
export interface FatiaDeCliente {
  /** Nome cortado em 20 caracteres, para caber no eixo do gráfico. */
  cliente: string;
  clienteCompleto: string;
  valor: number;
}

/** Uma fatia da pizza de distribuição por cidade. */
export interface FatiaDeCidade {
  name: string;
  value: number;
}

/** Os cinco filtros do topo da tela, com os nomes que os estados têm em
 *  `Servicos.tsx`. */
export interface FiltrosDeServicos {
  cliente: string[];
  cidade: string[];
  tipoServico: string[];
  dataInicio: string;
  dataFim: string;
}

/**
 * A ordenação da tabela de serviços.
 *
 * `campo` é o mesmo tipo de `PedidoDaTabelaDeServicos["ordenarPor"]`, e não
 * `string`: quem ordena é o Postgres, então o conjunto de campos válidos é o
 * do contrato da API. Com `string` aqui, um `onOrdenar` da tela tipado pela
 * união deixaria de ser atribuível à prop da tabela.
 */
export interface OrdenacaoDeServicos {
  campo: PedidoDaTabelaDeServicos["ordenarPor"];
  direcao: "asc" | "desc";
}

// ── Recorte ────────────────────────────────────────────────────────────────

/**
 * Os filtros do topo, no formato que o servidor entende.
 *
 * É só renomeação — `cliente` vira `clientes`, `tipoServico` vira `tipos` —,
 * mas é ela que decide o que entra no `WHERE` da consulta: um campo que se
 * perca aqui vira um filtro que a tela mostra marcado e o banco ignora.
 */
export function recorteDeServicos(
  filtros: FiltrosDeServicos,
): RecorteDeServicos {
  return {
    clientes: filtros.cliente,
    cidades: filtros.cidade,
    tipos: filtros.tipoServico,
    dataInicio: filtros.dataInicio,
    dataFim: filtros.dataFim,
  };
}

// ── KPIs ───────────────────────────────────────────────────────────────────

/**
 * Os quatro números do topo, lidos do resumo que o banco somou.
 *
 * Os três primeiros vêm prontos de `resumo.kpis`. O "Top Cliente" é o único
 * que a tela ainda decide: o banco devolve `por_cliente` já ordenado por
 * valor, e o topo é a primeira posição dessa lista.
 */
export function kpisDoResumo(resumo: ResumoDeServicos): KpisDeServico {
  const topo = resumo.por_cliente[0];
  return {
    totalFaturado: resumo.kpis.faturamento,
    totalServicos: resumo.kpis.notas,
    ticketMedio: resumo.kpis.ticket_medio,
    topCliente: topo ? { nome: topo.nome, valor: topo.valor } : null,
  };
}

// ── Gráficos ───────────────────────────────────────────────────────────────

/**
 * A evolução do faturamento, ponto a ponto.
 *
 * O banco devolve uma linha por mês com nota (`{ ano, mes, total, notas }`); o
 * rótulo em português e a troca para escala anual acima de 24 meses continuam
 * sendo decisão da tela — um gráfico com 60 rótulos mensais fica ilegível.
 *
 * `new Date(m.ano, m.mes - 1)` é construção em hora LOCAL, e não a leitura de
 * `"AAAA-MM-DD"` que o `linhasDaPlanilha` documenta abaixo: aqui não há string
 * de data nenhuma para o ECMAScript ler como UTC.
 */
export function evolucaoDoResumo(
  evolucaoMensal: ResumoDeServicos["evolucao_mensal"],
): PontoDeEvolucao[] {
  const dadosMensais = evolucaoMensal.map((m) => {
    const data = new Date(m.ano, m.mes - 1);
    return {
      mes: data.toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
      }),
      total: m.total,
      ordem: data.getTime(),
      ano: m.ano,
    };
  });

  if (dadosMensais.length > 24) {
    const agrupadoAnual = dadosMensais.reduce(
      (acc: Record<number, number>, item) => {
        if (!acc[item.ano]) acc[item.ano] = 0;
        acc[item.ano] += item.total;
        return acc;
      },
      {},
    );

    return Object.entries(agrupadoAnual)
      .map(([ano, total]) => ({
        mes: ano.toString(),
        total,
        ordem: new Date(Number(ano), 0).getTime(),
      }))
      .sort((a, b) => a.ordem - b.ordem);
  }

  return dadosMensais;
}

/**
 * O top 10 de clientes, do resumo já ordenado por valor pelo banco.
 *
 * O corte em 20 caracteres é do eixo do gráfico: o nome inteiro segue em
 * `clienteCompleto`, que é o que o tooltip mostra.
 */
export function rankingDoResumo(
  porCliente: ResumoDeServicos["por_cliente"],
): FatiaDeCliente[] {
  return porCliente.slice(0, 10).map((c) => ({
    cliente: c.nome.length > 20 ? c.nome.substring(0, 20) + "..." : c.nome,
    clienteCompleto: c.nome,
    valor: c.valor,
  }));
}

/** A distribuição por cidade do tomador — só as dez maiores, do resumo já
 *  ordenado por valor pelo banco. */
export function cidadesDoResumo(
  porCidade: ResumoDeServicos["por_cidade"],
): FatiaDeCidade[] {
  return porCidade.slice(0, 10).map((c) => ({ name: c.nome, value: c.valor }));
}

// ── Ordenação ──────────────────────────────────────────────────────────────

/**
 * O próximo estado da ordenação ao clicar num cabeçalho: o primeiro clique
 * numa coluna é sempre decrescente, inclusive quando a coluna anterior estava
 * crescente; só clicar de novo na MESMA coluna alterna a direção.
 *
 * Contas (`contas.ts`, `proximaOrdenacao`) e Locação (`notasDeLocacao.ts`,
 * `proximaOrdenacao`) já tinham essa mesma regra extraída como conta pura;
 * Produtos deixou inline e Serviços seguiu Produtos — este era o último bloco
 * de decisão que sobrava na casca com precedente para morar aqui.
 *
 * `campo` é `OrdenacaoDeServicos["campo"]`, e não `string`: quem ordena é o
 * Postgres, e o retorno precisa continuar atribuível ao estado da tela — com
 * `string` o `setOrdenacao` de `Servicos.tsx` deixaria de aceitar o resultado.
 */
export function proximaOrdenacao(
  atual: OrdenacaoDeServicos,
  campo: OrdenacaoDeServicos["campo"],
): OrdenacaoDeServicos {
  return {
    campo,
    direcao: atual.campo === campo && atual.direcao === "desc" ? "asc" : "desc",
  };
}

// ── Planilha ───────────────────────────────────────────────────────────────

/**
 * As linhas que vão para o Excel — exatamente o recorte que a tela exportou,
 * na ordem em que a pessoa via a coluna.
 *
 * Recebe o recorte INTEIRO (`todosOsServicos`), não a página exibida: a
 * paginação é da tabela na tela, e quem exporta espera a lista filtrada
 * completa, não os 15 itens da página em que estava.
 *
 * A "Data Emissão" saía com o dia errado em Brasília: era
 * `new Date(s.data_emissao)`, e o ECMAScript lê `"AAAA-MM-DD"` como
 * meia-noite em UTC — a oeste de Greenwich meia-noite em UTC ainda é o dia
 * anterior, então 2026-03-15 virava 14/03/2026 na planilha enquanto a tabela
 * na tela mostrava 15/03/2026. `data_emissao` é data de calendário, sem
 * instante e sem fuso, e `dataDeCalendario` (`lib/datas.ts`) lê o dia certo
 * direto da string, sem `Date` nenhum. Mesmo defeito e mesma correção de
 * `notasDeLocacao.ts`.
 *
 * A correção mudou também o caso da data AUSENTE, e de propósito:
 * `new Date(undefined).toLocaleDateString("pt-BR")` imprimia `Invalid Date`
 * na planilha, e `dataDeCalendario` devolve `—`. `Servico` declara
 * `data_emissao: string`, então a nota sem data é dado fora do contrato —
 * mas ela chega, e um travessão numa célula diz o que "Invalid Date" não diz.
 */
export function linhasDaPlanilha(
  servicos: Servico[],
): Record<string, unknown>[] {
  return servicos.map((s) => ({
    "Número NFS-e": s.numero_nfse,
    Cliente: s.razao_social_tomador,
    "CNPJ/CPF": s.cpf_cnpj_tomador,
    "Data Emissão": dataDeCalendario(s.data_emissao),
    Cidade: rotuloDaCidade(s.cidade_tomador, s.uf_tomador),
    Valor: converterParaNumero(s.valor_servico),
    Descrição: s.discriminacao_servico,
  }));
}

// ── PDF ────────────────────────────────────────────────────────────────────

/**
 * As linhas que vão para o corpo da tabela do PDF (`autoTable`), na mesma
 * ordem das cinco colunas do relatório: NFS-e, cliente, data, valor, cidade.
 *
 * É modelagem de dado, como `linhasDaPlanilha` — as duas metades do PDF ficam
 * separadas de propósito: estas linhas (testáveis, sem tocar em `jsPDF`) ficam
 * aqui; a montagem do documento (`new jsPDF()`, margens, cabeçalho com nome de
 * usuário, `doc.save`) é apresentação e continua em `Servicos.tsx`, que é quem
 * sabe quem está logado.
 *
 * Só as `LINHAS_NO_PDF` primeiras — o limite e o porquê moram em
 * `lib/pdf.ts`; a casca põe o aviso do corte no cabeçalho.
 *
 * Mesmo defeito de fuso de `linhasDaPlanilha` acima, e mesma correção: a data
 * passa por `dataDeCalendario` (`lib/datas.ts`) em vez de `new Date`, que lia
 * "AAAA-MM-DD" como meia-noite UTC e imprimia o dia anterior a partir de
 * `TZ=America/Sao_Paulo`. Com ela veio também a troca de `Invalid Date` por
 * `—` na nota sem data, pelo mesmo motivo que o docblock de `linhasDaPlanilha`
 * registra.
 */
export function linhasDoPdf(servicos: Servico[]): (string | number)[][] {
  return servicos.slice(0, LINHAS_NO_PDF).map((s) => [
    s.numero_nfse,
    s.razao_social_tomador.substring(0, 25),
    dataDeCalendario(s.data_emissao),
    // Com milhar e vírgula, como o PDF de Clientes: saía "R$ 1000.00".
    `R$ ${converterParaNumero(s.valor_servico).toLocaleString("pt-BR", DUAS_CASAS)}`,
    rotuloDaCidade(s.cidade_tomador, s.uf_tomador),
  ]);
}
