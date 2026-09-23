import { useState } from "react";

import { Button, Input, Modal, ModalFooter } from "../../design-system/ui";
import type { Usuario } from "../../services/api";
import { mensagemDeErro, validarSenha } from "./usuarios";

export interface ModalTrocarSenhaProps {
  usuario: Usuario;
  onFechar: () => void;
  /** Grava a senha nova. Se rejeitar, o diálogo mostra o motivo e fica aberto. */
  onConfirmar: (novaSenha: string) => Promise<void>;
}

/**
 * Troca de senha de um usuário existente.
 *
 * Três coisas que este diálogo já errou, e que a forma atual impede:
 *
 * 1. Ele vivia montado o tempo todo (`if (!isOpen) return null`), então a
 *    senha digitada para um usuário continuava no campo quando ele reabria
 *    para outro — um Confirmar distraído mandava a senha do A para o id do
 *    B. Agora a tela o monta só quando abre, e o estado morre no fechamento.
 * 2. Não havia mínimo nenhum: dava para gravar senha em branco num usuário
 *    que já existia, enquanto a criação exigia 6 caracteres. Agora os dois
 *    formulários chamam a mesma `validarSenha`.
 * 3. Ele fechava na mesma linha em que chamava a API, sem esperar resposta.
 *    Se a chamada falhasse, ninguém ficava sabendo. Agora ele espera, mostra
 *    o erro no mesmo lugar em que a tela mostra os outros, e só fecha no
 *    sucesso.
 */
export function ModalTrocarSenha({
  usuario,
  onFechar,
  onConfirmar,
}: ModalTrocarSenhaProps) {
  const [novaSenha, setNovaSenha] = useState("");
  const [repitaSenha, setRepitaSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function confirmar() {
    const problema = validarSenha(novaSenha, repitaSenha);
    if (problema) {
      setErro(problema);
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      await onConfirmar(novaSenha);
    } catch (e) {
      setErro(mensagemDeErro(e, "Erro ao trocar a senha."));
      setSalvando(false);
    }
  }

  return (
    <Modal open onClose={onFechar} title="Trocar Senha" erro={erro}>
      <p className="mb-4 text-sm text-conteudo-muted">
        Senha nova para{" "}
        <span className="font-semibold text-conteudo">{usuario.username}</span>.
      </p>

      <div className="flex flex-col gap-4">
        <Input
          label="Nova senha"
          type="password"
          hint="Mínimo de 6 caracteres."
          value={novaSenha}
          onChange={(evento) => setNovaSenha(evento.target.value)}
        />
        <Input
          label="Repita nova senha"
          type="password"
          value={repitaSenha}
          onChange={(evento) => setRepitaSenha(evento.target.value)}
        />
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onFechar}>
          Cancelar
        </Button>
        <Button onClick={confirmar} loading={salvando}>
          Confirmar
        </Button>
      </ModalFooter>
    </Modal>
  );
}
