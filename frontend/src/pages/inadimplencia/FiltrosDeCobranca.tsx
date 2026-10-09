import { Filter } from "lucide-react";

import { FilterBar, Input, MultiSelect, Select, Switch } from "../../design-system/ui";
import { PRESETS_DE_INADIMPLENCIA } from "../../lib/periodo";
import type { ChaveDeFaixa, CodigoDeStatus, SemContato, TipoDeData } from "../../services/inadimplencia";
import { FAIXAS, STATUS } from "./inadimplencia";

export const TIPOS_DE_DATA: { value: TipoDeData; label: string }[] = [
  { value: "vencimento", label: "Vencimento" },
  { value: "emissao", label: "Emissão" },
  { value: "promessa", label: "Promessa" },
  { value: "contato", label: "Último contato" },
];

const OPCOES_DE_FAIXA = [
  { value: "", label: "Todas" },
  ...FAIXAS.map((f) => ({ value: f.chave as string, label: f.rotulo.replace(" dias", "") })),
];

const OPCOES_SEM_CONTATO = [
  { value: "", label: "Qualquer" },
  { value: "7", label: "7 dias" },
  { value: "15", label: "15 dias" },
  { value: "30", label: "30 dias" },
  { value: "nunca", label: "Nunca contatado" },
];

const OPCOES_DE_STATUS = Object.entries(STATUS)
  .filter(([valor]) => valor !== "pago")
  .map(([valor, s]) => ({ valor, rotulo: s.rotulo }));

export interface FiltrosDeCobrancaProps {
  dataTipo: TipoDeData;
  preset: string;
  dataInicio: string;
  dataFim: string;
  status: CodigoDeStatus[];
  faixa: ChaveDeFaixa | null;
  semContato: SemContato | null;
  incluirAtraso: boolean;
  onDataTipo: (v: TipoDeData) => void;
  onPreset: (v: string) => void;
  onDataInicio: (v: string) => void;
  onDataFim: (v: string) => void;
  onStatus: (v: CodigoDeStatus[]) => void;
  onFaixa: (v: ChaveDeFaixa | null) => void;
  onSemContato: (v: SemContato | null) => void;
  onIncluirAtraso: (v: boolean) => void;
}

/**
 * A barra de filtros da aba Cobrança, no desenho da de Contas a Receber: o "Período Rápido"
 * e as duas datas escrevem o mesmo período; a faixa é o mesmo estado da barra colorida.
 */
export function FiltrosDeCobranca(p: FiltrosDeCobrancaProps) {
  return (
    <FilterBar>
      <div className="flex w-full items-center gap-2">
        <Filter className="h-4 w-4 text-conteudo-muted" strokeWidth={2} aria-hidden="true" />
        <h2 className="text-base font-semibold text-conteudo-heading">Filtros</h2>
      </div>

      <div className="grid w-full grid-cols-1 items-end gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Filtrar data por"
          options={TIPOS_DE_DATA}
          value={p.dataTipo}
          onChange={(e) => p.onDataTipo(e.target.value as TipoDeData)}
        />
        <Select
          label="Período Rápido"
          options={PRESETS_DE_INADIMPLENCIA}
          value={p.preset}
          onChange={(e) => p.onPreset(e.target.value)}
        />
        <Input label="Data Início" type="date" value={p.dataInicio} onChange={(e) => p.onDataInicio(e.target.value)} />
        <Input label="Data Fim" type="date" value={p.dataFim} onChange={(e) => p.onDataFim(e.target.value)} />

        <MultiSelect
          rotulo="Status"
          opcoes={OPCOES_DE_STATUS}
          selecionados={p.status}
          onChange={(v) => p.onStatus(v as CodigoDeStatus[])}
          placeholder="Todos"
        />
        <Select
          label="Faixa de atraso"
          options={OPCOES_DE_FAIXA}
          value={p.faixa ?? ""}
          onChange={(e) => p.onFaixa((e.target.value || null) as ChaveDeFaixa | null)}
        />
        <Select
          label="Sem contato há mais de"
          options={OPCOES_SEM_CONTATO}
          value={p.semContato ?? ""}
          onChange={(e) => p.onSemContato((e.target.value || null) as SemContato | null)}
        />
        <Switch
          label="Incluir empresas só em atraso (1–30 dias)"
          checked={p.incluirAtraso}
          onChange={p.onIncluirAtraso}
        />
      </div>
    </FilterBar>
  );
}
