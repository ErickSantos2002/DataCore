import * as XLSX from "xlsx";

/** Uma aba do arquivo, com as linhas já montadas por quem chama. */
export interface AbaDePlanilha {
  /** O nome que aparece na guia, dentro do Excel. */
  nome: string;
  /** Uma linha por objeto; as chaves viram os cabeçalhos das colunas. */
  linhas: Record<string, unknown>[];
  /**
   * Ajuste na folha depois de montada — largura de coluna, formato de célula.
   *
   * **Hoje só `pages/Vendedores.tsx` usa**, e é por causa dela que existe: ela
   * define `!cols` com nove larguras e põe `t: "n"` e `z: "#,##0.00"` nas
   * colunas de valor, para saírem como número contábil em vez de texto. Se
   * aparecer uma segunda chamadora, pergunte se aquilo não devia ser o padrão
   * das nove em vez de exceção de uma.
   */
  ajustar?: (folha: XLSX.WorkSheet) => void;
}

/**
 * Monta um arquivo `.xlsx` com as abas dadas e dispara o download.
 *
 * Existe para que `json_to_sheet`, `book_new`, `book_append_sheet` e
 * `writeFile` apareçam **uma vez** no repositório. Antes do item 3 da Fase 4
 * eram nove cópias do mesmo esqueleto de quatro linhas, e sete delas montavam
 * o nome do arquivo em UTC — o defeito que fazia quem exportava depois das 21h
 * arquivar com a data do dia seguinte.
 *
 * **Não sabe nada de domínio.** Não formata número, não escolhe coluna, não
 * decide o nome do arquivo. As `linhas` chegam prontas e o `arquivo` chega
 * pronto; quem monta o nome usa `diaLocal` de `lib/datas`.
 */
export function baixarPlanilha(abas: AbaDePlanilha[], arquivo: string): void {
  const livro = XLSX.utils.book_new();

  for (const aba of abas) {
    const folha = XLSX.utils.json_to_sheet(aba.linhas);
    aba.ajustar?.(folha);
    XLSX.utils.book_append_sheet(livro, folha, aba.nome);
  }

  XLSX.writeFile(livro, arquivo);
}
