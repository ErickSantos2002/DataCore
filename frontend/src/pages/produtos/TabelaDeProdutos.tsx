import { ChevronDown, ChevronUp, Download, Search } from "lucide-react";
import type { ReactNode } from "react";

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
import type { OrdenacaoDeProdutos, ProdutoAgregado } from "./produtos";
import { ariaSort } from "../../lib/ariaSort";

export interface TabelaDeProdutosProps {
  /** A página já cortada — quem pagina é a tela, esta tabela só desenha. */
  produtos: ProdutoAgregado[];
  /** O recorte inteiro (filtro + busca), não a página — é o que o rodapé conta. */
  total: number;
  pagina: number;
  onPagina: (pagina: number) => void;
  pesquisa: string;
  onPesquisar: (termo: string) => void;
  ordenacao: OrdenacaoDeProdutos;
  onOrdenar: (campo: string) => void;
  onExportar: () => void;
}

/** As seis colunas, na ordem em que aparecem. `campo` fica de fora só em
 *  "Nº Vendas" — a única sem ordenação. */
interface ColunaDeProdutos {
  chave: string;
  rotulo: string;
  campo?: string;
}

const COLUNAS: ColunaDeProdutos[] = [
  { chave: "codigo", rotulo: "Código", campo: "codigo" },
  { chave: "descricao", rotulo: "Produto", campo: "descricao" },
  { chave: "quantidade", rotulo: "Quantidade", campo: "quantidadeVendida" },
  { chave: "valorTotal", rotulo: "Valor Total", campo: "valorTotal" },
  { chave: "valorMedio", rotulo: "Valor Médio", campo: "valorMedio" },
  { chave: "numeroVendas", rotulo: "Nº Vendas" },
];

/**
 * A tabela de produtos: busca, seis colunas — cinco ordenáveis — exportação
 * para Excel e paginação de 15 em 15.
 *
 * O `onClick` de ordenação mora num `<button>` dentro do `<TableHeaderCell>`
 * (o `<th>`), e não no `<th>` em si: um `<th>` não entra na ordem de tabulação
 * e não dispara clique com Enter nem Espaço, então quem navega por teclado
 * simplesmente não conseguia reordenar a tabela. Mesmo padrão de
 * `TabelaDeContas.tsx` (procurar pelo `aria-label={`Ordenar por ...`}`), com
 * `focus-visible:ring-2` — item 9 do checklist de tela migrada.
 *
 * O botão é nosso, e não o `sortable` do `TableHeaderCell`: aquele desenha a
 * direção com as setas de texto `↑ ↓ ↕`, e esta tela usa os ícones
 * `ChevronUp`/`ChevronDown`, como a tela irmã de Contas.
 */
export function TabelaDeProdutos({
  produtos,
  total,
  pagina,
  onPagina,
  pesquisa,
  onPesquisar,
  ordenacao,
  onOrdenar,
  onExportar,
}: TabelaDeProdutosProps) {
  const celula = (produto: ProdutoAgregado, chave: string): ReactNode => {
    switch (chave) {
      case "codigo":
        return (
          <TableCell key={chave} muted>
            {produto.codigo}
          </TableCell>
        );
      case "descricao":
        return (
          <TableCell key={chave}>
            <p className="font-medium">{produto.descricao}</p>
          </TableCell>
        );
      case "quantidade":
        return (
          <TableCell key={chave} muted>
            {produto.quantidadeVendida.toLocaleString("pt-BR")}
          </TableCell>
        );
      case "valorTotal":
        return (
          <TableCell key={chave} className="font-semibold text-action">
            R${" "}
            {produto.valorTotal.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </TableCell>
        );
      case "valorMedio":
        return (
          <TableCell key={chave} muted>
            R${" "}
            {produto.valorMedio.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </TableCell>
        );
      case "numeroVendas":
        return (
          <TableCell key={chave} muted>
            {produto.numeroVendas}
          </TableCell>
        );
      default:
        return null;
    }
  };

  return (
    <Card padding="none">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borda p-4">
        <CardTitle>Detalhamento de Produtos</CardTitle>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Pesquisar produto..."
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
            // Sem nenhuma linha o clique gerava uma planilha com cabeçalho e
            // zero registros — a pessoa filtra, não acha nada, exporta assim
            // mesmo e leva um arquivo vazio achando que é o recorte. Mesmo
            // defeito 1.9 que `TabelaDeContas.tsx` já corrige. `total` é o
            // recorte inteiro (filtro + busca), e não a página: uma busca sem
            // resultado também desabilita.
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
            {COLUNAS.map(({ chave, rotulo, campo }) =>
              campo ? (
                <TableHeaderCell
                  key={chave}
                  aria-sort={ariaSort(
                    ordenacao.campo === campo,
                    ordenacao.direcao,
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onOrdenar(campo)}
                    aria-label={`Ordenar por ${rotulo}`}
                    className="inline-flex select-none items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
                        <ChevronUp
                          className="h-4 w-4"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      )
                    ) : null}
                  </button>
                </TableHeaderCell>
              ) : (
                <TableHeaderCell key={chave}>{rotulo}</TableHeaderCell>
              ),
            )}
          </TableRow>
        </TableHead>

        <TableBody>
          {produtos.length === 0 ? (
            // Pagination some com total zero; sem isso a tabela ficava
            // muda no filtro sem resultado (defeito 2 do spec). Mensagem
            // padrão do `TableEmpty` — os testes de caracterização (a busca
            // sem resultado e o filtro de período vazio) fixam
            // "Nenhum resultado encontrado.".
            <TableEmpty colSpan={COLUNAS.length} />
          ) : (
            produtos.map((produto) => (
              // `chave`, e não `codigo`: item sem código vira `codigo: ""`, e
              // dois deles davam `key=""` na mesma tabela — o React avisava no
              // console e passava a reconciliar as duas linhas como se fossem
              // a mesma. A `chave` do resumo já os distingue, e não é mostrada
              // em coluna nenhuma: é dado interno.
              <TableRow key={produto.chave}>
                {COLUNAS.map(({ chave }) => celula(produto, chave))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/*
        O `Pagination` do design system, e não as 104 linhas que estavam
        aqui. As que saíram escondiam a frase de contagem dentro do
        `{totalPaginas > 1 && ...}`: quem tinha 10 produtos ou menos não
        lia contagem nenhuma. É o mesmo defeito 1.7 que a Fase 1 corrigiu
        em Contas, e ele morre junto com o bloco.
      */}
      <div className="px-4 pb-4">
        <Pagination
          page={pagina}
          pageSize={15}
          total={total}
          itemLabel="produtos"
          onPageChange={onPagina}
        />
      </div>
    </Card>
  );
}
