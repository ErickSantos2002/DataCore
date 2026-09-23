import type { HTMLAttributes, ReactNode } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "secondary" | "muted" | "info" | "success" | "warning" | "danger";
  children?: ReactNode;
}

// Fundo tênue (`bg-tint-*`) + par de texto (`text-on-tint-*`), nunca o
// degrau 50/100 da rampa — um degrau fixo vira retângulo quase branco no
// meio do navy. A borda do original é a mesma cor a 30% de opacidade; como
// classe de token não pode levar modificador de opacidade (o Tailwind não
// aplica alfa sobre var() que guarda hexadecimal), a borda aqui usa a cor
// cheia do par de texto — mais forte que o original, mas dentro da regra.
const VARIANT_CLASSES: Record<NonNullable<BadgeProps["variant"]>, string> = {
  primary: "border-on-tint-primary bg-tint-primary text-on-tint-primary",
  secondary: "border-on-tint-neutral bg-tint-neutral text-on-tint-neutral",
  muted: "border-conteudo-faint bg-tint-neutral text-conteudo-faint",
  info: "border-on-tint-info bg-tint-info text-on-tint-info",
  success: "border-on-tint-success bg-tint-success text-on-tint-success",
  warning: "border-on-tint-warning bg-tint-warning text-on-tint-warning",
  danger: "border-on-tint-danger bg-tint-danger text-on-tint-danger",
};

/**
 * Selo de estado — fundo tênue, borda de 1px, texto na cor de significado.
 * Nunca use a cor sozinha para carregar o significado: o rótulo vem junto.
 *
 * ```tsx
 * <Badge variant="success">Ativo</Badge>
 * ```
 *
 * O original também traz `StatusBadge`, `PriorityBadge` e `TagBadge` — não
 * portados aqui: codificam o domínio de chamados do HelpHS (`open`,
 * `awaiting_client`, ...) e um cadastro de etiquetas de cor livre, nenhum
 * dos dois existe no DataCoreHS.
 */
export function Badge({ variant = "secondary", className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5",
        VARIANT_CLASSES[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </span>
  );
}
