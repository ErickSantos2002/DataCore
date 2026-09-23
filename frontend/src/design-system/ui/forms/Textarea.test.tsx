import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { Textarea } from "./Textarea";

describe("Textarea", () => {
  it("liga o rotulo ao campo", () => {
    render(<Textarea label="Observações" />);
    expect(screen.getByLabelText("Observações")).toBeInTheDocument();
  });

  it("expoe o campo por ref", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea label="Observações" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });
});
