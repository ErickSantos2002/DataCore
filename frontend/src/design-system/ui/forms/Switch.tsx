import { forwardRef, useId, type ReactNode } from "react";

export interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  /** O que vem à direita do interruptor. Aceita nó do React, e não só texto,
   *  para o rótulo poder levar ícone — e o clique nele alternar, porque está
   *  dentro do `<label>`. */
  label?: ReactNode;
  disabled?: boolean;
  size?: "sm" | "md";
  id?: string;
  /** Classe do invólucro, para quem precisa virar a ordem
   *  (`flex-row-reverse`) ou ocupar a largura de um menu. Soma-se ao que o
   *  primitivo já põe, não substitui. */
  className?: string;
}

const TRACK_CLASSES: Record<NonNullable<SwitchProps["size"]>, string> = {
  sm: "h-6 w-11",
  md: "h-7 w-12",
};

const KNOB_CLASSES: Record<NonNullable<SwitchProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
};

/**
 * Interruptor de duas posições — o efeito é imediato, sem botão de salvar.
 * O `<input type="checkbox" role="switch">` real fica escondido (1×1,
 * opacidade 0); trilho e botão são `<span>` desenhados ao lado, e reagem ao
 * estado do campo por CSS (`peer-checked`), não por classe calculada em
 * JavaScript — o mesmo motivo pelo qual hover é `:hover` e não `useState`.
 *
 * ```tsx
 * <Switch label="Tema escuro" checked={escuro} onChange={setEscuro} />
 * ```
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { checked, onChange, label, disabled = false, size = "md", id, className },
  ref,
) {
  const idGerado = useId();
  const switchId = id ?? idGerado;

  return (
    <label
      htmlFor={switchId}
      className={[
        "inline-flex items-center gap-3 text-sm text-conteudo",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="relative inline-flex shrink-0">
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          id={switchId}
          checked={checked}
          disabled={disabled}
          onChange={(evento) => onChange?.(evento.target.checked)}
          className="peer absolute h-px w-px opacity-0"
        />
        <span
          aria-hidden="true"
          className={[
            "rounded-full border border-borda bg-surface-elevated transition-colors",
            "peer-checked:border-action peer-checked:bg-action",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-focus",
            TRACK_CLASSES[size],
          ].join(" ")}
        />
        <span
          aria-hidden="true"
          className={[
            "absolute left-1 top-1 rounded-full bg-on-primary shadow-sm transition-transform duration-150 ease-in-out",
            "peer-checked:translate-x-5",
            KNOB_CLASSES[size],
          ].join(" ")}
        />
      </span>
      {label}
    </label>
  );
});
