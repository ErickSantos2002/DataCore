import { KpiCard } from "../../design-system/ui";
import { emReais, type ResumoDeLocacao } from "./notasDeLocacao";

export interface ResumoLocacaoProps {
  resumo: ResumoDeLocacao;
}

/**
 * A faixa de três KPIs do topo — quanto a locação vale, quantas notas são e
 * quanto vale a nota média.
 *
 * Os três descrevem a base inteira, e não o recorte da busca. A nota de cada
 * cartão diz isso com todas as letras, porque um número que não reage ao
 * campo de busca ao lado é exatamente o tipo de coisa que a pessoa lê errado
 * em silêncio.
 */
export function ResumoLocacao({ resumo }: ResumoLocacaoProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
      <KpiCard
        label="Valor Total em Locação"
        value={`R$ ${emReais(resumo.total)}`}
        tone="acao"
        note="Todas as notas, sem o filtro da busca"
      />
      <KpiCard
        label="Quantidade de Notas"
        value={resumo.quantidade}
        tone="positivo"
        note="Marcadas como Locação no Tiny"
      />
      <KpiCard
        label="Valor Médio"
        value={`R$ ${emReais(resumo.ticketMedio)}`}
        note="Por nota emitida"
      />
    </div>
  );
}
