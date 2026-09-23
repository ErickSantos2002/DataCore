import { Filter } from "lucide-react";

import {
  FilterBar,
  Input,
  MultiSelect,
  Select,
  buscaPorRotuloValorOuNumero,
  deTextos,
} from "../../design-system/ui";
import type { OpcaoDeMultiSelect } from "../../design-system/ui/forms/buscaDeMultiSelect";
import { PRESETS_DE_PERIODO } from "../../lib/periodo";

export interface FiltrosDeClientesProps {
  opcoes: {
    /** Documento em dígitos como valor — é o que junta cadastro repetido. */
    clientes: OpcaoDeMultiSelect[];
    vendedores: string[];
    /** Rótulos; a casca traduz para a chave do recorte. */
    produtos: string[];
  };
  valores: {
    cliente: string[];
    vendedor: string[];
    produto: string[];
    presetPeriodo: string;
    dataInicio: string;
    dataFim: string;
  };
  onCliente: (valores: string[]) => void;
  onVendedor: (valores: string[]) => void;
  onProduto: (valores: string[]) => void;
  onPreset: (preset: string) => void;
  onDataInicio: (data: string) => void;
  onDataFim: (data: string) => void;
}

/**
 * Cliente, vendedor, produto, o preset de período e as duas datas.
 *
 * Nasce limpo. Molde: `vendedores/FiltrosDeVendedores.tsx`. `Select` e `Input`
 * do design system trazem o que os campos crus não tinham: rótulo ligado por
 * `htmlFor` e `focus-visible` em vez de `focus`. Os rótulos continuam
 * "Período", "Início" e "Fim".
 */
export function FiltrosDeClientes({
  opcoes,
  valores,
  onCliente,
  onVendedor,
  onProduto,
  onPreset,
  onDataInicio,
  onDataFim,
}: FiltrosDeClientesProps) {
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
        `md`, três em `lg` e as seis só em `2xl`, onde cabem — conferido no
        navegador de 800 a 1920px, todos com a mesma altura.
      */}
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <MultiSelect
          rotulo="Cliente"
          opcoes={opcoes.clientes}
          selecionados={valores.cliente}
          onChange={onCliente}
          placeholder="Todos os clientes"
          buscarPor={buscaPorRotuloValorOuNumero}
        />

        <MultiSelect
          rotulo="Vendedor"
          opcoes={deTextos(opcoes.vendedores)}
          selecionados={valores.vendedor}
          onChange={onVendedor}
          placeholder="Todos os vendedores"
          buscarPor={buscaPorRotuloValorOuNumero}
        />

        <MultiSelect
          rotulo="Produto"
          opcoes={deTextos(opcoes.produtos)}
          selecionados={valores.produto}
          onChange={onProduto}
          placeholder="Todos os produtos"
          buscarPor={buscaPorRotuloValorOuNumero}
        />

        <Select
          label="Período"
          options={PRESETS_DE_PERIODO}
          value={valores.presetPeriodo}
          onChange={(evento) => onPreset(evento.target.value)}
        />

        <Input
          label="Início"
          type="date"
          value={valores.dataInicio}
          onChange={(evento) => onDataInicio(evento.target.value)}
        />

        <Input
          label="Fim"
          type="date"
          value={valores.dataFim}
          onChange={(evento) => onDataFim(evento.target.value)}
        />
      </div>
    </FilterBar>
  );
}
