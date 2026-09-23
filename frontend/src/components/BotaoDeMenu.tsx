import React from "react";
import { Menu } from "lucide-react";

import { Button } from "../design-system/ui/core/Button";
import { Tooltip } from "../design-system/ui/feedback/Tooltip";
import { useIsMobile } from "../hooks/useIsMobile";

export interface BotaoDeMenuProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
  /** No celular a sidebar fixa não existe; o botão de menu abre a gaveta. */
  onOpenMobileMenu: () => void;
}

/**
 * O botão que recolhe a sidebar — ou, no celular, abre a gaveta.
 *
 * Vive no `topbarStart` do `AppShell`, à ESQUERDA, do lado da sidebar que ele
 * recolhe. Até 16/09/2026 era o `Header`, que ficava à direita com o
 * interruptor de tema e o "Sair" — os dois foram para dentro do
 * `MenuDoUsuario`, e o que sobrou aqui é só o botão.
 */
export const BotaoDeMenu: React.FC<BotaoDeMenuProps> = ({
  collapsed,
  onToggleSidebar,
  onOpenMobileMenu,
}) => {
  const isMobile = useIsMobile();

  // Recolher uma sidebar que o celular nem mostra (`hidden sm:flex` no
  // AppShell) deixaria a pessoa sem caminho para a navegação.
  const rotuloDoMenu = isMobile
    ? "Abrir menu"
    : collapsed
      ? "Expandir menu"
      : "Recolher menu";

  return (
    <Tooltip label={rotuloDoMenu}>
      <Button
        variant="ghost"
        size="sm"
        aria-label={rotuloDoMenu}
        onClick={isMobile ? onOpenMobileMenu : onToggleSidebar}
        icon={<Menu size={16} strokeWidth={2} aria-hidden="true" />}
      />
    </Tooltip>
  );
};

export default BotaoDeMenu;
