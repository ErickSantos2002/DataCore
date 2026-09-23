import { useState } from "react";
import { Pencil, Save, X } from "lucide-react";

import { Button, Input } from "../../design-system/ui";
import { formatarDinheiro, lerValorDaMeta } from "./meta";

export interface ValorEditavelProps {
  label: string;
  sublabel?: string;
  valor: number;
  /** Recebe o valor já normalizado, com ponto decimal e duas casas. */
  onSalvar: (valorTexto: string) => Promise<void>;
}

/**
 * Um valor de configuração editado no lugar em que é lido.
 *
 * O rascunho abre já formatado em pt-BR porque é assim que a pessoa acabou de
 * ler o número na tela — obrigá-la a redigitar em formato americano seria
 * pedir uma tradução que a leitura (`lerValorDaMeta`) já sabe fazer.
 *
 * Falha ao salvar mantém o editor aberto com o que foi digitado: fechar
 * apagaria o trabalho da pessoa exatamente no momento em que ela precisa
 * tentar de novo.
 */
export function ValorEditavel({
  label,
  sublabel,
  valor,
  onSalvar,
}: ValorEditavelProps) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function abrir() {
    setRascunho(valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
    setErro(null);
    setEditando(true);
  }

  async function salvar() {
    const numero = lerValorDaMeta(rascunho);
    if (numero <= 0) {
      setErro("Informe um valor válido maior que zero.");
      return;
    }
    try {
      setSalvando(true);
      await onSalvar(numero.toFixed(2));
      setEditando(false);
    } catch (e) {
      console.error("Erro ao salvar", e);
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex-1">
      <p className="text-sm text-conteudo-muted">
        {label} {sublabel && <span className="text-xs">{sublabel}</span>}
      </p>
      {!editando ? (
        <div className="mt-1 flex items-center gap-2">
          <p className="text-2xl font-bold text-conteudo-heading">
            {formatarDinheiro(valor)}
          </p>
          <button
            type="button"
            onClick={abrir}
            title="Editar"
            className="rounded text-action transition-colors hover:text-action-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="mt-1 flex items-start gap-2">
          <Input
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            error={erro ?? undefined}
            autoFocus
            className="w-44"
          />
          <Button
            variant="primary"
            onClick={salvar}
            disabled={salvando}
            icon={<Save className="h-4 w-4" aria-hidden="true" />}
          >
            {salvando ? "..." : "Salvar"}
          </Button>
          <Button
            variant="secondary"
            aria-label="Cancelar edição"
            onClick={() => setEditando(false)}
            disabled={salvando}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}
