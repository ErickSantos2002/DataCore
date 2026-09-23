import type {
  FiltrosComerciais,
  ResumoComercial,
} from "../../services/notasapi";
import type {
  PedidoDaTabela,
  RecorteComercial,
} from "../comercial/useComercial";
import { criarHooksFalsos, RESUMO_FALSO } from "../comercial/hooksFalsos";

/**
 * O resumo e as notas de mentira dos testes de caracterização de Vendas.
 *
 * Resumo — todo número que a tela mostra é distinto dos vizinhos:
 *   - KPIs: faturamento 123.456,78 (e `faturamento_produtos` 1, para trocar um
 *     pelo outro derrubar), 7 notas, ticket 17.636,68, maior venda 50.000,50,
 *     menor 12,34, desvio 9.876,54, 18 itens (média 2,57 por venda).
 *   - Evolução: `ESTADO_VENDAS.meses` meses a partir de jan/2024. Com 3 (o
 *     padrão) são jun, jul e ago de 2026 — 1.000, 3.000 e 2.400: variação do
 *     último mês −20%, melhor mês julho, média 2.133,33. Com mais de 24 a tela
 *     agrupa por ano.
 *   - Seis produtos (o Top 5 corta um), o primeiro com nome longo e um sem
 *     descrição; seis vendedores, um deles "Não informado"; nove clientes (a
 *     pizza corta em oito), um sem nome.
 *
 * Notas da tabela — três, com todo campo exibido distinto: uma completa com
 * observação, uma sem cliente, sem vendedor e sem itens, e uma com um item só.
 *
 * ⚠️ Não é `.test`: é importado de dentro de fábrica de `vi.mock`, que roda antes
 * dos imports do arquivo de teste — por isso o `await import(...)` lá.
 */

export const NOTAS_VENDAS = [
  {
    id: 11,
    numero: 991001,
    data_emissao: "2026-03-05",
    valor_nota: 9999.5,
    valor_produtos: 1234.5,
    cliente: { id: 1, nome: "Alfa Mineração", cpf_cnpj: "11.222.333/0001-44" },
    nome_vendedor: "Vendedor A",
    itens: [
      {
        codigo: "B1",
        descricao: "Bocal",
        quantidade: "10",
        valor_total: "100",
      },
      {
        codigo: "F1",
        descricao: "Bafômetro",
        quantidade: "1",
        valor_total: "1134.5",
      },
    ],
    tem_observacoes: true,
  },
  {
    id: 12,
    numero: 991002,
    data_emissao: "2026-02-10",
    valor_nota: 60,
    valor_produtos: 50,
    cliente: null,
    nome_vendedor: "",
    itens: [],
    tem_observacoes: false,
  },
  {
    id: 13,
    numero: 991003,
    data_emissao: "2026-01-20",
    valor_nota: 800,
    valor_produtos: 700,
    cliente: { id: 2, nome: "Beta Logística", cpf_cnpj: "55.666.777/0001-88" },
    nome_vendedor: "Vendedor B",
    itens: [
      { codigo: "K1", descricao: "Kit", quantidade: "1", valor_total: "700" },
    ],
    tem_observacoes: false,
  },
];

export const OPCOES_VENDAS: FiltrosComerciais = {
  clientes: [
    { id: 1, nome: "Alfa Mineração", cpf_cnpj: "11.222.333/0001-44" },
    { id: 2, nome: "Beta Logística", cpf_cnpj: "55.666.777/0001-88" },
  ],
  vendedores: ["Vendedor A", "Vendedor B"],
  produtos: [
    { chave: "K1", codigo: "K1", descricao: "Kit bocal", valor: 0 },
    { chave: "#Brinde", codigo: null, descricao: "Brinde", valor: 0 },
  ],
};

export const ESTADO_VENDAS = {
  carregando: false,
  /** Há busca em andamento para um recorte mais novo que o da tela. */
  atualizando: false,
  vazio: false,
  meses: 3,
  erroDoResumo: null as string | null,
  erroDaTabela: null as string | null,
  recortes: [] as RecorteComercial[],
  pedidos: [] as PedidoDaTabela[],
};

export function reiniciarEstadoDeVendas() {
  ESTADO_VENDAS.carregando = false;
  ESTADO_VENDAS.atualizando = false;
  ESTADO_VENDAS.vazio = false;
  ESTADO_VENDAS.meses = 3;
  ESTADO_VENDAS.erroDoResumo = null;
  ESTADO_VENDAS.erroDaTabela = null;
  ESTADO_VENDAS.recortes.length = 0;
  ESTADO_VENDAS.pedidos.length = 0;
}

/** Valores de jun, jul e ago de 2026 quando são três meses. */
const TRES_MESES = [1000, 3000, 2400];

function evolucao(meses: number): ResumoComercial["evolucao_mensal"] {
  if (meses === 3) {
    return TRES_MESES.map((total, i) => ({
      ano: 2026,
      mes: 6 + i,
      total,
      total_produtos: 1,
      notas: 1,
      quantidade: 1,
    }));
  }
  return Array.from({ length: meses }, (_, i) => ({
    ano: 2024 + Math.floor(i / 12),
    mes: (i % 12) + 1,
    total: 100 + i,
    total_produtos: 1,
    notas: 1,
    quantidade: 1,
  }));
}

/** Um resumo por quantidade de meses, guardado: o hook de verdade devolve a
 *  mesma referência entre renders, e um objeto novo a cada render faria a
 *  tela recalcular tudo sem parar. */
const CACHE = new Map<number, ResumoComercial>();

export function resumoDeVendas(meses: number): ResumoComercial {
  const guardado = CACHE.get(meses);
  if (guardado) return guardado;
  const resumo: ResumoComercial = {
    ...RESUMO_FALSO,
    kpis: {
      faturamento: 123456.78,
      faturamento_produtos: 1,
      notas: 7,
      ticket_medio: 17636.68,
      maior_venda: 50000.5,
      menor_venda: 12.34,
      desvio_padrao_venda: 9876.54,
      itens: 18,
    },
    evolucao_mensal: evolucao(meses),
    por_produto: [
      "Bafômetro Phoebus Premium XL",
      "Bocal descartável",
      null,
      "Kit calibração",
      "Sensor",
      "Brinde",
    ].map((descricao, i) => ({
      chave: `P${i}`,
      codigo: `P${i}`,
      descricao,
      quantidade: 1,
      valor: 6000 - i * 1000,
      notas: 1,
    })),
    por_vendedor: [
      "Maria Aparecida dos Santos",
      "Vendedor B",
      "Não informado",
      "Vendedor C",
      "Vendedor D",
      "Vendedor E",
    ].map((nome, i) => ({
      nome,
      valor: 60000 - i * 10000,
      valor_produtos: 1,
      notas: 1,
    })),
    por_cliente: Array.from({ length: 9 }, (_, i) => ({
      documento: String(i),
      nome: i === 1 ? null : `Cliente ${i}`,
      cpf_cnpj: null,
      email: null,
      fone: null,
      valor: 9000 - i * 100,
      valor_produtos: 1,
      notas: 1,
      ultima_compra: null,
    })),
  };
  CACHE.set(meses, resumo);
  return resumo;
}

/**
 * Os três hooks do Comercial que Vendas lê. O resumo é o de `resumoDeVendas`
 * (ou `RESUMO_FALSO`, vazio ou com erro, que é o que o `catch` de verdade
 * grava); a tabela é a de `criarHooksFalsos`, que pagina e aplica o recorte.
 */
export function hooksDeVendas() {
  const falsos = criarHooksFalsos(NOTAS_VENDAS);
  return {
    useResumoComercial: (recorte: RecorteComercial) => {
      ESTADO_VENDAS.recortes.push(recorte);
      return {
        resumo:
          ESTADO_VENDAS.vazio || ESTADO_VENDAS.erroDoResumo
            ? RESUMO_FALSO
            : resumoDeVendas(ESTADO_VENDAS.meses),
        carregando: ESTADO_VENDAS.carregando,
        atualizando: ESTADO_VENDAS.atualizando,
        erro: ESTADO_VENDAS.erroDoResumo,
        recarregar: async () => {},
      };
    },
    useFiltrosComerciais: () => ({ opcoes: OPCOES_VENDAS, carregando: false }),
    useVendasPaginadas: (recorte: RecorteComercial, pedido: PedidoDaTabela) => {
      ESTADO_VENDAS.pedidos.push(pedido);
      const resposta = falsos.useVendasPaginadas(recorte, pedido);
      if (ESTADO_VENDAS.vazio || ESTADO_VENDAS.erroDaTabela) {
        return {
          ...resposta,
          pagina: {
            itens: [],
            total: 0,
            valor_total: 0,
            limite: 15,
            offset: 0,
          },
          erro: ESTADO_VENDAS.erroDaTabela,
        };
      }
      return resposta;
    },
  };
}
