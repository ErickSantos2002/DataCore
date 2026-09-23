import { Filter } from "lucide-react";

import {
  FilterBar,
  Input,
  MultiSelect,
  Select,
  deTextos,
} from "../../design-system/ui";
import { PRESETS_DE_PERIODO } from "../../lib/periodo";
import type { FiltrosDeContas as ValoresDosFiltros } from "./contas";

export interface FiltrosDeContasProps {
  /** "Cliente" em Contas a Receber, "Fornecedor" em Contas a Pagar. */
  rotuloDaContraparte: string;
  opcoes: {
    situacao: string[];
    categoria: string[];
    contraparte: string[];
  };
  valores: ValoresDosFiltros;
  preset: string;
  onSituacao: (selecionadas: string[]) => void;
  onCategoria: (selecionadas: string[]) => void;
  onContraparte: (selecionadas: string[]) => void;
  onPreset: (preset: string) => void;
  onDataInicio: (data: string) => void;
  onDataFim: (data: string) => void;
}

/**
 * A barra de filtros das duas telas: três multi-seleções, o período rápido e
 * as duas datas.
 *
 * O título "Filtros" mora dentro da barra, ocupando a linha inteira, porque é
 * ele que diz que os rótulos "Situação" e "Categoria" daqui são filtro e não
 * coluna da tabela logo abaixo — as duas palavras aparecem nos dois lugares.
 */
export function FiltrosDeContas({
  rotuloDaContraparte,
  opcoes,
  valores,
  preset,
  onSituacao,
  onCategoria,
  onContraparte,
  onPreset,
  onDataInicio,
  onDataFim,
}: FiltrosDeContasProps) {
  return (
    <FilterBar>
      <div className="flex w-full items-center gap-2">
        <Filter
          className="h-4 w-4 text-conteudo-muted"
          strokeWidth={2}
          aria-hidden="true"
        />
        <h2 className="text-base font-semibold text-conteudo-heading">
          Filtros
        </h2>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
        <MultiSelect
          rotulo="Situação"
          opcoes={deTextos(opcoes.situacao)}
          selecionados={valores.situacao}
          onChange={onSituacao}
          placeholder="Todas"
        />

        <MultiSelect
          rotulo="Categoria"
          opcoes={deTextos(opcoes.categoria)}
          selecionados={valores.categoria}
          onChange={onCategoria}
          placeholder="Todas"
        />

        <MultiSelect
          rotulo={rotuloDaContraparte}
          opcoes={deTextos(opcoes.contraparte)}
          selecionados={valores.contraparte}
          onChange={onContraparte}
          placeholder="Todos"
        />

        <Select
          label="Período Rápido"
          options={PRESETS_DE_PERIODO}
          value={preset}
          onChange={(evento) => onPreset(evento.target.value)}
        />

        <Input
          label="Data Início"
          type="date"
          value={valores.dataInicio}
          onChange={(evento) => onDataInicio(evento.target.value)}
        />

        <Input
          label="Data Fim"
          type="date"
          value={valores.dataFim}
          onChange={(evento) => onDataFim(evento.target.value)}
        />
      </div>
    </FilterBar>
  );
}
