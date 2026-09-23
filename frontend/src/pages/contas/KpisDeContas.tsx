import { KpiCard } from "../../design-system/ui";
import { formatarMoeda, type KpisDeContas as Kpis } from "./contas";

export interface KpisDeContasProps {
  kpis: Kpis;
  /** "Total a Receber" numa tela, "Total em Aberto" na outra. */
  rotuloDoAberto: string;
  /** "Total Recebido" numa tela, "Total Pago" na outra. */
  rotuloDoQuitado: string;
}

/**
 * A faixa de cinco indicadores do topo.
 *
 * Os tons são os mesmos nas duas telas — de propósito. Antes divergiam sem
 * razão (o total em aberto era azul numa e vermelho na outra, a média era
 * amarela numa e roxa na outra), o que fazia a mesma ideia mudar de cor
 * conforme a tela. Agora: o dinheiro ainda por resolver na cor de ação, o já
 * resolvido em sucesso, o vencido em perigo, o que está para vencer em
 * alerta, e a média sem juízo nenhum.
 *
 * "Total em Aberto" e "Total Recebido/Pago" não somam a mesma nota duas
 * vezes: o primeiro é o SALDO das não quitadas, o segundo é `valor − saldo`
 * de todas. Somados dão o faturado da base, que é o que a média divide.
 *
 * Os cinco descrevem a base FILTRADA, e não o recorte da busca da tabela.
 */
export function KpisDeContas({
  kpis,
  rotuloDoAberto,
  rotuloDoQuitado,
}: KpisDeContasProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
      <KpiCard
        label={rotuloDoAberto}
        value={formatarMoeda(kpis.totalAberto)}
        tone="acao"
      />
      <KpiCard
        label={rotuloDoQuitado}
        value={formatarMoeda(kpis.totalQuitado)}
        tone="positivo"
      />
      <KpiCard
        label="Contas Vencidas"
        value={kpis.contasVencidas}
        tone="perigo"
      />
      <KpiCard
        label="A Vencer (30 dias)"
        value={kpis.aVencer30}
        tone="alerta"
      />
      {/*
        "Média Mensal Faturada", e não "Média Mensal": o número é
        (aberto + quitado) / meses distintos de EMISSÃO, ou seja, quanto a
        empresa fatura por mês. O rótulo curto não dizia de que grandeza nem
        de que mês estava falando (defeito 1.2).
      */}
      <KpiCard
        label="Média Mensal Faturada"
        value={formatarMoeda(kpis.mediaMensal)}
      />
    </div>
  );
}
