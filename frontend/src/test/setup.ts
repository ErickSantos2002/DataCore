import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// vitest.config.ts não liga `test.globals`, então o afterEach automático do
// @testing-library/react (que só se registra se `afterEach` já for global)
// nunca dispara. Sem isto, um arquivo de teste com mais de um `render()` em
// `it`s diferentes acumula botão sobre botão no mesmo `document.body` e
// `getByRole` passa a achar mais de um elemento a partir do segundo teste.
afterEach(() => {
  cleanup();
});
