import { Alert } from "../../design-system/ui/feedback";
import { Card } from "../../design-system/ui/core/Card";
import { Switch } from "../../design-system/ui/forms/Switch";
import type { SecaoProps } from "./SecaoMeta";
import { useSalvarConfiguracao } from "./useSalvarConfiguracao";

export function SecaoComemoracao({ valor, aoSalvar }: SecaoProps) {
  const { salvar, erro } = useSalvarConfiguracao("ANIMACAO_META", aoSalvar);
  const ligada = valor === "true";

  return (
    <Card padding="lg">
      <h2 className="text-lg font-semibold text-conteudo-heading">
        Comemoração
      </h2>
      <p className="mt-1 text-sm text-conteudo-muted">
        Confete ao abrir o painel quando o trimestre já bateu algum degrau.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <Switch
          checked={ligada}
          onChange={(marcado) => salvar(marcado ? "true" : "false")}
          label={ligada ? "Ativada" : "Desativada"}
        />
        {erro && <Alert variant="danger">{erro}</Alert>}
      </div>
    </Card>
  );
}
