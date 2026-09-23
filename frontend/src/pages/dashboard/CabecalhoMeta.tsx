import { Button, Card } from "../../design-system/ui";
import { useToast } from "../../components/ToastProvider";

/** Fluxo do n8n que relê as notas do Tiny e reescreve o faturamento. */
const WEBHOOK_ATUALIZAR_NOTAS =
  "https://n8n.healthsafetytech.com/webhook/f26ad3d8-e178-4a35-93e2-14ae28d2da55";

export interface CabecalhoMetaProps {
  usuario?: { username: string; role: string } | null;
}

/**
 * Cabeçalho da tela: quem está vendo, o que a tela mede e — só para admin —
 * o botão que manda o n8n reler as notas do Tiny.
 *
 * O botão é secundário de propósito. Ele não é o objetivo da tela: a tela é
 * para olhar o quanto falta para a meta, e reprocessar nota é manutenção.
 */
export function CabecalhoMeta({ usuario }: CabecalhoMetaProps) {
  const { sucesso, erro } = useToast();

  async function atualizarNotas() {
    try {
      await fetch(WEBHOOK_ATUALIZAR_NOTAS, { method: "GET", mode: "no-cors" });
      sucesso(
        "Fluxo de busca de notas acionado. Aguarde cerca de 5 minutos para que todas as notas sejam atualizadas.",
      );
    } catch {
      erro("Não foi possível acionar o fluxo.");
    }
  }

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

        {usuario?.role === "admin" && (
          <Button variant="secondary" onClick={atualizarNotas}>
            Atualizar notas de venda
          </Button>
        )}
      </div>
    </Card>
  );
}
