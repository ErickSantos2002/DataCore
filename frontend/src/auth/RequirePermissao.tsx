import React from "react";

import Bloqueio from "../pages/Bloqueio";
import { Spinner } from "../design-system/ui/core/Spinner";
import { useAuth } from "../hooks/useAuth";
import { podeAcessar } from "./permissoes";

interface RequirePermissaoProps {
  /** A rota, exatamente como está escrita na matriz e no `router.tsx`. */
  rota: string;
  children: React.ReactNode;
}

/**
 * O guarda de rota do DataCoreHS — um só, parametrizado pela rota.
 *
 * Ele substituiu seis componentes que o `router.tsx` definia dentro de si
 * (`RequireAdmin`, `RequireVendas`, `RequireVendedores`, `RequireServicos`,
 * `RequireContasPagar`, `RequireFinanceiro`). Cada um repetia a mesma estrutura
 * com uma condição de papel diferente escrita à mão, e dois deles eram idênticos
 * um ao outro. A condição saiu daqui: quem responde "este usuário entra?" é a
 * matriz em `permissoes.ts`, que a `Sidebar` também consulta — assim o menu não
 * tem como discordar do guarda.
 *
 * A ordem das três saídas é o que importa:
 *
 * 1. `loading` vence primeiro. Enquanto a sessão não chegou do `localStorage`,
 *    `user` é `null`, e consultar a matriz nesse instante faria toda rota
 *    protegida piscar o bloqueio antes de se resolver. Esperar é do guarda;
 *    `podeAcessar` só é chamado com o usuário já em mãos.
 * 2. `podeAcessar` reprova → `<Bloqueio />`. Rota fora da matriz também cai
 *    aqui, porque a matriz nega o que não conhece.
 * 3. Passou → a página.
 *
 * O `RequireAdmin` antigo negava com um texto vermelho solto em vez do
 * `<Bloqueio />`; agora as duas negativas são a mesma tela.
 */
const RequirePermissao: React.FC<RequirePermissaoProps> = ({
  rota,
  children,
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-6 text-conteudo-muted">
        <Spinner size="sm" />
        <span>Verificando permissões...</span>
      </div>
    );
  }

  if (!podeAcessar(rota, user)) return <Bloqueio />;

  return <>{children}</>;
};

export default RequirePermissao;
