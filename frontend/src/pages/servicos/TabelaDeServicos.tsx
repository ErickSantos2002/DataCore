import {
  Building,
  Calendar,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Download,
  FileText,
  MapPin,
  Search,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import ModalObservacoes from "../../components/ModalObservacoes";
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
import { converterParaNumero } from "../../lib/dinheiro";
import { rotuloDaCidade } from "./servicos";
import type { OrdenacaoDeServicos, Servico } from "./servicos";
import { ariaSort } from "../../lib/ariaSort";

/**
 * Qual das duas exportações está em curso, ou `null` quando nenhuma está.
 *
 * É união, e não `boolean`, porque o rótulo tem de dizer a verdade: com um
 * `boolean` os DOIS botões diriam "Exportando..." enquanto só um deles roda,
 * e quem clicou em PDF veria o botão do Excel se anunciar. Os dois
 * desabilitam de qualquer jeito — a busca do recorte inteiro é a mesma para
 * as duas saídas, e disparar a segunda no meio da primeira busca tudo outra
 * vez.
 */
export type ExportacaoEmCurso = "excel" | "pdf" | null;

export interface TabelaDeServicosProps {
  /** A página já cortada — quem pagina é a tela, esta tabela só desenha. */
  servicos: Servico[];
  /** O recorte inteiro (filtro + busca), não a página — é o que o rodapé conta. */
  total: number;
  pagina: number;
  onPagina: (pagina: number) => void;
  pesquisa: string;
  onPesquisar: (termo: string) => void;
  ordenacao: OrdenacaoDeServicos;
  onOrdenar: (campo: OrdenacaoDeServicos["campo"]) => void;
  onExportarExcel: () => void;
  onExportarPDF: () => void;
  /** Qual exportação está em curso — desabilita as duas e avisa na que roda. */
  exportando: ExportacaoEmCurso;
}

/** As seis colunas, na ordem em que aparecem. `campo` fica de fora só na
 *  "Descrição" — a única sem ordenação; `Icone` fica de fora pelo mesmo
 *  motivo de sempre: a coluna de descrição nunca teve ícone no cabeçalho. */
interface ColunaDeServicos {
  chave: string;
  rotulo: string;
  campo?: OrdenacaoDeServicos["campo"];
  Icone?: LucideIcon;
}

const COLUNAS: ColunaDeServicos[] = [
  { chave: "numero", rotulo: "Número NFS-e", campo: "numero", Icone: FileText },
  {
    chave: "cliente",
    rotulo: "Cliente (Tomador)",
    campo: "cliente",
    Icone: Building,
  },
  {
    chave: "emissao",
    rotulo: "Data Emissão",
    campo: "data_emissao",
    Icone: Calendar,
  },
  { chave: "cidade", rotulo: "Cidade/UF", campo: "cidade", Icone: MapPin },
  { chave: "valor", rotulo: "Valor", campo: "valor", Icone: DollarSign },
  { chave: "descricao", rotulo: "Descrição" },
];

/**
 * A tabela de Serviços: busca, as duas exportações (Excel e PDF), a tabela
 * com seis colunas — cinco ordenáveis — e paginação de 15 em 15.
 *
 * `observacoesSelecionadas` nasceu na tela (`Servicos.tsx`), mas é estado que
 * só esta tabela lê e só ela escreve — nenhum outro componente da tela
 * precisa saber qual observação está aberta. Mover para cá é colocation: o
 * modal sai de dentro do `<tbody>` (onde vivia antes, HTML inválido — um
 * `<div>` não é filho válido de `<tbody>`) para irmão da tabela, sem mudar
 * nada visível, porque o modal é `position: fixed`.
 *
 * O ícone de cada cabeçalho ordenável (`Icone` em `COLUNAS`) veio junto do
 * movimento: a tela em `Servicos.tsx` desenhava um `FileText`, `Building`,
 * `Calendar`, `MapPin` e `DollarSign` antes do rótulo, e mover é mover. Só a
 * cor mudou — era `text-gray-500 dark:text-gray-400`, agora o ícone herda o
 * `currentColor` do `<th>` (`text-conteudo-muted`), porque paleta crua neste
 * arquivo derrubaria `guarda-cores.test.ts`.
 */
export function TabelaDeServicos({
  servicos,
  total,
  pagina,
  onPagina,
  pesquisa,
  onPesquisar,
  ordenacao,
  onOrdenar,
  onExportarExcel,
  onExportarPDF,
  exportando,
}: TabelaDeServicosProps) {
  const [observacoesSelecionadas, setObservacoesSelecionadas] = useState<
    string | null
  >(null);

  const celula = (servico: Servico, chave: string): ReactNode => {
    switch (chave) {
      case "numero":
        return (
          <TableCell key={chave}>
            <p className="font-medium">{servico.numero_nfse}</p>
          </TableCell>
        );
      case "cliente":
        return (
          <TableCell key={chave} className="min-w-[200px]">
            <p className="font-medium">{servico.razao_social_tomador}</p>
            <p className="text-xs text-conteudo-muted">
              {servico.cpf_cnpj_tomador}
            </p>
          </TableCell>
        );
      case "emissao":
        // `split("-").reverse().join("/")` não passa por `new Date` — nunca
        // teve o defeito de fuso que `linhasDaPlanilha` e `linhasDoPdf`
        // tinham em servicos.ts, porque nunca converteu a string em `Date`.
        // Era essa diferença que fazia a tela mostrar 15/03 e a planilha
        // sair com 14/03 em Brasília.
        return (
          <TableCell key={chave} muted className="whitespace-nowrap">
            {servico.data_emissao.split("-").reverse().join("/")}
          </TableCell>
        );
      case "cidade":
        return (
          <TableCell key={chave} muted>
            {rotuloDaCidade(servico.cidade_tomador, servico.uf_tomador)}
          </TableCell>
        );
      case "valor":
        return (
          <TableCell
            key={chave}
            className="whitespace-nowrap font-semibold text-action"
          >
            R${" "}
            {converterParaNumero(servico.valor_servico).toLocaleString(
              "pt-BR",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
            )}
          </TableCell>
        );
      case "descricao":
        return (
          <TableCell key={chave} className="text-center">
            {servico.discriminacao_servico ? (
              <button
                type="button"
                onClick={() =>
                  setObservacoesSelecionadas(servico.discriminacao_servico)
                }
                className="whitespace-nowrap rounded-full bg-action-tint px-3 py-1 text-sm font-medium text-action transition-colors hover:text-action-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                Ver Observações
              </button>
            ) : (
              <span className="text-conteudo-faint">-</span>
            )}
          </TableCell>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Card padding="none">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borda p-4">
          <CardTitle>Detalhamento de Serviços</CardTitle>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-64">
              <Input
                placeholder="Pesquisar..."
                aria-label="Pesquisar serviços"
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
              // Sem nenhuma linha o clique gerava planilha e PDF só com o
              // cabeçalho — arquivo vazio que sai por e-mail parecendo
              // resultado. `TabelaDeContas.tsx` e `TabelaDeProdutos.tsx` já
              // desabilitam do mesmo jeito. `total` é o recorte inteiro
              // (filtro + busca), não a página: uma busca que não casa com
              // nada também desabilita.
              //
              // E desabilita também enquanto QUALQUER das duas exportações
              // roda: exportar busca o recorte inteiro do servidor, página a
              // página, e num recorte grande isso demora sem nada na tela
              // dizendo que está acontecendo — a pessoa clicava de novo e
              // disparava a busca inteira outra vez.
              disabled={total === 0 || exportando !== null}
              loading={exportando === "excel"}
              icon={
                <Download
                  className="h-4 w-4"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              }
            >
              {exportando === "excel" ? "Exportando..." : "Excel"}
            </Button>
            <Button
              variant="primary"
              onClick={onExportarPDF}
              disabled={total === 0 || exportando !== null}
              loading={exportando === "pdf"}
              icon={
                <Download
                  className="h-4 w-4"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              }
            >
              {exportando === "pdf" ? "Exportando..." : "PDF"}
            </Button>
          </div>
        </div>

        <Table>
          <TableHead>
            <TableRow>
              {COLUNAS.map(({ chave, rotulo, campo, Icone }) =>
                campo ? (
                  // O clique mora num `<button>` filho, e não no `<th>`: um
                  // `<th>` sozinho não entra na ordem de tabulação nem
                  // responde a Enter, então ordenar era ação só de mouse.
                  // O evento de clique borbulha do alvo para os ancestrais —
                  // por isso mover o `onClick` para dentro preserva o clique
                  // do mouse enquanto ganha o teclado; o inverso (`onClick`
                  // no `<th>`) é que não alcançaria o botão. Mesmo molde de
                  // `TabelaDeContas.tsx` e `TabelaDeProdutos.tsx`.
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
                      {Icone ? (
                        <Icone
                          className="h-4 w-4"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      ) : null}
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
            {servicos.length === 0 ? (
              // Pagination some com total zero; sem isso a tabela ficava
              // muda no filtro sem resultado (defeito 2 do spec).
              <TableEmpty colSpan={COLUNAS.length} />
            ) : (
              servicos.map((servico) => (
                <TableRow key={servico.id}>
                  {COLUNAS.map(({ chave }) => celula(servico, chave))}
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
            itemLabel="serviços"
            onPageChange={onPagina}
          />
        </div>
      </Card>

      {observacoesSelecionadas && (
        <ModalObservacoes
          observacoes={observacoesSelecionadas}
          onClose={() => setObservacoesSelecionadas(null)}
        />
      )}
    </>
  );
}
