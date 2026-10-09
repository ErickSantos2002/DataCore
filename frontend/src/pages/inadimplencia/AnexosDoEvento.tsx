import { useEffect, useRef, useState } from "react";
import { FileText, ImageOff, Paperclip, Trash2 } from "lucide-react";

import { Button, Modal, Spinner } from "../../design-system/ui";
import { apagarAnexo, baixarAnexo, enviarAnexos, type AnexoDoEvento, type Evento } from "../../services/inadimplencia";
import { MAXIMO_POR_CONTATO, ehImagem } from "./anexos";
import { CampoDeAnexos } from "./CampoDeAnexos";
import { mensagemDeErro } from "./inadimplencia";
import { useAnexosEscolhidos, useUrlDoAnexo } from "./useAnexos";

const FOCO = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

/** O que o anexo precisa de quem o mostra: recarregar a empresa depois de mexer, e o erro no Alert do modal. */
export interface AcoesDoAnexo {
  onMudou: () => Promise<void>;
  onErro: (mensagem: string) => void;
}

/**
 * A imagem grande. O Esc fecha só o visor: o Modal não usa portal, e sem o `stopPropagation`
 * o mesmo Esc subia até o modal da empresa e fechava os dois.
 */
function VisorDeImagem({ nome, url, onFechar }: { nome: string; url: string; onFechar: () => void }) {
  return (
    <div onKeyDown={(e) => { if (e.key === "Escape") e.stopPropagation(); }}>
      <Modal open onClose={onFechar} size="full" title={nome}>
        <img src={url} alt={nome} className="mx-auto max-h-[75vh] max-w-full object-contain" />
      </Modal>
    </div>
  );
}

function AnexoNaLinha({ anexo, onMudou, onErro }: { anexo: AnexoDoEvento } & AcoesDoAnexo) {
  const nome = anexo.nome_original;
  const imagem = ehImagem(anexo.tipo);
  const arquivo = useUrlDoAnexo(anexo.id, imagem); // o PDF só baixa no clique
  const [aberto, setAberto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const urlsDoPdf = useRef<string[]>([]);

  useEffect(() => {
    const urls = urlsDoPdf.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const abrirPdf = async () => {
    // A aba abre AGORA, ainda dentro do clique: aberta depois do download, o bloqueador de
    // pop-up a barrava. O endereço chega quando o arquivo chega.
    const aba = window.open("", "_blank");
    try {
      const blob = await baixarAnexo(anexo.id);
      const url = URL.createObjectURL(new Blob([blob], { type: anexo.tipo }));
      urlsDoPdf.current.push(url);
      if (!aba) {
        onErro("O navegador bloqueou a aba nova. Libere as janelas deste site e tente de novo.");
        return;
      }
      aba.opener = null;
      aba.location.href = url;
    } catch (falha) {
      console.error("Não foi possível abrir o anexo.", falha);
      aba?.close();
      onErro("Não foi possível abrir o anexo.");
    }
  };

  const apagar = async () => {
    setApagando(true);
    try {
      await apagarAnexo(anexo.id);
      await onMudou();
    } catch (falha) {
      onErro(mensagemDeErro(falha));
    } finally {
      setApagando(false);
      setConfirmando(false);
    }
  };

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-start gap-1">
        {imagem ? (
          <button type="button" aria-label={`Abrir ${nome}`} title={nome} disabled={!arquivo?.url}
            onClick={() => setAberto(true)}
            className={`flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-borda bg-surface-elevated ${FOCO}`}>
            {arquivo?.url ? <img src={arquivo.url} alt={nome} className="h-full w-full object-cover" />
              : arquivo?.falhou ? <ImageOff size={20} strokeWidth={1.75} aria-hidden="true" className="text-conteudo-muted" />
              : <Spinner size="sm" />}
          </button>
        ) : (
          <button type="button" aria-label={`Abrir ${nome}`} title={nome} onClick={abrirPdf}
            className={`flex h-20 max-w-48 items-center gap-2 rounded-lg border border-borda bg-surface-elevated px-3 text-left text-xs ${FOCO}`}>
            <FileText size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
            <span className="line-clamp-3 break-all">{nome}</span>
          </button>
        )}
        <button type="button" aria-label={`Apagar ${nome}`} onClick={() => setConfirmando(true)}
          className={`rounded p-1 text-conteudo-muted hover:text-danger ${FOCO}`}>
          <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      {confirmando ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span>{`Apagar ${nome}?`}</span>
          <Button size="sm" variant="danger" onClick={apagar} loading={apagando}>Apagar</Button>
          <Button size="sm" variant="secondary" onClick={() => setConfirmando(false)} disabled={apagando}>Não apagar</Button>
        </div>
      ) : null}
      {aberto && arquivo?.url ? <VisorDeImagem nome={nome} url={arquivo.url} onFechar={() => setAberto(false)} /> : null}
    </li>
  );
}

function AnexarDepois({ eventoId, vagas, onPronto, onMudou, onErro }: {
  eventoId: number; vagas: number; onPronto: () => void;
} & AcoesDoAnexo) {
  const escolhidos = useAnexosEscolhidos(vagas);
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    setEnviando(true);
    try {
      await enviarAnexos(eventoId, escolhidos.arquivos);
      await onMudou();
      onPronto();
    } catch (falha) {
      onErro(`Os anexos não foram enviados: ${mensagemDeErro(falha)}`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mt-2 flex flex-col gap-2" onPaste={escolhidos.aoColar}>
      <CampoDeAnexos escolhidos={escolhidos} />
      <div className="flex gap-2">
        <Button size="sm" onClick={enviar} loading={enviando} disabled={escolhidos.arquivos.length === 0}>Enviar anexos</Button>
        <Button size="sm" variant="secondary" onClick={onPronto} disabled={enviando}>Cancelar</Button>
      </div>
    </div>
  );
}

/** Os anexos de um evento da linha do tempo e o "Anexar" para mandar mais depois (até 5 no total). */
export function AnexosDoEvento({ evento, onMudou, onErro }: { evento: Evento } & AcoesDoAnexo) {
  const [anexando, setAnexando] = useState(false);
  const vagas = MAXIMO_POR_CONTATO - evento.anexos.length;

  return (
    <div className="mt-2 flex flex-col gap-2">
      {evento.anexos.length > 0 ? (
        <ul aria-label="Anexos do contato" className="flex flex-wrap gap-3">
          {evento.anexos.map((a) => <AnexoNaLinha key={a.id} anexo={a} onMudou={onMudou} onErro={onErro} />)}
        </ul>
      ) : null}
      {anexando ? (
        <AnexarDepois eventoId={evento.id} vagas={vagas} onPronto={() => setAnexando(false)} onMudou={onMudou} onErro={onErro} />
      ) : vagas > 0 ? (
        <div>
          <Button variant="ghost" size="sm" icon={<Paperclip size={16} strokeWidth={1.75} />} onClick={() => setAnexando(true)}>
            Anexar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
