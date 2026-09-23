import type { SVGProps } from "react";

/* Traçados copiados verbatim de HelpHS/frontend/src/components/layout/Sidebar.tsx,
 * ui/Alert.tsx, ui/Modal.tsx e ui/SlaChip.tsx. Todos 24×24, sem preenchimento,
 * stroke `currentColor`, cantos e junções arredondados. É o conjunto que os
 * sistemas usam hoje; onde o DataCoreHS usa lucide-react o desenho é o mesmo
 * traço de 24×24 com peso 2 (ver readme.md → ICONOGRAFIA). */
export const ICON_PATHS = {
  dashboard:
    "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  ticket:
    "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z",
  users:
    "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  groups:
    "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  box: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  chart:
    "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  shield:
    "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  cpu: "M9 3H7a2 2 0 00-2 2v2M9 3h6M9 3v2m6-2h2a2 2 0 012 2v2M15 3v2M3 9h2m16 0h-2M3 15h2m16 0h-2M9 21H7a2 2 0 01-2-2v-2m4 4h6m-6 0v-2m6 2h2a2 2 0 002-2v-2m-4 4v-2M9 9h6v6H9V9z",
  book: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  tag: "M7 7h.01M7 3h5.586a1 1 0 01.707.293l7.414 7.414a2 2 0 010 2.828l-5.586 5.586a2 2 0 01-2.828 0L4.879 11.707A2 2 0 014.293 11.1L3 5.414A2 2 0 014.414 4L7 3z",
  chat: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  calendar:
    "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  info: "M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z",
  check: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  warning:
    "M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  error: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
  close: "M6 18L18 6M6 6l12 12",
  plus: "M12 4v16m8-8H4",
  menu: "M4 6h16M4 12h16M4 18h16",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  bell: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  chevronDown: "M6 9l6 6 6-6",
  logout:
    "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  filter:
    "M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z",
} as const;

export type IconName = keyof typeof ICON_PATHS;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  /** 16 em botão, 20 em item de nav (padrão), 24 em cabeçalho. */
  size?: number;
  /** 1.75 na navegação, 2 dentro de botão. */
  strokeWidth?: number;
}

/**
 * Ícone de traço 24×24, herda `currentColor`. A cor sai da classe do
 * elemento pai — nunca cravada no SVG.
 *
 * Decorativo por padrão (`aria-hidden`). Quando o ícone é o único conteúdo
 * de um botão, passe `aria-label` (ou `aria-labelledby`) — o `aria-hidden`
 * some sozinho, para não rotular e esconder ao mesmo tempo.
 *
 * ```tsx
 * <Icon name="ticket" />                          // 20px, stroke 1.75 — nav
 * <Icon name="plus" size={16} strokeWidth={2} />  // dentro de botão
 * ```
 *
 * Nomes disponíveis em `ICON_PATHS`. Não misture com emoji nem com glifo de
 * texto (`☰`, `×` em botão): um caractere muda de desenho conforme a fonte
 * instalada e não tem nome para leitor de tela. Falta um ícone? Pegue o
 * equivalente em Lucide (stroke 2, 24×24) — é o que o DataCoreHS já usa.
 */
export function Icon({
  name,
  size = 20,
  strokeWidth = 1.75,
  className,
  ...rest
}: IconProps) {
  const d = ICON_PATHS[name];
  if (!d) return null;

  // Defeito do original: ele crava aria-hidden="true" antes do {...rest}, e
  // quem passa aria-label fica com os dois atributos ao mesmo tempo — o
  // ícone é rotulado e escondido de uma vez, e o leitor de tela ignora o
  // rótulo. Aqui só é decorativo quando ninguém deu rótulo.
  const rotulado = "aria-label" in rest || "aria-labelledby" in rest;

  return (
    <svg
      aria-hidden={rotulado ? undefined : true}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={["shrink-0", className].filter(Boolean).join(" ")}
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}
