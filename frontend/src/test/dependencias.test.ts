import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const todas = { ...pkg.dependencies, ...pkg.devDependencies };

describe("dependencias", () => {
  it("nao carrega pacotes do Tailwind v4 num projeto que constroi com o v3", () => {
    expect(todas["@tailwindcss/vite"]).toBeUndefined();
    expect(todas["@tailwindcss/postcss"]).toBeUndefined();
  });

  it("continua no Tailwind 3", () => {
    expect(todas.tailwindcss).toMatch(/^\^?3\./);
  });
});
