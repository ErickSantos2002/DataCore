import { Card } from "../../design-system/ui";
import type { DegrausDaMeta, ProjecaoDeFechamento } from "./metaTrimestral";
import { faixaAlcancada } from "./metaTrimestral";

export interface ProjecaoFechamentoProps {
  /** O faturamento apurado do trimestre até agora. */
  realizado: number;
  /** A conta já feita em metaTrimestral.ts — a tela só desenha. */
  projecao: ProjecaoDeFechamento;
  degraus: DegrausDaMeta;
}

function emReais(valor: number): string {
  return `R$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Largura de barra, em percentual do degrau de 100%, travada em 100%. */
function largura(valor: number, teto: number): string {
  if (teto <= 0) return "0%";
  return `${Math.min((valor / teto) * 100, 100)}%`;
}

/** "1,06" — o fator de crescimento como se lê, sem casa sobrando. */
function comoFator(fator: number): string {
  return fator.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** A meia-frase que abre o veredito. Ela muda com o método porque o método
 *  muda o que a frase promete: "no ritmo de hoje" é uma afirmação linear, e
 *  seria mentira em cima de uma conta sazonal. */
function abertura(projecao: ProjecaoDeFechamento): string {
  return projecao.metodo === "sazonal"
    ? `Na forma do trimestre de ${projecao.anoAnterior}`
    : "No ritmo de hoje";
}

/** De onde o número veio, em uma linha.
 *
 * Quem lê um painel de meta precisa saber isso — e precisa saber, sobretudo,
 * quando a projeção NÃO é sazonal. Sem o ano anterior a conta vira a regra de
 * três linear de antes, que superestima quando o trimestre desacelera; a
 * linha diz que caiu no linear e por quê, em vez de entregar um número com
 * cara de sazonal.
 */
function comoFoiCalculada(projecao: ProjecaoDeFechamento): string {
  const janela = `${projecao.diasDecorridos} dias apurados dos ${projecao.diasTotais} dias do trimestre`;

  if (projecao.metodo === "sazonal" && projecao.fatorCrescimento !== null) {
    return `Projeção pela sazonalidade do mesmo trimestre de ${projecao.anoAnterior}, corrigida pelo fator de crescimento ${comoFator(projecao.fatorCrescimento)}× medido em ${janela}.`;
  }

  return `Sem faturamento de ${projecao.anoAnterior} para comparar: projeção linear sobre ${janela}.`;
}

/**
 * Projeção de fechamento contra o realizado até agora, na mesma barra.
 *
 * Duas barras empilhadas numa trilha só, e não duas barras lado a lado: o
 * projetado CONTÉM o realizado, então mostrá-los sobrepostos deixa a
 * diferença — o que ainda falta acontecer — visível como o pedaço cinza que
 * sobra à direita do azul. A trilha inteira é o degrau de 100%, para que a
 * distância até a meta cheia seja lida sem conta nenhuma.
 */
export function ProjecaoFechamento({
  realizado,
  projecao,
  degraus,
}: ProjecaoFechamentoProps) {
  const faixaDeHoje = faixaAlcancada(realizado, degraus);
  const faixaProjetada = faixaAlcancada(projecao.projetado, degraus);

  return (
    <Card padding="lg">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-conteudo-faint">
            Projeção de fechamento
          </p>
          {projecao.disponivel ? (
            <>
              <p className="mt-2 font-mono text-2xl font-bold text-conteudo-heading">
                {emReais(projecao.projetado)}
              </p>
              <p className="mt-1 text-sm font-semibold text-conteudo">
                {`${abertura(projecao)}, ${
                  faixaProjetada
                    ? `o trimestre fecha no PL de ${faixaProjetada}.`
                    : "o trimestre fecha abaixo da primeira faixa."
                }`}
              </p>
              <p className="mt-1 text-xs text-conteudo-muted">
                {comoFoiCalculada(projecao)}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 font-mono text-2xl font-bold text-conteudo-faint">
                —
              </p>
              <p className="mt-1 text-sm text-conteudo-muted">
                Ainda não há dia apurado neste trimestre, então não há ritmo
                para projetar.
              </p>
            </>
          )}
        </div>

        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wider text-conteudo-faint">
            Realizado até agora
          </p>
          <p className="mt-2 font-mono text-xl font-bold text-conteudo-heading">
            {emReais(realizado)}
          </p>
          <p className="mt-1 text-xs text-conteudo-muted">
            {faixaDeHoje
              ? `PL garantido: ${faixaDeHoje}`
              : "Nenhuma faixa garantida ainda"}
          </p>
        </div>
      </div>

      <div className="relative mt-5 h-2.5 overflow-hidden rounded-full bg-action-tint">
        <div
          className="absolute bottom-0 left-0 top-0 rounded-full bg-conteudo-faint"
          style={{ width: largura(projecao.projetado, degraus.degrau100) }}
        />
        <div
          className="absolute bottom-0 left-0 top-0 rounded-full bg-action"
          style={{ width: largura(realizado, degraus.degrau100) }}
        />
      </div>

      <div className="mt-2 flex justify-between font-mono text-xs text-conteudo-faint">
        <span>R$ 0</span>
        <span>{`Meta 100% · ${emReais(degraus.degrau100)}`}</span>
      </div>

      <div className="mt-3 flex gap-5 text-xs text-conteudo-muted">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm bg-action"
            aria-hidden="true"
          />
          Realizado
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm bg-conteudo-faint"
            aria-hidden="true"
          />
          Projetado
        </span>
      </div>
    </Card>
  );
}
