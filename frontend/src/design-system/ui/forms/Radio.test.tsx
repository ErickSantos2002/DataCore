import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { RadioGroup } from "./Radio";

// O brief do task-4 traz um teste com <RadioGroup><Radio/></RadioGroup>, passando
// os Radio como children. Mas o .d.ts declara RadioGroupProps.options:
// RadioGroupOption[] — o grupo recebe um array e desenha os Radio internamente,
// nao aceita children. Reescrito abaixo para a API real. Como o RadioGroup e
// controlado (value + onChange), o teste usa um componente de apoio com
// useState para provar que a escolha troca.
function NotaDeTeste() {
  const [valor, setValor] = useState("outbound");
  return (
    <RadioGroup
      name="tipo"
      label="Tipo da nota"
      value={valor}
      onChange={setValor}
      options={[
        { value: "outbound", label: "Outbound" },
        { value: "inbound", label: "Inbound" },
      ]}
    />
  );
}

describe("Radio", () => {
  it("so um da vez fica marcado dentro do grupo", async () => {
    render(<NotaDeTeste />);
    expect(screen.getByRole("radio", { name: "Outbound" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Inbound" }));
    expect(screen.getByRole("radio", { name: "Inbound" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Outbound" })).not.toBeChecked();
  });
});

describe("Radio — a pintura de marcado", () => {
  it("toda classe peer-* mora num irmão do input, onde o Tailwind consegue aplicá-la", () => {
    // `peer-checked:x` vira `.peer:checked ~ .x`: só pega IRMÃO do input. A
    // bolinha do "marcado" morava num neto — o seletor nunca casava, e o rádio
    // marcado aparecia vazio (visto em Configurações, 01/10/2026). O jsdom não
    // calcula CSS, então o teste trava a estrutura que o seletor exige.
    const { container } = render(
      <RadioGroup
        name="t"
        value="a"
        options={[{ value: "a", label: "A" }]}
      />,
    );
    const input = container.querySelector("input")!;
    const comPeer = [...container.querySelectorAll("[class]")].filter((el) =>
      /(^|\s)peer-[a-z-]+:/.test(el.getAttribute("class") ?? ""),
    );

    expect(comPeer.length).toBeGreaterThan(0);
    for (const el of comPeer) {
      expect(el.parentElement).toBe(input.parentElement);
    }
  });
});
