import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { chartTheme, useTemaDoGrafico } from "../../design-system/chartTheme";
import { Alert, Card, CardTitle, ChartEmpty, KpiCard, Spinner } from "../../design-system/ui";
import type { FiltrosDeIndicadores as Filtros, MesDeTaxa } from "../../services/inadimplencia";
import { formatarMoeda } from "../contas/contas";
import { FiltrosDeIndicadores, type ChaveDoFiltroDeIndicadores } from "./FiltrosDeIndicadores";
import { formatarPercentual, mesesDoPreset, nomeDoMes, rotuloDoTotal } from "./inadimplencia";
import { useIndicadores } from "./useInadimplencia";

/** Quanto esperar a pessoa parar de digitar o cliente antes de buscar — sem isso, uma busca por tecla. */
const PAUSA_DO_CLIENTE_MS = 400;

/**
 * O estado dos filtros da aba. O cliente tem dois: o texto do campo (`textoCliente`, muda a
 * cada tecla) e o que vai para a API (`cliente`, depois da pausa). O atraso mora no evento,
 * num `setTimeout` guardado em ref, e não num efeito que observa o texto — estado que muda
 * por causa de um evento muda no evento (`react-hooks/set-state-in-effect`).
 */
function useFiltrosDeIndicadores() {
  const [preset, setPreset] = useState("tudo");
  const [mesInicio, setMesInicio] = useState("");
  const [mesFim, setMesFim] = useState("");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [formas, setFormas] = useState<string[]>([]);
  const [ufs, setUfs] = useState<string[]>([]);
  const [textoCliente, setTextoCliente] = useState("");
  const [cliente, setCliente] = useState("");
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (espera.current) clearTimeout(espera.current); }, []);

  const escolherPreset = (v: string) => {
    setPreset(v);
    const meses = mesesDoPreset(v, new Date());
    if (!meses) return;
    setMesInicio(meses.inicio);
    setMesFim(meses.fim);
  };
  const digitarCliente = (v: string, pausa = PAUSA_DO_CLIENTE_MS) => {
    setTextoCliente(v);
    if (espera.current) clearTimeout(espera.current);
    if (pausa === 0) { setCliente(v.trim()); return; }
    espera.current = setTimeout(() => setCliente(v.trim()), pausa);
  };
  const remover = (chave: ChaveDoFiltroDeIndicadores) => {
    if (chave === "periodo") escolherPreset("tudo");
    if (chave === "categoria") setCategorias([]);
    if (chave === "forma") setFormas([]);
    if (chave === "uf") setUfs([]);
    if (chave === "cliente") digitarCliente("", 0);
  };

  const filtros = useMemo<Filtros>(() => {
    const f: Filtros = {};
    if (mesInicio) f.mes_inicio = mesInicio;
    if (mesFim) f.mes_fim = mesFim;
    if (categorias.length) f.categoria = categorias;
    if (formas.length) f.forma_pagamento = formas;
    if (ufs.length) f.uf = ufs;
    if (cliente) f.cliente = cliente;
    return f;
  }, [mesInicio, mesFim, categorias, formas, ufs, cliente]);

  // `AAAA-MM` compara como texto. Período invertido não vai para a API (seria 422 e a tela
  // perderia os números): a busca fica parada no último recorte válido e o campo avisa.
  const periodoInvertido = Boolean(mesInicio && mesFim && mesFim < mesInicio);

  return {
    filtros,
    periodoInvertido,
    barra: {
      preset, mesInicio, mesFim, categorias, formas, ufs, cliente: textoCliente,
      onPreset: escolherPreset,
      onMesInicio: (v: string) => { setMesInicio(v); setPreset("custom"); },
      onMesFim: (v: string) => { setMesFim(v); setPreset("custom"); },
      onCategorias: setCategorias, onFormas: setFormas, onUfs: setUfs,
      onCliente: (v: string) => digitarCliente(v),
      onRemover: remover,
      onLimpar: () => (["periodo", "categoria", "forma", "uf", "cliente"] as const).forEach(remover),
    },
  };
}

/** Compara na precisão exibida (o que formatarPercentual mostra); sem taxa dos dois lados, não há comparação. */
export function comparacaoComAnoAnterior(atual: number | null, anterior: number | null, ano: number): string | undefined {
  if (atual === null || anterior === null) return undefined;
  const rotulo = `${ano} (${formatarPercentual(anterior)})`;
  if (formatarPercentual(atual) === formatarPercentual(anterior)) return `= igual a ${rotulo}`;
  if (atual > anterior) return `▲ pior que ${rotulo}`;
  return `▼ melhor que ${rotulo}`;
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
  const { filtros, periodoInvertido, barra } = useFiltrosDeIndicadores();
  // Com `ativo` falso a chave é nula e o hook guarda o último dado: é assim que o período invertido não busca.
  const { dado: i, carregando, erro } = useIndicadores(ativo && !periodoInvertido, filtros);
  // O spinner é só da primeira carga: depois, os números antigos ficam até os novos chegarem.
  if (carregando && !i) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  const barraDeFiltros = <FiltrosDeIndicadores opcoes={i?.opcoes ?? null} periodoInvertido={periodoInvertido} {...barra} />;
  if (!i) {
    return (
      <div className="flex flex-col gap-6">
        {barraDeFiltros}
        <Alert variant="danger">{erro ?? "Sem dados."}</Alert>
      </div>
    );
  }

  const vazio = i.total.titulos === 0;
  // Com período, "até agora" e "últimos 12 meses" enganam: o ano e a média são só do recorte.
  const comPeriodo = Boolean(filtros.mes_inicio || filtros.mes_fim);
  const sufixoDoAno = comPeriodo ? "(no período)" : "(até agora)";
  const rotuloTotal = rotuloDoTotal({
    mes_inicio: filtros.mes_inicio, mes_fim: filtros.mes_fim,
    outros: Boolean(filtros.categoria || filtros.forma_pagamento || filtros.uf || filtros.cliente),
  }, i.desde);
  const anoAtual = i.anual.find((a) => a.ano_corrente);
  const anoAnterior = anoAtual ? i.anual.find((a) => a.ano === anoAtual.ano - 1) : undefined;
  const dados = i.mensal.map((m) => ({ ...m, rotulo: nomeDoMes(m.mes), pct: (m.taxa ?? 0) * 100 }));
  const maxAno = Math.max(...i.anual.map((a) => a.taxa ?? 0), i.total.taxa ?? 0, 0.01);

  return (
    <div className="flex flex-col gap-6">
      {barraDeFiltros}
      {erro ? <Alert variant="danger">{erro}</Alert> : null}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
        {i.ultimo_fechado ? (
          <KpiCard label={`Último mês fechado (${nomeDoMes(i.ultimo_fechado.mes)})`} value={formatarPercentual(i.ultimo_fechado.taxa)} tone="perigo"
            note={`${formatarMoeda(i.ultimo_fechado.inadimplente)} de ${formatarMoeda(i.ultimo_fechado.valor)} que venceram`} />
        ) : vazio ? <KpiCard label="Último mês fechado" value="—" tone="perigo" /> : null}
        <KpiCard label={comPeriodo ? "Média dos últimos 12 meses do período" : "Média dos últimos 12 meses"} value={formatarPercentual(i.media_12_meses)} tone="acao" />
        {anoAtual ? (
          <KpiCard label={`Ano ${anoAtual.ano} ${sufixoDoAno}`} value={formatarPercentual(anoAtual.taxa)} tone="perigo"
            note={anoAnterior ? comparacaoComAnoAnterior(anoAtual.taxa, anoAnterior.taxa, anoAnterior.ano) : undefined} />
        ) : null}
        <KpiCard label={rotuloTotal} value={formatarPercentual(i.total.taxa)}
          note={vazio ? undefined : `${formatarMoeda(i.total.inadimplente)} de ${formatarMoeda(i.total.valor)}`} />
      </div>

      <Card>
        <CardTitle>Taxa mensal</CardTitle>
        <p className="mb-4 text-xs text-conteudo-muted">
          Cada barra é um mês de <b>vencimento</b>: de tudo que venceu naquele mês, quanto não tinha sido pago 30 dias depois.
        </p>
        {vazio ? <ChartEmpty height={288} message="Nenhum título vencido neste recorte." />
          : dados.length === 0 ? <ChartEmpty height={288} message="Sem meses fechados para mostrar." /> : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={chartTheme.grid.stroke} />
                <XAxis dataKey="rotulo" tick={{ fill: chartTheme.axis.stroke, fontSize: 12 }} axisLine={{ stroke: chartTheme.grid.stroke }} />
                <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fill: chartTheme.axis.stroke, fontSize: 12 }} axisLine={{ stroke: chartTheme.grid.stroke }} />
                <Tooltip contentStyle={chartTheme.tooltip} itemStyle={chartTheme.tooltipItem} formatter={(_v, _n, p: { payload?: MesDeTaxa }) => [p.payload ? textoDoTooltip(p.payload) : "", ""]} />
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
            {[...i.anual.map((a) => ({ chave: String(a.ano), rotulo: a.ano_corrente ? `${a.ano} ${sufixoDoAno}` : String(a.ano), taxa: a.taxa, cor: "var(--color-danger-500)" })),
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
