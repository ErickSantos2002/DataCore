import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { chartTheme, useTemaDoGrafico } from "./chartTheme";

/**
 * A troca de tema tem de repintar o gráfico.
 *
 * `chartTheme` lê a custom property no render. Na conferência de 15/09, trocar
 * o tema pelo botão deixava grade e eixo com a cor do tema ANTERIOR até
 * recarregar a página — medido no DOM: claro recarregado dava `#e2e8f0`, e
 * depois de ir para o escuro continuava `#e2e8f0`. Nada fazia o gráfico
 * renderizar de novo.
 *
 * ⚠️ Ouvir `darkMode` do contexto NÃO basta, e este teste existe para provar
 * isso: o `ThemeProvider` põe a classe `dark` no `<html>` num `useEffect`,
 * DEPOIS do render. Um gráfico que só re-renderizasse com o contexto leria o
 * token ainda sem a classe — a cor velha de novo. Por isso o teste passa pelo
 * botão de verdade, e não por uma classe posta à mão antes do render.
 *
 * O jsdom não carrega `colors.css`; a folha abaixo imita as duas declarações
 * de `--border-color` com valores distintos das reservas do `chartTheme`, para
 * que "caiu na reserva" não se confunda com "leu o token".
 */
const CLARO = "#aaaaaa";
const ESCURO = "#bbbbbb";

let folha: HTMLStyleElement;

beforeEach(() => {
  localStorage.setItem("theme", "light");
  folha = document.createElement("style");
  folha.textContent = `:root { --border-color: ${CLARO}; } :root.dark { --border-color: ${ESCURO}; }`;
  document.head.appendChild(folha);
});

afterEach(() => {
  folha.remove();
  document.documentElement.classList.remove("dark");
  localStorage.clear();
});

function Sonda() {
  const tema = useTemaDoGrafico();
  const { toggleDarkMode } = useTheme();
  return (
    <>
      <p data-testid="grade">{tema.grid.stroke}</p>
      <button onClick={toggleDarkMode}>trocar</button>
    </>
  );
}

describe("useTemaDoGrafico", () => {
  it("le o token do tema em que a tela abriu", () => {
    render(
      <ThemeProvider>
        <Sonda />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("grade")).toHaveTextContent(CLARO);
  });

  it("trocar o tema pelo botao repinta com a cor do tema novo, nas duas direcoes", async () => {
    render(
      <ThemeProvider>
        <Sonda />
      </ThemeProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "trocar" }));
    });
    expect(screen.getByTestId("grade")).toHaveTextContent(ESCURO);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "trocar" }));
    });
    expect(screen.getByTestId("grade")).toHaveTextContent(CLARO);
  });

  it("devolve o mesmo chartTheme, para o componente seguir escrevendo tema.grid", () => {
    const { result } = renderHook(() => useTemaDoGrafico());

    expect(result.current).toBe(chartTheme);
  });
});
