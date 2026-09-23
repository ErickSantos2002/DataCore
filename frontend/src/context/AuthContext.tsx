import React, { createContext, useEffect, useState, ReactNode } from "react";
import api from "../services/api";
import { registrarAoExpirarSessao } from "../services/http";

type AuthContextType = {
  user: { id: number; username: string; role: string } | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
};

export const AuthContext = createContext<AuthContextType>(
  {} as AuthContextType,
);

type Usuario = { id: number; username: string; role: string };

/**
 * A sessão que o login deixou no `localStorage`, ou `null` se falta alguma
 * das quatro chaves — sessão pela metade não conta.
 *
 * Lida no estado INICIAL, e não num `useEffect`: com o efeito, o primeiro
 * render saía sempre com `user` nulo e `loading` ligado, mesmo com a sessão
 * salva, e o app passava um render inteiro achando que ninguém estava logado.
 */
function sessaoSalva(): { user: Usuario; token: string } | null {
  const token = localStorage.getItem("access_token");
  const id = localStorage.getItem("id");
  const username = localStorage.getItem("username");
  const role = localStorage.getItem("role");
  if (!token || !id || !username || !role) return null;
  return { user: { id: Number(id), username, role }, token };
}

function limparSessao() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("username");
  localStorage.removeItem("role");
  localStorage.removeItem("id");
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Um só `useState` para a leitura, para o `localStorage` ser lido uma vez.
  const [sessaoInicial] = useState(sessaoSalva);
  const [user, setUser] = useState<Usuario | null>(sessaoInicial?.user ?? null);
  const [token, setToken] = useState<string | null>(
    sessaoInicial?.token ?? null,
  );
  // Nada a esperar ao abrir: a sessão já saiu do estado inicial. `loading`
  // agora só liga durante um login.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Função de login
  const login = async (username: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.post("/login", { username, password });
      const { access_token } = res.data;

      // salva token
      localStorage.setItem("access_token", access_token);
      setToken(access_token);

      // busca dados do usuário logado
      const me = await api.get("/me", {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const { id, username: userNameFromAPI, role } = me.data;
      const roleName = typeof role === "string" ? role : role?.name || "";

      // salva no localStorage
      localStorage.setItem("id", id.toString());
      localStorage.setItem("username", userNameFromAPI);
      localStorage.setItem("role", roleName);

      // atualiza state
      setUser({ id, username: userNameFromAPI, role: roleName });
    } catch (err: any) {
      // 🧠 Aqui tratamos os erros HTTP
      if (err.response) {
        if (err.response.status === 401) {
          setError("Usuário ou senha incorretos.");
        } else if (err.response.status >= 500) {
          setError("Erro no servidor. Tente novamente mais tarde.");
        } else {
          setError(
            "Erro ao realizar login. Verifique os dados e tente novamente.",
          );
        }
      } else {
        setError("Erro de conexão com o servidor.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Função de logout
  const logout = () => {
    limparSessao();
    setUser(null);
    setToken(null);
    setError(null);
  };

  // Token vencido (8 h) ou usuário excluído: a rede avisa pelo 401 e a sessão
  // cai aqui. Sem usuário, o `ProtectedRoute` manda para o /login, que mostra
  // o `error`. Antes, com o tinyapi ignorando o token, a sessão nunca expirava
  // de verdade — e com a AUTH_OBRIGATORIA ligada a pessoa ficaria diante de
  // telas de erro até achar o botão Sair.
  useEffect(
    () =>
      registrarAoExpirarSessao(() => {
        limparSessao();
        setUser(null);
        setToken(null);
        setError("Sua sessão expirou. Entre de novo.");
      }),
    [],
  );

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, logout, error }}
    >
      {children}
    </AuthContext.Provider>
  );
};
