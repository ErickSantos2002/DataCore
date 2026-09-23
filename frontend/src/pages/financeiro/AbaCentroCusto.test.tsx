import { useState } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AbaCentroCusto from "./AbaCentroCusto";

/**
 * Teste de caracterização da aba Centro de Custo.
 *
 * Fixa o comportamento que existia ANTES da migração para o design system.
 * É a aba com mais conta por linha do sistema inteiro e nenhuma dela está
 * fora do componente: rateio de NF de importação por unidade, rateio de
 * overhead — que muda de base conforme exista ou não quantidade planejada —,
 * custo total, margem, e a projeção que decide preço de bafômetro. Nada disso
 * tem teste, e o número sai daqui direto para a decisão comercial.
 *
 * Tudo é observado pelo componente renderizado, nunca por função exportada de
 * propósito para o teste. Os campos são achados pelo **rótulo visível**, não
 * por placeholder: dois campos diferentes usam o placeholder "13,9" (o % da
 * NF e o % do estoque), e um teste que os confundisse passaria trocado.
 */

const fetchResumoProduto = vi.hoisted(() => vi.fn());
const fetchCentroCustoConfig = vi.hoisted(() => vi.fn());
const salvarCentroCustoConfig = vi.hoisted(() => vi.fn());
vi.mock("../../services/notasapi", () => ({
  fetchResumoProduto,
  fetchCentroCustoConfig,
  salvarCentroCustoConfig,
}));

const PHOEBUS = "BAFÔMETRO PHOEBUS";
const IBLOW = "BAFÔMETRO PASSIVO - IBLOW 10 PRO";

/** Linhas de resumo por produto, como a API devolve (uma por mês). */
type LinhaResumo = { receita: number; quantidade: number };

interface Cenario {
  /** Resumo de vendas por produto; ausente = produto sem venda nenhuma. */
  resumo?: Record<string, LinhaResumo[]>;
  /** `config_json` gravado por produto; ausente = produto sem configuração. */
  config?: Record<string, Record<string, unknown>>;
  ano?: number;
  setAnoCentro?: (ano: number) => void;
}

/** Monta a aba e espera a carga inicial dos três produtos terminar. */
async function montar(cenario: Cenario = {}) {
  fetchResumoProduto.mockImplementation(
    async (produto: string) => cenario.resumo?.[produto] ?? [],
  );
  fetchCentroCustoConfig.mockImplementation(async (produto: string) =>
    cenario.config?.[produto] ? { config_json: cenario.config[produto] } : null,
  );

  const util = render(
    <AbaCentroCusto
      anoCentro={cenario.ano ?? 2025}
      setAnoCentro={cenario.setAnoCentro ?? vi.fn()}
    />,
  );
  await waitFor(() =>
    expect(screen.getByText("1. Serviços Aduaneiros")).toBeInTheDocument(),
  );
  return util;
}

/** Aba com o ano em estado, como a página de Financeiro a monta. */
function Pai({ inicial = 2025 }: { inicial?: number }) {
  const [ano, setAno] = useState(inicial);
  return <AbaCentroCusto anoCentro={ano} setAnoCentro={setAno} />;
}

/**
 * Texto de um elemento com o espaço normalizado.
 *
 * O `Intl` separa `R$` do número com espaço duro (U+00A0); o `textContent`
 * cru o entrega assim e uma comparação com espaço comum falharia contra um
 * texto que na tela é idêntico.
 */
function texto(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ");
}

/**
 * O campo de entrada de um rótulo visível.
 *
 * Sobe do rótulo até o primeiro ancestral que contenha um `input` — assim o
 * seletor não depende de quantos `div` de layout existem entre os dois, e
 * sobrevive à troca por `Input` do design system.
 */
function campo(rotulo: RegExp | string): HTMLInputElement {
  let el: HTMLElement | null = screen.getByText(rotulo);
  while (el && !el.querySelector("input")) el = el.parentElement;
  const input = el?.querySelector("input");
  if (!input) throw new Error(`campo "${rotulo}" não encontrado`);
  return input as HTMLInputElement;
}

/**
 * Um controle clicável pelo nome, seja ele `button` ou `tab`.
 *
 * O seletor é tolerante de propósito: a migração troca os botões de aba
 * feitos à mão pelo primitivo `Tabs`, que renderiza `role="tab"`. O que o
 * teste afirma é que existe um controle com aquele nome e que clicá-lo troca
 * o conteúdo — não com que papel ARIA ele nasceu.
 */
function controle(nome: string | RegExp): HTMLElement {
  const botoes = screen.queryAllByRole("button", { name: nome });
  if (botoes.length > 0) return botoes[0];
  return screen.getByRole("tab", { name: nome });
}

/** Linha do resumo lateral: "Overhead" → "OverheadR$ 240,00". */
function linhaResumo(rotulo: string): string {
  return texto(screen.getByText(rotulo).parentElement);
}

/** Preenche um campo achado pelo rótulo. */
function digitar(rotulo: RegExp | string, valor: string) {
  fireEvent.change(campo(rotulo), { target: { value: valor } });
}

/** Adiciona uma NF de importação e preenche as três colunas. */
function adicionarNF(mesAno: string, valor: string, nf = "1") {
  fireEvent.click(screen.getByRole("button", { name: /Adicionar NF/ }));
  const linha = screen.getAllByPlaceholderText("03/2026").length - 1;
  fireEvent.change(screen.getAllByPlaceholderText("03/2026")[linha], {
    target: { value: mesAno },
  });
  fireEvent.change(screen.getAllByPlaceholderText("221.371,58")[linha], {
    target: { value: valor },
  });
  fireEvent.change(screen.getAllByPlaceholderText("7858")[linha], {
    target: { value: nf },
  });
}

/** Adiciona um custo direto por unidade. */
function adicionarCustoDireto(descricao: string, valor: string) {
  fireEvent.click(screen.getByRole("button", { name: /Adicionar item/ }));
  const linha =
    screen.getAllByPlaceholderText("Ex: Caixa, Frete, Produto...").length - 1;
  fireEvent.change(
    screen.getAllByPlaceholderText("Ex: Caixa, Frete, Produto...")[linha],
    { target: { value: descricao } },
  );
  fireEvent.change(screen.getAllByPlaceholderText("0,00")[linha], {
    target: { value: valor },
  });
}

/**
 * O cenário fechado que dá as contas redondas usadas em quase todo o arquivo:
 * duas NFs de 150.000 no total, 10% delas neste produto, 300 unidades
 * importadas, 250,00 de custo direto, 1.200.000 de custo fixo anual com 10%
 * alocado e 500 unidades a vender no ano.
 *
 * → aduaneiro 150.000 × 10% ÷ 300 = 50,00
 * → overhead 1.200.000 × 10% ÷ 500 = 240,00
 * → custo total 50 + 250 + 240 = 540,00
 */
function preencherCenarioFechado() {
  adicionarNF("012026", "100.000,00", "111");
  adicionarNF("022026", "50.000,00", "222");
  digitar(/% da NF que é deste produto/, "10");
  digitar(/Unidades importadas/, "300");
  adicionarCustoDireto("Produto", "250,00");
  digitar(/Custo fixo anual da empresa/, "1.200.000,00");
  digitar(/% deste produto no estoque/, "10");
  digitar(/Unidades a vender no ano/, "500");
}

beforeEach(() => {
  fetchResumoProduto.mockReset();
  fetchCentroCustoConfig.mockReset();
  salvarCentroCustoConfig.mockReset();
  salvarCentroCustoConfig.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Aba Centro de Custo — carga", () => {
  it("busca resumo e configuração dos três produtos no ano recebido", async () => {
    await montar({ ano: 2024 });

    expect(fetchResumoProduto).toHaveBeenCalledTimes(3);
    for (const produto of [PHOEBUS, IBLOW, "BAFÔMETRO - MARK X PLUS"]) {
      expect(fetchResumoProduto).toHaveBeenCalledWith(produto, 2024);
      expect(fetchCentroCustoConfig).toHaveBeenCalledWith(produto, 2024);
    }
  });

  it("enquanto carrega não mostra formulário nenhum", async () => {
    fetchResumoProduto.mockReturnValue(new Promise(() => {}));
    fetchCentroCustoConfig.mockReturnValue(new Promise(() => {}));

    render(<AbaCentroCusto anoCentro={2025} setAnoCentro={vi.fn()} />);

    expect(
      screen.queryByText("1. Serviços Aduaneiros"),
    ).not.toBeInTheDocument();
    // O seletor de ano fica de pé — só o miolo é que espera.
    expect(screen.getByRole("button", { name: "2025" })).toBeInTheDocument();
  });

  it("clicar num ano avisa o pai, que é quem guarda o ano", async () => {
    const setAnoCentro = vi.fn();
    await montar({ ano: 2025, setAnoCentro });

    fireEvent.click(screen.getByRole("button", { name: "2023" }));

    expect(setAnoCentro).toHaveBeenCalledWith(2023);
  });

  it("trocar o ano refaz a busca dos três produtos no ano novo", async () => {
    fetchResumoProduto.mockResolvedValue([]);
    fetchCentroCustoConfig.mockResolvedValue(null);
    render(<Pai inicial={2025} />);
    await waitFor(() =>
      expect(screen.getByText("1. Serviços Aduaneiros")).toBeInTheDocument(),
    );
    fetchResumoProduto.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "2026" }));

    await waitFor(() =>
      expect(fetchResumoProduto).toHaveBeenCalledWith(PHOEBUS, 2026),
    );
    expect(fetchResumoProduto).toHaveBeenCalledTimes(3);
  });
});

describe("Aba Centro de Custo — configuração gravada", () => {
  it("valor de dinheiro do banco volta para o campo em formato brasileiro", async () => {
    await montar({
      config: {
        [PHOEBUS]: {
          servicos_aduaneiros: [{ mes_ano: "03/2026", valor: 1234.5, nf: "7" }],
          preco_unitario_planejado: 24500,
          estimativa_custos_variaveis_anual: 2636200,
        },
      },
    });

    expect(screen.getByPlaceholderText("221.371,58")).toHaveValue("1.234,50");
    expect(campo(/Preço unitário/)).toHaveValue("24.500,00");
    expect(campo(/Custo fixo anual da empresa/)).toHaveValue("2.636.200,00");
  });

  it("percentual do banco volta com ponto decimal, não com vírgula", async () => {
    // Assimetria de propósito registrada: dinheiro volta em pt-BR e
    // percentual volta com `String()` cru. Quem editar a tela precisa saber
    // que os dois campos não passam pelo mesmo conversor.
    await montar({
      config: {
        [PHOEBUS]: { participacao_pct: 13.9, participacao_overhead_pct: 8.5 },
      },
    });

    expect(campo(/% da NF que é deste produto/)).toHaveValue("13.9");
    expect(campo(/% deste produto no estoque/)).toHaveValue("8.5");
  });

  it("produto sem configuração abre com o formulário vazio", async () => {
    await montar({ config: {} });

    expect(screen.getByText(/Nenhuma NF adicionada/)).toBeInTheDocument();
    expect(screen.getByText(/Nenhum custo adicionado/)).toBeInTheDocument();
  });

  it("cada produto guarda o seu próprio formulário", async () => {
    await montar({
      config: {
        [PHOEBUS]: { unidades_importadas: 300 },
        [IBLOW]: { unidades_importadas: 40 },
      },
    });
    expect(campo(/Unidades importadas/)).toHaveValue("300");

    fireEvent.click(controle("iBlow 10 PRO"));

    expect(campo(/Unidades importadas/)).toHaveValue("40");
  });

  it("editar um produto não contamina o outro", async () => {
    await montar();

    digitar(/Unidades importadas/, "300");
    fireEvent.click(controle("iBlow 10 PRO"));
    expect(campo(/Unidades importadas/)).toHaveValue("");

    fireEvent.click(controle("Phoebus"));
    expect(campo(/Unidades importadas/)).toHaveValue("300");
  });
});

describe("Aba Centro de Custo — rateio das NFs de importação", () => {
  it("rateia o total das NFs pela participação e pelas unidades importadas", async () => {
    await montar();

    adicionarNF("012026", "100.000,00");
    adicionarNF("022026", "50.000,00");
    digitar(/% da NF que é deste produto/, "10");
    digitar(/Unidades importadas/, "300");

    // 150.000 × 10% ÷ 300 = 50,00.
    expect(linhaResumo("Serviços Aduaneiros")).toContain("R$ 50,00");
  });

  it("soma as NFs e mostra o total antes de ratear", async () => {
    await montar();

    adicionarNF("012026", "100.000,00");
    adicionarNF("022026", "50.000,00");

    expect(texto(screen.getByText(/Total NFs:/))).toContain("R$ 150.000,00");
  });

  it("sem participação ou sem unidades o rateio não é chutado", async () => {
    await montar();
    adicionarNF("012026", "100.000,00");

    digitar(/% da NF que é deste produto/, "10");
    expect(linhaResumo("Serviços Aduaneiros")).toContain("—");

    digitar(/% da NF que é deste produto/, "");
    digitar(/Unidades importadas/, "300");
    expect(linhaResumo("Serviços Aduaneiros")).toContain("—");
  });

  it("remover uma NF tira o valor dela da soma", async () => {
    await montar();
    adicionarNF("012026", "100.000,00");
    adicionarNF("022026", "50.000,00");

    // O botão de remover só tem ícone; é o último da linha da segunda NF.
    const linha = screen.getAllByPlaceholderText("7858")[1]
      .parentElement as HTMLElement;
    fireEvent.click(within(linha).getAllByRole("button").slice(-1)[0]);

    expect(texto(screen.getByText(/Total NFs:/))).toContain("R$ 100.000,00");
  });
});

describe("Aba Centro de Custo — rateio do overhead", () => {
  it("com quantidade a vender no ano, rateia o custo fixo ANUAL", async () => {
    await montar();

    digitar(/Custo fixo anual da empresa/, "1.200.000,00");
    digitar(/% deste produto no estoque/, "10");
    digitar(/Unidades a vender no ano/, "500");

    // 1.200.000 × 10% ÷ 500 = 240,00.
    expect(linhaResumo("Overhead")).toContain("R$ 240,00");
  });

  it("sem quantidade a vender, cai para a base MENSAL e o lote do mês", async () => {
    // `unidades_lote_mes` não tem campo na tela: só chega por configuração
    // gravada. É o caminho de cálculo que ninguém enxerga editando — e o que
    // um refactor apagaria sem perceber.
    await montar({
      config: {
        [PHOEBUS]: {
          estimativa_custos_variaveis_anual: 1200000,
          participacao_overhead_pct: 10,
          unidades_lote_mes: 100,
        },
      },
    });

    // (1.200.000 ÷ 12) × 10% ÷ 100 = 100,00 — não 240,00.
    expect(linhaResumo("Overhead")).toContain("R$ 100,00");
  });

  it("sem quantidade e sem lote o overhead fica vazio, não NaN", async () => {
    await montar();

    digitar(/Custo fixo anual da empresa/, "1.200.000,00");
    digitar(/% deste produto no estoque/, "10");

    expect(linhaResumo("Overhead")).toContain("—");
    expect(linhaResumo("Overhead")).not.toContain("NaN");
  });

  it("sem percentual de estoque não há overhead", async () => {
    await montar();

    digitar(/Custo fixo anual da empresa/, "1.200.000,00");
    digitar(/Unidades a vender no ano/, "500");

    expect(linhaResumo("Overhead")).toContain("—");
  });
});

describe("Aba Centro de Custo — custo, margem e projeção", () => {
  it("o custo total soma aduaneiro, direto e overhead", async () => {
    await montar();
    preencherCenarioFechado();

    expect(linhaResumo("Serviços Aduaneiros")).toContain("R$ 50,00");
    expect(linhaResumo("Custos Diretos")).toContain("R$ 250,00");
    expect(linhaResumo("Overhead")).toContain("R$ 240,00");
    expect(linhaResumo("Custo Total")).toContain("R$ 540,00");
  });

  it("o ticket médio do sistema é a receita dividida pela quantidade vendida", async () => {
    await montar({
      resumo: {
        [PHOEBUS]: [
          { receita: 600_000, quantidade: 60 },
          { receita: 400_000, quantidade: 40 },
        ],
      },
    });

    // 1.000.000 ÷ 100 = 10.000,00.
    expect(linhaResumo("Receita Real")).toContain("R$ 1.000.000,00");
    expect(linhaResumo("Qtd Vendida")).toContain("100 un");
    expect(linhaResumo("Ticket Médio")).toContain("R$ 10.000,00");
  });

  it("produto sem venda no ano não inventa ticket médio", async () => {
    // A busca respondida com lista vazia dá um resumo zerado, não ausente:
    // receita e quantidade aparecem como zero, e é o ticket — que divide por
    // essa quantidade — que se recusa a existir.
    await montar({ resumo: {} });

    expect(linhaResumo("Receita Real")).toContain("R$ 0,00");
    expect(linhaResumo("Qtd Vendida")).toContain("0 un");
    expect(linhaResumo("Ticket Médio")).toContain("—");
  });

  it("a margem é o ticket do sistema menos o custo total", async () => {
    await montar({
      resumo: { [PHOEBUS]: [{ receita: 1_000_000, quantidade: 100 }] },
    });
    preencherCenarioFechado();

    // 10.000,00 − 540,00 = 9.460,00 · 94,6%.
    expect(linhaResumo("Margem / unidade")).toContain("R$ 9.460,00");
    expect(linhaResumo("Margem %")).toContain("94.6%");
  });

  it("preço manual substitui o ticket do sistema e se anuncia", async () => {
    await montar({
      resumo: { [PHOEBUS]: [{ receita: 1_000_000, quantidade: 100 }] },
    });
    preencherCenarioFechado();

    digitar(/Preço unitário/, "1.000,00");

    expect(linhaResumo("Ticket Médio")).toContain("R$ 10.000,00");
    // 1.000,00 − 540,00 = 460,00 · 46%.
    expect(linhaResumo("Margem / unidade")).toContain("R$ 460,00");
    expect(linhaResumo("Margem %")).toContain("46.0%");
    expect(screen.getAllByText("MANUAL").length).toBeGreaterThan(0);
  });

  it("sem custo nenhum a margem fica vazia, mesmo com preço", async () => {
    // O guarda é `custoTotalPorUn > 0`: sem custo, "margem = preço" seria
    // uma margem de 100% que ninguém apurou.
    await montar();
    digitar(/Preço unitário/, "1.000,00");

    expect(linhaResumo("Margem / unidade")).toContain("—");
    expect(screen.queryByText("Margem %")).not.toBeInTheDocument();
  });

  it("a projeção usa a quantidade planejada quando existe", async () => {
    await montar({
      resumo: { [PHOEBUS]: [{ receita: 1_000_000, quantidade: 100 }] },
    });
    preencherCenarioFechado();
    digitar(/Preço unitário/, "1.000,00");

    // 500 unidades planejadas × 1.000,00 = 500.000,00 de receita projetada;
    // margem 460,00 × 500 = 230.000,00.
    expect(texto(screen.getByText(/Projeção —/))).toContain("500 un (manual)");
    expect(linhaResumo("Receita Projetada")).toContain("R$ 500.000,00");
    expect(linhaResumo("Margem Total")).toContain("R$ 230.000,00");
  });

  it("sem quantidade planejada a projeção cai para a quantidade vendida", async () => {
    await montar({
      resumo: { [PHOEBUS]: [{ receita: 1_000_000, quantidade: 100 }] },
    });
    adicionarCustoDireto("Produto", "250,00");

    // 100 unidades vendidas × ticket 10.000,00 = 1.000.000,00.
    expect(texto(screen.getByText(/Projeção —/))).toContain("100 un (sistema)");
    expect(linhaResumo("Receita Projetada")).toContain("R$ 1.000.000,00");
  });

  it("sem quantidade nenhuma não há projeção", async () => {
    await montar({ resumo: {} });
    adicionarCustoDireto("Produto", "250,00");
    digitar(/Preço unitário/, "1.000,00");

    expect(screen.queryByText(/Projeção —/)).not.toBeInTheDocument();
  });
});

describe("Aba Centro de Custo — leitura de número digitado", () => {
  it("vírgula é decimal e o ponto é milhar", async () => {
    await montar();

    adicionarCustoDireto("Produto", "1.234,56");

    expect(linhaResumo("Custos Diretos")).toContain("R$ 1.234,56");
  });

  it("sem vírgula, o ponto é decimal — é assim que o percentual chega", async () => {
    // Os campos de dinheiro nunca veem um ponto: a máscara o remove antes.
    // Quem exercita esse ramo do parse é o **percentual**, que não tem
    // máscara nenhuma e volta do banco como "13.9". Lido como milhar viraria
    // 139% e multiplicaria o rateio por dez.
    await montar({
      config: {
        [PHOEBUS]: {
          servicos_aduaneiros: [{ mes_ano: "03/2026", valor: 150000, nf: "1" }],
          participacao_pct: 13.9,
          unidades_importadas: 300,
        },
      },
    });

    // 150.000 × 13,9% ÷ 300 = 69,50 — e não 695,00, que é o que daria com
    // o ponto lido como separador de milhar.
    expect(linhaResumo("Serviços Aduaneiros")).toContain("R$ 69,50");
  });

  // Era o defeito 3 da tela: a máscara e o parse discordavam sobre o que é um
  // ponto. A máscara ESCREVE ponto de milhar ("1234567" → "1.234.567") e o
  // `n()` só o tratava como milhar quando havia vírgula, então
  // `parseFloat("1.234.567")` parava no primeiro ponto e todo valor inteiro
  // digitado sem centavos entrava na conta dividido por mil. Agora as duas
  // pontas são do `src/lib/dinheiro.ts` e concordam por construção.
  it("o valor que o campo mostra é o valor que entra na conta", async () => {
    await montar();

    adicionarCustoDireto("Produto", "1234567");

    expect(screen.getAllByPlaceholderText("0,00")[0]).toHaveValue("1.234.567");
    expect(linhaResumo("Custos Diretos")).toContain("R$ 1.234.567,00");
  });

  it("ponto digitado é milhar, e a conta segue o que ficou no campo", async () => {
    // A máscara descarta o ponto e agrupa o milhar: quem digita "825.55" fica
    // com "82.555" no campo, e é isso que entra na conta — oitenta e dois mil
    // e quinhentos e cinquenta e cinco. O separador decimal aqui é a vírgula.
    // Antes o campo dizia uma coisa ("82.555") e a conta usava outra (82,56).
    await montar();

    adicionarCustoDireto("Produto", "825.55");

    expect(screen.getAllByPlaceholderText("0,00")[0]).toHaveValue("82.555");
    expect(linhaResumo("Custos Diretos")).toContain("R$ 82.555,00");
  });

  it("com centavos digitados a leitura fecha certa", async () => {
    // A vírgula é o que salva: com ela o parse trata os pontos como milhar.
    await montar();

    adicionarCustoDireto("Produto", "1234567,89");

    expect(linhaResumo("Custos Diretos")).toContain("R$ 1.234.567,89");
  });

  it("campo vazio vale zero, não NaN", async () => {
    await montar();

    adicionarCustoDireto("Produto", "");

    expect(linhaResumo("Custos Diretos")).toContain("—");
  });
});

describe("Aba Centro de Custo — máscaras de digitação", () => {
  it("a data da NF ganha a barra sozinha e para em seis dígitos", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar NF/ }));
    const data = screen.getByPlaceholderText("03/2026");

    fireEvent.change(data, { target: { value: "0320261234" } });

    expect(data).toHaveValue("03/2026");
  });

  it("o valor da NF ganha separador de milhar e preserva o decimal", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar NF/ }));
    const valor = screen.getByPlaceholderText("221.371,58");

    fireEvent.change(valor, { target: { value: "1234567" } });
    expect(valor).toHaveValue("1.234.567");

    fireEvent.change(valor, { target: { value: "1234,5" } });
    expect(valor).toHaveValue("1.234,5");
  });

  it("a máscara de dinheiro descarta letra digitada", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar NF/ }));
    const valor = screen.getByPlaceholderText("221.371,58");

    fireEvent.change(valor, { target: { value: "12a34" } });

    expect(valor).toHaveValue("1.234");
  });
});

describe("Aba Centro de Custo — gravação", () => {
  it("grava o produto e o ano da aba, com os números convertidos", async () => {
    await montar({ ano: 2024 });
    preencherCenarioFechado();

    fireEvent.click(
      screen.getByRole("button", { name: /Salvar configuração/ }),
    );

    await waitFor(() => expect(salvarCentroCustoConfig).toHaveBeenCalled());
    expect(salvarCentroCustoConfig).toHaveBeenCalledWith({
      produto: PHOEBUS,
      ano: 2024,
      cmv_unitario: null,
      frete_unitario: null,
      outros_custos_unitario: null,
      config_json: {
        servicos_aduaneiros: [
          { mes_ano: "01/2026", valor: 100000, nf: "111" },
          { mes_ano: "02/2026", valor: 50000, nf: "222" },
        ],
        participacao_pct: 10,
        unidades_importadas: 300,
        custos_diretos: [{ descricao: "Produto", valor: 250 }],
        estimativa_custos_variaveis_anual: 1200000,
        participacao_overhead_pct: 10,
        unidades_lote_mes: null,
        quantidade_planejada: 500,
        preco_unitario_planejado: null,
      },
    });
  });

  it("grava o produto da aba aberta, não o primeiro da lista", async () => {
    await montar();
    fireEvent.click(controle("iBlow 10 PRO"));

    fireEvent.click(
      screen.getByRole("button", { name: /Salvar configuração/ }),
    );

    await waitFor(() => expect(salvarCentroCustoConfig).toHaveBeenCalled());
    expect(salvarCentroCustoConfig.mock.calls[0][0].produto).toBe(IBLOW);
  });

  it("confirma a gravação e volta ao normal depois de 2,5 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await montar();

    fireEvent.click(
      screen.getByRole("button", { name: /Salvar configuração/ }),
    );
    await waitFor(() =>
      expect(screen.getByText(/Configuração salva!/)).toBeInTheDocument(),
    );

    // O `setTimeout` do componente muda estado fora de um evento do React;
    // sem o `act` o avanço do relógio não chega a rerenderizar.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(screen.queryByText(/Configuração salva!/)).not.toBeInTheDocument();
  });

  it("erro da API aparece na tela com o detalhe que ela mandou", async () => {
    salvarCentroCustoConfig.mockRejectedValue({
      response: { data: { detail: "Ano fechado para lançamento." } },
    });
    await montar();

    fireEvent.click(
      screen.getByRole("button", { name: /Salvar configuração/ }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(/Ano fechado para lançamento\./),
      ).toBeInTheDocument(),
    );
  });

  it("erro sem detalhe da API cai na mensagem do próprio erro", async () => {
    salvarCentroCustoConfig.mockRejectedValue(new Error("Network Error"));
    await montar();

    fireEvent.click(
      screen.getByRole("button", { name: /Salvar configuração/ }),
    );

    await waitFor(() =>
      expect(screen.getByText(/Network Error/)).toBeInTheDocument(),
    );
  });

  it("o botão fica travado enquanto a gravação está em curso", async () => {
    let liberar: (v: unknown) => void = () => {};
    salvarCentroCustoConfig.mockReturnValue(
      new Promise((resolve) => {
        liberar = resolve;
      }),
    );
    await montar();
    const botao = screen.getByRole("button", { name: /Salvar configuração/ });

    fireEvent.click(botao);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Salvando/ })).toBeDisabled(),
    );
    liberar({});
  });
});
