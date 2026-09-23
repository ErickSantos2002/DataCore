import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const telas = readdirSync("src", { recursive: true, encoding: "utf8" })
  .filter((c) => c.endsWith(".tsx") && !c.endsWith(".test.tsx"))
  .map((c) => `src/${c}`)
  .filter((c) => !c.startsWith("src/design-system/"));

describe("papeis dos tokens de superficie", () => {
  it("darkBlue nao existe mais: era alias depreciado da Fase 0", () => {
    const infratores = telas.filter((c) =>
      /darkBlue/.test(readFileSync(c, "utf8")),
    );
    expect(infratores).toEqual([]);
  });

  it("nenhum card usa bg-surface-base, que e fundo de pagina", () => {
    // --bg-base e fundo de pagina; --surface e card, painel e topbar. A Fase 0
    // inverteu os dois ao mapear por valor de cor em vez de por papel, e a
    // Fase 1 desfez a inversao.
    //
    // O discriminador e o RAIO, nao o padding: o design system usa
    // rounded-xl (--radius-xl, 12px) para SUPERFICIE - card, modal - e
    // rounded-lg (8px) para CONTROLE - botao, campo, item de nav. Uma
    // heuristica por padding acusa o container de pagina, que legitimamente
    // usa bg-surface-base e costuma ter p-6.
    const infratores: string[] = [];
    for (const caminho of telas) {
      const conteudo = readFileSync(caminho, "utf8");
      conteudo.split("\n").forEach((linha, i) => {
        const ehSuperficie = /rounded-xl/.test(linha);
        const ehPagina = /min-h-screen|h-screen/.test(linha);
        if (ehSuperficie && !ehPagina && /bg-surface-base/.test(linha)) {
          infratores.push(`${caminho}:${i + 1}`);
        }
      });
    }
    expect(infratores).toEqual([]);
  });
});
