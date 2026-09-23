import { describe, expect, it, vi } from "vitest";

import { baixarPlanilha } from "./planilha";

/** O que a exportação mandou para o `xlsx`, sem tocar em disco. */
const capturado = vi.hoisted(() => ({
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
      capturado.abas.push({ nome, linhas: folha.linhas });
    },
  },
  writeFile: (_livro: unknown, nome: string) => {
    capturado.arquivo = nome;
  },
}));

function limpar() {
  capturado.abas = [];
  capturado.arquivo = "";
}

describe("baixarPlanilha", () => {
  it("monta uma aba e batiza o arquivo", () => {
    limpar();
    baixarPlanilha(
      [{ nome: "Produtos", linhas: [{ Código: "P1", Produto: "Bafômetro" }] }],
      "produtos_2026-08-28.xlsx",
    );

    expect(capturado.abas).toEqual([
      { nome: "Produtos", linhas: [{ Código: "P1", Produto: "Bafômetro" }] },
    ]);
    expect(capturado.arquivo).toBe("produtos_2026-08-28.xlsx");
  });

  it("monta duas abas no mesmo arquivo, na ordem em que vieram", () => {
    // O caso de `financeiro/AbaComissao.tsx`, a unica das nove que exporta
    // duas abas. Sem este teste a lista de abas nasceria com um caminho sem
    // rede — e seria a chamadora mais complicada a descobrir o defeito.
    limpar();
    baixarPlanilha(
      [
        { nome: "Vendas", linhas: [{ Vendedor: "Ana" }] },
        { nome: "Serviço", linhas: [{ Vendedor: "Bruno" }] },
      ],
      "comissao-2026-08-28.xlsx",
    );

    expect(capturado.abas.map((a) => a.nome)).toEqual(["Vendas", "Serviço"]);
    expect(capturado.abas[1].linhas).toEqual([{ Vendedor: "Bruno" }]);
  });

  it("chama o ajustar da aba com a folha montada", () => {
    // A excecao de `Vendedores.tsx`, que define largura de coluna e formato
    // contabil DEPOIS que a folha existe.
    limpar();
    const vistas: unknown[] = [];
    baixarPlanilha(
      [
        {
          nome: "Minhas Vendas",
          linhas: [{ Valor: 10 }],
          ajustar: (folha) => vistas.push(folha),
        },
      ],
      "vendas_ana_2026-08-28.xlsx",
    );

    expect(vistas).toHaveLength(1);
    expect(vistas[0]).toEqual({ linhas: [{ Valor: 10 }] });
  });

  it("sem ajustar, nao quebra", () => {
    limpar();
    expect(() =>
      baixarPlanilha([{ nome: "Vazia", linhas: [] }], "vazia.xlsx"),
    ).not.toThrow();
    expect(capturado.arquivo).toBe("vazia.xlsx");
  });
});
