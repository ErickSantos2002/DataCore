import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext } from "./AuthContext";
import { ContasPagarProvider, useContasPagar } from "./ContasPagarContext";
import { useResumoDeContas } from "../pages/contas/useContas";
import {
  useResumoDeServicos,
  RECORTE_VAZIO,
} from "../pages/servicos/useServicos";
import { useFaturamento } from "../pages/financeiro/useFaturamento";

/**
 * As quatro fontes de dado das telas de dinheiro contam quando a busca falha.
 *
 * Sem isso a tela abre inteira em "Sem dados" com a API caída, e quem olha
 * não distingue "a API caiu" de "a empresa não faturou" — foi o que a
 * conferência no navegador mostrou. É o mesmo defeito 1.10 que as gêmeas
 * fecharam para as contas; aqui ele se fecha para o faturamento e os
 * serviços, e o que já funcionava fica travado por teste.
 *
 * O faturamento entra como HOOK e não como provider: ele substituiu o
 * `VendasContext`, que existia só para esta tela. O contrato testado é o
 * mesmo — falhou, diz que falhou.
 */

const fetchFaturamentoMensal = vi.hoisted(() => vi.fn());
const fetchResumoDeServicos = vi.hoisted(() => vi.fn());
const fetchContasPagar = vi.hoisted(() => vi.fn());
const fetchResumoDeContas = vi.hoisted(() => vi.fn());
vi.mock("../services/notasapi", () => ({
  fetchFaturamentoMensal,
  fetchResumoDeServicos,
  fetchContasPagar,
  fetchResumoDeContas,
}));

/** O interceptor de token do axios lê a sessão; por isso todos entram aqui. */
function ComSessao({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        user: { id: 1, username: "erick", role: "admin" },
        token: "t",
        loading: false,
        login: vi.fn(),
        entrarComToken: vi.fn(),
        logout: vi.fn(),
        error: null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function EspiaoDeFaturamento() {
  const { erro, carregando } = useFaturamento();
  return <p>{carregando ? "carregando" : (erro ?? "sem erro")}</p>;
}

function EspiaoDeServicos() {
  const { erro, carregando } = useResumoDeServicos(RECORTE_VAZIO);
  return <p>{carregando ? "carregando" : (erro ?? "sem erro")}</p>;
}

function EspiaoDePagar() {
  const { erro, carregando } = useContasPagar();
  return <p>{carregando ? "carregando" : (erro ?? "sem erro")}</p>;
}

const SEM_FILTRO = {
  situacao: [],
  categoria: [],
  contraparte: [],
  dataInicio: "",
  dataFim: "",
};

function EspiaoDeReceber() {
  const { erro, carregando } = useResumoDeContas("contas_receber", SEM_FILTRO);
  return <p>{carregando ? "carregando" : (erro ?? "sem erro")}</p>;
}

/** As quatro, com a frase que cada uma deve dizer quando a busca falha. */
const CONTEXTOS = [
  {
    nome: "faturamento",
    busca: fetchFaturamentoMensal,
    frase: "Não foi possível carregar o faturamento.",
    // Sem provider: é hook, e não context. Continua dentro de `ComSessao`
    // porque o interceptor de token do axios lê a sessão.
    montar: () => (
      <ComSessao>
        <EspiaoDeFaturamento />
      </ComSessao>
    ),
  },
  {
    nome: "serviços",
    busca: fetchResumoDeServicos,
    frase: "Não foi possível carregar as notas de serviço.",
    // Virou HOOK, como o faturamento: o `ServicosProvider` existia para as
    // 5.004 notas ficarem em memória, e desde o item 9.4 a tela pede o recorte
    // que desenha.
    montar: () => (
      <ComSessao>
        <EspiaoDeServicos />
      </ComSessao>
    ),
  },
  {
    nome: "contas a pagar",
    busca: fetchContasPagar,
    frase: "Não foi possível carregar as contas a pagar.",
    montar: () => (
      <ComSessao>
        <ContasPagarProvider>
          <EspiaoDePagar />
        </ContasPagarProvider>
      </ComSessao>
    ),
  },
  {
    nome: "contas a receber",
    busca: fetchResumoDeContas,
    frase: "Não foi possível carregar as contas a receber.",
    // Também virou hook. E saiu da tela de Financeiro junto: ela nunca leu os
    // dados, e o provider era montado só para propagar esta falha.
    montar: () => (
      <ComSessao>
        <EspiaoDeReceber />
      </ComSessao>
    ),
  },
];

let console_error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Os quatro registram a falha no console de propósito; o teste silencia o
  // ruído sem esconder o comportamento.
  console_error = vi.spyOn(console, "error").mockImplementation(() => {});
  for (const { busca } of CONTEXTOS) busca.mockReset();
});

afterEach(() => {
  console_error.mockRestore();
});

describe("os quatro contextos do Financeiro contam a falha de carga", () => {
  it.each(CONTEXTOS)(
    "$nome diz o que não carregou",
    async ({ busca, frase, montar }) => {
      for (const outro of CONTEXTOS) outro.busca.mockResolvedValue([]);
      busca.mockRejectedValue(new Error("500 da API"));

      render(montar());

      expect(await screen.findByText(frase)).toBeInTheDocument();
    },
  );

  it.each(CONTEXTOS)(
    "$nome não inventa erro quando dá certo",
    async ({ montar }) => {
      for (const outro of CONTEXTOS) outro.busca.mockResolvedValue([]);

      render(montar());

      expect(await screen.findByText("sem erro")).toBeInTheDocument();
    },
  );
});
