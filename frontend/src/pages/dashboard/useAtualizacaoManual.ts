import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../../components/ToastProvider";
import {
  fetchUltimaAtualizacaoManual,
  pedirAtualizacaoManual,
  type PedidoDeAtualizacao,
} from "../../services/operacao";

/** De quanto em quanto tempo a tela pergunta se a atualização terminou. */
export const INTERVALO_ACOMPANHAMENTO_MS = 15_000;

export function pedidoAberto(pedido: PedidoDeAtualizacao | null): boolean {
  return pedido !== null && pedido.concluido_em === null;
}

/**
 * O botão "Atualizar dados agora": pede, acompanha e avisa quando termina.
 *
 * O acompanhamento existe porque a atualização leva uns 7 minutos e o toast
 * some em 4 segundos. Sem ele, quem clicou não saberia quando olhar de novo —
 * que foi exatamente o defeito do botão antigo, que dizia "acionado" e mais
 * nada (e nem isso era verdade).
 *
 * O aviso de término só sai para o pedido que ESTA aba viu aberto: quem abre
 * a tela depois de uma atualização concluída não precisa de toast velho.
 */
export function useAtualizacaoManual(habilitado: boolean) {
  const { sucesso, erro, info } = useToast();
  const [pedido, setPedido] = useState<PedidoDeAtualizacao | null>(null);
  const [enviando, setEnviando] = useState(false);
  const acompanhando = useRef<number | null>(null);

  const receber = useCallback(
    (novo: PedidoDeAtualizacao | null) => {
      if (novo && acompanhando.current === novo.id && !pedidoAberto(novo)) {
        acompanhando.current = null;
        if (novo.resultado === "sucesso") {
          sucesso(
            "Dados atualizados. Recarregue a página para ver os números novos.",
          );
        } else {
          erro(
            `A atualização terminou com problema${novo.detalhe ? `: ${novo.detalhe}` : "."} Veja a tela de Importações.`,
          );
        }
      }
      if (novo && pedidoAberto(novo)) acompanhando.current = novo.id;
      setPedido(novo);
    },
    [sucesso, erro],
  );

  useEffect(() => {
    if (!habilitado) return;
    let vivo = true;
    fetchUltimaAtualizacaoManual()
      .then((p) => vivo && receber(p))
      .catch(() => {
        // Sem o estado, o botão continua funcionando: só não mostra o andamento.
      });
    return () => {
      vivo = false;
    };
  }, [habilitado, receber]);

  const aberto = pedidoAberto(pedido);
  useEffect(() => {
    if (!habilitado || !aberto) return;
    const id = window.setInterval(() => {
      fetchUltimaAtualizacaoManual()
        .then(receber)
        .catch(() => {});
    }, INTERVALO_ACOMPANHAMENTO_MS);
    return () => window.clearInterval(id);
  }, [habilitado, aberto, receber]);

  const pedir = useCallback(async () => {
    setEnviando(true);
    try {
      const novo = await pedirAtualizacaoManual();
      receber(novo);
      info(
        "Atualização pedida: notas fiscais, notas de serviço e dados analíticos. Leva cerca de 7 minutos.",
      );
    } catch {
      erro("Não foi possível pedir a atualização.");
    } finally {
      setEnviando(false);
    }
  }, [receber, info, erro]);

  return { pedido, aberto, enviando, pedir };
}
