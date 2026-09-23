import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FilterBar } from "./FilterBar";

describe("FilterBar", () => {
  it("remove um filtro pelo x e avisa com o filtro certo", async () => {
    const aoRemover = vi.fn();
    render(
      <FilterBar
        appliedFilters={[
          { key: "cliente", label: "Cliente: INTERCEMENT" },
          { key: "periodo", label: "Período: Este mês" },
        ]}
        onRemoveFilter={aoRemover}
      >
        <div>campo</div>
      </FilterBar>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Remover filtro Cliente: INTERCEMENT" }),
    );
    expect(aoRemover).toHaveBeenCalledTimes(1);
    expect(aoRemover).toHaveBeenCalledWith("cliente");
  });

  it("limpar filtros avisa", async () => {
    const aoLimpar = vi.fn();
    render(
      <FilterBar
        appliedFilters={[{ key: "cliente", label: "Cliente: INTERCEMENT" }]}
        onClearFilters={aoLimpar}
      >
        <div>campo</div>
      </FilterBar>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(aoLimpar).toHaveBeenCalledTimes(1);
  });

  it("escolher uma visao avisa com a visao certa", async () => {
    const aoEscolher = vi.fn();
    render(
      <FilterBar
        views={[
          { key: "minha-visao", label: "Minha visão" },
          { key: "vencidas", label: "Vencidas" },
        ]}
        onSelectView={aoEscolher}
      >
        <div>campo</div>
      </FilterBar>,
    );
    await userEvent.click(screen.getByText("Minha visão"));
    expect(aoEscolher).toHaveBeenCalledTimes(1);
    expect(aoEscolher).toHaveBeenCalledWith("minha-visao");
  });

  it("a segunda linha nao renderiza quando nao ha aplicados nem visoes", () => {
    render(
      <FilterBar>
        <div>campo</div>
      </FilterBar>,
    );
    expect(screen.queryByText("Aplicados")).not.toBeInTheDocument();
    expect(screen.queryByText("Visões")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
  });

  it("mostra so o bloco de aplicados quando nao ha visoes", () => {
    render(
      <FilterBar appliedFilters={[{ key: "cliente", label: "Cliente: INTERCEMENT" }]}>
        <div>campo</div>
      </FilterBar>,
    );
    expect(screen.getByText("Aplicados")).toBeInTheDocument();
    expect(screen.queryByText("Visões")).not.toBeInTheDocument();
  });

  it("mostra so o bloco de visoes quando nao ha aplicados", () => {
    render(
      <FilterBar views={[{ key: "vencidas", label: "Vencidas" }]}>
        <div>campo</div>
      </FilterBar>,
    );
    expect(screen.getByText("Visões")).toBeInTheDocument();
    expect(screen.queryByText("Aplicados")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
  });

  it("o bloco de acoes so aparece quando ha acoes", () => {
    const { rerender } = render(
      <FilterBar>
        <div>campo</div>
      </FilterBar>,
    );
    expect(screen.queryByText("Exportar")).not.toBeInTheDocument();

    rerender(
      <FilterBar actions={<button type="button">Exportar</button>}>
        <div>campo</div>
      </FilterBar>,
    );
    expect(screen.getByText("Exportar")).toBeInTheDocument();
  });

  it("renderiza os campos passados como children", () => {
    render(
      <FilterBar>
        <label>Campo de teste</label>
      </FilterBar>,
    );
    expect(screen.getByText("Campo de teste")).toBeInTheDocument();
  });

  it("sem onSalvarVisao, o botao de salvar visao nao aparece", () => {
    render(
      <FilterBar views={[{ key: "vencidas", label: "Vencidas" }]}>
        <div>campo</div>
      </FilterBar>,
    );
    expect(screen.queryByRole("button", { name: "+ Salvar visão" })).not.toBeInTheDocument();
  });

  it("com onSalvarVisao, o botao de salvar visao aparece e avisa ao clicar", async () => {
    const aoSalvar = vi.fn();
    render(
      <FilterBar
        views={[{ key: "vencidas", label: "Vencidas" }]}
        onSalvarVisao={aoSalvar}
      >
        <div>campo</div>
      </FilterBar>,
    );
    await userEvent.click(screen.getByRole("button", { name: "+ Salvar visão" }));
    expect(aoSalvar).toHaveBeenCalledTimes(1);
  });

  it("a segunda linha aparece so com a acao de salvar visao, sem aplicados nem visoes", () => {
    render(
      <FilterBar onSalvarVisao={() => {}}>
        <div>campo</div>
      </FilterBar>,
    );
    expect(screen.getByRole("button", { name: "+ Salvar visão" })).toBeInTheDocument();
    expect(screen.queryByText("Aplicados")).not.toBeInTheDocument();
  });
});
