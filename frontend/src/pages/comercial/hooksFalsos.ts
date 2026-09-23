import type { ResumoComercial } from "../../services/notasapi";
import { useMemo } from "react";

import type { PedidoDaTabela, RecorteComercial } from "./useComercial";

/**
 * Os hooks do Comercial, falsos, para os testes de tela.
 *
 * ## Por que mocar o HOOK, e não a rede
 *
 * Um mock da rede teria de refazer, em TypeScript, a agregação que o banco
 * faz — e aí a suíte estaria testando a cópia, não o original. A conta de
 * verdade é conferida contra o Postgres, recorte por recorte, pelos scripts de
 * verificação (2026-09-09).
 *
 * O que os testes de tela têm de provar é outra coisa: que a tela pede o
 * recorte certo, desenha o que recebe e pagina direito. Por isso o falso
 * respeita `pagina` e `porPagina` — que é o comportamento que a tela exercita —
 * e devolve o resumo pronto.
 *
 * ⚠️ Este arquivo NÃO é `.test`: é importado de dentro de uma fábrica de
 * `vi.mock`, que roda antes dos imports do arquivo de teste.
 */

export const RESUMO_FALSO: ResumoComercial = {
  kpis: {
    faturamento: 0,
    faturamento_produtos: 0,
    notas: 0,
    ticket_medio: 0,
    maior_venda: 0,
    menor_venda: 0,
    desvio_padrao_venda: 0,
    itens: 0,
  },
  evolucao_mensal: [],
  evolucao_por_cliente: [],
  por_produto: [],
  por_vendedor: [],
  por_cliente: [],
};

interface ItemDoFixture {
  descricao: string;
  codigo?: string;
  quantidade?: string;
  valor_total?: string;
}

interface NotaDoFixture {
  id: number;
  valor_nota: number;
  valor_produtos?: number;
  data_emissao?: string;
  cliente?: { nome: string; cpf_cnpj: string } | null;
  nome_vendedor?: string;
  itens?: ItemDoFixture[];
  [chave: string]: unknown;
}

/**
 * O `por_produto` e a `evolucao_mensal` de um fixture.
 *
 * A tela de Produtos NAO tem tabela de notas: a tabela dela é este agregado.
 * Sem ele o falso devolveria lista vazia e os testes de paginacao dessa tela
 * não teriam o que paginar.
 *
 * A `evolucao_mensal` entrou depois, na Task 3 de 2026-09-10: ela vinha sempre
 * vazia, e por isso trocar a evolução da tela por `[]` deixava os 45 testes de
 * Produtos verdes — o gráfico de linha não tinha como estar errado, porque
 * nunca tinha ponto nenhum. A soma aqui é a `quantidade` de itens do mês, que
 * é o que aquela tela desenha.
 *
 * Isto é a única parte da agregação refeita em TypeScript, e é de propósito
 * mínima — a conta de verdade é do Postgres, conferida recorte por recorte
 * pelos scripts de verificação.
 */
export function resumoDeProdutos(notas: NotaDoFixture[]): ResumoComercial {
  const porChave = new Map<
    string,
    { chave: string; codigo: string | null; descricao: string; quantidade: number; valor: number; notas: Set<number> }
  >();

  for (const nota of notas) {
    for (const item of nota.itens ?? []) {
      const chave = item.codigo || `#${item.descricao}`;
      const atual =
        porChave.get(chave) ??
        {
          chave,
          codigo: item.codigo ?? null,
          descricao: item.descricao,
          quantidade: 0,
          valor: 0,
          notas: new Set<number>(),
        };
      atual.quantidade += Number(item.quantidade ?? 0);
      atual.valor += Number(item.valor_total ?? 0);
      atual.notas.add(nota.id);
      porChave.set(chave, atual);
    }
  }

  const porMes = new Map<string, ResumoComercial["evolucao_mensal"][number]>();
  for (const nota of notas) {
    const [ano, mes] = (nota.data_emissao ?? "").split("-").map(Number);
    if (!ano) continue;
    const chave = `${ano}-${mes}`;
    const atual =
      porMes.get(chave) ??
      { ano, mes, total: 0, total_produtos: 0, notas: 0, quantidade: 0 };
    atual.total += nota.valor_nota;
    atual.total_produtos += nota.valor_produtos ?? nota.valor_nota;
    atual.notas += 1;
    atual.quantidade += (nota.itens ?? []).reduce(
      (soma, item) => soma + Number(item.quantidade ?? 0),
      0,
    );
    porMes.set(chave, atual);
  }

  return {
    ...RESUMO_FALSO,
    kpis: { ...RESUMO_FALSO.kpis, notas: notas.length },
    por_produto: [...porChave.values()]
      .map(({ notas: ids, ...resto }) => ({ ...resto, notas: ids.size }))
      .sort((a, b) => b.valor - a.valor),
    evolucao_mensal: [...porMes.values()].sort((a, b) => a.ano - b.ano || a.mes - b.mes),
  };
}

/** Como o falso monta o resumo a partir das notas que sobraram do recorte. */
export type FabricaDeResumo = (notas: NotaDoFixture[]) => ResumoComercial;

/**
 * Monta os hooks do Comercial sobre uma lista fixa de notas.
 *
 * O falso **aplica o recorte** antes de chamar a fábrica do resumo: sem isso, a
 * tabela não reagiria a filtro nenhum e os testes de multiselect passariam a
 * medir o mock em vez da tela. O que ele não faz é a agregação — essa é da
 * fábrica (`resumoDeClientes`, `resumoDeProdutos`), e a de verdade é do
 * Postgres, conferida recorte por recorte pelos scripts de verificação.
 *
 * `busca` é uma continência grosseira sobre os mesmos campos que o backend
 * procura — o suficiente para o teste de "filtrar volta para a primeira
 * página".
 */
export function criarHooksFalsos(
  notas: NotaDoFixture[],
  fabricaDeResumo: FabricaDeResumo = () => RESUMO_FALSO,
) {
  const casa = (nota: NotaDoFixture, termo: string) => {
    const alvo = [
      nota.cliente?.nome,
      nota.cliente?.cpf_cnpj,
      nota.nome_vendedor,
      String(nota.valor_nota),
      ...(nota.itens ?? []).map((i) => i.descricao),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return alvo.includes(termo.toLowerCase());
  };

  // As mesmas opções que `useFiltrosComerciais` devolve, montadas uma vez para
  // que o id e a chave que a tela manda de volta no recorte signifiquem aqui a
  // mesma coisa que significaram lá.
  const comCliente = notas.filter((n) => n.cliente);
  const opcoesClientes = comCliente.map((n, i) => ({
    id: i + 1,
    nome: n.cliente!.nome,
    cpf_cnpj: n.cliente!.cpf_cnpj,
  }));
  const opcoesProdutos = Array.from(
    new Set(notas.flatMap((n) => (n.itens ?? []).map((i) => i.codigo || `#${i.descricao}`))),
  ).map((chave) => {
    const item = notas
      .flatMap((n) => n.itens ?? [])
      .find((i) => (i.codigo || `#${i.descricao}`) === chave)!;
    return { chave, codigo: item.codigo ?? null, descricao: item.descricao, valor: 0 };
  });

  const documentoPorId = new Map(
    opcoesClientes.map((c) => [c.id, c.cpf_cnpj.replace(/\D/g, "")]),
  );

  const noRecorte = (nota: NotaDoFixture, recorte: RecorteComercial) => {
    if (recorte.clientes.length) {
      const alvos = new Set(
        recorte.clientes.map((id) => documentoPorId.get(id)).filter(Boolean),
      );
      const doc = (nota.cliente?.cpf_cnpj ?? "").replace(/\D/g, "");
      if (!alvos.has(doc)) return false;
    }
    if (recorte.vendedores.length && !recorte.vendedores.includes(nota.nome_vendedor ?? "")) {
      return false;
    }
    if (recorte.produtos.length) {
      const tem = (nota.itens ?? []).some((i) =>
        recorte.produtos.includes(i.codigo || `#${i.descricao}`),
      );
      if (!tem) return false;
    }
    const dia = nota.data_emissao ?? "";
    if (recorte.dataInicio && dia && dia < recorte.dataInicio) return false;
    if (recorte.dataFim && dia && dia > recorte.dataFim) return false;
    return true;
  };

  return {
    // ⚠️ `useMemo`, e não recalcular a cada render: o hook de verdade guarda o
    // resumo em estado, então a referência dele é estável entre renders. Um
    // falso que devolve array novo a cada render faz a tela de Produtos entrar
    // em laço — o `usePaginacao` dela volta para a página 1 quando a lista muda
    // de identidade, e a lista mudava sempre.
    useResumoComercial: (recorte: RecorteComercial) => {
      const chave = JSON.stringify(recorte);
      const resumo = useMemo(
        () => fabricaDeResumo(notas.filter((n) => noRecorte(n, recorte))),
        [chave],
      );
      return {
        resumo,
        carregando: false,
        atualizando: false,
        erro: null,
        recarregar: async () => {},
      };
    },

    useFiltrosComerciais: () => ({
      opcoes: {
        clientes: opcoesClientes,
        vendedores: Array.from(
          new Set(notas.map((n) => n.nome_vendedor).filter(Boolean)),
        ) as string[],
        produtos: opcoesProdutos,
      },
      carregando: false,
    }),

    useVendasPaginadas: (recorte: RecorteComercial, pedido: PedidoDaTabela) => {
      const termo = pedido.busca.trim();
      const doRecorte = notas.filter((n) => noRecorte(n, recorte));
      const filtradas = termo ? doRecorte.filter((n) => casa(n, termo)) : doRecorte;
      const inicio = Math.max(0, (pedido.pagina - 1) * pedido.porPagina);
      return {
        pagina: {
          itens: filtradas.slice(inicio, inicio + pedido.porPagina),
          total: filtradas.length,
          valor_total: filtradas.reduce((acc, n) => acc + n.valor_nota, 0),
          limite: pedido.porPagina,
          offset: inicio,
        },
        carregando: false,
        atualizando: false,
        erro: null,
      };
    },
  };
}

interface CadastroDoFixture {
  nome: string;
  cpf_cnpj: string;
  email?: string;
  fone?: string;
}

/**
 * O `por_cliente` de um fixture, agregado pelo documento em digitos.
 *
 * A tabela da tela de Clientes é este agregado — não uma lista de notas —, e o
 * contato (e-mail, telefone) vem do cadastro, que no fixture é uma lista
 * separada, como era no `DataContext`.
 */
export function resumoDeClientes(
  notas: NotaDoFixture[],
  cadastros: CadastroDoFixture[],
): ResumoComercial {
  const soDigitos = (v: string) => v.replace(/\D/g, "");
  const contato = new Map(cadastros.map((c) => [soDigitos(c.cpf_cnpj), c]));

  const porDoc = new Map<
    string,
    { documento: string; nome: string; cpf_cnpj: string; email: string | null;
      fone: string | null; valor: number; valor_produtos: number; notas: number;
      ultima_compra: string | null }
  >();

  for (const nota of notas) {
    if (!nota.cliente) continue;
    const doc = soDigitos(nota.cliente.cpf_cnpj);
    const cadastro = contato.get(doc);
    const atual =
      porDoc.get(doc) ??
      {
        documento: doc,
        nome: nota.cliente.nome,
        cpf_cnpj: nota.cliente.cpf_cnpj,
        email: cadastro?.email ?? null,
        fone: cadastro?.fone ?? null,
        valor: 0,
        valor_produtos: 0,
        notas: 0,
        ultima_compra: null as string | null,
      };
    atual.valor += nota.valor_nota;
    atual.valor_produtos += nota.valor_produtos ?? nota.valor_nota;
    atual.notas += 1;
    const dia = nota.data_emissao ?? null;
    if (dia && (!atual.ultima_compra || dia > atual.ultima_compra)) {
      atual.ultima_compra = dia;
    }
    porDoc.set(doc, atual);
  }

  const linhas = [...porDoc.values()].sort((a, b) => b.valor - a.valor);
  return {
    ...RESUMO_FALSO,
    kpis: {
      ...RESUMO_FALSO.kpis,
      notas: notas.length,
      faturamento: notas.reduce((acc, n) => acc + n.valor_nota, 0),
    },
    por_cliente: linhas,
    evolucao_por_cliente: linhas.slice(0, 5).flatMap((c) =>
      notas
        .filter((n) => n.cliente && soDigitos(n.cliente.cpf_cnpj) === c.documento)
        .map((n) => {
          const [ano, mes] = (n.data_emissao ?? "1970-01-01").split("-").map(Number);
          return { documento: c.documento, ano, mes, total: n.valor_nota };
        }),
    ),
  };
}
