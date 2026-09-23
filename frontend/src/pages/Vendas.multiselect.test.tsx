import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Vendas from "./Vendas";

/**
 * Caracterização do MultiSelect COMO ELE VIVE em Vendas.
 *
 * Mesmo molde de `Vendedores.multiselect.test.tsx` (Task 3): dublês de
 * `useAuth` e `useData` em vez dos providers de verdade, porque o alvo é o
 * MultiSelect, não a integração com o backend. Vendas tem três filtros
 * ("Todas as empresas", "Todos os vendedores", "Todos os produtos") e dois
 * campos com o placeholder "Pesquisar..." — o do dropdown de empresas e o da
 * tabela —, então o teste escopa a busca pelo container do filtro
 * (`containerDoFiltro`/`campoDeBusca`) em vez de pegar "o primeiro da
 * página": isso funciona hoje só por acidente de layout, e se a extração
 * para primitivo montar o painel num portal o teste passaria a ler o campo
 * errado seguindo verde.
 *
 * O filtro de empresas (`empresasUnicas`, ~linha 167) carrega
 * `"Alfa Mineração (11.222.333/0001-44)"`, e o MultiSelect daqui extrai o
 * CNPJ **de dentro dos parênteses** (`option.match(/\((.*?)\)/)`), igual a
 * Vendedores — não da opção inteira como em Servicos/Produtos. E a
 * normalização do termo digitado só roda quando ele é **todo dígito**
 * (`/^\d+$/.test(searchTerm)`) — por isso "a11" não vira busca numérica.
 */
// A tela pede o toast para avisar falha de exportação; o assunto deste
// arquivo é outro, então o dublê só precisa existir.
vi.mock("../components/ToastProvider", () => ({
  useToast: () => ({
    sucesso: vi.fn(),
    erro: vi.fn(),
    aviso: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const { NOTAS_VENDAS } = vi.hoisted(() => ({
  NOTAS_VENDAS: [
    {
      id: 1,
      data_emissao: "2026-01-10",
      valor_nota: 1000,
      cliente: { nome: "Alfa Mineração", cpf_cnpj: "11.222.333/0001-44" },
      nome_vendedor: "Vendedor A",
      itens: [
        {
          descricao: "Bafômetro Phoebus",
          quantidade: "2",
          valor_total: "1000",
        },
      ],
      tem_observacoes: false,
    },
    {
      id: 2,
      data_emissao: "2026-02-10",
      valor_nota: 500,
      cliente: { nome: "Beta Logística", cpf_cnpj: "55.666.777/0001-88" },
      nome_vendedor: "Vendedor A",
      itens: [
        { descricao: "Tubo descartável", quantidade: "10", valor_total: "500" },
      ],
      tem_observacoes: false,
    },
  ],
}));

// A tela deixou de ler o `DataContext` (item 9.4): os agregados vêm somados do
// banco e a tabela vem paginada. O falso mora em `comercial/hooksFalsos` e é
// compartilhado pelos três arquivos de teste desta tela.
vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { criarHooksFalsos } = await import("./comercial/hooksFalsos");
  return { ...real, ...criarHooksFalsos(NOTAS_VENDAS) };
});

/**
 * Dublê do recharts.
 *
 * Em jsdom o `ResponsiveContainer` mede 0x0 e o recharts de verdade não
 * desenha nada — os gráficos de Vendas ficariam invisíveis ao teste sem
 * quebrar (recharts engole a falta de tamanho em silêncio). Como este teste
 * não olha para gráfico nenhum, o dublê só precisa devolver algo renderizável
 * para cada peça importada, sem reproduzir o comportamento real delas.
 */
vi.mock("recharts", () => {
  const semDesenho = () => null;
  return {
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    BarChart: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    LineChart: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    PieChart: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Bar: semDesenho,
    Line: semDesenho,
    Pie: semDesenho,
    Cell: semDesenho,
    XAxis: semDesenho,
    YAxis: semDesenho,
    Tooltip: semDesenho,
    CartesianGrid: semDesenho,
    Legend: semDesenho,
  };
});

/** Abre o dropdown de um filtro pelo rótulo e pelo texto do botão fechado. */
function abrir(rotulo: string, valor: string) {
  fireEvent.click(screen.getByRole("button", { name: `${rotulo} ${valor}` }));
}

/**
 * O container `<div className="relative flex flex-col gap-1.5" ref={ref}>` de
 * um filtro — o rótulo, o botão fechado e o painel do dropdown são irmãos
 * dentro dele.
 *
 * O nome acessível do gatilho é `aria-labelledby` do rótulo mais o valor, por
 * isso a busca compõe os dois: o texto do botão sozinho não casa mais.
 */
function containerDoFiltro(rotulo: string, valor: string): HTMLElement {
  const nomeDoBotao = `${rotulo} ${valor}`;
  const botao = screen.getByRole("button", { name: nomeDoBotao });
  const container = botao.parentElement;
  if (!container) {
    throw new Error(`container do filtro "${nomeDoBotao}" nao encontrado`);
  }
  return container as HTMLElement;
}

/**
 * O campo de busca DAQUELE dropdown.
 *
 * Escopado pelo container do filtro, e não pela ordem na página: Vendas tem
 * dois campos com o placeholder "Pesquisar..." — este e o da tabela de
 * notas —, e pegar "o primeiro" depende de a seção de filtros vir antes da
 * tabela no JSX. Se a extração para primitivo montar o painel num portal, "o
 * primeiro" passa a ser o campo da tabela e o teste seguiria verde testando
 * a coisa errada.
 */
function campoDeBusca(rotulo: string, valor: string): HTMLElement {
  return within(containerDoFiltro(rotulo, valor)).getByPlaceholderText(
    "Pesquisar...",
  );
}

describe("MultiSelect em Vendas", () => {
  it("o botão fechado mostra o placeholder e, depois, quantos foram escolhidos", () => {
    render(<Vendas />);

    abrir("Empresas", "Todas as empresas");
    fireEvent.click(screen.getByRole("checkbox", { name: /Alfa Mineração/ }));

    expect(
      screen.getByRole("button", { name: "Empresas 1 selecionado(s)" }),
    ).toBeInTheDocument();
  });

  it("a busca filtra a lista por texto", () => {
    render(<Vendas />);
    abrir("Empresas", "Todas as empresas");

    fireEvent.change(campoDeBusca("Empresas", "Todas as empresas"), {
      target: { value: "beta" },
    });

    expect(
      screen.getByRole("checkbox", { name: /Beta Logística/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: /Alfa/ }),
    ).not.toBeInTheDocument();
  });

  it("sem resultado, diz que não achou", () => {
    render(<Vendas />);
    abrir("Empresas", "Todas as empresas");

    fireEvent.change(campoDeBusca("Empresas", "Todas as empresas"), {
      target: { value: "gama" },
    });

    expect(screen.getByText("Nenhum resultado encontrado")).toBeInTheDocument();
  });

  // ── COMPORTAMENTO IDÊNTICO A VENDEDORES ──────────────────────────────────
  // Em Servicos o MultiSelect normaliza a OPÇÃO INTEIRA tirando os
  // não-dígitos; em Produtos a busca por CNPJ sem pontuação não acha nada.
  // Vendas faz o mesmo que Vendedores: extrai só o trecho entre parênteses
  // (`option.match(/\((.*?)\)/)`) como CNPJ e normaliza SÓ ele — por isso
  // acha a empresa pelo CNPJ digitado sem pontuação.
  it("acha pelo CNPJ que está entre parênteses, digitado sem pontuação", () => {
    render(<Vendas />);
    abrir("Empresas", "Todas as empresas");

    fireEvent.change(campoDeBusca("Empresas", "Todas as empresas"), {
      target: { value: "11222333" },
    });

    expect(
      screen.getByRole("checkbox", { name: /Alfa Mineração/ }),
    ).toBeInTheDocument();
  });

  // A normalização do termo digitado só acontece quando ele é todo dígito
  // (`/^\d+$/.test(searchTerm)`): "a11" procura o texto "a11" mesmo, e não o
  // número 11 — não vira busca numérica por ter um dígito dentro.
  it("termo com letra não vira busca numérica", () => {
    render(<Vendas />);
    abrir("Empresas", "Todas as empresas");

    fireEvent.change(campoDeBusca("Empresas", "Todas as empresas"), {
      target: { value: "a11" },
    });

    expect(screen.getByText("Nenhum resultado encontrado")).toBeInTheDocument();
  });

  // A cópia fechava o dropdown a cada marcação por acidente: `MultiSelect`
  // era declarada DENTRO do corpo de `Vendas`, então todo clique que mudava
  // `filtroEmpresa` re-renderizava `Vendas` e recriava a função
  // `MultiSelect` — React via um componente novo e o remontava do zero,
  // resetando o estado local `isOpen` para `false`. Por isso o teste
  // original reabria o painel (`abrir(...)`) antes de cada clique seguinte
  // dentro dele. O primitivo não tem esse acidente — o painel continua
  // aberto até um clique fora ou no próprio botão —, então os cliques
  // abaixo agem direto no painel que já está aberto; reabrir aqui fecharia
  // o painel em vez de mantê-lo aberto.
  it("marcar de novo desmarca, e 'Limpar seleção' zera tudo", () => {
    render(<Vendas />);

    abrir("Empresas", "Todas as empresas");
    fireEvent.click(screen.getByRole("checkbox", { name: /Alfa Mineração/ }));
    expect(
      screen.getByRole("button", { name: "Empresas 1 selecionado(s)" }),
    ).toBeInTheDocument();

    // Reclicar no MESMO checkbox desmarca — volta ao placeholder.
    fireEvent.click(screen.getByRole("checkbox", { name: /Alfa Mineração/ }));
    expect(
      screen.getByRole("button", { name: "Empresas Todas as empresas" }),
    ).toBeInTheDocument();

    // Seleciona de novo para testar "Limpar seleção" isoladamente.
    fireEvent.click(screen.getByRole("checkbox", { name: /Alfa Mineração/ }));
    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));

    expect(
      screen.getByRole("button", { name: "Empresas Todas as empresas" }),
    ).toBeInTheDocument();
  });

  it("clicar fora fecha o dropdown", () => {
    render(<Vendas />);
    abrir("Empresas", "Todas as empresas");
    const container = containerDoFiltro("Empresas", "Todas as empresas");
    expect(
      within(container).getByPlaceholderText("Pesquisar..."),
    ).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    // O container do filtro continua no DOM (o botão vive nele); o que some
    // ao fechar é só o painel do dropdown, filho dele.
    expect(
      within(container).queryByPlaceholderText("Pesquisar..."),
    ).not.toBeInTheDocument();
  });
});
