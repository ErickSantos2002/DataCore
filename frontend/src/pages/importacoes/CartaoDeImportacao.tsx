import { Badge, Card, CardBody } from "../../design-system/ui";
import type { Importacao } from "../../services/operacao";
import {
  demorouMaisQueOCostume,
  descreverContagens,
  formatarDuracao,
  formatarInstante,
  horariosLegiveis,
  horariosNaVps,
  resumoDaDuracao,
  rotuloDoEstado,
  type TomDoEstado,
} from "./importacoes";

/** O tom da conta pura, traduzido para a variante do Badge do design system. */
const VARIANTE: Record<
  TomDoEstado,
  "success" | "danger" | "warning" | "info" | "muted"
> = {
  ok: "success",
  erro: "danger",
  alerta: "warning",
  info: "info",
  neutro: "muted",
};

export interface CartaoDeImportacaoProps {
  importacao: Importacao;
  /** Abre o histórico já filtrado nesta carga. */
  onVerHistorico: (job: string) => void;
}

/**
 * Uma importação: o que ela faz, quando roda, como foi a última vez e quanto
 * costuma demorar.
 *
 * A ordem dos blocos é a ordem das perguntas de quem abre a tela preocupado:
 * primeiro **está tudo bem?** (o selo de estado e a mensagem), depois **quando
 * rodou e o que trouxe**, e só então **quando roda** e **quanto demora**, que
 * são consulta, não susto.
 */
export function CartaoDeImportacao({
  importacao,
  onVerHistorico,
}: CartaoDeImportacaoProps) {
  const estado = rotuloDoEstado(importacao.estado);
  const lenta = demorouMaisQueOCostume(importacao);

  return (
    <Card padding="lg">
      <CardBody className="space-y-4 p-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-conteudo-heading">
              {importacao.rotulo}
            </h3>
            <p className="mt-1 text-sm text-conteudo-muted">
              {importacao.descricao}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant={VARIANTE[estado.tom]}>{estado.texto}</Badge>
            {!importacao.ativo && <Badge variant="muted">Pausada</Badge>}
          </div>
        </div>

        {importacao.mensagem && (
          <p className="text-sm text-conteudo">{importacao.mensagem}</p>
        )}

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-conteudo-muted">Última execução</dt>
            <dd className="text-conteudo-heading">
              {formatarInstante(importacao.ultimo_inicio)}
              {importacao.ultima_duracao_seg !== null && (
                <span className="text-conteudo-muted">
                  {" "}
                  · durou {formatarDuracao(importacao.ultima_duracao_seg)}
                </span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-conteudo-muted">O que trouxe</dt>
            <dd className="text-conteudo-heading">
              {descreverContagens(importacao.ultimas_contagens)}
            </dd>
          </div>

          <div>
            <dt className="text-conteudo-muted">Horário</dt>
            {/* O horário local é o que interessa a quem lê; o de UTC vai junto,
                menor, porque é o que está escrito no timer de quem for mexer. */}
            <dd className="text-conteudo-heading">
              {importacao.ativo
                ? `Todo dia às ${horariosLegiveis(importacao.horarios)}`
                : "Não está agendada"}
              <span className="block text-xs text-conteudo-muted">
                na VPS: {horariosNaVps(importacao.horarios)}
              </span>
            </dd>
          </div>

          <div>
            <dt className="text-conteudo-muted">Quanto costuma demorar</dt>
            <dd className="text-conteudo-heading">
              {resumoDaDuracao(importacao)}
              {lenta && (
                <span className="block text-xs text-warning">
                  a última demorou bem mais que o normal
                </span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-conteudo-muted">Origem dos dados</dt>
            <dd className="text-conteudo-heading">{importacao.fonte}</dd>
          </div>

          <div>
            <dt className="text-conteudo-muted">Últimos 30 dias</dt>
            <dd className="text-conteudo-heading">
              {importacao.execucoes_30d} execuções
              {importacao.falhas_30d > 0 && (
                <span className="text-danger">
                  {" "}
                  · {importacao.falhas_30d} com falha
                </span>
              )}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() => onVerHistorico(importacao.job)}
          className="text-sm font-medium text-action hover:underline"
        >
          Ver histórico desta importação
        </button>
      </CardBody>
    </Card>
  );
}
