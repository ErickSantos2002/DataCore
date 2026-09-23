import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AbaComissao from "./AbaComissao";

/**
 * A aba de calculadora de comissão.
 *
 * É a única aba do Financeiro em que a pessoa DIGITA número que vira
 * pagamento — o Financeiro fecha o mês aqui e o valor sai para a folha. Por
 * isso o teste cobre a tela inteira, e não só a conta: o campo que não
 * atualiza, a linha que some com o vendedor errado ou o rateio que não
 * recalcula ao remover alguém pagam a pessoa errada tão bem quanto uma
 * alíquota trocada.
 *
 * A regra em si está testada em `comissaoDeVendas.test.ts` e
 * `comissaoDeServico.test.ts`; aqui o que se afirma é a ligação entre o que
 * se digita e o que se lê.
 */

/** O que a exportação de fato mandou para o `xlsx`, sem tocar em disco. */
const planilha = vi.hoisted(() => ({
  abas: [] as { nome: string; linhas: Record<string, unknown>[] }[],
  arquivo: "",
}));
vi.mock("xlsx", () => ({
  utils: {
    json_to_sheet: (linhas: Record<string, unknown>[]) => ({ linhas }),
    book_new: () => ({ livro: true }),
    book_append_sheet: (
      _livro: unknown,
      folha: { linhas: Record<string, unknown>[] },
      nome: string,
    ) => {
      planilha.abas.push({ nome, linhas: folha.linhas });
    },
  },
  writeFile: (_livro: unknown, nome: string) => {
    planilha.arquivo = nome;
  },
}));

/** Texto com o espaço duro do `Intl` normalizado para espaço comum. */
function texto(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** A linha da tabela em que mora o vendedor de número `numero`. */
function linhaDoVendedor(numero: number): HTMLElement {
  const campo = screen.getByLabelText(`Nome do vendedor ${numero}`);
  const linha = campo.closest("tr");
  if (!linha) throw new Error(`linha do vendedor ${numero} não encontrada`);
  return linha;
}

/** A linha da tabela de serviço em que mora a pessoa de número `numero`. */
function linhaDaPessoa(numero: number): HTMLElement {
  const campo = screen.getByLabelText(`Nome da pessoa ${numero}`);
  const linha = campo.closest("tr");
  if (!linha) throw new Error(`linha da pessoa ${numero} não encontrada`);
  return linha;
}

function digitar(rotulo: string, valor: string) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
}

/** Acrescenta um vendedor e preenche o que foi passado. */
function adicionarVendedor(
  numero: number,
  campos: {
    nome: string;
    inbound?: string;
    recompra?: string;
    outbound?: string;
  },
) {
  fireEvent.click(screen.getByRole("button", { name: /Adicionar vendedor/ }));
  digitar(`Nome do vendedor ${numero}`, campos.nome);
  if (campos.inbound) digitar(`Inbound do vendedor ${numero}`, campos.inbound);
  if (campos.recompra)
    digitar(`Recompra do vendedor ${numero}`, campos.recompra);
  if (campos.outbound)
    digitar(`Outbound do vendedor ${numero}`, campos.outbound);
}

/**
 * Um fechamento de cinco vendedores, com os números sintéticos e redondos do
 * `comissaoDeVendas.test.ts`: um vendendo nos dois canais, dois acima do
 * piso, um abaixo e um que não vendeu.
 */
function preencherFechamento() {
  digitar("Faturamento total da empresa (base do rateio)", "1.000.000");
  adicionarVendedor(1, {
    nome: "Vendedor A",
    inbound: "150.000",
    outbound: "70.000",
  });
  adicionarVendedor(2, { nome: "Vendedor B", inbound: "280.000" });
  adicionarVendedor(3, { nome: "Vendedor C", inbound: "250.000" });
  adicionarVendedor(4, { nome: "Vendedor D", inbound: "85.000" });
  adicionarVendedor(5, { nome: "Vendedor E" });
}

beforeEach(() => {
  planilha.abas = [];
  planilha.arquivo = "";
});

describe("Calculadora de Comissão — a tabela de vendedores", () => {
  it("abre vazia, dizendo o que fazer", () => {
    render(<AbaComissao />);

    expect(
      screen.getByText(/Nenhum vendedor no fechamento/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Adicionar vendedor/ }),
    ).toBeInTheDocument();
  });

  it("adicionar vendedor abre uma linha em branco", () => {
    render(<AbaComissao />);

    fireEvent.click(screen.getByRole("button", { name: /Adicionar vendedor/ }));

    expect(screen.getByLabelText("Nome do vendedor 1")).toHaveValue("");
    expect(
      screen.queryByText(/Nenhum vendedor no fechamento/),
    ).not.toBeInTheDocument();
  });

  it("o que se digita vira comissão na mesma linha", () => {
    render(<AbaComissao />);

    adicionarVendedor(1, { nome: "Ana", inbound: "700.000" });

    // 700.000 → faixa de 1% → 7.000 de comissão + 750 de bônus.
    const linha = texto(linhaDoVendedor(1));
    expect(linha).toContain("R$ 700.000,00");
    expect(linha).toContain("R$ 7.000,00");
    expect(linha).toContain("R$ 750,00");
    expect(linha).toContain("R$ 7.750,00");
  });

  it("a alíquota aplicada aparece na linha", () => {
    // Sem ela, quem confere o fechamento não tem como saber por que dois
    // vendedores com faturamento parecido receberam percentuais diferentes.
    render(<AbaComissao />);

    adicionarVendedor(1, { nome: "Ana", inbound: "700.000" });

    expect(texto(linhaDoVendedor(1))).toContain("1%");
  });

  it("somar os três canais muda a faixa da linha inteira", () => {
    render(<AbaComissao />);

    adicionarVendedor(1, { nome: "Ana", inbound: "300.000" });
    expect(texto(linhaDoVendedor(1))).toContain("0,75%");

    digitar("Outbound do vendedor 1", "300.000");

    expect(texto(linhaDoVendedor(1))).toContain("1%");
  });

  it("remover um vendedor tira a linha e recalcula o rateio dos outros", () => {
    render(<AbaComissao />);
    digitar("Faturamento total da empresa (base do rateio)", "1.000.000");
    adicionarVendedor(1, { nome: "Ana", inbound: "10.000" });
    adicionarVendedor(2, { nome: "Bruno", inbound: "10.000" });
    // 1% de 1.000.000 dividido por dois.
    expect(texto(linhaDoVendedor(1))).toContain("R$ 5.000,00");

    fireEvent.click(
      screen.getByRole("button", { name: "Remover o vendedor 2" }),
    );

    expect(
      screen.queryByLabelText("Nome do vendedor 2"),
    ).not.toBeInTheDocument();
    // Agora o rateio inteiro é de um só.
    expect(texto(linhaDoVendedor(1))).toContain("R$ 10.000,00");
  });
});

describe("Calculadora de Comissão — o rateio de 1%", () => {
  it("mostra quanto cabe a cada vendedor", () => {
    render(<AbaComissao />);
    adicionarVendedor(1, { nome: "Ana", inbound: "10.000" });
    adicionarVendedor(2, { nome: "Bruno", inbound: "10.000" });

    digitar("Faturamento total da empresa (base do rateio)", "1.000.000");

    expect(screen.getByText(/Rateio por vendedor/)).toBeInTheDocument();
    expect(
      texto(screen.getByText(/Rateio por vendedor/).parentElement),
    ).toContain("R$ 5.000,00");
  });

  it("marca quem está recebendo pelo piso, e não pela venda", () => {
    // O Financeiro precisa enxergar isso de relance: é a diferença entre
    // "vendeu bem" e "não vendeu e o mínimo garantido cobriu".
    render(<AbaComissao />);
    digitar("Faturamento total da empresa (base do rateio)", "1.000.000");
    adicionarVendedor(1, { nome: "Ana", inbound: "700.000" });
    adicionarVendedor(2, { nome: "Bruno", inbound: "150.000" });

    expect(texto(linhaDoVendedor(2))).toContain("mínimo garantido");
    expect(texto(linhaDoVendedor(1))).not.toContain("mínimo garantido");
  });

  it("vendedor sem venda nenhuma continua na conta e recebe o piso", () => {
    render(<AbaComissao />);
    digitar("Faturamento total da empresa (base do rateio)", "1.000.000");
    adicionarVendedor(1, { nome: "Ana", inbound: "700.000" });
    adicionarVendedor(2, { nome: "Beto" });

    expect(texto(linhaDoVendedor(2))).toContain("R$ 5.000,00");
  });
});

describe("Calculadora de Comissão — incentivos inativos", () => {
  it("a tela avisa que os dois existem e estão desligados", () => {
    render(<AbaComissao />);

    expect(
      screen.getByText("Dois incentivos ainda inativos"),
    ).toBeInTheDocument();
    // O corpo do aviso quebra em vários nós por causa dos destaques; o que
    // interessa é o texto inteiro do parágrafo.
    const aviso = texto(screen.getByText(/fazem parte/));
    expect(aviso).toContain("Inbound Plus");
    expect(aviso).toContain("Recompra Ativa");
    expect(aviso).toContain("inativos");
  });

  it("os campos aparecem, mas não aceitam digitação", () => {
    render(<AbaComissao />);
    adicionarVendedor(1, { nome: "Ana", inbound: "100.000" });

    expect(screen.getByLabelText("Inbound Plus do vendedor 1")).toBeDisabled();
    expect(
      screen.getByLabelText("Recompras ativas do vendedor 1"),
    ).toBeDisabled();
  });
});

describe("Calculadora de Comissão — comissão de serviço", () => {
  it("o faturamento de serviços vira a base e o valor de cada pessoa", () => {
    render(<AbaComissao />);

    digitar("Faturamento de serviços", "300.000");

    // 300.000 × 1% + 1.000 = 4.000 de base.
    expect(
      texto(screen.getByText(/Valor de referência/).parentElement),
    ).toContain("R$ 4.000,00");
    // O papel vem sem nome: quem o ocupou no mês se digita aqui.
    expect(screen.getByLabelText("Nome da pessoa 1")).toHaveValue("");
    expect(texto(linhaDaPessoa(1))).toContain("R$ 4.000,00"); // 100%
    expect(texto(linhaDaPessoa(2))).toContain("R$ 3.000,00"); // 75%
  });

  it("diz o degrau em que o faturamento caiu", () => {
    render(<AbaComissao />);

    digitar("Faturamento de serviços", "300.000");

    expect(screen.getByText(/1% \+ R\$ 1\.000,00/)).toBeInTheDocument();
  });

  it("mudar o percentual de uma pessoa muda só o valor dela", () => {
    render(<AbaComissao />);
    digitar("Faturamento de serviços", "200.000");

    digitar("Percentual da pessoa 2", "60");

    // Base 3.000: o primeiro papel segue com 100%, o segundo passa a 60%.
    expect(texto(linhaDaPessoa(1))).toContain("R$ 3.000,00");
    expect(texto(linhaDaPessoa(2))).toContain("R$ 1.800,00");
  });

  it("o total pago não é a base — os percentuais somam mais de 100%", () => {
    render(<AbaComissao />);

    digitar("Faturamento de serviços", "200.000");

    // Base 3.000; 100% + 75% + 50% = 6.750.
    expect(texto(screen.getByText(/Total de serviço/).parentElement)).toContain(
      "R$ 6.750,00",
    );
  });
});

describe("Calculadora de Comissão — um fechamento inteiro", () => {
  it("leva o que se digita até o total a pagar do mês", () => {
    render(<AbaComissao />);

    preencherFechamento();

    expect(texto(linhaDoVendedor(1))).toContain("R$ 2.425,00"); // dois canais
    expect(texto(linhaDoVendedor(2))).toContain("R$ 2.350,00");
    expect(texto(linhaDoVendedor(3))).toContain("R$ 2.125,00");
    expect(texto(linhaDoVendedor(4))).toContain("R$ 2.000,00"); // piso
    expect(texto(linhaDoVendedor(5))).toContain("R$ 2.000,00"); // piso, sem venda
    expect(texto(screen.getByText(/Total a pagar/).parentElement)).toContain(
      "R$ 10.900,00",
    );
  });
});

describe("Calculadora de Comissão — exportação", () => {
  it("sem vendedor fica desabilitado, e habilita com o primeiro", () => {
    // Sem linha nenhuma sairia planilha só com o cabeçalho — a regra das telas.
    render(<AbaComissao />);
    const exportar = screen.getByRole("button", { name: /Exportar/ });

    expect(exportar).toBeDisabled();

    adicionarVendedor(1, { nome: "Vendedor A" });
    expect(exportar).toBeEnabled();
  });

  it("leva as duas tabelas para a planilha", () => {
    render(<AbaComissao />);
    preencherFechamento();
    digitar("Faturamento de serviços", "300.000");

    fireEvent.click(screen.getByRole("button", { name: /Exportar/ }));

    expect(planilha.abas.map((aba) => aba.nome)).toEqual(["Vendas", "Serviço"]);
    expect(planilha.abas[0].linhas).toHaveLength(5);
    expect(planilha.abas[0].linhas[0]).toMatchObject({
      Vendedor: "Vendedor A",
      Recebe: 2425,
    });
    expect(planilha.abas[1].linhas[0]).toMatchObject({ "% do papel": 1 });
    expect(planilha.arquivo).toMatch(/^comissao-\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it("exporta o número, não o texto formatado", () => {
    // Planilha com "R$ 7.750,00" em texto não soma no Excel — e a primeira
    // coisa que alguém faz com o arquivo é somar a coluna.
    render(<AbaComissao />);
    adicionarVendedor(1, { nome: "Ana", inbound: "700.000" });

    fireEvent.click(screen.getByRole("button", { name: /Exportar/ }));

    expect(typeof planilha.abas[0].linhas[0].Comissão).toBe("number");
  });
});
