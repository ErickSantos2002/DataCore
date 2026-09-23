import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ler = (caminho: string) => readFileSync(caminho, "utf8");

describe("tokens do design system", () => {
  it("styles.css importa os seis arquivos de token", () => {
    const css = ler("src/design-system/styles.css");
    for (const arquivo of [
      "colors",
      "typography",
      "spacing",
      "shape",
      "motion",
      "base",
    ]) {
      expect(css).toContain(`tokens/${arquivo}.css`);
    }
  });

  it("a rampa primaria sai do azul do logo", () => {
    const css = ler("src/design-system/tokens/colors.css");
    expect(css).toContain("--color-primary-500: #1f89ca");
    expect(css).toContain("--color-primary-600: #1a71a8");
  });

  it("a acao e o degrau 600 no claro e o 400 no escuro", () => {
    const css = ler("src/design-system/tokens/colors.css");
    expect(css).toContain("--action: var(--color-primary-600)");
    expect(css).toContain("--action: var(--color-primary-400)");
  });

  it("o tema escuro e navy, nao cinza-carvao", () => {
    const css = ler("src/design-system/tokens/colors.css");
    expect(css).toContain("--bg-base: #0d1b2a");
    expect(css).toContain("--surface: #132238");
    expect(css).toContain("--surface-elevated: #1a2f4a");
  });

  it("define a fonte e os raios que o tailwind.config consome", () => {
    const tipografia = ler("src/design-system/tokens/typography.css");
    const forma = ler("src/design-system/tokens/shape.css");
    expect(tipografia).toContain("--font-sans");
    expect(tipografia).toContain("--font-mono");
    expect(forma).toContain("--radius-lg");
    expect(forma).toContain("--radius-xl");
  });

  // Contrato completo. Um sync futuro que renomear um destes nomes (ex.:
  // --border-color virar --border) nao quebra build nenhum: a classe do
  // Tailwind emite var(--border-color), o navegador nao resolve pra nada, a
  // borda some — e nenhum teste acusa. A lista abaixo e o contrato inteiro,
  // nao uma amostra, para que a falha aponte exatamente qual token sumiu.
  it("colors.css define os 27 tokens do contrato", () => {
    const css = ler("src/design-system/tokens/colors.css");
    const tokens = [
      "--color-primary-50",
      "--color-primary-100",
      "--color-primary-200",
      "--color-primary-300",
      "--color-primary-400",
      "--color-primary-500",
      "--color-primary-600",
      "--color-primary-700",
      "--color-primary-800",
      "--color-primary-900",
      "--action",
      "--action-hover",
      "--action-tint",
      "--bg-base",
      "--surface",
      "--surface-elevated",
      "--border-color",
      "--border-muted",
      "--border-strong",
      "--text-body",
      "--text-heading",
      "--text-muted",
      "--text-faint",
      "--color-success-500",
      "--color-danger-500",
      "--color-warning-500",
      "--color-info-500",
    ];
    const faltando = tokens.filter((nome) => !css.includes(`${nome}:`));
    expect(faltando).toEqual([]);
  });

  it("typography.css define os tokens do contrato", () => {
    const css = ler("src/design-system/tokens/typography.css");
    const tokens = ["--font-sans", "--font-mono"];
    const faltando = tokens.filter((nome) => !css.includes(`${nome}:`));
    expect(faltando).toEqual([]);
  });

  it("shape.css define os tokens do contrato", () => {
    const css = ler("src/design-system/tokens/shape.css");
    const tokens = ["--radius-lg", "--radius-xl", "--radius-2xl"];
    const faltando = tokens.filter((nome) => !css.includes(`${nome}:`));
    expect(faltando).toEqual([]);
  });
});
