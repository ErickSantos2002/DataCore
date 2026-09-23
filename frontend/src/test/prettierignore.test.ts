import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe(".prettierignore", () => {
  // src/design-system/ORIGEM.md e explicito: os arquivos de token sao copia
  // fiel do design system publicado, e "reformatar faria o proximo sync
  // divergir por espaco em branco". Essa regra so existe de verdade se a
  // pasta estiver fora do alcance do `prettier --write .` — e a linha
  // abaixo e a unica trava mecanica disso. Hoje ninguem confere que ela
  // esta la.
  it("mantem src/design-system fora do alcance do prettier --write", () => {
    const conteudo = readFileSync(".prettierignore", "utf8");
    const linhas = conteudo.split("\n").map((linha) => linha.trim());
    expect(linhas).toContain("src/design-system");
  });

  /**
   * A lista é FECHADA desde 16/09/2026.
   *
   * Ela nasceu na Fase 0 com `src/pages`, `src/components`, `src/context`,
   * `src/services`, `src/hooks`, `docs` e o `index.html` — formatar uma tela
   * antes de migrá-la afogaria o diff da migração em espaço em branco. Cada
   * entrada saiu quando a tela correspondente migrou, e o resto saiu junto
   * com a Fase 3. A dívida levou treze telas para ser paga; voltar a crescer
   * é fácil, porque acrescentar uma linha aqui é o caminho mais curto quando
   * o `format` toca num arquivo que alguém não queria ver mexido.
   *
   * Por isso o teste afirma o conjunto INTEIRO, e não só a presença do
   * design-system: entrada nova faz falhar, e quem quiser acrescentar tem de
   * dizer aqui por quê.
   */
  it("nao ignora nada alem do design-system e dos arquivos da outra frente", () => {
    const conteudo = readFileSync(".prettierignore", "utf8");
    const entradas = conteudo
      .split("\n")
      .map((linha) => linha.trim())
      .filter((linha) => linha !== "" && !linha.startsWith("#"));

    expect(entradas).toEqual([
      // Gerados ou de terceiros.
      "dist",
      "node_modules",
      "package-lock.json",
      // A isenção permanente: cópia verbatim, ver ORIGEM.md.
      "src/design-system",
      // Da outra frente de trabalho — formatar arquivo de outra sessão vira
      // colisão de diff sem ninguém ter mudado lógica.
      "src/pages/comercial/useComercial.ts",
      "src/pages/comercial/hooksFalsos.ts",
      "src/pages/servicos/useServicos.ts",
      "src/pages/servicos/hooksFalsos.ts",
    ]);
  });
});
