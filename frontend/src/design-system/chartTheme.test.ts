import { describe, expect, it } from "vitest";
import { chartTheme, corDaSerie } from "./chartTheme";

describe("tema de grafico", () => {
  it("entrega eixo, grade e tooltip", () => {
    expect(chartTheme.axis).toBeTruthy();
    expect(chartTheme.grid).toBeTruthy();
    expect(chartTheme.tooltip).toBeTruthy();
  });

  it("a rampa de series tem seis cores distintas", () => {
    const cores = chartTheme.series;
    expect(cores).toHaveLength(6);
    expect(new Set(cores).size).toBe(6);
  });

  it("a setima serie volta ao comeco, em vez de sumir", () => {
    expect(corDaSerie(6)).toBe(corDaSerie(0));
    expect(corDaSerie(7)).toBe(corDaSerie(1));
  });

  it("cai no valor de reserva quando a custom property nao esta declarada", () => {
    // jsdom nao carrega o CSS dos tokens, entao getPropertyValue devolve "".
    // Sem reserva, o recharts receberia string vazia e nao pintaria nada.
    for (const cor of chartTheme.series) {
      expect(cor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
