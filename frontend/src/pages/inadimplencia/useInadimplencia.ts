import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchDetalhe, fetchEmpresas, fetchIndicadores, fetchResumo, fetchTitulos,
  type DetalheDaEmpresa, type FiltrosDeEmpresas, type FiltrosDeIndicadores, type FiltrosDoResumo,
  type Indicadores, type PaginaDeEmpresas, type ResumoDeInadimplencia,
} from "../../services/inadimplencia";
import type { ContaDaTela } from "../../services/notasapi";

/**
 * Busca por chave: troca a chave, busca de novo; `recarregar` força.
 * Com `manterAnterior`, o último dado continua à mostra enquanto a nova chave carrega
 * (a lista não pisca "vazia" a cada tecla); `carregando` segue dizendo que há busca em curso.
 */
function useBusca<T>(chave: string | null, buscar: () => Promise<T>, mensagem: string, manterAnterior = false) {
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
    dado: estado && (manterAnterior || estado.chave === chave) ? estado.dado : null,
    carregando: chave !== null && estado?.chave !== chave,
    erro: estado?.chave === chave ? estado.erro : null,
    recarregar: useCallback(() => setVersao((v) => v + 1), []),
  };
}

/** Os cards seguem o recorte; o anterior fica à mostra enquanto o novo carrega (a tela não pisca). */
export function useResumo(filtros: FiltrosDoResumo) {
  const chave = useMemo(() => JSON.stringify(filtros), [filtros]);
  return useBusca<ResumoDeInadimplencia>(
    chave, () => fetchResumo(JSON.parse(chave)), "Não foi possível carregar a inadimplência.", true);
}

export function useEmpresas(filtros: FiltrosDeEmpresas) {
  const chave = useMemo(() => JSON.stringify(filtros), [filtros]);
  return useBusca<PaginaDeEmpresas>(chave, () => fetchEmpresas(JSON.parse(chave)), "Não foi possível carregar a lista.", true);
}

export function useDetalhe(empresa: string | null) {
  return useBusca<DetalheDaEmpresa>(empresa, () => fetchDetalhe(empresa!), "Não foi possível carregar a empresa.");
}

export function useTitulos(empresa: string | null) {
  return useBusca<ContaDaTela[]>(empresa, () => fetchTitulos(empresa!), "Não foi possível carregar os títulos.");
}

/** Só busca com a aba aberta; trocar o filtro busca de novo com os números anteriores à mostra. */
export function useIndicadores(ativo: boolean, filtros: FiltrosDeIndicadores = {}) {
  const chave = useMemo(() => JSON.stringify(filtros), [filtros]);
  return useBusca<Indicadores>(ativo ? chave : null, () => fetchIndicadores(JSON.parse(chave)),
    "Não foi possível carregar os indicadores.", true);
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
