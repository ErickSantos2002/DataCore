import React from "react";

import { Modal } from "../design-system/ui";

interface ModalObservacoesProps {
  observacoes: string | null;
  onClose: () => void;
}

/**
 * As observações de uma nota de serviço, com o texto já em mãos.
 *
 * Gêmeo de `ModalObservacoesDaNota`, que busca o texto ao abrir — aqui a
 * tabela de Serviços já o tem. Sem texto, não desenha nada: quem chama monta
 * o componente sempre e conta com isso.
 *
 * O `Modal` do design system, e não o `<div className="fixed inset-0">` que
 * estava aqui: aquele não tinha `role="dialog"` nem nome acessível, não
 * fechava com Escape, não prendia o foco e o botão era `bg-blue-600`, da
 * ponte de paleta. Fecha no × do cabeçalho, no Escape e na cortina.
 */
const ModalObservacoes: React.FC<ModalObservacoesProps> = ({
  observacoes,
  onClose,
}) => {
  if (!observacoes) return null;

  return (
    <Modal open onClose={onClose} title="Observações da Nota" size="lg">
      <div className="max-h-60 overflow-y-auto whitespace-pre-line text-sm text-conteudo">
        {observacoes}
      </div>
    </Modal>
  );
};

export default ModalObservacoes;
