import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AbaMeta from "./AbaMeta";

/**
 * Teste de caracterização da aba Meta do Gerenciamento Financeiro.
 *
 * Fixa o comportamento que existia ANTES da migração para o design system.
 * A regra de bonificação não está escrita em lugar nenhum além deste
 * componente: a leitura da chave META, a divisão por 4 para virar base
 * trimestral, e principalmente a **interpolação do multiplicador**, que muda
 * de inclinação em 85% (0,9 aos 55% · 1,2 aos 85% · 1,4 aos 100%). Um
 * refactor que "simplifique" a interpolação para uma reta só muda o PL que a
 * empresa inteira recebe — e muda em silêncio, porque as âncoras continuam
 * batendo. As faixas do meio são o que prova a quebra.
 *
 * Tudo é observado pelo componente renderizado, nunca por função exportada de
 * propósito para o teste: assim o teste sobrevive a quebrar a aba em
 * componentes, que é exatamente o passo seguinte. Os seletores sobem do rótulo
 * até o cartão pelo conteúdo (`Alvo:`), não por classe nem por profundidade de
 * `div`, para que a migração troque a marcação sem reescrever o teste.
 */

const estadoDashboard = vi.hoisted(() => ({
  atual: {
    total: 0,
    totalAno: 0,
    dados: [] as { mes: string; total: number }[],
    carregando: false,
  },
}));
vi.mock("../../context/DashboardContext", () => ({
  useDashboard: () => estadoDashboard.atual,
}));

const editarConfiguracao = vi.hoisted(() => vi.fn());
const estadoConfiguracoes = vi.hoisted(() => ({
  atual: [] as { id: number; chave: string; valor: string }[],
}));
vi.mock("../../context/ConfiguracoesContext", () => ({
  useConfiguracoes: () => ({
    configuracoes: estadoConfiguracoes.atual,
    carregando: false,
    editarConfiguracao,
    criarConfiguracao: vi.fn(),
  }),
}));

interface Cenario {
  /** Valor cru da chave META, como vem da tabela de configurações. */
  meta?: string;
  /** Faturamento do TRIMESTRE em apuração — a base do PL. */
  total?: number;
  /** Faturamento do ano corrente, só exibido. */
  totalAno?: number;
  /** Meses que compõem o trimestre. */
  dados?: { mes: string; total: number }[];
  carregando?: boolean;
  /** Prop vinda da Visão Geral: faturamento do ano anterior. */
  faturamentoAnoAnterior?: number;
  anoAnterior?: number;
}

function montar(cenario: Cenario = {}) {
  estadoDashboard.atual = {
    total: cenario.total ?? 0,
    totalAno: cenario.totalAno ?? 0,
    dados: cenario.dados ?? [],
    carregando: cenario.carregando ?? false,
  };
  estadoConfiguracoes.atual =
    cenario.meta === undefined
      ? []
      : [{ id: 1, chave: "META", valor: cenario.meta }];

  return render(
    <AbaMeta
      faturamentoAnoAnterior={cenario.faturamentoAnoAnterior}
      anoAnterior={cenario.anoAnterior}
    />,
  );
}

/**
 * Texto de um elemento com o espaço normalizado.
 *
 * O `Intl` formata moeda com espaço duro (U+00A0) entre `R$` e o número, e o
 * `textContent` cru o entrega assim — `toContain("R$ 900.000,00")` com espaço
 * comum falharia contra um texto que na tela é idêntico. O `getByText` já
 * normaliza sozinho; aqui, que se lê o texto na mão, normaliza-se igual.
 */
function texto(el: HTMLElement | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ");
}

/**
 * O cartão de uma faixa de bonificação.
 *
 * Sobe do rótulo `Bônus 55%` até o primeiro ancestral que já contém o alvo —
 * é o cartão inteiro, seja ele `div`, `li` ou primitivo do design system.
 */
function faixa(bonus: number): HTMLElement {
  let el: HTMLElement | null = screen.getByText(`Bônus ${bonus}%`);
  while (el && !(el.textContent ?? "").includes("Alvo:")) {
    el = el.parentElement;
  }
  if (!el) throw new Error(`cartão da faixa ${bonus}% não encontrado`);
  return el;
}

/** Texto do bloco de um rótulo de cartão de resumo (ex.: "Bônus Atual"). */
function cartao(rotulo: string): string {
  return texto(screen.getByText(rotulo).parentElement);
}

/** META anual de quatro milhões → base trimestral de um milhão redondo. */
const META_4M = "4.000.000,00";

beforeEach(() => {
  editarConfiguracao.mockReset();
  editarConfiguracao.mockResolvedValue(undefined);
});

describe("Aba Meta — leitura da META e a base trimestral", () => {
  it("divide a META anual por 4 para chegar na base do trimestre", () => {
    montar({ meta: META_4M });

    expect(texto(screen.getByText(/O valor da META é/))).toContain(
      "META ÷ 4 = R$ 1.000.000,00",
    );
  });

  it("o cartão de meta máxima do trimestre é a base vezes 1,4", () => {
    montar({ meta: META_4M });

    // 4.000.000 ÷ 4 = 1.000.000 · × 1,4 = 1.400.000.
    expect(cartao("Meta 100% (trimestre)")).toContain("R$ 1.400.000,00");
  });

  // Os formatos que a chave META já teve na tabela de configurações. Todos
  // representam quatro milhões, e todos têm que dar a MESMA base trimestral.
  const QUATRO_MILHOES = [
    ["ponto decimal americano", "4000000.00"],
    ["milhar com ponto e decimal com vírgula", "4.000.000,00"],
    ["decimal com vírgula, sem milhar", "4000000,00"],
    ["milhar com ponto, sem decimal", "4.000.000"],
    ["inteiro sem separador nenhum", "4000000"],
    ["com o símbolo da moeda na frente", "R$ 4.000.000,00"],
  ];

  it.each(QUATRO_MILHOES)(
    "aceita META em %s e chega no mesmo alvo de 55%%",
    (_rotulo, valor) => {
      montar({ meta: valor });

      // 1.000.000 × 0,9 = 900.000.
      expect(texto(faixa(55))).toContain("R$ 900.000,00");
    },
  );

  it("sem a chave META na configuração, nenhuma faixa é batida nem com faturamento", () => {
    // O guarda é `alvo > 0`: alvo zerado não conta como meta atingida, senão
    // a empresa inteira apareceria com PL de 100% no dia em que a chave
    // sumisse da tabela.
    montar({ meta: undefined, total: 5_000_000 });

    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(
      screen.getByText("nenhuma faixa atingida ainda"),
    ).toBeInTheDocument();
  });

  it("META com texto que não é número vira zero, não NaN", () => {
    montar({ meta: "a definir", total: 0 });

    expect(texto(faixa(55))).toContain("R$ 0,00");
    expect(texto(faixa(55))).not.toContain("NaN");
  });
});

describe("Aba Meta — as dez faixas e o multiplicador", () => {
  it("renderiza as dez faixas, de 55% a 100%, de 5 em 5", () => {
    montar({ meta: META_4M });

    const rotulos = screen
      .getAllByText(/^Bônus \d+%$/)
      .map((el) => el.textContent);

    expect(rotulos).toEqual([
      "Bônus 55%",
      "Bônus 60%",
      "Bônus 65%",
      "Bônus 70%",
      "Bônus 75%",
      "Bônus 80%",
      "Bônus 85%",
      "Bônus 90%",
      "Bônus 95%",
      "Bônus 100%",
    ]);
  });

  it("as três âncoras da curva são 0,9 · 1,2 · 1,4", () => {
    montar({ meta: META_4M });

    expect(texto(faixa(55))).toContain("R$ 900.000,00");
    expect(texto(faixa(85))).toContain("R$ 1.200.000,00");
    expect(texto(faixa(100))).toContain("R$ 1.400.000,00");
  });

  it("abaixo de 85% a curva sobe 0,05 a cada faixa", () => {
    montar({ meta: META_4M });

    // 0,9 · 0,95 · 1,0 · 1,05 · 1,1 · 1,15 · 1,2
    expect(texto(faixa(60))).toContain("R$ 950.000,00");
    expect(texto(faixa(65))).toContain("R$ 1.000.000,00");
    expect(texto(faixa(70))).toContain("R$ 1.050.000,00");
    expect(texto(faixa(75))).toContain("R$ 1.100.000,00");
    expect(texto(faixa(80))).toContain("R$ 1.150.000,00");
  });

  it("acima de 85% a curva muda de inclinação e sobe 0,0666 por faixa", () => {
    // Esta é a asserção que uma "simplificação" para uma reta só derruba: com
    // reta única de 55→100 a faixa de 90% daria 1,2667 apenas por coincidência
    // se as âncoras fossem outras. Aqui o número é o da curva de dois trechos.
    montar({ meta: META_4M });

    expect(texto(faixa(90))).toContain("R$ 1.266.666,67");
    expect(texto(faixa(95))).toContain("R$ 1.333.333,33");
  });

  it("cada faixa mostra o próprio multiplicador sobre a META÷4", () => {
    montar({ meta: META_4M });

    expect(texto(faixa(55))).toContain("0,9× META÷4");
    expect(texto(faixa(65))).toContain("1,0× META÷4");
    expect(texto(faixa(90))).toContain("1,2667× META÷4");
    expect(texto(faixa(100))).toContain("1,4× META÷4");
  });
});

describe("Aba Meta — o PL apurado", () => {
  it("faturamento exatamente no alvo já conta como faixa batida", () => {
    // `>=`, não `>`: bater a meta na régua não pode virar meta não batida.
    montar({ meta: META_4M, total: 900_000 });

    expect(cartao("Bônus Atual")).toContain("55%");
    expect(texto(faixa(55))).toContain("Meta atingida");
  });

  it("um centavo abaixo do alvo ainda não bate a faixa", () => {
    montar({ meta: META_4M, total: 899_999.99 });

    expect(cartao("Bônus Atual")).toContain("—");
    expect(texto(faixa(55))).toContain("Faltam");
  });

  it("o PL é a faixa MAIS ALTA batida, não a primeira", () => {
    // 1.100.000 bate 55, 60, 65, 70 e 75 — o PL é 75%.
    montar({ meta: META_4M, total: 1_100_000 });

    expect(
      texto(
        screen.getByText(/PL que os funcionários vão receber/).parentElement,
      ),
    ).toContain("75%");
    expect(cartao("Bônus Atual")).toContain("75%");
  });

  it("a próxima faixa é a primeira não batida, com o quanto falta", () => {
    montar({ meta: META_4M, total: 1_100_000 });

    // Próxima é 80%, alvo 1.150.000 → faltam 50.000.
    expect(cartao("Próxima Faixa")).toContain("80%");
    expect(cartao("Próxima Faixa")).toContain("Faltam R$ 50.000,00");
    expect(
      texto(screen.getByText("Faturamento do trimestre").parentElement),
    ).toContain("Faltam R$ 50.000,00 para 80%");
  });

  it("sem faturamento nenhum o PL é zero e a próxima faixa é a de 55%", () => {
    montar({ meta: META_4M, total: 0 });

    expect(
      texto(
        screen.getByText(/PL que os funcionários vão receber/).parentElement,
      ),
    ).toContain("nenhuma faixa atingida ainda");
    expect(cartao("Próxima Faixa")).toContain("55%");
  });

  it("com todas as faixas batidas a próxima vira o troféu de 100%", () => {
    montar({ meta: META_4M, total: 1_500_000 });

    // Mudança deliberada na migração: o original escrevia "100% ✅", e o
    // checklist da tela migrada proíbe emoji no papel de ícone. Quem conta
    // que todas foram batidas é a nota, logo abaixo.
    expect(cartao("Próxima Faixa")).toContain("100%");
    expect(cartao("Próxima Faixa")).not.toContain("✅");
    expect(cartao("Próxima Faixa")).toContain("Todas as metas batidas!");
    // E o destaque para de oferecer "faltam X para".
    expect(
      texto(screen.getByText("Faturamento do trimestre").parentElement),
    ).not.toContain("Faltam");
  });
});

describe("Aba Meta — barra de progresso", () => {
  it("o progresso é a fração do alvo, com uma casa", () => {
    montar({ meta: META_4M, total: 1_100_000 });

    // 1.100.000 ÷ 1.150.000 = 95,652…% → 95.7%
    expect(texto(faixa(80))).toContain("95.7%");
  });

  it("o progresso é capado em 100% quando o faturamento passa do alvo", () => {
    // Sem o cap a barra de 55% mostraria 166,7% e vazaria do trilho.
    montar({ meta: META_4M, total: 1_500_000 });

    expect(texto(faixa(55))).toContain("100.0%");
    expect(texto(faixa(55))).not.toContain("166");
  });

  it("com META zerada o progresso é zero, não divisão por zero", () => {
    montar({ meta: "0", total: 1_000_000 });

    expect(texto(faixa(55))).toContain("0.0%");
    expect(texto(faixa(55))).not.toContain("Infinity");
    expect(texto(faixa(55))).not.toContain("NaN");
  });
});

describe("Aba Meta — projeção anual e crescimento vs ano passado", () => {
  it("a projeção anual é a META ANUAL vezes o multiplicador, não a trimestral", () => {
    montar({ meta: META_4M, faturamentoAnoAnterior: 4_000_000 });

    // 4.000.000 × 1,4 = 5.600.000 — não 1.000.000 × 1,4.
    expect(texto(faixa(100))).toContain("R$ 5.600.000,00");
    expect(texto(faixa(90))).toContain("R$ 5.066.666,67");
  });

  it("o crescimento compara a projeção anual com o ano passado, em duas casas", () => {
    montar({ meta: META_4M, faturamentoAnoAnterior: 4_000_000 });

    // (5.600.000 − 4.000.000) ÷ 4.000.000 = +40%.
    expect(texto(faixa(100))).toContain("+40.00% vs ano passado");
  });

  it("projeção abaixo do ano passado aparece negativa", () => {
    montar({ meta: META_4M, faturamentoAnoAnterior: 5_000_000 });

    // (3.600.000 − 5.000.000) ÷ 5.000.000 = −28%.
    expect(texto(faixa(55))).toContain("-28.00% vs ano passado");
  });

  it("sem faturamento do ano passado a linha de crescimento some", () => {
    montar({ meta: META_4M, faturamentoAnoAnterior: 0 });

    expect(texto(faixa(100))).not.toContain("vs ano passado");
  });

  it("mostra o ano de comparação e o valor recebido da Visão Geral", () => {
    montar({
      meta: META_4M,
      faturamentoAnoAnterior: 3_210_000,
      anoAnterior: 2025,
    });

    const bloco = screen.getByText(/Faturamento do Ano Passado/).parentElement;
    expect(texto(bloco)).toContain("R$ 3.210.000,00");
    expect(texto(bloco)).toContain("ano 2025 · calculado da Visão Geral");
  });

  it("sem o ano informado o rótulo não inventa número", () => {
    montar({ meta: META_4M, faturamentoAnoAnterior: 3_210_000 });

    const bloco = screen.getByText(/Faturamento do Ano Passado/).parentElement;
    expect(texto(bloco)).toContain("calculado da Visão Geral");
    expect(texto(bloco)).not.toContain("ano undefined");
  });
});

describe("Aba Meta — edição da META no lugar", () => {
  /** Abre o editor da META e devolve o campo de texto. */
  function abrirEditor(): HTMLElement {
    fireEvent.click(screen.getByTitle("Editar"));
    return screen.getByRole("textbox");
  }

  it("o editor abre já preenchido com o valor atual em formato brasileiro", () => {
    montar({ meta: META_4M });

    expect(abrirEditor()).toHaveValue("4.000.000,00");
  });

  it("salvar manda a chave META com ponto decimal e duas casas", () => {
    montar({ meta: META_4M });
    const campo = abrirEditor();

    fireEvent.change(campo, { target: { value: "5.500.000,50" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));

    expect(editarConfiguracao).toHaveBeenCalledWith("META", "5500000.50");
  });

  it("valor zerado ou negativo é recusado sem chamar a API", () => {
    montar({ meta: META_4M });
    const campo = abrirEditor();

    fireEvent.change(campo, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));

    expect(
      screen.getByText("Informe um valor válido maior que zero."),
    ).toBeInTheDocument();
    expect(editarConfiguracao).not.toHaveBeenCalled();
  });

  it("falha ao salvar mantém o editor aberto e avisa", async () => {
    const console_error = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    editarConfiguracao.mockRejectedValue(new Error("500"));
    montar({ meta: META_4M });
    const campo = abrirEditor();

    fireEvent.change(campo, { target: { value: "5.000.000,00" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));

    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível salvar. Tente novamente."),
      ).toBeInTheDocument(),
    );
    // O campo continua em edição — o valor digitado não se perde.
    expect(screen.getByRole("textbox")).toHaveValue("5.000.000,00");
    console_error.mockRestore();
  });

  it("fechar o editor descarta o rascunho sem salvar", () => {
    montar({ meta: META_4M });
    const bloco = screen.getByText(/META Anual/).parentElement as HTMLElement;
    fireEvent.click(screen.getByTitle("Editar"));

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "9.999.999,99" },
    });
    // O botão de fechar só tem ícone: é o último dos três do bloco em edição.
    const botoes = within(bloco).getAllByRole("button");
    fireEvent.click(botoes[botoes.length - 1]);

    expect(editarConfiguracao).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(bloco).getByText("R$ 4.000.000,00")).toBeInTheDocument();
  });
});

describe("Aba Meta — carregando e composição do trimestre", () => {
  it("enquanto carrega não mostra faixa nenhuma", () => {
    montar({ meta: META_4M, carregando: true });

    expect(screen.getByText(/Carregando dados de meta/)).toBeInTheDocument();
    expect(screen.queryByText("Bônus 55%")).not.toBeInTheDocument();
  });

  it("os meses do trimestre aparecem com o valor de cada um", () => {
    montar({
      meta: META_4M,
      dados: [
        { mes: "Jul", total: 400_000 },
        { mes: "Ago", total: 700_000 },
      ],
    });

    const bloco = screen.getByText("Composição do trimestre")
      .parentElement as HTMLElement;
    expect(texto(bloco)).toContain("Jul: R$ 400.000,00");
    expect(texto(bloco)).toContain("Ago: R$ 700.000,00");
  });

  it("sem meses no trimestre a composição some", () => {
    montar({ meta: META_4M, dados: [] });

    expect(
      screen.queryByText("Composição do trimestre"),
    ).not.toBeInTheDocument();
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
