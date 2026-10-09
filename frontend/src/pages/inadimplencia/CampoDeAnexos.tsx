import { useCallback, useId, useRef } from "react";
import { FileText, Paperclip, X } from "lucide-react";

import { Button } from "../../design-system/ui";
import { ACEITAR, ehImagem } from "./anexos";
import type { AnexosEscolhidos } from "./useAnexos";

const FOCO = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

/** Miniatura do arquivo ainda não enviado. A URL nasce e morre com o `<img>` (ref com limpeza). */
function Previa({ arquivo }: { arquivo: File }) {
  const comUrl = useCallback((img: HTMLImageElement | null) => {
    if (!img) return;
    const url = URL.createObjectURL(arquivo);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  if (ehImagem(arquivo.type)) {
    return <img ref={comUrl} alt={arquivo.name} className="h-16 w-16 rounded object-cover" />;
  }
  return (
    <span className="flex h-16 max-w-40 items-center gap-1 px-2 text-xs">
      <FileText size={20} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{arquivo.name}</span>
    </span>
  );
}

/**
 * O campo "Anexos": clique, arrastar e soltar. O Ctrl+V fica com quem envolve o campo
 * (`escolhidos.aoColar` no `onPaste`), para valer com o foco em qualquer campo do formulário.
 */
export function CampoDeAnexos({ escolhidos }: { escolhidos: AnexosEscolhidos }) {
  const entrada = useRef<HTMLInputElement>(null);
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-conteudo">Anexos</label>
      <div
        data-testid="area-de-anexos"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); escolhidos.adicionar(Array.from(e.dataTransfer?.files ?? [])); }}
        className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-borda-strong p-3 text-sm text-conteudo-muted"
      >
        <input id={id} ref={entrada} type="file" multiple accept={ACEITAR} className="sr-only"
          onChange={(e) => {
            escolhidos.adicionar(Array.from(e.target.files ?? []));
            e.target.value = ""; // escolher o mesmo arquivo de novo dispara o change
          }} />
        <Button type="button" variant="secondary" size="sm" icon={<Paperclip size={16} strokeWidth={1.75} />}
          onClick={() => entrada.current?.click()}>
          Escolher arquivos
        </Button>
        <span>ou arraste aqui, ou cole um print (Ctrl+V). JPG, PNG, WebP ou PDF, até 10 MB cada.</span>
      </div>
      {escolhidos.arquivos.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {escolhidos.arquivos.map((f, i) => (
            <li key={`${i}-${f.name}-${f.lastModified}`} className="relative rounded-lg border border-borda bg-surface-elevated">
              <Previa arquivo={f} />
              <button type="button" aria-label={`Tirar ${f.name}`} onClick={() => escolhidos.remover(i)}
                className={`absolute -right-2 -top-2 rounded-full border border-borda bg-surface p-0.5 text-conteudo-muted hover:text-danger ${FOCO}`}>
                <X size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {escolhidos.avisos.map((a) => <p key={a} className="text-sm text-danger">{a}</p>)}
    </div>
  );
}
