import { describe, expect, it } from "vitest";

import {
  buscaPorCnpjEntreParenteses,
  buscaPorRotuloValorOuNumero,
  buscaPorTexto,
  buscaPorTextoOuNumero,
  deTextos,
} from "./buscaDeMultiSelect";

/**
 * As quatro estratégias que as seis telas divergentes usam hoje.
 *
 * Cada caso "acha por X" só prova algo se apagar a condição que ele testa
 * derrubasse exatamente esse caso — senão o teste passa mesmo com a
 * estratégia errada, porque outra condição pega o mesmo termo por baixo.
 * É o cuidado que faltou nas primeiras rodadas de caracterização das seis
 * telas (ver `task-7-report.md`): os comentários abaixo dizem, para cada
 * teste, qual condição especificamente ele isola.
 */

const ALFA = {
  valor: "Alfa Mineração (11.222.333/0001-44)",
  rotulo: "Alfa Mineração (11.222.333/0001-44)",
};
const PRODUTO = { valor: "P1", rotulo: "Bafômetro Phoebus" };

describe("deTextos", () => {
  it("transforma texto solto em par, com valor igual ao rótulo", () => {
    expect(deTextos(["Alfa", "Beta"])).toEqual([
      { valor: "Alfa", rotulo: "Alfa" },
      { valor: "Beta", rotulo: "Beta" },
    ]);
  });
});

describe("buscaPorTexto", () => {
  it("acha pelo rótulo, sem diferenciar maiúscula", () => {
    expect(buscaPorTexto(ALFA, "alfa")).toBe(true);
    expect(buscaPorTexto(PRODUTO, "phoebus")).toBe(true);
  });

  it("não acha por número", () => {
    // O CNPJ de ALFA tem pontuação ("11.222.333/..."), então a sequência de
    // dígitos pura "11222333" não é substring literal do rótulo — só seria
    // achada se a busca normalizasse pontuação, que é exatamente o que
    // Produtos e Estoque não fazem hoje.
    expect(buscaPorTexto(ALFA, "11222333")).toBe(false);
  });

  it("termo vazio acha tudo", () => {
    expect(buscaPorTexto(ALFA, "")).toBe(true);
  });
});

describe("buscaPorTextoOuNumero", () => {
  it("acha por texto e também pelos dígitos do rótulo", () => {
    expect(buscaPorTextoOuNumero(ALFA, "alfa")).toBe(true);
    // "11222333" não é substring do rótulo com pontuação (ver teste acima de
    // buscaPorTexto) — só a condição extra dos dígitos acha isso. Se ela
    // fosse apagada, esta linha cairia de true para false.
    expect(buscaPorTextoOuNumero(ALFA, "11222333")).toBe(true);
  });

  it("acha pelos dígitos mesmo com termo misturado com letra", () => {
    // Diferença real entre Serviços e Vendedores/Vendas: Serviços não exige
    // termo todo dígito (`buscaPorCnpjEntreParenteses` exige, com o
    // `/^\d+$/.test(termo)`). "x11" tem letra, mas os dígitos "11" ainda
    // batem nos dígitos do rótulo — é o comportamento de Serviços hoje, e
    // fixá-lo aqui evita que a unificação futura das quatro estratégias
    // apague a diferença sem decisão de produto.
    expect(buscaPorTextoOuNumero(ALFA, "x11")).toBe(true);
  });

  it("não acha quando nem o texto nem os dígitos batem", () => {
    expect(buscaPorTextoOuNumero(ALFA, "zeta")).toBe(false);
  });
});

describe("buscaPorCnpjEntreParenteses", () => {
  it("acha pelo que está entre parênteses, sem pontuação", () => {
    // Isola a condição dos dígitos-entre-parênteses: "11222333" não bate no
    // rótulo com pontuação (mesma conta do teste de buscaPorTexto acima),
    // então só essa condição explica o true.
    expect(buscaPorCnpjEntreParenteses(ALFA, "11222333")).toBe(true);
  });

  it("termo com letra não vira busca numérica", () => {
    // Prova o guard `/^\d+$/.test(termo)`: sem ele, "a11" perderia a letra
    // ao normalizar ("11"), e "11" bate nos dígitos do CNPJ de ALFA — o
    // resultado viraria true. Com o guard, "a11" não é todo dígito e a
    // normalização nem roda.
    expect(buscaPorCnpjEntreParenteses(ALFA, "a11")).toBe(false);
  });

  it("opção sem parênteses não quebra", () => {
    expect(buscaPorCnpjEntreParenteses(PRODUTO, "1")).toBe(false);
  });
});

describe("buscaPorRotuloValorOuNumero", () => {
  const cliente = { valor: "11.222.333/0001-44", rotulo: "Alfa Mineração" };

  it("acha pelo rótulo", () => {
    // "alfa" não tem dígito (soDigitos = "") e não é substring do valor, só
    // do rótulo — isola a condição 1 das outras duas.
    expect(buscaPorRotuloValorOuNumero(cliente, "alfa")).toBe(true);
  });

  it("acha pelos dígitos do valor, ignorando a pontuação do termo", () => {
    // "11222333" (sem pontuação) não é substring literal do valor pontuado
    // ("11.222.333/..."), então só a condição dos dígitos explica o true —
    // é a mesma prova do teste de Clientes na Task 5.
    expect(buscaPorRotuloValorOuNumero(cliente, "11222333")).toBe(true);
  });

  it("não acha o que não está em nenhum dos dois", () => {
    expect(buscaPorRotuloValorOuNumero(cliente, "zeta")).toBe(false);
  });

  // ── A CONDIÇÃO DO VALOR CRU, ISOLADA DE VERDADE ──────────────────────────
  // "11.222" pareceria provar a condição do valor cru (é substring do valor
  // pontuado), mas NÃO isola nada: soDigitos("11.222") = "11222", e "11222"
  // TAMBÉM é substring de soDigitos(valor) = "11222333000144" — a condição
  // dos dígitos já acharia sozinha. Apagar só a condição do valor cru
  // não derrubaria um teste escrito assim, e é exatamente o tipo de teste
  // que passa por acidente que a Task 7 pediu para evitar.
  //
  // Isolar de verdade exige um termo com dígito zero — só assim a condição 3
  // (que exige `digitosDoTermo.length > 0`) fica fora da jogada. Por isso o
  // fixture abaixo tem uma letra no valor que não está no rótulo: é a forma
  // de opção que Estoque produziria (código "P2", com letra) se usasse esta
  // estratégia — o caso que justifica manter a condição, descrito no
  // comentário de `buscaDeMultiSelect.ts`.
  it("acha pelo valor cru quando o termo não tem dígito (o caso que Estoque justifica)", () => {
    const opcaoComLetraNoValor = { valor: "P2", rotulo: "Tubo descartável" };

    // "p" não está no rótulo ("tubo descartável" não tem a letra p) e não
    // tem dígito — só a condição do valor cru explica o true.
    expect(buscaPorRotuloValorOuNumero(opcaoComLetraNoValor, "p")).toBe(true);
  });
});
