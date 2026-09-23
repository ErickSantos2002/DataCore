import { Download, Search } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  Input,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../../design-system/ui";
import type { NotaLocacao } from "../../services/notasapi";
import {
  dataDaNota,
  emReais,
  paraNumero,
  tomDaSituacao,
  type CampoOrdenavel,
  type Ordenacao,
} from "./notasDeLocacao";

/** Colunas da tabela, na ordem. `campo` ausente = coluna que não ordena. */
const COLUNAS: { rotulo: string; campo?: CampoOrdenavel }[] = [
  { rotulo: "Número", campo: "numero" },
  { rotulo: "Data", campo: "data_emissao" },
  { rotulo: "Cliente", campo: "cliente" },
  { rotulo: "Valor", campo: "valor" },
  { rotulo: "Situação" },
  { rotulo: "Vendedor" },
];

export interface TabelaDeLocacaoProps {
  /** As notas já filtradas e ordenadas — é isto que vai para a tela e para o Excel. */
  notas: NotaLocacao[];
  /** Quantas notas a base tem no total, para a frase do rodapé. */
  totalDeNotas: number;
  pesquisa: string;
  onPesquisar: (termo: string) => void;
  ordenacao: Ordenacao;
  onOrdenar: (campo: CampoOrdenavel) => void;
  onExportar: () => void;
}

/** "1 nota" / "3 notas" — o rodapé é frase, e frase concorda em número. */
function contarNotas(quantidade: number): string {
  return quantidade === 1 ? "1 nota" : `${quantidade} notas`;
}

/** Uma linha da tabela. Só existe dentro desta tabela, por isso mora aqui. */
function LinhaDeLocacao({ nota }: { nota: NotaLocacao }) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{nota.numero || "—"}</TableCell>
      <TableCell muted className="whitespace-nowrap font-mono text-xs">
        {dataDaNota(nota.data_emissao)}
      </TableCell>
      <TableCell className="min-w-[220px]">
        <p className="font-medium">{nota.cliente?.nome || "Não informado"}</p>
        {nota.cliente?.cpf_cnpj ? (
          <p className="mt-0.5 font-mono text-xs text-conteudo-muted">
            CNPJ: {nota.cliente.cpf_cnpj}
          </p>
        ) : null}
      </TableCell>
      <TableCell className="whitespace-nowrap font-mono font-semibold text-action">
        R$ {emReais(paraNumero(nota.valor_nota))}
      </TableCell>
      <TableCell>
        <Badge variant={tomDaSituacao(nota.descricao_situacao)}>
          {nota.descricao_situacao || "—"}
        </Badge>
      </TableCell>
      <TableCell muted>{nota.nome_vendedor || "Não informado"}</TableCell>
    </TableRow>
  );
}

/**
 * A listagem das notas de locação: busca, ordenação por quatro colunas,
 * exportação para Excel e o total do recorte no rodapé.
 *
 * Não guarda estado — a tela é dona da busca e da ordenação, e manda para cá
 * a lista já filtrada e ordenada. Assim o mesmo recorte que aparece na tela é
 * o que vai para a planilha, sem uma segunda cópia da regra.
 */
export function TabelaDeLocacao({
  notas,
  totalDeNotas,
  pesquisa,
  onPesquisar,
  ordenacao,
  onOrdenar,
  onExportar,
}: TabelaDeLocacaoProps) {
  const somaDoRecorte = notas.reduce(
    (acc, nota) => acc + paraNumero(nota.valor_nota),
    0,
  );
  const filtrando = pesquisa.length > 0;

  return (
    <Card padding="none">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borda p-4">
        <h2 className="text-base font-semibold text-conteudo-heading">
          Notas de locação
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-80">
            <Input
              placeholder="Buscar cliente, nota ou vendedor"
              aria-label="Buscar nas notas de locação"
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
          {filtrando ? (
            <Button variant="ghost" onClick={() => onPesquisar("")}>
              Limpar busca
            </Button>
          ) : null}
          <Button
            onClick={onExportar}
            disabled={notas.length === 0}
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
            {COLUNAS.map(({ rotulo, campo }) =>
              campo ? (
                <TableHeaderCell
                  key={rotulo}
                  sortable
                  sorted={ordenacao.campo === campo ? ordenacao.direcao : null}
                  onSort={() => onOrdenar(campo)}
                >
                  {rotulo}
                </TableHeaderCell>
              ) : (
                <TableHeaderCell key={rotulo}>{rotulo}</TableHeaderCell>
              ),
            )}
          </TableRow>
        </TableHead>

        <TableBody>
          {notas.length === 0 ? (
            <TableEmpty
              colSpan={COLUNAS.length}
              message="Nenhuma nota de locação encontrada."
            />
          ) : (
            notas.map((nota) => <LinhaDeLocacao key={nota.id} nota={nota} />)
          )}
        </TableBody>
      </Table>

      {notas.length > 0 ? (
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-borda bg-surface-base p-4">
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-conteudo-faint">
            Total do recorte
          </span>
          <p className="text-sm text-conteudo-muted">
            Mostrando{" "}
            <span className="font-semibold text-conteudo">
              {filtrando
                ? `${notas.length} de ${contarNotas(totalDeNotas)}`
                : contarNotas(totalDeNotas)}
            </span>{" "}
            de locação, somando{" "}
            <span className="font-mono font-bold text-conteudo-heading">
              R$ {emReais(somaDoRecorte)}
            </span>
            .
          </p>
        </div>
      ) : null}
    </Card>
  );
}
