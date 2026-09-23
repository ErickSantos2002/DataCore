/**
 * A regra das duas telas de Contas, separada das telas.
 *
 * `Contas a Receber` e `Contas a Pagar` eram gêmeas: 83% das linhas
 * idênticas, 277 divergentes em 1641. Este arquivo é o lado que não muda
 * entre elas — filtro, KPI, gráfico, busca, ordenação, paginação e planilha
 * —, escrito uma vez e exercitado por `contas.test.ts`.
 *
 * O que difere de PROPÓSITO entra por parâmetro, nunca por cópia:
 *
 *  - **o que conta como quitado**: Receber aceita `recebido` ou `pago`,
 *    Pagar aceita só `pago`;
 *  - **qual campo de data manda no filtro de período**: Receber usa `data`,
 *    Pagar usa `data_emissao`.
 *
 * A Fase 1 trouxe o comportamento linha a linha, defeitos inclusive; a Fase 2
 * fechou os 18 do levantamento de 31/08/2026 aqui dentro, numa edição só para
 * as duas telas — que é exatamente o que este arquivo existe para permitir.
 * Onde o comportamento mudou de propósito, o comentário no lugar diz o que
 * era antes e por que deixou de ser.
 *
 * O que o levantamento registrou e NÃO foi mexido continua marcado como
 * comportamento preservado no teste: categoria vazia como fatia à parte,
 * contraparte agrupada pelo nome cru (caixa e espaço sobrando contam como
 * cadastros diferentes) e conta sem situação que não dá para filtrar.
 */

import { dataDeCalendario, diaLocal } from "../../lib/datas";
import type { ContaDaTela } from "../../services/notasapi";
import { periodoDoMes, type Periodo } from "../../lib/periodo";

/**
 * Os campos que as duas telas leem de uma conta.
 *
 * É o que `GET /contas_{pagar,receber}/pagina` entrega — treze colunas, e não as trinta e
 * poucas da linha de conta. Endereço, CEP, e-mail e telefone da contraparte
 * saíram: não aparecem na tela e não têm por que trafegar.
 *
 * `emissao` chega com um nome só. Na origem são dois (`contas_receber.data` e
 * `contas_pagar.data_emissao`), e era o backend que devolvia cada um com o seu
 * nome — daí o `DialetoDeContas.campoDaEmissao`, que deixou de existir.
 *
 * `quitada` e `vencida` vêm do banco, e não recalculadas aqui: são as MESMAS
 * regras que decidem os KPIs logo acima da tabela, e um selo verde numa linha
 * que o KPI conta como aberta é o tipo de divergência que ninguém percebe.
 */
export type ContaBase = ContaDaTela;

/**
 * As duas divergências de domínio do par, num tipo só.
 *
 * `campoDaEmissao` existe porque a API entrega o mesmo dado com dois nomes:
 * `contas_receber.data` e `contas_pagar.data_emissao`. A coluna que sai disso
 * se chama "Emissão" nas duas telas.
 *
 * SUPOSIÇÃO NÃO CONFIRMADA CONTRA O TINY: que `contas_receber.data` é mesmo a
 * data de EMISSÃO da conta, e não outra coisa (competência, cadastro). A
 * decisão do Erick em 31/08/2026 foi preservar o comportamento atual
 * exatamente como está e travá-lo por teste, em vez de unificar às cegas. Se
 * a conferência contra o Tiny disser outra coisa, é aqui que muda — e o
 * rótulo "Emissão" da coluna e da planilha muda junto.
 */
/**
 * O que ainda difere entre as duas telas depois que a régua foi para o banco.
 *
 * Sobrou uma coisa só: o nome da série de quitado no gráfico, porque é ele que
 * aparece na legenda e no tooltip. `campoDaEmissao` e `situacoesQuitadas`
 * saíram daqui em 2026-09-09 — a API unificou o nome da data, e quem decide o
 * que é quitado é `core/contas_agregado.py`, uma vez para as duas telas.
 */
export interface DialetoDeContas {
  /** Nome da série de quitado nos dados do gráfico ("recebido" / "pago"). */
  chaveQuitado: string;
}

export interface Ordenacao {
  campo: string;
  direcao: "asc" | "desc";
}

export interface FiltrosDeContas {
  situacao: string[];
  categoria: string[];
  contraparte: string[];
  dataInicio: string;
  dataFim: string;
}

export interface KpisDeContas {
  totalAberto: number;
  totalQuitado: number;
  contasVencidas: number;
  aVencer30: number;
  mediaMensal: number;
}

export interface PontoDeCategoria {
  name: string;
  value: number;
}

export interface PontoDeContraparte {
  nome: string;
  valor: number;
}

/** Um ponto do gráfico de evolução: `label` mais a série de quitado e a de aberto. */
export type PontoDeEvolucao = Record<string, string | number>;

export interface Evolucao {
  dados: PontoDeEvolucao[];
  titulo: string;
  modo: "anual" | "mensal";
  /** O ano do modo mensal; `null` no anual. */
  ano: number | null;
}

export const MESES_ABREV = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

export const ITENS_POR_PAGINA = 15;

export const ORDENACAO_INICIAL: Ordenacao = {
  campo: "vencimento",
  direcao: "asc",
};

/** No máximo oito fatias na pizza de categoria, contando a de "Outros". */
export const FATIAS_DE_CATEGORIA = 8;

/** O nome da fatia que junta tudo o que não coube nas sete maiores. */
export const FATIA_DE_OUTROS = "Outros";

/** No máximo dez barras no ranking de cliente/fornecedor. */
export const BARRAS_DE_CONTRAPARTE = 10;

// ── Formatação ─────────────────────────────────────────────────────────────

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── Situação ───────────────────────────────────────────────────────────────

// `estaQuitada` saiu: a linha da tabela traz `quitada` do banco, pela mesma
// regra que decidiu os KPIs logo acima dela. Duas cópias da mesma pergunta
// respondendo diferente é como um selo verde acaba numa linha que o KPI conta
// como aberta.

/** As duas situações que a tela desenha em amarelo enquanto estão no prazo. */
export function estaEmAberto(situacao: string | null): boolean {
  const s = situacao?.toLowerCase() ?? "";
  return s === "pendente" || s === "aberto";
}

// ── As três grandezas de uma conta ────────────────────────────────────────
//
// `quitado = valor - saldo`, `aberto = 0 se quitada senão saldo`, e
// `faturado = quitado + aberto` — a decisão do Erick em 31/08/2026 — saíram
// daqui em 2026-09-09 e moram em `core/contas_agregado.py`, no backend.
//
// Não é só onde a conta é feita: é onde ela PODE ser feita. Somar dez mil
// contas para mostrar cinco números custava 7,9 MB numa tela e 11,2 MB na
// outra, e enquanto os gráficos saíam dessa lista não dava para paginá-la —
// a primeira página seria lida como o total.
//
// O que a tela recebe agora já vem somado, e `estaQuitada` deixou de existir:
// a linha da tabela traz `quitada` do banco, pela mesma regra que decidiu os
// KPIs logo acima dela.

// ── Opções dos filtros ─────────────────────────────────────────────────────

/**
 * Os valores distintos e NÃO VAZIOS de um campo, na ordem do alfabeto
 * brasileiro.
 *
 * `localeCompare` com `pt-BR`, e não `.sort()` cru: o `sort` sem comparador
 * ordena por código UTF-16, e aí "Água" cai depois de "Zinco" na lista que a
 * pessoa lê (defeito 1.11).
 *
 * O vazio some das três listas. Situação e categoria já o tiravam; a de
 * cliente/fornecedor não, e um `cliente_nome` em branco virava uma opção
 * clicável escrita "(vazio)" — que não filtrava nada de útil e ainda dava a
 * entender que existe um cadastro chamado assim.
 */
// `opcoesDistintas` saiu: as três listas vêm em `resumo.opcoes`, montadas pelo
// banco sobre a base INTEIRA — uma lista que encolhe com o filtro escondia
// justamente a opção que a pessoa ia marcar em seguida.
//
// ⚠️ E lá elas são aparadas dos dois lados. Aqui só a lista era aparada, e a
// linha do banco não: uma categoria gravada com espaço no fim ficava
// inalcançável, e a pessoa marcava a opção e via menos contas sem nada
// indicando o porquê. Medido: 108 contas da Receita Federal em duas grafias
// que diferem só por espaço.

// ── Período ────────────────────────────────────────────────────────────────

/** O ano inteiro, para o clique numa barra do gráfico anual. */
export function periodoDoAno(ano: string): Periodo {
  return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
}

/**
 * O período que o clique numa barra do gráfico de evolução impõe, ou `null`
 * quando a barra não corresponde a período nenhum.
 */
export function periodoDaBarra(
  rotulo: string | undefined,
  modo: Evolucao["modo"],
  ano: number | null,
): Periodo | null {
  if (!rotulo) return null;
  if (modo === "anual") return periodoDoAno(rotulo);
  if (!ano) return null;
  const indice = MESES_ABREV.indexOf(rotulo as (typeof MESES_ABREV)[number]);
  if (indice === -1) return null;
  return periodoDoMes(ano, indice);
}

// ── Filtro, KPIs e gráficos ────────────────────────────────────────────────
//
// `filtrarContas`, `calcularKpis`, `montarCategorias` (a agregação) e
// `montarContrapartes` (idem) saíram daqui: os cinco filtros e as quatro somas
// são de `GET /contas_{pagar,receber}/resumo`. O que sobrou é o que sempre foi DESENHO —
// escolher entre a série anual e a mensal, cortar a pizza em oito fatias e o
// ranking em dez barras.

/**
 * A evolução, a partir das duas séries que o banco devolve: anual quando a
 * base tem mais de um ano, mensal quando tem um só.
 *
 * No modo mensal desenha os doze meses, inclusive os zerados — sem isso o
 * gráfico salta o mês parado e liga dois meses distantes como se fossem
 * vizinhos. No anual, só os anos que têm conta.
 *
 * A série de quitado leva o nome do dialeto (`recebido` ou `pago`) porque é
 * esse nome que aparece na legenda e no tooltip.
 */
export function montarEvolucao(
  porAno: readonly { ano: number; quitado: number; aberto: number }[],
  porMes: readonly {
    ano: number;
    mes: number;
    quitado: number;
    aberto: number;
  }[],
  dialeto: DialetoDeContas,
  agora: Date,
): Evolucao {
  const chave = dialeto.chaveQuitado;

  if (porAno.length > 1) {
    const dados = [...porAno]
      .sort((a, b) => a.ano - b.ano)
      .map(({ ano, quitado, aberto }) => ({
        label: String(ano),
        [chave]: quitado,
        aberto,
      }));
    return { dados, titulo: "Evolução Anual", modo: "anual", ano: null };
  }

  const ano = porAno[0]?.ano ?? agora.getFullYear();
  const meses: PontoDeEvolucao[] = MESES_ABREV.map((mes) => ({
    label: mes,
    [chave]: 0,
    aberto: 0,
  }));
  for (const linha of porMes) {
    const ponto = meses[linha.mes - 1];
    if (!ponto) continue;
    ponto[chave] = (ponto[chave] as number) + linha.quitado;
    ponto.aberto = (ponto.aberto as number) + linha.aberto;
  }
  return {
    dados: meses,
    titulo: `Evolução Mensal — ${ano}`,
    modo: "mensal",
    ano,
  };
}

/**
 * A pizza: passando de oito categorias, as SETE maiores ficam com o nome delas
 * e o resto vira uma fatia "Outros".
 *
 * Antes a pizza cortava na oitava e o que sobrava sumia do gráfico — e, pior,
 * o percentual que o recharts escreve em cada fatia era calculado sobre a soma
 * das oito, então as fatias somavam 100% de um total que não era o total
 * (defeito 1.12). Com "Outros" dentro dos dados, o percentual volta a ser sobre
 * o total de verdade sem precisar de conta nenhuma no desenho.
 *
 * A lista chega do banco ordenada por valor e somando `quitado + aberto` — a
 * mesma base dos KPIs, que é o que faz o topo da tela fechar com o gráfico.
 */
export function montarCategorias(
  linhas: readonly { nome: string; valor: number }[],
): PontoDeCategoria[] {
  const emPonto = ({
    nome,
    valor,
  }: {
    nome: string;
    valor: number;
  }): PontoDeCategoria => ({
    name: nome,
    value: valor,
  });

  if (linhas.length <= FATIAS_DE_CATEGORIA) return linhas.map(emPonto);

  const nomeadas = linhas.slice(0, FATIAS_DE_CATEGORIA - 1);
  const resto = linhas
    .slice(FATIAS_DE_CATEGORIA - 1)
    .reduce((total, linha) => total + linha.valor, 0);
  return [...nomeadas.map(emPonto), { name: FATIA_DE_OUTROS, value: resto }];
}

/** O ranking de cliente/fornecedor, no máximo dez — já vem ordenado do banco. */
export function montarContrapartes(
  linhas: readonly { nome: string; valor: number }[],
): PontoDeContraparte[] {
  return linhas
    .slice(0, BARRAS_DE_CONTRAPARTE)
    .map(({ nome, valor }) => ({ nome, valor }));
}

// ── Tabela ─────────────────────────────────────────────────────────────────

// A busca e a ordenação são do banco (item 9.4).
//
// A busca continua olhando os mesmos quatro campos — contraparte, categoria, nº
// do documento e histórico — e continua ignorando acento nos dois lados. Lá
// isso é `translate`, e não `unaccent`: a extensão não está instalada no
// servidor, o mesmo achado da macro `normalizar_texto` do dbt.
//
// Ordenar no navegador só ordenaria o que chegou, e com a página vindo do
// servidor isso significaria "as quinze primeiras, ordenadas por valor" — que
// parece o ranking de valor e não é. O que ficou aqui é o ESTADO do clique no
// cabeçalho, que continua sendo da tela.

export function proximaOrdenacao(atual: Ordenacao, campo: string): Ordenacao {
  return {
    campo,
    direcao: atual.campo === campo && atual.direcao === "desc" ? "asc" : "desc",
  };
}

// `fatiaDaPagina` saiu: a página vem do banco, com `LIMIT`/`OFFSET`. O
// `ITENS_POR_PAGINA` continua aqui porque agora é ele que vai no pedido.

// ── Planilha ───────────────────────────────────────────────────────────────

export interface FormatoDaPlanilha<C extends ContaBase> {
  /** Nome da aba e raiz do nome do arquivo. */
  aba: string;
  prefixoDoArquivo: string;
  /**
   * "Cliente" numa tela, "Fornecedor" na outra — o dado é o mesmo, o nome
   * dele no negócio não é.
   */
  rotuloDaContraparte: string;
  /**
   * As colunas que só existem numa das duas APIs, entre `Situação` e
   * `Cidade`: `Forma Pagamento`/`Portador` em Receber, `Ocorrência` em Pagar.
   */
  colunasProprias: (conta: C) => Record<string, unknown>;
}

/**
 * As linhas que vão para o `xlsx`, na ordem em que as colunas aparecem.
 *
 * Dinheiro sai como NÚMERO (para o Excel somar) e data sai como texto
 * `dd/mm/aaaa`, pelo `dataDeCalendario` de `src/lib/datas.ts` — o mesmo das
 * telas de Locação e Usuários. A `formatarData` daqui fatiava a string em `-`
 * e ignorava o `T`, então uma data com hora saía `18T10:00:00/01/2026`; e a
 * ausência virava o hífen `-`, enquanto o resto do sistema usa o travessão.
 *
 * `Situação` é sempre a que o Tiny mandou, e o vencimento vira uma coluna
 * PRÓPRIA (`Vencida`, com Sim/Não). Antes a `Situação` era trocada por
 * "Vencida" e quem abria a planilha não distinguia mais "pendente" de
 * "aberto" depois do vencimento (defeito 1.5). Coluna à parte, e não sufixo
 * dentro da `Situação`, porque no Excel é ela que se filtra e se agrupa:
 * "pendente · Vencida" viraria uma categoria nova em toda tabela dinâmica.
 */
export function linhasDaPlanilha<C extends ContaBase>(
  contas: C[],
  formato: FormatoDaPlanilha<C>,
): Record<string, unknown>[] {
  return contas.map((conta) => ({
    "ID Tiny": conta.id_tiny,
    [formato.rotuloDaContraparte]: conta.cliente_nome,
    CPF_CNPJ: conta.cliente_cpf_cnpj ?? "",
    Categoria: conta.categoria ?? "",
    "Nº Documento": conta.nro_documento ?? "",
    Histórico: conta.historico ?? "",
    Valor: conta.valor,
    Saldo: conta.saldo,
    Emissão: dataDeCalendario(conta.emissao),
    Vencimento: dataDeCalendario(conta.vencimento),
    Liquidação: dataDeCalendario(conta.liquidacao),
    Situação: conta.situacao ?? "",
    Vencida: conta.vencida ? "Sim" : "Não",
    ...formato.colunasProprias(conta),
    Cidade: conta.cliente_cidade ?? "",
    UF: conta.cliente_uf ?? "",
  }));
}

/**
 * `contas_a_receber_2026-08-31.xlsx`.
 *
 * A data é o DIA LOCAL. Saía de `toISOString` (UTC), e a partir das 21h de
 * Brasília o arquivo já ia arquivado com a data do dia seguinte (defeito 1.4).
 */
export function nomeDoArquivo(prefixo: string, agora: Date): string {
  return `${prefixo}_${diaLocal(agora)}.xlsx`;
}
