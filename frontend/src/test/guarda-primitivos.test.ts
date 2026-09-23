import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const RAIZ = "src/design-system/ui";

function primitivos(): string[] {
  return readdirSync(RAIZ, { recursive: true, encoding: "utf8" })
    .filter((c) => c.endsWith(".tsx") && !c.endsWith(".test.tsx"))
    .map((c) => `${RAIZ}/${c}`);
}

describe("contrato de port dos primitivos", () => {
  it("existe pelo menos um primitivo para o guarda cobrir", () => {
    expect(primitivos().length).toBeGreaterThan(0);
  });

  it("nenhum primitivo usa estilo inline para aparencia", () => {
    // A proibicao e contra APARENCIA: cor, espacamento, borda, sombra. Inline,
    // essas perdem :hover, focus-visible e responsivo, e escapam do token.
    //
    // Geometria vinda de dado em tempo de execucao e outra coisa: a largura de
    // uma barra de progresso e um numero que so existe rodando, o Tailwind nao
    // tem como expressa-la, e a alternativa - uma tabela de 101 classes
    // literais - gera 107 regras de CSS para dizer um numero.
    // [^,;]*\}\}$ (nao so [^;]*\}\}) : sem a virgula proibida e a ancora no
    // fim, "width: X, background: Y" passava - [^;]* engole a virgula e
    // chega ate o "}}" verdadeiro carregando a segunda propriedade de
    // aparencia junto. So width/height sozinho no bloco passa.
    const permitido = /^\s*style=\{\{\s*(width|height):[^,;]*\}\}$/;
    const infratores: string[] = [];
    for (const caminho of primitivos()) {
      const conteudo = readFileSync(caminho, "utf8");
      // [\s\S]*? (preguicoso) em vez de [^}]* : um valor como
      // `${largura}%` tem um "}" solto no meio (o fecho do "${...}" do
      // template string), e [^}]* para exatamente nesse "}" e nunca acha o
      // "}}" verdadeiro logo depois - o achado simplesmente nao aparece e o
      // guarda fica cego para o proprio caso que deveria examinar.
      for (const achado of conteudo.match(/style=\{\{[\s\S]*?\}\}/g) ?? []) {
        if (!permitido.test(achado))
          infratores.push(`${caminho}: ${achado.slice(0, 60)}`);
      }
    }
    expect(infratores).toEqual([]);
  });

  it("nenhum primitivo faz hover por estado de React", () => {
    // Hover e CSS. onMouseEnter para pintar e re-render a toa e quebra teclado.
    //
    // Excecao: Tooltip.tsx (Task 12 - fix). O balao dele mora em portal
    // (createPortal em document.body), porque um balao absolute nascido
    // dentro da sidebar recolhida (overflow-hidden no <aside>, overflow-y-auto
    // no <nav>, que o CSS converte tambem em recorte no eixo X) nasce cortado
    // e fica invisivel - nao ha classe Tailwind que resolva isso sem tirar o
    // balao da arvore do gatilho. Só que fora dessa arvore o seletor
    // `group`/`group-hover` do Tailwind, que dependia de parentesco no DOM,
    // deixa de alcancar o balao. Hover por estado passa a ser a unica forma
    // de ligar gatilho e balao quando um esta em portal e o outro nao.
    // onFocus/onBlur continuam ao lado de onMouseEnter/onMouseLeave, entao o
    // teclado nao regride.
    const EXCECAO = "src/design-system/ui/feedback/Tooltip.tsx";
    const infratores = primitivos()
      .filter((c) => c !== EXCECAO)
      .filter((c) => /onMouseEnter|onMouseLeave/.test(readFileSync(c, "utf8")));
    expect(infratores).toEqual([]);
  });

  it("nenhum primitivo usa a ponte de paleta", () => {
    // blue-* e slate-* sao andaime das telas velhas, nao vocabulario de
    // primitivo. Primitivo fala em action, surface, borda, conteudo.
    const infratores: string[] = [];
    for (const caminho of primitivos()) {
      const achados = readFileSync(caminho, "utf8").match(
        /\b[a-z:]*-(blue|slate|darkBlue)-?[0-9]*\b/g,
      );
      for (const a of achados ?? []) infratores.push(`${caminho}: ${a}`);
    }
    expect(infratores).toEqual([]);
  });

  it("todo primitivo interativo tem anel de foco visivel", () => {
    // O original nao tem foco nenhum; o checklist do design system exige
    // focus-visible com anel de 2px. E a unica coisa que o port acrescenta.
    //
    // A tag literal <button|input|textarea|select|a> nao pega tudo: Checkbox
    // e Switch escondem o <input> real e desenham o controle num <span
    // role="...">, e um componente construido sobre <div role="button"
    // onClick> nao teria nenhuma dessas tags. `role=` (so os papeis de
    // widget interativo — nao "status"/"alert"/decorativo) e `onClick`
    // tambem contam como sinal de interatividade.
    const PAPEL_INTERATIVO =
      /role=["'](button|checkbox|radio|switch|tab|link|menuitem|option|slider|textbox|combobox|searchbox|treeitem)["']/;
    const interativos = primitivos().filter((c) => {
      const conteudo = readFileSync(c, "utf8");
      return (
        /<(button|input|textarea|select|a)\b/.test(conteudo) ||
        PAPEL_INTERATIVO.test(conteudo) ||
        /onClick=/.test(conteudo)
      );
    });
    const semFoco = interativos.filter(
      (c) => !/focus-visible:ring-2/.test(readFileSync(c, "utf8")),
    );
    expect(semFoco).toEqual([]);
  });
});
