import React, { forwardRef, useEffect, useId, useRef } from "react";

export interface CheckboxProps {
  checked?: boolean;
  /** Traço no lugar do visto — grupo parcialmente marcado. */
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  /** Segunda linha, menor, explicando a consequência de marcar. */
  hint?: string;
  disabled?: boolean;
  id?: string;
}

// `indeterminate` não é atributo HTML — só existe como propriedade imperativa
// do elemento. Precisa de um ref próprio para setá-la, além do ref que a
// biblioteca de formulário passa de fora para focar o campo com erro. Os
// dois apontam para o mesmo <input>.
function mesclarRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return (valor) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(valor);
      else (ref as React.MutableRefObject<T | null>).current = valor;
    }
  };
}

/**
 * Caixa de marcar — o `<input>` real fica escondido (1×1, opacidade 0, sem
 * sair da árvore de acessibilidade) e quem aparece é o `<span>` desenhado ao
 * lado. O anel de foco por isso mora no `<span>` (`peer-focus-visible`), não
 * no campo em si. Clicar no rótulo alterna a caixa — comportamento nativo de
 * `<label>` em volta do controle.
 *
 * A pintura de "marcado" também é `peer-checked`, não uma classe calculada a
 * partir da prop `checked` em JS: sem `checked` controlado, um clique alterna
 * o `<input>` nativo sem que ninguém reatualize essa prop, e um `<span>`
 * pintado por ela ficaria marcado para o leitor de tela e vazio para o olho.
 * `indeterminate` é a exceção — não existe pseudo-classe CSS confiável para
 * ele no Tailwind 3, então continua pintado pela prop, e só faz sentido em
 * uso controlado mesmo.
 *
 * ```tsx
 * <Checkbox label="Somente ativos" checked={somenteAtivos} onChange={setSomenteAtivos} />
 * <Checkbox label="Selecionar tudo" indeterminate />
 * ```
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { checked, indeterminate = false, onChange, label, hint, disabled = false, id },
  ref,
) {
  const idGerado = useId();
  const checkboxId = id ?? idGerado;
  const refInterno = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (refInterno.current) refInterno.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label
      htmlFor={checkboxId}
      className={[
        "inline-flex items-start gap-2 text-sm leading-4 text-conteudo",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      ].join(" ")}
    >
      <span className="relative inline-flex shrink-0">
        <input
          ref={mesclarRefs(ref, refInterno)}
          type="checkbox"
          id={checkboxId}
          checked={checked}
          disabled={disabled}
          onChange={(evento) => onChange?.(evento.target.checked)}
          className="peer absolute h-px w-px opacity-0"
        />
        <span
          aria-hidden="true"
          className={[
            "flex h-4 w-4 items-center justify-center rounded-sm border transition-colors",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-focus",
            indeterminate
              ? "border-action bg-action"
              : "border-borda-strong bg-surface peer-checked:border-action peer-checked:bg-action",
          ].join(" ")}
        >
          {indeterminate ? (
            <span className="h-0.5 w-2 rounded-[1px] bg-on-primary" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              width={12}
              height={12}
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              className="text-on-primary opacity-0 transition-opacity peer-checked:opacity-100"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
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
