import React, { forwardRef, useId } from "react";
import { Icon } from "../core/Icon";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  /** Primeira opção vazia, ex. "Todos os status". */
  placeholder?: string;
}

/**
 * Seletor NATIVO. Lista curta e conhecida — status, prioridade, papel.
 * Mesmo envelope do `Input` (rótulo ligado por `htmlFor`, `error` pinta a
 * borda de vermelho e substitui o `hint`). `placeholder` vira a primeira
 * `<option value="">` da lista.
 *
 * A seta é o `Icon` `chevronDown`, não uma imagem de fundo: assim ela herda
 * `currentColor` e acompanha o tema sozinha.
 *
 * ```tsx
 * <Select label="Status" options={STATUS} placeholder="Todos os status" />
 * ```
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, options, placeholder, id, className, disabled, ...rest },
  ref,
) {
  const idGerado = useId();
  const selectId = id ?? idGerado;
  const mensagemId = error || hint ? `${selectId}-mensagem` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={selectId} className="text-sm font-medium text-conteudo">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={mensagemId}
          className={[
            "w-full appearance-none rounded-lg border bg-surface py-2 pl-3 pr-8 font-sans text-sm text-conteudo transition-colors",
            "cursor-pointer",
            "focus:outline-none focus:border-action",
            "focus-visible:ring-2 focus-visible:ring-focus",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-danger" : "border-borda",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...rest}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((opcao) => (
            <option key={opcao.value} value={opcao.value}>
              {opcao.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevronDown"
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-conteudo-faint"
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
