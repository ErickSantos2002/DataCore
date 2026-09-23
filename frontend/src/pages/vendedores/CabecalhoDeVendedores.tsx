import { Card } from "../../design-system/ui";

export interface CabecalhoDeVendedoresProps {
  usuario: string;
  papel?: string;
}

/**
 * Título da tela, quem está logado e a frase de apoio.
 *
 * Nasce limpo, como os de Produtos e Serviços: o título era
 * `dark:text-yellow-400`, amarelo só no tema escuro e sem par no claro —
 * `text-conteudo-heading` sai do token e vira sozinho com o tema.
 */
export function CabecalhoDeVendedores({
  usuario,
  papel,
}: CabecalhoDeVendedoresProps) {
  return (
    <Card padding="lg">
      <h1 className="text-3xl font-bold text-conteudo-heading">
        Vendedores - Dashboard
      </h1>
      <p className="mt-1 text-sm text-conteudo">
        Bem-vindo, <span className="font-semibold">{usuario}</span> ({papel})
      </p>
      <p className="mt-2 text-sm text-conteudo-muted">
        Acompanhe suas métricas de vendas, evolução e gerencie suas notas.
      </p>
    </Card>
  );
}
