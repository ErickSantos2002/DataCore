import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export interface TooltipProps {
  /** Uma linha, sem ponto final. */
  label: string;
  position?: "top" | "right" | "bottom" | "left";
  /** Um único elemento que aceite `aria-describedby` — o gatilho do tooltip. */
  children?: ReactNode;
}

// Distância do balão até o gatilho, em px — `--space-2` (top/bottom) e
// `--space-3` (right/left), os mesmos valores do `mb-2`/`mt-2`/`ml-3`/`mr-3`
// que o CSS usava antes do portal. Aqui viram número porque a posição é
// calculada, não mais classe Tailwind.
const ESPACAMENTO: Record<NonNullable<TooltipProps["position"]>, number> = {
  top: 8,
  bottom: 8,
  right: 12,
  left: 12,
};

/**
 * Rótulo no hover — para ícone sem texto e para texto cortado. Aparece no
 * `hover` e no `focus`, então cobre teclado; `Esc` fecha o que foi aberto
 * por foco.
 *
 * O balão fica sempre no DOM (opacidade e `pointer-events` é que alternam) e
 * é referenciado por `aria-describedby` no filho — sem isso o texto existe
 * para leitor de tela mas desconectado do controle que ele descreve, o
 * oposto do que `role="tooltip"` promete. Por isso `children` precisa ser um
 * único elemento que aceite props (`React.cloneElement` aplica o
 * `aria-describedby` nele).
 *
 * **Por que portal, e por que isso é `useState` e não `group-hover`:** o
 * balão nasce em `document.body` via `createPortal`, com `position: fixed` e
 * posição calculada a partir do `getBoundingClientRect()` do envolvente —
 * não mais `position: absolute` relativo ao gatilho. Motivo: um `<aside>`
 * com `overflow-hidden` cujo `<nav>` interno usa `overflow-y-auto` recorta
 * qualquer balão `absolute` nascido dentro dele (a sidebar recolhida da
 * Task 12 — CSS força `overflow-x` a virar `auto`/recorte quando
 * `overflow-y` é `auto`, não existe combinação de classe que evite isso).
 * Fora da árvore da sidebar, nenhum `overflow` ancestral alcança o balão.
 *
 * Isso tem um preço: o `group`/`group-hover`/`group-focus-within` do
 * Tailwind depende de parentesco no DOM, e um balão em portal deixou de ser
 * filho do envolvente. Hover por estado de React vira a única forma de ligar
 * os dois — daí a exceção explícita para este arquivo no
 * `guarda-primitivos.test.ts`. `onFocus`/`onBlur` continuam junto com
 * `onMouseEnter`/`onMouseLeave`, então o teclado não regride.
 *
 * A posição é recalculada toda vez que o balão abre (o gatilho pode ter se
 * movido — sidebar recolhendo, página rolando) e, enquanto aberto, a cada
 * `scroll`/`resize` da janela.
 *
 * O balão é escuro nos dois temas, de propósito (`bg-tooltip`/
 * `text-tooltip-fg`): ele flutua acima de qualquer superfície e precisa se
 * destacar tanto sobre card branco quanto sobre navy.
 *
 * ```tsx
 * <Tooltip label="Recolher menu">
 *   <Button variant="ghost" icon={<Icon name="menu" size={16} strokeWidth={2} />} />
 * </Tooltip>
 * ```
 */
export function Tooltip({ label, position = "top", children }: TooltipProps) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const envolventeRef = useRef<HTMLSpanElement>(null);
  const balaoRef = useRef<HTMLSpanElement>(null);

  const posicionar = useCallback(() => {
    const envolvente = envolventeRef.current;
    const balao = balaoRef.current;
    if (!envolvente || !balao) return;

    // O próprio `envolvente` (não o gatilho): quando o pai é um flex column
    // (a lista de itens da sidebar, por exemplo), `align-items: stretch`
    // esticaria o `span` do envolvente para a largura inteira da coluna —
    // o portal tirou o balão de dentro dele, então o único filho real que
    // sobra é o gatilho, e é o retângulo dele que interessa medir.
    const elementoGatilho = (envolvente.firstElementChild as HTMLElement | null) ?? envolvente;
    const rGatilho = elementoGatilho.getBoundingClientRect();
    const rBalao = balao.getBoundingClientRect();
    const espaco = ESPACAMENTO[position];

    let top: number;
    let left: number;
    if (position === "top" || position === "bottom") {
      left = rGatilho.left + rGatilho.width / 2 - rBalao.width / 2;
      top = position === "top" ? rGatilho.top - rBalao.height - espaco : rGatilho.bottom + espaco;
    } else {
      top = rGatilho.top + rGatilho.height / 2 - rBalao.height / 2;
      left = position === "left" ? rGatilho.left - rBalao.width - espaco : rGatilho.right + espaco;
    }

    // Escrito direto no nó (`.style.top =`), não via atributo `style` do
    // JSX: é geometria calculada em tempo de execução (equivalente ao caso
    // já aberto para `width`/`height` no guarda de estilo inline), não
    // aparência — e não há como expressar "meça o balão e centralize no
    // gatilho" em classe Tailwind estática.
    balao.style.top = `${top}px`;
    balao.style.left = `${left}px`;
  }, [position]);

  // Recalcula ao abrir — o gatilho pode ter se movido desde a última vez
  // (sidebar recolheu, página rolou) — e, enquanto aberto, a cada
  // scroll/resize.
  useLayoutEffect(() => {
    if (aberto) posicionar();
  }, [aberto, posicionar]);

  useEffect(() => {
    if (!aberto) return;
    window.addEventListener("scroll", posicionar, true);
    window.addEventListener("resize", posicionar);
    return () => {
      window.removeEventListener("scroll", posicionar, true);
      window.removeEventListener("resize", posicionar);
    };
  }, [aberto, posicionar]);

  // Esc fecha o balão aberto por foco (ou por mouse) — barato e o teclado
  // agradece.
  useEffect(() => {
    if (!aberto) return;
    const aoTeclado = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", aoTeclado);
    return () => window.removeEventListener("keydown", aoTeclado);
  }, [aberto]);

  const gatilho = isValidElement(children)
    ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, {
        "aria-describedby": id,
      })
    : children;

  const mostrar = () => setAberto(true);
  const esconder = () => setAberto(false);

  return (
    <span
      ref={envolventeRef}
      className="relative inline-flex"
      onMouseEnter={mostrar}
      onMouseLeave={esconder}
      onFocus={mostrar}
      onBlur={esconder}
    >
      {gatilho}
      {createPortal(
        <span
          ref={balaoRef}
          role="tooltip"
          id={id}
          className={[
            "pointer-events-none fixed z-tooltip whitespace-nowrap rounded-lg bg-tooltip px-2.5 py-1.5 text-xs font-medium text-tooltip-fg shadow-lg transition-opacity duration-150 ease-in-out",
            aberto ? "opacity-100" : "opacity-0",
          ].join(" ")}
        >
          {label}
        </span>,
        document.body,
      )}
    </span>
  );
}
