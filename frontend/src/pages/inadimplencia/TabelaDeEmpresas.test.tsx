import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TabelaDeEmpresas } from "./TabelaDeEmpresas";

describe("TabelaDeEmpresas — abrir pelo teclado", () => {
  const empresa = {
    empresa: "11111111", nome: "Alfa Ltda", documento: "11.111.111/0001-11", filiais: 1,
    titulos: 1, valor_devido: 100, valor_inadimplente: 100, maior_atraso: 40,
    status: "sem_contato" as const, proxima_data: null, ultimo_contato: null,
  };
  function montar(onAbrir = vi.fn()) {
    render(
      <TabelaDeEmpresas empresas={[empresa]} total={1} pagina={1} onPagina={vi.fn()} pesquisa=""
        onPesquisar={vi.fn()} ordenacao={{ campo: "valor", direcao: "desc" }} onOrdenar={vi.fn()}
        onExportar={vi.fn()} onAbrir={onAbrir} hoje={new Date(2026, 9, 9)} />,
    );
    return onAbrir;
  }

  it("o nome da empresa é um botão que abre uma vez só", () => {
    const onAbrir = montar();
    fireEvent.click(screen.getByRole("button", { name: "Alfa Ltda" }));
    expect(onAbrir).toHaveBeenCalledTimes(1);
    expect(onAbrir).toHaveBeenCalledWith("11111111");
  });

  it("clicar na linha continua abrindo", () => {
    const onAbrir = montar();
    fireEvent.click(screen.getByText("11.111.111/0001-11"));
    expect(onAbrir).toHaveBeenCalledTimes(1);
  });
});
