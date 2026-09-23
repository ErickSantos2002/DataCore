import { converterParaNumero } from "../../lib/dinheiro";
import type {
  ContaDaTela,
  PaginaDeContas,
  ResumoDeContas,
} from "../../services/notasapi";

/**
 * Um servidor de Contas falso, para os testes de tela.
 *
 * ## Por que existe
 *
 * Os testes de `ContasPagar.test.tsx` e `ContasReceber.test.tsx` são de
 * caracterização: alimentam a tela com uma lista de contas e conferem o que ela
 * desenha — os cinco KPIs, os três gráficos, a tabela, a busca, a planilha.
 * Quatro mil linhas de garantias sobre a TELA.
 *
 * Quando a agregação foi para o banco (item 9.4), a tela deixou de receber
 * contas e passou a receber agregados. Havia duas saídas: reescrever os quatro
 * mil, alimentando a tela com agregados prontos; ou pôr um servidor falso no
 * lugar do de verdade e deixar os testes como estavam.
 *
 * Este arquivo é a segunda. Ele reproduz o que `core/contas_agregado.py` faz —
 * e é a única cópia dessa conta em TypeScript, escrita de propósito.
 *
 * ## O que isso NÃO prova
 *
 * Que o SQL está certo. Um dublê nunca poderia provar isso: ele é a cópia, não
 * o original. Quem prova o SQL é a verificação que roda contra o banco de
 * produção, comparando cada recorte com a conta refeita do jeito que a tela
 * fazia — e ela conferiu os cinco KPIs, os anos um a um, as 79 categorias, os
 * dez maiores e a paginação inteira nas oito ordenações.
 *
 * O que este dublê prova é o que os testes de tela sempre provaram: que a tela
 * desenha corretamente o que recebe, e que o clique certo pede o recorte certo.
 */

interface ContaCrua {
  id: number;
  id_tiny?: number;
  situacao?: string | null;
  categoria?: string | null;
  cliente_nome?: string;
  cliente_cpf_cnpj?: string | null;
  cliente_cidade?: string | null;
  cliente_uf?: string | null;
  nro_documento?: string | null;
  historico?: string | null;
  liquidacao?: string | null;
  vencimento?: string;
  valor?: string | number;
  saldo?: string | number;
  ocorrencia?: string | null;
  forma_pagamento?: string | null;
  portador?: string | null;
  [chave: string]: unknown;
}

export interface DialetoDoServidor {
  /** O campo de emissão na conta crua: `data` ou `data_emissao`. */
  campoDaEmissao: string;
  /** Situações que contam como quitada, em minúscula. */
  quitadas: readonly string[];
}

/** `vencida` usa a lista fixa nas DUAS telas, e não o dialeto de cada uma. */
const NAO_VENCEM = ["pago", "recebido"];

// O fixture ainda escreve o valor como TEXTO, nas duas convenções, porque era
// assim que a API antiga o entregava. `converterParaNumero` é a conversão de
// verdade do repositório, com o teste de ponto-de-milhar — reescrevê-la aqui
// criaria a terceira cópia da mesma regra. No backend nada disso existe: a
// coluna é `numeric`, e o valor chega pronto.
function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function criarServidorDeContas(
  contasCruas: () => ContaCrua[],
  dialeto: DialetoDoServidor,
  agora: () => Date = () => new Date(),
) {
  const normalizar = (crua: ContaCrua): ContaDaTela => {
    const hoje = new Date(agora());
    hoje.setHours(0, 0, 0, 0);
    const emissao = String(crua[dialeto.campoDaEmissao] ?? "");
    const situacao = crua.situacao ?? null;
    const situacaoBaixa = (situacao ?? "").toLowerCase();
    const [ano, mes, dia] = (crua.vencimento ?? "").split("-");
    const vencimento = new Date(Number(ano), Number(mes) - 1, Number(dia));

    return {
      id: crua.id,
      id_tiny: crua.id_tiny ?? null,
      emissao: emissao || null,
      vencimento: crua.vencimento ?? null,
      situacao,
      categoria: crua.categoria ?? null,
      cliente_nome: crua.cliente_nome ?? null,
      cliente_cpf_cnpj: crua.cliente_cpf_cnpj ?? null,
      cliente_cidade: crua.cliente_cidade ?? null,
      cliente_uf: crua.cliente_uf ?? null,
      nro_documento: crua.nro_documento ?? null,
      historico: crua.historico ?? null,
      liquidacao: crua.liquidacao ?? null,
      valor: converterParaNumero(crua.valor),
      saldo: converterParaNumero(crua.saldo),
      quitada: dialeto.quitadas.includes(situacaoBaixa),
      vencida: vencimento < hoje && !NAO_VENCEM.includes(situacaoBaixa),
      ocorrencia: crua.ocorrencia ?? null,
      forma_pagamento: crua.forma_pagamento ?? null,
      portador: crua.portador ?? null,
    };
  };

  // As três grandezas, como em `core/contas_agregado.py`.
  const quitadoDe = (c: ContaDaTela) => c.valor - c.saldo;
  const abertoDe = (c: ContaDaTela) => (c.quitada ? 0 : c.saldo);
  const faturadoDe = (c: ContaDaTela) => quitadoDe(c) + abertoDe(c);

  const emLista = (valor: string | null, lista: string[] | undefined) =>
    !lista?.length || lista.includes((valor ?? "").trim());

  const filtrar = (contas: ContaDaTela[], params: Record<string, unknown>) =>
    contas.filter((c) => {
      const inicio = params.data_inicio as string | undefined;
      const fim = params.data_fim as string | undefined;
      const emissao = c.emissao ?? "";
      return (
        emLista(c.situacao, params.situacao as string[]) &&
        emLista(c.categoria, params.categoria as string[]) &&
        emLista(c.cliente_nome, params.contraparte as string[]) &&
        (!inicio || emissao >= inicio) &&
        (!fim || emissao <= fim)
      );
    });

  const agrupar = (
    contas: ContaDaTela[],
    chave: (c: ContaDaTela) => string,
  ) => {
    const soma = new Map<string, number>();
    for (const c of contas)
      soma.set(chave(c), (soma.get(chave(c)) ?? 0) + faturadoDe(c));
    return [...soma.entries()]
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome));
  };

  /**
   * As opções saem da base INTEIRA, e não do recorte — como no SQL.
   *
   * `localeCompare`, e não `.sort()` cru: o banco está em `en_US.utf8` e
   * ordena "Água" antes de "Boletos"; o `sort` do JS ordena por código UTF-16
   * e a joga depois de "Zinco". Conferido contra o Postgres em 2026-09-09.
   */
  const opcoesDe = (
    contas: ContaDaTela[],
    campo: (c: ContaDaTela) => string | null,
  ) =>
    [
      ...new Set(contas.map((c) => (campo(c) ?? "").trim()).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const fetchResumoDeContas = async (
    _tipo: string,
    params: Record<string, unknown> = {},
  ): Promise<ResumoDeContas> => {
    const todas = contasCruas().map(normalizar);
    const contas = filtrar(todas, params);
    const hoje = new Date(agora());
    hoje.setHours(0, 0, 0, 0);
    const em30 = new Date(hoje);
    em30.setDate(hoje.getDate() + 30);

    const porAno = new Map<number, { quitado: number; aberto: number }>();
    const porMes = new Map<
      string,
      { ano: number; mes: number; quitado: number; aberto: number }
    >();
    for (const c of contas) {
      const [ano, mes] = (c.emissao ?? "").split("-").map(Number);
      if (!ano) continue;
      const noAno = porAno.get(ano) ?? { quitado: 0, aberto: 0 };
      noAno.quitado += quitadoDe(c);
      noAno.aberto += abertoDe(c);
      porAno.set(ano, noAno);

      const chave = `${ano}-${mes}`;
      const noMes = porMes.get(chave) ?? { ano, mes, quitado: 0, aberto: 0 };
      noMes.quitado += quitadoDe(c);
      noMes.aberto += abertoDe(c);
      porMes.set(chave, noMes);
    }

    const meses = new Set(contas.map((c) => (c.emissao ?? "").slice(0, 7)))
      .size;
    const totalAberto = contas.reduce((t, c) => t + abertoDe(c), 0);
    const totalQuitado = contas.reduce((t, c) => t + quitadoDe(c), 0);

    return {
      kpis: {
        total_aberto: totalAberto,
        total_quitado: totalQuitado,
        contas_vencidas: contas.filter((c) => c.vencida).length,
        a_vencer_30: contas.filter((c) => {
          if (c.quitada || !c.vencimento) return false;
          const [ano, mes, dia] = c.vencimento.split("-").map(Number);
          const vence = new Date(ano, mes - 1, dia);
          return vence >= hoje && vence <= em30;
        }).length,
        media_mensal: meses > 0 ? (totalAberto + totalQuitado) / meses : 0,
        contas: contas.length,
      },
      por_ano: [...porAno.entries()]
        .map(([ano, v]) => ({ ano, ...v }))
        .sort((a, b) => a.ano - b.ano),
      por_mes: [...porMes.values()].sort(
        (a, b) => a.ano - b.ano || a.mes - b.mes,
      ),
      por_categoria: agrupar(
        contas,
        (c) => (c.categoria ?? "").trim() || "Sem categoria",
      ),
      por_contraparte: agrupar(contas, (c) => (c.cliente_nome ?? "").trim()),
      opcoes: {
        situacao: opcoesDe(todas, (c) => c.situacao),
        categoria: opcoesDe(todas, (c) => c.categoria),
        contraparte: opcoesDe(todas, (c) => c.cliente_nome),
      },
    };
  };

  const fetchPaginaDeContas = async (
    _tipo: string,
    params: Record<string, unknown> = {},
  ): Promise<PaginaDeContas> => {
    const contas = filtrar(contasCruas().map(normalizar), params);
    const termo = (params.busca as string | undefined)?.trim();

    const encontradas = termo
      ? contas.filter((c) =>
          [c.cliente_nome, c.categoria, c.nro_documento, c.historico].some(
            (campo) => campo && semAcento(campo).includes(semAcento(termo)),
          ),
        )
      : contas;

    const campo = (params.ordenar_por as string) ?? "vencimento";
    const direcao = (params.direcao as string) ?? "asc";
    const leia = (c: ContaDaTela): string | number => {
      if (campo === "valor_numero") return c.valor;
      if (campo === "saldo_numero") return c.saldo;
      return (
        (c as unknown as Record<string, string | number | null>)[campo] ?? ""
      );
    };
    const ordenadas = [...encontradas].sort((a, b) => {
      const x = leia(a);
      const y = leia(b);
      if (typeof x === "number" && typeof y === "number") {
        return direcao === "asc" ? x - y : y - x;
      }
      return direcao === "asc"
        ? String(x).localeCompare(String(y))
        : String(y).localeCompare(String(x));
    });

    const limite = (params.limite as number) ?? 15;
    const offset = (params.offset as number) ?? 0;

    return {
      itens: ordenadas.slice(offset, offset + limite),
      total: ordenadas.length,
      total_aberto: encontradas.reduce((t, c) => t + abertoDe(c), 0),
      total_quitado: encontradas.reduce((t, c) => t + quitadoDe(c), 0),
      limite,
      offset,
    };
  };

  return { fetchResumoDeContas, fetchPaginaDeContas };
}
