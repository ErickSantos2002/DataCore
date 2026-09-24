import { useEffect, useId, useRef } from "react";
import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { Badge } from "../core/Badge";
import type { BadgeProps } from "../core/Badge";
import { Button } from "../core/Button";
import type { ButtonProps } from "../core/Button";
import { Icon } from "../core/Icon";

export interface DrawerStatus {
  label: string;
  variant?: BadgeProps["variant"];
}

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Identificador em caixa alta acima do título — ex.: "PEDIDO #1234". */
  eyebrow?: string;
  /** Nome do registro, vira o `<h2>` do cabeçalho. */
  title: string;
  /** Linha em `font-mono` abaixo do título — ex.: cliente, documento. */
  subtitle?: string;
  /** Selo de estado ao lado do título — vira um `Badge` no cabeçalho. */
  status?: DrawerStatus;
  children?: ReactNode;
}

// Mesma mecânica de acessibilidade do `Modal` (foco preso nas duas direções,
// devolução ao gatilho, Esc fecha, role="dialog" no painel e não no
// envolvente que inclui a cortina) — replicada aqui de propósito, não
// extraída para um hook compartilhado. Motivo: o arquivo desta task é só
// `Drawer.tsx` + `index.ts`; o `Modal.tsx` já passou por revisão e tem sua
// própria suíte cobrindo exatamente este mecanismo, e a Fase 1 já registrou
// como fica caro um teste mentir aqui. Introduzir um hook compartilhado
// exigiria reabrir e re-testar o `Modal` fora do escopo desta task só para
// economizar ~30 linhas — risco maior que o ganho. Se aparecer um terceiro
// consumidor, aí vale extrair (regra dos três).
const FOCAVEIS_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focaveisDentro(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCAVEIS_SELECTOR));
}

/**
 * Painel lateral — detalhe de um registro (pedido, cliente, conta). Desliza
 * da direita, `Esc` fecha, e fecha ao clicar na cortina.
 *
 * O foco fica preso dentro dele enquanto está aberto (`Tab`/`Shift+Tab`
 * ciclam só entre os elementos do painel) e volta para quem abriu o drawer
 * quando ele fecha — mesmo mecanismo do `Modal`, ver comentário acima.
 *
 * ```tsx
 * <Drawer
 *   open={aberto}
 *   onClose={fechar}
 *   eyebrow="Pedido #1234"
 *   title="Cimentos Exemplo S.A"
 *   subtitle="NF-e 000.123.456"
 *   status={{ label: "Faturado", variant: "success" }}
 * >
 *   <DrawerBody>...</DrawerBody>
 *   <DrawerFooter
 *     secondaryLabel="Fechar"
 *     onSecondary={fechar}
 *     actionLabel="Editar"
 *     onAction={editar}
 *   />
 * </Drawer>
 * ```
 */
export function Drawer({
  open,
  onClose,
  eyebrow,
  title,
  subtitle,
  status,
  children,
}: DrawerProps) {
  const idGerado = useId();
  const tituloId = `${idGerado}-titulo`;

  const painelRef = useRef<HTMLDivElement>(null);
  // Guarda quem estava focado antes de abrir e devolve a ele quando o
  // drawer fecha ou desmonta.
  const focoAnteriorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    focoAnteriorRef.current = document.activeElement as HTMLElement | null;
    painelRef.current?.focus();
    return () => {
      focoAnteriorRef.current?.focus();
    };
  }, [open]);

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "Escape") {
      evento.preventDefault();
      onClose();
      return;
    }
    if (evento.key !== "Tab" || !painelRef.current) return;

    const focaveis = focaveisDentro(painelRef.current);
    if (focaveis.length === 0) {
      evento.preventDefault();
      return;
    }
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    const atual = document.activeElement;

    if (evento.shiftKey) {
      if (atual === primeiro || !painelRef.current.contains(atual)) {
        evento.preventDefault();
        ultimo.focus();
      }
    } else if (atual === ultimo || !painelRef.current.contains(atual)) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-overlay">
      {/* A cortina é a mesma do Modal: única transparência do sistema,
          preto a 60% com blur de 4px. Decorativa — a mesma ação (fechar)
          já está disponível via Esc, por isso aria-hidden. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-overlay backdrop-blur-[4px]"
      />
      {/* role="dialog" pertence ao painel, não ao envolvente que inclui a
          cortina — senão o fundo escurecido conta como parte do diálogo, e
          um teste de "o foco está dentro do diálogo?" responde sim mesmo
          sem prisão de foco nenhuma. */}
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        onKeyDown={aoTeclar}
        className={[
          "absolute inset-y-0 right-0 z-10 flex w-[440px] max-w-[92vw] flex-col",
          "border-l border-borda bg-surface shadow-xl",
          "animate-hs-drawer-in",
          "focus:outline-none",
        ].join(" ")}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-borda px-6 py-4">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-conteudo-faint">
                {eyebrow}
              </p>
            ) : null}
            <div className="mt-1 flex items-center gap-2">
              <h2 id={tituloId} className="truncate text-base font-semibold text-conteudo-heading">
                {title}
              </h2>
              {status ? <Badge variant={status.variant}>{status.label}</Badge> : null}
            </div>
            {subtitle ? (
              <p className="mt-1 font-mono text-xs text-conteudo-muted">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className={[
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-conteudo-muted",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
            ].join(" ")}
          >
            <Icon name="close" size={20} strokeWidth={2} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

/**
 * Corpo do `Drawer` em grade de pares rótulo/valor, duas colunas.
 *
 * ```tsx
 * <DrawerBody>
 *   <DrawerField label="Cliente">Cimentos Exemplo S.A</DrawerField>
 *   <DrawerField label="Status"><Badge variant="success">Ativo</Badge></DrawerField>
 * </DrawerBody>
 * ```
 */
export function DrawerBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={["grid grid-cols-2 gap-x-4 gap-y-4", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface DrawerFieldProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
}

/** Um par rótulo/valor dentro do `DrawerBody`. */
export function DrawerField({ label, className, children, ...rest }: DrawerFieldProps) {
  return (
    <div className={["min-w-0", className].filter(Boolean).join(" ")} {...rest}>
      <p className="text-xs font-semibold uppercase tracking-wider text-conteudo-faint">
        {label}
      </p>
      <div className="mt-1 text-sm text-conteudo">{children}</div>
    </div>
  );
}

export interface DrawerFooterProps {
  secondaryLabel: string;
  onSecondary: () => void;
  secondaryDisabled?: boolean;
  actionLabel: string;
  onAction: () => void;
  actionVariant?: ButtonProps["variant"];
  actionLoading?: boolean;
  actionDisabled?: boolean;
}

/**
 * Rodapé de ações do `Drawer`. Sangra até as bordas do painel com margem
 * negativa e reestabelece o próprio padding — por isso só faz sentido como
 * filho direto de `Drawer`. A anatomia é fixa — sempre dois botões,
 * secundário à esquerda e ação à direita — por isso a API é de rótulos e
 * callbacks, não de `children` livre: quem usa não decide a ordem.
 */
export function DrawerFooter({
  secondaryLabel,
  onSecondary,
  secondaryDisabled,
  actionLabel,
  onAction,
  actionVariant = "primary",
  actionLoading,
  actionDisabled,
}: DrawerFooterProps) {
  return (
    <div className="-mx-6 -mb-4 mt-4 flex justify-between gap-3 border-t border-borda px-6 py-4">
      <Button variant="secondary" onClick={onSecondary} disabled={secondaryDisabled}>
        {secondaryLabel}
      </Button>
      <Button
        variant={actionVariant}
        onClick={onAction}
        loading={actionLoading}
        disabled={actionDisabled}
      >
        {actionLabel}
      </Button>
    </div>
  );
}
