import { ChevronDown, ChevronUp, Download, Search } from "lucide-react";
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
import { dataDeCalendario } from "../../lib/datas";
import {
  ITENS_POR_PAGINA,
  estaEmAberto,
  formatarMoeda,
  type ContaBase,
  type DialetoDeContas,
  type Ordenacao,
} from "./contas";
import { ariaSort } from "../../lib/ariaSort";

/** As oito colunas da tabela, na ordem em que aparecem. */
export type ChaveDeColuna =
  | "id"
  | "vencimento"
  | "emissao"
  | "contraparte"
  | "categoria"
  | "valor"
  | "saldo"
  | "situacao";

export interface ColunaDeContas {
  chave: ChaveDeColuna;
  rotulo: string;
  /** O campo da conta por onde a coluna ordena. */
  campo: string;
}

/** A frase da tabela sem nenhuma linha, a mesma nas duas telas. */
const MENSAGEM_DE_VAZIO = "Nenhuma conta encontrada.";

/**
 * As colunas das duas telas — a MESMA ordem para as duas.
 *
 * O vencimento vem primeiro porque é o que se procura numa tela de contas, e
 * a emissão vem logo ao lado para as duas datas não ficarem separadas por
 * cinco colunas de outro assunto. Antes cada gêmea tinha uma ordem: Receber
 * punha as datas entre a categoria e o dinheiro, Pagar punha depois do
 * dinheiro. Nenhuma das duas tinha razão para isso.
 *
 * Só dois pontos ainda variam, e os dois são de domínio: como a contraparte
 * se chama no negócio (cliente ou fornecedor) e como a API nomeia o campo da
 * emissão (`data` ou `data_emissao`) — este último só para ORDENAR, porque o
 * rótulo da coluna é "Emissão" nas duas.
 */
export function colunasDeContas(
  rotuloDaContraparte: string,
  campoDaEmissao: string,
): ColunaDeContas[] {
  return [
    { chave: "id", rotulo: "ID Tiny", campo: "id_tiny" },
    { chave: "vencimento", rotulo: "Vencimento", campo: "vencimento" },
    { chave: "emissao", rotulo: "Emissão", campo: campoDaEmissao },
    {
      chave: "contraparte",
      rotulo: rotuloDaContraparte,
      campo: "cliente_nome",
    },
    { chave: "categoria", rotulo: "Categoria", campo: "categoria" },
    { chave: "valor", rotulo: "Valor", campo: "valor_numero" },
    { chave: "saldo", rotulo: "Saldo", campo: "saldo_numero" },
    { chave: "situacao", rotulo: "Situação", campo: "situacao" },
  ];
}

export interface TabelaDeContasProps<C extends ContaBase> {
  titulo: string;
  /** "Cliente" ou "Fornecedor" — o rótulo da coluna da contraparte. */
  rotuloDaContraparte: string;
  dialeto: DialetoDeContas;
  /** A página que está na tela. */
  contas: C[];
  /** Quantas contas o recorte inteiro tem — a paginação fala dele. */
  total: number;
  pagina: number;
  onPagina: (pagina: number) => void;
  pesquisa: string;
  onPesquisar: (termo: string) => void;
  ordenacao: Ordenacao;
  onOrdenar: (campo: string) => void;
  onExportar: () => void;
}

/**
 * O selo de situação: o texto é sempre o que a API mandou, sem tradução.
 *
 * Contas a Pagar escrevia o literal "Pago" no lugar da situação crua, e era a
 * exceção dentro do próprio `if`: as outras três pernas — "Vencida" à parte,
 * que é estado calculado — já mostravam o texto cru. Uma linha do Tiny com
 * `situacao: "PAGO"` saía "PAGO" numa tela e "Pago" na outra.
 */
function SeloDeSituacao<C extends ContaBase>({
  conta,
  dialeto,
}: {
  conta: C;
  dialeto: DialetoDeContas;
}) {
  if (conta.quitada) {
    return <Badge variant="success">{conta.situacao}</Badge>;
  }
  // "Vencida" é estado CALCULADO, e não a situação que o Tiny mandou: entra
  // como acréscimo, não como substituto. Antes o selo escrevia só "Vencida" e
  // depois do vencimento "pendente" e "aberto" viravam a mesma palavra na
  // tela (defeito 1.5).
  if (conta.vencida) {
    const situacao = conta.situacao?.trim();
    return (
      <Badge variant="danger">
        {situacao ? `${situacao} · Vencida` : "Vencida"}
      </Badge>
    );
  }
  if (estaEmAberto(conta.situacao))
    return <Badge variant="warning">{conta.situacao}</Badge>;
  // `?? "-"` cobria só o `null`: a string vazia passava e desenhava uma
  // pílula colorida sem texto nenhum dentro (defeito 1.6). `||` cobre as duas.
  return <Badge variant="secondary">{conta.situacao || "-"}</Badge>;
}

/**
 * A listagem das contas: busca, ordenação por oito colunas, exportação para
 * Excel e paginação de 15 em 15.
 *
 * Não guarda estado — a tela é dona da busca, da ordenação e da página, e
 * manda para cá o recorte já pronto. Assim o que aparece na tela e o que vai
 * para a planilha saem da mesma lista, sem uma segunda cópia da regra.
 *
 * O cabeçalho de coluna é um `<button>` dentro do `<th>`, e não o `sortable`
 * do `TableHeaderCell` do design system: o `sortable` desenha a seta como
 * caractere de texto (`↑ ↓ ↕`), e aqui a seta é ícone de verdade
 * (`lucide-react`), desenhada só na coluna que está ordenando — como as duas
 * telas sempre fizeram.
 */
export function TabelaDeContas<C extends ContaBase>({
  titulo,
  rotuloDaContraparte,
  dialeto,
  contas,
  total,
  pagina,
  onPagina,
  pesquisa,
  onPesquisar,
  ordenacao,
  onOrdenar,
  onExportar,
}: TabelaDeContasProps<C>) {
  const colunas = colunasDeContas(rotuloDaContraparte, "emissao");

  const celula = (conta: C, chave: ChaveDeColuna): ReactNode => {
    switch (chave) {
      case "id":
        return (
          <TableCell key={chave} muted className="font-mono text-xs">
            {conta.id_tiny}
          </TableCell>
        );
      case "vencimento":
        return (
          <TableCell
            key={chave}
            muted
            className="whitespace-nowrap font-mono text-xs"
          >
            {dataDeCalendario(conta.vencimento)}
          </TableCell>
        );
      case "emissao":
        return (
          <TableCell
            key={chave}
            muted
            className="whitespace-nowrap font-mono text-xs"
          >
            {dataDeCalendario(conta.emissao)}
          </TableCell>
        );
      case "contraparte":
        // O CPF/CNPJ na segunda linha é o que desempata dois cadastros com o
        // mesmo nome — e é dado que as duas APIs entregam. Contas a Pagar
        // escondia por descuido, não por decisão.
        return (
          <TableCell key={chave} className="min-w-[200px]">
            <p className="font-medium">{conta.cliente_nome}</p>
            {conta.cliente_cpf_cnpj ? (
              <p className="font-mono text-xs text-conteudo-muted">
                {conta.cliente_cpf_cnpj}
              </p>
            ) : null}
          </TableCell>
        );
      case "categoria":
        return (
          <TableCell key={chave} muted>
            {conta.categoria ?? "-"}
          </TableCell>
        );
      case "valor":
        return (
          <TableCell
            key={chave}
            className="whitespace-nowrap font-mono font-semibold text-action"
          >
            {formatarMoeda(conta.valor)}
          </TableCell>
        );
      case "saldo":
        return (
          <TableCell
            key={chave}
            className="whitespace-nowrap font-mono font-semibold"
          >
            {formatarMoeda(conta.saldo)}
          </TableCell>
        );
      case "situacao":
        return (
          <TableCell key={chave}>
            <SeloDeSituacao conta={conta} dialeto={dialeto} />
          </TableCell>
        );
    }
  };

  return (
    <Card padding="none">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borda p-4">
        <CardTitle>{titulo}</CardTitle>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Pesquisar..."
              aria-label="Pesquisar nas contas"
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
            onClick={onExportar}
            // Sem nenhuma linha o clique gerava uma planilha vazia (defeito
            // 1.9). A tela de Locação já desabilitava nesse caso; agora as
            // três fazem igual. `total` é o recorte inteiro, e não a página:
            // uma busca que não casa com nada também desabilita.
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
            {colunas.map(({ chave, rotulo, campo }) => (
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
                  className={[
                    "inline-flex select-none items-center gap-1 uppercase tracking-wider",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                  ].join(" ")}
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
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {contas.length === 0 ? (
            <TableEmpty colSpan={colunas.length} message={MENSAGEM_DE_VAZIO} />
          ) : (
            contas.map((conta) => (
              <TableRow key={conta.id}>
                {colunas.map(({ chave }) => celula(conta, chave))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/*
        O `Pagination` do design system, e não uma paginação própria. A que
        estava aqui existia para preservar o defeito 1.7: ela escondia a
        frase "Mostrando X a Y de N registros" dentro do bloco que só aparece
        com duas páginas ou mais, e quem tinha 15 contas ou menos não lia
        contagem nenhuma. O primitivo mostra a frase SEMPRE, e o rótulo do
        botão passa a ser o dele — "Próxima".
      */}
      <div className="px-4 pb-4">
        <Pagination
          page={pagina}
          pageSize={ITENS_POR_PAGINA}
          total={total}
          itemLabel="registros"
          onPageChange={onPagina}
        />
      </div>
    </Card>
  );
}
