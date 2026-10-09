import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { chartTheme, useTemaDoGrafico } from "../../design-system/chartTheme";
import { Alert, Card, CardTitle, ChartEmpty, KpiCard, Spinner } from "../../design-system/ui";
import type { MesDeTaxa } from "../../services/inadimplencia";
import { formatarMoeda } from "../contas/contas";
import { formatarPercentual, nomeDoMes } from "./inadimplencia";
import { useIndicadores } from "./useInadimplencia";

/** Compara na precisão exibida (0,1 p.p.); sem taxa dos dois lados, não há comparação. */
export function comparacaoComAnoAnterior(atual: number | null, anterior: number | null, ano: number): string | undefined {
  if (atual === null || anterior === null) return undefined;
  const a = Math.round(atual * 1000);
  const b = Math.round(anterior * 1000);
  const rotulo = `${ano} (${formatarPercentual(anterior)})`;
  if (a > b) return `▲ pior que ${rotulo}`;
  if (a < b) return `▼ melhor que ${rotulo}`;
  return `= igual a ${rotulo}`;
}

/** Texto do tooltip do gráfico mensal, com os rótulos da spec. */
export function textoDoTooltip(m: MesDeTaxa): string {
  return `Taxa: ${formatarPercentual(m.taxa)} · Valor vencido: ${formatarMoeda(m.valor)} · Não pago em 30 dias: ${formatarMoeda(m.inadimplente)}${m.em_apuracao ? " (em apuração)" : ""}`;
}

/**
 * A taxa de safra: de tudo que venceu, quanto não foi pago em até 30 dias.
 * Mês em apuração = ainda tem vencimento que não completou 30 dias.
 */
export function AbaIndicadores({ ativo }: { ativo: boolean }) {
  useTemaDoGrafico();
  const { dado: i, carregando, erro } = useIndicadores(ativo);
  if (carregando) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (erro || !i) return <Alert variant="danger">{erro ?? "Sem dados."}</Alert>;

  const anoAtual = i.anual.find((a) => a.ano_corrente);
  const anoAnterior = anoAtual ? i.anual.find((a) => a.ano === anoAtual.ano - 1) : undefined;
  const dados = i.mensal.map((m) => ({ ...m, rotulo: nomeDoMes(m.mes), pct: (m.taxa ?? 0) * 100 }));
  const maxAno = Math.max(...i.anual.map((a) => a.taxa ?? 0), i.total.taxa ?? 0, 0.01);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
        {i.ultimo_fechado ? (
          <KpiCard label={`Último mês fechado (${nomeDoMes(i.ultimo_fechado.mes)})`} value={formatarPercentual(i.ultimo_fechado.taxa)} tone="perigo"
            note={`${formatarMoeda(i.ultimo_fechado.inadimplente)} de ${formatarMoeda(i.ultimo_fechado.valor)} que venceram`} />
        ) : null}
        <KpiCard label="Média dos últimos 12 meses" value={formatarPercentual(i.media_12_meses)} tone="acao" />
        {anoAtual ? (
          <KpiCard label={`Ano ${anoAtual.ano} (até agora)`} value={formatarPercentual(anoAtual.taxa)} tone="perigo"
            note={anoAnterior ? comparacaoComAnoAnterior(anoAtual.taxa, anoAnterior.taxa, anoAnterior.ano) : undefined} />
        ) : null}
        <KpiCard label={`Total — desde ${i.desde?.slice(0, 4) ?? "—"}`} value={formatarPercentual(i.total.taxa)}
          note={`${formatarMoeda(i.total.inadimplente)} de ${formatarMoeda(i.total.valor)}`} />
      </div>

      <Card>
        <CardTitle>Taxa mensal</CardTitle>
        <p className="mb-4 text-xs text-conteudo-muted">
          Cada barra é um mês de <b>vencimento</b>: de tudo que venceu naquele mês, quanto não tinha sido pago 30 dias depois.
        </p>
        {dados.length === 0 ? <ChartEmpty height={288} message="Sem meses fechados para mostrar." /> : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={chartTheme.grid.stroke} />
                <XAxis dataKey="rotulo" tick={{ fill: chartTheme.axis.stroke, fontSize: 12 }} axisLine={{ stroke: chartTheme.grid.stroke }} />
                <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fill: chartTheme.axis.stroke, fontSize: 12 }} axisLine={{ stroke: chartTheme.grid.stroke }} />
                <Tooltip contentStyle={chartTheme.tooltip} formatter={(_v, _n, p: { payload?: MesDeTaxa }) => [p.payload ? textoDoTooltip(p.payload) : "", ""]} />
                {i.media_12_meses !== null ? <ReferenceLine y={i.media_12_meses * 100} strokeDasharray="6 4" stroke="var(--action)" label="média 12 meses" /> : null}
                <Bar dataKey="pct" radius={[3, 3, 0, 0]}>
                  {dados.map((m) => <Cell key={m.mes} fill={m.em_apuracao ? "var(--color-slate-300)" : "var(--color-danger-500)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <ul className="mt-2 text-xs text-conteudo-muted">
          {i.mensal.filter((m) => m.em_apuracao).map((m) => (
            <li key={m.mes}>{nomeDoMes(m.mes)} — em apuração: parte do que venceu ainda não completou 30 dias.</li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardTitle>Taxa anual</CardTitle>
          <div className="mt-3 flex flex-col gap-2">
            {[...i.anual.map((a) => ({ chave: String(a.ano), rotulo: a.ano_corrente ? `${a.ano} (até agora)` : String(a.ano), taxa: a.taxa, cor: "var(--color-danger-500)" })),
              { chave: "total", rotulo: "Total", taxa: i.total.taxa, cor: "var(--action)" }].map((l) => (
              <div key={l.chave} className="grid grid-cols-[110px_1fr_60px] items-center gap-3 text-sm">
                <span className="font-medium">{l.rotulo}</span>
                <span className="h-4 overflow-hidden rounded bg-surface-elevated">
                  <span className="block h-full rounded" style={{ width: `${((l.taxa ?? 0) / maxAno) * 100}%`, background: l.cor }} />
                </span>
                <span className="text-right font-mono font-semibold">{formatarPercentual(l.taxa)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>Como ler este número</CardTitle>
          {i.ultimo_fechado ? (
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <p><b>{formatarPercentual(i.ultimo_fechado.taxa)} em {nomeDoMes(i.ultimo_fechado.mes)}</b> quer dizer: de cada R$ 100 que venceram nesse mês, {formatarMoeda((i.ultimo_fechado.taxa ?? 0) * 100)} não tinham sido pagos 30 dias depois do vencimento.</p>
              <p>Conta mesmo quem pagou depois — o que se mede é se pagou dentro de 30 dias. Por isso um mês fechado não muda mais.</p>
              <p><b>Barra mais alta = mês pior.</b></p>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
