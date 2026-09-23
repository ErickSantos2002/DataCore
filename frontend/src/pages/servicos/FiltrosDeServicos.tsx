import { Filter } from "lucide-react";

import {
  FilterBar,
  Input,
  MultiSelect,
  Select,
  buscaPorTextoOuNumero,
  deTextos,
} from "../../design-system/ui";
import { PRESETS_DE_PERIODO } from "../../lib/periodo";

export interface FiltrosDeServicosProps {
  opcoes: {
    clientes: string[];
    cidades: string[];
    tipos: string[];
  };
  valores: {
    cliente: string[];
    cidade: string[];
    tipoServico: string[];
    presetPeriodo: string;
    dataInicio: string;
    dataFim: string;
  };
  onCliente: (selecionados: string[]) => void;
  onCidade: (selecionados: string[]) => void;
  onTipoServico: (selecionados: string[]) => void;
  onPreset: (preset: string) => void;
  onDataInicio: (data: string) => void;
  onDataFim: (data: string) => void;
}

/**
 * A barra de filtros da tela de Serviços: três multi-seleções (cliente,
 * cidade, tipo de serviço), o preset de período e as duas datas.
 *
 * Nasceu limpa — segue a lição de Produtos ("cada task limpa o que extrai"):
 * o componente nunca chega a entrar no `PENDENTES_FASE_3`. Molde:
 * `produtos/FiltrosDeProdutos.tsx`.
 *
 * `onDataInicio`/`onDataFim` continuam responsáveis por também levar o
 * preset para "custom" — esse acoplamento já existia em `Servicos.tsx` e o
 * componente só recebe a função pronta de fora, sem repetir a decisão aqui.
 *
 * Os três `MultiSelect` mantêm `buscarPor={buscaPorTextoOuNumero}` — já
 * existia na tela, e não é só para o CNPJ/CPF embutido no rótulo
 * de Cliente: `tiposServicoUnicos` vem de texto livre
 * (`discriminacao_servico`) e também carrega números pontuados
 * (`"Manutenção preventiva 1.234"`), que a busca normalizada acha mesmo
 * digitando sem pontuação.
 */
export function FiltrosDeServicos({
  opcoes,
  valores,
  onCliente,
  onCidade,
  onTipoServico,
  onPreset,
  onDataInicio,
  onDataFim,
}: FiltrosDeServicosProps) {
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

      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
        <MultiSelect
          rotulo="Cliente (Tomador)"
          opcoes={deTextos(opcoes.clientes)}
          selecionados={valores.cliente}
          onChange={onCliente}
          placeholder="Todos os clientes"
          buscarPor={buscaPorTextoOuNumero}
        />

        <MultiSelect
          rotulo="Cidade do Serviço"
          opcoes={deTextos(opcoes.cidades)}
          selecionados={valores.cidade}
          onChange={onCidade}
          placeholder="Todas as cidades"
          buscarPor={buscaPorTextoOuNumero}
        />

        <MultiSelect
          rotulo="Tipo de Serviço"
          opcoes={deTextos(opcoes.tipos)}
          selecionados={valores.tipoServico}
          onChange={onTipoServico}
          placeholder="Todos os tipos"
          buscarPor={buscaPorTextoOuNumero}
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
