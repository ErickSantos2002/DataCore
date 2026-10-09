import { useCallback, useMemo, useState } from "react";

import {
  Alert, FilterBar, KpiCard, MultiSelect, Spinner, Switch,
} from "../../design-system/ui";
import { baixarPlanilha } from "../../lib/planilha";
import type { ChaveDeFaixa, CodigoDeStatus, FiltrosDeEmpresas } from "../../services/inadimplencia";
import {
  ITENS_POR_PAGINA, formatarMoeda, nomeDoArquivo, proximaOrdenacao, type Ordenacao,
} from "../contas/contas";
import { FAIXAS, STATUS, formatarPercentual, linhasDaPlanilhaDeEmpresas } from "./inadimplencia";
import { ModalDaEmpresa } from "./ModalDaEmpresa";
import { TabelaDeEmpresas } from "./TabelaDeEmpresas";
import { todasAsEmpresas, useEmpresas, useResumo } from "./useInadimplencia";

const ORDENACAO_INICIAL: Ordenacao = { campo: "valor", direcao: "desc" };

export function AbaCobranca() {
  const resumo = useResumo();
  const [status, setStatus] = useState<CodigoDeStatus[]>([]);
  const [faixa, setFaixa] = useState<ChaveDeFaixa | null>(null);
  const [incluirAtraso, setIncluirAtraso] = useState(false);
  const [pesquisa, setPesquisa] = useState("");
  const [pagina, setPagina] = useState(1);
  const [ordenacao, setOrdenacao] = useState(ORDENACAO_INICIAL);
  const [aberta, setAberta] = useState<string | null>(null);
  const hoje = useMemo(() => new Date(), []);

  const filtros = useMemo<FiltrosDeEmpresas>(() => ({
    busca: pesquisa.trim() || undefined,
    status: status.length ? status : undefined,
    faixa: faixa ?? undefined,
    incluir_atraso: incluirAtraso || faixa === "atraso" || undefined,
    ordenar_por: ordenacao.campo,
    direcao: ordenacao.direcao,
    limite: ITENS_POR_PAGINA,
    offset: (pagina - 1) * ITENS_POR_PAGINA,
  }), [pesquisa, status, faixa, incluirAtraso, ordenacao, pagina]);
  const lista = useEmpresas(filtros);

  /** Mudar qualquer filtro volta para a página 1. */
  const mudou = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPagina(1); };

  /**
   * Os contadores dos cards incluem empresas só em atraso, então o card liga o "incluir atraso"
   * também; o de promessas lista pela data prometida, a mais próxima primeiro.
   */
  const escolherCard = (s: CodigoDeStatus) => {
    setStatus([s]);
    setIncluirAtraso(true);
    if (s === "promessa") setOrdenacao({ campo: "proxima_data", direcao: "asc" });
    setPagina(1);
  };

  const exportar = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { limite, offset, ...semPagina } = filtros;
      const linhas = linhasDaPlanilhaDeEmpresas(await todasAsEmpresas(semPagina));
      baixarPlanilha([{ nome: "Inadimplência", linhas }], nomeDoArquivo("inadimplencia", new Date()));
    } catch (falha) {
      console.error("Erro ao exportar a inadimplência:", falha);
    }
  }, [filtros]);

  const r = resumo.dado;
  if (resumo.carregando) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  const erro = resumo.erro ?? lista.erro;

  return (
    <div className="flex flex-col gap-6">
      {erro ? <Alert variant="danger">{erro}</Alert> : null}

      {r ? (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
            <KpiCard label="Total vencido não pago" value={formatarMoeda(r.total_vencido)} tone="acao" note={`${r.titulos_vencidos} títulos`} />
            <KpiCard label="Em atraso (até 30 dias)" value={formatarMoeda(r.em_atraso)} tone="alerta" />
            <KpiCard label="Inadimplente (mais de 30 dias)" value={formatarMoeda(r.inadimplente)} tone="perigo" note={`${r.titulos_inadimplentes} títulos · ${r.empresas_inadimplentes} empresas`} />
            <KpiCard label="Inadimplência da carteira" value={formatarPercentual(r.inadimplencia_carteira)} tone="perigo" note={`do total a receber (${formatarMoeda(r.total_a_receber)})`} />
            <KpiCard label="Recuperado depois do atraso" value={formatarPercentual(r.recuperado)} tone="positivo" note="do que passou de 30 dias, quanto entrou depois" />
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {([
              ["Sem contato", r.sem_contato, "sem_contato"],
              ["Promessas nos próximos 7 dias", r.promessas_7_dias, "promessa"],
              ["Promessas quebradas", r.promessas_quebradas, "quebrada"],
              ["Em negociação", r.em_negociacao, "negociacao"],
            ] as const).map(([rotulo, n, s]) => (
              <button key={s} type="button" className="text-left" onClick={() => escolherCard(s)} aria-label={`Filtrar: ${rotulo}`}>
                <KpiCard label={rotulo} value={n} tone={s === "quebrada" && n > 0 ? "perigo" : "neutro"} />
              </button>
            ))}
          </div>

          <BarraDeFaixas faixas={r.faixas} total={r.total_vencido} ativa={faixa}
            onEscolher={(f) => mudou(setFaixa)(faixa === f ? null : f)} />
        </>
      ) : null}

      <FilterBar>
        <div className="grid w-full grid-cols-1 items-end gap-4 md:grid-cols-3">
          <MultiSelect
            rotulo="Status"
            opcoes={Object.entries(STATUS).filter(([valor]) => valor !== "pago").map(([valor, s]) => ({ valor, rotulo: s.rotulo }))}
            selecionados={status}
            onChange={(v) => mudou(setStatus)(v as CodigoDeStatus[])}
            placeholder="Todos"
          />
          <Switch
            label="Incluir empresas só em atraso (1–30 dias)"
            checked={incluirAtraso}
            onChange={mudou(setIncluirAtraso)}
          />
        </div>
      </FilterBar>

      <TabelaDeEmpresas
        empresas={lista.dado?.itens ?? []}
        total={lista.dado?.total ?? 0}
        pagina={pagina}
        onPagina={setPagina}
        pesquisa={pesquisa}
        onPesquisar={mudou(setPesquisa)}
        ordenacao={ordenacao}
        onOrdenar={(c) => { setOrdenacao((a) => proximaOrdenacao(a, c)); setPagina(1); }}
        onExportar={exportar}
        onAbrir={setAberta}
        hoje={hoje}
        carregando={lista.carregando}
      />

      <ModalDaEmpresa empresa={aberta} onFechar={() => setAberta(null)} onGravou={() => { resumo.recarregar(); lista.recarregar(); }} />
    </div>
  );
}

function BarraDeFaixas({ faixas, total, ativa, onEscolher }: {
  faixas: { faixa: ChaveDeFaixa; titulos: number; empresas: number; valor: number }[];
  total: number;
  ativa: ChaveDeFaixa | null;
  onEscolher: (f: ChaveDeFaixa) => void;
}) {
  const por = new Map(faixas.map((f) => [f.faixa, f]));
  return (
    <div className="rounded-xl border border-borda bg-surface p-5">
      <h2 className="text-base font-semibold text-conteudo-heading">Por tempo de atraso</h2>
      <p className="mb-3 text-xs text-conteudo-muted">
        Até 30 dias é <b>atraso</b> — costuma ser pago. Depois de 30 dias é <b>inadimplência</b>. Clique numa faixa para filtrar a lista.
      </p>
      <div className="mb-4 flex h-8 overflow-hidden rounded-lg" aria-hidden="true">
        {FAIXAS.map((f) => {
          const v = por.get(f.chave)?.valor ?? 0;
          return v > 0 && total > 0 ? <div key={f.chave} style={{ width: `${(v / total) * 100}%`, background: f.cor }} /> : null;
        })}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {FAIXAS.map((f) => {
          const d = por.get(f.chave);
          return (
            <button key={f.chave} type="button" aria-pressed={ativa === f.chave} onClick={() => onEscolher(f.chave)}
              className={`rounded-lg border p-3 text-left transition-colors ${ativa === f.chave ? "border-action bg-action-tint" : "border-borda hover:bg-surface-elevated"}`}>
              <span className="flex items-center gap-2 text-xs font-semibold">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: f.cor }} />{f.rotulo}
              </span>
              <span className="mt-1 block font-mono text-base font-bold text-conteudo-heading">{formatarMoeda(d?.valor ?? 0)}</span>
              <span className="block text-xs text-conteudo-muted">{d?.titulos ?? 0} títulos · {d?.empresas ?? 0} empresas</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
