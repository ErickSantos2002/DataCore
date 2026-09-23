import React from "react";
import { Helmet } from "react-helmet";
import { Alert } from "../design-system/ui/feedback";

/**
 * Tela de acesso negado — devolvida no lugar da rota protegida quando o
 * papel do usuário não permite entrar. O h1 original piscava em loop
 * infinito entre preto/branco e vermelho (`animate-blinkLight` /
 * `animate-blinkDark`, 1s infinite) — removido: texto piscando sem parar é
 * falha de acessibilidade (WCAG 2.2.2) e o checklist do design system proíbe
 * qualquer animação em loop fora do spinner. A cor de perigo agora é
 * estática, carregada pelo `Alert`.
 */
const Bloqueio: React.FC = () => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <Helmet>
        <title>Acesso negado | DataCoreHS</title>
      </Helmet>

      <h1 className="text-2xl font-bold text-conteudo-heading">
        Acesso negado
      </h1>

      <div className="w-full max-w-md">
        <Alert variant="danger">
          Você não tem permissão para acessar esta página.
        </Alert>
      </div>
    </div>
  );
};

export default Bloqueio;
