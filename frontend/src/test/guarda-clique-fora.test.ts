import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guarda de repositório do clique fora.
 *
 * O item 6 da Fase 4 achou TRÊS implementações de "fecha quando clica fora",
 * e nenhuma inteira: só o `Estoque` escutava `touchstart` (sem ele, tocar
 * fora não fechava o dropdown em sete telas), e só o `SearchSelect`
 * desmontava o listener com o painel fechado. As três entraram pela mesma
 * porta — alguém copiou uma tela que já tinha uma — e é essa porta que este
 * guarda fecha.
 */

const arquivosDeCodigo = readdirSync("src", {
  recursive: true,
  encoding: "utf8",
})
  .filter(
    (c) =>
      /\.tsx?$/.test(c) && !c.endsWith(".test.tsx") && !c.endsWith(".test.ts"),
  )
  .map((c) => `src/${c}`);

/** O único arquivo que pode registrar clique/toque no documento. */
const DONO = "src/hooks/useCliqueFora.ts";

/** Linha que só CITA o evento em comentário não é infração — vários arquivos
 *  explicam o defeito justamente para dizer o que deixaram de ter, e acusar
 *  o comentário faria alguém apagá-lo para o teste passar. */
function registrosEm(caminho: string): string[] {
  const achados: string[] = [];
  readFileSync(caminho, "utf8")
    .split("\n")
    .forEach((linha, i) => {
      const semEspaco = linha.trim();
      const eComentario =
        semEspaco.startsWith("//") ||
        semEspaco.startsWith("*") ||
        semEspaco.startsWith("/*");
      if (eComentario) return;
      if (/addEventListener\(\s*["'](mousedown|touchstart)["']/.test(linha)) {
        achados.push(`${i + 1}: ${semEspaco}`);
      }
    });
  return achados;
}

describe("guarda do clique fora", () => {
  it("so o useCliqueFora registra mousedown ou touchstart no documento", () => {
    const infratores: string[] = [];
    for (const caminho of arquivosDeCodigo) {
      if (caminho === DONO) continue;
      for (const achado of registrosEm(caminho)) {
        infratores.push(`${caminho}: ${achado}`);
      }
    }
    expect(infratores).toEqual([]);
  });

  it("o dono registra os DOIS eventos — o touchstart e o defeito que o item corrigiu", () => {
    // Usa registrosEm (não toContain sobre o texto cru): comentar a linha do
    // touchstart — debug, merge malfeito, "reviso depois" — é forma comum de
    // desligá-la, e a linha comentada ainda contém o texto
    // `addEventListener("touchstart"` para um toContain, que passaria verde
    // com o defeito de volta. registrosEm já ignora comentário; é a mesma
    // função que o primeiro teste usa, então este reaproveita o tratamento.
    const registros = registrosEm(DONO);
    expect(registros.some((r) => /"mousedown"/.test(r))).toBe(true);
    expect(registros.some((r) => /"touchstart"/.test(r))).toBe(true);
  });
});
