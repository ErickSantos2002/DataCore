import { useState } from "react";

import { Button, Modal, ModalFooter } from "../../design-system/ui";
import type { Usuario } from "../../services/api";
import { mensagemDeErro } from "./usuarios";

export interface ModalExcluirUsuarioProps {
  usuario: Usuario;
  onFechar: () => void;
  /** Exclui. Se rejeitar, o diálogo mostra o motivo e continua aberto. */
  onExcluir: () => Promise<void>;
}

/**
 * Confirmação de exclusão. Nomeia o usuário por extenso — "tem certeza?" sem
 * dizer de quem é a pergunta que mais erra alvo no sistema.
 */
export function ModalExcluirUsuario({
  usuario,
  onFechar,
  onExcluir,
}: ModalExcluirUsuarioProps) {
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  async function confirmar() {
    setErro(null);
    setExcluindo(true);
    try {
      await onExcluir();
    } catch (e) {
      setErro(mensagemDeErro(e, "Erro ao excluir usuário."));
      setExcluindo(false);
    }
  }

  return (
    <Modal open onClose={onFechar} title="Confirmar Exclusão" erro={erro}>
      <p className="text-conteudo">
        Tem certeza que deseja excluir o usuário{" "}
        <span className="font-semibold text-conteudo-heading">
          {usuario.username}
        </span>
        ? Esta ação não pode ser desfeita.
      </p>

      <ModalFooter>
        <Button variant="secondary" onClick={onFechar}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={confirmar} loading={excluindo}>
          Excluir
        </Button>
      </ModalFooter>
    </Modal>
  );
}
