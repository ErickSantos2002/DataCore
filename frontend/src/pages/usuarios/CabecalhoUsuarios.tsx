import { Plus } from "lucide-react";

import { Button, Card } from "../../design-system/ui";
import { contarUsuarios } from "./usuarios";

export interface CabecalhoUsuariosProps {
  /** Quantos usuários a tabela tem — a mesma contagem que a tabela desenha. */
  quantidade: number;
  onNovoUsuario: () => void;
}

/**
 * Cabeçalho da tela: o nome dela, o que ela faz e a única ação primária.
 *
 * O botão de criar é o primeiro `primary` da tela e o único — é o padrão de
 * gerenciamento: a decisão é "cadastrar acesso novo", e tudo o mais na tela
 * (editar, trocar senha, excluir) é ação sobre uma linha, não sobre a tela.
 */
export function CabecalhoUsuarios({
  quantidade,
  onNovoUsuario,
}: CabecalhoUsuariosProps) {
  return (
    <Card padding="lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-conteudo-heading">Usuários</h1>
          <p className="mt-1 text-sm text-conteudo-muted">
            Gerenciamento de acessos — {contarUsuarios(quantidade)}.
          </p>
        </div>

        <Button
          onClick={onNovoUsuario}
          icon={<Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />}
        >
          Novo Usuário
        </Button>
      </div>
    </Card>
  );
}
