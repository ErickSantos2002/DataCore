import type {
  DetalheDaEmpresa, EmpresaDaLista, FiltrosDeEmpresas, FiltrosDoResumo, Indicadores, NovoEvento, ResumoDeInadimplencia,
} from "../../services/inadimplencia";
import type { ContaDaTela } from "../../services/notasapi";

/** Dublê do backend da Inadimplência para os testes de tela. Não prova SQL — prova desenho. */
export function criarServidorDeInadimplencia() {
  const estado = {
    modo: "ok" as "ok" | "falha" | "pendente",
    resumo: null as ResumoDeInadimplencia | null,
    empresas: [] as EmpresaDaLista[],
    detalhes: {} as Record<string, DetalheDaEmpresa>,
    titulos: {} as Record<string, ContaDaTela[]>,
    indicadores: null as Indicadores | null,
    pedidos: [] as FiltrosDeEmpresas[],
    pedidosResumo: [] as FiltrosDoResumo[],
    eventos: [] as { empresa: string; dados: NovoEvento }[],
    observacoes: [] as { empresa: string; texto: string }[],
    erroDeGravacao: null as string | null,
  };
  const responder = <T,>(valor: () => T): Promise<T> => {
    if (estado.modo === "falha") return Promise.reject(new Error("500"));
    if (estado.modo === "pendente") return new Promise<T>(() => {});
    return Promise.resolve(valor());
  };
  const recusar = () =>
    Promise.reject({ response: { data: { detail: estado.erroDeGravacao } } });

  const servico = {
    fetchResumo: (f: FiltrosDoResumo = {}) => responder(() => {
      estado.pedidosResumo.push(f);
      return estado.resumo!;
    }),
    fetchEmpresas: (f: FiltrosDeEmpresas) => responder(() => {
      estado.pedidos.push(f);
      let lista = [...estado.empresas];
      if (f.busca) lista = lista.filter((e) => e.nome.toLowerCase().includes(f.busca!.toLowerCase()));
      if (f.status?.length) lista = lista.filter((e) => e.status && f.status!.includes(e.status));
      const offset = f.offset ?? 0;
      return { itens: lista.slice(offset, offset + (f.limite ?? 15)), total: lista.length,
               limite: f.limite ?? 15, offset };
    }),
    fetchDetalhe: (e: string) => responder(() => estado.detalhes[e]),
    fetchTitulos: (e: string) => responder(() => estado.titulos[e] ?? []),
    fetchIndicadores: () => responder(() => estado.indicadores!),
    registrarEvento: (empresa: string, dados: NovoEvento) => {
      if (estado.erroDeGravacao) return recusar();
      estado.eventos.push({ empresa, dados });
      return Promise.resolve(estado.detalhes[empresa]);
    },
    gravarObservacao: (empresa: string, texto: string) => {
      if (estado.erroDeGravacao) return recusar();
      estado.observacoes.push({ empresa, texto });
      return Promise.resolve({ ...estado.detalhes[empresa], observacao: texto || null });
    },
  };
  return { estado, servico };
}
