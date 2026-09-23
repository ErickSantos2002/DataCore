import React, { forwardRef, useId } from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

/**
 * Campo de texto de várias linhas — mesmo envelope do `Input` (rótulo, erro,
 * hint), com 4 linhas de altura por padrão e redimensionamento só vertical.
 *
 * ```tsx
 * <Textarea label="Observações" hint="Visível só para a equipe interna." />
 * ```
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, id, className, rows = 4, disabled, ...rest },
  ref,
) {
  const idGerado = useId();
  const textareaId = id ?? idGerado;
  const mensagemId = error || hint ? `${textareaId}-mensagem` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={textareaId} className="text-sm font-medium text-conteudo">
          {label}
        </label>
      ) : null}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={mensagemId}
        className={[
          "min-h-[80px] w-full resize-y rounded-lg border bg-surface px-3 py-2 font-sans text-sm text-conteudo transition-colors",
          "focus:outline-none focus:border-action",
          "focus-visible:ring-2 focus-visible:ring-focus",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error ? "border-danger" : "border-borda",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      />
      {error ? (
        <p id={mensagemId} className="text-xs text-on-tint-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={mensagemId} className="text-xs text-conteudo-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
