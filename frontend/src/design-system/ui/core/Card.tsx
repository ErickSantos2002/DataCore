import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** none quando o card contém tabela ou lista que sangra até a borda. */
  padding?: "none" | "sm" | "md" | "lg";
  /** Realça a borda em azul no hover. */
  clickable?: boolean;
}

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

const PADDING_CLASSES: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "p-0",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

/**
 * Superfície padrão do sistema — card de KPI, painel de formulário, coluna
 * de quadro. Separa-se do fundo por 1px de borda, não por sombra: o design
 * system é de borda, sombra é só para o que de fato flutua (modal, seletor
 * aberto). `clickable` só quando o card inteiro navega — o realce no hover
 * é a borda virando `border-action`, nunca elevação ou mudança de fundo.
 *
 * ```tsx
 * <Card>
 *   <CardHeader title="Notas recentes" action={<Button size="sm" variant="secondary">Ver todas</Button>} />
 *   <p>…</p>
 * </Card>
 *
 * <Card padding="none">{/* tabela sangrando até a borda *\/}</Card>
 * ```
 *
 * `padding="none"` quando o conteúdo é tabela ou lista.
 */
export function Card({
  padding = "md",
  clickable = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={[
        "rounded-xl border border-borda bg-surface transition-colors",
        clickable ? "hover:border-action" : "",
        PADDING_CLASSES[padding],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * Cabeçalho do card: título e descrição à esquerda, ação à direita, com
 * borda inferior separando do corpo. Aceita `children` livre ou o trio
 * `title`/`description`/`action`.
 */
export function CardHeader({
  title,
  description,
  action,
  className,
  children,
  ...rest
}: CardHeaderProps) {
  return (
    <div
      className={[
        "mb-4 flex items-start justify-between gap-4 border-b border-borda pb-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children ?? (
        <>
          <div>
            {title ? <CardTitle>{title}</CardTitle> : null}
            {description ? (
              <p className="mt-0.5 text-sm text-conteudo-muted">{description}</p>
            ) : null}
          </div>
          {action ? <div>{action}</div> : null}
        </>
      )}
    </div>
  );
}

/** Título do card — `<h3>` de verdade, não um `div` com fonte grande. */
export function CardTitle({ className, children, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={["m-0 text-base font-semibold text-conteudo-heading", className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </h3>
  );
}

/** Corpo do card, com padding próprio (diferente do padding do `Card` em si). */
export function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["px-5 py-4", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}
