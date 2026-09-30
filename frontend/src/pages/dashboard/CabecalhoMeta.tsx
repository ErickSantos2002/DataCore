import { Button, Card } from "../../design-system/ui";
import type { PedidoDeAtualizacao } from "../../services/operacao";
import { useAtualizacaoManual } from "./useAtualizacaoManual";

export interface CabecalhoMetaProps {
  usuario?: { username: string; role: string } | null;
}

function hora(instante: string): string {
  return new Date(instante).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function andamento(pedido: PedidoDeAtualizacao): string {
  return pedido.iniciado_em
    ? `Atualizando desde ${hora(pedido.iniciado_em)}`
    : `Na fila desde ${hora(pedido.pedido_em)}`;
}

/**
 * Cabeçalho da tela: quem está vendo, o que a tela mede e — só para admin —
 * o botão que puxa agora as notas fiscais, as notas de serviço e refaz os
 * dados analíticos, sem esperar o horário dos timers.
 *
 * O botão é secundário de propósito. Ele não é o objetivo da tela: a tela é
 * para olhar o quanto falta para a meta, e atualizar a carga é manutenção.
 */
export function CabecalhoMeta({ usuario }: CabecalhoMetaProps) {
  const admin = usuario?.role === "admin";
  const { pedido, aberto, enviando, pedir } = useAtualizacaoManual(admin);

  return (
    <Card padding="lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-conteudo-heading">
            Meta do trimestre
          </h1>
          <p className="mt-1 text-conteudo">
            Bem-vindo,{" "}
            <span className="font-semibold">{usuario?.username}</span> (
            {usuario?.role})
          </p>
          <p className="mt-2 max-w-2xl text-sm text-conteudo-muted">
            O faturamento considera as notas fiscais de venda e de serviço do
            trimestre corrente. A META é anual e o PL é apurado por trimestre,
            sobre META÷4. As três faixas âncora abaixo pagam PL de 55%, 85% e
            100% — ao atingir cada marcação, a equipe recebe o PL proporcional.
          </p>
        </div>

        {admin && (
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="secondary"
              onClick={pedir}
              loading={enviando || aberto}
            >
              Atualizar dados agora
            </Button>
            {aberto && pedido && (
              <p className="text-xs text-conteudo-muted">{andamento(pedido)}</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
