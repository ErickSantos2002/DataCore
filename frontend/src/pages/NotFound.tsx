import React from "react";
import { Link } from "react-router-dom";

/**
 * Rota catch-all (`path="*"`). Não usa `Button` para o CTA porque a ação é
 * navegar para outra rota — precisa continuar sendo um `<a>` de verdade
 * (role="link"), não um `<button onClick>`. As classes abaixo replicam o
 * variant="primary" do Button (mesmos tokens) para ficar visualmente
 * idêntico a um botão primário sem perder a semântica de link.
 */
const NotFound: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-base px-4 text-center">
      <h1 className="mb-4 text-6xl font-extrabold text-conteudo-heading">
        404
      </h1>
      <p className="mb-6 text-xl text-conteudo">Página não encontrada.</p>
      <Link
        to="/dashboard"
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-action bg-action px-6 py-2 font-semibold text-on-primary transition-colors hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        Voltar ao Dashboard
      </Link>
    </div>
  );
};

export default NotFound;
