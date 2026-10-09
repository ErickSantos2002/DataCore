import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchDetalhe, fetchEmpresas, fetchIndicadores, fetchResumo, fetchTitulos,
  type DetalheDaEmpresa, type FiltrosDeEmpresas, type Indicadores,
  type PaginaDeEmpresas, type ResumoDeInadimplencia,
} from "../../services/inadimplencia";
import type { ContaDaTela } from "../../services/notasapi";

/** Busca por chave: troca a chave, busca de novo; `recarregar` força. */
function useBusca<T>(chave: string | null, buscar: () => Promise<T>, mensagem: string) {
  const [estado, setEstado] = useState<{ chave: string; dado: T | null; erro: string | null } | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (chave === null) return;
    let vivo = true;
    buscar()
      .then((dado) => vivo && setEstado({ chave, dado, erro: null }))
      .catch((falha) => {
        console.error(mensagem, falha);
        if (vivo) setEstado({ chave, dado: null, erro: mensagem });
      });
    return () => { vivo = false; };
    // `buscar` muda a cada render; quem decide a busca é a chave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, versao]);

  return {
    dado: estado?.chave === chave ? estado.dado : null,
    carregando: chave !== null && estado?.chave !== chave,
    erro: estado?.chave === chave ? estado.erro : null,
    recarregar: useCallback(() => setVersao((v) => v + 1), []),
  };
}

export function useResumo() {
  return useBusca<ResumoDeInadimplencia>("resumo", fetchResumo, "Não foi possível carregar a inadimplência.");
}

export function useEmpresas(filtros: FiltrosDeEmpresas) {
  const chave = useMemo(() => JSON.stringify(filtros), [filtros]);
  return useBusca<PaginaDeEmpresas>(chave, () => fetchEmpresas(JSON.parse(chave)), "Não foi possível carregar a lista.");
}

export function useDetalhe(empresa: string | null) {
  return useBusca<DetalheDaEmpresa>(empresa, () => fetchDetalhe(empresa!), "Não foi possível carregar a empresa.");
}

export function useTitulos(empresa: string | null) {
  return useBusca<ContaDaTela[]>(empresa, () => fetchTitulos(empresa!), "Não foi possível carregar os títulos.");
}

export function useIndicadores(ativo: boolean) {
  return useBusca<Indicadores>(ativo ? "indicadores" : null, fetchIndicadores, "Não foi possível carregar os indicadores.");
}

/** Todas as empresas do filtro, página a página — só para a planilha. */
export async function todasAsEmpresas(filtros: FiltrosDeEmpresas) {
  const todas: PaginaDeEmpresas["itens"] = [];
  for (let offset = 0; ; offset += 1000) {
    const r = await fetchEmpresas({ ...filtros, limite: 1000, offset });
    todas.push(...r.itens);
    if (offset + 1000 >= r.total) return todas;
  }
}
