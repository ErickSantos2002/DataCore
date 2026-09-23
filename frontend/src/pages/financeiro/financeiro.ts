import { converterParaNumero } from "../../lib/dinheiro";

/**
 * As contas do Gerenciamento Financeiro, sem React.
 *
 * A tela agrega dois fluxos que a API entrega separados — notas de venda e
 * notas de serviço — em uma série por ano e mês, e daí tira tudo o que
 * mostra: KPI de ano, comparativo mensal, acumulado, variação ano contra ano
 * e o balancete. Nada disso estava escrito fora da tela, e é o número que a
 * diretoria lê. Aqui as contas ficam testáveis por fora e a tela vira
 * composição.
 */

/**
 * A janela de anos da tela. É lista fechada, e não `ano atual − 4`, porque a
 * base do Tiny começa em 2022 — antes disso não há nota para comparar.
 */
export const ANOS = [2022, 2023, 2024, 2025, 2026] as const;
export type Ano = (typeof ANOS)[number];

/** Os pares que a tela compara: cada ano contra o anterior. */
export const PARES_YOY: [Ano, Ano][] = [
  [2022, 2023],
  [2023, 2024],
  [2024, 2025],
  [2025, 2026],
];

export const MESES = [
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
];

/** O que entra na conta: só venda, só serviço, ou os dois. */
export type TipoDeReceita = "combinado" | "vendas" | "servicos";

/**
 * O plano de contas do Tiny, pelo número que abre a categoria. É o que
 * transforma "3 - CUSTOS E DESPESAS FIXAS - SERVIÇOS DE APOIO" no grupo "3":
 * o Tiny não tem campo de grupo, o grupo mora no começo do texto.
 */
export const GRUPOS_DE_CATEGORIA: Record<string, string> = {
  "1": "1 - CUSTOS E DESPESAS FIXAS - EQUIPE",
  "2": "2 - CUSTOS E DESPESAS FIXAS - SEDE",
  "3": "3 - CUSTOS E DESPESAS FIXAS - SERVIÇOS DE APOIO",
  "4": "4 - CUSTOS E DESPESAS FIXAS - GERAIS",
  "5": "5 - CUSTOS E DESPESAS FIXAS - DIRETORIA",
  "6": "6 - CUSTOS E DESPESAS VARIÁVEIS - MATERIAIS",
  "7": "7 - CUSTOS E DESPESAS VARIÁVEIS - IMPOSTO INDIRETO",
  "8": "8 - CUSTOS E DESPESAS VARIÁVEIS - IMPOSTO DIRETO",
  "9": "9 - CUSTOS E DESPESAS - FINANCEIRAS",
  "10": "10 - OUTROS CUSTOS",
  "11": "11 - RECEITAS - VENDAS",
  "12": "12 - RECEITAS - SERVIÇO",
};

/** Rótulo das duas linhas de entrada, que não vêm do plano de contas. */
export const ROTULO_DE_ENTRADA: Record<string, string> = {
  vendas: "RECEITAS - VENDAS",
  servicos: "RECEITAS - SERVIÇO",
};

/**
 * O rótulo do grupo sem categoria.
 *
 * "SEM CATEGORIA", e não "Outros": diz POR QUE a linha existe — são contas
 * que não foram classificadas no plano de contas do Tiny — em vez de parecer
 * mais uma categoria entre as outras. Quem lê o balancete e vê o valor sabe
 * onde ir consertar.
 */
export const ROTULO_SEM_CATEGORIA = "SEM CATEGORIA";

/**
 * Dinheiro na tela. Zero vira travessão de propósito: nesta tela zero quase
 * sempre é mês que ainda não aconteceu, não valor apurado. É a regra do
 * design — "zero como dado ainda não existente mostra —".
 */
export function formatarMoeda(valor: number): string {
  return valor === 0
    ? "—"
    : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Percentual na tela: uma casa e sinal explícito quando positivo. */
export function formatarVariacao(valor: number | null): string {
  if (valor === null) return "—";
  return `${valor >= 0 ? "+" : ""}${valor.toFixed(1)}%`;
}

/** A chave da série de variação de um par de anos — `var20262025`. */
export function chaveDaVariacao(base: Ano, comp: Ano): string {
  return `var${comp}${base}`;
}

/**
 * A chave do grupo de contas cuja categoria não segue o plano de contas.
 *
 * Existe como constante porque três lugares precisam concordar sobre ela: o
 * agrupamento, a ordenação (ela não tem número, então vai por último) e o
 * rótulo da linha.
 */
export const GRUPO_SEM_CATEGORIA = "outros";

/** O número que abre a categoria, ou `outros` quando não há número. */
export function prefixoDaCategoria(
  categoria: string | null | undefined,
): string {
  if (!categoria) return GRUPO_SEM_CATEGORIA;
  const achado = categoria.match(/^(\d+)/);
  return achado ? achado[1] : GRUPO_SEM_CATEGORIA;
}

/**
 * Uma linha de `GET /faturamento/mensal` — um mês de um ano, já somado pelo
 * banco a partir da camada `gold`.
 *
 * A tela não vê mais nota nenhuma. Antes ela baixava as 4.352 notas de venda
 * com cliente, itens e marcadores dentro (cerca de 9,7 MB) para somar doze
 * números por ano; agora recebe os números somados. E, mais importante que o
 * tamanho: quem decide o que é venda passou a ser a régua única do `gold`, não
 * este arquivo.
 */
export interface LinhaDeFaturamento {
  ano: number;
  /** 1 = janeiro. */
  mes: number;
  produto: number;
  servico: number;
  quantidade_produto: number;
  quantidade_servico: number;
}

/** Só o que o balancete lê de uma conta a pagar. */
export interface ContaDoBalancete {
  data_emissao: string;
  categoria: string | null;
  valor: string | number;
}

/** Doze meses por ano da janela. */
export type SeriePorAnoMes = Record<number, number[]>;

function serieZerada(): SeriePorAnoMes {
  const serie: SeriePorAnoMes = {};
  for (const ano of ANOS) serie[ano] = Array(12).fill(0);
  return serie;
}

/** As quatro leituras que a tela faz da resposta da API. */
export interface FaturamentoDaJanela {
  vendas: SeriePorAnoMes;
  servicos: SeriePorAnoMes;
  /** Quantas notas de venda em cada ano. */
  notasDeVenda: ContagemPorAno;
  /** Quantas notas de serviço em cada ano. */
  notasDeServico: ContagemPorAno;
}

/** Um número por ano da janela. */
export type ContagemPorAno = Record<number, number>;

/**
 * Distribui as linhas mensais da API nas séries que a tela desenha.
 *
 * Linha de ano fora da janela é descartada em silêncio — é o mesmo cuidado que
 * a soma no navegador tinha, e continua valendo porque a API aceita a faixa
 * que quem chama pedir: se um dia alguém pedir 2015 aqui, 2015 não pode
 * aparecer somado dentro de 2022.
 *
 * Mês fora de 1..12 também é ignorado. Não deveria existir — a API monta os
 * meses com `generate_series` — mas o índice do array é calculado a partir
 * dele, e um mês 0 ou 13 escreveria fora da série sem erro nenhum.
 */
export function seriesDaApi(linhas: LinhaDeFaturamento[]): FaturamentoDaJanela {
  const vendas = serieZerada();
  const servicos = serieZerada();
  const notasDeVenda: ContagemPorAno = {};
  const notasDeServico: ContagemPorAno = {};
  for (const ano of ANOS) {
    notasDeVenda[ano] = 0;
    notasDeServico[ano] = 0;
  }

  for (const linha of linhas) {
    if (!(linha.ano in vendas)) continue;
    const mes = linha.mes - 1;
    if (mes < 0 || mes > 11) continue;
    vendas[linha.ano][mes] += linha.produto || 0;
    servicos[linha.ano][mes] += linha.servico || 0;
    notasDeVenda[linha.ano] += linha.quantidade_produto || 0;
    notasDeServico[linha.ano] += linha.quantidade_servico || 0;
  }

  return { vendas, servicos, notasDeVenda, notasDeServico };
}

/** Aplica o filtro de tipo às duas séries. */
export function combinarPorTipo(
  tipo: TipoDeReceita,
  vendas: SeriePorAnoMes,
  servicos: SeriePorAnoMes,
): SeriePorAnoMes {
  const serie: SeriePorAnoMes = {};
  for (const ano of ANOS) {
    serie[ano] = Array(12)
      .fill(0)
      .map((_, mes) => {
        const venda = tipo !== "servicos" ? vendas[ano][mes] : 0;
        const servico = tipo !== "vendas" ? servicos[ano][mes] : 0;
        return venda + servico;
      });
  }
  return serie;
}

/** O total do ano inteiro de uma série. */
export function somaDoAno(serie: SeriePorAnoMes, ano: number): number {
  return (serie[ano] ?? Array(12).fill(0)).reduce(
    (soma: number, valor: number) => soma + valor,
    0,
  );
}

/**
 * Crescimento percentual de `base` para `comp`.
 *
 * Base zerada devolve `null`, não `Infinity`: mês que ainda não aconteceu
 * não tem crescimento, e a tela mostra travessão no lugar.
 */
export function crescimento(base: number, comp: number): number | null {
  return base > 0 ? ((comp - base) / base) * 100 : null;
}

export interface KpiDeAno {
  ano: Ano;
  total: number;
  /** Quantas notas entraram, já respeitando o filtro de tipo. */
  quantidade: number;
  /** Contra o ano anterior da janela; `null` quando não há com o que comparar. */
  crescimento: number | null;
}

export function kpisPorAno(
  total: SeriePorAnoMes,
  notasDeVenda: ContagemPorAno,
  notasDeServico: ContagemPorAno,
  tipo: TipoDeReceita,
): KpiDeAno[] {
  return ANOS.map((ano, indice) => {
    const totalDoAno = somaDoAno(total, ano);
    const totalAnterior = indice > 0 ? somaDoAno(total, ANOS[indice - 1]) : 0;
    // Quem conta as notas é o banco. A contagem de venda é de NOTAS distintas,
    // e não de linhas do fato — `gold.fato_vendas` tem grão de item, e contar
    // linhas devolveria quase mil e quinhentas notas a mais.
    const deVendas = tipo !== "servicos" ? (notasDeVenda[ano] ?? 0) : 0;
    const deServicos = tipo !== "vendas" ? (notasDeServico[ano] ?? 0) : 0;
    return {
      ano,
      total: totalDoAno,
      quantidade: deVendas + deServicos,
      // Ano sem faturamento não exibe crescimento: dizer "−100% vs 2025" num
      // ano que ainda nem começou seria ler o futuro como queda.
      crescimento:
        totalDoAno > 0 ? crescimento(totalAnterior, totalDoAno) : null,
    };
  });
}

/** Um mês, com a variação de cada um dos quatro pares de anos. */
export type PontoDeVariacao = Record<string, string | number | null>;

export function variacaoMensal(total: SeriePorAnoMes): PontoDeVariacao[] {
  return MESES.map((mes, indice) => {
    const ponto: PontoDeVariacao = { mes };
    for (const [base, comp] of PARES_YOY) {
      ponto[chaveDaVariacao(base, comp)] = crescimento(
        total[base][indice],
        total[comp][indice],
      );
    }
    return ponto;
  });
}

/** Um mês, com uma série por ano ligado. */
export type PontoAnual = Record<string, string | number>;

export function pontosComparativos(
  total: SeriePorAnoMes,
  anosAtivos: Set<Ano>,
): PontoAnual[] {
  return MESES.map((mes, indice) => {
    const ponto: PontoAnual = { mes };
    for (const ano of ANOS) {
      if (anosAtivos.has(ano)) ponto[ano.toString()] = total[ano][indice];
    }
    return ponto;
  });
}

/** O mesmo comparativo, acumulado de janeiro até o mês. */
export function pontosAcumulados(
  total: SeriePorAnoMes,
  anosAtivos: Set<Ano>,
): PontoAnual[] {
  return MESES.map((mes, indice) => {
    const ponto: PontoAnual = { mes };
    for (const ano of ANOS) {
      if (!anosAtivos.has(ano)) continue;
      ponto[ano.toString()] = total[ano]
        .slice(0, indice + 1)
        .reduce((soma, valor) => soma + valor, 0);
    }
    return ponto;
  });
}

/**
 * Liga ou desliga um ano, sem nunca deixar a seleção vazia.
 *
 * Desligar o último ano deixaria o gráfico em branco e sem pista de como
 * voltar — o guarda de tamanho é o que impede.
 */
export function alternarAno(anosAtivos: Set<Ano>, ano: Ano): Set<Ano> {
  const proximo = new Set(anosAtivos);
  if (proximo.has(ano)) {
    if (proximo.size > 1) proximo.delete(ano);
  } else {
    proximo.add(ano);
  }
  return proximo;
}

export interface Balancete {
  /** Doze meses de cada linha de entrada, por chave (`vendas`, `servicos`). */
  entradas: Record<string, number[]>;
  /** Doze meses de cada grupo de saída, pelo prefixo da categoria. */
  saidas: Record<string, number[]>;
  totalEntradasMes: number[];
  totalSaidasMes: number[];
  saldoMes: number[];
  /** As chaves de entrada na ordem de exibição. */
  linhasDeEntrada: string[];
  /** Os grupos de saída na ordem de exibição — numérica, não alfabética. */
  linhasDeSaida: string[];
  pontosDoGrafico: { mes: string; Entradas: number; Saídas: number }[];
  totalEntradasAno: number;
  totalSaidasAno: number;
  saldoDoAno: number;
}

/**
 * O balancete de um ano: entradas de venda e serviço contra as contas a pagar
 * agrupadas pelo plano de contas.
 *
 * Conta cuja categoria não começa por número cai no grupo `outros`, e ele
 * **entra em `linhasDeSaida`**, por último. Antes era filtrado da listagem e
 * continuava somando no total, e o balancete fechava com um valor que nenhuma
 * linha visível explicava. Escondê-lo do total não era alternativa: são saídas
 * de dinheiro de verdade, e tirá-las tornaria o saldo do período errado.
 */
export function montarBalancete(
  vendas: SeriePorAnoMes,
  servicos: SeriePorAnoMes,
  contas: ContaDoBalancete[],
  ano: number,
): Balancete {
  const entradas: Record<string, number[]> = {
    vendas: [...(vendas[ano] ?? Array(12).fill(0))],
    servicos: [...(servicos[ano] ?? Array(12).fill(0))],
  };

  const saidas: Record<string, number[]> = {};
  for (const conta of contas) {
    if (!conta.data_emissao) continue;
    const partes = conta.data_emissao.split("-");
    if (Number(partes[0]) !== ano) continue;
    const mes = Number(partes[1]) - 1;
    const grupo = prefixoDaCategoria(conta.categoria);
    if (!saidas[grupo]) saidas[grupo] = Array(12).fill(0);
    // O valor vem do Tiny ora número, ora texto, nos dois formatos. A tela
    // tinha a própria leitura, que sem vírgula tratava o ponto como decimal:
    // uma conta de "1.234" entrava no balancete como R$ 1,23. O módulo de
    // dinheiro distingue milhar de decimal pelo agrupamento de três dígitos,
    // que é a única pista que existe.
    saidas[grupo][mes] += converterParaNumero(conta.valor);
  }

  const porMes = (linhas: Record<string, number[]>) =>
    Array(12)
      .fill(0)
      .map((_, mes) =>
        Object.values(linhas).reduce((soma, valores) => soma + valores[mes], 0),
      );

  const totalEntradasMes = porMes(entradas);
  const totalSaidasMes = porMes(saidas);
  const saldoMes = totalEntradasMes.map(
    (entrada, mes) => entrada - totalSaidasMes[mes],
  );

  const totalEntradasAno = totalEntradasMes.reduce((a, b) => a + b, 0);
  const totalSaidasAno = totalSaidasMes.reduce((a, b) => a + b, 0);

  return {
    entradas,
    saidas,
    totalEntradasMes,
    totalSaidasMes,
    saldoMes,
    linhasDeEntrada: ["vendas", "servicos"].filter(
      (chave) => chave in entradas,
    ),
    // Ordem numérica, não alfabética: como texto, "10" viria antes de "2". O
    // grupo sem categoria não tem número e por isso vai depois de todos.
    linhasDeSaida: [
      ...Object.keys(saidas)
        .filter((grupo) => grupo !== GRUPO_SEM_CATEGORIA)
        .sort((a, b) => Number(a) - Number(b)),
      ...(GRUPO_SEM_CATEGORIA in saidas ? [GRUPO_SEM_CATEGORIA] : []),
    ],
    pontosDoGrafico: MESES.map((mes, indice) => ({
      mes,
      Entradas: totalEntradasMes[indice],
      Saídas: totalSaidasMes[indice],
    })),
    totalEntradasAno,
    totalSaidasAno,
    saldoDoAno: totalEntradasAno - totalSaidasAno,
  };
}
