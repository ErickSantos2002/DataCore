import { Card, Icon } from "../../design-system/ui";

/* Geometria do velocímetro, na medida do design (docs/DataCoreHS.html):
 * semicírculo de raio 86 dentro de uma caixa 220×128, centro em (110,108). */
const RAIO = 86;
const CIRCUNFERENCIA = Math.PI * RAIO;
const ARCO = "M24 108 A86 86 0 0 1 196 108";
const CENTRO_X = 110;
const CENTRO_Y = 108;
/** A agulha é mais curta que o raio: ela aponta para dentro do arco. */
const AGULHA = 68;

export interface VelocimetroProps {
  /** Percentual já calculado, de 0 a 100. NaN e fora de faixa viram 0..100. */
  progresso?: number;
  /** Quanto o trimestre realizou até agora. */
  valor?: number;
  /** O degrau que este velocímetro mede. */
  degrau: number;
  /** Classe Tailwind de `stroke` — cor do arco preenchido. */
  corDoArco: string;
  /** O PL que este degrau paga: "55%", "85%", "100%". */
  rotuloBonus: string;
  /** De onde o degrau sai, em uma linha: "PL sobre 0,9× META÷4". */
  descricaoDegrau: string;
}

/** Ponta da agulha para um percentual: 0% aponta para a esquerda do arco,
 *  100% para a direita, e o meio do caminho é o topo. */
function pontaDaAgulha(percentual: number): { x: number; y: number } {
  const angulo = Math.PI * (1 - percentual / 100);
  return {
    x: CENTRO_X + Math.cos(angulo) * AGULHA,
    y: CENTRO_Y - Math.sin(angulo) * AGULHA,
  };
}

/**
 * Velocímetro semicircular de um degrau de bonificação: arco de fundo, arco
 * colorido proporcional, agulha, o percentual DA FAIXA e a situação.
 *
 * O arco é SVG puro, sem biblioteca de gráfico — é um traço só, e um
 * `strokeDasharray` proporcional resolve o desenho inteiro. A agulha é uma
 * linha e um cubo central: ela existe porque o arco sozinho não diz para
 * onde o ponteiro aponta quando o preenchimento é curto demais para se ver.
 *
 * A cor do arco é a medalha do degrau — bronze, prata, ouro. Não é
 * decoração: é como a equipe chama as três faixas de bonificação.
 */
export function Velocimetro({
  progresso = 0,
  valor = 0,
  degrau,
  corDoArco,
  rotuloBonus,
  descricaoDegrau,
}: VelocimetroProps) {
  // Meta zero faz `progresso` chegar como NaN (0 dividido por 0). Sem esta
  // rede o arco recebe `strokeDasharray="NaN"` e some da tela.
  const percentual = isNaN(progresso)
    ? 0
    : Math.min(Math.max(progresso, 0), 100);
  const traco = (percentual / 100) * CIRCUNFERENCIA;
  const falta = degrau - valor;
  const ponta = pontaDaAgulha(percentual);

  return (
    <Card className="flex flex-col items-center">
      <p className="w-full text-xs font-semibold uppercase tracking-wider text-conteudo-faint">
        {rotuloBonus}
      </p>
      <p className="mt-1 w-full font-mono text-xs text-conteudo-muted">
        {descricaoDegrau}
      </p>

      <svg
        width="100%"
        height="128"
        viewBox="0 0 220 128"
        preserveAspectRatio="xMidYMid meet"
        className="mt-3 max-w-[220px]"
        role="img"
        aria-label={`Velocímetro da faixa de bonificação de ${rotuloBonus}`}
      >
        <path
          d={ARCO}
          fill="none"
          className="stroke-borda"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d={ARCO}
          fill="none"
          className={corDoArco}
          strokeWidth="16"
          strokeDasharray={`${traco}, ${CIRCUNFERENCIA}`}
          strokeLinecap="round"
        />
        <line
          x1={CENTRO_X}
          y1={CENTRO_Y}
          x2={ponta.x.toFixed(1)}
          y2={ponta.y.toFixed(1)}
          className="stroke-conteudo-heading"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle
          cx={CENTRO_X}
          cy={CENTRO_Y}
          r="6"
          className="fill-surface stroke-conteudo-heading"
          strokeWidth="3"
        />
      </svg>

      <p className="mt-1 flex items-baseline justify-center gap-2">
        <span className="font-mono text-2xl font-bold text-conteudo-heading">
          {percentual.toFixed(1)}%
        </span>
        <span className="text-xs text-conteudo-muted">da faixa</span>
      </p>

      <p className="mt-1 text-sm text-conteudo-muted">
        Valor Atual:{" "}
        <span className="font-semibold text-success">
          R$ {valor.toLocaleString("pt-BR")}
        </span>
      </p>

      <div className="mt-3 flex w-full items-baseline justify-between gap-3 border-t border-borda pt-3">
        {falta > 0 ? (
          <>
            <span className="text-sm text-conteudo">Diferença até a meta</span>
            <span className="font-mono text-sm font-semibold text-danger">
              {"R$" +
                falta.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1 text-sm font-semibold text-success">
              <Icon name="check" size={16} strokeWidth={2} />
              Meta atingida!
            </span>
            <span className="font-mono text-sm font-semibold text-success">
              {"R$" +
                Math.abs(falta).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
              acima
            </span>
          </>
        )}
      </div>
    </Card>
  );
}
