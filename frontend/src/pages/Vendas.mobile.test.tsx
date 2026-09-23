import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Vendas from "./Vendas";

/**
 * Caracterização do que `isMobile` controla no eixo do ranking de vendedores
 * de Vendas, depois de a Task 5 trocar as três leituras soltas de
 * `window.innerWidth` do `YAxis` do gráfico "Top 5 Vendedores"
 * (`Vendas.tsx`) pelo `isMobile` que a tela já declarava e não usava em
 * lugar nenhum do JSX.
 *
 * O arquivo ficou para trás quando aquela troca subiu: falsificava o
 * `../context/DataContext`, que outra frente apagou ao trocar a fonte de
 * dados desta tela pelo resumo agregado do Postgres. O que ele afirma é o
 * mesmo de antes — só a falsificação mudou.
 *
 * Antes desta task, um `resize` disparado com evento (`redimensionarPara`)
 * também atualizava o eixo — mas por acidente: as três leituras não eram
 * reativas, só liam `window.innerWidth` de novo a cada render. O que
 * disparava esse render era outro hook, o `useIsMobile` já declarado e
 * ignorado, cujo listener de `resize` mudava de estado e forçava um
 * re-render de todo o componente por baixo. Por isso um re-render por
 * QUALQUER outro motivo (digitar na busca, por exemplo) também recalculava
 * o eixo, mesmo sem `resize` nenhum — esse era o defeito real, que o
 * segundo teste isolava.
 *
 * Depois da troca, `isMobile` é o estado que o próprio hook expõe: só muda
 * dentro do listener de `resize`. Um `resize` de verdade continua
 * atualizando o eixo — só que agora porque é reativo, não por acidente. Um
 * re-render por outro motivo já não atualiza mais nada, porque `isMobile`
 * não mudou de valor — é o segundo teste que passou a provar isso.
 *
 * Mocks copiados de `Vendas.multiselect.test.tsx`, que já monta a tela com
 * sucesso — só o dublê de recharts muda, porque aqui o que interessa é o
 * `YAxis`, e o dublê comum (`() => null`) o descartaria.
 */
// A tela pede o toast para avisar falha de exportação; o assunto deste
// arquivo é outro, então o dublê só precisa existir.
vi.mock("../components/ToastProvider", () => ({
  useToast: () => ({
    sucesso: vi.fn(),
    erro: vi.fn(),
    aviso: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "erick", role: "admin" } }),
}));

// A tela deixou de ler o `DataContext` (item 9.4): os agregados vêm somados do
// banco e a tabela vem paginada; aquele context nem existe mais. O falso mora
// em `comercial/hooksFalsos`, igual ao de `Vendas.paginacao.test.tsx`. O que
// este arquivo afirma não depende da fonte: o eixo do ranking lê `isMobile`,
// não o dado.
//
// 15/09/2026, migração: o falso passou a ser o de `vendas/vendasFalsas.ts`. O de
// `criarHooksFalsos` com duas notas devolvia o resumo VAZIO, e com os gráficos
// sem dado virando `ChartEmpty` o Top 5 Vendedores não monta eixo nenhum — o
// teste só enxergava o eixo porque o gráfico vazio desenhava assim mesmo. O
// resumo de `vendasFalsas` tem os quatro gráficos com dado, e o índice 2
// continua sendo o eixo dos vendedores.
vi.mock("./comercial/useComercial", async (original) => {
  const real = await original<typeof import("./comercial/useComercial")>();
  const { hooksDeVendas } = await import("./vendas/vendasFalsas");
  return { ...real, ...hooksDeVendas() };
});

vi.mock("recharts", () => {
  const semDesenho = () => null;
  return {
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    BarChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    LineChart: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    PieChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Bar: semDesenho,
    Line: semDesenho,
    Pie: semDesenho,
    Cell: semDesenho,
    // Expõe `width` e `tick.fontSize` — duas das três leituras de
    // `window.innerWidth` que o `YAxis` do ranking de vendedores fazia direto
    // no render (a terceira mora no `tickFormatter`, que este dublê nao chama).
    XAxis: semDesenho,
    YAxis: ({
      width,
      tick,
    }: {
      width?: number;
      tick?: { fontSize?: number };
    }) => (
      <div
        data-testid="eixo-y"
        data-width={String(width)}
        data-fonte={String(tick?.fontSize)}
      />
    ),
    Tooltip: semDesenho,
    CartesianGrid: semDesenho,
    Legend: semDesenho,
  };
});

const LARGURA_ORIGINAL = window.innerWidth;

function redimensionarPara(largura: number) {
  Object.defineProperty(window, "innerWidth", {
    value: largura,
    writable: true,
    configurable: true,
  });
  fireEvent(window, new Event("resize"));
}

afterEach(() => {
  Object.defineProperty(window, "innerWidth", {
    value: LARGURA_ORIGINAL,
    writable: true,
    configurable: true,
  });
});

describe("Vendas — o eixo do ranking de vendedores reage ao isMobile do hook", () => {
  it("resize com evento cruza o limiar e ATUALIZA o eixo — agora de verdade, porque isMobile e reativo", () => {
    render(<Vendas />);
    // Vendas monta tres YAxis (evolucao mensal, comparativo de produtos,
    // ranking de vendedores) e so o terceiro le `isMobile` — os dois
    // primeiros nao passam `width`, entao
    // `getAllByTestId("eixo-y")[0]` seria um dos outros com atributo
    // "undefined". O indice certo, na ordem de montagem, e o 2.
    const eixo = () => screen.getAllByTestId("eixo-y")[2];
    expect(eixo()).toHaveAttribute("data-width", "140");

    redimensionarPara(375);

    // Antes da Task 5 este `redimensionarPara` tambem fazia o eixo mudar
    // para 80, mas por acidente: as leituras de `window.innerWidth` nao
    // eram reativas, so recalculavam porque outro hook, morto para fins de
    // renderizacao, forcava um re-render por baixo. Depois da troca, o
    // eixo le `isMobile`, que e o proprio estado que `useIsMobile`
    // atualiza dentro do listener de `resize` — o mesmo
    // resultado, mas agora por relacao direta de causa e efeito, nao mais
    // por coincidencia.
    expect(eixo()).toHaveAttribute("data-width", "80");
  });

  it("sem um resize de verdade, o eixo nao acompanha innerWidth — nem quando outro motivo forca um re-render", () => {
    render(<Vendas />);
    const eixo = () => screen.getAllByTestId("eixo-y")[2];
    expect(eixo()).toHaveAttribute("data-width", "140");

    // Troca `innerWidth` SEM disparar `resize` — nenhum listener roda, entao
    // nada forca o componente a re-renderizar.
    Object.defineProperty(window, "innerWidth", {
      value: 375,
      writable: true,
      configurable: true,
    });
    expect(eixo()).toHaveAttribute("data-width", "140"); // continua o valor do ultimo render

    // Um re-render por um motivo QUALQUER, sem relacao com resize (aqui,
    // digitar no campo de busca da tabela). Antes da Task 5 isso recalculava
    // as tres leituras direto no corpo do render — o mesmo mecanismo
    // acidental do teste acima, so que sem um resize de verdade por tras — e
    // o eixo pulava para 80. Depois da troca, o eixo le `isMobile`, que so
    // muda dentro do listener de `resize` do hook: um re-render por outro
    // motivo nao mexe nele, e o eixo fica em 140. E esse o ponto da task —
    // o comportamento deixa de depender de um re-render acidental.
    fireEvent.change(screen.getByPlaceholderText("Pesquisar..."), {
      target: { value: "alfa" },
    });
    expect(eixo()).toHaveAttribute("data-width", "140");
  });

  it("montando ja estreito, o eixo sai compacto", () => {
    redimensionarPara(375);
    render(<Vendas />);

    // Provando que 80 é alcançável: `useIsMobile` chama `aoRedimensionar()`
    // dentro do proprio efeito de montagem (useIsMobile.ts), entao quando a
    // janela ja esta estreita antes do primeiro render, `isMobile` sai
    // `true` assim que o componente monta — sem esperar por um `resize`
    // posterior.
    expect(screen.getAllByTestId("eixo-y")[2]).toHaveAttribute(
      "data-width",
      "80",
    );
  });
});
