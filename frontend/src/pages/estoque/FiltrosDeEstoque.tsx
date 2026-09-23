import { Filter } from "lucide-react";

import { FilterBar, MultiSelect, Select } from "../../design-system/ui";
import type { FiltrosDeEstoque as ValoresDosFiltros } from "./estoque";

const OPCOES_DE_SITUACAO = [
  { value: "todos", label: "Todos" },
  { value: "A", label: "Ativo" },
  { value: "I", label: "Inativo" },
];

const OPCOES_DE_SALDO = [
  { value: "todos", label: "Todos" },
  { value: "comSaldo", label: "Somente com saldo" },
  { value: "semSaldo", label: "Somente sem saldo" },
  { value: "Negativo", label: "Somente saldo negativo" },
];

const OPCOES_PERSONALIZADAS = [
  { value: "nenhum", label: "Nenhum" },
  { value: "rapido", label: "Principais" },
];

export interface FiltrosDeEstoqueProps {
  opcoesDeProduto: { valor: string; rotulo: string }[];
  valores: ValoresDosFiltros;
  onProduto: (valores: string[]) => void;
  onSituacao: (valor: string) => void;
  onSaldo: (valor: string) => void;
  onPersonalizado: (valor: string) => void;
}

/**
 * Produto, situação, saldo e o filtro "Principais".
 *
 * Nasce limpo. Molde: `vendedores/FiltrosDeVendedores.tsx`. O `Select` do design
 * system traz o que os três `<select>` crus não tinham: rótulo ligado por
 * `htmlFor` e `focus-visible` em vez de `focus`.
 */
export function FiltrosDeEstoque({
  opcoesDeProduto,
  valores,
  onProduto,
  onSituacao,
  onSaldo,
  onPersonalizado,
}: FiltrosDeEstoqueProps) {
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

      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MultiSelect
          rotulo="Produtos"
          opcoes={opcoesDeProduto}
          selecionados={valores.produto}
          onChange={onProduto}
          placeholder="Todos os produtos"
        />

        <Select
          label="Situação"
          options={OPCOES_DE_SITUACAO}
          value={valores.situacao}
          onChange={(evento) => onSituacao(evento.target.value)}
        />

        <Select
          label="Saldo"
          options={OPCOES_DE_SALDO}
          value={valores.saldo}
          onChange={(evento) => onSaldo(evento.target.value)}
        />

        <Select
          label="Filtros Personalizados"
          options={OPCOES_PERSONALIZADAS}
          value={valores.personalizado}
          onChange={(evento) => onPersonalizado(evento.target.value)}
        />
      </div>
    </FilterBar>
  );
}
