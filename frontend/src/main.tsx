// src/main.tsx

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import "./styles/index.css"; // Importa o Tailwind e estilos globais

/**
 * Só o que é global de verdade.
 *
 * Aqui havia uma pirâmide de dez providers em volta do aplicativo inteiro:
 * estoque, vendas, serviços, contas a pagar, contas a receber, dashboard e
 * companhia. Quem abria `/login` montava os dez e disparava a carga de dados de
 * todos eles antes de existir sessão. Cada um passou para o ramo de rota que o
 * consome — ver `router.tsx`.
 *
 * Estes três ficam porque toda rota depende deles, `/login` inclusive: o tema
 * pinta a tela de login, a sessão é o que decide se ela aparece, e o router é
 * quem escolhe a rota.
 */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
