import { useEffect, useId, useRef } from "react";
import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { Icon } from "../core/Icon";
import { Alert } from "./Alert";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Presente, desenha o cabeçalho com o × de fechar. */
  title?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  /**
   * Mensagem de erro DESTE diálogo — desenhada como `Alert` no topo do
   * corpo. Existe como prop, e não como um `<Alert>` que cada tela põe à
   * mão, porque o erro precisa pertencer a um modal e não à página: quando
   * a página guarda um `erroModal` só, a mesma frase acaba pintada dentro
   * do diálogo que não tem nada com ela.
   */
  erro?: string | null;
  children?: ReactNode;
}

const SIZE_CLASSES: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  "2xl": "max-w-3xl",
};

const FOCAVEIS_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focaveisDentro(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCAVEIS_SELECTOR));
}

/**
 * Diálogo modal — cadastro, confirmação, detalhe rápido. Fecha com `Esc` e
 * ao clicar na cortina.
 *
 * O foco fica preso dentro dele enquanto está aberto (`Tab`/`Shift+Tab`
 * ciclam só entre os elementos do painel) e volta para quem abriu o modal
 * quando ele fecha — acréscimos do port, ver comentários abaixo. Enquanto
 * está aberto, o fundo também não rola.
 *
 * MONTE O DIÁLOGO SÓ QUANDO ELE ESTIVER ABERTO — `{aberto && <MeuModal/>}`,
 * e não um `<MeuModal aberto={...}/>` que fica montado o tempo todo. Um
 * componente que sobrevive ao fechamento leva junto o que foi digitado
 * nele: o rascunho reaparece na próxima abertura, e a senha que era de um
 * usuário volta preenchida no formulário de outro. Montar só quando aberto
 * faz o estado morrer no fechamento sem uma linha de limpeza.
 *
 * ```tsx
 * <Modal open={aberto} onClose={fechar} title="Trocar senha">
 *   <p>...</p>
 *   <ModalFooter>
 *     <Button variant="secondary" onClick={fechar}>Cancelar</Button>
 *     <Button onClick={salvar}>Salvar</Button>
 *   </ModalFooter>
 * </Modal>
 * ```
 */
export function Modal({ open, onClose, title, size = "md", erro, children }: ModalProps) {
  const idGerado = useId();
  const tituloId = `${idGerado}-titulo`;

  const painelRef = useRef<HTMLDivElement>(null);
  // Acréscimo 2: devolver o foco. Guarda quem estava focado antes de abrir e
  // devolve a ele quando o modal fecha ou desmonta — o original não devolve.
  const focoAnteriorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    focoAnteriorRef.current = document.activeElement as HTMLElement | null;
    // Acréscimo 1 (parte 1): foco entra no painel ao abrir, mesmo que ele
    // não tenha nenhum elemento focável dentro (por isso o painel também
    // recebe tabIndex={-1}).
    painelRef.current?.focus();
    return () => {
      focoAnteriorRef.current?.focus();
    };
  }, [open]);

  // Acréscimo 5: travar a rolagem do fundo. Sem isto a roda do mouse rola a
  // página atrás do diálogo — a cortina esconde, mas não segura —, e ao
  // fechar a pessoa volta para um lugar da tela que não é o que ela deixou.
  useEffect(() => {
    if (!open) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [open]);

  // Acréscimo 1 (parte 2): prender o foco. O original deixa o Tab passear
  // pela página atrás do modal — armadilha para quem usa teclado. Aqui só a
  // borda do ciclo é interceptada (do último elemento de volta ao primeiro,
  // e vice-versa com Shift+Tab); o Tab "do meio" segue o fluxo normal do
  // navegador, que já é contíguo porque os dois extremos ficam dentro do
  // painel.
  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "Escape") {
      evento.preventDefault();
      onClose();
      return;
    }
    if (evento.key !== "Tab" || !painelRef.current) return;

    const focaveis = focaveisDentro(painelRef.current);
    if (focaveis.length === 0) {
      evento.preventDefault();
      return;
    }
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    const atual = document.activeElement;

    if (evento.shiftKey) {
      if (atual === primeiro || !painelRef.current.contains(atual)) {
        evento.preventDefault();
        ultimo.focus();
      }
    } else if (atual === ultimo || !painelRef.current.contains(atual)) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center p-4">
      {/* A cortina é a única transparência do sistema inteiro: preto a 60%
          com blur de 4px. Decorativa — a mesma ação (fechar) já está
          disponível via Esc, por isso aria-hidden. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-overlay backdrop-blur-[4px]"
      />
      {/* Acréscimo 4: o role="dialog" pertence ao painel, não ao envolvente
          que inclui a cortina — senão o fundo escurecido conta como parte
          do diálogo, e um teste de "o foco está dentro do diálogo?" responde
          sim mesmo sem prisão de foco nenhuma. */}
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? tituloId : undefined}
        tabIndex={-1}
        onKeyDown={aoTeclar}
        className={[
          "relative z-10 flex w-full flex-col",
          "max-h-[92vh] rounded-xl border border-borda bg-surface shadow-xl",
          "animate-[hs-modal-in_var(--duration-fast)_var(--ease-out)]",
          "focus:outline-none",
          SIZE_CLASSES[size],
        ].join(" ")}
      >
        {title ? (
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-borda px-6 py-4">
            {/* Acréscimo 3: nome acessível. O original tem <h2> mas nada o
                referencia — aria-labelledby aponta pra cá. */}
            <h2 id={tituloId} className="text-base font-semibold text-conteudo-heading">
              {title}
            </h2>
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className={[
                "shrink-0 rounded-lg p-1 text-conteudo-muted",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
              ].join(" ")}
            >
              <Icon name="close" size={20} strokeWidth={2} />
            </button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {erro ? (
            <Alert variant="danger" className="mb-4">
              {erro}
            </Alert>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Rodapé de ações do `Modal`. Sangra até as bordas do painel com margem
 * negativa e reestabelece o próprio padding — por isso só faz sentido como
 * filho direto de `Modal`. O par de botões é sempre Cancelar / ação, nessa
 * ordem.
 */
export function ModalFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        "-mx-6 -mb-4 mt-4 flex justify-end gap-3 border-t border-borda px-6 py-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
