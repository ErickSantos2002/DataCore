import {
  Calendar,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Download,
  Mail,
  Phone,
  Search,
  ShoppingBag,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  Badge,
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
import {
  dataDaUltimaCompra,
  type CampoDeOrdenacao,
  type ClienteDaCarteira,
  type OrdenacaoDeClientes,
} from "./clientes";

const DINHEIRO = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

export interface TabelaDeClientesProps {
  /** A página visível. */
  clientes: ClienteDaCarteira[];
  /** Tudo o que a pesquisa deixou, para a contagem. */
  total: number;
  pagina: number;
  onPagina: (pagina: number) => void;
  pesquisa: string;
  onPesquisar: (termo: string) => void;
  ordenacao: OrdenacaoDeClientes;
  onOrdenar: (campo: CampoDeOrdenacao) => void;
  onExportarExcel: () => void;
  onExportarPdf: () => void;
}

/**
 * "Detalhamento de Clientes": pesquisa, as duas exportações, cinco colunas
 * ordenáveis e paginação de 15 em 15.
 *
 * Nasce limpa, sobre os primitivos de tabela. O zebrado de linha e as pílulas
 * de status em verde e vermelho crus viram `TableRow` e `Badge`.
 */
export function TabelaDeClientes({
  clientes,
  total,
  pagina,
  onPagina,
  pesquisa,
  onPesquisar,
  ordenacao,
  onOrdenar,
  onExportarExcel,
  onExportarPdf,
}: TabelaDeClientesProps) {
  const ordenavel = (
    campo: CampoDeOrdenacao,
    rotulo: string,
    icone?: ReactNode,
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
        {icone}
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

  const icone = (Icone: typeof Calendar) => (
    <Icone className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
  );

  return (
    <Card padding="none">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borda p-4">
        <CardTitle>Detalhamento de Clientes</CardTitle>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Pesquisar..."
              aria-label="Pesquisar clientes"
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
            onClick={onExportarExcel}
            // Sem linha nenhuma saía planilha só com o cabeçalho, e PDF com a
            // tabela vazia. `total` é o que a pesquisa deixou, e não a página.
            disabled={total === 0}
            icon={
              <Download
                className="h-4 w-4"
                strokeWidth={2}
                aria-hidden="true"
              />
            }
          >
            Excel
          </Button>
          <Button
            variant="secondary"
            onClick={onExportarPdf}
            disabled={total === 0}
            icon={
              <Download
                className="h-4 w-4"
                strokeWidth={2}
                aria-hidden="true"
              />
            }
          >
            PDF
          </Button>
        </div>
      </div>

      <Table>
        <TableHead>
          <TableRow>
            {ordenavel("nome", "Cliente")}
            {ordenavel("ultimaCompra", "Última Compra", icone(Calendar))}
            {ordenavel("totalComprado", "Valor Total", icone(DollarSign))}
            {ordenavel("numeroCompras", "Nº Compras", icone(ShoppingBag))}
            {ordenavel("status", "Status")}
          </TableRow>
        </TableHead>

        <TableBody>
          {clientes.length === 0 ? (
            // Pagination some com total zero; sem isso a tabela ficava muda no
            // filtro sem resultado (defeito 2 do spec).
            <TableEmpty colSpan={5} />
          ) : (
            clientes.map((cliente) => (
              <TableRow key={cliente.cpfCnpjNormalizado}>
                <TableCell>
                  <p className="text-sm font-medium text-conteudo-heading">
                    {cliente.nome}
                  </p>
                  <p className="text-xs text-conteudo-muted">
                    {cliente.cpf_cnpj}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-3">
                    {cliente.email ? (
                      <span className="flex items-center gap-1 text-xs text-conteudo-muted">
                        <Mail
                          className="h-3 w-3"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        {cliente.email}
                      </span>
                    ) : null}
                    {cliente.fone ? (
                      <span className="flex items-center gap-1 text-xs text-conteudo-muted">
                        <Phone
                          className="h-3 w-3"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        {cliente.fone}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell muted className="whitespace-nowrap text-sm">
                  {dataDaUltimaCompra(cliente.ultimaCompra)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm font-semibold text-action">
                  R${" "}
                  {cliente.totalCompradoPeriodo.toLocaleString(
                    "pt-BR",
                    DINHEIRO,
                  )}
                </TableCell>
                <TableCell className="text-sm font-semibold">
                  {cliente.numeroComprasPeriodo}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={cliente.status === "ativo" ? "success" : "danger"}
                  >
                    {cliente.status === "ativo" ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="px-4 pb-4">
        <Pagination
          page={pagina}
          pageSize={15}
          total={total}
          itemLabel="clientes"
          onPageChange={onPagina}
        />
      </div>
    </Card>
  );
}
