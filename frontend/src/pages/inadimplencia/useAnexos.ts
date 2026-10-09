import { useCallback, useEffect, useState, type ClipboardEvent } from "react";

import { baixarAnexo } from "../../services/inadimplencia";
import { juntarArquivos } from "./anexos";

/** Os arquivos escolhidos antes de enviar (clique, arrastar ou colar), com os avisos do que ficou de fora. */
export function useAnexosEscolhidos(vagas: number) {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);

  const adicionar = useCallback((novos: File[]) => {
    if (novos.length === 0) return;
    const r = juntarArquivos(arquivos, novos, vagas);
    setArquivos(r.arquivos);
    setAvisos(r.avisos);
  }, [arquivos, vagas]);

  const remover = useCallback((indice: number) => {
    setArquivos((atuais) => atuais.filter((_, i) => i !== indice));
    setAvisos([]);
  }, []);

  /** Ctrl+V: só intercepta quando a área de transferência traz arquivo — colar texto segue normal. */
  const aoColar = useCallback((e: ClipboardEvent) => {
    const colados = Array.from(e.clipboardData?.files ?? []);
    if (colados.length === 0) return;
    e.preventDefault();
    adicionar(colados);
  }, [adicionar]);

  return { arquivos, avisos, adicionar, remover, aoColar };
}

export type AnexosEscolhidos = ReturnType<typeof useAnexosEscolhidos>;

/**
 * O anexo como URL local (`blob:`), buscado com o token — não existe link público.
 * A URL é revogada quando o componente sai da tela ou troca de anexo.
 */
export function useUrlDoAnexo(anexoId: number, ativo: boolean) {
  const [estado, setEstado] = useState<{ id: number; url: string | null; falhou: boolean } | null>(null);

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    let url: string | null = null;
    baixarAnexo(anexoId)
      .then((blob) => {
        if (!vivo) return;
        url = URL.createObjectURL(blob);
        setEstado({ id: anexoId, url, falhou: false });
      })
      .catch((falha) => {
        console.error("Não foi possível baixar o anexo.", falha);
        if (vivo) setEstado({ id: anexoId, url: null, falhou: true });
      });
    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [anexoId, ativo]);

  return estado?.id === anexoId ? estado : null;
}
