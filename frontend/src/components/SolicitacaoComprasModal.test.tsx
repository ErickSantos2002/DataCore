import { fireEvent, render, screen } from "@testing-library/react";
import autoTable from "jspdf-autotable";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

import SolicitacaoComprasModal from "./SolicitacaoComprasModal";

/**
 * O modal de solicitação de compras, aberto pelo botão da tabela de Estoque.
 *
 * Caracterização antes de trocar o `<div>` cru pelo `Modal` do design system:
 * título, lista, busca, Cancelar e o conteúdo do PDF. O `jsPDF` é dublê que
 * anota os textos e o nome do arquivo; o corpo da tabela é lido no
 * `autoTable`.
 */

const { PDF } = vi.hoisted(() => ({
  PDF: { textos: [] as string[], arquivo: "" },
}));

vi.mock("jspdf", () => ({
  default: class {
    internal = { pageSize: { height: 297 } };
    addImage() {}
    setFontSize() {}
    text(texto: string) {
      PDF.textos.push(texto);
    }
    save(nome: string) {
      PDF.arquivo = nome;
    }
  },
}));
vi.mock("jspdf-autotable", () => ({ default: vi.fn() }));

const PRODUTOS = [
  { id: 1, nome: "Bocal", codigo: "163", saldo: 0 },
  { id: 2, nome: "Sensor antigo", codigo: "900", saldo: 4 },
  { id: 3, nome: "Kit calibração", codigo: "4", saldo: 3 },
];

let fechar: Mock<() => void>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 22, 10, 0));
  fechar = vi.fn<() => void>();
  vi.mocked(autoTable).mockClear();
  PDF.textos.length = 0;
  PDF.arquivo = "";
});

afterEach(() => {
  vi.useRealTimers();
});

function abrir() {
  return render(
    <SolicitacaoComprasModal
      aberto
      fechar={fechar}
      produtos={PRODUTOS}
      solicitante="erick"
    />,
  );
}

const gerar = () => screen.getByRole("button", { name: "Gerar PDF" });
const quantidades = () => screen.getAllByRole("spinbutton");
const busca = () => screen.getByPlaceholderText("Pesquisar produto...");
const linhas = () =>
  quantidades().map((campo) =>
    (campo.parentElement?.textContent ?? "").replace(/\s+/g, " ").trim(),
  );

function corpoDoPdf(): (string | number)[][] {
  const chamada = vi.mocked(autoTable).mock.calls[0];
  if (!chamada) throw new Error("autoTable nao foi chamado");
  return (chamada[1] as { body: (string | number)[][] }).body;
}

describe("modal de solicitacao de compras", () => {
  it("abre com o titulo e um campo de quantidade por produto do catalogo", () => {
    abrir();

    expect(screen.getByText("Selecionar Produtos")).toBeInTheDocument();
    expect(linhas()).toEqual([
      "163 - Bocal (Saldo: 0)",
      "900 - Sensor antigo (Saldo: 4)",
      "4 - Kit calibração (Saldo: 3)",
    ]);
  });

  it("fechado, nao desenha nada", () => {
    render(
      <SolicitacaoComprasModal
        aberto={false}
        fechar={fechar}
        produtos={PRODUTOS}
        solicitante="erick"
      />,
    );

    expect(screen.queryByText("Selecionar Produtos")).not.toBeInTheDocument();
  });

  it("a busca filtra pelo nome, sem caixa, e pelo codigo", () => {
    abrir();

    fireEvent.change(busca(), { target: { value: "SENSOR" } });
    expect(linhas()).toEqual(["900 - Sensor antigo (Saldo: 4)"]);

    fireEvent.change(busca(), { target: { value: "163" } });
    expect(linhas()).toEqual(["163 - Bocal (Saldo: 0)"]);
  });

  it("Cancelar fecha sem gerar nada", () => {
    abrir();
    fireEvent.change(quantidades()[1], { target: { value: "3" } });

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(fechar).toHaveBeenCalledTimes(1);
    expect(autoTable).not.toHaveBeenCalled();
  });

  it("o PDF leva so o que tem quantidade, com codigo, nome, saldo e quantidade", () => {
    abrir();
    fireEvent.change(quantidades()[1], { target: { value: "3" } });
    fireEvent.change(quantidades()[2], { target: { value: "10" } });
    fireEvent.change(quantidades()[0], { target: { value: "0" } });

    fireEvent.click(gerar());

    expect(corpoDoPdf()).toEqual([
      ["900", "Sensor antigo", 4, 3],
      ["4", "Kit calibração", 3, 10],
    ]);
  });

  it("o PDF tem titulo, data, solicitante e o nome do arquivo no dia local, e o modal fecha", () => {
    abrir();
    fireEvent.change(quantidades()[1], { target: { value: "3" } });

    fireEvent.click(gerar());

    expect(PDF.textos).toEqual([
      "Solicitação de Compras",
      "Data: 22/09/2026",
      "Solicitante: erick",
    ]);
    expect(PDF.arquivo).toBe("solicitacao_compras_2026-09-22.pdf");
    expect(fechar).toHaveBeenCalledTimes(1);
  });
});

describe("gerar PDF da solicitacao de compras", () => {
  // O PDF só leva o que tem quantidade acima de zero. Sem nenhuma, o botão
  // gerava e baixava uma solicitação só com o cabeçalho, e fechava o modal —
  // o mesmo defeito que as telas já tinham resolvido no "Exportar Excel".
  it("fica desabilitado enquanto nenhum produto tem quantidade", () => {
    abrir();

    expect(gerar()).toBeDisabled();
  });

  it("habilita com uma quantidade, e volta a desabilitar se ela vira zero", () => {
    abrir();

    fireEvent.change(quantidades()[1], { target: { value: "3" } });
    expect(gerar()).toBeEnabled();

    fireEvent.change(quantidades()[1], { target: { value: "0" } });
    expect(gerar()).toBeDisabled();
  });
});

describe("solicitacao de compras como dialogo", () => {
  // Era um `<div className="fixed inset-0">` à mão: sem `role="dialog"` nem
  // nome, sem Escape, e o Tab saía do modal para a tabela atrás da cortina.
  it("e um dialogo com o nome do titulo", () => {
    abrir();

    expect(
      screen.getByRole("dialog", { name: "Selecionar Produtos" }),
    ).toBeInTheDocument();
  });

  it("Escape fecha, como Cancelar", () => {
    abrir();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(fechar).toHaveBeenCalledTimes(1);
  });

  it("o Tab no ultimo campo volta para o primeiro, sem sair do dialogo", () => {
    abrir();
    fireEvent.change(quantidades()[0], { target: { value: "1" } });
    const dialogo = screen.getByRole("dialog");
    const gerarPdf = gerar();
    gerarPdf.focus();

    fireEvent.keyDown(dialogo, { key: "Tab" });

    expect(dialogo).toContainElement(document.activeElement as HTMLElement);
    expect(document.activeElement).not.toBe(gerarPdf);
  });
});

describe("campos da solicitacao com nome", () => {
  it("cada quantidade diz de qual produto e, e a busca diz o que busca", () => {
    // Sem rótulo, o leitor de tela anunciava três "caixa numérica" iguais, e
    // a busca só pelo placeholder, que some ao digitar.
    abrir();

    expect(
      screen.getByRole("spinbutton", { name: "Quantidade de Bocal" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: "Quantidade de Kit calibração" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Pesquisar produto" }),
    ).toBeInTheDocument();
  });
});

describe("quantidade que a busca esconde", () => {
  it("volta a aparecer no campo quando o produto volta para a lista", () => {
    // O campo não era controlado: o produto que a busca tirava da lista
    // voltava com o campo VAZIO, e a quantidade continuava indo para o PDF.
    abrir();
    const sensor = () =>
      screen.getByRole("spinbutton", { name: "Quantidade de Sensor antigo" });
    fireEvent.change(sensor(), { target: { value: "3" } });

    fireEvent.change(busca(), { target: { value: "Bocal" } });
    fireEvent.change(busca(), { target: { value: "" } });

    expect(sensor()).toHaveValue(3);
  });
});
