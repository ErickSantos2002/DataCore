import type { HTMLAttributes } from "react";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-[3px]",
};

/**
 * Anel de carregamento, na cor primária. `lg` centralizado é o vazio de
 * página. É a única animação em laço permitida numa tela de trabalho.
 *
 * ```tsx
 * <Spinner size="lg" />           // vazio de página, centralizado
 * <Button loading>Salvar</Button> // o botão já traz o seu
 * ```
 */
export function Spinner({
  size = "md",
  className,
  ...rest
}: SpinnerProps & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      role="status"
      aria-label="Carregando..."
      className={[
        "inline-block shrink-0 animate-[hs-spin_0.7s_linear_infinite] rounded-full border-t-transparent text-action",
        SIZE_CLASSES[size] ?? SIZE_CLASSES.md,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    />
  );
}
