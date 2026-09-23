import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Configuracoes from "./Configuracoes";
import { AuthContext } from "../context/AuthContext";
import { ConfiguracoesContext } from "../context/ConfiguracoesContext";

type Configuracao = { id: number; chave: string; valor: string };

function renderConfiguracoes(opts: {
  auth?: Partial<React.ComponentProps<typeof AuthContext.Provider>["value"]>;
  config?: Partial<
    React.ComponentProps<typeof ConfiguracoesContext.Provider>["value"]
  >;
}) {
  const authValue = {
    user: { id: 1, username: "admin", role: "admin" },
    token: "t",
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    error: null,
    ...opts.auth,
  };
  const configValue = {
    configuracoes: [] as Configuracao[],
    carregando: false,
    editarConfiguracao: vi.fn(async () => {}),
    criarConfiguracao: vi.fn(async () => {}),
    ...opts.config,
  };
  return {
    ...render(
      <AuthContext.Provider value={authValue}>
        <ConfiguracoesContext.Provider value={configValue}>
          <Configuracoes />
        </ConfiguracoesContext.Provider>
      </AuthContext.Provider>,
    ),
    configValue,
  };
}

describe("Configuracoes", () => {
  it("mostra mensagem enquanto verifica a permissao do usuario", () => {
    renderConfiguracoes({ auth: { loading: true, user: null } });
    expect(screen.getByText(/verificando permiss/i)).toBeInTheDocument();
  });

  it("nega acesso a quem nao e admin", () => {
    renderConfiguracoes({
      auth: { user: { id: 2, username: "vendas", role: "vendas" } },
    });
    expect(
      screen.getByText(
        "Acesso negado. Esta página é restrita a administradores.",
      ),
    ).toBeInTheDocument();
  });

  it("mostra mensagem de carregamento das configuracoes para o admin", () => {
    renderConfiguracoes({ config: { carregando: true } });
    expect(screen.getByText(/carregando configura/i)).toBeInTheDocument();
  });

  it("mostra o interruptor de ANIMACAO_META e alterna seu valor", () => {
    const { configValue } = renderConfiguracoes({
      config: {
        configuracoes: [{ id: 1, chave: "ANIMACAO_META", valor: "true" }],
      },
    });
    const interruptor = screen.getByRole("switch");
    expect(interruptor).toBeChecked();
    expect(screen.getByText("Ativada")).toBeInTheDocument();

    fireEvent.click(interruptor);
    expect(configValue.editarConfiguracao).toHaveBeenCalledWith(
      "ANIMACAO_META",
      "false",
    );
  });

  it("mostra o valor de uma configuracao comum e permite editar e salvar", async () => {
    const { configValue } = renderConfiguracoes({
      config: {
        configuracoes: [{ id: 2, chave: "OUTRA_CHAVE", valor: "valor-antigo" }],
      },
    });
    expect(screen.getByText("valor-antigo")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /editar/i }));
    const campo = screen.getByLabelText("OUTRA_CHAVE");
    expect(campo).toHaveValue("valor-antigo");

    fireEvent.change(campo, { target: { value: "valor-novo" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(configValue.editarConfiguracao).toHaveBeenCalledWith(
      "OUTRA_CHAVE",
      "valor-novo",
    );
  });

  it("cancelar a edicao descarta a alteracao sem chamar editarConfiguracao", () => {
    const { configValue } = renderConfiguracoes({
      config: {
        configuracoes: [{ id: 3, chave: "TERCEIRA_CHAVE", valor: "original" }],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /editar/i }));
    fireEvent.change(screen.getByLabelText("TERCEIRA_CHAVE"), {
      target: { value: "rascunho" },
    });
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(configValue.editarConfiguracao).not.toHaveBeenCalled();
    expect(screen.getByText("original")).toBeInTheDocument();
  });
});
