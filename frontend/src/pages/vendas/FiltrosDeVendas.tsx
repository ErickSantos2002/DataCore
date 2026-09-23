import { Filter } from "lucide-react";

import {
  FilterBar,
  Input,
  MultiSelect,
  Select,
  buscaPorCnpjEntreParenteses,
  deTextos,
} from "../../design-system/ui";
import { PRESETS_DE_PERIODO } from "../../lib/periodo";

export interface FiltrosDeVendasProps {
  /** Rótulos: a casca traduz empresa para id e produto para chave. */
  opcoes: { empresas: string[]; vendedores: string[]; produtos: string[] };
  valores: {
    empresa: string[];
    vendedor: string[];
    produto: string[];
    presetPeriodo: string;
    dataInicio: string;
    dataFim: string;
  };
  onEmpresa: (valores: string[]) => void;
  onVendedor: (valores: string[]) => void;
  onProduto: (valores: string[]) => void;
  onPreset: (preset: string) => void;
  onDataInicio: (data: string) => void;
  onDataFim: (data: string) => void;
}

/**
 * Empresas, vendedores, produtos, o preset de período e as duas datas.
 *
 * Nasce limpo. Molde: `vendedores/FiltrosDeVendedores.tsx`. `Select` e `Input`
 * do design system trazem o rótulo ligado por `htmlFor` e `focus-visible`. Os
 * três `MultiSelect` mantêm `buscaPorCnpjEntreParenteses`, que é o que a tela
 * usava.
 */
export function FiltrosDeVendas({
  opcoes,
  valores,
  onEmpresa,
  onVendedor,
  onProduto,
  onPreset,
  onDataInicio,
  onDataFim,
}: FiltrosDeVendasProps) {
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

      {/*
        Seis colunas desde `lg` quebravam "Todos os vendedores" em duas linhas
        numa tela de 1440px — a área útil, com a barra lateral, é de ~1080px —,
        e aquele filtro ficava mais alto que os vizinhos. Duas por linha em
        `md`, três em `lg` e as seis só em `2xl`, como em Clientes.
      */}
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <MultiSelect
          rotulo="Empresas"
          opcoes={deTextos(opcoes.empresas)}
          selecionados={valores.empresa}
          onChange={onEmpresa}
          placeholder="Todas as empresas"
          buscarPor={buscaPorCnpjEntreParenteses}
        />

        <MultiSelect
          rotulo="Vendedores"
          opcoes={deTextos(opcoes.vendedores)}
          selecionados={valores.vendedor}
          onChange={onVendedor}
          placeholder="Todos os vendedores"
          buscarPor={buscaPorCnpjEntreParenteses}
        />

        <MultiSelect
          rotulo="Produtos"
          opcoes={deTextos(opcoes.produtos)}
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
