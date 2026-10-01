import React, { useState } from "react";
import { useConfiguracoes } from "../context/ConfiguracoesContext";
import { useAuth } from "../hooks/useAuth";
import { Alert } from "../design-system/ui/feedback";
import { Card } from "../design-system/ui/core/Card";
import { SecaoComemoracao } from "./configuracoes/SecaoComemoracao";
import { SecaoHistorico } from "./configuracoes/SecaoHistorico";
import { SecaoMeta } from "./configuracoes/SecaoMeta";
import { SecaoOutrosSistemas } from "./configuracoes/SecaoOutrosSistemas";
import { SecaoTrimestre } from "./configuracoes/SecaoTrimestre";

/**
 * Os parâmetros do painel da meta, em seções com nome e explicação — no lugar
 * da lista crua de chave e valor. Cada seção salva a própria chave e mostra o
 * próprio erro; a página só as empilha e avisa o histórico quando algo grava.
 */
const Configuracoes: React.FC = () => {
  const { configuracoes, carregando } = useConfiguracoes();
  const { user, loading } = useAuth();
  // Cada gravação bem-sucedida muda a versão, e o histórico busca de novo.
  const [versaoHistorico, setVersaoHistorico] = useState(0);
  const recarregarHistorico = () => setVersaoHistorico((v) => v + 1);

  // Se ainda está carregando auth
  if (loading) {
    return (
      <div className="p-6 text-conteudo-muted">Verificando permissões...</div>
    );
  }

  // Se não for admin
  if (!user || user.role !== "admin") {
    return (
      <div className="p-6">
        <Alert variant="danger">
          Acesso negado. Esta página é restrita a administradores.
        </Alert>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="p-6 text-conteudo-muted">Carregando configurações...</div>
    );
  }

  const valorDe = (chave: string) =>
    configuracoes.find((c) => c.chave === chave)?.valor;
  // `key` com o valor gravado: quando a gravação muda o valor, a seção recomeça
  // do valor novo (o backend normaliza a META); quando falha, o valor gravado
  // não muda e o que foi digitado fica no campo.

  return (
    <div className="flex flex-col gap-6 p-6">
      <Card padding="lg">
        <h1 className="mb-2 text-3xl font-bold text-conteudo-heading">
          Configurações
        </h1>
        <p className="text-conteudo-muted">Os parâmetros do painel da meta.</p>
      </Card>
      <SecaoMeta
        key={`meta:${valorDe("META")}`}
        valor={valorDe("META")}
        aoSalvar={recarregarHistorico}
      />
      <SecaoTrimestre
        key={`trimestre:${valorDe("TRIMESTRE_APURACAO")}`}
        valor={valorDe("TRIMESTRE_APURACAO")}
        aoSalvar={recarregarHistorico}
      />
      <SecaoComemoracao
        valor={valorDe("ANIMACAO_META")}
        aoSalvar={recarregarHistorico}
      />
      <SecaoOutrosSistemas
        configuracoes={configuracoes}
        aoSalvar={recarregarHistorico}
      />
      <SecaoHistorico versao={versaoHistorico} />
    </div>
  );
};

export default Configuracoes;
