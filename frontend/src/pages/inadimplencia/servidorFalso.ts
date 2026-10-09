import type {
  AnexoDoEvento, DetalheDaEmpresa, EmpresaDaLista, FiltrosDeEmpresas, FiltrosDoResumo, FiltrosDeIndicadores, Indicadores, NovoEvento,
  ResumoDeInadimplencia,
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
    pedidosIndicadores: [] as FiltrosDeIndicadores[],
    eventos: [] as { empresa: string; dados: NovoEvento }[],
    observacoes: [] as { empresa: string; texto: string }[],
    erroDeGravacao: null as string | null,
    /** O id que o registro de contato devolve como `evento_id`. */
    proximoEventoId: 99,
    anexosEnviados: [] as { eventoId: number; arquivos: File[] }[],
    anexosApagados: [] as number[],
    anexosBaixados: [] as number[],
    erroDeAnexo: null as string | null,
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
    fetchIndicadores: (f: FiltrosDeIndicadores = {}) => responder(() => {
      estado.pedidosIndicadores.push(f);
      return estado.indicadores!;
    }),
    registrarEvento: (empresa: string, dados: NovoEvento) => {
      if (estado.erroDeGravacao) return recusar();
      estado.eventos.push({ empresa, dados });
      return Promise.resolve({ ...estado.detalhes[empresa], evento_id: estado.proximoEventoId });
    },
    enviarAnexos: (eventoId: number, arquivos: File[]) => {
      if (estado.erroDeAnexo) return Promise.reject({ response: { data: { detail: estado.erroDeAnexo } } });
      estado.anexosEnviados.push({ eventoId, arquivos });
      return Promise.resolve([] as AnexoDoEvento[]);
    },
    baixarAnexo: (anexoId: number) => {
      estado.anexosBaixados.push(anexoId);
      return Promise.resolve(new Blob(["conteudo"]));
    },
    apagarAnexo: (anexoId: number) => {
      if (estado.erroDeAnexo) return Promise.reject({ response: { data: { detail: estado.erroDeAnexo } } });
      estado.anexosApagados.push(anexoId);
      return Promise.resolve();
    },
    gravarObservacao: (empresa: string, texto: string) => {
      if (estado.erroDeGravacao) return recusar();
      estado.observacoes.push({ empresa, texto });
      return Promise.resolve({ ...estado.detalhes[empresa], observacao: texto || null });
    },
  };
  return { estado, servico };
}
