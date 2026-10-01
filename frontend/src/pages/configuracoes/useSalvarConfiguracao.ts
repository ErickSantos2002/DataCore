import { useState } from "react";

import { useConfiguracoes } from "../../context/ConfiguracoesContext";

/** A frase que a tela mostra quando gravar falha. O 422 traz a mensagem do
 *  backend pronta, em português; o resto vira frase, não código. */
export function mensagemDeErro(erro: unknown): string {
  const resposta = (
    erro as { response?: { status?: number; data?: { detail?: unknown } } }
  )?.response;
  if (resposta?.status === 403)
    return "Só administradores podem alterar configurações.";
  if (typeof resposta?.data?.detail === "string") return resposta.data.detail;
  return "Não foi possível salvar. Confira a conexão e tente de novo.";
}

/** Salva uma chave e guarda o erro para a seção mostrar. Devolve true quando
 *  gravou — a seção decide se fecha a edição. */
export function useSalvarConfiguracao(chave: string, aoSalvar?: () => void) {
  const { editarConfiguracao } = useConfiguracoes();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(valor: string): Promise<boolean> {
    setSalvando(true);
    setErro(null);
    try {
      await editarConfiguracao(chave, valor);
      aoSalvar?.();
      return true;
    } catch (e) {
      setErro(mensagemDeErro(e));
      return false;
    } finally {
      setSalvando(false);
    }
  }

  return { salvar, salvando, erro };
}
