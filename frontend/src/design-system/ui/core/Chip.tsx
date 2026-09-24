import { Icon } from "./Icon";

export interface ChipProps {
  /** `aplicado`: fundo de tinta, texto de ação — filtro em uso. `salvo`:
   * sem fundo, borda de 1px — visão salva. */
  variant?: "aplicado" | "salvo";
  /** Texto da pílula. Também compõe o `aria-label` do × quando `onRemove`
   * está presente ("Remover filtro " + este texto). */
  children: string;
  /** Presente, mostra o × que remove — ausente, a pílula é só leitura. */
  onRemove?: () => void;
  className?: string;
}

const VARIANT_CLASSES: Record<NonNullable<ChipProps["variant"]>, string> = {
  aplicado: "bg-action-tint text-action",
  salvo: "border border-borda text-conteudo",
};

/**
 * Pílula de filtro aplicado ou de visão salva — vive na segunda linha do
 * `FilterBar` (Task 3 deste adendo). Não nasceu como port: não existe
 * `Chip`/`Tag` no design system original, a anatomia vem do design do
 * Erick para o DataCoreHS.
 *
 * O × é um `<button>` de verdade, não um `<span onClick>` — alcançável por
 * teclado e com `aria-label` explícito, porque um glifo sozinho não diz "o
 * quê" remove.
 *
 * ```tsx
 * <Chip variant="aplicado" onRemove={() => remover("cliente")}>
 *   Cliente: CIMENTOS EXEMPLO
 * </Chip>
 * <Chip variant="salvo">Minha visão</Chip>
 * ```
 */
export function Chip({ variant = "aplicado", children, onRemove, className }: ChipProps) {
  return (
    <span
      className={[
        "inline-flex h-[26px] items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-medium",
        VARIANT_CLASSES[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remover filtro ${children}`}
          onClick={onRemove}
          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Icon name="close" size={12} strokeWidth={2.5} />
        </button>
      ) : null}
    </span>
  );
}
