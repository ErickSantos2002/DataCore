import type { ReactNode } from "react";

import { Badge, Card } from "../../design-system/ui";
import {
  formatarDinheiro,
  formatarDinheiroOuTraco,
  type CalculoDeCusto,
  type ResumoDoSistema,
} from "./centroCusto";

export interface ResumoDoCustoProps {
  resumo: ResumoDoSistema | null;
  calculo: CalculoDeCusto;
}

/**
 * Uma linha rótulo-à-esquerda / valor-à-direita do resumo.
 *
 * O destaque é prop, e não um `<span>` embrulhando o rótulo: o rótulo e o
 * valor precisam continuar irmãos dentro da mesma linha para que se leia "o
 * quê" e "quanto" como um par só — embrulhar o rótulo o afastaria um nível do
 * valor que ele nomeia.
 */
function Linha({
  rotulo,
  valor,
  destaque = false,
  className,
}: {
  rotulo: ReactNode;
  valor: ReactNode;
  destaque?: boolean;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={
          destaque ? "font-bold text-conteudo-heading" : "text-conteudo-muted"
        }
      >
        {rotulo}
      </span>
      <span
        className={`font-mono tabular-nums ${className ?? "text-conteudo"}`}
      >
        {valor}
      </span>
    </div>
  );
}

/** Verde no lucro, vermelho no prejuízo, apagado no que não dá para calcular. */
function tomDaMargem(valor: number | null): string {
  if (valor === null) return "text-conteudo-faint";
  return valor >= 0 ? "text-success" : "text-danger";
}

/**
 * A coluna da direita: o que o sistema já sabe, o custo que o formulário
 * apurou e a fórmula de cada termo.
 *
 * A separação entre "Dados do Sistema" e "Resumo de Custos" é a que importa
 * na leitura: o primeiro bloco é medição — receita e quantidade que já
 * aconteceram —, o segundo é projeção, montada com o que a pessoa digitou.
 * Quando ela sobrescreve preço ou quantidade, o selo MANUAL diz exatamente
 * onde a medição parou e o palpite começou.
 */
export function ResumoDoCusto({ resumo, calculo }: ResumoDoCustoProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card padding="lg">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-conteudo-faint">
          Dados do Sistema
        </p>
        <div className="flex flex-col gap-2 text-sm">
          <Linha
            rotulo="Receita Real"
            valor={resumo ? formatarDinheiro(resumo.receita) : "—"}
            className="font-semibold text-conteudo-heading"
          />
          <Linha
            rotulo="Qtd Vendida"
            valor={resumo ? `${resumo.quantidade.toFixed(0)} un` : "—"}
            className="font-semibold text-conteudo-heading"
          />
          <Linha
            rotulo="Ticket Médio"
            valor={
              calculo.ticketMedioSistema
                ? formatarDinheiro(calculo.ticketMedioSistema)
                : "—"
            }
            className="font-semibold text-conteudo-heading"
          />
        </div>

        {(calculo.usandoQtdManual || calculo.usandoPrecoManual) && (
          <div className="mt-3 flex flex-col gap-2 border-t border-borda pt-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-on-tint-warning">
              Usando projeção
            </p>
            {calculo.usandoQtdManual && (
              <Linha
                rotulo="Unidades/ano"
                valor={`${calculo.qtdPlanejada.toFixed(0)} un`}
                className="font-bold text-on-tint-warning"
              />
            )}
            {calculo.usandoPrecoManual && (
              <Linha
                rotulo="Preço manual"
                valor={formatarDinheiro(calculo.precoPlanejado)}
                className="font-bold text-on-tint-warning"
              />
            )}
          </div>
        )}
      </Card>

      <Card padding="lg">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-conteudo-faint">
          Resumo de Custos / Unidade
        </p>
        <div className="flex flex-col gap-2 text-sm">
          <Linha
            rotulo="Serviços Aduaneiros"
            valor={formatarDinheiroOuTraco(calculo.custoAduaneiroPorUn)}
          />
          <Linha
            rotulo="Custos Diretos"
            valor={
              calculo.totalDireto > 0
                ? formatarDinheiro(calculo.totalDireto)
                : "—"
            }
          />
          <Linha
            rotulo="Overhead"
            valor={formatarDinheiroOuTraco(calculo.overheadPorUn)}
          />

          <div className="mt-2 border-t border-borda pt-2">
            <Linha
              rotulo="Custo Total"
              destaque
              valor={
                calculo.custoTotalPorUn > 0
                  ? formatarDinheiro(calculo.custoTotalPorUn)
                  : "—"
              }
              className="text-base font-bold text-conteudo-heading"
            />
          </div>

          <Linha
            rotulo={
              <>
                Preço Unitário
                {calculo.usandoPrecoManual && (
                  <Badge variant="warning" className="ml-1.5">
                    MANUAL
                  </Badge>
                )}
              </>
            }
            valor={
              calculo.ticketMedio ? formatarDinheiro(calculo.ticketMedio) : "—"
            }
          />

          <div className="mt-2 border-t border-borda pt-2">
            <Linha
              rotulo="Margem / unidade"
              destaque
              valor={formatarDinheiroOuTraco(calculo.margemPorUn)}
              className={`font-bold ${tomDaMargem(calculo.margemPorUn)}`}
            />
            {calculo.margemPct !== null && (
              <div className="mt-1">
                <Linha
                  rotulo="Margem %"
                  valor={`${calculo.margemPct.toFixed(1)}%`}
                  className={`font-bold ${tomDaMargem(calculo.margemPct)}`}
                />
              </div>
            )}
          </div>

          {calculo.margemTotalProjetada !== null && calculo.qtdEfetiva > 0 && (
            <div className="mt-2 flex flex-col gap-1 border-t border-borda pt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-conteudo-faint">
                Projeção — {calculo.qtdEfetiva.toFixed(0)} un{" "}
                {calculo.usandoQtdManual ? "(manual)" : "(sistema)"}
              </p>
              {calculo.receitaProjetada !== null && (
                <Linha
                  rotulo="Receita Projetada"
                  valor={formatarDinheiro(calculo.receitaProjetada)}
                />
              )}
              <Linha
                rotulo="Margem Total"
                destaque
                valor={formatarDinheiro(calculo.margemTotalProjetada)}
                className={`font-bold ${tomDaMargem(calculo.margemTotalProjetada)}`}
              />
            </div>
          )}
        </div>
      </Card>

      <Card padding="lg" className="bg-surface-elevated">
        <p className="mb-2 text-xs font-semibold text-conteudo">
          Como é calculado
        </p>
        <div className="flex flex-col gap-1.5 text-xs text-conteudo-muted">
          <p>
            <span className="font-medium text-action">Aduaneiro/un</span> = Σ
            NFs × % NF ÷ unid. importadas
          </p>
          <p>
            <span className="font-medium text-conteudo">Direto/un</span> = Σ
            custos por unidade
          </p>
          <p>
            <span className="font-medium text-action">Overhead/un</span> = Anual
            × % estoque ÷ qtd planejada
          </p>
          <p className="border-t border-borda pt-1">
            <span className="font-bold text-conteudo-heading">Margem/un</span> =
            Preço − Custo Total
          </p>
          <p>
            <span className="font-medium text-on-tint-warning">Projeção</span> =
            Margem/un × Qtd planejada
          </p>
        </div>
      </Card>
    </div>
  );
}
