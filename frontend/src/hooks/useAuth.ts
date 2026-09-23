import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

// Um hook para facilitar o uso do contexto de autenticação
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro do AuthProvider");
  }
  return context;
}
