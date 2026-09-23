import { describe, expect, it } from "vitest";

import type { ResumoDeServicos } from "../../services/notasapi";
import {
  cidadesDoResumo,
  evolucaoDoResumo,
  kpisDoResumo,
  linhasDaPlanilha,
  linhasDoPdf,
  proximaOrdenacao,
  rankingDoResumo,
  recorteDeServicos,
  type Servico,
} from "./servicos";

/**
 * A conta pura de Serviços, testada como conta.
 *
 * Os cinco arquivos `Servicos.*.test.tsx` caracterizam a tela renderizada —
 * filtros, KPIs, gráfico e tabela pelo que a pessoa vê. Aqui ficam as bordas
 * que a tela não exercita: resumo vazio, o corte do top dez, a troca para
 * escala anual acima de 24 meses e a ordem das colunas da planilha.
 *
 * ⚠️ Toda asserção de mapeamento usa valores DISTINTOS campo a campo. A lição
 * de Produtos é que uma troca simétrica entre dois campos mantém o conjunto de
 * valores e escapa de qualquer asserção que só olhe o conjunto: com `1` e `2`
 * repetidos, trocar `faturamento` com `ticket_medio` passaria verde.
 */

const SERVICO_BASE: Servico = {
  id: 1,
  numero_nfse: 1001,
  data_emissao: "2026-01-10",
  valor_servico: 100,
  razao_social_tomador: "Cliente A",
  cpf_cnpj_tomador: "11.222.333/0001-44",
  cidade_tomador: "Recife",
  uf_tomador: "PE",
  discriminacao_servico: "Calibração de bafômetro",
};

/**
 * O serviço emitido na virada do ano — a fixture das duas exportações.
 *
 * `"2026-01-01"` é uma data de calendário sem hora, e o ECMAScript lê essa
 * forma como **meia-noite em UTC**: é o pior caso possível, o instante exato
 * da virada. Em `TZ=America/Sao_Paulo` (UTC-3) essa meia-noite ainda é
 * 31/12/2025 — o defeito trocava o dia, o mês E o ano de uma vez, e é por
 * isso que a data escolhida é 1º de janeiro e não uma do meio do mês: a
 * falha fica impossível de confundir com arredondamento.
 *
 * ⚠️ **Em `TZ=UTC` o defeito não aparece** — meia-noite UTC lida em UTC é o
 * dia certo, e nenhuma fixture muda isso, porque o erro só existe a oeste de
 * Greenwich. Quem cobre este teste é a regra da suíte de rodar nos dois fusos
 * (`TZ=UTC npm test` e `TZ=America/Sao_Paulo npm test`): a asserção vale nos
 * dois — a propriedade afirmada é "o dia que a string diz", que não muda de
 * fuso para fuso —, e com o defeito de volta ela cai no segundo.
 */
const SERVICO_NA_VIRADA: Servico = {
  ...SERVICO_BASE,
  id: 2,
  numero_nfse: 1002,
  data_emissao: "2026-01-01",
};

const RESUMO_BASE: ResumoDeServicos = {
  kpis: { faturamento: 0, notas: 0, ticket_medio: 0 },
  evolucao_mensal: [],
  por_cliente: [],
  por_cidade: [],
  opcoes: { clientes: [], cidades: [], tipos: [] },
};

describe("recorteDeServicos", () => {
  it("renomeia os cinco campos sem trocar nenhum de lugar", () => {
    // Os três primeiros são `string[]` e os dois últimos `string`: com
    // conteúdo distinto em cada um, trocar dois de lugar — mesmo em par —
    // derruba as duas pontas.
    const recorte = recorteDeServicos({
      cliente: ["Alfa (11.222.333/0001-44)"],
      cidade: ["Recife/PE"],
      tipoServico: ["Calibração de bafômetro"],
      dataInicio: "2026-01-01",
      dataFim: "2026-02-28",
    });

    expect(recorte).toEqual({
      clientes: ["Alfa (11.222.333/0001-44)"],
      cidades: ["Recife/PE"],
      tipos: ["Calibração de bafômetro"],
      dataInicio: "2026-01-01",
      dataFim: "2026-02-28",
    });
  });
});

describe("kpisDoResumo", () => {
  it("cada numero do resumo vai para o KPI correspondente", () => {
    // Os três números são distintos entre si de propósito: trocar
    // `faturamento` com `ticket_medio` (a troca simétrica clássica) muda os
    // dois lados desta asserção.
    const kpis = kpisDoResumo({
      ...RESUMO_BASE,
      kpis: { faturamento: 2200, notas: 3, ticket_medio: 733.33 },
      por_cliente: [
        { nome: "Alfa Mineração", valor: 1700, notas: 2 },
        { nome: "Beta Logística", valor: 500, notas: 1 },
      ],
    });

    expect(kpis).toEqual({
      totalFaturado: 2200,
      totalServicos: 3,
      ticketMedio: 733.33,
      topCliente: { nome: "Alfa Mineração", valor: 1700 },
    });
  });

  it("com o resumo sem cliente nenhum, topCliente e nulo", () => {
    // O cartão do topo mostra "N/A" nesse caso. Sem a guarda, `por_cliente[0]`
    // seria `undefined` e ler `.nome` estouraria a tela inteira.
    expect(kpisDoResumo(RESUMO_BASE).topCliente).toBeNull();
  });
});

describe("evolucaoDoResumo", () => {
  it("rotula cada mes em portugues e mantem a ordem do resumo", () => {
    const pontos = evolucaoDoResumo([
      { ano: 2026, mes: 1, total: 1000, notas: 2 },
      { ano: 2026, mes: 12, total: 700, notas: 1 },
    ]);

    // O rótulo prova o mês CERTO: `mes - 1` é o índice do `Date`, e somar em
    // vez de subtrair jogaria janeiro em fevereiro.
    expect(pontos.map((p) => p.mes)).toEqual(["jan. de 2026", "dez. de 2026"]);
    expect(pontos.map((p) => p.total)).toEqual([1000, 700]);
    expect(pontos.map((p) => p.ano)).toEqual([2026, 2026]);
    expect(pontos[0].ordem).toBeLessThan(pontos[1].ordem);
  });

  it("passando de 24 meses, troca a escala mensal pela anual", () => {
    // 30 meses seguidos, a partir de janeiro de 2024: dois anos cheios e seis
    // meses de 2026. Um gráfico com 30 rótulos mensais fica ilegível, e é essa
    // a decisão de desenho que sobreviveu à mudança de fonte.
    const meses = Array.from({ length: 30 }, (_, i) => ({
      ano: 2024 + Math.floor(i / 12),
      mes: (i % 12) + 1,
      total: 10,
      notas: 1,
    }));

    const pontos = evolucaoDoResumo(meses);

    expect(pontos.map((p) => p.mes)).toEqual(["2024", "2025", "2026"]);
    expect(pontos.map((p) => p.total)).toEqual([120, 120, 60]);
  });

  it("com 24 meses exatos, continua mensal", () => {
    // A borda: o `if` é `> 24`, então 24 ainda desenha mês a mês.
    const meses = Array.from({ length: 24 }, (_, i) => ({
      ano: 2024 + Math.floor(i / 12),
      mes: (i % 12) + 1,
      total: 10,
      notas: 1,
    }));

    expect(evolucaoDoResumo(meses)).toHaveLength(24);
  });
});

describe("rankingDoResumo", () => {
  it("corta em dez clientes, preservando a ordem que o banco mandou", () => {
    const porCliente = Array.from({ length: 12 }, (_, i) => ({
      nome: `Cliente ${String(i + 1).padStart(2, "0")}`,
      valor: 1200 - i * 100,
      notas: 1,
    }));

    const ranking = rankingDoResumo(porCliente);

    expect(ranking).toHaveLength(10);
    expect(ranking[0]).toEqual({
      cliente: "Cliente 01",
      clienteCompleto: "Cliente 01",
      valor: 1200,
    });
    expect(ranking[9].clienteCompleto).toBe("Cliente 10");
  });

  it("nome com mais de 20 caracteres sai cortado no eixo, inteiro no tooltip", () => {
    // 26 caracteres: o eixo do gráfico tem 140px, e o nome inteiro estoura.
    const nome = "Mineração Santa Luzia Ltda";
    expect(nome).toHaveLength(26);

    const [barra] = rankingDoResumo([{ nome, valor: 900, notas: 3 }]);

    expect(barra.cliente).toBe("Mineração Santa Luzi...");
    expect(barra.clienteCompleto).toBe(nome);
  });

  it("nome com 20 caracteres exatos nao ganha reticencias", () => {
    // A borda: o corte é `> 20`, então 20 passa inteiro.
    const nome = "Mineração Santa Luz.";
    expect(nome).toHaveLength(20);

    expect(rankingDoResumo([{ nome, valor: 1, notas: 1 }])[0].cliente).toBe(
      nome,
    );
  });
});

describe("cidadesDoResumo", () => {
  it("corta em dez cidades e renomeia os dois campos para o que a pizza le", () => {
    const porCidade = Array.from({ length: 11 }, (_, i) => ({
      nome: `Cidade ${String(i + 1).padStart(2, "0")}/PE`,
      valor: 1100 - i * 100,
      notas: 1,
    }));

    const fatias = cidadesDoResumo(porCidade);

    expect(fatias).toHaveLength(10);
    expect(fatias[0]).toEqual({ name: "Cidade 01/PE", value: 1100 });
    expect(fatias[9]).toEqual({ name: "Cidade 10/PE", value: 200 });
  });
});

describe("proximaOrdenacao", () => {
  // Quatro casos, e não dois, porque as duas quebras plausíveis são
  // diferentes: "campo novo começa em asc" só aparece quando o campo muda, e
  // "o mesmo campo não inverte" só aparece quando o campo se repete. Um teste
  // que exercitasse apenas a troca de campo passaria verde com a inversão
  // quebrada, e vice-versa.

  it("clicar num campo diferente comeca em desc, vindo de desc", () => {
    expect(
      proximaOrdenacao({ campo: "data_emissao", direcao: "desc" }, "numero"),
    ).toEqual({ campo: "numero", direcao: "desc" });
  });

  it("clicar num campo diferente comeca em desc tambem vindo de asc", () => {
    // Sem este caso, uma implementação que sempre inverte a direção (ignorando
    // qual campo estava ordenado) passaria pelo caso acima: `desc` invertido
    // daria `asc`... e o caso acima morreria, mas este é o que prende a regra
    // pelo outro lado — o primeiro clique numa coluna é SEMPRE decrescente,
    // não importa como a coluna anterior estava.
    expect(
      proximaOrdenacao({ campo: "data_emissao", direcao: "asc" }, "numero"),
    ).toEqual({
      campo: "numero",
      direcao: "desc",
    });
  });

  it("clicar de novo no mesmo campo em desc inverte para asc", () => {
    expect(
      proximaOrdenacao({ campo: "numero", direcao: "desc" }, "numero"),
    ).toEqual({
      campo: "numero",
      direcao: "asc",
    });
  });

  it("clicar de novo no mesmo campo em asc volta para desc", () => {
    expect(
      proximaOrdenacao({ campo: "numero", direcao: "asc" }, "numero"),
    ).toEqual({
      campo: "numero",
      direcao: "desc",
    });
  });
});

describe("linhasDaPlanilha", () => {
  it("exporta as sete colunas, na ordem em que a tela as mostrava", () => {
    const linha = linhasDaPlanilha([SERVICO_BASE])[0];

    expect(Object.keys(linha)).toEqual([
      "Número NFS-e",
      "Cliente",
      "CNPJ/CPF",
      "Data Emissão",
      "Cidade",
      "Valor",
      "Descrição",
    ]);
  });

  it("cada campo do servico vai para a coluna que leva o nome dele", () => {
    // Uma asserção só, com os sete pares. Aqui havia três parciais — `Valor`,
    // `Cliente` e `Cidade` —, e as outras quatro colunas ficavam sem valor
    // afirmado: trocar `"Número NFS-e"` com `Descrição` em `linhasDaPlanilha`
    // mandava "Calibração de bafômetro" na coluna do número e o 1001 na da
    // descrição, e a suíte inteira ficava verde. Essa planilha sai por
    // e-mail para o cliente.
    //
    // Os sete valores são distintos entre si de propósito: com valor
    // repetido, uma troca simétrica entre duas colunas manteria o conjunto e
    // escaparia. `toEqual` sobre o objeto inteiro fecha também o outro lado —
    // uma coluna a mais ou a menos derruba.
    expect(linhasDaPlanilha([SERVICO_BASE])[0]).toEqual({
      "Número NFS-e": 1001,
      Cliente: "Cliente A",
      "CNPJ/CPF": "11.222.333/0001-44",
      "Data Emissão": "10/01/2026",
      Cidade: "Recife/PE",
      Valor: 100,
      Descrição: "Calibração de bafômetro",
    });
  });

  it("a data de emissao e o dia que a string diz, em qualquer fuso", () => {
    // Duas datas distintas, e não uma: uma função que devolvesse a data fixa
    // passaria com uma só. A da virada é a que carrega a prova (ver o
    // docblock de SERVICO_NA_VIRADA); a outra guarda o caso comum.
    const datas = linhasDaPlanilha([SERVICO_BASE, SERVICO_NA_VIRADA]).map(
      (linha) => linha["Data Emissão"],
    );

    // Uma asserção só, com as duas: assim a falha mostra as duas datas de
    // uma vez em vez de parar na primeira.
    expect(datas).toEqual(["10/01/2026", "01/01/2026"]);
  });

  it("nota sem data sai com travessao, e nao com Invalid Date", () => {
    // O conserto de fuso mudou também este caso, e sem menção nenhuma:
    // `new Date("").toLocaleDateString("pt-BR")` imprimia `Invalid Date` na
    // célula, e `dataDeCalendario` devolve `—`. É melhoria, e a certa — um
    // travessão diz "não tem" e "Invalid Date" diz "o programa se perdeu" —,
    // mas era mudança de comportamento sem prova. Fica aqui.
    const [linha] = linhasDaPlanilha([{ ...SERVICO_BASE, data_emissao: "" }]);

    expect(linha["Data Emissão"]).toBe("—");
  });

  it.each([
    ["sem cidade e sem UF", "—", null, null],
    ["so com a UF", "MG", null, "MG"],
    ["so com a cidade", "Recife", "Recife", null],
  ])(
    "nota %s sai com %s na cidade, e nao com null",
    (_caso, esperado, cidade, uf) => {
      // A API devolve `cidade_tomador: null` em toda NFS-e de 2025 e em 868 das
      // 1133 de 2026 (a importação parou de trazer o campo). A template string
      // `${cidade}/${uf}` imprimia "null/null" nas 57 linhas de uma planilha de
      // setembro — conferido abrindo o arquivo em 15/09. Os três casos, e não só
      // o dos dois nulos: uma função que devolvesse sempre "—" passaria com um.
      const [linha] = linhasDaPlanilha([
        { ...SERVICO_BASE, cidade_tomador: cidade, uf_tomador: uf },
      ]);

      expect(linha.Cidade).toBe(esperado);
    },
  );
});

/**
 * `linhasDoPdf` não tinha cobertura nenhuma até aqui — o movimento a trouxe
 * de `Servicos.tsx` e o único teste que a tocava era o da tela, que não abre
 * o PDF. Entra junto do conserto de fuso porque é uma das duas saídas em que
 * o defeito aparecia.
 */
describe("linhasDoPdf", () => {
  it("as cinco colunas saem na ordem do cabecalho do relatorio", () => {
    // O cabeçalho do `autoTable` (em `Servicos.tsx`, símbolo `exportarPDF`) é
    // ["NFS-e", "Cliente", "Data", "Valor", "Cidade"] — a cidade vem DEPOIS
    // do valor aqui, ao contrário da planilha. Cada campo tem valor distinto,
    // então trocar duas colunas de lugar derruba as duas pontas.
    expect(linhasDoPdf([SERVICO_BASE])[0]).toEqual([
      1001,
      "Cliente A",
      "10/01/2026",
      "R$ 100,00",
      "Recife/PE",
    ]);
  });

  it("a data de emissao e o dia que a string diz, em qualquer fuso", () => {
    // Mesma prova de `linhasDaPlanilha` acima, e mesmo motivo: a data não
    // pode passar por `new Date`, senão `TZ=America/Sao_Paulo` imprime o dia
    // anterior — aqui, 31/12/2025.
    const datas = linhasDoPdf([SERVICO_BASE, SERVICO_NA_VIRADA]).map(
      (linha) => linha[2],
    );

    expect(datas).toEqual(["10/01/2026", "01/01/2026"]);
  });

  it("corta em 30 linhas, mesmo com mais servicos no recorte", () => {
    // Limite herdado do relatório original: um PDF com centenas de linhas de
    // tabela era o problema que o corte evitava.
    const servicos: Servico[] = Array.from({ length: 35 }, (_, indice) => ({
      ...SERVICO_BASE,
      id: indice + 1,
    }));

    expect(linhasDoPdf(servicos)).toHaveLength(30);
  });

  it("nota sem cidade e sem UF sai com travessao, e nao com null/null", () => {
    // Mesmo defeito da planilha, na quinta coluna: o PDF de 15/09 saiu com
    // "null/null" nas 30 linhas.
    const [linha] = linhasDoPdf([
      { ...SERVICO_BASE, cidade_tomador: null, uf_tomador: null },
    ]);

    expect(linha[4]).toBe("—");
  });
});
