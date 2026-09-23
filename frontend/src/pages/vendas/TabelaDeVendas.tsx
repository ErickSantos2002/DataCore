import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  Package,
  Search,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import ModalObservacoesDaNota from "../../components/ModalObservacoesDaNota";
import {
  Button,
  Card,
  CardTitle,
  Input,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../../design-system/ui";
import type { NotaVenda } from "../../services/notasapi";
import type { CampoDeOrdenacao } from "../comercial/useComercial";
import { dataDaNota, type OrdenacaoDeVendas } from "./vendas";

const DINHEIRO = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

export interface TabelaDeVendasProps {
  /** A página que o servidor devolveu. */
  notas: NotaVenda[];
  total: number;
  pagina: number;
  onPagina: (pagina: number) => void;
  pesquisa: string;
  onPesquisar: (termo: string) => void;
  ordenacao: OrdenacaoDeVendas;
  onOrdenar: (campo: CampoDeOrdenacao) => void;
  onExportar: () => void;
  /** O laço de exportação está correndo. */
  exportando: boolean;
}

/**
 * "Detalhamento de Vendas": pesquisa, exportação, seis colunas — quatro
 * ordenáveis, no servidor — e paginação de 15 em 15.
 *
 * Nasce limpa, sobre os primitivos de tabela. O estado do modal de observações
 * veio junto (colocation): só esta tabela o abre. O modal saiu de dentro do
 * `<tbody>`, onde era um `<div>` filho de `<tbody>` — HTML inválido.
 */
export function TabelaDeVendas({
  notas,
  total,
  pagina,
  onPagina,
  pesquisa,
  onPesquisar,
  ordenacao,
  onOrdenar,
  onExportar,
  exportando,
}: TabelaDeVendasProps) {
  // O ID basta: o texto das observações é buscado pelo modal ao abrir.
  const [notaDasObservacoes, setNotaDasObservacoes] = useState<number | null>(
    null,
  );

  const icone = (Icone: typeof Calendar) => (
    <Icone className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
  );

  const ordenavel = (
    campo: CampoDeOrdenacao,
    rotulo: string,
    simbolo?: ReactNode,
  ) => (
    <TableHeaderCell
      aria-sort={
        ordenacao.campo !== campo
          ? "none"
          : ordenacao.direcao === "asc"
            ? "ascending"
            : "descending"
      }
    >
      {/*
        O clique mora num `<button>` dentro do `<th>`: um `<th>` não entra na
        ordem de tabulação nem responde a Enter, e ordenar era ação só de
        mouse. Não é o `sortable` do primitivo, que põe as setas como TEXTO no
        cabeçalho. `uppercase` de novo no botão porque o preflight do Tailwind
        zera text-transform em `button` (a lição de Vendedores).
      */}
      <button
        type="button"
        onClick={() => onOrdenar(campo)}
        aria-label={`Ordenar por ${rotulo}`}
        className="inline-flex select-none items-center gap-1 uppercase tracking-wider focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {simbolo}
        <span>{rotulo}</span>
        {ordenacao.campo === campo ? (
          ordenacao.direcao === "desc" ? (
            <ChevronDown
              className="h-4 w-4"
              strokeWidth={2}
              aria-hidden="true"
            />
          ) : (
            <ChevronUp className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          )
        ) : null}
      </button>
    </TableHeaderCell>
  );

  return (
    <Card padding="none">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borda p-4">
        <CardTitle>Detalhamento de Vendas</CardTitle>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Pesquisar..."
              aria-label="Pesquisar vendas"
              value={pesquisa}
              onChange={(evento) => onPesquisar(evento.target.value)}
              icon={
                <Search
                  className="h-4 w-4"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              }
            />
          </div>
          <Button
            variant="success"
            onClick={onExportar}
            // Nada impedia o segundo clique durante o laço — saíam duas
            // planilhas —, e sem nota saía planilha só com o cabeçalho. `loading`
            // já desabilita; `total` é o do recorte, e não o da página.
            loading={exportando}
            disabled={total === 0}
            icon={
              <Download
                className="h-4 w-4"
                strokeWidth={2}
                aria-hidden="true"
              />
            }
          >
            Exportar Excel
          </Button>
        </div>
      </div>

      <Table>
        <TableHead>
          <TableRow>
            {ordenavel("data_emissao", "Data", icone(Calendar))}
            {ordenavel("cliente", "Cliente")}
            {ordenavel("valor", "Valor")}
            {ordenavel("vendedor", "Vendedor", icone(Users))}
            <TableHeaderCell>
              <span className="inline-flex items-center gap-1">
                {icone(Package)}
                <span>Produtos</span>
              </span>
            </TableHeaderCell>
            <TableHeaderCell className="text-center">
              Observações
            </TableHeaderCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {notas.length === 0 ? (
            // Pagination some com total zero; sem isso a tabela ficava muda no
            // filtro sem resultado (defeito 2 do spec).
            <TableEmpty colSpan={6} />
          ) : (
            notas.map((nota) => {
              const produtos = nota.itens?.map((i) => i.descricao).join(", ");
              return (
                <TableRow key={nota.id}>
                  <TableCell muted className="whitespace-nowrap text-sm">
                    {dataDaNota(nota.data_emissao)}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium text-conteudo-heading">
                      {nota.cliente?.nome || "Não informado"}
                    </p>
                    {nota.cliente?.cpf_cnpj ? (
                      <p className="text-xs text-conteudo-muted">
                        CNPJ: {nota.cliente.cpf_cnpj}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm font-semibold text-action">
                    R${" "}
                    {Number(nota.valor_nota).toLocaleString("pt-BR", DINHEIRO)}
                  </TableCell>
                  <TableCell muted className="text-sm">
                    {nota.nome_vendedor || "Não informado"}
                  </TableCell>
                  <TableCell muted className="text-sm">
                    {nota.itens?.length > 0 ? (
                      <>
                        <p className="max-w-xs truncate" title={produtos}>
                          {produtos}
                        </p>
                        <p className="mt-1 text-xs">
                          {nota.itens.length}{" "}
                          {nota.itens.length === 1 ? "item" : "itens"}
                        </p>
                      </>
                    ) : (
                      "Sem itens"
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {nota.tem_observacoes ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        // Sem `nowrap` o rótulo quebrava em "Ver" e
                        // "Observações", e a linha dobrava de altura.
                        className="whitespace-nowrap"
                        onClick={() => setNotaDasObservacoes(nota.id)}
                      >
                        Ver Observações
                      </Button>
                    ) : (
                      <span className="text-conteudo-faint">-</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <div className="px-4 pb-4">
        <Pagination
          page={pagina}
          pageSize={15}
          total={total}
          itemLabel="notas"
          onPageChange={onPagina}
        />
      </div>

      {notaDasObservacoes !== null ? (
        <ModalObservacoesDaNota
          idNota={notaDasObservacoes}
          onClose={() => setNotaDasObservacoes(null)}
        />
      ) : null}
    </Card>
  );
}
