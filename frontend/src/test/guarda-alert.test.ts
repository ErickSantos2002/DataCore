import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const arquivos = readdirSync("src", { recursive: true, encoding: "utf8" })
  .filter(
    (c) =>
      /\.tsx?$/.test(c) && !c.endsWith(".test.tsx") && !c.endsWith(".test.ts"),
  )
  .map((c) => `src/${c}`);

describe("guarda de retorno ao usuario", () => {
  it("nenhuma tela usa alert()/confirm()/prompt() do navegador", () => {
    // alert()/confirm()/prompt() travam a aba, nao sao estilizaveis, nao
    // respeitam o tema e mostram o dominio da aplicacao numa caixa do sistema
    // operacional. O retorno do sistema sai por Toast; confirmacao de acao
    // destrutiva tera componente proprio na Fase 3.
    const infratores: string[] = [];
    for (const caminho of arquivos) {
      const conteudo = readFileSync(caminho, "utf8");
      conteudo.split("\n").forEach((linha, i) => {
        if (
          /(?:^|[^.\w])(?:(?:window|globalThis|self)\.)?(?:alert|confirm|prompt)\s*\(/.test(
            linha,
          )
        ) {
          infratores.push(`${caminho}:${i + 1}`);
        }
      });
    }
    expect(infratores).toEqual([]);
  });
});
