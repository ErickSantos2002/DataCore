import { Card, CardTitle } from "../../design-system/ui";
import type { FaturamentoMensal } from "./ResumoTrimestre";

export interface FaturamentoPorMesProps {
  /** Janeiro até o mês corrente. Não são os meses do trimestre: a barra ao
   *  lado da lista "Trimestre Atual" só ganha assunto próprio quando mostra
   *  o que a lista NÃO mostra. */
  meses: FaturamentoMensal[];
  /** Os rótulos dos meses que formam o trimestre em apuração. Eles são
   *  desenhados na cor cheia; o resto do ano fica em cinza, como contexto. */
  destacar?: string[];
}

/** "Junho/2026" → "Jun". Com o ano inteiro na barra, o nome por extenso não
 *  cabe em doze colunas — e a abreviação de três letras é como o mês se
 *  escreve em qualquer eixo de gráfico em português. */
function abreviarMes(mes: string): string {
  return mes.split("/")[0].slice(0, 3);
}

/** O ano da série, lido do primeiro rótulo ("Junho/2026" → "2026"). */
function anoDaSerie(meses: FaturamentoMensal[]): string {
  return meses[0]?.mes.split("/")[1] ?? "";
}

/**
 * O faturamento mês a mês do ANO, em barras.
 *
 * Anda ao lado de "Trimestre Atual", e por isso não pode repetir o trimestre:
 * duas caixas lado a lado com os mesmos três números não somam informação
 * nenhuma. Aqui a pergunta é outra — como o ano vem se comportando, e onde o
 * trimestre em apuração cai dentro dele. Os meses do trimestre aparecem na
 * cor cheia, o resto do ano em cinza: a sazonalidade fica visível, que é
 * justamente o que a projeção de fechamento usa para estimar o que falta.
 *
 * O dado é de graça: sai da mesma requisição do ano inteiro que o contexto já
 * fazia para o "Total do Ano" e cuja quebra por mês era descartada.
 *
 * A escala é o maior mês do ano, não a meta: o que esta barra compara é mês
 * contra mês. A distância até a meta já é o assunto dos velocímetros.
 */
export function FaturamentoPorMes({
  meses,
  destacar = [],
}: FaturamentoPorMesProps) {
  const maior = meses.reduce((maximo, item) => Math.max(maximo, item.total), 0);
  const doTrimestre = new Set(destacar);
  const ano = anoDaSerie(meses);

  return (
    <Card padding="lg">
      <CardTitle>
        {ano
          ? `Faturamento por mês — ${ano} (R$ mil)`
          : "Faturamento por mês (R$ mil)"}
      </CardTitle>

      {meses.length === 0 ? (
        <p className="mt-4 text-sm text-conteudo-muted">
          Nenhum mês do ano foi apurado ainda. As barras aparecem aqui quando as
          notas do período são sincronizadas com o Tiny ERP.
        </p>
      ) : (
        <>
          <div className="mt-5 flex h-44 items-end gap-2">
            {meses.map((item) => (
              <div
                key={item.mes}
                className="flex h-full flex-1 flex-col items-center gap-1.5"
              >
                <span className="font-mono text-xs text-conteudo-muted">
                  {Math.round(item.total / 1000).toLocaleString("pt-BR")}
                </span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t ${
                      doTrimestre.has(item.mes)
                        ? "bg-primary-500"
                        : "bg-conteudo-faint"
                    }`}
                    style={{
                      height:
                        maior > 0 ? `${(item.total / maior) * 100}%` : "0%",
                    }}
                  />
                </div>
                <span className="text-xs text-conteudo-muted">
                  {abreviarMes(item.mes)}
                </span>
              </div>
            ))}
          </div>

          {destacar.length > 0 && (
            <div className="mt-3 flex gap-5 text-xs text-conteudo-muted">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-sm bg-primary-500"
                  aria-hidden="true"
                />
                Trimestre em apuração
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-sm bg-conteudo-faint"
                  aria-hidden="true"
                />
                Resto do ano
              </span>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
