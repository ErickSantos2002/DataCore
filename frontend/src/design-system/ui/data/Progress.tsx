import { Icon } from "../core/Icon";

export interface ProgressProps {
  /** 0–100. Satura em 100 para não vazar do card. */
  value?: number;
  /** `ontrack` verde, `attention` âmbar, `breached` vermelho, `neutral` azul. */
  tone?: "ontrack" | "attention" | "breached" | "neutral";
  /** Leitura curta abaixo da barra: "62% do prazo". */
  label?: string;
  /** Texto completo no `title` — o que não cabe no rótulo. */
  detail?: string;
  /** Encerrado: troca a barra pelo resumo do resultado. */
  done?: boolean;
  doneLabel?: string;
  /** Altura do trilho. `sm` (4px) é a altura de sempre e continua padrão —
   * `md` (6px) atende telas do design do Erick que pedem um trilho mais
   * grosso (ex.: `RankedList`). */
  trackSize?: "sm" | "md";
  /** Cor de fundo do trilho, independente da cor do preenchimento (`tone`).
   * `surface` preserva o `bg-surface-elevated` de sempre e continua padrão;
   * `action` é o caso concreto pedido pelo design (`RankedList`). Sem
   * conjunto semântico completo de propósito: o trilho é fundo — quem
   * carrega significado é o preenchimento, que já tem `tone`. */
  trackTone?: "surface" | "action";
}

const COR_PREENCHIMENTO: Record<NonNullable<ProgressProps["tone"]>, string> = {
  ontrack: "bg-success",
  attention: "bg-warning",
  breached: "bg-danger",
  neutral: "bg-action",
};

const ALTURA_TRILHO: Record<NonNullable<ProgressProps["trackSize"]>, string> = {
  sm: "h-1",
  md: "h-1.5",
};

const COR_TRILHO: Record<NonNullable<ProgressProps["trackTone"]>, string> = {
  surface: "bg-surface-elevated",
  action: "bg-action-tint",
};

/**
 * Barra de consumo de prazo ou de progresso de etapa. Vem do `SlaProgresso`
 * do ChamadosHS. A barra satura em 100% para não vazar do card quando o
 * prazo já estourou — o quanto passou do previsto vai no texto, não na
 * largura da barra.
 *
 * `done` troca a barra inteira por uma linha de resumo (ícone + `doneLabel`)
 * — para quando a etapa ou o prazo já se encerrou e a barra deixou de fazer
 * sentido.
 *
 * ```tsx
 * <Progress value={62} tone="attention" label="62% do prazo" />
 * <Progress value={100} tone="breached" done doneLabel="Prazo estourado" />
 * ```
 */
export function Progress({
  value = 0,
  tone = "neutral",
  label,
  detail,
  done = false,
  doneLabel,
  trackSize = "sm",
  trackTone = "surface",
}: ProgressProps) {
  const largura = Math.min(100, Math.max(0, value));

  if (done) {
    return (
      <div
        className={[
          "flex items-center gap-1.5 text-xs font-medium",
          tone === "breached" ? "text-on-tint-danger" : "text-on-tint-success",
        ].join(" ")}
        title={detail}
      >
        <Icon name={tone === "breached" ? "warning" : "check"} size={14} strokeWidth={2} />
        <span className="truncate">{doneLabel}</span>
      </div>
    );
  }

  return (
    <div className="grid gap-1" title={detail}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={largura}
        aria-valuemin={0}
        aria-valuemax={100}
        className={[
          "w-full overflow-hidden rounded-full",
          ALTURA_TRILHO[trackSize],
          COR_TRILHO[trackTone],
        ].join(" ")}
      >
        {/* Único estilo inline da biblioteca: a proibição do guarda de
            primitivos é contra aparência (cor, espaçamento, borda, sombra),
            que inline perde hover/focus-visible/responsivo. Largura de
            barra de progresso é geometria vinda de um número calculado em
            runtime — o Tailwind não tem como expressar isso em classe. */}
        <div
          className={[
            "h-full rounded-full transition-[width] duration-200 ease-in-out",
            COR_PREENCHIMENTO[tone],
          ].join(" ")}
          style={{ width: `${largura}%` }}
        />
      </div>
      {label ? (
        <div
          className={[
            "flex items-center gap-1.5 truncate text-xs font-medium",
            tone === "breached" ? "text-on-tint-danger" : "text-conteudo-muted",
          ].join(" ")}
        >
          {tone === "breached" ? <Icon name="warning" size={14} strokeWidth={2} /> : null}
          <span className="truncate">{label}</span>
        </div>
      ) : null}
    </div>
  );
}
