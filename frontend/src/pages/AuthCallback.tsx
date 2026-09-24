import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../context/ThemeContext";
import { consumirNonceSso, trocarTicket } from "../services/api";
import { Spinner } from "../design-system/ui/core/Spinner";

const TICKET_INVALIDO = "Link de acesso inválido ou expirado.";

/**
 * Volta do login com Microsoft: `/auth/callback?ticket=<opaco>`.
 *
 * O ticket é de uso único e vale 60 s. Ele sai da barra de endereço na hora
 * (não fica no histórico) e é trocado UMA vez: o StrictMode monta o componente
 * duas vezes em dev, e a segunda troca queimaria o ticket e mostraria erro a
 * quem acabou de entrar — daí o `useRef`.
 *
 * Mesmo painel escuro do login, pelo mesmo motivo: aparece antes do tema.
 */
const AuthCallback: React.FC = () => {
  const [parametros] = useSearchParams();
  const navigate = useNavigate();
  const { entrarComToken } = useAuth();
  const { setDarkModeOnLogin } = useTheme();
  const [falhou, setFalhou] = useState(false);
  const iniciado = useRef(false);

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;

    const ticket = parametros.get("ticket");
    window.history.replaceState(null, "", "/auth/callback");

    (async () => {
      try {
        if (!ticket) throw new Error("sem ticket");
        // Sem o nonce, não foi este navegador que clicou no botão: é link de
        // outra pessoa (login CSRF) e entraria na conta dela.
        if (!consumirNonceSso()) throw new Error("sem nonce");
        await entrarComToken(await trocarTicket(ticket));
        setDarkModeOnLogin();
        navigate("/inicio", { replace: true });
      } catch {
        setFalhou(true);
      }
    })();
  }, [parametros, entrarComToken, navigate, setDarkModeOnLogin]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-login">
      <div className="w-full max-w-[360px] rounded-[20px] border border-white/20 bg-white/10 p-8 text-center text-white shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-md">
        {falhou ? (
          <>
            <div
              role="alert"
              className="mb-4 rounded-lg border border-danger bg-tint-danger p-2 text-sm text-white"
            >
              {TICKET_INVALIDO}
            </div>
            <Link
              to="/login"
              replace
              className="rounded font-medium text-white underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Voltar para o login
            </Link>
          </>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <Spinner size="sm" />
            <span>Entrando...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
