import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Servicos from "./Servicos";

/**
 * Caracterização do MultiSelect COMO ELE VIVE em Serviços.
 *
 * Mesmo molde de `Produtos.multiselect.test.tsx` (Task 1): dublês de
 * `useAuth` e do contexto da tela em vez dos providers de verdade, porque o
 * alvo é o MultiSelect, não a integração com o backend. A diferença de
 * Serviços é a busca "por número": o filtro de clientes carrega o CNPJ entre
 * parênteses (`"Alfa Mineração (11.222.333/0001-44)"`), e o MultiSelect daqui
 * normaliza a opção inteira tirando os não-dígitos antes de comparar — por
 * isso acha o cliente mesmo digitando o CNPJ sem pontuação. É o
 * comportamento que separa esta cópia da de Produtos e que a estratégia
 * `buscaPorTextoOuNumero` (Task 7) tem de reproduzir.
 */
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

const { SERVICOS_ENRIQUECIDOS } = vi.hoisted(() => ({
  SERVICOS_ENRIQUECIDOS: [
    {
      id: 1,
      numero_nfse: "1001",
      data_emissao: "2026-01-10",
      valor_servico: 1000,
      razao_social_tomador: "Alfa Mineração",
      cpf_cnpj_tomador: "11.222.333/0001-44",
      cidade_tomador: "Recife",
      uf_tomador: "PE",
      discriminacao_servico: "Calibração de bafômetro",
      valor_servico_numero: 1000,
      mes: "janeiro",
      ano: 2026,
    },
    {
      id: 2,
      numero_nfse: "1002",
      data_emissao: "2026-02-10",
      valor_servico: 500,
      razao_social_tomador: "Beta Logística",
      cpf_cnpj_tomador: "55.666.777/0001-88",
      cidade_tomador: "Olinda",
      uf_tomador: "PE",
      // Número pontuado de propósito: é o que prova a busca numérica no
      // filtro de tipos (Fix round 1) — "1.234" só bate buscando pelos
      // dígitos "1234" se a normalização estiver de fato ligada aqui.
      discriminacao_servico: "Manutenção preventiva 1.234",
      valor_servico_numero: 500,
      mes: "fevereiro",
      ano: 2026,
    },
  ],
}));

// A tela deixou de ler o `ServicosContext` (item 9.4): os agregados vêm somados
// do banco e a tabela vem paginada. O falso mora em `servicos/hooksFalsos`.
vi.mock("./servicos/useServicos", async (original) => {
  const real = await original<typeof import("./servicos/useServicos")>();
  const { criarHooksFalsosDeServicos } = await import("./servicos/hooksFalsos");
  return { ...real, ...criarHooksFalsosDeServicos(SERVICOS_ENRIQUECIDOS) };
});

/**
 * Dublê do recharts.
 *
 * Em jsdom o `ResponsiveContainer` mede 0x0 e o recharts de verdade não
 * desenha nada — os gráficos de Serviços ficariam invisíveis ao teste sem
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
 * Escopado pelo container do filtro, e não pela ordem na página: a tela tem
 * dois campos com o placeholder "Pesquisar..." — este e o da tabela —, e
 * pegar "o primeiro" depende de a seção de filtros vir antes da tabela no
 * JSX. Se a extração para primitivo montar o painel num portal, "o primeiro"
 * passa a ser o campo da tabela e o teste seguiria verde testando a coisa
 * errada.
 */
function campoDeBusca(rotulo: string, valor: string): HTMLElement {
  return within(containerDoFiltro(rotulo, valor)).getByPlaceholderText(
    "Pesquisar...",
  );
}

describe("MultiSelect em Serviços", () => {
  it("o botão fechado mostra o placeholder e, depois, quantos foram escolhidos", () => {
    render(<Servicos />);

    abrir("Cliente (Tomador)", "Todos os clientes");
    fireEvent.click(screen.getByRole("checkbox", { name: /Alfa Mineração/ }));

    expect(
      screen.getByRole("button", {
        name: "Cliente (Tomador) 1 selecionado(s)",
      }),
    ).toBeInTheDocument();
  });

  it("a busca filtra a lista por texto", () => {
    render(<Servicos />);
    abrir("Cliente (Tomador)", "Todos os clientes");

    fireEvent.change(campoDeBusca("Cliente (Tomador)", "Todos os clientes"), {
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
    render(<Servicos />);
    abrir("Cliente (Tomador)", "Todos os clientes");

    fireEvent.change(campoDeBusca("Cliente (Tomador)", "Todos os clientes"), {
      target: { value: "gama" },
    });

    expect(screen.getByText("Nenhum resultado encontrado")).toBeInTheDocument();
  });

  // ── COMPORTAMENTO QUE DIVERGE DE PRODUTOS ───────────────────────────────
  // Ao contrário de Produtos (onde a mesma busca por CNPJ sem pontuação NÃO
  // acha nada), o MultiSelect de Serviços normaliza a opção inteira tirando
  // os não-dígitos (`optionNumerico`) e compara com o termo também
  // normalizado (`searchNumerico`) — por isso acha o cliente pelo CNPJ
  // digitado sem máscara. É o comportamento que a busca unificada (fase
  // seguinte) precisa decidir se preserva, e não pode nascer por acidente.
  it("acha pelo número digitado sem pontuação", () => {
    render(<Servicos />);
    abrir("Cliente (Tomador)", "Todos os clientes");

    fireEvent.change(campoDeBusca("Cliente (Tomador)", "Todos os clientes"), {
      target: { value: "11222333" },
    });

    expect(
      screen.getByRole("checkbox", { name: /Alfa Mineração/ }),
    ).toBeInTheDocument();
  });

  it("marcar de novo desmarca, e 'Limpar seleção' zera tudo", () => {
    render(<Servicos />);
    abrir("Cliente (Tomador)", "Todos os clientes");
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
      screen.getByRole("button", {
        name: "Cliente (Tomador) Todos os clientes",
      }),
    ).toBeInTheDocument();
  });

  it("clicar fora fecha o dropdown", () => {
    render(<Servicos />);
    abrir("Cliente (Tomador)", "Todos os clientes");
    const container = containerDoFiltro(
      "Cliente (Tomador)",
      "Todos os clientes",
    );
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

  // ── FIX ROUND 1 ──────────────────────────────────────────────────────
  // A troca original passou `buscaPorTextoOuNumero` só no filtro de
  // clientes, seguindo o brief à risca. Mas a cópia tinha um `filteredOptions`
  // só, e ele valia para os TRÊS filtros — cidade e tipo de serviço também
  // achavam pelos dígitos normalizados. Para cidade é inócuo
  // (`cidadesUnicas` não tem dígito), mas `tiposServicoUnicos` vem de texto
  // livre (`discriminacao_servico`), onde número pontuado é comum. Este
  // teste planta a opção "Manutenção preventiva 1.234" no fixture e prova
  // que buscar "1234" (sem pontuação) acha essa opção no filtro de tipos —
  // exatamente o ramo que tinha sumido.
  it("no filtro de tipos, acha pelo número digitado sem pontuação", () => {
    render(<Servicos />);
    abrir("Tipo de Serviço", "Todos os tipos");

    fireEvent.change(campoDeBusca("Tipo de Serviço", "Todos os tipos"), {
      target: { value: "1234" },
    });

    expect(
      screen.getByRole("checkbox", { name: /Manutenção preventiva 1\.234/ }),
    ).toBeInTheDocument();
  });
});
