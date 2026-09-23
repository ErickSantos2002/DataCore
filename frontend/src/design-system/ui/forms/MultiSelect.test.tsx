import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MultiSelect } from "./MultiSelect";
import { buscaPorCnpjEntreParenteses, deTextos } from "./buscaDeMultiSelect";

const OPCOES = deTextos([
  "Alfa Mineração (11.222.333/0001-44)",
  "Beta Logística (55.666.777/0001-88)",
]);

describe("MultiSelect", () => {
  it("fechado, mostra o placeholder; com escolha, mostra a contagem", () => {
    const { rerender } = render(
      <MultiSelect rotulo="Produto" opcoes={OPCOES} selecionados={[]} onChange={vi.fn()} placeholder="Todas as empresas" />,
    );
    expect(screen.getByRole("button", { name: "Produto Todas as empresas" })).toBeInTheDocument();

    rerender(
      <MultiSelect rotulo="Produto" opcoes={OPCOES} selecionados={[OPCOES[0].valor]} onChange={vi.fn()} placeholder="Todas as empresas" />,
    );
    expect(screen.getByRole("button", { name: "Produto 1 selecionado(s)" })).toBeInTheDocument();
  });

  it("marcar acrescenta e marcar de novo tira", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <MultiSelect rotulo="Produto" opcoes={OPCOES} selecionados={[]} onChange={onChange} placeholder="Empresas" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Produto Empresas" }));

    fireEvent.click(screen.getByRole("checkbox", { name: /Alfa/ }));
    expect(onChange).toHaveBeenCalledWith([OPCOES[0].valor]);

    // O componente é controlado: marcar não muda o próprio estado, só chama
    // onChange e espera o pai devolver `selecionados` atualizado — por isso
    // o reclique simula o pai reagindo à chamada acima antes de desmarcar.
    rerender(
      <MultiSelect
        rotulo="Produto"
        opcoes={OPCOES}
        selecionados={[OPCOES[0].valor]}
        onChange={onChange}
        placeholder="Empresas"
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /Alfa/ }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("o dropdown NÃO fecha ao marcar — é o que a cópia fazia e ninguém queria", () => {
    // Nas telas o componente era declarado dentro da página, então marcar
    // recriava o componente e o dropdown fechava, apagando a busca. Fora da
    // página, o estado sobrevive.
    const onChange = vi.fn();
    const { rerender } = render(
      <MultiSelect rotulo="Produto" opcoes={OPCOES} selecionados={[]} onChange={onChange} placeholder="Empresas" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Produto Empresas" }));
    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), { target: { value: "alfa" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Alfa/ }));

    rerender(
      <MultiSelect rotulo="Produto" opcoes={OPCOES} selecionados={[OPCOES[0].valor]} onChange={onChange} placeholder="Empresas" />,
    );

    expect(screen.getByPlaceholderText("Pesquisar...")).toHaveValue("alfa");
  });

  it("a estratégia de busca é escolhida por quem usa", () => {
    render(
      <MultiSelect
        rotulo="Produto"
        opcoes={OPCOES}
        selecionados={[]}
        onChange={vi.fn()}
        placeholder="Empresas"
        buscarPor={buscaPorCnpjEntreParenteses}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Produto Empresas" }));

    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), { target: { value: "11222333" } });

    expect(screen.getByRole("checkbox", { name: /Alfa/ })).toBeInTheDocument();
  });

  it("sem resultado, diz que não achou", () => {
    render(<MultiSelect rotulo="Produto" opcoes={OPCOES} selecionados={[]} onChange={vi.fn()} placeholder="Empresas" />);
    fireEvent.click(screen.getByRole("button", { name: "Produto Empresas" }));

    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), { target: { value: "gama" } });

    expect(screen.getByText("Nenhum resultado encontrado")).toBeInTheDocument();
  });

  it("'Limpar seleção' devolve lista vazia", () => {
    const onChange = vi.fn();
    render(
      <MultiSelect rotulo="Produto" opcoes={OPCOES} selecionados={[OPCOES[0].valor]} onChange={onChange} placeholder="Empresas" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Produto 1 selecionado(s)" }));

    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("clicar fora fecha", () => {
    render(<MultiSelect rotulo="Produto" opcoes={OPCOES} selecionados={[]} onChange={vi.fn()} placeholder="Empresas" />);
    fireEvent.click(screen.getByRole("button", { name: "Produto Empresas" }));

    fireEvent.mouseDown(document.body);

    expect(screen.queryByPlaceholderText("Pesquisar...")).not.toBeInTheDocument();
  });

  it("Escape fecha o painel e devolve o foco ao gatilho", () => {
    render(
      <MultiSelect
        rotulo="Produto"
        opcoes={OPCOES}
        selecionados={[]}
        onChange={() => {}}
        placeholder="Todos"
      />,
    );
    const gatilho = screen.getByRole("button", { name: "Produto Todos" });
    fireEvent.click(gatilho);
    expect(screen.getByPlaceholderText("Pesquisar...")).toBeInTheDocument();

    fireEvent.keyDown(gatilho, { key: "Escape" });

    expect(screen.queryByPlaceholderText("Pesquisar...")).toBeNull();
    expect(document.activeElement).toBe(gatilho);
  });

  it("Escape a partir do campo de busca fecha o painel e devolve o foco ao gatilho", () => {
    render(
      <MultiSelect
        rotulo="Produto"
        opcoes={OPCOES}
        selecionados={[]}
        onChange={() => {}}
        placeholder="Todos"
      />,
    );
    const gatilho = screen.getByRole("button", { name: "Produto Todos" });
    fireEvent.click(gatilho);

    fireEvent.keyDown(screen.getByPlaceholderText("Pesquisar..."), { key: "Escape" });

    expect(screen.queryByPlaceholderText("Pesquisar...")).toBeNull();
    expect(document.activeElement).toBe(gatilho);
  });

  it("Escape a partir de um checkbox fecha o painel e devolve o foco ao gatilho", () => {
    render(
      <MultiSelect
        rotulo="Produto"
        opcoes={OPCOES}
        selecionados={[]}
        onChange={() => {}}
        placeholder="Todos"
      />,
    );
    const gatilho = screen.getByRole("button", { name: "Produto Todos" });
    fireEvent.click(gatilho);

    fireEvent.keyDown(screen.getByRole("checkbox", { name: /Alfa/ }), { key: "Escape" });

    expect(screen.queryByPlaceholderText("Pesquisar...")).toBeNull();
    expect(document.activeElement).toBe(gatilho);
  });

  it("o nome acessível do gatilho soma o rótulo e o estado", () => {
    render(
      <MultiSelect
        rotulo="Produto"
        opcoes={OPCOES}
        selecionados={[]}
        onChange={() => {}}
        placeholder="Todos"
      />,
    );
    // O rótulo sozinho SUBSTITUIRIA o estado se fosse `htmlFor`; `aria-labelledby`
    // com os dois ids soma as duas coisas, que é o que interessa a quem usa
    // leitor de tela: "Produto, Todos".
    expect(screen.getByRole("button", { name: "Produto Todos" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Todos" })).toBeNull();
  });

  it("o painel é um grupo rotulado, e não um listbox", () => {
    render(
      <MultiSelect
        rotulo="Produto"
        opcoes={OPCOES}
        selecionados={[]}
        onChange={() => {}}
        placeholder="Todos"
      />,
    );
    const gatilho = screen.getByRole("button", { name: "Produto Todos" });
    fireEvent.click(gatilho);

    // Um botão que abre um painel de checkboxes é disclosure, não listbox.
    // A peça de Contas prometia `aria-haspopup="listbox"` e entregava um <div>
    // com checkboxes dentro; a promessa não é portada.
    expect(gatilho).not.toHaveAttribute("aria-haspopup");
    expect(screen.getByRole("group", { name: "Produto" })).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("o campo de busca diz em que campo se está buscando", () => {
    render(
      <MultiSelect
        rotulo="Produto"
        opcoes={OPCOES}
        selecionados={[]}
        onChange={() => {}}
        placeholder="Todos"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Produto Todos" }));
    expect(screen.getByLabelText("Pesquisar em Produto")).toBeInTheDocument();
  });

  it("tocar fora fecha — no celular, mousedown nao vem", () => {
    render(<MultiSelect rotulo="Produto" opcoes={OPCOES} selecionados={[]} onChange={vi.fn()} placeholder="Empresas" />);
    fireEvent.click(screen.getByRole("button", { name: "Produto Empresas" }));
    expect(screen.getByPlaceholderText("Pesquisar...")).toBeInTheDocument();

    fireEvent.touchStart(document.body);

    expect(screen.queryByPlaceholderText("Pesquisar...")).not.toBeInTheDocument();
  });
});
