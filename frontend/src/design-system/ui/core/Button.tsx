import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Spinner } from "./Spinner";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = ação principal (uma por bloco). ghost = ação terciária em barra de ferramentas. */
  variant?: "primary" | "secondary" | "danger" | "success" | "ghost";
  size?: "sm" | "md" | "lg";
  /** Mostra spinner e desabilita o botão junto. */
  loading?: boolean;
  /** Ícone à esquerda do rótulo (16px, stroke 1.75). */
  icon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "border border-action bg-action text-on-primary hover:bg-action-hover",
  secondary: "border border-borda bg-surface text-conteudo hover:bg-surface-elevated",
  danger: "border border-danger bg-danger text-on-danger hover:bg-danger-hover",
  success: "border border-success bg-success text-on-success hover:bg-success-hover",
  ghost: "border border-transparent bg-transparent text-conteudo-muted hover:bg-surface-elevated",
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

// O Button original desenha o spinner embutido em `currentColor` — ele
// herda o texto de cada variante (branco no danger/success, tom de ação no
// primary, corpo no secondary, muted no ghost). O Spinner genérico desta
// biblioteca é `text-action` fixo (contrato certo para o uso standalone,
// tipo vazio de página) — dentro do Button, cada variante sobrescreve com
// `!` porque a ordem das classes no JSX não garante qual regra o Tailwind
// gera primeiro no CSS final.
const SPINNER_CLASS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "",
  secondary: "!text-conteudo",
  danger: "!text-on-danger",
  success: "!text-on-success",
  ghost: "!text-conteudo-muted",
};

/**
 * Botão de ação. Use `primary` para a ação principal da tela (só uma por
 * bloco de decisão), `secondary` para alternativas, `ghost` para ação
 * terciária em barra de ferramentas. `danger` e `success` marcam o risco ou
 * a conclusão da ação.
 *
 * `loading` mostra o spinner e desabilita o clique junto — um botão que roda
 * mas continua clicável é como enviar o mesmo formulário duas vezes.
 *
 * ```tsx
 * <Button>Salvar</Button>
 * <Button variant="danger" loading>Excluir</Button>
 * <Button variant="ghost" size="sm" icon={<Icon name="filter" size={16} strokeWidth={2} />}>
 *   Filtrar
 * </Button>
 * ```
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {loading ? (
        <Spinner size="sm" className={SPINNER_CLASS[variant]} />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
