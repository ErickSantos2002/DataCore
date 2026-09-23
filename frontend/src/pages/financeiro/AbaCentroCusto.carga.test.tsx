import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AbaCentroCusto from "./AbaCentroCusto";

/**
 * O formulário do Centro de Custo enquanto a carga não chega.
 *
 * O `carregando` começava DESLIGADO e só ligava num `useEffect`: o primeiro
 * render desenhava o formulário vazio, com zeros, antes do spinner; e trocar o
 * ano desenhava um render com o ano novo no seletor e os números do ano
 * anterior no formulário. O Testing Library roda os efeitos antes de devolver
 * o controle, então o render que pisca some antes de qualquer `expect` — por
 * isso o formulário aqui é um dublê que anota cada vez que é desenhado.
 */

const { DESENHOS, fetchResumoProduto, fetchCentroCustoConfig } = vi.hoisted(
  () => ({
    DESENHOS: [] as number[],
    fetchResumoProduto: vi.fn(),
    fetchCentroCustoConfig: vi.fn(),
  }),
);

vi.mock("../../services/notasapi", () => ({
  fetchResumoProduto,
  fetchCentroCustoConfig,
  salvarCentroCustoConfig: vi.fn(),
}));

vi.mock("./FormularioDePrecificacao", () => ({
  FormularioDePrecificacao: ({ anoCentro }: { anoCentro?: number }) => {
    DESENHOS.push(anoCentro ?? 0);
    return <p>formulário</p>;
  },
}));

/** Aba com o ano em estado, como a página de Financeiro a monta. */
function Pai() {
  const [ano, setAno] = useState(2025);
  return <AbaCentroCusto anoCentro={ano} setAnoCentro={setAno} />;
}

beforeEach(() => {
  DESENHOS.length = 0;
  fetchResumoProduto.mockReset();
  fetchCentroCustoConfig.mockReset();
});

describe("Centro de Custo enquanto carrega", () => {
  it("ao abrir, o formulario nao e desenhado nenhuma vez antes da carga", () => {
    fetchResumoProduto.mockReturnValue(new Promise(() => {}));
    fetchCentroCustoConfig.mockReturnValue(new Promise(() => {}));

    render(<Pai />);

    expect(DESENHOS).toHaveLength(0);
  });

  it("ao trocar o ano, o formulario do ano anterior nao e desenhado de novo", async () => {
    fetchResumoProduto.mockResolvedValue([]);
    fetchCentroCustoConfig.mockResolvedValue(null);
    render(<Pai />);
    await screen.findAllByText("formulário");

    fetchResumoProduto.mockReturnValue(new Promise(() => {}));
    fetchCentroCustoConfig.mockReturnValue(new Promise(() => {}));
    DESENHOS.length = 0;
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "2024" }));
    });

    expect(DESENHOS).toHaveLength(0);
    expect(screen.queryByText("formulário")).not.toBeInTheDocument();
  });

  it("se a carga falha, sai do spinner com o aviso, e nao com o formulario de outro ano", async () => {
    // Não havia `catch`: a promessa rejeitava calada e o formulário ficava
    // com o que estivesse antes. Falha de rede é aviso no fluxo da página.
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchResumoProduto.mockRejectedValue(new Error("rede"));
    fetchCentroCustoConfig.mockRejectedValue(new Error("rede"));

    render(<Pai />);

    expect(
      await screen.findByText("Não foi possível carregar o centro de custo."),
    ).toBeInTheDocument();
    // O seletor de ano segue de pé, para tentar outro ano.
    expect(screen.getByRole("button", { name: "2024" })).toBeInTheDocument();
  });
});
