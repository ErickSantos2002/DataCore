import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./styles/index.css"; // Importa o Tailwind e estilos globais
import AppRoutes from "./router";
import { AppShell } from "./design-system/ui/navigation/AppShell";
import BotaoDeMenu from "./components/BotaoDeMenu";
import MenuDoUsuario from "./components/MenuDoUsuario";
import useNavGroups from "./components/Sidebar";
import CentralButton from "./components/CentralButton";
import { ToastProvider } from "./components/ToastProvider";
import { useAuth } from "./hooks/useAuth";
import logo from "./assets/HS2.ico";

// Rotas onde o layout (AppShell) não deve aparecer (ex: login)
const noLayoutRoutes = ["/login", "/auth/callback"];

const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const groups = useNavGroups();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [menuCelularAberto, setMenuCelularAberto] = useState(false);

  const hideLayout = noLayoutRoutes.includes(location.pathname);

  if (hideLayout) {
    return (
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="h-screen">
        <AppShell
          product="DataCoreHS"
          logoSrc={logo}
          groups={groups}
          activePath={location.pathname}
          onNavigate={(path) => navigate(path)}
          /* Quem desenha o usuário é o `MenuDoUsuario`, no `topbarActions`:
             ali a foto é gatilho de menu, e não texto fixo. Passar `user`
             aqui desenharia o bloco do AppShell junto, duplicado. */
          collapsed={sidebarCollapsed}
          mobileMenuOpen={menuCelularAberto}
          onCloseMobileMenu={() => setMenuCelularAberto(false)}
          topbarStart={
            <BotaoDeMenu
              collapsed={sidebarCollapsed}
              onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
              onOpenMobileMenu={() => setMenuCelularAberto(true)}
            />
          }
          topbarActions={
            user ? (
              <MenuDoUsuario
                usuario={{ name: user.username, role: user.role }}
              />
            ) : undefined
          }
        >
          <AppRoutes />
        </AppShell>
      </div>

      {/* Botão Flutuante Central HS */}
      <CentralButton />
    </ToastProvider>
  );
};

export default App;
