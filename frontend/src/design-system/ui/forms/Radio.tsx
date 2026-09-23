import React, { forwardRef, useId } from "react";

export interface RadioProps {
  name: string;
  value: string;
  checked?: boolean;
  onChange?: (value: string) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  id?: string;
}

export interface RadioGroupOption {
  value: string;
  label: string;
  hint?: string;
}

export interface RadioGroupProps {
  name: string;
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  options: RadioGroupOption[];
  /** `row` para duas ou três opções curtas. */
  direction?: "column" | "row";
}

/**
 * Uma opção de rádio isolada. Fora de um `RadioGroup` o consumidor precisa
 * gerenciar `name`/`checked`/`onChange` na mão — para o caso comum, use
 * `RadioGroup`, que desenha as opções e cuida disso.
 *
 * Mesmo envelope do `Checkbox`: `<input>` real escondido, `<span>` desenhado
 * ao lado com o anel de foco (`peer-focus-visible`) e a pintura de "marcado"
 * (`peer-checked`) lendo o `:checked` do DOM — nunca uma classe calculada a
 * partir da prop `checked`, que fica presa em `undefined` quando o consumidor
 * não recontrola o campo depois do clique.
 */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { name, value, checked, onChange, label, hint, disabled = false, id },
  ref,
) {
  const idGerado = useId();
  const radioId = id ?? idGerado;

  return (
    <label
      htmlFor={radioId}
      className={[
        "inline-flex items-start gap-2 text-sm leading-4 text-conteudo",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      ].join(" ")}
    >
      <span className="relative inline-flex shrink-0">
        <input
          ref={ref}
          type="radio"
          id={radioId}
          name={name}
          value={value}
          checked={checked}
          disabled={disabled}
          onChange={() => onChange?.(value)}
          className="peer absolute h-px w-px opacity-0"
        />
        <span
          aria-hidden="true"
          className={[
            "flex h-4 w-4 items-center justify-center rounded-full border bg-surface transition-colors",
            "border-borda-strong peer-checked:border-action",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-focus",
          ].join(" ")}
        >
          <span className="h-2 w-2 rounded-full bg-action opacity-0 transition-opacity peer-checked:opacity-100" />
        </span>
      </span>
      {label ? (
        <span className="flex flex-col">
          <span>{label}</span>
          {hint ? <span className="mt-0.5 text-xs text-conteudo-muted">{hint}</span> : null}
        </span>
      ) : null}
    </label>
  );
});

const DIRECTION_CLASSES: Record<NonNullable<RadioGroupProps["direction"]>, string> = {
  column: "flex-col gap-3",
  row: "flex-row gap-5",
};

/**
 * Grupo de rádio — um `<fieldset>` sem borda com `<legend>` de rótulo,
 * controlado (`value` + `onChange`) e desenhando cada opção de `options`
 * internamente. `direction="row"` para duas ou três opções curtas.
 *
 * ```tsx
 * <RadioGroup
 *   name="tipo"
 *   label="Tipo da nota"
 *   value={tipo}
 *   onChange={setTipo}
 *   options={[
 *     { value: "outbound", label: "Outbound" },
 *     { value: "inbound", label: "Inbound" },
 *   ]}
 * />
 * ```
 */
export function RadioGroup({
  name,
  label,
  value,
  onChange,
  options,
  direction = "column",
}: RadioGroupProps) {
  return (
    <fieldset className="m-0 border-0 p-0">
      {label ? <legend className="mb-2 text-sm font-medium text-conteudo">{label}</legend> : null}
      <div className={["flex", DIRECTION_CLASSES[direction]].join(" ")}>
        {options.map((opcao) => (
          <Radio
            key={opcao.value}
            name={name}
            value={opcao.value}
            label={opcao.label}
            hint={opcao.hint}
            checked={value === opcao.value}
            onChange={onChange}
          />
        ))}
      </div>
    </fieldset>
  );
}
