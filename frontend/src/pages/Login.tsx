"use client";

import React, { useState, useEffect } from "react";
import { User } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import logo from "../assets/logo.png";
import logoMicrosoft from "../assets/microsoft.svg";
import { irParaLoginMicrosoft, ssoAtivo } from "../services/api";
import { mensagemDeErroSso } from "../auth/erroSso";
import { useTheme } from "../context/ThemeContext";
import { Button } from "../design-system/ui/core/Button";

/**
 * Painel de login — escuro nos dois temas, de proposito (excecao documentada
 * do design system): a tela aparece antes de qualquer preferencia de tema
 * ser aplicada, entao nao pode reagir a ela. `bg-login` (fundo cheio) e
 * `bg-tooltip` (circulo do avatar) substituem os dois ultimos hexadecimais
 * arbitrarios do projeto (`bg-[#0a192f]` e `bg-[#0f172a]`) por classes de
 * token que resolvem para o MESMO valor nos dois temas - nunca `bg-surface`,
 * que clareia no tema claro. O icone de usuario, que vinha de servidor
 * remoto, virou lucide-react.
 */
const Login: React.FC = () => {
  const { login, loading, error, user } = useAuth();
  const { setDarkModeOnLogin } = useTheme(); // 👈 use a nova função
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [parametros, setParametros] = useSearchParams();
  // Lido uma vez: o parâmetro sai da URL logo abaixo, e a mensagem fica.
  const [erroSso] = useState(() =>
    mensagemDeErroSso(parametros.get("erro_sso")),
  );
  const [mostrarMicrosoft, setMostrarMicrosoft] = useState(false);

  useEffect(() => {
    if (parametros.has("erro_sso")) setParametros({}, { replace: true });
  }, [parametros, setParametros]);

  // O botão só aparece com o SSO configurado no backend. Enquanto a resposta
  // não chega (ou se ela falha), o login por senha já está de pé.
  useEffect(() => {
    let montado = true;
    ssoAtivo().then((ativo) => {
      if (montado) setMostrarMicrosoft(ativo);
    });
    return () => {
      montado = false;
    };
  }, []);

  const mensagem = error ?? erroSso;

  useEffect(() => {
    if (user) {
      // ✅ Ativa via contexto (não manualmente)
      setDarkModeOnLogin();

      if (location.pathname !== "/inicio") {
        navigate("/inicio", { replace: true });
      }
    }
  }, [user, navigate, location.pathname, setDarkModeOnLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(username, password);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-login">
      {/* Card vidro fosco */}
      <div className="relative w-full max-w-[360px] rounded-[20px] border border-white/20 bg-white/10 px-8 pb-8 pt-14 text-center shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-md">
        {/* Ícone de usuário no topo */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 transform">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/30 bg-tooltip shadow-lg">
            <User className="h-10 w-10 text-white" aria-hidden="true" />
          </div>
        </div>

        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <img src={logo} alt="Logo" className="max-h-[60px] object-contain" />
        </div>

        {/* Título */}
        <h1 className="mb-1 text-[22px] font-bold text-white">Bem-vindo</h1>
        <p className="mb-6 text-sm text-white/70">Faça login para continuar</p>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label htmlFor="username" className="sr-only">
            Usuário
          </label>
          <input
            id="username"
            type="text"
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            placeholder="Usuário"
            className="h-[48px] w-full rounded-lg bg-white/20 px-4 text-white placeholder-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
            required
          />

          <label htmlFor="password" className="sr-only">
            Senha
          </label>
          <input
            id="password"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="Senha"
            className="h-[48px] w-full rounded-lg bg-white/20 px-4 text-white placeholder-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
            required
          />

          {/* `role="alert"`: sem ele a mensagem aparecia calada para o leitor
              de tela. Texto branco, e não `text-danger`: #ef4444 sobre o fundo
              composto do cartão (#413344) dava 3,13:1, abaixo do AA de 4,5:1.
              Branco dá 11,78:1, e a borda e o fundo vermelhos seguem dizendo
              que é erro. O painel é escuro nos dois temas. */}
          {mensagem && (
            <div
              role="alert"
              className="rounded-lg border border-danger bg-tint-danger p-2 text-center text-sm text-white"
            >
              {mensagem}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={loading}
            className="mt-2"
          >
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        {mostrarMicrosoft && (
          <>
            <div
              className="my-5 flex items-center gap-3 text-xs text-white/60"
              aria-hidden="true"
            >
              <span className="h-px flex-1 bg-white/20" />
              ou
              <span className="h-px flex-1 bg-white/20" />
            </div>
            {/* Botão cru, como os campos acima: o painel é escuro nos dois
                temas (exceção documentada), e o `Button` do design system
                segue o tema. Navegação, não fetch: é redirect entre domínios. */}
            <button
              type="button"
              onClick={irParaLoginMicrosoft}
              disabled={loading}
              className="flex h-[48px] w-full items-center justify-center gap-3 rounded-lg border border-white/30 bg-white/10 font-medium text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
            >
              <img src={logoMicrosoft} alt="" className="h-5 w-5" />
              Entrar com Microsoft
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
