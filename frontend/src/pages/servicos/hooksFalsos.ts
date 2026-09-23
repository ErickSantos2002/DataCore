import { useMemo } from "react";

import type { NotaServico, ResumoDeServicos } from "../../services/notasapi";
import type { PedidoDaTabelaDeServicos, RecorteDeServicos } from "./useServicos";

/**
 * Os hooks da tela de Servicos, falsos, para os testes de tela.
 *
 * Mesmo desenho do falso do Comercial: o que os testes de tela provam e que a
 * tela pede o recorte certo, desenha o que recebe e pagina direito. A conta de
 * verdade e do banco, conferida contra o Postgres recorte por recorte.
 *
 * ⚠️ Este arquivo NAO e `.test`: e importado de dentro de uma fabrica de
 * `vi.mock`, que roda antes dos imports do arquivo de teste.
 */

interface ServicoDoFixture {
  id: number;
  /** `number` na API; alguns fixtures o escrevem como texto. */
  numero_nfse?: number | string;
  data_emissao?: string;
  razao_social_tomador?: string;
  cpf_cnpj_tomador?: string;
  cidade_tomador?: string;
  uf_tomador?: string;
  discriminacao_servico?: string;
  valor_servico?: number;
  [chave: string]: unknown;
}

const rotuloDoCliente = (s: ServicoDoFixture) =>
  `${s.razao_social_tomador} (${s.cpf_cnpj_tomador})`;
const rotuloDaCidade = (s: ServicoDoFixture) => `${s.cidade_tomador}/${s.uf_tomador}`;
const tipoDoServico = (s: ServicoDoFixture) =>
  s.discriminacao_servico?.substring(0, 50) || "Não especificado";

export function criarHooksFalsosDeServicos(servicos: ServicoDoFixture[]) {
  const distintos = (de: (s: ServicoDoFixture) => string) =>
    [...new Set(servicos.map(de))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const noRecorte = (s: ServicoDoFixture, recorte: RecorteDeServicos) => {
    if (recorte.clientes.length && !recorte.clientes.includes(rotuloDoCliente(s))) return false;
    if (recorte.cidades.length && !recorte.cidades.includes(rotuloDaCidade(s))) return false;
    if (recorte.tipos.length && !recorte.tipos.includes(tipoDoServico(s))) return false;
    const dia = s.data_emissao ?? "";
    if (recorte.dataInicio && dia && dia < recorte.dataInicio) return false;
    if (recorte.dataFim && dia && dia > recorte.dataFim) return false;
    return true;
  };

  const agrupar = (lista: ServicoDoFixture[], de: (s: ServicoDoFixture) => string) => {
    const soma = new Map<string, { valor: number; notas: number }>();
    for (const s of lista) {
      const chave = de(s);
      const atual = soma.get(chave) ?? { valor: 0, notas: 0 };
      atual.valor += s.valor_servico ?? 0;
      atual.notas += 1;
      soma.set(chave, atual);
    }
    return [...soma.entries()]
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome));
  };

  const montarResumo = (recorte: RecorteDeServicos): ResumoDeServicos => {
    const doRecorte = servicos.filter((s) => noRecorte(s, recorte));
    const faturamento = doRecorte.reduce((t, s) => t + (s.valor_servico ?? 0), 0);

    const porMes = new Map<string, { ano: number; mes: number; total: number; notas: number }>();
    for (const s of doRecorte) {
      const [ano, mes] = (s.data_emissao ?? "").split("-").map(Number);
      if (!ano) continue;
      const chave = `${ano}-${mes}`;
      const atual = porMes.get(chave) ?? { ano, mes, total: 0, notas: 0 };
      atual.total += s.valor_servico ?? 0;
      atual.notas += 1;
      porMes.set(chave, atual);
    }

    return {
      kpis: {
        faturamento,
        notas: doRecorte.length,
        ticket_medio: doRecorte.length ? faturamento / doRecorte.length : 0,
      },
      evolucao_mensal: [...porMes.values()].sort((a, b) => a.ano - b.ano || a.mes - b.mes),
      por_cliente: agrupar(doRecorte, (s) => s.razao_social_tomador ?? ""),
      por_cidade: agrupar(doRecorte, rotuloDaCidade),
      // As opcoes saem do universo INTEIRO, e nao do recorte — como no SQL.
      opcoes: {
        clientes: distintos(rotuloDoCliente),
        cidades: distintos(rotuloDaCidade),
        tipos: distintos(tipoDoServico),
      },
    };
  };

  const casa = (s: ServicoDoFixture, termo: string) => {
    const digitos = termo.replace(/\D/g, "");
    const alvo = termo.toLowerCase();
    const doc = (s.cpf_cnpj_tomador ?? "").replace(/\D/g, "");
    return (
      String(s.numero_nfse ?? "").toLowerCase().includes(alvo) ||
      (s.razao_social_tomador ?? "").toLowerCase().includes(alvo) ||
      (s.cpf_cnpj_tomador ?? "").toLowerCase().includes(alvo) ||
      (digitos !== "" && doc.includes(digitos)) ||
      (s.cidade_tomador ?? "").toLowerCase().includes(alvo) ||
      (s.discriminacao_servico ?? "").toLowerCase().includes(alvo)
    );
  };

  return {
    // ⚠️ `useMemo`: o hook de verdade guarda o resumo em estado, entao a
    // referencia dele e estavel entre renders. Um falso que devolve array novo
    // a cada render poe a tela em laco.
    useResumoDeServicos: (recorte: RecorteDeServicos) => {
      const chave = JSON.stringify(recorte);
      const resumo = useMemo(() => montarResumo(recorte), [chave]);
      return { resumo, carregando: false, erro: null };
    },

    usePaginaDeServicos: (
      recorte: RecorteDeServicos,
      pedido: PedidoDaTabelaDeServicos,
    ) => {
      const termo = pedido.busca.trim();
      const doRecorte = servicos.filter((s) => noRecorte(s, recorte));
      const encontradas = termo ? doRecorte.filter((s) => casa(s, termo)) : doRecorte;
      const inicio = Math.max(0, (pedido.pagina - 1) * pedido.porPagina);
      return {
        pagina: {
          itens: encontradas.slice(inicio, inicio + pedido.porPagina) as NotaServico[],
          total: encontradas.length,
          valor_total: encontradas.reduce((t, s) => t + (s.valor_servico ?? 0), 0),
          limite: pedido.porPagina,
          offset: inicio,
        },
        carregando: false,
        erro: null,
      };
    },

    todosOsServicos: async () => servicos as NotaServico[],
  };
}
