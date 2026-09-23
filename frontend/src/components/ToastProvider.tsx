import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Toast, ToastStack } from "../design-system/ui/feedback";

type VarianteToast = "success" | "error" | "warning" | "info";

interface ItemToast {
  id: number;
  variante: VarianteToast;
  mensagem: string;
}

interface ContextoToast {
  sucesso: (mensagem: string) => void;
  erro: (mensagem: string) => void;
  aviso: (mensagem: string) => void;
  info: (mensagem: string) => void;
}

// 4 segundos, conforme o comentario de doc do Toast do design system
// ("Confirmação efêmera — 4 segundos, canto superior direito.").
const DURACAO_MS = 4000;

const ToastContext = createContext<ContextoToast | null>(null);

/**
 * Camada de estado do Toast, montada no app e não no design system de
 * propósito: lá o `Toast` é só apresentação — sem fila, sem temporizador,
 * sem gancho de disparo — porque em produção quem resolve isso é a
 * biblioteca escolhida por cada sistema (react-hot-toast no ChamadosHS,
 * sonner no HelpHS). Os dois divergem, o design system não escolheu um
 * lado, e o DataCoreHS não tem nenhum dos dois hoje.
 *
 * Instalar uma das duas aqui seria tomar partido nessa divergência por
 * conta própria, e quatro pontos de chamada não pagam uma dependência nova.
 * Esta camada (~60 linhas: fila + temporizador de 4s) fica até a H&S decidir
 * qual biblioteca é a oficial — aí ela é trocada pela configuração dela, e
 * o `Toast`/`ToastStack` portados continuam valendo como referência visual.
 *
 * Monta o `ToastStack` junto, então só precisa envolver a árvore uma vez —
 * ver `App.tsx`, fora do `<main>` que rola.
 */
export function ToastProvider({ children }: { children?: ReactNode }) {
  const [itens, setItens] = useState<ItemToast[]>([]);
  const proximoId = useRef(0);

  const remover = useCallback((id: number) => {
    setItens((atual) => atual.filter((item) => item.id !== id));
  }, []);

  const disparar = useCallback(
    (variante: VarianteToast, mensagem: string) => {
      const id = proximoId.current++;
      setItens((atual) => [...atual, { id, variante, mensagem }]);
      window.setTimeout(() => remover(id), DURACAO_MS);
    },
    [remover],
  );

  const valor = useMemo<ContextoToast>(
    () => ({
      sucesso: (mensagem: string) => disparar("success", mensagem),
      erro: (mensagem: string) => disparar("error", mensagem),
      aviso: (mensagem: string) => disparar("warning", mensagem),
      info: (mensagem: string) => disparar("info", mensagem),
    }),
    [disparar],
  );

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <ToastStack>
        {itens.map((item) => (
          <Toast
            key={item.id}
            variant={item.variante}
            onClose={() => remover(item.id)}
          >
            {item.mensagem}
          </Toast>
        ))}
      </ToastStack>
    </ToastContext.Provider>
  );
}

/**
 * Dispara um toast — `sucesso`, `erro`, `aviso` ou `info`, cada um recebendo
 * a mensagem. Precisa estar dentro de um `<ToastProvider>` (montado uma vez
 * em `App.tsx`).
 *
 * ```tsx
 * const { erro } = useToast();
 * erro("Não foi possível salvar o tipo da nota.");
 * ```
 */
export function useToast(): ContextoToast {
  const contexto = useContext(ToastContext);
  if (!contexto) {
    throw new Error("useToast precisa estar dentro de um <ToastProvider>.");
  }
  return contexto;
}
