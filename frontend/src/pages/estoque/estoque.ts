/**
 * A conta pura da tela de Estoque, separada de `Estoque.tsx`.
 *
 * Cada função aqui é um `useMemo` que saiu do componente sem mudar de
 * comportamento. Os `useMemo` continuam na casca: `usePaginacao` volta para a
 * página 1 quando a lista muda de IDENTIDADE, e uma lista nova a cada render
 * prenderia a tabela na primeira página.
 *
 * Ao contrário das telas do Comercial, aqui a conta é toda do navegador: o
 * `EstoqueContext` entrega o catálogo inteiro (algumas centenas de produtos) e
 * a tela filtra, soma e ordena.
 *
 * Onde a lógica movida tem cara de defeito, o comentário registra o achado sem
 * corrigir — corrigir junto de mover impede saber qual dos dois quebrou.
 */

export interface ProdutoEstoque {
  id: number;
  nome: string;
  codigo: string;
  /** `null` quando o produto foi cadastrado no Tiny sem unidade. */
  unidade: string | null;
  preco: number;
  saldo: number;
  /** A = ativo, I = inativo. */
  situacao: "A" | "I";
}

/**
 * Os produtos do filtro "Principais": os bafômetros, seus kits e módulos, e os
 * bocais e bobinas que eles consomem.
 *
 * A lista é cravada no código por decisão do Erick (22/09): um produto novo só
 * entra com deploy. Até 22/09 eram só os 29 códigos, sem nome — "121" não diz a
 * ninguém que produto é, e um código trocado passava despercebido. O nome é o
 * do Tiny em 22/09 (`tiny.estoque`), só para quem lê; o filtro casa pelo código.
 */
export const PRODUTOS_PRINCIPAIS: readonly { codigo: string; nome: string }[] =
  [
    { codigo: "1", nome: "BAFÔMETRO - MARK X" },
    { codigo: "3", nome: "KIT BAFÔMETRO - MARK X PLUS COM IMPRESSORA" },
    { codigo: "163", nome: "Bafômetro Mercury" },
    { codigo: "4", nome: "Kit Mercury com Impressora" },
    { codigo: "121", nome: "BAFÔMETRO PASSIVO - IBLOW C" },
    { codigo: "210", nome: "BAFÔMETRO PASSIVO - IBLOW 10 PRO" },
    { codigo: "63", nome: "BAFÔMETRO PAREDE - EBS 10" },
    { codigo: "119", nome: "BAFÔMETRO - DEIMOS" },
    { codigo: "186", nome: "BAFÔMETRO - TITAN ELITE" },
    { codigo: "156", nome: "BAFÔMETRO - TITAN IGNIÇÃO" },
    { codigo: "99", nome: "BAFÔMETRO PHOEBUS" },
    { codigo: "320", nome: "Breath Alcohol Analyzer Model: Phoebus (Advance)" },
    { codigo: "317", nome: "BAFÔMETRO PHOEBUS PRO C/ TAMPA" },
    { codigo: "318", nome: "BAFÔMETRO PHOEBUS PRO QR CODE" },
    { codigo: "7", nome: "KIT IMPRESSORA TÉRMICA - BAFÔMETRO MERCURY" },
    { codigo: "80", nome: "Breath Alcohol Tester - AL8800BT" },
    { codigo: "189", nome: "IMPRESSORA BAFÔMETRO PHOEBUS" },
    { codigo: "128", nome: "MÓDULO DO PHOEBUS" },
    { codigo: "297", nome: "EBS010-M - MÓDULO DE CALIBRACAO PARA BAFOMETRO" },
    { codigo: "15", nome: "BOBINA TERMICA COR AMARELA - PACOTE COM 10 UN" },
    { codigo: "13", nome: "PACOTE COM 100 UN - BOCAL ATIVO MARK X" },
    { codigo: "21", nome: "PACOTE COM 10 UN - BOCAL PASSIVO MARK X" },
    { codigo: "8", nome: "PACOTE COM 100 UN - BOCAL ATIVO MERCURY/JUPITER" },
    { codigo: "22", nome: "PACOTE COM 10 UN - BOCAL PASSIVO MERCURY" },
    { codigo: "118", nome: "BOCAL PASSIVO - PHOEBUS" },
    { codigo: "117", nome: "(PACOTE COM 10 UNI) BOCAL ATIVO - PHOEBUS" },
    { codigo: "89", nome: "BOCAL - ALCOSCAN AL8800" },
    { codigo: "173", nome: "BOCAL - DEIMOS" },
    { codigo: "18", nome: "PACOTE COM 100 UNI -BOCAL - BAF 300" },
  ];

export const CODIGOS_PRINCIPAIS = PRODUTOS_PRINCIPAIS.map((p) => p.codigo);

/**
 * A frase para quando um dos principais não vem do Tiny; `null` quando estão
 * todos, ou quando o estoque não carregou.
 *
 * A suíte não fala com o banco, então é a tela que percebe um código que
 * deixou de existir. Sem isto, o filtro só mostrava um produto a menos, calado.
 * Com o estoque vazio não diz nada: a API caída faria parecer que os 29
 * sumiram, e quem avisa disso é o erro de carregamento.
 */
export function avisoDePrincipaisAusentes(
  produtos: ProdutoEstoque[],
): string | null {
  if (produtos.length === 0) return null;
  const presentes = new Set(produtos.map((p) => String(p.codigo)));
  const ausentes = PRODUTOS_PRINCIPAIS.filter((p) => !presentes.has(p.codigo));
  if (ausentes.length === 0) return null;

  const verbo = ausentes.length === 1 ? "não está" : "não estão";
  const lista = ausentes.map((p) => `${p.codigo} (${p.nome})`).join(", ");
  return `${ausentes.length} dos ${PRODUTOS_PRINCIPAIS.length} principais ${verbo} no estoque do Tiny: ${lista}.`;
}

export interface FiltrosDeEstoque {
  produto: string[];
  /** "todos" | "A" | "I" */
  situacao: string;
  /** "todos" | "comSaldo" | "semSaldo" | "Negativo" */
  saldo: string;
  /** "nenhum" | "rapido" */
  personalizado: string;
}

/** As opções do multiselect de produto: um por código, rótulo "nome (código)". */
export function opcoesDeProduto(
  produtos: ProdutoEstoque[],
): { valor: string; rotulo: string }[] {
  return Array.from(
    new Map(
      produtos.map((p) => [
        p.codigo,
        { valor: p.codigo, rotulo: `${p.nome} (${p.codigo})` },
      ]),
    ).values(),
  );
}

export function filtrarProdutos(
  produtos: ProdutoEstoque[],
  filtros: FiltrosDeEstoque,
): ProdutoEstoque[] {
  return produtos.filter((p) => {
    const produtoOk =
      filtros.produto.length === 0 || filtros.produto.includes(p.codigo);

    const situacaoOk =
      filtros.situacao === "todos" ||
      (filtros.situacao === "A" && p.situacao === "A") ||
      (filtros.situacao === "I" && p.situacao === "I");

    const saldoOk =
      filtros.saldo === "todos" ||
      (filtros.saldo === "comSaldo" && p.saldo > 0) ||
      (filtros.saldo === "semSaldo" && p.saldo === 0) ||
      (filtros.saldo === "Negativo" && p.saldo < 0);

    const personalizadoOk =
      filtros.personalizado === "nenhum" ||
      (filtros.personalizado === "rapido" &&
        CODIGOS_PRINCIPAIS.includes(String(p.codigo)));

    return produtoOk && situacaoOk && saldoOk && personalizadoOk;
  });
}

export interface KpisDeEstoque {
  produtosAtivos: number;
  /** Só saldo ZERO — o negativo não entra. */
  produtosSemSaldo: number;
  /** Saldo × preço somado; saldo negativo abate. */
  valorTotalEstoque: number;
  produtoTop: {
    nome: string;
    valor: number;
    unidade: string | null;
    saldo: number;
  } | null;
}

export function kpisDoEstoque(produtos: ProdutoEstoque[]): KpisDeEstoque {
  const produtosAtivos = produtos.filter((p) => p.situacao === "A").length;
  const produtosSemSaldo = produtos.filter((p) => p.saldo === 0).length;
  const valorTotalEstoque = produtos.reduce(
    (acc, p) => acc + p.saldo * p.preco,
    0,
  );

  const produtoMaiorValor = produtos
    .map((p) => ({ ...p, valor: p.saldo * p.preco }))
    .sort((a, b) => b.valor - a.valor)[0];

  return {
    produtosAtivos,
    produtosSemSaldo,
    valorTotalEstoque,
    produtoTop: produtoMaiorValor
      ? {
          nome: produtoMaiorValor.nome,
          valor: produtoMaiorValor.valor,
          unidade: produtoMaiorValor.unidade,
          saldo: produtoMaiorValor.saldo,
        }
      : null,
  };
}

/** Uma barra do Top 10: `nome` cortado para o eixo, `fullName` para o balão. */
export interface BarraDoRanking {
  nome: string;
  fullName: string;
  valor: number;
  unidade: string | null;
}

/** Só quem tem saldo E preço positivos, do maior valor ao menor, dez. */
export function rankingDoEstoque(produtos: ProdutoEstoque[]): BarraDoRanking[] {
  return produtos
    .filter((p) => p.saldo > 0 && p.preco > 0)
    .map((p) => ({
      nome: p.nome.length > 20 ? p.nome.substring(0, 20) + "..." : p.nome,
      fullName: p.nome,
      valor: p.saldo * p.preco,
      unidade: p.unidade,
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10);
}

export interface FatiaDeValor {
  name: string;
  fullName: string;
  value: number;
}

/** Os mesmos produtos do ranking, com o nome cortado em 15, oito fatias. */
export function distribuicaoDeValor(
  produtos: ProdutoEstoque[],
): FatiaDeValor[] {
  return produtos
    .filter((p) => p.saldo > 0 && p.preco > 0)
    .map((p) => ({
      name: p.nome.length > 15 ? p.nome.substring(0, 15) + "..." : p.nome,
      fullName: p.nome,
      value: p.saldo * p.preco,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

/** Ativos e inativos, sem fatia de zero. */
export function situacaoDosProdutos(
  produtos: ProdutoEstoque[],
): { name: string; value: number }[] {
  const ativos = produtos.filter((p) => p.situacao === "A").length;
  const inativos = produtos.filter((p) => p.situacao === "I").length;
  return [
    { name: "Ativos", value: ativos },
    { name: "Inativos", value: inativos },
  ].filter((item) => item.value > 0);
}

const DINHEIRO = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

/**
 * As quatro linhas de "Estatísticas do Estoque", já como texto.
 *
 * No formato brasileiro, como os cartões ao lado. Saíam com `toFixed` — ponto
 * decimal, "R$ 256.42" e "R$ 1200.00" ao lado de "R$ 6.440,00" —, e o vazio
 * era "0,00" com vírgula: dois formatos de dinheiro na mesma tela.
 */
export function estatisticasDoEstoque(
  produtos: ProdutoEstoque[],
): { label: string; value: string | number }[] {
  const n = produtos.length;
  const precoMedio =
    n > 0 ? produtos.reduce((acc, p) => acc + p.preco, 0) / n : 0;
  const saldoMedio =
    n > 0 ? produtos.reduce((acc, p) => acc + p.saldo, 0) / n : 0;
  // `Math.max()` sem argumento é -Infinity: o vazio tem de ser tratado antes.
  const maiorPreco = n > 0 ? Math.max(...produtos.map((p) => p.preco)) : 0;
  return [
    { label: "Total de Produtos", value: n },
    {
      label: "Preço Médio",
      value: `R$ ${precoMedio.toLocaleString("pt-BR", DINHEIRO)}`,
    },
    {
      label: "Saldo Médio",
      value: saldoMedio.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    },
    {
      label: "Maior Preço",
      value: `R$ ${maiorPreco.toLocaleString("pt-BR", DINHEIRO)}`,
    },
  ];
}

export type CampoDeOrdenacao =
  | "nome"
  | "codigo"
  | "preco"
  | "saldo"
  | "situacao";

export interface OrdenacaoDeEstoque {
  campo: CampoDeOrdenacao;
  direcao: "asc" | "desc";
}

/** Número compara por subtração; texto em ordem natural, sem caixa nem acento,
 *  e sem o espaço das pontas — o Tiny devolve nome como " VIDRO - PHOEBUS ", e o
 *  espaço ordenava antes de qualquer letra. */
function comparar(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).trim().localeCompare(String(b).trim(), "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * A tabela: pesquisa por nome, código ou unidade, e a ordem.
 *
 * Duas regras de ordem que a tela antiga não tinha:
 *   - **ordem natural** no texto: o código é SKU, e ordenava como texto puro —
 *     "900" antes de "163" e "77" antes de "4" no decrescente;
 *   - **empate desempata pelo nome**, crescente em qualquer direção: o
 *     comparador antigo nunca devolvia 0 (`aVal > bVal ? 1 : -1`), e em empate
 *     a ordem dependia do motor.
 */
export function buscarEOrdenar(
  produtos: ProdutoEstoque[],
  pesquisa: string,
  ordenacao: OrdenacaoDeEstoque,
): ProdutoEstoque[] {
  let filtrados = [...produtos];

  if (pesquisa) {
    const termo = pesquisa.toLowerCase();
    filtrados = filtrados.filter(
      (p) =>
        p.nome.toLowerCase().includes(termo) ||
        String(p.codigo).toLowerCase().includes(termo) ||
        // O Tiny aceita produto sem unidade e a API devolve `null`, apesar do
        // tipo: sem o `?? ""` qualquer busca que chegasse aqui lançava.
        (p.unidade ?? "").toLowerCase().includes(termo),
    );
  }

  const valorDe = (p: ProdutoEstoque): string | number => {
    switch (ordenacao.campo) {
      case "nome":
        return p.nome;
      case "codigo":
        return p.codigo;
      case "preco":
        return p.preco;
      case "saldo":
        return p.saldo;
      case "situacao":
        return p.situacao;
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
  atual: OrdenacaoDeEstoque,
  campo: CampoDeOrdenacao,
): OrdenacaoDeEstoque {
  return {
    campo,
    direcao: atual.campo === campo && atual.direcao === "desc" ? "asc" : "desc",
  };
}

/** As linhas da planilha: a tabela como está — filtrada, pesquisada e na ordem. */
export function linhasDaPlanilha(
  produtos: ProdutoEstoque[],
): Record<string, unknown>[] {
  return produtos.map((p) => ({
    Nome: p.nome,
    "Código-SKU": p.codigo,
    Unidade: p.unidade,
    Preço: p.preco,
    Saldo: p.saldo,
    Situação: p.situacao === "A" ? "Ativo" : "Inativo",
    "Valor Total": p.saldo * p.preco,
  }));
}
