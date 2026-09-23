import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

import { Avatar } from "../core/Avatar";
import { Tooltip } from "../feedback/Tooltip";
import { Icon, type IconName } from "../core/Icon";

export interface NavItem {
  label: string;
  path: string;
  // Divergência registrada do .d.ts de referência: lá `icon` é só `IconName`,
  // o conjunto fechado de traçados do `Icon` (Task 1). Esse conjunto não
  // cobre toda chave que uma sidebar precisa — falta, por exemplo, um
  // equivalente a "chave" (Locação, no DataCoreHS). O design system já
  // resolve esse caso na própria doc do `Icon`: "falta um ícone? pegue o
  // equivalente em Lucide". Por isso `icon` aceita os dois formatos: um
  // `IconName` (string, resolvida aqui via `Icon`) ou um nó React já pronto
  // — o componente Lucide, para quando falta traçado no `ICON_PATHS`.
  icon: IconName | ReactNode;
}

export interface NavGroup {
  /** "Principal", "Gestão", "Administração". */
  label: string;
  items: NavItem[];
}

export interface AppShellProps {
  /** Nome do sistema: HelpHS, ChamadosHS, DataCoreHS… */
  product?: string;
  logoSrc?: string;
  groups?: NavGroup[];
  activePath?: string;
  onNavigate?: (path: string) => void;
  user?: { name: string; role: string };
  version?: string;
  /** Sidebar recolhida para 72px, só ícones. */
  collapsed?: boolean;
  /** Abaixo de `sm` a sidebar fixa some e a navegação vive numa gaveta
   *  sobreposta; quem decide abrir é o app (o botão de menu é dele). */
  mobileMenuOpen?: boolean;
  onCloseMobileMenu?: () => void;
  /** Conteúdo do app à ESQUERDA da topbar, antes do título — é onde mora o
   *  botão que recolhe a sidebar, do lado da sidebar que ele recolhe. */
  topbarStart?: ReactNode;
  /** Conteúdo do app à direita da topbar. */
  topbarActions?: ReactNode;
  pageTitle?: ReactNode;
  children?: ReactNode;
}

interface NavLinkProps {
  item: NavItem;
  collapsed: boolean;
  ativo: boolean;
  onNavigate?: (path: string) => void;
}

/**
 * Um item de navegação — âncora de verdade, não `<button onClick>`. O
 * original do design system usa botão porque o canvas do Claude Design não
 * tem roteador; aqui há um app de verdade por trás, então o item precisa
 * abrir em nova aba (Ctrl/Cmd/clique do meio), aparecer na barra de status
 * e ser anunciado como link. `preventDefault` só roda na navegação simples
 * — o resto o navegador cuida sozinho.
 */
function NavLink({ item, collapsed, ativo, onNavigate }: NavLinkProps) {
  // `item.icon` é `IconName | ReactNode`. `typeof ... === "string"` também
  // seria verdadeiro para um ReactNode que fosse texto puro — não é um caso
  // real de ícone, então o cast para `IconName` aqui é seguro por contrato,
  // não por checagem exaustiva de tipo.
  const icone =
    typeof item.icon === "string" ? (
      <Icon name={item.icon as IconName} size={20} strokeWidth={1.75} className="shrink-0" />
    ) : (
      item.icon
    );

  // Cor de fundo/texto do estado ativo: igual nas duas variantes.
  const corDeAtivo = ativo
    ? "bg-action-tint text-action"
    : "text-conteudo-muted hover:bg-surface-elevated";

  // A barra de 2px marcando o item ativo é só da variante expandida — a
  // especificação do design system para a recolhida é explícita: sem barra
  // lateral, só tint de fundo + cor do ícone. Medido antes do fix: os 2px de
  // `border-l-2` (mesmo com `border-transparent`, a LARGURA da borda
  // continua ocupando espaço) empurravam o conteúdo do link e atrapalhavam
  // a centralização do ícone na coluna de 72px. Por isso a classe de
  // largura de borda nem aparece quando `collapsed` — não é
  // "border-l-2 junto com border-l-0": as duas juntas teriam especificidade
  // igual no CSS gerado pelo Tailwind, e quem ganharia seria a ordem no
  // stylesheet final, não a ordem na string de classe. Mais seguro nunca
  // emitir as duas.
  const bordaDeAtivo = collapsed ? "" : ativo ? "border-action" : "border-transparent";

  const link = (
    <a
      href={item.path}
      aria-current={ativo ? "page" : undefined}
      onClick={(evento) => {
        if (evento.defaultPrevented || evento.button !== 0) return;
        if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
        evento.preventDefault();
        onNavigate?.(item.path);
      }}
      className={[
        "flex items-center gap-2 rounded-lg text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        // Recolhido, o link vira um quadrado de tamanho FIXO (40px — a
        // mesma altura que o item já tinha com `py-2.5`), não um elemento
        // que tenta esticar. Medido: o <Tooltip> que embrulha o link
        // recolhido renderiza o envolvente como `<span class="relative
        // inline-flex">` (Tooltip.tsx) — um inline-flex encolhe até o
        // conteúdo, de propósito, porque o Tooltip é primitivo genérico
        // (um botão com tooltip não deve esticar). Tentar contornar isso
        // esticando o `<a>` (`w-full`) dependeria do inline-flex do
        // Tooltip nunca mudar. Um quadrado de tamanho fixo resolve na
        // raiz: o ícone fica centralizado na CAIXA do link
        // independentemente de o envolvente esticar ou não — e quem
        // centraliza o quadrado no trilho de 72px é o container do grupo
        // (`items-center` abaixo, só quando `collapsed`), não o link. Como
        // bônus, 40×40 é um alvo de toque melhor que os 22px de antes.
        collapsed ? "h-10 w-10 justify-center" : "border-l-2 px-3 py-2",
        bordaDeAtivo,
        corDeAtivo,
      ].join(" ")}
    >
      {icone}
      {!collapsed && <span className="truncate">{item.label}</span>}
    </a>
  );

  // Recolhida, o rótulo do item some do fluxo — o Tooltip é quem carrega o
  // nome dali em diante. `title` nativo demora a aparecer e alguns leitores
  // de tela o ignoram; o Tooltip da Task 7 existe exatamente para isso.
  if (collapsed) {
    return (
      <Tooltip label={item.label} position="right">
        {link}
      </Tooltip>
    );
  }

  return link;
}

interface ConteudoDaSidebarProps {
  product?: string;
  logoSrc?: string;
  grupos: NavGroup[];
  activePath?: string;
  onNavigate?: (path: string) => void;
  version?: string;
  collapsed: boolean;
  /** Ação extra ao lado do logo — o botão de fechar da gaveta de celular. */
  acaoDoTopo?: ReactNode;
}

/** Logo, grupos e rodapé: o que a sidebar fixa e a gaveta de celular mostram
 *  igual. Extraído para as duas não virarem cópias que discordam. */
function ConteudoDaSidebar({
  product,
  logoSrc,
  grupos: gruposVisiveis,
  activePath,
  onNavigate,
  version,
  collapsed,
  acaoDoTopo,
}: ConteudoDaSidebarProps) {
  const inicialProduto = (product ?? "").trim().slice(0, 1).toUpperCase();

  return (
    <>
      <div
        className={[
          "flex h-topbar shrink-0 items-center",
          collapsed ? "justify-center" : "gap-2 px-5",
        ].join(" ")}
      >
        {logoSrc ? (
          <img src={logoSrc} alt={product ?? "Logo"} className="h-7 object-contain" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-action-tint text-sm font-bold text-action">
            {inicialProduto}
          </span>
        )}
        {!collapsed && !logoSrc && product && (
          <span className="truncate text-base font-bold text-conteudo-heading">{product}</span>
        )}
        {acaoDoTopo && <span className="ml-auto">{acaoDoTopo}</span>}
      </div>

      <nav
        className={[
          "flex flex-1 flex-col overflow-y-auto px-2 py-3",
          // Recolhida, o rotulo de texto (que separava os grupos na
          // expandida) some, e o fio de 24px sozinho nao basta: medido
          // contra a --surface da sidebar, --border-color da contraste
          // 1,23:1 no tema claro e 1,39:1 no escuro - abaixo de qualquer
          // limiar de leitura, invisivel na pratica. Trocar so a cor do
          // fio (para --border-strong) nao resolve: sobe pra 1,48:1
          // claro / 2,29:1 escuro, ainda um traco quase invisivel. O
          // sinal que carrega a separacao aqui e o espaco: dobrar o gap
          // do nav so quando recolhida (gap-4 -> gap-8) cria 37px entre
          // o ultimo item de um grupo e o primeiro do proximo, contra
          // 2px entre itens do mesmo grupo (gap-0.5 do container
          // interno) - quase 20x mais. O fio de --border-strong fica
          // como reforco, nao como unico sinal. Expandida continua em
          // gap-4: o rotulo de texto ja faz a separacao la, ninguem
          // pediu mudar o respiro dela.
          collapsed ? "gap-8" : "gap-4",
        ].join(" ")}
      >
        {gruposVisiveis.map((grupo) => (
          <div key={grupo.label} data-testid={`grupo-${grupo.label}`}>
            {collapsed ? (
              <div className="mx-auto mb-1 w-6 border-t border-borda-strong" />
            ) : (
              <p className="mb-1 truncate px-3 text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-conteudo-faint">
                {grupo.label}
              </p>
            )}
            <div
              className={[
                "flex flex-col gap-0.5",
                // O link recolhido agora é um quadrado de tamanho fixo
                // (40px), não um elemento que estica — quem o centraliza
                // no trilho de 72px é este container, via `items-center`.
                // Expandida não leva essa classe: lá o link ainda estica
                // (align-items: stretch, o padrão) para caber o rótulo de
                // texto.
                collapsed ? "items-center" : "",
              ].join(" ")}
            >
              {grupo.items.map((item) => (
                <NavLink
                  key={item.path}
                  item={item}
                  collapsed={collapsed}
                  ativo={item.path === activePath}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="shrink-0 border-t border-borda px-5 py-4 text-center">
          <p className="text-xs font-medium text-conteudo-muted">
            {product} {version}
          </p>
          <p className="text-[11px] text-conteudo-faint">© 2026 Health &amp; Safety Tech</p>
        </div>
      )}
    </>
  );
}

interface GavetaDeNavegacaoProps {
  aoFechar: () => void;
  /** Recebe o botão de fechar, para quem monta o conteúdo decidir onde ele
   *  fica — ao lado do logo. */
  children: (botaoDeFechar: ReactNode) => ReactNode;
}

/**
 * A navegação no celular: a sidebar inteira, expandida, sobreposta à página.
 *
 * Segue o `Modal` onde o problema é o mesmo — a cortina `bg-overlay` decorativa
 * que fecha no toque, `role="dialog"` no painel e não no envolvente, o foco
 * entrando ao abrir e voltando a quem abriu, `Escape` fechando, o fundo sem
 * rolar. Só não prende o `Tab`: a gaveta fecha a qualquer navegação, e o ciclo
 * de foco do `Modal` fica para quando alguém pedir.
 */
function GavetaDeNavegacao({ aoFechar, children }: GavetaDeNavegacaoProps) {
  const painelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const focoAnterior = document.activeElement as HTMLElement | null;
    painelRef.current?.focus();
    const rolagemAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = rolagemAnterior;
      focoAnterior?.focus();
    };
  }, []);

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key !== "Escape") return;
    evento.preventDefault();
    aoFechar();
  }

  const botaoDeFechar = (
    <button
      type="button"
      aria-label="Fechar menu"
      onClick={aoFechar}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-conteudo-muted transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <Icon name="close" size={20} strokeWidth={1.75} />
    </button>
  );

  return (
    <div className="fixed inset-0 z-overlay sm:hidden">
      <div
        aria-hidden="true"
        data-testid="cortina-do-menu"
        onClick={aoFechar}
        className="absolute inset-0 bg-overlay backdrop-blur-[4px]"
      />
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        tabIndex={-1}
        onKeyDown={aoTeclar}
        className="relative flex h-full w-sidebar max-w-[85vw] flex-col border-r border-borda bg-surface shadow-xl focus:outline-none"
      >
        {children(botaoDeFechar)}
      </div>
    </div>
  );
}

/**
 * Casca do aplicativo — sidebar agrupada, topbar de 64px e área de
 * conteúdo. Substitui `Header`/`Sidebar` como o único lugar que desenha a
 * navegação: quem consome só passa dado (`groups`, `user`) e recebe
 * `onNavigate` de volta.
 *
 * ```tsx
 * <AppShell
 *   product="DataCoreHS"
 *   logoSrc={logo}
 *   groups={grupos}
 *   activePath={location.pathname}
 *   onNavigate={navigate}
 *   user={{ name: user.username, role: user.role }}
 *   collapsed={collapsed}
 *   topbarActions={<AcoesDoTopo />}
 * >
 *   <AppRoutes />
 * </AppShell>
 * ```
 */
export function AppShell({
  product,
  logoSrc,
  groups = [],
  activePath,
  onNavigate,
  user,
  version,
  collapsed = false,
  mobileMenuOpen = false,
  onCloseMobileMenu,
  topbarStart,
  topbarActions,
  pageTitle,
  children,
}: AppShellProps) {
  // Um grupo sem nenhum item visível (todos filtrados por permissão de quem
  // monta `groups`) não deve deixar rastro: nem rótulo, nem o separador de
  // 24px recolhido. Filtrar aqui, na casca, é mais seguro do que confiar que
  // todo consumidor faça essa limpeza antes de passar `groups`.
  const gruposVisiveis = groups.filter((grupo) => grupo.items.length > 0);

  return (
    <div className="flex h-full overflow-hidden bg-surface-base font-sans">
      {/* `hidden sm:flex`, e não um `useIsMobile`: a decisão sai do CSS no
          primeiro paint. Com JavaScript, o celular nasceria com a sidebar de
          256px e só a tiraria depois da montagem — o salto que o
          `useIsMobile` documenta para as telas. */}
      <aside
        className={[
          "hidden shrink-0 flex-col overflow-hidden border-r border-borda bg-surface transition-[width] duration-300 ease-in-out sm:flex",
          collapsed ? "w-sidebar-collapsed" : "w-sidebar",
        ].join(" ")}
      >
        <ConteudoDaSidebar
          product={product}
          logoSrc={logoSrc}
          grupos={gruposVisiveis}
          activePath={activePath}
          onNavigate={onNavigate}
          version={version}
          collapsed={collapsed}
        />
      </aside>

      {mobileMenuOpen && (
        <GavetaDeNavegacao aoFechar={() => onCloseMobileMenu?.()}>
          {(fechar) => (
            <ConteudoDaSidebar
              product={product}
              logoSrc={logoSrc}
              grupos={gruposVisiveis}
              activePath={activePath}
              onNavigate={(path) => {
                onNavigate?.(path);
                onCloseMobileMenu?.();
              }}
              version={version}
              collapsed={false}
              acaoDoTopo={fechar}
            />
          )}
        </GavetaDeNavegacao>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-topbar shrink-0 items-center justify-between gap-4 border-b border-borda bg-surface px-4 sm:px-6">
          {/* O lado esquerdo: o que o app puser (o botão de menu) e o
              título. O `justify-between` precisa de dois filhos diretos; sem
              nada à esquerda, o `<span/>` vazio segura a posição. */}
          {topbarStart || pageTitle ? (
            <div className="flex min-w-0 items-center gap-3">
              {topbarStart}
              {pageTitle ? (
                <h1 className="truncate text-base font-semibold text-conteudo-heading">{pageTitle}</h1>
              ) : null}
            </div>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-4">
            {topbarActions}
            {user && (
              <div className="flex items-center gap-3">
                {/* No celular só o avatar fica: nome e papel empurravam a
                    topbar para fora dos 390px. */}
                <div className="hidden text-right leading-tight sm:block">
                  <p className="max-w-[160px] truncate text-sm font-medium text-conteudo">{user.name}</p>
                  <p className="text-xs text-conteudo-muted">{user.role}</p>
                </div>
                <Avatar name={user.name} size="sm" />
              </div>
            )}
          </div>
        </header>

        {/* p-4 é o `--content-padding-mobile` do design system (space-4). */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
