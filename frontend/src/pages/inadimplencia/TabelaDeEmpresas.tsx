import { ChevronDown, ChevronUp, Download, Search } from "lucide-react";

import {
  Badge, Button, Card, CardTitle, Input, Pagination, Table, TableBody, TableCell,
  TableEmpty, TableHead, TableHeaderCell, TableRow,
} from "../../design-system/ui";
import { ariaSort } from "../../lib/ariaSort";
import { dataDeCalendario } from "../../lib/datas";
import type { EmpresaDaLista } from "../../services/inadimplencia";
import { ITENS_POR_PAGINA, formatarMoeda, type Ordenacao } from "../contas/contas";
import { STATUS, haQuantosDias } from "./inadimplencia";

const COLUNAS = [
  { campo: "nome", rotulo: "Empresa" },
  { campo: "titulos", rotulo: "Títulos" },
  { campo: "valor", rotulo: "Valor devido" },
  { campo: "maior_atraso", rotulo: "Maior atraso" },
  { campo: "status", rotulo: "Status" },
  { campo: "proxima_data", rotulo: "Próxima data" },
  { campo: "ultimo_contato", rotulo: "Último contato" },
] as const;

export interface TabelaDeEmpresasProps {
  empresas: EmpresaDaLista[];
  total: number;
  pagina: number;
  onPagina: (p: number) => void;
  pesquisa: string;
  onPesquisar: (t: string) => void;
  ordenacao: Ordenacao;
  onOrdenar: (campo: string) => void;
  onExportar: () => void;
  onAbrir: (empresa: string) => void;
  hoje: Date;
  /** Há busca em curso: a lista anterior fica na tela e o vazio não aparece. */
  carregando?: boolean;
}

/** Até 30 dias é atraso (âmbar); depois disso é inadimplência (vermelho). */
function SeloDeAtraso({ dias }: { dias: number }) {
  return <Badge variant={dias > 30 ? "danger" : "warning"}>{dias} dias</Badge>;
}

/**
 * A lista de empresas devedoras, no mesmo desenho da tabela de Contas a Receber
 * (`contas/TabelaDeContas`): busca, exportação, cabeçalho ordenável e paginação.
 * Não guarda estado — a aba é dona do filtro, da ordenação e da página.
 */
export function TabelaDeEmpresas(props: TabelaDeEmpresasProps) {
  const { empresas, total, pagina, onPagina, pesquisa, onPesquisar, ordenacao, onOrdenar, onExportar, onAbrir, hoje, carregando = false } = props;
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  return (
    <Card padding="none">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borda p-4">
        <CardTitle>Empresas devedoras</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Pesquisar nome ou CNPJ..."
              aria-label="Pesquisar empresas"
              value={pesquisa}
              onChange={(e) => onPesquisar(e.target.value)}
              icon={<Search className="h-4 w-4" strokeWidth={2} aria-hidden="true" />}
            />
          </div>
          <Button
            onClick={onExportar}
            disabled={total === 0}
            icon={<Download className="h-4 w-4" strokeWidth={2} aria-hidden="true" />}
          >
            Exportar Excel
          </Button>
        </div>
      </div>

      <Table>
        <TableHead>
          <TableRow>
            {COLUNAS.map(({ campo, rotulo }) => (
              <TableHeaderCell key={campo} aria-sort={ariaSort(ordenacao.campo === campo, ordenacao.direcao)}>
                <button
                  type="button"
                  onClick={() => onOrdenar(campo)}
                  aria-label={`Ordenar por ${rotulo}`}
                  className={[
                    "inline-flex select-none items-center gap-1 uppercase tracking-wider",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                  ].join(" ")}
                >
                  <span>{rotulo}</span>
                  {ordenacao.campo === campo ? (
                    ordenacao.direcao === "desc" ? (
                      <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <ChevronUp className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                    )
                  ) : null}
                </button>
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {empresas.length === 0 ? (
            <TableEmpty colSpan={COLUNAS.length} message={carregando ? "Carregando..." : "Nenhuma empresa encontrada."} />
          ) : (
            empresas.map((e) => (
              <TableRow key={e.empresa} clickable onClick={() => onAbrir(e.empresa)}>
                <TableCell className="min-w-[200px]">
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onAbrir(e.empresa);
                    }}
                    className="text-left font-medium hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    {e.nome}
                  </button>
                  {e.documento ? (
                    <p className="font-mono text-xs text-conteudo-muted">{e.documento}</p>
                  ) : null}
                </TableCell>
                <TableCell className="font-mono">{e.titulos}</TableCell>
                <TableCell className="whitespace-nowrap font-mono font-semibold text-action">
                  {formatarMoeda(e.valor_devido)}
                </TableCell>
                <TableCell><SeloDeAtraso dias={e.maior_atraso} /></TableCell>
                <TableCell>
                  {e.status ? <Badge variant={STATUS[e.status].variante}>{STATUS[e.status].rotulo}</Badge> : "-"}
                </TableCell>
                <TableCell
                  muted={!(e.proxima_data && e.proxima_data < hojeIso)}
                  className={[
                    "whitespace-nowrap font-mono text-xs",
                    e.proxima_data && e.proxima_data < hojeIso ? "text-danger" : "",
                  ].join(" ")}
                >
                  {e.proxima_data ? dataDeCalendario(e.proxima_data) : "-"}
                </TableCell>
                <TableCell muted className="whitespace-nowrap font-mono text-xs">
                  {haQuantosDias(e.ultimo_contato, hoje)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="px-4 pb-4">
        <Pagination
          page={pagina}
          pageSize={ITENS_POR_PAGINA}
          total={total}
          itemLabel="empresas"
          onPageChange={onPagina}
        />
      </div>
    </Card>
  );
}
