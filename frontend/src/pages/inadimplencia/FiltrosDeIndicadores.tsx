import { Filter, Search } from "lucide-react";

import { FilterBar, Input, MultiSelect, Select, type FilterBarAppliedFilter } from "../../design-system/ui";
import type { OpcoesDosIndicadores } from "../../services/inadimplencia";
import { PRESETS_DE_INDICADORES, SEM_VALOR, nomeDoMes } from "./inadimplencia";

export type ChaveDoFiltroDeIndicadores = "periodo" | "categoria" | "forma" | "uf" | "cliente";

export interface FiltrosDeIndicadoresProps {
  opcoes: OpcoesDosIndicadores | null;
  preset: string;
  mesInicio: string;
  mesFim: string;
  categorias: string[];
  formas: string[];
  ufs: string[];
  cliente: string;
  /** Mês final antes do inicial: a tela não busca e o campo avisa. */
  periodoInvertido?: boolean;
  onPreset: (v: string) => void;
  onMesInicio: (v: string) => void;
  onMesFim: (v: string) => void;
  onCategorias: (v: string[]) => void;
  onFormas: (v: string[]) => void;
  onUfs: (v: string[]) => void;
  onCliente: (v: string) => void;
  onRemover: (chave: ChaveDoFiltroDeIndicadores) => void;
  onLimpar: () => void;
}

/** As opções da API mais a de "nulo ou vazio", por último — o backend não manda vazios. */
function comSemValor(valores: string[] | undefined, rotuloDoSem: string) {
  return [...(valores ?? []).map((v) => ({ valor: v, rotulo: v })), { valor: SEM_VALOR, rotulo: rotuloDoSem }];
}

function rotulos(valores: string[], rotuloDoSem: string) {
  return valores.map((v) => (v === SEM_VALOR ? rotuloDoSem : v)).join(", ");
}

/** As pílulas de "Aplicados" — é com elas que a FilterBar mostra o "Limpar filtros". */
function aplicados(p: FiltrosDeIndicadoresProps): (FilterBarAppliedFilter & { key: ChaveDoFiltroDeIndicadores })[] {
  const lista: (FilterBarAppliedFilter & { key: ChaveDoFiltroDeIndicadores })[] = [];
  if (p.mesInicio || p.mesFim) {
    const de = p.mesInicio ? nomeDoMes(p.mesInicio) : "…";
    const ate = p.mesFim ? nomeDoMes(p.mesFim) : "…";
    lista.push({ key: "periodo", label: `Vencimento: ${de} – ${ate}` });
  }
  if (p.categorias.length) lista.push({ key: "categoria", label: `Categoria: ${rotulos(p.categorias, "Sem categoria")}` });
  if (p.formas.length) lista.push({ key: "forma", label: `Forma: ${rotulos(p.formas, "Sem forma")}` });
  if (p.ufs.length) lista.push({ key: "uf", label: `UF: ${rotulos(p.ufs, "Sem UF")}` });
  if (p.cliente.trim()) lista.push({ key: "cliente", label: `Cliente: ${p.cliente.trim()}` });
  return lista;
}

/**
 * A barra de filtros da aba Indicadores, no desenho da de Cobrança. Todos os filtros recortam
 * TÍTULOS (a conta da safra não muda); o período é por mês de vencimento.
 */
export function FiltrosDeIndicadores(p: FiltrosDeIndicadoresProps) {
  return (
    <FilterBar
      appliedFilters={aplicados(p)}
      onRemoveFilter={(k) => p.onRemover(k as ChaveDoFiltroDeIndicadores)}
      onClearFilters={p.onLimpar}
    >
      <div className="flex w-full items-center gap-2">
        <Filter className="h-4 w-4 text-conteudo-muted" strokeWidth={2} aria-hidden="true" />
        <h2 className="text-base font-semibold text-conteudo-heading">Filtros</h2>
      </div>

      <div className="grid w-full grid-cols-1 items-end gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Período rápido"
          options={PRESETS_DE_INDICADORES}
          value={p.preset}
          onChange={(e) => p.onPreset(e.target.value)}
        />
        <Input label="Mês inicial" type="month" value={p.mesInicio} max={p.mesFim || undefined}
          onChange={(e) => p.onMesInicio(e.target.value)} />
        <Input label="Mês final" type="month" value={p.mesFim} min={p.mesInicio || undefined}
          error={p.periodoInvertido ? "O mês final não pode ser antes do inicial." : undefined}
          onChange={(e) => p.onMesFim(e.target.value)} />
        <Input
          label="Cliente"
          placeholder="Nome ou CNPJ (a raiz pega as filiais)"
          value={p.cliente}
          onChange={(e) => p.onCliente(e.target.value)}
          icon={<Search className="h-4 w-4" strokeWidth={2} aria-hidden="true" />}
        />

        <MultiSelect
          rotulo="Categoria"
          opcoes={comSemValor(p.opcoes?.categorias, "Sem categoria")}
          selecionados={p.categorias}
          onChange={p.onCategorias}
          placeholder="Todas"
        />
        <MultiSelect
          rotulo="Forma de pagamento"
          opcoes={comSemValor(p.opcoes?.formas_pagamento, "Sem forma")}
          selecionados={p.formas}
          onChange={p.onFormas}
          placeholder="Todas"
        />
        <MultiSelect
          rotulo="UF do cliente"
          opcoes={comSemValor(p.opcoes?.ufs, "Sem UF")}
          selecionados={p.ufs}
          onChange={p.onUfs}
          placeholder="Todas"
        />
      </div>
    </FilterBar>
  );
}
