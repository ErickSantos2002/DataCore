import { Card } from "../../design-system/ui";

export interface CabecalhoServicosProps {
  usuario?: { username?: string; role?: string } | null;
}

/**
 * Cabeçalho da tela de Serviços: título, quem está logado e uma frase sobre
 * o que a tela mostra.
 *
 * Nasceu limpa — segue a lição de Produtos ("cada task limpa o que extrai"):
 * o componente nunca chega a entrar no `PENDENTES_FASE_3`.
 */
export function CabecalhoServicos({ usuario }: CabecalhoServicosProps) {
  return (
    <Card padding="lg">
      <h1 className="text-3xl font-bold text-conteudo-heading">
        Serviços - Dashboard
      </h1>
      <p className="mt-1 text-sm text-conteudo">
        Bem-vindo, <span className="font-semibold">{usuario?.username}</span> (
        {usuario?.role})
      </p>
      <p className="mt-2 text-sm text-conteudo-muted">
        Acompanhe o faturamento de serviços, principais clientes e evolução das
        NFS-e.
      </p>
    </Card>
  );
}
