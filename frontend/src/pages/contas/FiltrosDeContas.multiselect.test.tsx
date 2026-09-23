import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FiltrosDeContas } from "./FiltrosDeContas";

/**
 * Caracterização dos três MultiSelect da barra de filtros de Contas. Foi
 * escrita contra `MultiSelectDeContas`, a peça que as gêmeas tinham só para
 * si e que nunca teve teste. Ela não existe mais: hoje este arquivo afirma o
 * primitivo `MultiSelect` do design system, que Contas passou a consumir.
 *
 * A peça velha era quem fazia certo o que o primitivo fazia errado: ligava o
 * gatilho ao rótulo e ao valor por `aria-labelledby`, então o nome acessível
 * do botão é "Situação Todas", e não só "Todas". É por isso que os helpers
 * daqui compõem rótulo e valor — e é esse contrato que o primitivo ganhou
 * ANTES da fusão, justamente para que esta caracterização seguisse valendo.
 *
 * Foi o critério de aceitação da fusão, e passou com **uma** edição, prevista
 * e autorizada: o texto do estado vazio, que na peça velha era "Nenhum
 * resultado" e no primitivo é "Nenhum resultado encontrado". É a única
 * divergência aceita entre as duas peças; qualquer outra falha aqui seria
 * regressão, não diferença de cópia.
 */

const OPCOES = {
  situacao: ["Em aberto", "Quitado"],
  categoria: ["Servicos prestados", "Materiais"],
  contraparte: ["Alfa Mineração", "Beta Logística"],
};

const VALORES_VAZIOS = {
  situacao: [],
  categoria: [],
  contraparte: [],
  dataInicio: "",
  dataFim: "",
};

function montar(
  sobrescreve: Partial<Parameters<typeof FiltrosDeContas>[0]> = {},
) {
  const props = {
    rotuloDaContraparte: "Cliente",
    opcoes: OPCOES,
    valores: VALORES_VAZIOS,
    preset: "todos",
    onSituacao: vi.fn(),
    onCategoria: vi.fn(),
    onContraparte: vi.fn(),
    onPreset: vi.fn(),
    onDataInicio: vi.fn(),
    onDataFim: vi.fn(),
    ...sobrescreve,
  };
  render(<FiltrosDeContas {...props} />);
  return props;
}

/** O gatilho daquele filtro. O nome acessível é "<rótulo> <valor>". */
function gatilho(rotulo: string, valor: string) {
  return screen.getByRole("button", { name: `${rotulo} ${valor}` });
}

function abrir(rotulo: string, valor: string) {
  fireEvent.click(gatilho(rotulo, valor));
}

/** O painel daquele filtro — botão e painel são irmãos no mesmo container. */
function painel(rotulo: string, valor: string) {
  return gatilho(rotulo, valor).parentElement as HTMLElement;
}

describe("MultiSelect na barra de filtros de Contas", () => {
  it("o gatilho anuncia o rótulo junto com o estado", () => {
    montar();
    expect(gatilho("Situação", "Todas")).toBeInTheDocument();
    expect(gatilho("Categoria", "Todas")).toBeInTheDocument();
    expect(gatilho("Cliente", "Todos")).toBeInTheDocument();
  });

  it("com seleção, o gatilho troca o placeholder pela contagem", () => {
    montar({ valores: { ...VALORES_VAZIOS, situacao: ["Em aberto"] } });
    expect(gatilho("Situação", "1 selecionado(s)")).toBeInTheDocument();
  });

  it("o rótulo da contraparte muda com a tela", () => {
    montar({ rotuloDaContraparte: "Fornecedor" });
    expect(gatilho("Fornecedor", "Todos")).toBeInTheDocument();
  });

  it("abrir mostra as opções daquele filtro, e só daquele", () => {
    montar();
    // Os dois painéis ficam abertos ao mesmo tempo — `fireEvent.click` não
    // dispara o `mousedown` que fecha por clique fora — para que a asserção
    // de ausência prove isolamento entre painéis, e não apenas que o outro
    // painel está fechado.
    abrir("Situação", "Todas");
    abrir("Categoria", "Todas");
    const situacao = within(painel("Situação", "Todas"));
    const categoria = within(painel("Categoria", "Todas"));
    expect(
      situacao.getByRole("checkbox", { name: "Em aberto" }),
    ).toBeInTheDocument();
    expect(
      situacao.getByRole("checkbox", { name: "Quitado" }),
    ).toBeInTheDocument();
    expect(situacao.queryByRole("checkbox", { name: "Materiais" })).toBeNull();
    expect(
      categoria.getByRole("checkbox", { name: "Materiais" }),
    ).toBeInTheDocument();
  });

  it("a busca filtra a lista daquele filtro", () => {
    montar();
    abrir("Categoria", "Todas");
    const dentro = within(painel("Categoria", "Todas"));
    fireEvent.change(dentro.getByPlaceholderText("Pesquisar..."), {
      target: { value: "mater" },
    });
    expect(
      dentro.getByRole("checkbox", { name: "Materiais" }),
    ).toBeInTheDocument();
    expect(
      dentro.queryByRole("checkbox", { name: "Servicos prestados" }),
    ).toBeNull();
  });

  it("sem resultado, diz que não achou", () => {
    montar();
    abrir("Categoria", "Todas");
    const dentro = within(painel("Categoria", "Todas"));
    fireEvent.change(dentro.getByPlaceholderText("Pesquisar..."), {
      target: { value: "zzz" },
    });
    expect(dentro.getByText("Nenhum resultado encontrado")).toBeInTheDocument();
  });

  it("marcar avisa o pai com o valor acrescentado", () => {
    const props = montar();
    abrir("Situação", "Todas");
    fireEvent.click(
      within(painel("Situação", "Todas")).getByRole("checkbox", {
        name: "Quitado",
      }),
    );
    expect(props.onSituacao).toHaveBeenCalledWith(["Quitado"]);
  });

  it("marcar de novo o que já estava avisa o pai com o valor removido", () => {
    const props = montar({
      valores: { ...VALORES_VAZIOS, situacao: ["Quitado"] },
    });
    abrir("Situação", "1 selecionado(s)");
    const dentro = within(painel("Situação", "1 selecionado(s)"));
    // O checkbox que já veio selecionado tem que aparecer marcado, e só ele —
    // senão a fusão pode trocar o casamento entre `selecionadas` e `opcoes`
    // (ex.: comparar por objeto em vez de string) e desmarcar a lista inteira
    // sem que o callback abaixo denuncie nada.
    expect(dentro.getByRole("checkbox", { name: "Quitado" })).toBeChecked();
    expect(
      dentro.getByRole("checkbox", { name: "Em aberto" }),
    ).not.toBeChecked();
    fireEvent.click(dentro.getByRole("checkbox", { name: "Quitado" }));
    expect(props.onSituacao).toHaveBeenCalledWith([]);
  });

  it("'Limpar seleção' zera aquele filtro", () => {
    const props = montar({
      valores: { ...VALORES_VAZIOS, categoria: ["Materiais"] },
    });
    abrir("Categoria", "1 selecionado(s)");
    fireEvent.click(
      within(painel("Categoria", "1 selecionado(s)")).getByRole("button", {
        name: "Limpar seleção",
      }),
    );
    expect(props.onCategoria).toHaveBeenCalledWith([]);
  });

  it("clicar fora fecha o dropdown", () => {
    montar();
    // `aria-expanded` é o que anuncia aberto/fechado a quem usa leitor de
    // tela; sem afirmar o valor nos três estados, apagar o atributo não
    // derruba teste nenhum. (Não afirmamos `aria-haspopup`: a peça velha
    // promete um listbox que não entrega — não há `role="listbox"` nem
    // `role="option"` nela — e essa promessa mentirosa não é portada na
    // fusão. Exigir o atributo aqui obrigaria a mantê-la.)
    expect(gatilho("Situação", "Todas")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    abrir("Situação", "Todas");
    expect(gatilho("Situação", "Todas")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      within(painel("Situação", "Todas")).getByPlaceholderText("Pesquisar..."),
    ).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(gatilho("Situação", "Todas")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(
      within(painel("Situação", "Todas")).queryByPlaceholderText(
        "Pesquisar...",
      ),
    ).toBeNull();
  });
});
