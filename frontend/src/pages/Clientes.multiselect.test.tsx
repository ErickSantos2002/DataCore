import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Clientes from "./Clientes";

/**
 * Caracterização do MultiSelect COMO ELE VIVE em Clientes.
 *
 * Mesmo molde de `Estoque.multiselect.test.tsx` (Task 4): dublê de `useData`
 * em vez do provider de verdade, porque o alvo é o MultiSelect, não a
 * integração com o backend. A tela tem três filtros ("Todos os clientes",
 * "Todos os produtos", "Todos os vendedores") e dois campos com o
 * placeholder "Pesquisar..." — o do dropdown de cliente e o da tabela —,
 * então o teste escopa a busca pelo container do filtro
 * (`containerDoFiltro`/`campoDeBusca`) em vez de pegar "o primeiro da
 * página": isso funciona hoje só por acidente de layout, e se a extração
 * para primitivo montar o painel num portal o teste passaria a ler o campo
 * errado seguindo verde. Este arquivo caracteriza só o filtro "Todos os
 * clientes" (`clientesUnicos`) — é o que distingue Clientes das telas
 * anteriores.
 *
 * `clientesUnicos` (~linha 133) é `{ value, label }[]` como em Estoque, mas
 * o `value` aqui já sai PRÉ-normalizado: `c.cpf_cnpj.replace(/\D/g, "")` —
 * só dígitos, sem pontuação. O `label` é `"${nome} (${cpf_cnpj})"`, com a
 * pontuação do CNPJ preservada.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

// Uma nota por cliente, para que os dois apareçam na tabela (só entra na
// tabela quem tem `numeroComprasPeriodo > 0`, ~linha 257) — é o que dá à
// asserção forte do `value` algo visível para diferenciar.

const { CLIENTES_ENRIQUECIDOS, NOTAS } = vi.hoisted(() => {
  const CLIENTES_ENRIQUECIDOS = [
    {
      id: 1,
      nome: "Alfa Mineração",
      cpf_cnpj: "11.222.333/0001-44",
      email: "contato@alfa.com",
      fone: "81999990000",
      totalComprado: 1000,
      numeroCompras: 1,
      ultimaCompra: new Date("2026-01-10"),
      status: "ativo" as const,
      ticketMedio: 1000,
    },
    {
      id: 2,
      nome: "Beta Logística",
      cpf_cnpj: "55.666.777/0001-88",
      email: "contato@beta.com",
      fone: "81888880000",
      totalComprado: 500,
      numeroCompras: 1,
      ultimaCompra: new Date("2026-02-10"),
      status: "ativo" as const,
      ticketMedio: 500,
    },
  ];
  const NOTAS = [
    {
      id: 1,
      numero: 1001,
      data_emissao: "2026-01-10",
      valor_nota: 1000,
      valor_produtos: 1000,
      cliente: {
        id: 1,
        nome: "Alfa Mineração",
        cpf_cnpj: "11.222.333/0001-44",
      },
      nome_vendedor: "Vendedor A",
      tipo: null,
      itens: [
        {
          codigo: "P1",
          descricao: "Bafômetro Phoebus",
          quantidade: "2",
          valor_total: "1000",
        },
      ],
      tem_observacoes: false,
    },
    {
      id: 2,
      numero: 1002,
      data_emissao: "2026-02-10",
      valor_nota: 500,
      valor_produtos: 500,
      cliente: {
        id: 2,
        nome: "Beta Logística",
        cpf_cnpj: "55.666.777/0001-88",
      },
      nome_vendedor: "Vendedor B",
      tipo: null,
      itens: [
        {
          codigo: "P2",
          descricao: "Tubo descartável",
          quantidade: "10",
          valor_total: "500",
        },
      ],
      tem_observacoes: false,
    },
  ];
  return { CLIENTES_ENRIQUECIDOS, NOTAS };
});

// A tela deixou de ler o `DataContext` (item 9.4): a agregação por cliente vem
// somada do banco. O falso mora em `comercial/hooksFalsos`.
vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { criarHooksFalsos, resumoDeClientes } = await import(
    "./comercial/hooksFalsos"
  );
  return {
    ...real,
    ...criarHooksFalsos(NOTAS, (ns) =>
      resumoDeClientes(ns, CLIENTES_ENRIQUECIDOS),
    ),
  };
});

/**
 * Dublê do recharts.
 *
 * Em jsdom o `ResponsiveContainer` mede 0x0 e o recharts de verdade não
 * desenha nada — os gráficos de Clientes ficariam invisíveis ao teste sem
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
 * Escopado pelo container do filtro, e não pela ordem na página: Clientes
 * tem dois campos com o placeholder "Pesquisar..." — este e o da tabela de
 * clientes —, e pegar "o primeiro" depende de a seção de filtros vir antes
 * da tabela no JSX. Se a extração para primitivo montar o painel num portal,
 * "o primeiro" passa a ser o campo da tabela e o teste seguiria verde
 * testando a coisa errada.
 */
function campoDeBusca(rotulo: string, valor: string): HTMLElement {
  return within(containerDoFiltro(rotulo, valor)).getByPlaceholderText(
    "Pesquisar...",
  );
}

describe("MultiSelect em Clientes", () => {
  it("o botão fechado mostra o placeholder e, depois, quantos foram escolhidos", () => {
    render(<Clientes />);

    abrir("Cliente", "Todos os clientes");
    fireEvent.click(screen.getByRole("checkbox", { name: /Alfa Mineração/ }));

    expect(
      screen.getByRole("button", { name: "Cliente 1 selecionado(s)" }),
    ).toBeInTheDocument();
  });

  it("a busca filtra a lista por texto", () => {
    render(<Clientes />);
    abrir("Cliente", "Todos os clientes");

    fireEvent.change(campoDeBusca("Cliente", "Todos os clientes"), {
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
    render(<Clientes />);
    abrir("Cliente", "Todos os clientes");

    fireEvent.change(campoDeBusca("Cliente", "Todos os clientes"), {
      target: { value: "gama" },
    });

    expect(screen.getByText("Nenhum resultado encontrado")).toBeInTheDocument();
  });

  // ── COMPORTAMENTO QUE DISTINGUE CLIENTES DAS TELAS ANTERIORES ───────────
  // A busca (~linha 592) tem três condições, nesta ordem de fallback:
  //   1. `label.includes(termo)`             — texto exibido, com pontuação;
  //   2. `value.includes(termo)`             — o value CRU;
  //   3. dígitos do value ⊇ dígitos do termo — só quando o termo tem dígito.
  //
  // FIX ROUND 1 — achado Crítico da revisão: a condição 2 é RAMO MORTO em
  // Clientes, e não dá pra escrever um termo que a isole (ao contrário do
  // que a v1 deste teste alegava com "23330001"). O motivo é matemático, não
  // de dado de teste: `clientesUnicos` (~linha 133) já entrega `value`
  // pré-normalizado (`c.cpf_cnpj.replace(/\D/g, "")` — só dígitos, sem
  // pontuação nenhuma). Logo `valueLower === valueNormalizado` sempre.
  //   - Se o termo digitado é só dígito, `searchLower === searchNormalizado`
  //     também — as condições 2 e 3 viram a MESMA expressão booleana, então
  //     nenhum termo numérico consegue provar a 2 isoladamente (o que quer
  //     que a 2 aceite, a 3 também aceita).
  //   - Se o termo tem qualquer caractere não-dígito, a condição 2 nunca
  //     bate, porque `value` não tem pontuação nenhuma pra casar contra.
  // Ou seja: pra QUALQUER termo, a condição 2 nunca decide sozinha o
  // resultado — apagá-la hoje não muda nenhum comportamento observável.
  // Verifiquei isso na prática (não só no papel): apaguei
  // `valueLower.includes(searchLower)` de `Clientes.tsx:601` e rodei este
  // arquivo — os 7 testes continuaram passando, confirmando que a condição
  // é inalcançável com os dados que a própria tela monta. Revertido em
  // seguida (`git checkout -- src/pages/Clientes.tsx`). Detalhe completo em
  // `task-5-report.md`, seção "Fix round 1".
  //
  // Isso é diferente de Estoque, onde `value` é o código formatado ("1.163",
  // com ponto) — lá a condição 2 (value cru, com pontuação) e a 3 (dígitos
  // normalizados) SÃO observáveis em separado. Fixado aqui, sem tocar em
  // `Clientes.tsx`, pra fase de unificação decidir se a condição 2 sai (ela
  // não faz nada hoje) ou se `clientesUnicos` passa a guardar o `value` com
  // pontuação como as outras telas.
  //
  // Os dois casos abaixo são os que de fato isolam algo:
  // - "alfa" só bate na condição 1 (label) — não existe em `value`, que é
  //   só dígito.
  // - "11-222-333" usa hífen em vez do ponto do CNPJ real: não bate no label
  //   (pontuação diferente) nem na condição 2 (o `value` não tem hífen
  //   nenhum pra casar, e mesmo que tivesse, a condição 2 é ramo morto como
  //   explicado acima). Só bate depois de tirar os não-dígitos dos dois
  //   lados — prova a condição 3 isoladamente. É o caso que a plantação do
  //   Passo 3 (apagar a condição 3) derruba.
  // - "beta" é o nome do OUTRO cliente do fixture, não um termo aleatório:
  //   prova que a busca por "Alfa Mineração" filtra de verdade — se a busca
  //   estivesse quebrada (ex.: ignorando o termo e devolvendo tudo), este
  //   caso pegaria o erro; um termo inventado sem relação com o fixture não
  //   pegaria.
  it("acha pelo rótulo e pelos dígitos do value (a condição do value cru é inalcançável)", () => {
    render(<Clientes />);

    for (const [termo, achado] of [
      ["alfa", true],
      ["11-222-333", true],
      ["beta", false],
    ] as const) {
      abrir("Cliente", "Todos os clientes");
      fireEvent.change(campoDeBusca("Cliente", "Todos os clientes"), {
        target: { value: termo },
      });
      const achou = screen.queryByRole("checkbox", { name: /Alfa Mineração/ });
      expect(Boolean(achou)).toBe(achado);
      fireEvent.mouseDown(document.body);
    }
  });

  // ── ASSERÇÃO FORTE DO VALUE (correção pós-brief) ─────────────────────────
  // Marcar o checkbox e olhar só o botão ("1 selecionado(s)") não prova que
  // `selected` guarda o `value` (CNPJ normalizado) e não o `label` (nome +
  // CNPJ formatado) — essa contagem é igual nos dois casos. Quem de fato
  // consome `selected` como CNPJ é o filtro da TABELA (`clientesFiltrados`,
  // ~linha 259: `filtroCliente.includes(c.cpf_cnpj.replace(/\D/g, ""))`):
  // é lá que a confusão aparece. Por isso a asserção observa a tabela, não o
  // botão — e o fixture tem DOIS clientes com nota no período (Alfa e Beta)
  // para a tabela ter algo visível para diferenciar.
  it("o checkbox mostra o rótulo, e o que filtra a tabela é o CNPJ", () => {
    render(<Clientes />);
    abrir("Cliente", "Todos os clientes");

    fireEvent.click(screen.getByRole("checkbox", { name: /Alfa Mineração/ }));

    const tabela = screen.getByRole("table");
    expect(within(tabela).getByText("Alfa Mineração")).toBeInTheDocument();
    expect(
      within(tabela).queryByText("Beta Logística"),
    ).not.toBeInTheDocument();
  });

  // A cópia fechava o dropdown ao marcar por acidente: era declarada DENTRO
  // do corpo de `Clientes`, então cada clique que mudava `filtroCliente`
  // recriava a função `MultiSelect` e o React remontava o componente do
  // zero, resetando `isOpen` para `false`. Por isso o teste original reabria
  // o painel (`abrir(...)`) antes de cada clique seguinte dentro dele. O
  // primitivo não tem esse acidente — o painel abre uma vez e só fecha ao
  // clicar fora — e reabrir aqui fecharia o painel em vez de abri-lo, porque
  // ele já está aberto. Os `abrir(...)` intermediários foram removidos por
  // isso; só o primeiro, que de fato abre o painel fechado, continua.
  it("marcar de novo desmarca, e 'Limpar seleção' zera tudo", () => {
    render(<Clientes />);

    abrir("Cliente", "Todos os clientes");
    fireEvent.click(screen.getByRole("checkbox", { name: /Alfa Mineração/ }));
    expect(
      screen.getByRole("button", { name: "Cliente 1 selecionado(s)" }),
    ).toBeInTheDocument();

    // Reclicar no MESMO checkbox desmarca — volta ao placeholder.
    fireEvent.click(screen.getByRole("checkbox", { name: /Alfa Mineração/ }));
    expect(
      screen.getByRole("button", { name: "Cliente Todos os clientes" }),
    ).toBeInTheDocument();

    // Seleciona de novo para testar "Limpar seleção" isoladamente.
    fireEvent.click(screen.getByRole("checkbox", { name: /Alfa Mineração/ }));
    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));

    expect(
      screen.getByRole("button", { name: "Cliente Todos os clientes" }),
    ).toBeInTheDocument();
  });

  it("clicar fora fecha o dropdown", () => {
    render(<Clientes />);
    abrir("Cliente", "Todos os clientes");
    const container = containerDoFiltro("Cliente", "Todos os clientes");
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
