import type {
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";

// Interface vazia dispararia @typescript-eslint/no-empty-object-type; como
// alias de type o formato é idêntico para quem consome (TableHTMLAttributes
// verbatim), só muda a palavra-chave de declaração.
export type TableProps = TableHTMLAttributes<HTMLTableElement>;

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Linha inteira navega — realce no hover e cursor de ponteiro. */
  clickable?: boolean;
}

export interface TableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sorted?: "asc" | "desc" | null;
  onSort?: () => void;
}

export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  /** Texto secundário — data, contagem, metadado. */
  muted?: boolean;
}

const MENSAGEM_VAZIO_PADRAO = "Nenhum resultado encontrado.";

/**
 * Tabela de listagem. Envolvente com rolagem horizontal própria, para não
 * quebrar o layout quando a tela é estreita e a tabela é larga.
 *
 * ```tsx
 * <Table>
 *   <TableHead>
 *     <TableRow>
 *       <TableHeaderCell sortable sorted="desc" onSort={ordenar}>Número</TableHeaderCell>
 *       <TableHeaderCell>Cliente</TableHeaderCell>
 *     </TableRow>
 *   </TableHead>
 *   <TableBody>
 *     {itens.length === 0
 *       ? <TableEmpty colSpan={2} />
 *       : itens.map(n => <TableRow key={n.id} clickable onClick={() => abrir(n)}>…</TableRow>)}
 *   </TableBody>
 * </Table>
 * ```
 *
 * Vive dentro de `<Card padding="none">`. Sempre com `TableEmpty` para a
 * lista vazia, e `Pagination` abaixo — o primitivo mostra a contagem em
 * qualquer total maior que zero e some por inteiro quando o total é zero,
 * contando com o `TableEmpty` para dizer que a lista está vazia. Coluna de
 * texto livre precisa de largura declarada — a tabela usa `table-layout:
 * auto`, e uma célula com conteúdo longo colapsa para a largura da palavra
 * mais longa se nenhuma coluna tiver largura explícita.
 */
export function Table({ className, children, ...rest }: TableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={["w-full border-collapse text-left text-sm", className]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}

/** Cabeçalho da tabela — borda inferior separando do corpo. */
export function TableHead({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={["border-b border-borda", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </thead>
  );
}

/** Corpo da tabela. */
export function TableBody({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={className} {...rest}>
      {children}
    </tbody>
  );
}

/**
 * Linha da tabela. `clickable` acrescenta cursor de ponteiro e realce de
 * fundo no hover — quem chama ainda precisa passar o próprio `onClick`.
 */
export function TableRow({ clickable = false, className, children, ...rest }: TableRowProps) {
  return (
    <tr
      className={[
        "border-b border-borda-muted transition-colors",
        clickable ? "cursor-pointer hover:bg-surface-elevated" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </tr>
  );
}

/**
 * Cabeçalho de coluna — caixa alta, uma das duas únicas exceções à regra de
 * sentence case do design system. Quando `sortable`, o conteúdo vem dentro
 * de um `<button>`: um `<th>` não recebe foco nem responde a Enter, e o
 * original perdia o teclado ao colocar o `onClick` direto nele.
 * `aria-sort` no próprio `<th>` conta o estado para quem usa leitor de tela.
 *
 * As setas `↑ ↓ ↕` são caracteres de texto — exceção herdada do design
 * system, que em geral proíbe glifo fazendo papel de ícone.
 */
export function TableHeaderCell({
  sortable = false,
  sorted = null,
  onSort,
  className,
  children,
  ...rest
}: TableHeaderCellProps) {
  const ariaSort = !sortable ? undefined : sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none";

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={[
        "whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-conteudo-muted",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className={[
            "inline-flex select-none items-center gap-1 uppercase tracking-wider text-conteudo-muted",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
          ].join(" ")}
        >
          {children}
          <span aria-hidden="true">{sorted === "asc" ? "↑" : sorted === "desc" ? "↓" : "↕"}</span>
        </button>
      ) : (
        children
      )}
    </th>
  );
}

/** Célula de dado. `muted` para texto secundário — data, contagem, metadado. */
export function TableCell({ muted = false, className, children, ...rest }: TableCellProps) {
  return (
    <td
      className={["px-4 py-3", muted ? "text-conteudo-muted" : "text-conteudo", className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </td>
  );
}

/**
 * Estado vazio da tabela — uma linha, uma célula centralizada abrangendo
 * todas as colunas. Precisa viver dentro de `<TableBody>`, senão o `<tr>`
 * solto produz HTML inválido.
 *
 * `message` aceita nó, e não só texto: quando a lista vazia tem uma saída
 * ("Criar o primeiro usuário"), a frase e o botão que a resolve moram no
 * mesmo lugar em que a pessoa está olhando.
 */
export function TableEmpty({
  colSpan,
  message = MENSAGEM_VAZIO_PADRAO,
}: {
  colSpan: number;
  message?: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-conteudo-muted">
        {message}
      </td>
    </tr>
  );
}
