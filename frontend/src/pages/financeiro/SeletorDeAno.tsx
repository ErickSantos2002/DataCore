import { ANOS, type Ano } from "./financeiro";

export interface SeletorDeAnoProps {
  ano: number;
  onAno: (ano: Ano) => void;
}

/**
 * O seletor de ano único — o mesmo no Balancete e no Centro de Custo.
 *
 * Devolve um fragmento, e não um invólucro: quem chama decide o cartão e o
 * que mais mora ao lado (no Balancete, os três totais do ano ficam na mesma
 * linha). Um `div` aqui obrigaria os dois consumidores ao mesmo layout.
 *
 * É botão com `aria-pressed`, e não aba: a escolha não troca de painel, ela
 * refaz o conteúdo do painel em que já se está.
 */
export function SeletorDeAno({ ano, onAno }: SeletorDeAnoProps) {
  return (
    <>
      <span className="text-sm font-semibold text-conteudo-muted">Ano:</span>
      <div className="flex gap-2">
        {ANOS.map((opcao) => (
          <button
            key={opcao}
            type="button"
            aria-pressed={ano === opcao}
            onClick={() => onAno(opcao)}
            className={[
              "rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
              ano === opcao
                ? "border-action bg-action text-on-primary"
                : "border-borda text-conteudo-muted hover:bg-surface-elevated",
            ].join(" ")}
          >
            {opcao}
          </button>
        ))}
      </div>
    </>
  );
}
