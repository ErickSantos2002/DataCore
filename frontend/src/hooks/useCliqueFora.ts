import { useEffect, useRef, type RefObject } from "react";

/**
 * Fecha um painel quando o clique (ou o toque) acontece fora dele.
 *
 * Nasceu do item 6 da Fase 4, que achou TRÊS implementações disto —
 * `MultiSelect`, `SearchSelect` e os dois popovers de `Estoque` — e nenhuma
 * inteira: cada uma acertava o que as outras erravam.
 *
 * **Uma ref por chamada, e não uma lista.** `Estoque` chama duas vezes, uma
 * por popover. Com uma lista, a semântica ficaria ambígua: o alvo dentro de
 * uma ref deveria impedir o fechamento DA OUTRA? Hoje não impede — cada
 * popover é avaliado contra a própria ref —, e uma ref por chamada diz isso
 * sem precisar de `if` duplo.
 *
 * **`aoFechar` guardado em ref.** Os chamadores passam arrow inline
 * (`() => setAberto(false)`), que é função nova a cada render. Se ela
 * entrasse no array de dependências do efeito, o listener seria
 * desregistrado e registrado de novo a cada render — voltando ao
 * desperdício que o array veio evitar. Guardando em `aoFecharRef` o efeito
 * pode depender só de `ativo` e `ref`, que são estáveis entre renders.
 *
 * **`ativo` evita listener parado.** Cinco telas montam três `MultiSelect`
 * cada; como no máximo um painel fica aberto por vez, sem o `if (!ativo)
 * return;` pelo menos dois handlers em cada tela ficavam registrados e
 * rodando `contains` a cada `mousedown` da página sem nenhum painel aberto
 * para fechar. `ativo` é o `aberto` de quem chama.
 */
export function useCliqueFora(
  ref: RefObject<HTMLElement | null>,
  aoFechar: () => void,
  ativo: boolean,
): void {
  const aoFecharRef = useRef(aoFechar);
  useEffect(() => {
    aoFecharRef.current = aoFechar;
  });

  useEffect(() => {
    if (!ativo) return;

    function aoClicarFora(evento: Event) {
      const alvo = evento.target as Node | null;
      if (!alvo) return;
      if (ref.current && !ref.current.contains(alvo)) {
        aoFecharRef.current();
      }
    }

    document.addEventListener("mousedown", aoClicarFora);
    // `touchstart` também: em toque o navegador dispara touchstart → touchend
    // → um `click` sintetizado, e `mousedown` não vem. Sem esta linha, tocar
    // fora não fechava o dropdown em nenhuma das sete telas que usam o
    // `MultiSelect` — o painel ficava por cima do conteúdo até a pessoa tocar
    // no gatilho de novo. `passive: true` porque o handler não chama
    // `preventDefault`, e sem a flag o navegador segura a rolagem esperando
    // para ver se ele chamaria.
    document.addEventListener("touchstart", aoClicarFora, { passive: true });
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("touchstart", aoClicarFora);
    };
  }, [ativo, ref]);
}
