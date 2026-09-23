import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Moon } from "lucide-react";

import { Avatar } from "../design-system/ui/core/Avatar";
import { Switch } from "../design-system/ui/forms/Switch";
import { useAuth } from "../hooks/useAuth";
import { useCliqueFora } from "../hooks/useCliqueFora";
import { useTheme } from "../context/ThemeContext";

/** Liga o gatilho ao painel para quem usa leitor de tela. */
const ID_DO_PAINEL = "menu-do-usuario";

export interface MenuDoUsuarioProps {
  usuario: { name: string; role: string };
}

/**
 * O menu do usuário da topbar: a foto é o gatilho.
 *
 * Até 16/09/2026 a topbar tinha o interruptor de tema e o botão "Sair"
 * soltos ao lado do menu, e o avatar com nome e papel era texto fixo, sem
 * ação nenhuma. As duas ações passam para dentro do painel que a foto abre —
 * o desenho do header do HelpHS.
 *
 * O painel fecha no clique fora (`useCliqueFora`, o mesmo dos multiselects) e
 * no Escape. Nos dois casos o foco volta para a foto: fechar sem devolver o
 * foco deixa quem navega por teclado no começo do documento, porque o
 * elemento focado saiu da árvore e o navegador recua para o `<body>`.
 *
 * O que NÃO tem aqui, de propósito: armadilha de foco dentro do painel.
 * Prender o `Tab` muda mais do que o pedido, e um painel que não prende
 * continua utilizável — um que prende e erra, não.
 *
 * E não é `role="menu"`: esse papel promete navegação por seta entre
 * `menuitem`s, que não existe aqui, e ainda tem um interruptor dentro, que
 * não é item de menu. Prometer menos e cumprir vale mais — o painel é um
 * `<div>` comum, ligado ao gatilho por `aria-controls`, e o "Sair" continua
 * sendo anunciado como o botão que é.
 */
const MenuDoUsuario: React.FC<MenuDoUsuarioProps> = ({ usuario }) => {
  const { logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();

  const [aberto, setAberto] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);

  const fechar = useCallback(() => {
    setAberto(false);
    gatilho.current?.focus();
  }, []);

  useCliqueFora(container, fechar, aberto);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") fechar();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, fechar]);

  const sair = () => {
    logout();
    navigate("/login");
  };

  return (
    <div ref={container} className="relative">
      <button
        ref={gatilho}
        type="button"
        onClick={() => setAberto((estava) => !estava)}
        aria-label={`Menu do usuário — ${usuario.name}`}
        aria-expanded={aberto}
        aria-controls={ID_DO_PAINEL}
        className={[
          "flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors",
          "hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
          aberto ? "bg-surface-elevated" : "",
        ].join(" ")}
      >
        <Avatar name={usuario.name} size="sm" />
        {/* No celular só a foto: nome e papel empurravam a topbar para fora
            dos 390px — a mesma razão que o AppShell tinha. */}
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-[160px] truncate text-sm font-medium text-conteudo">
            {usuario.name}
          </span>
          <span className="block text-xs text-conteudo-muted">
            {usuario.role}
          </span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden="true"
          className="hidden text-conteudo-muted sm:block"
        />
      </button>

      {aberto ? (
        <div
          id={ID_DO_PAINEL}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-dropdown w-56 rounded-xl border border-borda bg-surface py-1 shadow-lg"
        >
          <div className="border-b border-borda px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-conteudo-heading">
              {usuario.name}
            </p>
            <p className="truncate text-xs text-conteudo-muted">
              {usuario.role}
            </p>
          </div>

          {/* `flex-row-reverse` põe o interruptor na ponta direita, com o
              rótulo e o ícone à esquerda — e o ícone vive DENTRO do `<label>`,
              então clicar nele também alterna. */}
          <Switch
            checked={darkMode}
            onChange={toggleDarkMode}
            size="sm"
            className="w-full flex-row-reverse justify-between px-3 py-2 hover:bg-surface-elevated"
            label={
              <span className="flex flex-1 items-center gap-2.5 text-sm text-conteudo">
                <Moon
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="text-conteudo-muted"
                />
                Modo escuro
              </span>
            }
          />

          <div className="mt-1 border-t border-borda pt-1">
            <button
              type="button"
              onClick={sair}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-on-tint-danger transition-colors hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <LogOut size={16} strokeWidth={2} aria-hidden="true" />
              Sair
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MenuDoUsuario;
