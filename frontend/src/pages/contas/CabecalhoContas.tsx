import { Card } from "../../design-system/ui";

export interface CabecalhoContasProps {
  titulo: string;
  /** Uma frase dizendo de onde vem a lista. */
  descricao: string;
  usuario?: { username?: string; role?: string } | null;
}

/**
 * O topo das duas telas de Contas: o nome da tela, quem está logado e de onde
 * vêm os dados.
 *
 * A linha do usuário continua sendo a que as telas tinham — ela é a única
 * confirmação visível de qual perfil está olhando números de dinheiro, e o
 * teste de caracterização lê exatamente esse par (nome em negrito, papel
 * entre parênteses).
 */
export function CabecalhoContas({
  titulo,
  descricao,
  usuario,
}: CabecalhoContasProps) {
  return (
    <Card padding="lg">
      <h1 className="text-3xl font-bold text-conteudo-heading">{titulo}</h1>
      <p className="mt-1 text-sm text-conteudo">
        Bem-vindo, <span className="font-semibold">{usuario?.username}</span> (
        {usuario?.role})
      </p>
      <p className="mt-2 text-sm text-conteudo-muted">{descricao}</p>
    </Card>
  );
}
