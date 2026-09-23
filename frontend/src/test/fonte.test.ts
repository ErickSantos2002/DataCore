import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Plus Jakarta Sans", () => {
  it("index.html carrega a fonte do Google Fonts com os pesos 300 a 800", () => {
    const html = readFileSync("index.html", "utf8");
    expect(html).toContain("fonts.googleapis.com");
    expect(html).toContain("Plus+Jakarta+Sans");
    expect(html).toContain("wght@300;400;500;600;700;800");
  });

  it("index.html faz preconnect nos dois hosts do Google Fonts", () => {
    const html = readFileSync("index.html", "utf8");
    expect(html).toContain(
      'rel="preconnect" href="https://fonts.googleapis.com"',
    );
    expect(html).toContain('rel="preconnect" href="https://fonts.gstatic.com"');
  });

  it("o token --font-sans nomeia a fonte", () => {
    const css = readFileSync("src/design-system/tokens/typography.css", "utf8");
    expect(css).toContain("Plus Jakarta Sans");
  });
});
