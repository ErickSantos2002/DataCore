import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const config = require("../../tailwind.config.js");
const cores = config.theme.extend.colors;

describe("classes de token", () => {
  it("acao, superficie, borda e conteudo saem de custom property", () => {
    expect(cores.action.DEFAULT).toBe("var(--action)");
    expect(cores.surface.DEFAULT).toBe("var(--surface)");
    expect(cores.surface.base).toBe("var(--bg-base)");
    expect(cores.borda.DEFAULT).toBe("var(--border-color)");
    expect(cores.conteudo.DEFAULT).toBe("var(--text-body)");
  });

  it("a rampa primaria sai de custom property", () => {
    expect(cores.primary[600]).toBe("var(--color-primary-600)");
  });
});

describe("ponte de paleta, deletada em 16/09/2026", () => {
  // Enquanto existiu, `blue` (dez degraus) e `slate` (700/800/900) eram
  // redefinidos em hexadecimal, e este bloco travava os valores. Com a Fase 3
  // concluida e os ultimos consumidores em classe de token, a ponte saiu — e o
  // que se trava agora e a AUSENCIA dela: enquanto `blue` estiver remapeado, o
  // guarda de cor nao acusa `bg-blue-600`, porque ele deriva a ponte daqui.
  it("blue e slate voltaram a ser a paleta crua do Tailwind", () => {
    expect(cores.blue).toBeUndefined();
    expect(cores.slate).toBeUndefined();
  });

  it("o login continua com o hexadecimal proprio, que nao era ponte", () => {
    // Excecao documentada: o painel e escuro nos dois temas, e #0a192f nao
    // existe em nenhum var() de colors.css.
    expect(cores.login).toBe("#0a192f");
  });
});

describe("fonte e raio", () => {
  it("saem de custom property", () => {
    expect(config.theme.extend.fontFamily.sans).toContain("var(--font-sans)");
    expect(config.theme.extend.borderRadius.lg).toBe("var(--radius-lg)");
  });
});

describe("tokens que os primitivos consomem", () => {
  it("foco, cortina e sombra saem de token", () => {
    expect(cores.focus).toBe("var(--focus-ring)");
    expect(cores.overlay).toBe("var(--overlay)");
    expect(config.theme.extend.boxShadow.xl).toBe("var(--shadow-xl)");
  });

  it("o balao de tooltip e escuro nos dois temas, de proposito", () => {
    expect(cores.tooltip.DEFAULT).toBe("var(--color-slate-900)");
    expect(cores.tooltip.fg).toBe("var(--color-white)");
  });

  it("o painel de login e escuro nos dois temas, de proposito", () => {
    // Excecao documentada do design system (Task 14): a tela de login
    // aparece antes de qualquer preferencia de tema ser aplicada, entao nao
    // pode reagir a ela. Hex literal, nao var(): o valor nao existe em
    // colors.css (nao e o mesmo tom de --bg-base nem --color-slate-900), e
    // colors.css nao e editado na Fase 1.
    expect(cores.login).toBe("#0a192f");
  });

  it("o toast tem token proprio de fundo, texto e borda", () => {
    expect(cores.toast.DEFAULT).toBe("var(--toast-bg)");
    expect(cores.toast.fg).toBe("var(--toast-color)");
    expect(cores.toast.border).toBe("var(--toast-border)");
  });

  it("as tintas semanticas e seus pares de texto existem", () => {
    for (const nome of [
      "primary",
      "success",
      "danger",
      "warning",
      "info",
      "neutral",
    ]) {
      expect(cores.tint[nome]).toBe(`var(--tint-${nome})`);
      expect(cores["on-tint"][nome]).toBe(`var(--on-tint-${nome})`);
    }
  });

  it("as medidas da casca saem de token", () => {
    expect(config.theme.extend.width.sidebar).toBe("var(--sidebar-width)");
    expect(config.theme.extend.width["sidebar-collapsed"]).toBe(
      "var(--sidebar-width-collapsed)",
    );
    expect(config.theme.extend.height.topbar).toBe("var(--topbar-height)");
  });

  it("os raios de badge e chip existem", () => {
    expect(config.theme.extend.borderRadius.sm).toBe("var(--radius-sm)");
    expect(config.theme.extend.borderRadius.md).toBe("var(--radius-md)");
    expect(config.theme.extend.borderRadius.full).toBe("var(--radius-full)");
  });
});

describe("escala de sobreposicao", () => {
  it("a escala de sobreposicao poe o tooltip acima do modal", () => {
    const z = config.theme.extend.zIndex;
    expect(Number(z.dropdown)).toBeLessThan(Number(z.overlay));
    expect(Number(z.overlay)).toBeLessThan(Number(z.tooltip));
    expect(Number(z.tooltip)).toBeLessThan(Number(z.toast));
  });
});

describe("o pulso do botao da Central HS", () => {
  const animacao: string = config.theme.extend.animation["hs-pulso"];

  it("roda tres vezes e para, e nao em laco", () => {
    expect(animacao).toMatch(/\b3\b/);
    expect(animacao).not.toMatch(/infinite/);
  });

  it("fica no ultimo quadro, que e invisivel", () => {
    // Sem `forwards`, ao fim da terceira volta o anel voltaria ao estilo base.
    expect(animacao).toMatch(/\bforwards\b/);
    const quadros = config.theme.extend.keyframes["hs-pulso"];
    expect(quadros["75%, 100%"].opacity).toBe("0");
  });
});
