import React from "react";
import { Helmet } from "react-helmet";
import { Alert } from "../design-system/ui/feedback";

interface EmConstrucaoProps {
  titulo: string;
}

/**
 * Placeholder para telas ainda não implementadas. O h1 original trocava de
 * cor entre temas sem motivo documentado (`text-blue-600 dark:text-yellow-400`)
 * — aqui usa o token neutro de heading, e o aviso de "ainda não pronto" vira
 * `Alert` variant="warning" (o mesmo sentido do amarelo que só aparecia no
 * escuro antes).
 */
const EmConstrucao: React.FC<EmConstrucaoProps> = ({ titulo }) => {
  return (
    <div className="flex h-[calc(100vh-80px)] flex-col items-center justify-center gap-4 px-4 text-center">
      <Helmet>
        <title>{titulo} | DataCoreHS</title>
      </Helmet>

      <h1 className="text-2xl font-bold text-conteudo-heading">
        Em construção
      </h1>

      <div className="w-full max-w-md">
        <Alert variant="warning">
          Em breve teremos gráficos e análises aqui para ajudar na sua tomada de
          decisão.
        </Alert>
      </div>
    </div>
  );
};

export default EmConstrucao;
