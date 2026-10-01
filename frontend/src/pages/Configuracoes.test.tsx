import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Configuracoes from "./Configuracoes";

const fetchHistoricoConfiguracoes = vi.hoisted(() =>
  vi.fn(async () => [] as unknown[]),
);
vi.mock("../services/notasapi", () => ({ fetchHistoricoConfiguracoes }));
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
    entrarComToken: vi.fn(),
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
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(configValue.editarConfiguracao).toHaveBeenCalledWith(
        "OUTRA_CHAVE",
        "valor-novo",
      ),
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

const SEMENTE: Configuracao[] = [
  { id: 1, chave: "META", valor: "12666666.72" },
  { id: 2, chave: "TRIMESTRE_APURACAO", valor: "auto" },
  { id: 3, chave: "ANIMACAO_META", valor: "true" },
];

describe("Configuracoes — meta anual", () => {
  it("mostra a meta em reais e os degraus do trimestre", () => {
    renderConfiguracoes({ config: { configuracoes: SEMENTE } });
    expect(screen.getByLabelText("Meta anual (R$)")).toHaveValue(
      "12.666.666,72",
    );
    expect(screen.getByText("R$ 3.166.666,68")).toBeInTheDocument(); // ÷4
  });

  it("recalcula os degraus enquanto se digita, inclusive com R$", () => {
    renderConfiguracoes({ config: { configuracoes: SEMENTE } });
    fireEvent.change(screen.getByLabelText("Meta anual (R$)"), {
      target: { value: "R$ 12.000.000,00" },
    });
    expect(screen.getByText("R$ 3.000.000,00")).toBeInTheDocument(); // trimestre
    expect(screen.getByText("R$ 4.200.000,00")).toBeInTheDocument(); // 100% de PL
  });

  it("salva o que foi digitado", async () => {
    const { configValue } = renderConfiguracoes({
      config: { configuracoes: SEMENTE },
    });
    fireEvent.change(screen.getByLabelText("Meta anual (R$)"), {
      target: { value: "13.000.000,00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar meta" }));
    await waitFor(() =>
      expect(configValue.editarConfiguracao).toHaveBeenCalledWith(
        "META",
        "13.000.000,00",
      ),
    );
  });

  it("erro do backend aparece e o campo mantém o digitado", async () => {
    const editarConfiguracao = vi.fn(async () => {
      throw {
        response: {
          status: 422,
          data: {
            detail: "A META precisa ser um valor em reais maior que zero.",
          },
        },
      };
    });
    renderConfiguracoes({
      config: { configuracoes: SEMENTE, editarConfiguracao },
    });
    fireEvent.change(screen.getByLabelText("Meta anual (R$)"), {
      target: { value: "0,01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar meta" }));

    expect(
      await screen.findByText(
        "A META precisa ser um valor em reais maior que zero.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Meta anual (R$)")).toHaveValue("0,01");
  });

  it("403 vira uma frase, não um código", async () => {
    const editarConfiguracao = vi.fn(async () => {
      throw {
        response: {
          status: 403,
          data: { detail: "Acesso restrito a administradores." },
        },
      };
    });
    renderConfiguracoes({
      config: { configuracoes: SEMENTE, editarConfiguracao },
    });
    fireEvent.change(screen.getByLabelText("Meta anual (R$)"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar meta" }));
    expect(
      await screen.findByText(
        "Só administradores podem alterar configurações.",
      ),
    ).toBeInTheDocument();
  });
});

describe("Configuracoes — trimestre em apuração", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 1));
  });
  afterEach(() => vi.useRealTimers());

  it("no automático, diz qual trimestre está valendo", () => {
    renderConfiguracoes({ config: { configuracoes: SEMENTE } });
    expect(
      screen.getByText("Agora: 4º trimestre de 2026 · out, nov, dez"),
    ).toBeInTheDocument();
  });

  it("fixar grava ano e trimestre", async () => {
    const { configValue } = renderConfiguracoes({
      config: { configuracoes: SEMENTE },
    });
    fireEvent.click(screen.getByLabelText(/^Fixar um trimestre/));
    fireEvent.change(screen.getByLabelText("Ano"), {
      target: { value: "2026" },
    });
    fireEvent.change(screen.getByLabelText("Trimestre"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar trimestre" }));
    await waitFor(() =>
      expect(configValue.editarConfiguracao).toHaveBeenCalledWith(
        "TRIMESTRE_APURACAO",
        "2026-T3",
      ),
    );
  });

  it("voltar para o automático grava auto", async () => {
    const config = SEMENTE.map((c) =>
      c.chave === "TRIMESTRE_APURACAO" ? { ...c, valor: "2026-T3" } : c,
    );
    const { configValue } = renderConfiguracoes({
      config: { configuracoes: config },
    });
    fireEvent.click(
      screen.getByLabelText(/^Automático \(segue o calendário\)/),
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar trimestre" }));
    await waitFor(() =>
      expect(configValue.editarConfiguracao).toHaveBeenCalledWith(
        "TRIMESTRE_APURACAO",
        "auto",
      ),
    );
  });
});

describe("Configuracoes — outros sistemas", () => {
  it("lista as chaves que o painel não usa, com quem as lê", () => {
    renderConfiguracoes({
      config: {
        configuracoes: [
          ...SEMENTE,
          { id: 4, chave: "CFOP_VALIDOS", valor: "6102,5102" },
        ],
      },
    });
    expect(screen.getByText("Usadas por outros sistemas")).toBeInTheDocument();
    expect(screen.getByText("CFOP_VALIDOS")).toBeInTheDocument();
    expect(screen.getByText(/Lida pelo HS\.OS/)).toBeInTheDocument();
  });

  it("some quando só há chaves do painel — inclusive a MESES_ANALISE aposentada", () => {
    renderConfiguracoes({
      config: {
        configuracoes: [
          ...SEMENTE,
          { id: 5, chave: "MESES_ANALISE", valor: "10,11,12" },
        ],
      },
    });
    expect(
      screen.queryByText("Usadas por outros sistemas"),
    ).not.toBeInTheDocument();
  });

  it("edita uma chave de outro sistema como texto", async () => {
    const { configValue } = renderConfiguracoes({
      config: {
        configuracoes: [
          ...SEMENTE,
          { id: 4, chave: "CFOP_VALIDOS", valor: "6102" },
        ],
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Editar CFOP_VALIDOS" }),
    );
    fireEvent.change(screen.getByLabelText("CFOP_VALIDOS"), {
      target: { value: "6102,7102" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(configValue.editarConfiguracao).toHaveBeenCalledWith(
        "CFOP_VALIDOS",
        "6102,7102",
      ),
    );
  });
});

describe("Configuracoes — histórico", () => {
  beforeEach(() => {
    fetchHistoricoConfiguracoes.mockReset().mockResolvedValue([]);
  });

  it("mostra as últimas alterações", async () => {
    fetchHistoricoConfiguracoes.mockResolvedValue([
      {
        id: 1,
        chave: "META",
        valor_anterior: "12000000.00",
        valor_novo: "12666666.72",
        alterado_por: "chefe",
        alterado_em: "2026-10-01T14:30:00-03:00",
      },
    ]);
    renderConfiguracoes({ config: { configuracoes: SEMENTE } });
    expect(await screen.findByText("chefe")).toBeInTheDocument();
    expect(screen.getByText("12000000.00 → 12666666.72")).toBeInTheDocument();
  });

  it("recarrega depois de salvar", async () => {
    fetchHistoricoConfiguracoes.mockResolvedValue([]);
    renderConfiguracoes({ config: { configuracoes: SEMENTE } });
    await waitFor(() =>
      expect(fetchHistoricoConfiguracoes).toHaveBeenCalledTimes(1),
    );

    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() =>
      expect(fetchHistoricoConfiguracoes).toHaveBeenCalledTimes(2),
    );
  });

  it("sem alteração registrada, diz isso", async () => {
    fetchHistoricoConfiguracoes.mockResolvedValue([]);
    renderConfiguracoes({ config: { configuracoes: SEMENTE } });
    expect(
      await screen.findByText("Nenhuma alteração registrada ainda."),
    ).toBeInTheDocument();
  });
});
