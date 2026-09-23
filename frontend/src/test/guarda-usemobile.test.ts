import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guarda de repositório do `useIsMobile`.
 *
 * O item 5 da Fase 4 achou QUATRO cópias deste hook e mais uma quinta resposta
 * inline — `const isMobileW = window.innerWidth < 640` dentro do tooltip de
 * `Clientes`, na mesma tela que já tinha o hook no escopo. Foi assim que a
 * quinta nasceu, e é essa porta que este guarda fecha: qualquer leitura de
 * `window.innerWidth` fora do dono é cópia nova, seja hook ou linha solta.
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

/** O único arquivo que pode ler a largura da janela. */
const DONO = "src/hooks/useIsMobile.ts";

/** Linha que só CITA `innerWidth` em comentário não é infração — o próprio
 *  docblock do dono e o desta spec falam do defeito para explicar o que
 *  deixaram de ter. Acusar o comentário faria alguém apagá-lo para o teste
 *  passar, e o repositório perderia a explicação. */
function leiturasEm(caminho: string): string[] {
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
      if (/window\.innerWidth/.test(linha)) {
        achados.push(`${i + 1}: ${semEspaco}`);
      }
    });
  return achados;
}

/** O corpo do dono sem comentario e com o espaco em branco achatado.
 *
 *  A checagem dos dois papeis era por LINHA: exigia que `window.innerWidth` e
 *  a palavra `useState` estivessem na mesma. Em 16/09/2026, quando `src/hooks`
 *  entrou na formatacao, o prettier quebrou as duas linhas em duas cada — o
 *  codigo nao mudou, e o guarda acusou. Sobre o texto achatado, a quebra de
 *  linha deixa de importar e o que se exige continua sendo o mesmo: as duas
 *  leituras, cada uma no seu papel. */
function corpoDoDono(): string {
  return readFileSync(DONO, "utf8")
    .split("\n")
    .filter((linha) => {
      const semEspaco = linha.trim();
      return !(
        semEspaco.startsWith("//") ||
        semEspaco.startsWith("*") ||
        semEspaco.startsWith("/*")
      );
    })
    .join(" ")
    .replace(/\s+/g, " ");
}

describe("guarda do useIsMobile", () => {
  it("so o useIsMobile le window.innerWidth", () => {
    const infratores: string[] = [];
    for (const caminho of arquivosDeCodigo) {
      if (caminho === DONO) continue;
      for (const achado of leiturasEm(caminho)) {
        infratores.push(`${caminho}: ${achado}`);
      }
    }
    expect(infratores).toEqual([]);
  });

  it("o dono le a largura nos DOIS papeis — o inicializador do useState e o listener de resize", () => {
    // Sobre o corpo sem comentário, e não sobre o texto cru: no item 6 a
    // busca de substring no cru deixou passar quem comentasse a linha
    // protegida, e custou um fix round.
    //
    // Um `toBeGreaterThan(0)` sozinho não distingue as duas leituras: trocar
    // o inicializador por `useState(false)` ainda deixa a leitura do
    // listener de pé, e o teste passava verde com a regressão dentro
    // (verificado por experimento). Exige as duas nomeadamente, como o
    // guarda-clique-fora.test.ts exige "mousedown" e "touchstart".
    const corpo = corpoDoDono();
    expect(corpo).toMatch(/useState\(\s*\(\)\s*=>\s*window\.innerWidth/);
    expect(corpo).toMatch(
      /aoRedimensionar\s*=\s*\(\)\s*=>\s*setIsMobile\(\s*window\.innerWidth/,
    );
    // E a varredura por linha continua valendo para o resto do arquivo: o
    // dono lê a largura, e só ele.
    expect(leiturasEm(DONO).length).toBeGreaterThan(0);
  });
});
