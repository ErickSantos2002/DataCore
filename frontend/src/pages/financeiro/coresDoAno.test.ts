import { describe, expect, it } from "vitest";

import { corDoAno } from "./coresDoAno";
import { ANOS } from "./financeiro";

/**
 * A cor do ano é a ÚNICA pista de qual barra é de qual ano no comparativo
 * mensal — a legenda diz o nome, mas quem lê o gráfico lê a cor. Dois anos
 * com matiz parecido tornam o gráfico ilegível sem que nada quebre, e foi
 * exatamente o que aconteceu quando as cores saíam da rampa de séries do
 * `chartTheme`: ela tem seis cores, das quais três são azuis, e 2022 e 2025
 * caíram em dois azuis de matiz a 14 graus um do outro.
 */

/** `#rrggbb` ou `rgb(r, g, b)` → matiz em graus e saturação em fração. */
function matizESaturacao(cor: string): { matiz: number; saturacao: number } {
  const hex = cor.match(/^#([0-9a-f]{6})$/i);
  const rgb = cor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  let r: number, g: number, b: number;
  if (hex) {
    const inteiro = parseInt(hex[1], 16);
    [r, g, b] = [(inteiro >> 16) & 255, (inteiro >> 8) & 255, inteiro & 255];
  } else if (rgb) {
    [r, g, b] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  } else {
    throw new Error(`cor em formato desconhecido: ${cor}`);
  }
  const [vermelho, verde, azul] = [r / 255, g / 255, b / 255];
  const maior = Math.max(vermelho, verde, azul);
  const menor = Math.min(vermelho, verde, azul);
  const amplitude = maior - menor;
  const luminosidade = (maior + menor) / 2;
  if (amplitude === 0) return { matiz: 0, saturacao: 0 };

  const saturacao = amplitude / (1 - Math.abs(2 * luminosidade - 1));
  let matiz: number;
  if (maior === vermelho) matiz = ((verde - azul) / amplitude) % 6;
  else if (maior === verde) matiz = (azul - vermelho) / amplitude + 2;
  else matiz = (vermelho - verde) / amplitude + 4;
  return { matiz: (((matiz * 60) % 360) + 360) % 360, saturacao };
}

/** A menor distância entre dois matizes, no círculo de 360°. */
function distancia(a: number, b: number): number {
  const bruta = Math.abs(a - b);
  return Math.min(bruta, 360 - bruta);
}

/** Abaixo disso a cor é cinza e não compete por matiz com ninguém. */
const SATURACAO_DE_CINZA = 0.2;

/** Dois matizes mais próximos que isto não se distinguem num gráfico. */
const DISTANCIA_MINIMA = 30;

describe("cor do ano", () => {
  it("cada ano tem a sua cor", () => {
    const cores = ANOS.map(corDoAno);

    expect(new Set(cores).size).toBe(ANOS.length);
  });

  it("nenhum par de anos coloridos fica a menos de 30° de matiz", () => {
    const coloridos = ANOS.map((ano) => ({
      ano,
      ...matizESaturacao(corDoAno(ano)),
    })).filter((cor) => cor.saturacao >= SATURACAO_DE_CINZA);

    const perto: string[] = [];
    for (let i = 0; i < coloridos.length; i++) {
      for (let j = i + 1; j < coloridos.length; j++) {
        const dist = distancia(coloridos[i].matiz, coloridos[j].matiz);
        if (dist < DISTANCIA_MINIMA) {
          perto.push(
            `${coloridos[i].ano} e ${coloridos[j].ano}: ${dist.toFixed(0)}°`,
          );
        }
      }
    }

    expect(perto).toEqual([]);
  });

  it("no máximo um ano é cinza — cinza também é uma identidade", () => {
    const cinzas = ANOS.map(corDoAno).filter(
      (cor) => matizESaturacao(cor).saturacao < SATURACAO_DE_CINZA,
    );

    expect(cinzas.length).toBeLessThanOrEqual(1);
  });
});
