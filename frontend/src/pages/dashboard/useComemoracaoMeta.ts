import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";

/* Paleta da comemoração. É hexadecimal de propósito, e não token: o
 * `canvas-confetti` pinta num <canvas> por cima da tela, recebe cor como
 * string e não enxerga CSS. Não são cores de interface — nenhuma delas
 * pinta texto, fundo ou borda — são confete festivo, sem significado
 * semântico para um token carregar. */
const CORES_CONFETE = ["#FFD700", "#FFA500", "#FF6347", "#4169E1", "#32CD32"];
const CORES_FOGOS = [
  "#FFD700",
  "#FFA500",
  "#FF1493",
  "#00CED1",
  "#32CD32",
  "#FF6347",
];

/** 3 segundos de comemoração, e o intervalo que a alimenta. */
const DURACAO_MS = 3000;
const PASSO_MS = 150;

function confeteEsquerda() {
  confetti({
    particleCount: 7,
    angle: 60,
    spread: 55,
    origin: { x: 0, y: 0.6 },
    colors: CORES_CONFETE,
  });
}

function confeteDireita() {
  confetti({
    particleCount: 7,
    angle: 120,
    spread: 55,
    origin: { x: 1, y: 0.6 },
    colors: CORES_CONFETE,
  });
}

function fogosDeArtificio() {
  confetti({
    particleCount: 100,
    spread: 360,
    startVelocity: 30,
    decay: 0.9,
    scalar: 1.2,
    origin: { x: Math.random(), y: Math.random() * 0.5 },
    colors: CORES_FOGOS,
  });
}

export interface ComemoracaoMeta {
  /** Vem da chave ANIMACAO_META; só o texto "true" liga a comemoração. */
  habilitada: boolean;
  carregando: boolean;
  total: number;
  degrau55: number;
  degrau85: number;
  degrau100: number;
}

/**
 * Dispara a chuva de confete quando o trimestre bate algum degrau.
 *
 * Uma vez por sessão, não uma vez por render: o `ref` é o que impede a tela
 * inteira de virar uma máquina de confete a cada vez que o total é
 * recalculado. E é `useRef`, não `useState`, porque disparar não muda nada
 * que a tela desenhe — mudar estado aqui só provocaria mais um render.
 */
export function useComemoracaoMeta({
  habilitada,
  carregando,
  total,
  degrau55,
  degrau85,
  degrau100,
}: ComemoracaoMeta) {
  const jaDisparou = useRef(false);

  useEffect(() => {
    if (carregando || jaDisparou.current || !habilitada) return;

    const bateuAlgumDegrau =
      total >= degrau55 || total >= degrau85 || total >= degrau100;
    if (!bateuAlgumDegrau) return;

    jaDisparou.current = true;

    // Quem ativou "reduzir movimento" no sistema recebia os 3 segundos de
    // chuva e fogos como todo mundo. Para essa pessoa, um estouro só, no
    // centro: a comemoração continua, calma. Para os outros nada muda —
    // decisão do Erick (22/09): o confete fica, todo mundo gosta dele.
    // `matchMedia` com `?.`: o jsdom não tem, e sem ele vale a comemoração
    // inteira.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { x: 0.5, y: 0.6 },
        colors: CORES_CONFETE,
      });
      return;
    }

    const fim = Date.now() + DURACAO_MS;
    const intervalo = setInterval(() => {
      if (fim - Date.now() <= 0) {
        clearInterval(intervalo);
        return;
      }
      confeteEsquerda();
      confeteDireita();
      if (Math.random() > 0.7) fogosDeArtificio();
    }, PASSO_MS);

    // Três estouros iniciais, para a comemoração começar cheia em vez de ir
    // enchendo aos poucos.
    const estouros = [100, 500, 900].map((atraso) =>
      setTimeout(fogosDeArtificio, atraso),
    );

    // O original não limpava nada: sair da tela no meio da comemoração
    // deixava o intervalo vivo, chamando o confete de dentro de uma página
    // que já não existe.
    return () => {
      clearInterval(intervalo);
      for (const estouro of estouros) clearTimeout(estouro);
    };
  }, [carregando, habilitada, total, degrau55, degrau85, degrau100]);
}
