import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Home, ShoppingCart } from "lucide-react";
import { AppShell } from "./AppShell";
import type { NavGroup } from "./AppShell";

// Divergencia registrada em relacao ao pseudocodigo do brief: o .d.ts real
// do AppShell nao tem `items` nem `onLogout` — os grupos vem em `groups`
// (NavGroup[]), o campo do item e `path` (nao `to`) e nao existe prop de
// logout: o botao de sair e conteudo livre, passado em `topbarActions`. O
// icone aceita os dois formatos que a Sidebar do DataCoreHS precisa: um
// `IconName` do design system (string, resolvida via `Icon`) ou um nó React
// já pronto — é o caso do lucide-react, usado quando falta traçado no
// `ICON_PATHS` (ex.: Locação/KeyRound). Por isso os ícones abaixo já vêm
// como elemento (`<Home .../>`), não como referência de componente.
const grupos: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { label: "Início", path: "/inicio", icon: <Home aria-hidden="true" /> },
      { label: "Vendas", path: "/vendas", icon: <ShoppingCart aria-hidden="true" /> },
    ],
  },
];

function montar() {
  return render(
    <MemoryRouter>
      <AppShell
        user={{ name: "erick", role: "admin" }}
        groups={grupos}
        activePath="/inicio"
        onNavigate={() => {}}
      >
        <p>conteúdo da página</p>
      </AppShell>
    </MemoryRouter>,
  );
}

describe("AppShell", () => {
  it("monta topbar, navegacao e conteudo", () => {
    montar();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByText("conteúdo da página")).toBeInTheDocument();
  });

  it("cada item de menu e um link de verdade", () => {
    montar();
    expect(screen.getByRole("link", { name: /Início/ })).toHaveAttribute(
      "href",
      "/inicio",
    );
  });

  it("marca o item ativo com aria-current", () => {
    montar();
    expect(screen.getByRole("link", { name: /Início/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Vendas/ })).not.toHaveAttribute("aria-current");
  });

  it("resolve icon como IconName do design system quando o item manda uma string", () => {
    const gruposComIconName: NavGroup[] = [
      { label: "Principal", items: [{ label: "Início", path: "/inicio", icon: "dashboard" }] },
    ];
    render(
      <MemoryRouter>
        <AppShell groups={gruposComIconName} onNavigate={() => {}}>
          <p>conteúdo</p>
        </AppShell>
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /Início/ });
    expect(link.querySelector("svg")).toBeInTheDocument();
  });

  it("desenha o rotulo de cada grupo quando ha mais de um", () => {
    const gruposMultiplos: NavGroup[] = [
      { label: "Principal", items: [{ label: "Início", path: "/inicio", icon: "dashboard" }] },
      { label: "Comercial", items: [{ label: "Vendas", path: "/vendas", icon: "ticket" }] },
      { label: "Financeiro", items: [{ label: "Gerenciamento", path: "/financeiro", icon: "chart" }] },
      { label: "Administração", items: [{ label: "Estoque", path: "/estoque", icon: "cpu" }] },
    ];
    render(
      <MemoryRouter>
        <AppShell groups={gruposMultiplos} onNavigate={() => {}}>
          <p>conteúdo</p>
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect(screen.getByText("Comercial")).toBeInTheDocument();
    expect(screen.getByText("Financeiro")).toBeInTheDocument();
    expect(screen.getByText("Administração")).toBeInTheDocument();
  });

  it("um grupo sem nenhum item visivel nao renderiza rotulo, expandida", () => {
    const gruposComVazio: NavGroup[] = [
      { label: "Principal", items: [{ label: "Início", path: "/inicio", icon: "dashboard" }] },
      { label: "Vazio", items: [] },
    ];
    render(
      <MemoryRouter>
        <AppShell groups={gruposComVazio} onNavigate={() => {}}>
          <p>conteúdo</p>
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.queryByText("Vazio")).not.toBeInTheDocument();
    expect(screen.queryByTestId("grupo-Vazio")).not.toBeInTheDocument();
  });

  it("um grupo sem nenhum item visivel nao renderiza o separador, recolhida", () => {
    const gruposComVazio: NavGroup[] = [
      { label: "Principal", items: [{ label: "Início", path: "/inicio", icon: "dashboard" }] },
      { label: "Vazio", items: [] },
    ];
    render(
      <MemoryRouter>
        <AppShell groups={gruposComVazio} onNavigate={() => {}} collapsed>
          <p>conteúdo</p>
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId("grupo-Vazio")).not.toBeInTheDocument();
    expect(screen.getByTestId("grupo-Principal")).toBeInTheDocument();
  });

  // O agrupamento visual em si (contraste do fio, distancia entre grupos vs.
  // entre itens do mesmo grupo) so se prova medindo no navegador de verdade -
  // jsdom nao faz layout, entao getBoundingClientRect aqui sempre volta zero.
  // O que da pra provar em jsdom, e o que estes dois testes cobrem, e que o
  // CSS certo esta de fato aplicado: a classe de cor mais forte no fio
  // recolhido, e o gap maior entre grupos so quando recolhida (sem regredir
  // a expandida, que separa por rotulo de texto, nao por espaco).
  it("recolhida, o separador de grupo usa a borda mais forte (--border-strong), nao a fraca", () => {
    const gruposMultiplos: NavGroup[] = [
      { label: "Principal", items: [{ label: "Início", path: "/inicio", icon: "dashboard" }] },
      { label: "Comercial", items: [{ label: "Vendas", path: "/vendas", icon: "ticket" }] },
    ];
    render(
      <MemoryRouter>
        <AppShell groups={gruposMultiplos} onNavigate={() => {}} collapsed>
          <p>conteúdo</p>
        </AppShell>
      </MemoryRouter>,
    );
    const separador = screen.getByTestId("grupo-Comercial").querySelector("div.border-t");
    expect(separador).toHaveClass("border-borda-strong");
    expect(separador).not.toHaveClass("border-borda");
  });

  it("recolhida, o espaco entre grupos e maior que o espaco entre itens do mesmo grupo (gap-8 vs gap-0.5)", () => {
    const gruposMultiplos: NavGroup[] = [
      { label: "Principal", items: [{ label: "Início", path: "/inicio", icon: "dashboard" }] },
      { label: "Comercial", items: [{ label: "Vendas", path: "/vendas", icon: "ticket" }] },
    ];
    render(
      <MemoryRouter>
        <AppShell groups={gruposMultiplos} onNavigate={() => {}} collapsed>
          <p>conteúdo</p>
        </AppShell>
      </MemoryRouter>,
    );
    const nav = screen.getByRole("navigation");
    expect(nav).toHaveClass("gap-8");
    expect(nav).not.toHaveClass("gap-4");
  });

  it("expandida, o gap entre grupos continua gap-4 (nao muda o que ninguem pediu)", () => {
    montar();
    expect(screen.getByRole("navigation")).toHaveClass("gap-4");
    expect(screen.getByRole("navigation")).not.toHaveClass("gap-8");
  });

  // O alinhamento em si (centro do icone vs. centro da sidebar) so se prova
  // medindo no navegador de verdade - jsdom nao faz layout, entao um
  // getBoundingClientRect aqui sempre volta zero e provaria qualquer coisa.
  // O que da pra provar em jsdom e o que estes tres testes cobrem: que a
  // classe de tamanho fixo (nao mais o "w-full" que dependia do <Tooltip>
  // esticar) esta la, que a barra de 2px do ativo nao aparece recolhida, e
  // que o container do grupo centraliza os filhos so quando recolhida.
  it("recolhida, o link vira um quadrado de tamanho fixo (h-10 w-10), nao um elemento que estica", () => {
    render(
      <MemoryRouter>
        <AppShell groups={grupos} activePath="/inicio" onNavigate={() => {}} collapsed>
          <p>conteúdo</p>
        </AppShell>
      </MemoryRouter>,
    );
    // Recolhida o rotulo de texto some (o Tooltip carrega o nome via
    // aria-describedby, nao via nome acessivel do link) - por isso o link e
    // pego pelo href, nao por getByRole com `name`.
    const link = screen.getByTestId("grupo-Principal").querySelector('a[href="/inicio"]');
    expect(link).toHaveClass("h-10");
    expect(link).toHaveClass("w-10");
    expect(link).not.toHaveClass("w-full");
  });

  it("recolhida, o item ativo nao ganha a barra lateral de 2px (so tint de fundo + cor do icone)", () => {
    render(
      <MemoryRouter>
        <AppShell groups={grupos} activePath="/inicio" onNavigate={() => {}} collapsed>
          <p>conteúdo</p>
        </AppShell>
      </MemoryRouter>,
    );
    const ativo = screen.getByTestId("grupo-Principal").querySelector('a[href="/inicio"]');
    expect(ativo).toHaveClass("bg-action-tint");
    expect(ativo).toHaveClass("text-action");
    expect(ativo).not.toHaveClass("border-l-2");
    expect(ativo).not.toHaveClass("border-action");
  });

  it("expandida, o item ativo continua com a barra lateral de 2px (nao muda o que ninguem pediu)", () => {
    montar();
    const ativo = screen.getByRole("link", { name: /Início/ });
    expect(ativo).toHaveClass("border-l-2");
    expect(ativo).toHaveClass("border-action");
    expect(ativo).not.toHaveClass("h-10");
    expect(ativo).not.toHaveClass("w-10");
  });

  it("recolhida, o container do grupo centraliza os itens (items-center); expandida, nao", () => {
    const { unmount } = render(
      <MemoryRouter>
        <AppShell groups={grupos} activePath="/inicio" onNavigate={() => {}} collapsed>
          <p>conteúdo</p>
        </AppShell>
      </MemoryRouter>,
    );
    const containerRecolhido = screen.getByTestId("grupo-Principal").querySelector("div.flex.flex-col.gap-0\\.5");
    expect(containerRecolhido).toHaveClass("items-center");
    unmount();

    montar();
    const containerExpandido = screen.getByTestId("grupo-Principal").querySelector("div.flex.flex-col.gap-0\\.5");
    expect(containerExpandido).not.toHaveClass("items-center");
  });
});

// ── CELULAR ────────────────────────────────────────────────────────────────
// Na conferência de 15/09, em 390px a sidebar ocupava 256px e sobravam 128px
// para a página — em Estoque as pizzas nem renderizavam. A casca não tinha
// comportamento nenhum abaixo de `sm`: o `useIsMobile` das telas respondia a
// pergunta, mas quem comia a largura era a casca.
//
// O jsdom não avalia media query, então "a sidebar fixa some no celular" só
// pode ser afirmado pela classe. É o mesmo limite dos testes de classe acima.
describe("AppShell: os dois lados da topbar", () => {
  /**
   * A topbar tinha um lugar só para conteúdo do app — `topbarActions`, à
   * direita —, e o DataCoreHS punha ali o botão de menu junto do resto. O
   * botão de menu pertence ao lado da sidebar que ele recolhe, então o
   * `topbarStart` existe para o app pôr conteúdo à ESQUERDA.
   */
  function montarComOsDoisLados() {
    return render(
      <MemoryRouter>
        <AppShell
          groups={grupos}
          activePath="/inicio"
          onNavigate={() => {}}
          topbarStart={<button>menu</button>}
          topbarActions={<button>usuário</button>}
        >
          <p>conteúdo da página</p>
        </AppShell>
      </MemoryRouter>,
    );
  }

  it("o topbarStart vem ANTES do topbarActions na topbar", () => {
    montarComOsDoisLados();
    const topo = screen.getByRole("banner");
    const menu = screen.getByRole("button", { name: "menu" });
    const usuario = screen.getByRole("button", { name: "usuário" });

    expect(topo).toContainElement(menu);
    expect(topo).toContainElement(usuario);
    // `compareDocumentPosition` em vez de olhar classe: o que importa é a
    // ordem no documento, que é a ordem de leitura e a de tabulação.
    expect(
      menu.compareDocumentPosition(usuario) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("sem topbarStart, o titulo continua abrindo a topbar", () => {
    render(
      <MemoryRouter>
        <AppShell groups={grupos} pageTitle="Vendas" activePath="/inicio">
          <p>conteúdo da página</p>
        </AppShell>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Vendas" }),
    ).toBeInTheDocument();
  });

  it("com os dois, o titulo fica depois do topbarStart", () => {
    render(
      <MemoryRouter>
        <AppShell
          groups={grupos}
          pageTitle="Vendas"
          activePath="/inicio"
          topbarStart={<button>menu</button>}
        >
          <p>conteúdo da página</p>
        </AppShell>
      </MemoryRouter>,
    );
    const menu = screen.getByRole("button", { name: "menu" });
    const titulo = screen.getByRole("heading", { level: 1, name: "Vendas" });

    expect(
      menu.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("AppShell no celular", () => {
  function montarComGaveta(aberta: boolean, extras: { onNavigate?: (p: string) => void; onCloseMobileMenu?: () => void } = {}) {
    return render(
      <MemoryRouter>
        <button>fora</button>
        <AppShell
          user={{ name: "erick", role: "admin" }}
          groups={grupos}
          activePath="/inicio"
          onNavigate={extras.onNavigate ?? (() => {})}
          mobileMenuOpen={aberta}
          onCloseMobileMenu={extras.onCloseMobileMenu ?? (() => {})}
        >
          <p>conteúdo da página</p>
        </AppShell>
      </MemoryRouter>,
    );
  }

  it("a sidebar fixa some abaixo de sm e volta a partir dele", () => {
    montarComGaveta(false);

    const aside = screen.getByRole("complementary");
    expect(aside).toHaveClass("hidden", "sm:flex");
  });

  it("fechada, a gaveta nao existe no documento", () => {
    montarComGaveta(false);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("aberta, a gaveta traz a navegacao expandida, com o rotulo de cada item", () => {
    montarComGaveta(true);

    const gaveta = screen.getByRole("dialog", { name: "Menu de navegação" });
    expect(within(gaveta).getByRole("link", { name: "Vendas" })).toHaveAttribute("href", "/vendas");
    expect(within(gaveta).getByText("Principal")).toBeInTheDocument();
  });

  it("aberta, o foco entra na gaveta", () => {
    montarComGaveta(true);

    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
  });

  it("navegar pela gaveta leva ao caminho E fecha a gaveta", () => {
    // Os dois, e não um: fechar sem navegar deixaria a pessoa onde estava, e
    // navegar sem fechar deixaria a gaveta cobrindo a tela nova.
    const onNavigate = vi.fn();
    const onCloseMobileMenu = vi.fn();
    montarComGaveta(true, { onNavigate, onCloseMobileMenu });

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Vendas" }));

    expect(onNavigate).toHaveBeenCalledWith("/vendas");
    expect(onCloseMobileMenu).toHaveBeenCalledTimes(1);
  });

  it("Escape fecha a gaveta", () => {
    const onCloseMobileMenu = vi.fn();
    montarComGaveta(true, { onCloseMobileMenu });

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(onCloseMobileMenu).toHaveBeenCalledTimes(1);
  });

  it("tocar na cortina fecha a gaveta", () => {
    const onCloseMobileMenu = vi.fn();
    montarComGaveta(true, { onCloseMobileMenu });

    fireEvent.click(screen.getByTestId("cortina-do-menu"));

    expect(onCloseMobileMenu).toHaveBeenCalledTimes(1);
  });

  it("o botao Fechar menu fecha a gaveta", () => {
    const onCloseMobileMenu = vi.fn();
    montarComGaveta(true, { onCloseMobileMenu });

    fireEvent.click(screen.getByRole("button", { name: "Fechar menu" }));

    expect(onCloseMobileMenu).toHaveBeenCalledTimes(1);
  });

  it("no celular a topbar esconde nome e papel, e o conteudo usa o respiro de celular", () => {
    montarComGaveta(false);

    expect(screen.getByText("erick").parentElement).toHaveClass("hidden", "sm:block");
    expect(screen.getByRole("main")).toHaveClass("p-4", "sm:p-6");
  });
});
