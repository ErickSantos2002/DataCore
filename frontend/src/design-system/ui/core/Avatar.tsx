export interface AvatarProps {
  /** Nome completo — gera iniciais e cor determinística. */
  name: string;
  /** URL da foto. Presente, ignora iniciais. */
  src?: string;
  size?: "xs" | "sm" | "md" | "lg";
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

// Cor determinística: soma dos charCodes do nome, módulo 6, nesta rampa de
// [fundo, texto]. O original usa os pares --color-{cor}-50/700 direto do
// CSS; aqui só --color-primary-100/700 têm classe Tailwind mapeada (é a
// única rampa completa do config). Para info/warning/danger/success não há
// classe -50/-700, então a mesma dupla [fundo tênue, texto de significado]
// do Badge (`bg-tint-*` / `text-on-tint-*`) faz o papel equivalente.
const PALETAS = [
  "bg-primary-100 text-primary-700",
  "bg-tint-info text-on-tint-info",
  "bg-tint-warning text-on-tint-warning",
  "bg-tint-danger text-on-tint-danger",
  "bg-tint-success text-on-tint-success",
  "bg-surface-elevated text-conteudo-muted",
] as const;

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

function corDeterministica(nome: string): string {
  const soma = Array.from(nome).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PALETAS[soma % PALETAS.length];
}

/**
 * Avatar de pessoa. A cor é derivada do nome, então o mesmo usuário fica
 * sempre da mesma cor em todas as telas. Sem foto, mostra até duas iniciais.
 *
 * ```tsx
 * <Avatar name="Erick Santos" size="sm" />
 * <Avatar name="Erick Santos" src={usuario.foto} />
 * ```
 *
 * Tamanhos: `xs` 24px (linha de tabela), `sm` 32px (lista), `md` 40px
 * (padrão), `lg` 48px (perfil).
 */
export function Avatar({ name, src, size = "md" }: AvatarProps) {
  const base = "inline-flex shrink-0 items-center justify-center rounded-full font-semibold";

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={[base, SIZE_CLASSES[size], "object-cover"].join(" ")}
      />
    );
  }

  return (
    <span className={[base, SIZE_CLASSES[size], corDeterministica(name)].join(" ")}>
      {iniciais(name)}
    </span>
  );
}
