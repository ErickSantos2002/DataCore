import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./Select";

const OPCOES = [
  { value: "outbound", label: "Outbound" },
  { value: "inbound", label: "Inbound" },
];

describe("Select", () => {
  it("liga o rotulo ao campo", () => {
    render(<Select label="Tipo" options={OPCOES} />);
    expect(screen.getByLabelText("Tipo")).toBeInTheDocument();
  });

  it("escolhe uma opcao e avisa quem chamou", async () => {
    const aoMudar = vi.fn();
    render(<Select label="Tipo" options={OPCOES} onChange={aoMudar} />);
    await userEvent.selectOptions(screen.getByLabelText("Tipo"), "inbound");
    expect(aoMudar).toHaveBeenCalled();
  });

  it("placeholder vira a primeira opcao, vazia", () => {
    render(<Select label="Tipo" options={OPCOES} placeholder="Todos os tipos" />);
    const select = screen.getByLabelText("Tipo") as HTMLSelectElement;
    expect(select.options[0].value).toBe("");
    expect(select.options[0].textContent).toBe("Todos os tipos");
  });
});
