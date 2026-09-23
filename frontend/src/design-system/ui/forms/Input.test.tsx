import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { Input } from "./Input";

describe("Input", () => {
  it("liga o rotulo ao campo", () => {
    render(<Input label="CNPJ" />);
    expect(screen.getByLabelText("CNPJ")).toBeInTheDocument();
  });

  it("aceita digitacao", async () => {
    render(<Input label="CNPJ" />);
    await userEvent.type(screen.getByLabelText("CNPJ"), "123");
    expect(screen.getByLabelText("CNPJ")).toHaveValue("123");
  });

  it("expoe o campo por ref, para foco em erro de formulario", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input label="CNPJ" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("anuncia o erro junto do campo", () => {
    render(<Input label="CNPJ" error="CNPJ já cadastrado." />);
    expect(screen.getByText("CNPJ já cadastrado.")).toBeInTheDocument();
    expect(screen.getByLabelText("CNPJ")).toHaveAttribute("aria-invalid", "true");
  });
});
