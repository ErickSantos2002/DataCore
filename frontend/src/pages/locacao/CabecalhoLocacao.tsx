import { Card } from "../../design-system/ui";

export interface CabecalhoLocacaoProps {
  usuario?: { username: string } | null;
}

/**
 * Cabeçalho da tela: o nome dela e de onde vêm as notas que ela lista.
 *
 * A frase importa mais do que parece — "Locação" sozinho não diz que a tela
 * mostra nota fiscal, e não contrato. O que define a lista é o marcador
 * `Locação` no Tiny, e é isso que está escrito.
 */
export function CabecalhoLocacao({ usuario }: CabecalhoLocacaoProps) {
  return (
    <Card padding="lg">
      <h1 className="text-3xl font-bold text-conteudo-heading">Locação</h1>
      <p className="mt-1 text-sm text-conteudo-muted">
        Notas fiscais marcadas como{" "}
        <span className="font-semibold">Locação</span> no Tiny ERP
        {usuario?.username ? ` — ${usuario.username}` : ""}
      </p>
    </Card>
  );
}
