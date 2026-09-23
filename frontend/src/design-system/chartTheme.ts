import { useSyncExternalStore } from "react";

/** Tema unico de grafico, derivado dos tokens do design system.
 *
 * O recharts recebe cor por prop, nao por classe, e prop nao enxerga classe do
 * Tailwind. Por isso este modulo resolve a custom property em tempo de
 * execucao: o valor muda quando a classe `dark` entra no <html>, e o grafico
 * precisa acompanhar.
 *
 * Nove telas usam recharts. Sem este arquivo, cada uma escolhe a propria cor -
 * que e como os oito sistemas da H&S chegaram a quatro azuis diferentes.
 */

/** Le a custom property do documento, com reserva. A reserva importa: em jsdom
 *  o CSS dos tokens nao carrega e getPropertyValue devolve string vazia, e o
 *  recharts com cor vazia simplesmente nao pinta. */
function token(nome: string, reserva: string): string {
  if (typeof document === "undefined") return reserva;
  const valor = getComputedStyle(document.documentElement)
    .getPropertyValue(nome)
    .trim();
  return valor || reserva;
}

export const chartTheme = {
  get axis() {
    return { stroke: token("--text-muted", "#64748b"), fontSize: 12 };
  },
  get grid() {
    return { stroke: token("--border-color", "#e2e8f0") };
  },
  get tooltip() {
    return {
      backgroundColor: token("--surface", "#ffffff"),
      border: `1px solid ${token("--border-color", "#e2e8f0")}`,
      borderRadius: token("--radius-lg", "0.5rem"),
      color: token("--text-body", "#1e293b"),
    };
  },
  get series() {
    return [
      token("--color-primary-500", "#1f89ca"),
      token("--color-success-500", "#10b981"),
      token("--color-warning-500", "#f59e0b"),
      token("--color-info-500", "#3b82f6"),
      token("--color-danger-500", "#ef4444"),
      token("--color-primary-300", "#7bc0ea"),
    ];
  },
};

/** Avisa quando o atributo `class` do <html> muda — é onde a `dark` entra. */
function assinarClasseDoDocumento(aoMudar: () => void): () => void {
  const observador = new MutationObserver(aoMudar);
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observador.disconnect();
}

function temaDoDocumento(): boolean {
  return document.documentElement.classList.contains("dark");
}

/**
 * O `chartTheme`, com a garantia de que o componente renderiza de novo quando
 * o tema troca. **Todo componente que pinta com `chartTheme`, `corDaSerie` ou
 * outra cor lida de token em JavaScript chama este hook** — há guarda.
 *
 * Os getters acima leem a custom property no render, e nada fazia o gráfico
 * renderizar de novo na troca: grade e eixo ficavam com a cor do tema anterior
 * até recarregar (conferido no navegador em 15/09 — no claro, a grade seguia
 * `#1e3a5f`, o azul-marinho do escuro).
 *
 * Ouvir o `darkMode` do `ThemeContext` não resolve, e isso foi testado: o
 * provider põe a classe `dark` no <html> num `useEffect`, depois do render, e o
 * gráfico re-renderizado pelo contexto ainda lê o token sem a classe. Por isso
 * a assinatura é na própria classe, que só muda quando o token já mudou.
 */
export function useTemaDoGrafico(): typeof chartTheme {
  useSyncExternalStore(assinarClasseDoDocumento, temaDoDocumento);
  return chartTheme;
}

/** Cor da serie N. A setima volta ao comeco em vez de sumir. */
export function corDaSerie(indice: number): string {
  const rampa = chartTheme.series;
  return rampa[indice % rampa.length];
}
