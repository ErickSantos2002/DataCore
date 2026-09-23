import { Card } from "../core/Card";

export interface KpiCardProps {
  /** Rótulo curto, em caixa alta — "FATURAMENTO TOTAL". */
  label: string;
  value: string | number;
  /** `acao` dinheiro "bom", `positivo` contagem positiva, `alerta`/`perigo`
   * chamam atenção, `neutro` (padrão) quando o número não carrega juízo. */
  tone?: "acao" | "positivo" | "alerta" | "perigo" | "neutro";
  /** Contextualiza o número — "94 vendas no período". */
  note?: string;
  /** `value` é um nome, não um número (ex.: "Produto Top"). Troca o tamanho
   * fluido por 16px fixo e trunca com reticências em vez de nunca quebrar.
   * É prop, não adivinhação: "1.234" é texto que se comporta como número. */
  valorEhTexto?: boolean;
  className?: string;
}

const COR_VALOR: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  acao: "text-action",
  positivo: "text-success",
  alerta: "text-on-tint-warning",
  perigo: "text-on-tint-danger",
  neutro: "text-conteudo-heading",
};

/**
 * Cartão de indicador — três linhas de anatomia fixa: rótulo, valor, nota.
 * Não é port: não existe `.d.ts` para ele no design system, a anatomia vem
 * do design do Erick para o DataCoreHS (faixa de KPIs de Vendas, Serviços,
 * Estoque, Contas...).
 *
 * Vive numa faixa `grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4` —
 * a faixa é composição da tela, este componente só é o cartão de 116px.
 *
 * ```tsx
 * <KpiCard label="Faturamento Total" value="R$ 128.450,00" tone="acao" note="94 vendas no período" />
 * <KpiCard label="Produto Top" value="Extintor ABC 6kg" valorEhTexto note="32% do volume" />
 * ```
 */
export function KpiCard({
  label,
  value,
  tone = "neutro",
  note,
  valorEhTexto = false,
  className,
}: KpiCardProps) {
  return (
    <Card className={["flex h-[116px] flex-col justify-between", className].filter(Boolean).join(" ")}>
      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-conteudo-faint">
        {label}
      </p>
      <p
        className={[
          "font-mono font-bold",
          valorEhTexto
            ? "truncate text-base"
            : "whitespace-nowrap text-[clamp(16px,2.1vw,24px)]",
          COR_VALOR[tone],
        ].join(" ")}
        title={valorEhTexto ? String(value) : undefined}
      >
        {value}
      </p>
      {note ? <p className="truncate text-xs text-conteudo-muted">{note}</p> : null}
    </Card>
  );
}
