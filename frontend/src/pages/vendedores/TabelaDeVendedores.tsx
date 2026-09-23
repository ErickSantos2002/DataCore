import { useState } from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Mail,
  Package,
  Phone,
  Search,
  Users,
  X,
} from "lucide-react";

import ModalObservacoesDaNota from "../../components/ModalObservacoesDaNota";
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
import type { BadgeProps } from "../../design-system/ui/core/Badge";
import type { CampoDeOrdenacao } from "../comercial/useComercial";
import type { NotaVenda } from "../../services/notasapi";
import type { OrdenacaoDeVendedores } from "./vendedores";

const TIPOS = ["Outbound", "Inbound", "ReCompra"] as const;

/** A cor de cada tipo. Era azul, verde e roxo de paleta crua, com `dark:` por
 *  cima; o roxo não existe no design system e vira `info`. */
const VARIANTE_DO_TIPO: Record<string, BadgeProps["variant"]> = {
  Outbound: "primary",
  Inbound: "success",
  ReCompra: "info",
};

export interface TabelaDeVendedoresProps {
  notas: NotaVenda[];
  total: number;
  pagina: number;
  onPagina: (pagina: number) => void;
  pesquisa: string;
  onPesquisar: (termo: string) => void;
  ordenacao: OrdenacaoDeVendedores;
  onOrdenar: (campo: CampoDeOrdenacao) => void;
  onExportar: () => void;
  /** A exportação percorre todas as páginas do servidor e demora num recorte
   *  grande: enquanto roda, o botão diz isso e não aceita outro clique. */
  exportando: boolean;
  /** Grava o tipo. Rejeita quando falha — e aí a edição continua aberta. */
  onSalvarTipo: (idNota: number, tipo: string) => Promise<void>;
}

/**
 * A tabela "Minhas Vendas": busca, exportação, sete colunas — quatro
 * ordenáveis — e paginação de 15 em 15, com a edição do tipo da nota.
 *
 * Nasce limpa, sobre os primitivos de tabela. Os estados que só a tabela lê e
 * escreve — qual nota está em edição, o tipo escolhido, qual está gravando e
 * qual observação está aberta — vieram junto (colocation). A gravação em si
 * continua na casca, que é quem fala com a rede e com o toast.
 *
 * O modal de observações sai de dentro do `<tbody>` — onde era HTML inválido —
 * para irmão do `Card`, sem mudar nada visível: ele é `position: fixed`.

 */
export function TabelaDeVendedores({
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
  onSalvarTipo,
}: TabelaDeVendedoresProps) {
  const [editandoTipo, setEditandoTipo] = useState<number | null>(null);
  const [tipoTemp, setTipoTemp] = useState<string>("");
  const [salvandoTipo, setSalvandoTipo] = useState<number | null>(null);
  // Guarda o ID, e não o texto: o texto é buscado pelo modal ao abrir.
  const [notaDasObservacoes, setNotaDasObservacoes] = useState<number | null>(
    null,
  );

  const iniciarEdicaoTipo = (notaId: number, tipoAtual: string | null) => {
    setEditandoTipo(notaId);
    setTipoTemp(tipoAtual || "Outbound");
  };

  const cancelarEdicaoTipo = () => {
    setEditandoTipo(null);
    setTipoTemp("");
  };

  const salvarTipo = async (notaId: number) => {
    try {
      setSalvandoTipo(notaId);
      await onSalvarTipo(notaId, tipoTemp);
      setEditandoTipo(null);
      setTipoTemp("");
    } catch {
      // A casca já avisou; a edição fica aberta com a escolha.
    } finally {
      setSalvandoTipo(null);
    }
  };

  const indicador = (campo: CampoDeOrdenacao) =>
    ordenacao.campo === campo ? (
      ordenacao.direcao === "desc" ? (
        <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      ) : (
        <ChevronUp className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      )
    ) : null;

  // O clique mora num `<button>` dentro do `<th>`, e não no `<th>`: um `<th>`
  // não entra na ordem de tabulação nem responde a Enter, e ordenar era ação
  // só de mouse. Não é o `sortable` do primitivo porque ele acrescenta as
  // setas "↑ ↓ ↕" como TEXTO no cabeçalho; aqui fica o chevron, como em
  // `servicos/TabelaDeServicos.tsx`. `aria-sort` conta a direção a quem não vê.
  const ordenavel = (
    campo: CampoDeOrdenacao,
    rotulo: string,
    icone?: React.ReactNode,
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
      <button
        type="button"
        onClick={() => onOrdenar(campo)}
        aria-label={`Ordenar por ${rotulo}`}
        // `uppercase` de novo aqui: o preflight do Tailwind zera text-transform
        // em `button`, e os cabeçalhos ordenáveis saíam em caixa normal ao lado
        // dos outros em caixa alta.
        className="inline-flex select-none items-center gap-1 uppercase tracking-wider focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {icone}
        <span>{rotulo}</span>
        {indicador(campo)}
      </button>
    </TableHeaderCell>
  );

  return (
    <>
      <Card padding="none">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borda p-4">
          <CardTitle>Minhas Vendas</CardTitle>

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
              // Desabilita com a tabela vazia — o clique gerava planilha só
              // com o cabeçalho, que sai por e-mail parecendo resultado — e
              // enquanto exporta: o estado `exportando` existia na casca e
              // ninguém lia, e o segundo clique recomeçava a busca inteira.
              // `total` é o recorte com a busca, e não a página.
              disabled={total === 0 || exportando}
              loading={exportando}
              icon={
                <Download
                  className="h-4 w-4"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              }
            >
              {exportando ? "Exportando..." : "Exportar Excel"}
            </Button>
          </div>
        </div>

        <Table>
          <TableHead>
            <TableRow>
              {ordenavel(
                "data_emissao",
                "Data",
                <Calendar
                  className="h-4 w-4"
                  strokeWidth={2}
                  aria-hidden="true"
                />,
              )}
              {ordenavel("cliente", "Cliente")}
              {ordenavel("valor_produtos", "Valor")}
              <TableHeaderCell>
                <span className="inline-flex items-center gap-1">
                  <Package
                    className="h-4 w-4"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span>Produtos</span>
                </span>
              </TableHeaderCell>
              <TableHeaderCell>
                <span className="inline-flex items-center gap-1">
                  <Users
                    className="h-4 w-4"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span>Vendedor</span>
                </span>
              </TableHeaderCell>
              <TableHeaderCell className="text-center">
                Observações
              </TableHeaderCell>
              {ordenavel("tipo", "Tipo da Nota")}
            </TableRow>
          </TableHead>

          <TableBody>
            {notas.length === 0 ? (
              // Pagination some com total zero; sem isso a tabela ficava
              // muda no filtro sem resultado (defeito 2 do spec).
              <TableEmpty colSpan={7} />
            ) : (
              notas.map((nota) => (
                <TableRow key={nota.id}>
                  <TableCell muted className="whitespace-nowrap text-sm">
                    {nota.data_emissao.split("-").reverse().join("/")}
                  </TableCell>

                  <TableCell>
                    <p className="text-sm font-medium">
                      {nota.cliente?.nome || "Cliente não informado"}
                    </p>
                    <p className="text-xs text-conteudo-muted">
                      {nota.cliente?.cpf_cnpj}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-3">
                      {nota.cliente?.email && (
                        <span className="flex items-center text-xs text-conteudo-faint">
                          <Mail className="mr-1 h-3 w-3" aria-hidden="true" />
                          {nota.cliente.email}
                        </span>
                      )}
                      {nota.cliente?.fone && (
                        <span className="flex items-center text-xs text-conteudo-faint">
                          <Phone className="mr-1 h-3 w-3" aria-hidden="true" />
                          {nota.cliente.fone}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="whitespace-nowrap text-sm font-semibold text-action">
                    R${" "}
                    {Number(nota.valor_produtos).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>

                  <TableCell muted className="text-sm">
                    {nota.itens?.length > 0 ? (
                      <div>
                        <p
                          className="max-w-[10rem] truncate"
                          title={nota.itens.map((i) => i.descricao).join(", ")}
                        >
                          {nota.itens.map((i) => i.descricao).join(", ")}
                        </p>
                        <p className="mt-1 text-xs text-conteudo-faint">
                          {nota.itens.length}{" "}
                          {nota.itens.length === 1 ? "item" : "itens"}
                        </p>
                      </div>
                    ) : (
                      "Sem itens"
                    )}
                  </TableCell>

                  <TableCell muted className="text-sm">
                    {nota.nome_vendedor || "Não informado"}
                  </TableCell>

                  <TableCell className="text-center">
                    {nota.tem_observacoes ? (
                      <button
                        type="button"
                        onClick={() => setNotaDasObservacoes(nota.id)}
                        className="whitespace-nowrap rounded-full bg-action-tint px-3 py-1 text-sm font-medium text-action transition-colors hover:text-action-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        Ver Observações
                      </button>
                    ) : (
                      <span className="text-conteudo-faint">-</span>
                    )}
                  </TableCell>

                  <TableCell>
                    {editandoTipo === nota.id ? (
                      <div className="flex items-center gap-1">
                        <select
                          aria-label="Tipo da nota"
                          value={tipoTemp}
                          onChange={(e) => setTipoTemp(e.target.value)}
                          className="rounded-lg border border-borda bg-surface px-1 py-1 text-sm text-conteudo focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                          disabled={salvandoTipo === nota.id}
                        >
                          {TIPOS.map((tipo) => (
                            <option key={tipo} value={tipo}>
                              {tipo}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => salvarTipo(nota.id)}
                          aria-label="Salvar tipo"
                          disabled={salvandoTipo === nota.id}
                          className="rounded p-1 text-success transition-colors hover:bg-tint-success focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        >
                          {salvandoTipo === nota.id ? (
                            <span className="block h-4 w-4 animate-spin rounded-full border-2 border-success border-t-transparent" />
                          ) : (
                            <Check className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={cancelarEdicaoTipo}
                          aria-label="Cancelar edição do tipo"
                          disabled={salvandoTipo === nota.id}
                          className="rounded p-1 text-danger transition-colors hover:bg-tint-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      // Botão, e não `<div onClick>`: o selo abre uma edição, e
                      // o `<div>` ficava fora da ordem de tabulação e mudo para
                      // leitor de tela.
                      <button
                        type="button"
                        onClick={() =>
                          iniciarEdicaoTipo(nota.id, nota.tipo ?? null)
                        }
                        aria-label={`Editar tipo da nota: ${nota.tipo || "Não definido"}`}
                        className="rounded px-2 py-1 transition-colors hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        <Badge
                          variant={
                            (nota.tipo && VARIANTE_DO_TIPO[nota.tipo]) ||
                            "secondary"
                          }
                        >
                          {nota.tipo || "Não definido"}
                        </Badge>
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="px-4 pb-4">
          {/*
            O `Pagination` do design system, e não as 99 linhas que estavam
            aqui. As que saíram escondiam a frase de contagem dentro do
            `{totalPaginas > 1 && ...}`: quem tinha 10 notas ou menos não lia
            contagem nenhuma.
          */}
          <Pagination
            page={pagina}
            pageSize={15}
            total={total}
            itemLabel="notas"
            onPageChange={onPagina}
          />
        </div>
      </Card>

      {notaDasObservacoes !== null && (
        <ModalObservacoesDaNota
          idNota={notaDasObservacoes}
          onClose={() => setNotaDasObservacoes(null)}
        />
      )}
    </>
  );
}
