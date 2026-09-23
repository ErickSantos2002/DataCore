import React, { forwardRef, useId } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Mensagem de erro — pinta a borda de vermelho e substitui o hint. */
  error?: string;
  /** Texto auxiliar abaixo do campo. */
  hint?: string;
  /** Ícone dentro do campo, à esquerda. */
  icon?: React.ReactNode;
}

/**
 * Campo de texto de uma linha. Rótulo sempre ligado ao campo (`htmlFor`
 * gerado por `useId`, a menos que a própria prop `id` diga outro). `error`
 * pinta a borda de vermelho, marca `aria-invalid` e substitui o `hint` — os
 * dois nunca aparecem juntos, porque a mensagem de erro já é a explicação.
 *
 * ```tsx
 * <Input label="CNPJ" icon={<Icon name="search" size={16} />} />
 * <Input label="CNPJ" error="CNPJ já cadastrado." />
 * ```
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, icon, id, className, disabled, ...rest },
  ref,
) {
  const idGerado = useId();
  const inputId = id ?? idGerado;
  const mensagemId = error || hint ? `${inputId}-mensagem` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-conteudo">
          {label}
        </label>
      ) : null}
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-conteudo-faint">
            {icon}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={mensagemId}
          className={[
            "w-full rounded-lg border bg-surface px-3 py-2 font-sans text-sm text-conteudo transition-colors",
            "focus:outline-none focus:border-action",
            "focus-visible:ring-2 focus-visible:ring-focus",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-danger" : "border-borda",
            icon ? "pl-9" : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...rest}
        />
      </div>
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
