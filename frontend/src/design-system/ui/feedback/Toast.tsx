import type { ReactNode } from "react";
import { Icon, type IconName } from "../core/Icon";

export interface ToastProps {
  variant?: "success" | "error" | "warning" | "info";
  children?: ReactNode;
  onClose?: () => void;
}

const VARIANT_ICON: Record<NonNullable<ToastProps["variant"]>, IconName> = {
  success: "check",
  error: "error",
  warning: "warning",
  info: "info",
};

// Cor de significado do icone. "info" usa a cor de acao (--action), nao um
// token "info" de texto separado - e o par que o MEDIDAS do original pede.
const VARIANT_COLOR: Record<NonNullable<ToastProps["variant"]>, string> = {
  success: "text-success",
  error: "text-danger",
  warning: "text-warning",
  info: "text-action",
};

/**
 * Confirmação efêmera — 4 segundos, canto superior direito. Só apresentação:
 * quem monta fila, temporizador e disparo é a camada de estado do app
 * (`useToast`/`ToastProvider`), não este componente.
 *
 * `role="status"` com `aria-live="polite"` — se anuncia para leitor de tela
 * sem roubar o foco de quem está digitando, ao contrário do alerta nativo
 * do navegador.
 *
 * ```tsx
 * <Toast variant="success" onClose={fechar}>Senha alterada.</Toast>
 * ```
 */
export function Toast({ variant = "info", children, onClose }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "flex min-w-[260px] max-w-[380px] items-center gap-3 rounded-lg border",
        "border-toast-border bg-toast px-4 py-3 text-sm text-toast-fg shadow-lg",
        "animate-[hs-fade-in_var(--duration-fast)_var(--ease-out)]",
      ].join(" ")}
    >
      <Icon
        name={VARIANT_ICON[variant]}
        size={18}
        strokeWidth={2}
        className={["shrink-0", VARIANT_COLOR[variant]].join(" ")}
      />
      <div className="min-w-0 flex-1">{children}</div>
      {onClose ? (
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className={[
            "shrink-0 rounded-lg p-1 text-conteudo-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
          ].join(" ")}
        >
          <Icon name="close" size={16} strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Empilha os `Toast` no canto superior direito, fixo na tela. Monte um só,
 * fora de qualquer elemento que role — senão os toasts rolam junto com a
 * página em vez de ficarem fixos no canto.
 *
 * ```tsx
 * <ToastStack>
 *   {itens.map((item) => <Toast key={item.id} variant={item.variant}>{item.mensagem}</Toast>)}
 * </ToastStack>
 * ```
 */
export function ToastStack({ children }: { children?: ReactNode }) {
  return <div className="fixed top-20 right-6 z-toast flex flex-col gap-2">{children}</div>;
}
