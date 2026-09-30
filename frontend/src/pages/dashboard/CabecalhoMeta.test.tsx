import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../components/ToastProvider";
import type { PedidoDeAtualizacao } from "../../services/operacao";
import { CabecalhoMeta } from "./CabecalhoMeta";
import { INTERVALO_ACOMPANHAMENTO_MS } from "./useAtualizacaoManual";

const { pedir, ultima } = vi.hoisted(() => ({
  pedir: vi.fn(),
  ultima: vi.fn(),
}));
vi.mock("../../services/operacao", () => ({
  pedirAtualizacaoManual: pedir,
  fetchUltimaAtualizacaoManual: ultima,
}));

const ADMIN = { username: "erick", role: "admin" };

const NA_FILA: PedidoDeAtualizacao = {
  id: 7,
  pedido_em: "2026-09-30T14:20:00Z",
  pedido_por: "erick",
  iniciado_em: null,
  concluido_em: null,
  resultado: null,
  detalhe: null,
};

function montar(usuario = ADMIN) {
  return render(
    <ToastProvider>
      <CabecalhoMeta usuario={usuario} />
    </ToastProvider>,
  );
}

/** Deixa as promessas resolvidas chegarem ao React. */
async function assentar() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("CabecalhoMeta — botão Atualizar dados agora", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    pedir.mockReset();
    ultima.mockReset().mockResolvedValue(null);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("não aparece para quem não é admin, nem pergunta pela fila", async () => {
    montar({ username: "joao", role: "comum" });
    await assentar();
    expect(
      screen.queryByRole("button", { name: /atualizar dados/i }),
    ).toBeNull();
    expect(ultima).not.toHaveBeenCalled();
  });

  it("pede à API — não mais ao n8n — e avisa o que vai ser atualizado", async () => {
    const espiaoFetch = vi.spyOn(globalThis, "fetch");
    pedir.mockResolvedValue(NA_FILA);
    montar();
    await assentar();

    fireEvent.click(
      screen.getByRole("button", { name: /atualizar dados agora/i }),
    );
    await assentar();

    expect(pedir).toHaveBeenCalledTimes(1);
    expect(espiaoFetch).not.toHaveBeenCalled();
    expect(
      screen.getByText(/notas fiscais, notas de serviço e dados analíticos/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/na fila desde/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /atualizar dados agora/i }),
    ).toBeDisabled();
    espiaoFetch.mockRestore();
  });

  it("acompanha o pedido e avisa quando termina", async () => {
    pedir.mockResolvedValue(NA_FILA);
    montar();
    await assentar();
    fireEvent.click(
      screen.getByRole("button", { name: /atualizar dados agora/i }),
    );
    await assentar();

    ultima.mockResolvedValue({
      ...NA_FILA,
      iniciado_em: "2026-09-30T14:21:00Z",
      concluido_em: "2026-09-30T14:28:00Z",
      resultado: "sucesso",
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALO_ACOMPANHAMENTO_MS);
    });

    expect(screen.getByText(/dados atualizados/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /atualizar dados agora/i }),
    ).toBeEnabled();
  });

  it("falha na atualização vira aviso com a etapa que caiu", async () => {
    ultima.mockResolvedValueOnce({
      ...NA_FILA,
      iniciado_em: "2026-09-30T14:21:00Z",
    });
    montar();
    await assentar();
    expect(screen.getByText(/atualizando desde/i)).toBeInTheDocument();

    ultima.mockResolvedValue({
      ...NA_FILA,
      concluido_em: "2026-09-30T14:28:00Z",
      resultado: "falha",
      detalhe: "importar_nfse saiu com 1",
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALO_ACOMPANHAMENTO_MS);
    });

    expect(screen.getByText(/importar_nfse saiu com 1/)).toBeInTheDocument();
  });

  it("pedido já concluído ao abrir a tela não dispara aviso velho", async () => {
    ultima.mockResolvedValue({
      ...NA_FILA,
      concluido_em: "2026-09-30T10:00:00Z",
      resultado: "sucesso",
    });
    montar();
    await assentar();
    expect(screen.queryByText(/dados atualizados/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: /atualizar dados agora/i }),
    ).toBeEnabled();
  });

  it("erro ao pedir vira aviso de erro", async () => {
    pedir.mockRejectedValue(new Error("rede"));
    montar();
    await assentar();
    fireEvent.click(
      screen.getByRole("button", { name: /atualizar dados agora/i }),
    );
    await assentar();
    expect(
      screen.getByText(/não foi possível pedir a atualização/i),
    ).toBeInTheDocument();
  });
});
