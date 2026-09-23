import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guarda de repositório do `useTemaDoGrafico`.
 *
 * Cor lida de token em JavaScript (`chartTheme`, `corDaSerie`, `corDoAno`,
 * `corDaFaixa`) é resolvida no render. Componente que pinta com ela e não
 * assina a troca de tema fica com a cor do tema anterior até recarregar — foi o
 * defeito da conferência de 15/09, em toda tela com gráfico ao mesmo tempo.
 * Nenhum teste de tela o via: o jsdom não carrega os tokens e todo gráfico cai
 * na reserva, nos dois temas.
 *
 * Duas portas fechadas:
 *   1. componente que usa um dos leitores sem chamar `useTemaDoGrafico`;
 *   2. leitor NOVO de custom property fora da lista — que escaparia da porta 1
 *      por não ter o nome dela.
 */

const arquivosDeCodigo = readdirSync("src", {
  recursive: true,
  encoding: "utf8",
})
  .filter((c) => /\.tsx?$/.test(c) && !/\.test\.tsx?$/.test(c))
  .map((c) => `src/${c}`);

/** Os arquivos que leem custom property em tempo de execução. */
const LEITORES_DE_TOKEN = [
  "src/design-system/chartTheme.ts",
  "src/pages/financeiro/coresDaMeta.ts",
  "src/pages/financeiro/coresDoAno.ts",
];

/** O que cada leitor exporta para pintar. */
const USO_DE_COR_DE_TOKEN =
  /\bchartTheme\.|\bcorDaSerie\(|\bcorDoAno\(|\bcorDaFaixa\(/;

/** O código do arquivo sem as linhas de comentário — citar `chartTheme` num
 *  docblock para explicar uma decisão não é usar. */
function codigoDe(caminho: string): string[] {
  return readFileSync(caminho, "utf8")
    .split("\n")
    .filter((linha) => {
      const t = linha.trim();
      return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
    });
}

describe("guarda do useTemaDoGrafico", () => {
  it("todo componente que pinta com cor de token assina a troca de tema", () => {
    const infratores = arquivosDeCodigo
      .filter((c) => c.endsWith(".tsx"))
      .filter((c) => {
        const codigo = codigoDe(c);
        const usa = codigo.some((l) => USO_DE_COR_DE_TOKEN.test(l));
        const assina = codigo.some((l) => /\buseTemaDoGrafico\(\)/.test(l));
        return usa && !assina;
      });

    expect(infratores).toEqual([]);
  });

  it("so os leitores conhecidos leem custom property em tempo de execucao", () => {
    const leitores = arquivosDeCodigo.filter((c) =>
      codigoDe(c).some((l) => /getPropertyValue\(/.test(l)),
    );

    expect(leitores.sort()).toEqual(LEITORES_DE_TOKEN);
  });
});
