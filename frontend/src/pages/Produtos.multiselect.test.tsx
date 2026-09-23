import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Produtos from "./Produtos";

/**
 * Caracterização do MultiSelect COMO ELE VIVE em Produtos.
 *
 * Não é a tela: é o bloco. O que se fixa aqui é o contrato que a extração
 * para primitivo tem de preservar — o que o botão diz, o que a busca acha,
 * o que marcar faz e o que "Limpar seleção" limpa. `useAuth` e `useData` são
 * mockados direto (em vez de montar os providers de verdade) porque o alvo
 * é o MultiSelect, não a integração com o backend — molde que as tasks 2-6
 * repetem.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const { NOTAS } = vi.hoisted(() => ({
  NOTAS: [
    {
      id: 1,
      data_emissao: "2026-01-10",
      valor_nota: 1000,
      cliente: { nome: "Alfa Mineração", cpf_cnpj: "11.222.333/0001-44" },
      nome_vendedor: "Vendedor A",
      itens: [
        {
          codigo: "P1",
          descricao: "Bafômetro Phoebus",
          quantidade: "2",
          valor_total: "1000",
        },
      ],
    },
    {
      id: 2,
      data_emissao: "2026-02-10",
      valor_nota: 500,
      cliente: { nome: "Beta Logística", cpf_cnpj: "55.666.777/0001-88" },
      nome_vendedor: "Vendedor B",
      itens: [
        {
          codigo: "P2",
          descricao: "Tubo descartável",
          quantidade: "10",
          valor_total: "500",
        },
      ],
    },
  ],
}));

// A tela deixou de ler o `DataContext` (item 9.4): a agregação vem somada do
// banco. O falso mora em `comercial/hooksFalsos`, e para esta tela o que importa
// é o `por_produto` — é ele que virou a tabela.
vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { criarHooksFalsos, resumoDeProdutos } = await import(
    "./comercial/hooksFalsos"
  );
  return { ...real, ...criarHooksFalsos(NOTAS, resumoDeProdutos) };
});

/**
 * Dublê do recharts.
 *
 * Em jsdom o `ResponsiveContainer` mede 0x0 e o recharts de verdade não
 * desenha nada — os gráficos de Produtos ficariam invisíveis ao teste sem
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
 * Escopado pelo container do filtro, e não por busca global: a tela tem três
 * MultiSelect, e a query global só achava um porque a busca da tabela daqui
 * se chama "Pesquisar produto..." — as outras cinco telas usam "Pesquisar..."
 * nas duas. Ou seja, o teste dependia do placeholder de OUTRO componente:
 * normalizar aquele texto passaria a casar dois campos e quebraria os cinco
 * casos de uma vez.
 */
function campoDeBusca(rotulo: string, valor: string): HTMLElement {
  return within(containerDoFiltro(rotulo, valor)).getByPlaceholderText(
    "Pesquisar...",
  );
}

describe("MultiSelect em Produtos", () => {
  it("o botão fechado mostra o placeholder e, depois, quantos foram escolhidos", () => {
    render(<Produtos />);

    abrir("Empresas", "Todas as empresas");
    fireEvent.click(screen.getByRole("checkbox", { name: /Alfa Mineração/ }));

    expect(
      screen.getByRole("button", { name: "Empresas 1 selecionado(s)" }),
    ).toBeInTheDocument();
  });

  it("a busca filtra a lista por texto", () => {
    render(<Produtos />);
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
    render(<Produtos />);
    abrir("Empresas", "Todas as empresas");

    fireEvent.change(campoDeBusca("Empresas", "Todas as empresas"), {
      target: { value: "gama" },
    });

    expect(screen.getByText("Nenhum resultado encontrado")).toBeInTheDocument();
  });

  // ── DEFEITO PRESERVADO ───────────────────────────────────────────────────
  // Produtos NÃO acha pelo CNPJ digitado sem pontuação: a função `normalizar`
  // existe no arquivo mas nunca é chamada pelo filtro, que só faz
  // `optionLower.includes(searchLower)` sobre o texto cru da opção. Fica
  // fixado para que a unificação das quatro buscas divergentes (fase
  // seguinte) seja decisão, e não efeito colateral.
  it("não acha pelo CNPJ sem pontuação (defeito preservado)", () => {
    render(<Produtos />);
    abrir("Empresas", "Todas as empresas");

    fireEvent.change(campoDeBusca("Empresas", "Todas as empresas"), {
      target: { value: "11222333" },
    });

    expect(screen.getByText("Nenhum resultado encontrado")).toBeInTheDocument();
  });

  it("marcar de novo desmarca, e 'Limpar seleção' zera tudo", () => {
    render(<Produtos />);
    abrir("Empresas", "Todas as empresas");
    fireEvent.click(screen.getByRole("checkbox", { name: /Alfa Mineração/ }));

    // A cópia fechava o dropdown ao marcar por acidente: era declarada
    // dentro do componente da página, então `onChange` a recriava a cada
    // marcação e ela remontava do zero, resetando `isOpen`. Por isso o
    // teste original reabria com abrir("1 selecionado(s)") antes de clicar
    // em "Limpar seleção". O primitivo não tem esse acidente — o painel
    // continua aberto após marcar — e reabrir aqui fecharia o painel em vez
    // de abri-lo. "Limpar seleção" já está visível sem precisar reabrir.
    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));

    expect(
      screen.getByRole("button", { name: "Empresas Todas as empresas" }),
    ).toBeInTheDocument();
  });

  it("clicar fora fecha o dropdown", () => {
    render(<Produtos />);
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
