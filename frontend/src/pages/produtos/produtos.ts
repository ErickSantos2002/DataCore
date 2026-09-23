import type { RecorteComercial } from "../comercial/useComercial";
import type {
  FiltrosComerciais,
  ResumoComercial,
} from "../../services/notasapi";

/**
 * A conta pura da tela de Produtos, separada de `Produtos.tsx`.
 *
 * Extração inerte da Task 2 do plano
 * `docs/superpowers/plans/2026-09-10-fase-3-produtos-sobre-origin.md` (o texto
 * anterior citava uma "Task 3 do plano de 08/09/2026", que não existe neste
 * repositório — veio colado junto do arquivo, copiado verbatim de
 * `79954c07`): cada função aqui é um
 * `useMemo` que saiu do componente sem mudar de comportamento — perdeu o
 * `useMemo` em volta e ganhou como parâmetro o que antes vinha do escopo. Os
 * `useMemo` continuam na tela, chamando estas funções; o motivo está no
 * docblock de `src/hooks/usePaginacao.ts` (a lista precisa manter identidade
 * entre renders com os mesmos parâmetros, senão a paginação estoura).
 *
 * ⚠️ A fonte do dado mudou (item 9.4): a tela deixou de baixar as notas
 * inteiras pelo `DataContext` e passou a ler o resumo já somado pelo Postgres,
 * via `useComercial`. Com isso morreram daqui `opcoesDeFiltro` (hoje é
 * `useFiltrosComerciais().opcoes`), `filtrarNotas` (hoje é o recorte que vai
 * para o servidor), `agregarProdutos` (hoje é `resumo.por_produto`) e a metade
 * de `evolucaoPorMes` que percorria as notas somando por mês. O que nasceu no
 * lugar são as traduções entre o que a tela mostra e o que o servidor quer.
 *
 * Onde a lógica movida tem cara de defeito, o comentário registra o achado
 * sem corrigir — corrigir junto de mover impede saber qual dos dois quebrou.
 */

/** Um produto agregado a partir dos itens das notas filtradas. */
export interface ProdutoAgregado {
  /**
   * A identidade da linha, e o que o React usa de `key` na tabela.
   *
   * Vem do `por_produto` do resumo, onde é o código quando ele existe e
   * `'#' + descricao` quando não existe. É dado INTERNO: não aparece em coluna
   * nenhuma. O `codigo` não serve de identidade porque item sem código vira
   * `""`, e dois deles colidiriam na mesma `key`.
   */
  chave: string;
  codigo: string;
  descricao: string;
  quantidadeVendida: number;
  valorTotal: number;
  valorMedio: number;
  numeroVendas: number;
}

/** Os quatro números do topo da tela. */
export interface KpisDeProduto {
  totalProdutosVendidos: number;
  totalFaturado: number;
  ticketMedio: number;
  produtoMaisVendido: ProdutoAgregado | null;
  totalProdutosUnicos: number;
}

/** Um ponto do gráfico de evolução mensal (ou anual, quando agrupado). */
export interface PontoDeEvolucao {
  mes: string;
  total: number;
  ordem: number;
  /** Só existe nos pontos mensais — o agrupamento anual não carrega ano por ponto. */
  ano?: number;
}

/** Os quatro filtros do topo da tela. */
export interface FiltrosDeProdutos {
  empresa: string[];
  vendedor: string[];
  produto: string[];
  dataInicio: string;
  dataFim: string;
}

/** A ordenação da tabela de produtos. */
export interface OrdenacaoDeProdutos {
  campo: string;
  direcao: "asc" | "desc";
}

// ── Rótulos e recorte ──────────────────────────────────────────────────────

/**
 * O que o multi-select de empresas mostra — e devolve.
 *
 * Achado ao mover (não corrigido): `nome` e `cpf_cnpj` são nuláveis em
 * `FiltrosComerciais`, e a interpolação transforma o nulo no texto "null" —
 * um cliente sem nome aparece na lista como "null (12.345.678/0001-90)".
 */
export function rotuloDoCliente(c: {
  nome: string | null;
  cpf_cnpj: string | null;
}): string {
  return `${c.nome} (${c.cpf_cnpj})`;
}

/** O que o multi-select de produtos mostra — e devolve. */
export function rotuloDoProduto(p: {
  descricao: string | null;
  codigo: string | null;
}): string {
  return `${p.descricao} (${p.codigo ?? "sem código"})`;
}

/**
 * A tradução do rótulo escolhido de volta para o que o servidor entende.
 *
 * O multi-select trabalha com texto; o backend filtra cliente por **id** e
 * produto por **chave**. Estes dois `Map` fazem a volta.
 */
export interface IndicesDeRotulo {
  idPorRotulo: Map<string, number>;
  chavePorRotulo: Map<string, string>;
}

/**
 * Os dois índices, montados a partir das opções que o servidor devolveu.
 *
 * Achado ao mover (não corrigido): a chave do `Map` é o rótulo. Dois clientes
 * com o mesmo `nome (cpf_cnpj)` colapsam num só — o último vence, e escolher
 * aquele rótulo passa a filtrar pelo id do outro, sem aviso.
 */
export function indicesDeRotulo(opcoes: FiltrosComerciais): IndicesDeRotulo {
  const idPorRotulo = new Map<string, number>();
  opcoes.clientes.forEach((c) => idPorRotulo.set(rotuloDoCliente(c), c.id));

  const chavePorRotulo = new Map<string, string>();
  opcoes.produtos.forEach((p) =>
    chavePorRotulo.set(rotuloDoProduto(p), p.chave),
  );

  return { idPorRotulo, chavePorRotulo };
}

/**
 * Os filtros da tela virados o recorte que vai para o servidor.
 *
 * Rótulo que não está no índice é **descartado** (`filter` de `undefined`), e
 * não vira filtro vazio: mandar `cliente_id=` zeraria a tela em vez de
 * ignorar o item — ver o docblock de `paramsDoRecorte`.
 */
export function recorteDeProdutos(
  filtros: FiltrosDeProdutos,
  indices: IndicesDeRotulo,
): RecorteComercial {
  return {
    clientes: filtros.empresa
      .map((r) => indices.idPorRotulo.get(r))
      .filter((id): id is number => id !== undefined),
    vendedores: filtros.vendedor,
    produtos: filtros.produto
      .map((r) => indices.chavePorRotulo.get(r))
      .filter((c): c is string => c !== undefined),
    dataInicio: filtros.dataInicio,
    dataFim: filtros.dataFim,
  };
}

// ── Agregação ──────────────────────────────────────────────────────────────

/**
 * O `por_produto` do resumo virado a lista que a tabela e os KPIs leem.
 *
 * A soma é do Postgres; o que sobra aqui é renomear campo e derivar o valor
 * médio, que o servidor não manda.
 *
 * ⚠️ A agregação passou a incluir item SEM código (36 itens, 0,12% do valor),
 * que a versão anterior descartava com um `if (!item.codigo) return`.
 *
 * A `chave` do resumo vem junto de propósito: item sem código vira
 * `codigo: ""`, e dois deles colidiriam na mesma `key` do React em
 * `TabelaDeProdutos`. A `chave` já distingue os dois (`'#' + descricao` quando
 * não há código) e antes era jogada fora aqui.
 */
export function produtosDoResumo(
  porProduto: ResumoComercial["por_produto"],
): ProdutoAgregado[] {
  return porProduto.map((p) => ({
    chave: p.chave,
    codigo: p.codigo ?? "",
    descricao: p.descricao ?? "",
    quantidadeVendida: p.quantidade,
    valorTotal: p.valor,
    valorMedio: p.quantidade > 0 ? p.valor / p.quantidade : 0,
    numeroVendas: p.notas,
  }));
}

// ── KPIs ───────────────────────────────────────────────────────────────────

/**
 * Os quatro números do topo.
 *
 * Achado ao mover (não corrigido): com lista vazia, `produtosAgregados[0]` é
 * `undefined` e o `reduce` de `produtoMaisVendido` devolve `undefined`, que a
 * guarda `|| null` converte para `null` — mas `ticketMedio` só escapa do
 * `0/0` porque tem a guarda explícita `totalProdutosVendidos > 0`.
 */
export function calcularKpis(agregados: ProdutoAgregado[]): KpisDeProduto {
  const totalProdutosVendidos = agregados.reduce(
    (acc, p) => acc + p.quantidadeVendida,
    0,
  );
  const totalFaturado = agregados.reduce((acc, p) => acc + p.valorTotal, 0);
  const ticketMedio =
    totalProdutosVendidos > 0 ? totalFaturado / totalProdutosVendidos : 0;

  // Produto mais vendido (por quantidade)
  const produtoMaisVendido = agregados.reduce(
    (max, p) => (p.quantidadeVendida > (max?.quantidadeVendida || 0) ? p : max),
    agregados[0],
  );

  return {
    totalProdutosVendidos,
    totalFaturado,
    ticketMedio,
    produtoMaisVendido: produtoMaisVendido || null,
    totalProdutosUnicos: agregados.length,
  };
}

// ── Gráficos ───────────────────────────────────────────────────────────────

/**
 * A `evolucao_mensal` do resumo virada os pontos do gráfico de linha.
 *
 * A quantidade vem do banco já com o filtro de produto aplicado no nível do
 * ITEM — que é a distinção que esta tela faz e a de Vendas não: lá o filtro
 * escolhe notas, aqui ele escolhe itens.
 *
 * O agrupamento por ano acima de 24 meses continua sendo decisão da tela e
 * não do banco, então sobreviveu inteiro do `evolucaoPorMes` que morreu.
 */
export function evolucaoDoResumo(
  evolucaoMensal: ResumoComercial["evolucao_mensal"],
): PontoDeEvolucao[] {
  const dadosMensais = evolucaoMensal.map((m) => {
    const data = new Date(m.ano, m.mes - 1);
    return {
      mes: data.toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
      }),
      total: m.quantidade,
      ordem: data.getTime(),
      ano: m.ano,
    };
  });

  // Se tiver mais de 24 meses, agrupa por ano
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
 * O top N de produtos por valor total.
 *
 * Devolve `ProdutoAgregado[]` — a conversão para a forma que o `BarChart`
 * espera (`{ produto, valor }`) é da tela, não desta conta.
 */
export function rankingPorValor(
  agregados: ProdutoAgregado[],
  limite: number,
): ProdutoAgregado[] {
  return [...agregados]
    .sort((a, b) => b.valorTotal - a.valorTotal)
    .slice(0, limite);
}

// ── Tabela ─────────────────────────────────────────────────────────────────

/** −1, 0 ou 1: a comparação de `<` e `>` que a tabela sempre usou, com o 0. */
function crescente(a: string | number, b: string | number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A pesquisa e a ordenação da tabela de produtos, nessa ordem. */
export function ordenarEBuscar(
  agregados: ProdutoAgregado[],
  pesquisa: string,
  ordenacao: OrdenacaoDeProdutos,
): ProdutoAgregado[] {
  let filtrados = [...agregados];

  // Aplicar pesquisa
  if (pesquisa) {
    const termoLower = pesquisa.toLowerCase();
    filtrados = filtrados.filter((p) => {
      return (
        p.descricao?.toLowerCase().includes(termoLower) ||
        p.codigo?.toLowerCase().includes(termoLower)
      );
    });
  }

  // Aplicar ordenação
  filtrados.sort((a, b) => {
    let aVal: any, bVal: any;

    switch (ordenacao.campo) {
      // Sem este `case`, "codigo" caía no `default: return 0` e o clique no
      // cabeçalho da coluna Código mudava o estado de ordenação sem mexer em
      // uma linha da tabela. Mesmo padrão de "descricao": fallback para
      // string vazia antes de comparar, porque item sem código vira `""`.
      case "codigo":
        aVal = a.codigo || "";
        bVal = b.codigo || "";
        break;
      case "descricao":
        aVal = a.descricao || "";
        bVal = b.descricao || "";
        break;
      case "quantidadeVendida":
        aVal = a.quantidadeVendida;
        bVal = b.quantidadeVendida;
        break;
      case "valorTotal":
        aVal = a.valorTotal;
        bVal = b.valorTotal;
        break;
      case "valorMedio":
        aVal = a.valorMedio;
        bVal = b.valorMedio;
        break;
      default:
        return 0;
    }

    // O comparador nunca devolvia 0: num empate respondia −1 para (a, b) e
    // para (b, a), e a ordem final dependia da ordem de chegada — a mesma
    // tabela mudava de uma carga para outra. Empate agora desempata pela
    // descrição e, nela, pelo código, sempre crescente (como em Estoque).
    const sentido = ordenacao.direcao === "asc" ? 1 : -1;
    return (
      sentido * crescente(aVal, bVal) ||
      crescente(a.descricao || "", b.descricao || "") ||
      crescente(a.codigo || "", b.codigo || "")
    );
  });

  return filtrados;
}

// ── Planilha ─────────────────────────────────────────────────────────────

/**
 * As linhas que vão para o Excel — a modelagem sai de `Produtos.tsx` (era
 * `.map()` solto dentro de `exportarExcel`) para virar conta pura, igual às
 * gêmeas de Contas e Locação.
 *
 * Recebe o resultado de `ordenarEBuscar` INTEIRO, não `produtosPaginados`: a
 * paginação de 15 linhas é só da tabela em tela, e quem clica em exportar
 * espera o recorte filtrado/ordenado completo — não a página em que estava.
 */
export function linhasDaPlanilha(
  agregados: ProdutoAgregado[],
): Record<string, unknown>[] {
  return agregados.map((p) => ({
    Código: p.codigo,
    Produto: p.descricao,
    "Quantidade Vendida": p.quantidadeVendida,
    "Valor Total": p.valorTotal,
    "Valor Médio": p.valorMedio,
    "Número de Vendas": p.numeroVendas,
  }));
}
