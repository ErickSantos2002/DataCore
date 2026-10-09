import { Badge } from "../../design-system/ui";
import { dataDeCalendario } from "../../lib/datas";
import type { Ciclo, Evento } from "../../services/inadimplencia";
import { formatarMoeda } from "../contas/contas";
import { CANAIS, STATUS } from "./inadimplencia";

const CANAL = Object.fromEntries(CANAIS.map((c) => [c.value, c.label]));

function dataLocal(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function ItemDaLinha({ e }: { e: Evento }) {
  const quem = e.registrado_por === "sistema" ? "Sistema" : e.registrado_por;
  return (
    <li className="border-l-2 border-borda pl-4">
      <p className="text-xs text-conteudo-muted">
        {dataLocal(e.ocorrido_em)} {hora(e.ocorrido_em)} · <b>{quem}</b>
        {e.canal ? ` · ${CANAL[e.canal] ?? e.canal}` : ""}
        {e.filial_cnpj ? ` · filial ${e.filial_cnpj}` : ""}
      </p>
      {e.status_novo ? (
        <p className="mt-1 flex flex-wrap items-center gap-1 text-sm">
          {e.status_anterior ? <><Badge variant="muted">{STATUS[e.status_anterior].rotulo}</Badge>→</> : null}
          <Badge variant={STATUS[e.status_novo].variante}>{STATUS[e.status_novo].rotulo}</Badge>
          {e.promessa_data ? <span>para {dataDeCalendario(e.promessa_data)}{e.promessa_valor ? ` · ${formatarMoeda(e.promessa_valor)}` : ""}</span> : null}
        </p>
      ) : null}
      {e.promessa_condicoes ? <p className="mt-1 text-sm italic">{e.promessa_condicoes}</p> : null}
      {e.anotacao ? <p className="mt-1 whitespace-pre-wrap text-sm">{e.anotacao}</p> : null}
    </li>
  );
}

export function LinhaDoTempo({ eventos, ciclo, anteriores }: { eventos: Evento[]; ciclo: Ciclo | null; anteriores: Ciclo[] }) {
  const doAberto = eventos.filter((e) => e.ciclo_id === ciclo?.id);
  return (
    <div className="flex flex-col gap-6">
      {doAberto.length === 0 ? <p className="text-conteudo-muted">Nenhum registro de cobrança ainda.</p> : (
        <ul className="flex flex-col gap-4">{doAberto.map((e) => <ItemDaLinha key={e.id} e={e} />)}</ul>
      )}
      {anteriores.map((c) => (
        <details key={c.id} className="rounded-lg border border-borda p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Cobrança de {dataLocal(c.aberto_em)} a {c.encerrado_em ? dataLocal(c.encerrado_em) : "—"} · {STATUS[c.status].rotulo}
          </summary>
          <ul className="mt-3 flex flex-col gap-4">
            {eventos.filter((e) => e.ciclo_id === c.id).map((e) => <ItemDaLinha key={e.id} e={e} />)}
          </ul>
        </details>
      ))}
    </div>
  );
}
