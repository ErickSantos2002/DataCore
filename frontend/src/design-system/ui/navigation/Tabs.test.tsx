import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";

// `Tabs` é controlado — `value`/`onChange` são obrigatórios no `.d.ts`, não
// existe `defaultValue`. Este componente de apoio segura o estado.
function Exemplo() {
  const [aba, setAba] = useState("centro");
  return (
    <Tabs value={aba} onChange={setAba}>
      <TabsList>
        <TabsTrigger value="centro">Centro de custo</TabsTrigger>
        <TabsTrigger value="meta">Meta</TabsTrigger>
      </TabsList>
      <TabsContent value="centro">Rateio por centro</TabsContent>
      <TabsContent value="meta">Meta do mês</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("mostra so o painel da aba ativa", () => {
    render(<Exemplo />);
    expect(screen.getByText("Rateio por centro")).toBeVisible();
    expect(screen.queryByText("Meta do mês")).not.toBeInTheDocument();
  });

  it("troca de aba ao clicar", async () => {
    render(<Exemplo />);
    await userEvent.click(screen.getByRole("tab", { name: "Meta" }));
    expect(screen.getByText("Meta do mês")).toBeVisible();
  });

  it("anda entre abas com as setas do teclado", async () => {
    render(<Exemplo />);
    await userEvent.click(screen.getByRole("tab", { name: "Centro de custo" }));
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Meta" })).toHaveAttribute("aria-selected", "true");
  });

  it("volta da primeira para a ultima aba com seta esquerda", async () => {
    render(<Exemplo />);
    await userEvent.click(screen.getByRole("tab", { name: "Centro de custo" }));
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Meta" })).toHaveAttribute("aria-selected", "true");
  });

  it("Home e End vao para a primeira e a ultima aba", async () => {
    render(<Exemplo />);
    await userEvent.click(screen.getByRole("tab", { name: "Meta" }));
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Centro de custo" })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Meta" })).toHaveAttribute("aria-selected", "true");
  });

  it("liga a aba ao painel que ela controla", () => {
    render(<Exemplo />);
    const aba = screen.getByRole("tab", { name: "Centro de custo" });
    const painel = screen.getByRole("tabpanel");
    expect(aba).toHaveAttribute("aria-controls", painel.id);
    expect(painel).toHaveAttribute("aria-labelledby", aba.id);
  });
});
