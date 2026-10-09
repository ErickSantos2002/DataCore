/**
 * Regras dos anexos do contato, sem React. O backend confere de novo pelo CONTEÚDO
 * (assinatura do arquivo); aqui é só para avisar antes de mandar 30 MB à toa.
 */

export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
/** O `accept` do input: tipo e extensão, porque há sistema que não informa o tipo do arquivo. */
export const ACEITAR = "image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf";
export const TAMANHO_MAXIMO = 10 * 1024 * 1024;
export const MAXIMO_POR_CONTATO = 5;

export const ehImagem = (tipo: string) => tipo.startsWith("image/");

const PELA_EXTENSAO: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf",
};

/** O tipo do arquivo; vazio (há gerenciador de arquivo e zip que não informam), sai da extensão.
 *  Só para avisar e desenhar a miniatura: quem decide é o backend, pelo conteúdo. */
export function tipoDoArquivo(f: File): string {
  if (f.type) return f.type;
  const ext = f.name.includes(".") ? f.name.split(".").pop()!.toLowerCase() : "";
  return PELA_EXTENSAO[ext] ?? "";
}

/** Junta os arquivos novos aos já escolhidos, cortando o que não passa; cada corte vira um aviso. */
export function juntarArquivos(atuais: File[], novos: File[], vagas: number): { arquivos: File[]; avisos: string[] } {
  const arquivos = [...atuais];
  const avisos: string[] = [];
  let sobrou = false;
  for (const f of novos) {
    if (!TIPOS_ACEITOS.includes(tipoDoArquivo(f))) { avisos.push(`${f.name} não é JPG, PNG, WebP nem PDF.`); continue; }
    if (f.size > TAMANHO_MAXIMO) { avisos.push(`${f.name} passa de 10 MB.`); continue; }
    if (arquivos.length >= vagas) { sobrou = true; continue; }
    arquivos.push(f);
  }
  if (sobrou) {
    avisos.push(vagas >= MAXIMO_POR_CONTATO
      ? `No máximo ${MAXIMO_POR_CONTATO} anexos por contato.`
      : `Este contato só aceita mais ${vagas} ${vagas === 1 ? "anexo" : "anexos"}.`);
  }
  return { arquivos, avisos };
}
