import type { ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Inadimplencia from "./Inadimplencia";
import { AuthContext } from "../context/AuthContext";
import type { EmpresaDaLista, ResumoDeInadimplencia } from "../services/inadimplencia";

const falso = vi.hoisted(() => ({ atual: null as null | ReturnType<typeof import("./inadimplencia/servidorFalso").criarServidorDeInadimplencia> }));

vi.mock("../services/inadimplencia", async () => {
  const { criarServidorDeInadimplencia } = await import("./inadimplencia/servidorFalso");
  falso.atual = criarServidorDeInadimplencia();
  return falso.atual.servico;
});

const planilha = vi.hoisted(() => ({ linhas: [] as unknown[] }));
vi.mock("../lib/planilha", () => ({
  baixarPlanilha: (abas: { linhas: unknown[] }[]) => { planilha.linhas = abas[0].linhas; },
}));

function Molde({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={{ user: { id: 1, username: "ana", role: "financeiro" }, token: "t",
      loading: false, login: vi.fn(), entrarComToken: vi.fn(), logout: vi.fn(), error: null }}>
      {children}
    </AuthContext.Provider>
  );
}

const RESUMO: ResumoDeInadimplencia = {
  total_a_receber: 10000, total_vencido: 4000, em_atraso: 1000, inadimplente: 3000,
  inadimplencia_carteira: 0.3, recuperado: 0.8, titulos_vencidos: 12, titulos_inadimplentes: 8,
  empresas_inadimplentes: 3,
  faixas: [
    { faixa: "atraso", titulos: 4, empresas: 2, valor: 1000 },
    { faixa: "31_60", titulos: 3, empresas: 2, valor: 1500 },
    { faixa: "61_90", titulos: 1, empresas: 1, valor: 500 },
    { faixa: "90_mais", titulos: 4, empresas: 1, valor: 1000 },
  ],
  sem_contato: 2, promessas_7_dias: 1, promessas_quebradas: 0, em_negociacao: 0,
};

function empresa(campos: Partial<EmpresaDaLista> & { empresa: string; nome: string }): EmpresaDaLista {
  return { documento: "11.111.111/0001-11", filiais: 1, titulos: 1, valor_devido: 100,
           valor_inadimplente: 100, maior_atraso: 40, status: "sem_contato", proxima_data: null,
           ultimo_contato: null, ...campos };
}

const EMPRESAS = [
  empresa({ empresa: "11111111", nome: "Alfa Ltda", valor_devido: 2000, maior_atraso: 95, status: "promessa", proxima_data: "2026-10-15", ultimo_contato: "2026-10-01T10:00:00Z" }),
  empresa({ empresa: "22222222", nome: "Beta SA", documento: "22.222.222 · 3 filiais", filiais: 3, titulos: 5, valor_devido: 1500, maior_atraso: 45 }),
];

/** O último pedido de lista que o servidor falso recebeu (sem `.at`, a lib do projeto é anterior ao ES2022). */
function ultimoPedido() {
  const p = falso.atual!.estado.pedidos;
  return p[p.length - 1];
}

async function assentar() { await act(async () => { await Promise.resolve(); }); }

async function montar() {
  render(<Inadimplencia />, { wrapper: Molde });
  await assentar();
  await assentar();
}

beforeEach(() => {
  const e = falso.atual!.estado;
  Object.assign(e, { modo: "ok", resumo: RESUMO, empresas: EMPRESAS, pedidos: [], eventos: [],
                     observacoes: [], erroDeGravacao: null });
});

describe("Inadimplência — aba Cobrança", () => {
  it("mostra os cards do resumo", async () => {
    await montar();
    expect(screen.getByText("Inadimplente (mais de 30 dias)")).toBeInTheDocument();
    expect(screen.getByText("30,0%")).toBeInTheDocument();
    expect(screen.getByText("80,0%")).toBeInTheDocument();
  });

  it("a lista mostra nome, CNPJ, status e próxima data, como a tabela de Contas", async () => {
    await montar();
    const linhas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(linhas).toHaveLength(2);
    expect(within(linhas[0]).getByText("Alfa Ltda")).toBeInTheDocument();
    expect(within(linhas[0]).getByText("11.111.111/0001-11")).toBeInTheDocument();
    expect(within(linhas[0]).getByText("Promessa de pagamento")).toBeInTheDocument();
    expect(within(linhas[0]).getByText("15/10/2026")).toBeInTheDocument();
    expect(within(linhas[1]).getByText("22.222.222 · 3 filiais")).toBeInTheDocument();
    expect(within(linhas[1]).getByText("nunca")).toBeInTheDocument();
  });

  it("clicar numa faixa filtra a lista por ela", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /61–90 dias/ }));
    await assentar();
    expect(ultimoPedido()?.faixa).toBe("61_90");
  });

  it("buscar volta para a página 1 e manda a busca", async () => {
    await montar();
    fireEvent.change(screen.getByLabelText("Pesquisar empresas"), { target: { value: "beta" } });
    await assentar();
    const ultimo = ultimoPedido();
    expect(ultimo.busca).toBe("beta");
    expect(ultimo.offset).toBe(0);
  });

  it("ordenar pelo cabeçalho pede a ordenação ao servidor", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /Maior atraso/ }));
    await assentar();
    expect(ultimoPedido()?.ordenar_por).toBe("maior_atraso");
  });

  it("exportar leva todas as empresas do filtro", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /Exportar/ }));
    await assentar();
    expect(planilha.linhas).toHaveLength(2);
  });

  it("falha de carregamento avisa em bloco", async () => {
    falso.atual!.estado.modo = "falha";
    await montar();
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar");
  });
});
