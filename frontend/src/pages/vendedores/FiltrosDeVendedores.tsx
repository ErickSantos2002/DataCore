import { Filter } from "lucide-react";

import {
  FilterBar,
  Input,
  MultiSelect,
  Select,
  buscaPorCnpjEntreParenteses,
  deTextos,
} from "../../design-system/ui";
import type { OpcaoDeMultiSelect } from "../../design-system/ui/forms/buscaDeMultiSelect";
import { PRESETS_DE_PERIODO } from "../../lib/periodo";

export interface FiltrosDeVendedoresProps {
  opcoes: {
    clientes: string[];
    /** Chave de produto como valor, rótulo como texto: o que o multiselect
     *  devolve vai direto para o recorte, e o servidor filtra pela chave. */
    produtos: OpcaoDeMultiSelect[];
  };
  valores: {
    cliente: string[];
    produto: string[];
    presetPeriodo: string;
    dataInicio: string;
    dataFim: string;
  };
  onCliente: (valores: string[]) => void;
  onProduto: (valores: string[]) => void;
  onPreset: (preset: string) => void;
  onDataInicio: (data: string) => void;
  onDataFim: (data: string) => void;
}

/**
 * Empresas, produtos, o preset de período e as duas datas.
 *
 * Nasce limpo. Molde: `servicos/FiltrosDeServicos.tsx`. `Select` e `Input` do
 * design system trazem de graça o que os campos crus não tinham: rótulo ligado
 * por `htmlFor` e `focus-visible` em vez de `focus`.
 *
 * `onDataInicio`/`onDataFim` continuam levando o preset para "custom" — o
 * acoplamento é da casca, e o componente só recebe a função pronta.
 *
 * Os dois `MultiSelect` mantêm `buscaPorCnpjEntreParenteses`, que é o que a
 * tela usava: o documento do cliente vem entre parênteses no rótulo.
 */
export function FiltrosDeVendedores({
  opcoes,
  valores,
  onCliente,
  onProduto,
  onPreset,
  onDataInicio,
  onDataFim,
}: FiltrosDeVendedoresProps) {
  return (
    <FilterBar className="mb-6">
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

      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <MultiSelect
          rotulo="Empresas"
          opcoes={deTextos(opcoes.clientes)}
          selecionados={valores.cliente}
          onChange={onCliente}
          placeholder="Todas as empresas"
          buscarPor={buscaPorCnpjEntreParenteses}
        />

        <MultiSelect
          rotulo="Produtos"
          opcoes={opcoes.produtos}
          selecionados={valores.produto}
          onChange={onProduto}
          placeholder="Todos os produtos"
          buscarPor={buscaPorCnpjEntreParenteses}
        />

        <Select
          label="Período Rápido"
          options={PRESETS_DE_PERIODO}
          value={valores.presetPeriodo}
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
