import React, { useEffect, useState } from "react";

import { fetchObservacoesDaVenda } from "../services/notasapi";
import { Modal } from "../design-system/ui";

interface Props {
  /** A nota cujas observações abrir. */
  idNota: number;
  onClose: () => void;
}

/**
 * As observações de uma nota, buscadas na hora em que o modal abre.
 *
 * Antes o texto vinha dentro de cada nota da listagem: ~1,7 MB de campo livre
 * trafegando em toda carga da tela para o punhado de notas que alguém abre. E
 * é o campo mais sensível da nota — número de série do aparelho, chave de
 * acesso da NF-e, nome de quem recebeu.
 *
 * A listagem passou a dizer apenas SE há observação (`tem_observacoes`), que é
 * o que o botão precisa saber para existir.
 */
const ModalObservacoesDaNota: React.FC<Props> = ({ idNota, onClose }) => {
  /**
   * Um estado só, carimbado com a nota a que pertence.
   *
   * Três `useState` separados obrigariam a zerá-los no começo do efeito
   * quando a nota muda — `setState` síncrono dentro de `useEffect`, que
   * dispara render em cascata. Com o carimbo, "ainda estou buscando" é
   * DERIVADO no render em vez de escrito: enquanto a resposta que está na mão
   * for de outra nota, o que se mostra é a espera.
   */
  const [resposta, setResposta] = useState<{
    idNota: number;
    texto: string | null;
    erro: boolean;
  } | null>(null);

  useEffect(() => {
    let ativo = true;
    fetchObservacoesDaVenda(idNota)
      .then((texto) => {
        // `ativo` guarda o caso de fechar o modal (ou abrir outro) antes de a
        // resposta chegar: sem ele, a resposta da nota antiga escreveria por
        // cima do texto da nota nova — que é observação de outro cliente.
        if (ativo) setResposta({ idNota, texto, erro: false });
      })
      .catch(() => {
        if (ativo) setResposta({ idNota, texto: null, erro: true });
      });
    return () => {
      ativo = false;
    };
  }, [idNota]);

  const carregando = resposta === null || resposta.idNota !== idNota;

  return (
    /*
     * O `Modal` do design system, e não o `<div className="fixed inset-0">`
     * que estava aqui: aquele não tinha `role="dialog"` nem nome acessível,
     * não fechava com Escape, não prendia o foco (quem navegava por teclado
     * seguia tabulando na tabela atrás) e o botão era `bg-blue-600` da ponte
     * de paleta. `open` é sempre `true` porque quem abre monta o componente.
     *
     * Sem botão "Fechar" no rodapé: o × do cabeçalho já se chama assim, e dois
     * controles com o mesmo nome acessível no mesmo diálogo é ruído para quem
     * ouve a tela. Fecha no ×, no Escape e na cortina.
     */
    <Modal open onClose={onClose} title="Observações da Nota" size="lg">
      <div className="max-h-60 overflow-y-auto whitespace-pre-line text-sm text-conteudo">
        {carregando && <span className="text-conteudo-muted">Carregando…</span>}
        {!carregando && resposta.erro && (
          <span className="text-conteudo-muted">
            Não foi possível carregar as observações desta nota.
          </span>
        )}
        {!carregando &&
          !resposta.erro &&
          (resposta.texto || "Esta nota não tem observações.")}
      </div>
    </Modal>
  );
};

export default ModalObservacoesDaNota;
