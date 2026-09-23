import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const config = require("../../tailwind.config.js");
const resolveConfig = require("tailwindcss/resolveConfig");

const EXCECOES: string[] = [];

// O content do tailwind.config.js varre "./index.html" e
// "./src/**/*.{js,ts,jsx,tsx}" — alem de .css, que carrega classe custom via
// @apply. O guarda tem que cobrir a mesma lista, senao o vao existe mesmo
// que hoje esteja limpo: um hex arbitrario num .ts, .js ou .jsx passaria
// batido, e o proprio index.html nunca era olhado.
const arquivosDeInteresse = readdirSync("src", {
  recursive: true,
  encoding: "utf8",
})
  .filter((caminho) => /\.(tsx|ts|jsx|js|css)$/.test(caminho))
  .map((caminho) => `src/${caminho}`)
  .filter((caminho) => !caminho.startsWith("src/design-system/tokens/"))
  .filter((caminho) => caminho !== "src/design-system/styles.css")
  .filter((caminho) => !EXCECOES.includes(caminho))
  .concat("index.html");

/** Remove comentário de linha e de bloco antes de procurar infrator.
 *  Sem isto, um comentário que explique a rampa ("os degraus 100/700") é
 *  lido como modificador de opacidade e o guarda acusa prosa. */
function semComentarios(conteudo: string): string {
  return conteudo
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Nomes de classe cujo valor sai de var(--...) no tailwind.config.js.
 *  Derivado do config, e nao escrito a mao, para nao ficar desatualizado
 *  quando um token novo entrar. A ponte de paleta (blue, slate, darkBlue)
 *  fica de fora sozinha: ela guarda hexadecimal, e hexadecimal aceita alfa. */
function tokensQueSaemDeVar(): string[] {
  const nomes: string[] = [];
  for (const [nome, valor] of Object.entries(config.theme.extend.colors)) {
    if (typeof valor === "string") {
      if (valor.startsWith("var(")) nomes.push(nome);
      continue;
    }
    for (const [sufixo, v] of Object.entries(valor as Record<string, string>)) {
      if (typeof v === "string" && v.startsWith("var(")) {
        nomes.push(sufixo === "DEFAULT" ? nome : `${nome}-${sufixo}`);
      }
    }
  }
  return nomes;
}

describe("guarda de cor", () => {
  it("nenhuma classe Tailwind carrega hexadecimal arbitrario", () => {
    const infratores: string[] = [];
    for (const caminho of arquivosDeInteresse) {
      const conteudo = semComentarios(readFileSync(caminho, "utf8"));
      for (const achado of conteudo.match(/\[#[0-9a-fA-F]{3,8}\]/g) ?? []) {
        infratores.push(`${caminho}: ${achado}`);
      }
    }
    expect(infratores).toEqual([]);
  });

  it("nenhuma classe de token carrega modificador de opacidade", () => {
    // Classe de token sai de var(--...), e o Tailwind nao aplica alfa sobre
    // var() que guarda hexadecimal: a regra simplesmente nao e gerada e o
    // elemento cai na regra do outro tema. Foi assim que o header ficou
    // branco no escuro depois do codemod.
    const tokens = tokensQueSaemDeVar();
    expect(tokens.length).toBeGreaterThan(10); // o guarda so vale se achou tokens

    const padrao = new RegExp(
      `[a-z:]*-(?:${tokens.sort((a, b) => b.length - a.length).join("|")})\\/[0-9]{1,3}`,
      "g",
    );

    const infratores: string[] = [];
    for (const caminho of arquivosDeInteresse) {
      const conteudo = semComentarios(readFileSync(caminho, "utf8"));
      for (const achado of conteudo.match(padrao) ?? []) {
        infratores.push(`${caminho}: ${achado}`);
      }
    }
    expect(infratores).toEqual([]);
  });
});

// ── Catraca da paleta crua ──────────────────────────────────────────────
// Lista de PENDENCIA, nao de isencao: sao os arquivos que a Fase 3 ainda
// nao migrou e que por isso ainda escrevem `text-gray-500` e companhia.
// Cada entrada existe para ser APAGADA quando a tela correspondente migrar
// — apagar a linha e parte de migrar a tela, nao um passo opcional.
//
// A lista SO ENCOLHE. Duas travas garantem isso:
//   1. arquivo fora da lista que usa paleta crua faz o guarda falhar
//      (impede regressao nova e impede tela migrada voltar atras);
//   2. arquivo NA lista que ja nao usa paleta crua TAMBEM faz falhar
//      (impede a lista apodrecer com isencao vitalicia).
// Nunca acrescente linha aqui para calar o guarda.
//
// `src/styles/index.css` nao esta na lista: a unica classe custom dele
// (`.input-cc`, consumida so pelo CentroCustoTab) ja migrou para token.
const PENDENTES_FASE_3: string[] = [];

/** Nomes de cor que o tailwind.config.js REMAPEIA com hexadecimal literal.
 *  Sao a ponte de paleta (blue, slate) e o `login`: escrever `bg-blue-600`
 *  hoje ja pinta a rampa do Design System, entao acusar essas classes seria
 *  acusar codigo certo — e um guarda que acusa codigo certo e desligado.
 *  Derivado do config, nunca escrito a mao: quando a ponte for deletada no
 *  fim da Fase 3, `blue-*` e `slate-*` passam a ser infracao sozinhos. */
function ponteDePaleta(): string[] {
  return Object.entries(config.theme.extend.colors)
    .filter(([, valor]) => {
      const valores =
        typeof valor === "string"
          ? [valor]
          : Object.values(valor as Record<string, string>);
      return valores.some((v) => typeof v === "string" && v.startsWith("#"));
    })
    .map(([nome]) => nome);
}

/** Paleta crua do Tailwind: as rampas que vem de fabrica MENOS as que a
 *  ponte remapeia. Sai do resolveConfig de um config vazio, e nao de uma
 *  lista escrita a mao, para nao envelhecer quando o Tailwind subir de
 *  versao (e para nao tocar nos apelidos legados, que so existem no
 *  `tailwindcss/colors` e disparam warn de depreciacao ao serem lidos). */
function paletaCrua(): { nomes: string[]; degraus: string[] } {
  const padrao = resolveConfig({ content: [] }).theme.colors as Record<
    string,
    unknown
  >;
  const ponte = ponteDePaleta();
  const nomes: string[] = [];
  const degraus = new Set<string>();
  for (const [nome, valor] of Object.entries(padrao)) {
    // Rampa = objeto com degrau numerado. `white`/`black`/`transparent` sao
    // string solta e ficam de fora: nao sao degrau de rampa, e varrer o
    // projeto por `text-white` acusaria primitivo ja migrado (o `bg-white/20`
    // do painel de login, por exemplo) — outra decisao, outro guarda.
    if (typeof valor !== "object" || valor === null) continue;
    if (ponte.includes(nome)) continue;
    nomes.push(nome);
    for (const degrau of Object.keys(valor)) {
      if (/^[0-9]+$/.test(degrau)) degraus.add(degrau);
    }
  }
  return { nomes, degraus: [...degraus] };
}

/** Ocorrencias de classe de paleta crua num arquivo ja sem comentario.
 *
 *  Nome de custom property NAO conta: o design system tem tokens chamados
 *  `--color-slate-900` e `--color-slate-500` (`colors.css`, copia verbatim),
 *  e o padrao casa o trecho `--color-slate-900` inteiro porque o prefixo de
 *  utilitario aceita `-`. Enquanto `slate` esteve na ponte de paleta isso
 *  ficou escondido; ao deletar a ponte, em 16/09/2026, os dois viraram
 *  "infracao" — acusar o NOME de um token do design system e acusar codigo
 *  certo. Duas barras seguidas so aparecem em custom property. */
function paletaCruaEm(caminho: string, padrao: RegExp): string[] {
  const conteudo = semComentarios(readFileSync(caminho, "utf8"));
  return (conteudo.match(padrao) ?? []).filter(
    (achado) => !achado.includes("--"),
  );
}

function padraoDePaletaCrua(): RegExp {
  const { nomes, degraus } = paletaCrua();
  // Alternativa mais longa primeiro nos dois lados: sem isso "50" casa antes
  // de "500" e o \b final so salva por backtracking — que o motor faz, mas
  // que fica fragil se alguem trocar o \b por outra ancora depois.
  const ordena = (lista: string[]) =>
    [...lista].sort((a, b) => b.length - a.length).join("|");
  // O `[a-z:-]*-` da frente exige que exista prefixo de utilitario e engole
  // as variantes: pega `text-`, `dark:hover:bg-`, `divide-`, `placeholder-`.
  // Sem ele, a palavra solta "gray-500" numa string de dado viraria infracao.
  return new RegExp(
    `[a-z:-]*-(?:${ordena(nomes)})-(?:${ordena(degraus)})\\b`,
    "g",
  );
}

describe("catraca da paleta crua do Tailwind", () => {
  it("a paleta crua sai do Tailwind e exclui a ponte do config", () => {
    // Guarda do guarda: se a derivacao vier vazia — ou vier acusando a
    // ponte — os dois testes abaixo passam por cegueira, nao por limpeza.
    const { nomes, degraus } = paletaCrua();
    const ponte = ponteDePaleta();
    expect(nomes.length).toBeGreaterThan(10);
    expect(degraus.length).toBeGreaterThan(5);
    expect(ponte.length).toBeGreaterThan(0);
    for (const nome of ponte) expect(nomes).not.toContain(nome);
  });

  it("nome de custom property do design system nao e infracao", () => {
    // `--color-slate-900` e `--color-slate-500` existem em colors.css e sao
    // lidos por `coresDoAno.ts` e pelo teste do tailwind.config. Sao NOME DE
    // TOKEN, nao classe de paleta crua.
    const padrao = padraoDePaletaCrua();
    expect("var(--color-slate-900)".match(padrao)).not.toBeNull();
    expect(
      ("var(--color-slate-900)".match(padrao) ?? []).filter(
        (achado) => !achado.includes("--"),
      ),
    ).toEqual([]);
    // E a classe de verdade continua sendo pega. Montada em pedacos porque
    // este arquivo tambem passa pelo guarda: escrita por extenso, a string
    // seria acusada.
    const classeCrua = ["bg", "slate", "900"].join("-");
    expect(classeCrua.match(padrao)).toEqual([classeCrua]);
  });

  it("nenhum arquivo fora da lista da Fase 3 usa paleta crua", () => {
    const padrao = padraoDePaletaCrua();
    const infratores: string[] = [];
    for (const caminho of arquivosDeInteresse) {
      if (PENDENTES_FASE_3.includes(caminho)) continue;
      for (const achado of paletaCruaEm(caminho, padrao)) {
        infratores.push(`${caminho}: ${achado}`);
      }
    }
    expect(infratores).toEqual([]);
  });

  it("nenhuma entrada da lista da Fase 3 esta obsoleta", () => {
    // Sem este teste a lista apodrece: alguem limpa a tela, esquece de tirar
    // a linha, e o arquivo fica isento para sempre — o buraco volta calado.
    const padrao = padraoDePaletaCrua();
    const obsoletas: string[] = [];
    for (const caminho of PENDENTES_FASE_3) {
      if (!arquivosDeInteresse.includes(caminho)) {
        obsoletas.push(`${caminho}: arquivo nao existe mais — tire da lista`);
        continue;
      }
      if (paletaCruaEm(caminho, padrao).length === 0) {
        obsoletas.push(`${caminho}: ja esta limpo — tire da lista`);
      }
    }
    expect(obsoletas).toEqual([]);
  });
});
