import React, { useState } from "react";
import { useConfiguracoes } from "../context/ConfiguracoesContext";
import { useAuth } from "../hooks/useAuth";
import { Alert } from "../design-system/ui/feedback";
import { Button } from "../design-system/ui/core/Button";
import { Card } from "../design-system/ui/core/Card";
import { Input } from "../design-system/ui/forms/Input";
import { Switch } from "../design-system/ui/forms/Switch";

const Configuracoes: React.FC = () => {
  const { configuracoes, carregando, editarConfiguracao } = useConfiguracoes();
  const { user, loading } = useAuth();
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [novoValor, setNovoValor] = useState<string>("");

  const iniciarEdicao = (id: number, valorAtual: string) => {
    setEditandoId(id);
    setNovoValor(valorAtual);
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setNovoValor("");
  };

  const salvarEdicao = async (id: number, chave: string) => {
    await editarConfiguracao(chave, novoValor);
    cancelarEdicao();
  };

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

  return (
    <div className="p-6">
      {/* Card de título e descrição */}
      <Card padding="lg" className="mb-6">
        <h1 className="mb-2 text-3xl font-bold text-conteudo-heading">
          Configurações
        </h1>
        <p className="text-conteudo-muted">
          Gerencie os parâmetros utilizados no Dashboard.
        </p>
      </Card>

      {/* Lista de configurações */}
      <Card>
        {configuracoes.map((cfg) => (
          <div
            key={cfg.id}
            className="flex w-full flex-col gap-4 border-b border-borda py-4 md:flex-row md:items-center"
          >
            <div className="flex-1">
              {editandoId === cfg.id ? (
                <Input
                  label={cfg.chave}
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                  spellCheck={false}
                  className="font-mono"
                />
              ) : (
                <>
                  <p className="mb-1 text-sm font-semibold text-conteudo-muted">
                    {cfg.chave}
                  </p>
                  {cfg.chave === "ANIMACAO_META" ? (
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={cfg.valor === "true"}
                        onChange={(checked) =>
                          editarConfiguracao(
                            cfg.chave,
                            checked ? "true" : "false",
                          )
                        }
                        label={cfg.valor === "true" ? "Ativada" : "Desativada"}
                      />
                    </div>
                  ) : (
                    <p className="mt-1 whitespace-pre-line break-words text-sm text-conteudo">
                      {cfg.valor}
                    </p>
                  )}
                </>
              )}
            </div>

            {cfg.chave !== "ANIMACAO_META" && (
              <div className="flex gap-2 md:ml-4">
                {editandoId === cfg.id ? (
                  <>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => salvarEdicao(cfg.id, cfg.chave)}
                    >
                      Salvar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={cancelarEdicao}
                    >
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => iniciarEdicao(cfg.id, cfg.valor)}
                  >
                    Editar
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
};

export default Configuracoes;
