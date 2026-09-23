import { useState } from "react";
import { ChevronDown, ChevronUp, Download, Search } from "lucide-react";

import SolicitacaoComprasModal from "../../components/SolicitacaoComprasModal";
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
import type {
  CampoDeOrdenacao,
  OrdenacaoDeEstoque,
  ProdutoEstoque,
} from "./estoque";
import { ariaSort } from "../../lib/ariaSort";

const DINHEIRO = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

export interface TabelaDeEstoqueProps {
  /** A página visível. */
  produtos: ProdutoEstoque[];
  /** Tudo o que o filtro e a pesquisa deixaram, para a contagem. */
  total: number;
  pagina: number;
  onPagina: (pagina: number) => void;
  pesquisa: string;
  onPesquisar: (termo: string) => void;
  ordenacao: OrdenacaoDeEstoque;
  onOrdenar: (campo: CampoDeOrdenacao) => void;
  onExportar: () => void;
  /** O catálogo INTEIRO, sem filtro — é o que a solicitação de compras lista. */
  catalogo: ProdutoEstoque[];
  solicitante: string;
}

/**
 * "Detalhamento do Estoque": pesquisa, exportação, a solicitação de compras,
 * sete colunas — cinco ordenáveis — e paginação de 15 em 15.
 *
 * Nasce limpa, sobre os primitivos de tabela. O estado do modal de solicitação
 * veio junto (colocation): só esta tabela o abre e o fecha.
 */
export function TabelaDeEstoque({
  produtos,
  total,
  pagina,
  onPagina,
  pesquisa,
  onPesquisar,
  ordenacao,
  onOrdenar,
  onExportar,
  catalogo,
  solicitante,
}: TabelaDeEstoqueProps) {
  const [modalAberto, setModalAberto] = useState(false);

  // O clique mora num `<button>` dentro do `<th>`: um `<th>` não entra na
  // ordem de tabulação nem responde a Enter, e ordenar era ação só de mouse.
  // Não é o `sortable` do primitivo, que põe as setas como TEXTO no cabeçalho.
  // `uppercase` de novo no botão porque o preflight do Tailwind zera
  // text-transform em `button` (a lição de Vendedores).
  const ordenavel = (campo: CampoDeOrdenacao, rotulo: string) => (
    <TableHeaderCell
      aria-sort={ariaSort(ordenacao.campo === campo, ordenacao.direcao)}
    >
      <button
        type="button"
        onClick={() => onOrdenar(campo)}
        aria-label={`Ordenar por ${rotulo}`}
        className="inline-flex select-none items-center gap-1 uppercase tracking-wider focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
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
        <CardTitle>Detalhamento do Estoque</CardTitle>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Pesquisar..."
              aria-label="Pesquisar produtos"
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
            // Sem linha nenhuma saía planilha só com o cabeçalho. `total` é o
            // que filtro e pesquisa deixaram, e não a página.
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
          <Button variant="primary" onClick={() => setModalAberto(true)}>
            Solicitação de Compras
          </Button>
        </div>
      </div>

      <Table>
        <TableHead>
          <TableRow>
            {ordenavel("nome", "Nome")}
            {ordenavel("codigo", "Código-SKU")}
            <TableHeaderCell>Unidade</TableHeaderCell>
            {ordenavel("preco", "Preço")}
            {ordenavel("saldo", "Saldo")}
            {ordenavel("situacao", "Situação")}
            <TableHeaderCell>Valor Total</TableHeaderCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {produtos.length === 0 ? (
            // Pagination some com total zero; sem isso a tabela ficava muda no
            // filtro sem resultado (defeito 2 do spec).
            <TableEmpty colSpan={7} />
          ) : (
            produtos.map((produto) => (
              <TableRow key={produto.id}>
                <TableCell className="text-sm font-medium">
                  {produto.nome}
                </TableCell>
                <TableCell muted className="text-sm">
                  {produto.codigo}
                </TableCell>
                <TableCell muted className="text-sm">
                  {produto.unidade}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm font-semibold text-action">
                  R$ {produto.preco.toLocaleString("pt-BR", DINHEIRO)}
                </TableCell>
                <TableCell
                  className={[
                    "text-sm font-semibold",
                    produto.saldo > 0 ? "text-success" : "text-danger",
                  ].join(" ")}
                >
                  {produto.saldo.toLocaleString("pt-BR")}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={produto.situacao === "A" ? "success" : "danger"}
                  >
                    {produto.situacao === "A" ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm font-semibold">
                  R${" "}
                  {(produto.saldo * produto.preco).toLocaleString(
                    "pt-BR",
                    DINHEIRO,
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="px-4 pb-4">
        {/*
          O `Pagination` do design system. As 105 linhas que saíram escondiam a
          frase de contagem dentro do `{totalPaginas > 1 && ...}`: quem tinha 15
          itens ou menos não lia contagem nenhuma.
        */}
        <Pagination
          page={pagina}
          pageSize={15}
          total={total}
          itemLabel="produtos"
          onPageChange={onPagina}
        />
      </div>

      {/* Montado só quando aberto, como o `Modal` pede: montado o tempo todo,
          o estado dele sobrevivia ao Cancelar, e a quantidade de quem
          desistiu ia no "Gerar PDF" seguinte. */}
      {modalAberto ? (
        <SolicitacaoComprasModal
          aberto
          fechar={() => setModalAberto(false)}
          produtos={catalogo}
          solicitante={solicitante}
        />
      ) : null}
    </Card>
  );
}
