/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ── Camada 1: classes de token do Design System ──────────────
        // Reagem a troca de tema e a mudanca de token. É o que a Fase 1
        // em diante deve usar.
        primary: {
          DEFAULT: "var(--color-primary-500)",
          50: "var(--color-primary-50)",
          100: "var(--color-primary-100)",
          200: "var(--color-primary-200)",
          300: "var(--color-primary-300)",
          400: "var(--color-primary-400)",
          500: "var(--color-primary-500)",
          600: "var(--color-primary-600)",
          700: "var(--color-primary-700)",
          800: "var(--color-primary-800)",
          900: "var(--color-primary-900)",
        },
        action: {
          DEFAULT: "var(--action)",
          hover: "var(--action-hover)",
          tint: "var(--action-tint)",
        },
        // Texto que vai sobre um fundo de acao solido (bg-action, e as
        // variantes cheias de Button). Adicionado na Task 2: o Button
        // precisa de "text-on-primary" e o token ja existe em colors.css
        // (--text-on-primary), so nao estava mapeado ainda.
        "on-primary": "var(--text-on-primary)",
        // Idem para danger/success: o Button original usa branco solido
        // (#fff) como texto sobre esses dois fundos. "white" do Tailwind e
        // hexadecimal embutido (nao var()), entao nao e classe de token -
        // ficaria preso caso o tema mude essa cor um dia. --color-white ja
        // existe em colors.css desde a Fase 0; so faltava a classe.
        "on-danger": "var(--color-white)",
        "on-success": "var(--color-white)",
        surface: {
          DEFAULT: "var(--surface)",
          base: "var(--bg-base)",
          elevated: "var(--surface-elevated)",
        },
        borda: {
          DEFAULT: "var(--border-color)",
          muted: "var(--border-muted)",
          strong: "var(--border-strong)",
        },
        conteudo: {
          DEFAULT: "var(--text-body)",
          heading: "var(--text-heading)",
          muted: "var(--text-muted)",
          faint: "var(--text-faint)",
        },
        // success e danger ganham "hover" na Task 2: o Button escurece um
        // degrau (500 -> 600) no hover, igual ao primary faz com
        // action/action-hover. bg-success e text-danger etc. continuam
        // funcionando: DEFAULT resolve exatamente como a string resolvia.
        success: {
          DEFAULT: "var(--color-success-500)",
          hover: "var(--color-success-600)",
        },
        danger: {
          DEFAULT: "var(--color-danger-500)",
          hover: "var(--color-danger-600)",
        },
        warning: "var(--color-warning-500)",
        info: "var(--color-info-500)",
        focus: "var(--focus-ring)",
        overlay: "var(--overlay)",
        // Medalhas de bonificacao: os tres degraus de PL da Meta do
        // trimestre. Cor de DOMINIO deste produto, nao do Design System —
        // por isso a variavel nasce em src/styles/index.css e nao em
        // tokens/. A classe existe para que o JSX escreva `stroke-ouro` em
        // vez de hexadecimal cravado, que o guarda de cor proibe.
        bronze: "var(--medalha-bronze)",
        prata: "var(--medalha-prata)",
        ouro: "var(--medalha-ouro)",
        // Balao de tooltip: escuro nos DOIS temas, de proposito. Ele flutua
        // acima de qualquer superficie e precisa se destacar tanto sobre card
        // branco quanto sobre navy. --color-slate-900 e --color-white ja
        // existem em colors.css desde a Fase 0; so faltava a classe.
        tooltip: {
          DEFAULT: "var(--color-slate-900)",
          fg: "var(--color-white)",
        },
        // Painel de login: escuro nos DOIS temas, de proposito (excecao
        // documentada do design system - a tela aparece antes de qualquer
        // preferencia de tema ser aplicada, entao nao pode reagir a ela).
        // #0a192f nao existe em nenhum var() de colors.css (nao e o mesmo
        // tom de --bg-base nem de --color-slate-900), e colors.css nao e
        // editado aqui (Fase 1). Por isso e hex literal, como o resto da
        // ponte de paleta - so que fora dela, porque nao e andaime
        // temporario: e a cor final do login, para ficar.
        login: "#0a192f",
        // Retorno efemero (Toast): os tres tokens ja existem em colors.css
        // desde a Fase 0, pensados para uma biblioteca em JS (react-hot-toast/
        // sonner) que recebe objeto de estilo. Aqui o port usa Tailwind, entao
        // so faltava a classe - nao um token novo.
        toast: {
          DEFAULT: "var(--toast-bg)",
          fg: "var(--toast-color)",
          border: "var(--toast-border)",
        },
        // Tinta semantica: a cor de significado a 15% de opacidade, ja embutida
        // no token. Fundo de badge, chip e aviso. NAO use o degrau 50 da rampa:
        // um degrau fixo vira retangulo quase branco no meio do navy.
        tint: {
          primary: "var(--tint-primary)",
          success: "var(--tint-success)",
          danger: "var(--tint-danger)",
          warning: "var(--tint-warning)",
          info: "var(--tint-info)",
          neutral: "var(--tint-neutral)",
        },
        // O texto que vai por cima de cada tinta. Este sim troca por tema.
        "on-tint": {
          primary: "var(--on-tint-primary)",
          success: "var(--on-tint-success)",
          danger: "var(--on-tint-danger)",
          warning: "var(--on-tint-warning)",
          info: "var(--on-tint-info)",
          neutral: "var(--on-tint-neutral)",
        },

        // ── Camada 2: a ponte de paleta, que existiu aqui ────────────
        // Eram `blue` (dez degraus) e `slate` (700/800/900) redefinidos em
        // hexadecimal: o JSX escrevia 272 classes de azul e 132 de slate, e
        // remapear a paleta fez todas apontarem para a marca sem editar tela
        // nenhuma. Era andaime da Fase 3, para migrar doze telas uma a uma.
        //
        // Deletada em 16/09/2026, com a Fase 3 concluida e os quatro ultimos
        // consumidores (os dois modais de observacao, o CentralButton e o
        // Login) passados para classe de token. A partir daqui `bg-blue-600`
        // e `bg-slate-800` voltam a ser a paleta crua do Tailwind — e o
        // guarda de cor (`guarda-cores.test.ts`), que deriva a ponte deste
        // arquivo, passa a acusa-las sozinho.
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
      width: {
        sidebar: "var(--sidebar-width)",
        "sidebar-collapsed": "var(--sidebar-width-collapsed)",
      },
      height: {
        topbar: "var(--topbar-height)",
      },
      // O Drawer desliza da direita ao abrir. `hs-modal-in`/`hs-fade-in` (o
      // fade+zoom do Modal, o fade do Toast) já existem como CSS puro em
      // tokens/motion.css, fora do escopo deste adendo (não editamos
      // tokens/). O keyframe do Drawer mora aqui em vez de lá por isso —
      // ainda assim toma a duração/easing de tokens/motion.css via var(),
      // e cai sob a mesma regra de prefers-reduced-motion (ela zera
      // animation-duration para *, sem depender do nome do keyframe).
      keyframes: {
        "hs-drawer-in": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        // O `ping` do Tailwind com começo e fim explícitos: o anel do botão da
        // Central HS nasce visível e termina invisível, e fica assim.
        "hs-pulso": {
          "0%": { transform: "scale(1)", opacity: "0.75" },
          "75%, 100%": { transform: "scale(2)", opacity: "0" },
        },
      },
      animation: {
        "hs-drawer-in": "hs-drawer-in var(--duration-drawer) var(--ease-out)",
        // Três voltas e `forwards`: o `animate-ping` rodava em laço em todas as
        // telas. Com prefers-reduced-motion, motion.css reduz a uma volta de
        // 0,01 ms, e o `forwards` a deixa no quadro final — invisível.
        "hs-pulso": "hs-pulso 2s cubic-bezier(0, 0, 0.2, 1) 3 forwards",
      },
      zIndex: {
        // Escala unica de sobreposicao. O numero nao importa; a ORDEM importa,
        // e ela e: o que flutua junto do conteudo < o que cobre a tela < o que
        // avisa por cima de tudo. Tooltip vem por ultimo entre os flutuantes
        // porque ele pode aparecer DENTRO de um modal.
        dropdown: "50",
        overlay: "200",
        tooltip: "300",
        toast: "400",
      },
    },
  },
  plugins: [],
};
