import { dataDeCalendario, diaLocal } from "../../lib/datas";
import type { NotaLocacao } from "../../services/notasapi";

/**
 * A conta da tela de Locação, separada da tela.
 *
 * Tudo aqui é função pura sobre a lista de notas que a API devolve: os três
 * KPIs, o que a busca casa, a ordem das linhas e as colunas da planilha.
 * A tela só decide quando chamar cada uma.
 */

export type CampoOrdenavel = "numero" | "data_emissao" | "cliente" | "valor";
export type Direcao = "asc" | "desc";

export interface Ordenacao {
  campo: CampoOrdenavel;
  direcao: Direcao;
}

/** Coluna e direção com que a tela abre: emissão, da mais nova para a mais antiga. */
export const ORDENACAO_INICIAL: Ordenacao = {
  campo: "data_emissao",
  direcao: "desc",
};

/**
 * O `valor_nota` chega como número, como string ou como `null`, conforme o
 * campo do Tiny. `parseFloat` para no primeiro caractere que não cabe num
 * número — então "1.234,56" vira 1,234, e não 1234,56. É o comportamento
 * que a tela sempre teve e que o teste de caracterização fixa; trocá-lo
 * mudaria valores já conferidos por gente.
 */
export function paraNumero(valor: number | string | null | undefined): number {
  if (valor == null) return 0;
  const numero = typeof valor === "number" ? valor : parseFloat(String(valor));
  return isNaN(numero) ? 0 : numero;
}

/** Número em reais, sem o "R$" — quem chama decide se põe o símbolo. */
export function emReais(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * "2026-07-10" e "2026-07-10T14:57:00" viram "10/07/2026".
 *
 * A regra em si mora em `src/lib/datas.ts` desde que a tela de Usuários
 * passou a precisar dela para o `created_at`: é a mesma conversão feita na
 * string, sem passar por `Date`, porque `new Date("2026-07-10")` é lido como
 * meia-noite em UTC — no Brasil, o dia anterior. Aqui fica só o nome que a
 * Locação usa, para não haver duas cópias da regra em telas diferentes.
 */
export const dataDaNota = dataDeCalendario;

export interface ResumoDeLocacao {
  /** Soma do valor de todas as notas. */
  total: number;
  quantidade: number;
  /** Total dividido pela quantidade; zero quando não há nota. */
  ticketMedio: number;
}

/**
 * Os três KPIs do topo. Recebe a lista INTEIRA, não a filtrada: os números
 * do topo descrevem a base de locação, e não o recorte que a busca deixou
 * na tabela.
 */
export function resumirLocacao(notas: NotaLocacao[]): ResumoDeLocacao {
  const total = notas.reduce(
    (acc, nota) => acc + paraNumero(nota.valor_nota),
    0,
  );
  const quantidade = notas.length;
  return {
    total,
    quantidade,
    ticketMedio: quantidade > 0 ? total / quantidade : 0,
  };
}

/**
 * Busca livre sobre cliente, CNPJ, número da nota, vendedor e valor.
 *
 * O valor é comparado pelo número cru (`String(49000)` → "49000"), não pelo
 * que a tela mostra ("R$ 49.000,00"): quem digita "49.000,00" não acha nada.
 * Situação, natureza da operação e data ficam de fora da varredura.
 */
export function filtrarNotas(
  notas: NotaLocacao[],
  pesquisa: string,
): NotaLocacao[] {
  if (!pesquisa) return [...notas];

  const termo = pesquisa.toLowerCase();
  return notas.filter((nota) => {
    const nome = nota.cliente?.nome?.toLowerCase() || "";
    const cnpj = nota.cliente?.cpf_cnpj?.toLowerCase() || "";
    const numero = (nota.numero || "").toLowerCase();
    const vendedor = (nota.nome_vendedor || "").toLowerCase();
    return (
      nome.includes(termo) ||
      cnpj.includes(termo) ||
      numero.includes(termo) ||
      vendedor.includes(termo) ||
      String(paraNumero(nota.valor_nota)).includes(termo)
    );
  });
}

/** Valor comparável de cada coluna ordenável. */
const CHAVE_DE_ORDEM: Record<
  CampoOrdenavel,
  (nota: NotaLocacao) => number | string
> = {
  data_emissao: (nota) => new Date(nota.data_emissao).getTime(),
  cliente: (nota) => nota.cliente?.nome || "",
  valor: (nota) => paraNumero(nota.valor_nota),
  numero: (nota) => nota.numero || "",
};

/**
 * Ordena por uma das quatro colunas, sem mexer na lista original.
 *
 * Empate devolve 0, e o `Array.prototype.sort` é estável — então o bloco
 * empatado sai na ordem em que a API mandou as notas. Ordenar por cliente
 * não embaralha as notas de um mesmo cliente, que é o que quem usa espera.
 *
 * Antes o comparador era `x > y ? 1 : -1`, que nunca devolve 0: para dois
 * valores iguais ele respondia "o primeiro vem antes" nas duas perguntas —
 * `comparar(a, b)` e `comparar(b, a)` com o mesmo sinal, uma contradição. O
 * bloco empatado saía invertido em relação à API, e com empate total as duas
 * direções devolviam a mesma sequência: clicar na seta não movia nada.
 *
 * Com empate total as duas direções continuam devolvendo a mesma sequência —
 * agora a da API, e não mais a dela ao contrário. Isso não é resto do
 * defeito: sem nada que distinga uma nota da outra na coluna ordenada, não
 * existe segunda ordem para a seta mostrar.
 */
export function ordenarNotas(
  notas: NotaLocacao[],
  { campo, direcao }: Ordenacao,
): NotaLocacao[] {
  const chave = CHAVE_DE_ORDEM[campo];
  const sentido = direcao === "asc" ? 1 : -1;
  return [...notas].sort((a, b) => {
    const x = chave(a);
    const y = chave(b);
    if (x === y) return 0;
    return x > y ? sentido : -sentido;
  });
}

/**
 * Para onde a ordenação vai quando alguém clica num cabeçalho: coluna nova
 * entra em decrescente; clicar de novo na mesma coluna alterna a direção.
 */
export function proximaOrdenacao(
  atual: Ordenacao,
  campo: CampoOrdenavel,
): Ordenacao {
  return {
    campo,
    direcao: atual.campo === campo && atual.direcao === "desc" ? "asc" : "desc",
  };
}

export type TomDaSituacao = "success" | "warning" | "danger" | "muted";

/**
 * Cor do selo de situação. O rótulo continua carregando o significado — a
 * cor só o reforça, como o design system exige.
 *
 * O mapa é curto de propósito: só as palavras cujo sentido é inequívoco no
 * vocabulário do Tiny. Qualquer outra situação ("Emitida DANFE",
 * "Autorizada", "Registrada"...) fica em `success`, que é a cor que a tela
 * usava para todas antes desta migração.
 */
export function tomDaSituacao(
  situacao: string | null | undefined,
): TomDaSituacao {
  if (!situacao) return "muted";
  const texto = situacao.toLowerCase();
  if (/cancel|denegad|rejeit/.test(texto)) return "danger";
  if (/aguard|pendent/.test(texto)) return "warning";
  return "success";
}

/**
 * Uma linha da planilha — as sete colunas exportadas, nesta ordem.
 *
 * É `type`, e não `interface`, porque só alias de tipo ganha índice de string
 * implícito — sem isso o TypeScript recusa passá-la onde `baixarPlanilha` pede
 * `Record<string, unknown>[]`, e a alternativa seria abrir a interface para
 * chave arbitrária, perdendo o travamento das sete colunas.
 */
export type LinhaDaPlanilha = {
  Número: string;
  Data: string;
  Cliente: string;
  CNPJ: string;
  Valor: number;
  Situação: string;
  Vendedor: string;
};

/**
 * As linhas que vão para o Excel — exatamente as que estão na tabela, no
 * recorte e na ordem em que a pessoa as deixou.
 *
 * A coluna "Data" é a MESMA `dataDaNota` que a tela usa, de propósito: a
 * data de emissão é data de calendário, sem instante e sem fuso, e quem
 * abre a planilha espera ler ali o dia que viu na tela. Antes ela passava
 * por `new Date(...).toLocaleDateString("pt-BR")`, que lê "2026-07-10" como
 * meia-noite em UTC — a oeste de Greenwich isso é o dia anterior, e a
 * planilha saía com 09/07/2026 onde a tela mostrava 10/07/2026.
 */
export function linhasDaPlanilha(notas: NotaLocacao[]): LinhaDaPlanilha[] {
  return notas.map((nota) => ({
    Número: nota.numero || "",
    Data: dataDaNota(nota.data_emissao),
    Cliente: nota.cliente?.nome || "",
    CNPJ: nota.cliente?.cpf_cnpj || "",
    Valor: paraNumero(nota.valor_nota),
    Situação: nota.descricao_situacao || "",
    Vendedor: nota.nome_vendedor || "",
  }));
}

/**
 * Nome do arquivo exportado — `locacao_AAAA-MM-DD.xlsx`.
 *
 * A data é o DIA LOCAL. Saía de `toISOString` (UTC), e a partir das 21h de
 * Brasília o arquivo já ia arquivado com a data do dia seguinte. Locação foi a
 * última das sete a cair porque tinha teste — e o teste pregava o defeito: o
 * instante escolhido era meio-dia, que cai no mesmo dia nos dois fusos.
 */
export function nomeDoArquivo(hoje: Date = new Date()): string {
  return `locacao_${diaLocal(hoje)}.xlsx`;
}

/** Nome da aba dentro da planilha. */
export const ABA_DA_PLANILHA = "Locação";
