import type { WorkSheet } from "xlsx";

import type { CampoDeOrdenacao } from "../comercial/useComercial";
import type { OpcaoDeMultiSelect } from "../../design-system/ui/forms/buscaDeMultiSelect";
import type {
  FiltrosComerciais,
  NotaVenda,
  ResumoComercial,
} from "../../services/notasapi";

/**
 * A conta pura da tela de Vendedores, separada de `Vendedores.tsx`.
 *
 * Cada função aqui é um `useMemo` ou um trecho de handler que saiu do
 * componente sem mudar de comportamento — perdeu o `useMemo` em volta e ganhou
 * como parâmetro o que antes vinha do escopo. Os `useMemo` continuam na casca,
 * chamando estas funções: o `recorte` entra na chave do pedido de
 * `useResumoComercial`, e um objeto novo a cada render refaria a busca em laço.
 *
 * ⚠️ **Vendedores mede a MERCADORIA** (`valor_produtos`, `faturamento_produtos`,
 * `total_produtos`), e não o total da nota. É a diferença que sempre existiu
 * entre esta tela e a de Vendas, e os testes de caracterização a prendem.
 *
 * Onde a lógica movida tem cara de defeito, o comentário registra o achado sem
 * corrigir — corrigir junto de mover impede saber qual dos dois quebrou.
 */

type Opcoes = FiltrosComerciais;

/** O rótulo de um cliente no filtro: nome e documento entre parênteses, que é
 *  o formato que `buscaPorCnpjEntreParenteses` sabe procurar. */
export function rotuloDoCliente(c: {
  nome: string | null;
  cpf_cnpj: string | null;
}): string {
  return `${c.nome || "Não informado"} (${c.cpf_cnpj || ""})`;
}

/**
 * As opções do filtro de produto, como `{ valor, rotulo }` — e é o par inteiro
 * que vai para o `MultiSelect`.
 *
 * A tela passava só os rótulos (`deTextos(produtos.map(p => p.label))`), e o
 * que o multiselect devolvia ia direto para `recorte.produtos`, que o servidor
 * espera como CHAVE. Escolher qualquer produto mandava "Kit (K1)" onde o banco
 * procura "K1", e a tela zerava. O comentário ao lado dizia que o multiselect
 * "já guarda a chave"; não guardava.
 */
export function opcoesDeProduto(
  produtos: Opcoes["produtos"],
): OpcaoDeMultiSelect[] {
  return produtos.map((p) => ({
    valor: p.chave,
    rotulo: `${p.descricao} (${p.codigo ?? "sem código"})`,
  }));
}

/** Do rótulo que a pessoa escolheu de volta ao id que o servidor filtra. */
export function idsPorRotulo(
  clientes: Opcoes["clientes"],
): Map<string, number> {
  const mapa = new Map<string, number>();
  clientes.forEach((c) => mapa.set(rotuloDoCliente(c), c.id));
  return mapa;
}

/**
 * Quem é do papel "vendas" vê só as próprias notas.
 *
 * Era o `notasVendedor` do contexto, um `includes` do username dentro do nome
 * do vendedor; aqui a mesma continência escolhe QUAIS nomes entram no recorte,
 * e o recorte em si é do banco. O navegador deixa de receber a carteira inteira
 * da empresa para depois descartá-la.
 */
export function vendedoresDoPapel(
  papel: string | undefined,
  usuario: string,
  vendedores: string[],
): string[] {
  if (papel !== "vendas") return [];
  const alvo = usuario.toLowerCase();
  return vendedores.filter((v) => v.toLowerCase().includes(alvo));
}

/** Os quatro números do topo. */
export interface KpisDeVendedor {
  totalFaturado: number;
  totalVendas: number;
  ticketMedio: number;
  produtoMaisVendido: { nome: string; valor: number } | null;
}

export function kpisDoResumo(resumo: ResumoComercial): KpisDeVendedor {
  const topo = resumo.por_produto[0];
  const notas = resumo.kpis.notas;
  return {
    totalFaturado: resumo.kpis.faturamento_produtos,
    totalVendas: notas,
    ticketMedio: notas > 0 ? resumo.kpis.faturamento_produtos / notas : 0,
    produtoMaisVendido: topo
      ? { nome: topo.descricao ?? "N/A", valor: topo.valor }
      : null,
  };
}

/** Um ponto do gráfico de evolução — mensal, ou anual acima de 24 meses. */
export interface PontoDeEvolucao {
  mes: string;
  total: number;
  ordem: number;
  ano?: number;
}

/**
 * A evolução da mercadoria, mês a mês; acima de 24 meses, somada por ano.
 *
 * ⚠️ `new Date(ano, mes - 1)` é hora LOCAL, meia-noite do dia 1 — não passa
 * pelo defeito de fuso de `lib/datas.ts`, que é o de ler "AAAA-MM-DD" em UTC.
 */
export function evolucaoDoResumo(
  evolucao: ResumoComercial["evolucao_mensal"],
): PontoDeEvolucao[] {
  const dadosMensais = evolucao.map((m) => {
    const data = new Date(m.ano, m.mes - 1);
    return {
      mes: data.toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
      }),
      total: m.total_produtos,
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

/** Os cinco produtos de maior valor, na forma do `BarChart`. Agrupados por
 *  CÓDIGO, e não pela grafia da descrição — ver `comercial/useComercial.ts`. */
export function topProdutosDoResumo(
  porProduto: ResumoComercial["por_produto"],
): { produto: string; valor: number }[] {
  return porProduto.slice(0, 5).map((p) => ({
    produto: p.descricao ?? "Sem descrição",
    valor: p.valor,
  }));
}

/** Os oito maiores clientes pela mercadoria, na forma da pizza. */
export function distribuicaoDeClientes(
  porCliente: ResumoComercial["por_cliente"],
): { name: string; value: number }[] {
  return porCliente.slice(0, 8).map((c) => ({
    name: c.nome ?? "Não informado",
    value: c.valor_produtos,
  }));
}

export interface OrdenacaoDeVendedores {
  campo: CampoDeOrdenacao;
  direcao: "asc" | "desc";
}

/** O primeiro clique numa coluna é sempre decrescente; o segundo inverte. */
export function proximaOrdenacao(
  atual: OrdenacaoDeVendedores,
  campo: CampoDeOrdenacao,
): OrdenacaoDeVendedores {
  return {
    campo,
    direcao: atual.campo === campo && atual.direcao === "desc" ? "asc" : "desc",
  };
}

/**
 * As linhas da planilha "Minhas Vendas".
 *
 * Achado ao mover (não corrigido): `Numero` corta os DOIS primeiros dígitos do
 * número da nota (`substring(2)`) — 991001 sai 1001. Não há comentário dizendo
 * por quê, e nenhuma outra exportação faz isso.
 */
export function linhasDaPlanilha(
  notas: NotaVenda[],
): Record<string, unknown>[] {
  return notas.map((n) => {
    const dataFormatada = n.data_emissao
      ? n.data_emissao.split("-").reverse().join("/")
      : "";

    const numeroFormatado = n.numero
      ? Number(n.numero.toString().substring(2))
      : "";

    return {
      Numero: numeroFormatado,
      Data: dataFormatada,
      Cliente: n.cliente?.nome || "",
      CNPJ: n.cliente?.cpf_cnpj || "",
      "Valor Produtos": Number(n.valor_produtos),
      "Valor Nota": Number(n.valor_nota),
      Tipo: n.tipo || "Não definido",
      Vendedor: n.nome_vendedor || "",
      Produtos: n.itens?.map((i) => i.descricao).join(", ") || "",
    };
  });
}

/**
 * Largura de coluna e formato contábil nas colunas de valor (E e F). Só esta
 * tela faz isso entre as nove; sem o `t`/`z` o valor sai como texto e o Excel
 * não soma a coluna.
 */
export function ajustarFolhaDeVendas(folha: WorkSheet): void {
  folha["!cols"] = [
    { wch: 10 },
    { wch: 12 },
    { wch: 40 },
    { wch: 18 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 20 },
    { wch: 50 },
  ];
  for (const celula in folha) {
    if (celula[0] === "E" || celula[0] === "F") {
      const alvo = folha[celula];
      if (alvo && typeof alvo.v === "number") {
        alvo.t = "n";
        alvo.z = "#,##0.00";
      }
    }
  }
}
