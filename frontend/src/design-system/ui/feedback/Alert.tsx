import type { HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "../core/Icon";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "danger";
  /** Primeira linha em semibold. Opcional. */
  title?: string;
  /** Presente, mostra o × de fechar. */
  onDismiss?: () => void;
  children?: ReactNode;
}

// Fundo tênue (`bg-tint-*`) + par de texto (`text-on-tint-*`) — mesma dupla
// do Badge. A borda do original é a mesma cor de significado a 30% de
// opacidade; como classe de token não pode levar modificador de opacidade
// (o Tailwind não aplica alfa sobre var() que guarda hexadecimal), a borda
// aqui usa a cor cheia do par de texto (`border-on-tint-*`) — mais forte que
// o original, mas é a solução já adotada e aprovada no Badge.
const VARIANT_CLASSES: Record<NonNullable<AlertProps["variant"]>, string> = {
  info: "border-on-tint-info bg-tint-info text-on-tint-info",
  success: "border-on-tint-success bg-tint-success text-on-tint-success",
  warning: "border-on-tint-warning bg-tint-warning text-on-tint-warning",
  danger: "border-on-tint-danger bg-tint-danger text-on-tint-danger",
};

const VARIANT_ICON: Record<NonNullable<AlertProps["variant"]>, IconName> = {
  info: "info",
  success: "check",
  warning: "warning",
  danger: "error",
};

/**
 * Aviso em bloco no fluxo da página — erro de carregamento, aviso de
 * permissão, prazo correndo. `role="alert"` anuncia sozinho para leitor de
 * tela; não empilhe com `<Toast>` para o mesmo evento.
 *
 * `title` é a primeira linha, em destaque; `children` é o corpo. Com
 * `onDismiss`, aparece o × de fechar à direita.
 *
 * ```tsx
 * <Alert variant="danger">Não foi possível carregar seus chamados.</Alert>
 * <Alert variant="warning" title="Prazo correndo" onDismiss={fechar}>
 *   Faltam 2 dias para o vencimento.
 * </Alert>
 * ```
 */
export function Alert({
  variant = "info",
  title,
  onDismiss,
  children,
  className,
  ...rest
}: AlertProps) {
  return (
    <div
      role="alert"
      className={[
        "flex items-start gap-3 rounded-lg border p-4 text-sm",
        VARIANT_CLASSES[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      <Icon name={VARIANT_ICON[variant]} size={20} strokeWidth={2} className="shrink-0" />
      <div className="min-w-0 flex-1">
        {title ? <p className="mb-0.5 font-semibold">{title}</p> : null}
        {children}
      </div>
      {onDismiss ? (
        <button
          type="button"
          aria-label="Fechar"
          onClick={onDismiss}
          className={[
            "shrink-0 rounded-lg p-1",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
          ].join(" ")}
        >
          <Icon name="close" size={16} strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}
