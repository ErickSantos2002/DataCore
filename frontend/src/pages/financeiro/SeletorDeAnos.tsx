import { useTemaDoGrafico } from "../../design-system/chartTheme";
import { ANOS, type Ano } from "./financeiro";
import { corDoAno } from "./coresDoAno";

export interface SeletorDeAnosProps {
  anosAtivos: Set<Ano>;
  onAlternar: (ano: Ano) => void;
}

/**
 * Os cinco pills de ano da Visão Geral.
 *
 * Não é `Tabs`: aqui vários anos ficam ligados ao mesmo tempo, e aba é
 * escolha única. É o "segmented control de seleção múltipla" que o design
 * desenha à mão, com a cor do pill igual à da série do ano no gráfico — é a
 * única pista de qual barra é de qual ano.
 *
 * A cor vem por `style` porque nasce em JavaScript (a rampa do `chartTheme`),
 * e classe do Tailwind não enxerga valor calculado.
 */
export function SeletorDeAnos({ anosAtivos, onAlternar }: SeletorDeAnosProps) {
  useTemaDoGrafico();
  return (
    <div className="flex flex-wrap gap-2">
      {ANOS.map((ano) => {
        const ativo = anosAtivos.has(ano);
        return (
          <button
            key={ano}
            type="button"
            aria-pressed={ativo}
            onClick={() => onAlternar(ano)}
            className={[
              "rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
              ativo ? "text-on-primary" : "border-borda text-conteudo-faint",
            ].join(" ")}
            style={
              ativo
                ? { backgroundColor: corDoAno(ano), borderColor: corDoAno(ano) }
                : undefined
            }
          >
            {ano}
          </button>
        );
      })}
    </div>
  );
}
