import { Card } from "../../design-system/ui";

export interface CabecalhoDeVendasProps {
  usuario?: { username?: string; role?: string } | null;
}

/**
 * Título da tela, quem está logado e a frase de apoio.
 *
 * Nasce limpo, como os das outras telas do Comercial: o título era
 * `dark:text-yellow-400`, amarelo só no escuro.
 */
export function CabecalhoDeVendas({ usuario }: CabecalhoDeVendasProps) {
  return (
    <Card padding="lg">
      <h1 className="text-3xl font-bold text-conteudo-heading">
        Vendas - Dashboard
      </h1>
      <p className="mt-1 text-sm text-conteudo">
        Bem-vindo, <span className="font-semibold">{usuario?.username}</span> (
        {usuario?.role})
      </p>
      <p className="mt-2 text-sm text-conteudo-muted">
        Acompanhe as principais métricas, evolução e detalhes das vendas em
        tempo real.
      </p>
    </Card>
  );
}
