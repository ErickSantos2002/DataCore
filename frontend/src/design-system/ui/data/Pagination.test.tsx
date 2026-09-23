import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("conta em frase, nao em fracao", () => {
    render(
      <Pagination page={1} pageSize={10} total={84} itemLabel="notas" onPageChange={() => {}} />,
    );
    expect(screen.getByText(/Mostrando 1 a 10 de 84 notas/)).toBeInTheDocument();
  });

  it("nao deixa voltar da primeira pagina", async () => {
    const aoMudar = vi.fn();
    render(
      <Pagination page={1} pageSize={10} total={84} itemLabel="notas" onPageChange={aoMudar} />,
    );
    // Nome exato: com o bloco compacto os dois blocos existem em jsdom, e a
    // regex antiga (/anterior/i) também batia no aria-label "Página
    // anterior" do botao compacto — ambiguo. "Anterior" exato acha só o
    // bloco completo, como o docblock do componente descreve.
    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(aoMudar).not.toHaveBeenCalled();
  });

  it("avanca de pagina", async () => {
    const aoMudar = vi.fn();
    render(
      <Pagination page={1} pageSize={10} total={84} itemLabel="notas" onPageChange={aoMudar} />,
    );
    // Mesma razao do teste acima: nome exato evita bater tambem no
    // aria-label "Próxima página" do botao compacto.
    await userEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(aoMudar).toHaveBeenCalledWith(2);
  });

  it("na ultima pagina a contagem nao passa do total", () => {
    render(
      <Pagination page={9} pageSize={10} total={84} itemLabel="notas" onPageChange={() => {}} />,
    );
    expect(screen.getByText(/Mostrando 81 a 84 de 84 notas/)).toBeInTheDocument();
  });

  it("usa 'registros' como substantivo padrao quando itemLabel nao e passado", () => {
    render(<Pagination page={1} pageSize={10} total={84} onPageChange={() => {}} />);
    expect(screen.getByText(/Mostrando 1 a 10 de 84 registros/)).toBeInTheDocument();
  });

  it("com total zero nao renderiza nada — paginar o nada nao significa coisa alguma", () => {
    const { container } = render(
      <Pagination page={1} pageSize={10} total={0} onPageChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("com total zero nao sobra nem botao de pagina nem frase de vazio", () => {
    // O vazio e assunto da tabela acima (`TableEmpty`). Aqui sobravam uma
    // segunda frase, dois botoes desabilitados e um botao de pagina "1".
    render(<Pagination page={1} pageSize={10} total={0} onPageChange={() => {}} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhum resultado encontrado.")).not.toBeInTheDocument();
  });

  it("com um registro so continua paginando — o corte e no zero, nao no pouco", () => {
    render(<Pagination page={1} pageSize={10} total={1} itemLabel="notas" onPageChange={() => {}} />);
    expect(screen.getByText(/Mostrando 1 a 1 de 1 notas/)).toBeInTheDocument();
  });

  /**
   * A forma compacta de celular.
   *
   * Em jsdom não há media query: `hidden md:flex` e `flex md:hidden` são só
   * classes, e os DOIS blocos existem na árvore. Por isso estes testes acham
   * os botões compactos pelo `aria-label`, e os do bloco completo pelo texto
   * "Anterior"/"Próxima" — misturar os dois é o erro fácil aqui.
   */
  it("mostra a pagina atual entre dois botoes compactos", () => {
    render(
      <Pagination page={3} pageSize={10} total={84} onPageChange={() => {}} />,
    );

    expect(screen.getByRole("button", { name: "Página anterior" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeInTheDocument();
    expect(screen.getByTestId("pagina-atual-compacta")).toHaveTextContent("3");
  });

  it("os botoes compactos andam de pagina", () => {
    const aoTrocar = vi.fn();
    render(
      <Pagination page={3} pageSize={10} total={84} onPageChange={aoTrocar} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(aoTrocar).toHaveBeenCalledWith(4);

    fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));
    expect(aoTrocar).toHaveBeenCalledWith(2);
  });

  it("os botoes compactos desabilitam nos extremos", () => {
    const { rerender } = render(
      <Pagination page={1} pageSize={10} total={84} onPageChange={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeEnabled();

    rerender(
      <Pagination page={9} pageSize={10} total={84} onPageChange={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
  });

  it("a frase de contagem aparece uma vez so, nao uma por forma", () => {
    // A frase é irmã dos dois blocos, não filha de um deles. Se alguém
    // duplicá-la para "arrumar" o layout do celular, o leitor de tela passa
    // a ouvir a contagem duas vezes.
    render(
      <Pagination page={1} pageSize={10} total={84} onPageChange={() => {}} />,
    );

    expect(screen.getAllByText("Mostrando 1 a 10 de 84 registros")).toHaveLength(1);
  });
});
