import type {
  FiltrosComerciais,
  ResumoComercial,
} from "../../services/notasapi";
import type { RecorteComercial } from "../comercial/useComercial";
import { RESUMO_FALSO } from "../comercial/hooksFalsos";

/**
 * A carteira de mentira dos testes de caracterização de Clientes.
 *
 * O "hoje" dos testes é **15/09/2026 às 15h, hora local** (`HOJE_CLIENTES`), e o
 * limite dos noventa dias é o dia 17/06/2026, inteiro. Doze clientes, já na ordem
 * em que o banco devolve (`valor` decrescente):
 *
 * | #  | nome                        | valor     | notas | última compra | status   |
 * |----|-----------------------------|-----------|-------|---------------|----------|
 * | 1  | Alfa Mineração Recife Ltda  | 50.000,50 | 4     | 10/09/2026    | ativo    |
 * | 2  | Beta Logística              | 30.000    | 3     | 20/01/2026    | inativo  |
 * | 3  | (sem nome)                  | 20.000    | 2     | 17/06/2026    | ativo    |
 * | 4  | Gama Saúde                  | 15.000    | 5     | 18/06/2026    | ativo    |
 * | 5  | Delta Engenharia            | 9.000     | 1     | nunca         | inativo  |
 * | 6…12 | Cliente 06 … Cliente 12   | 940 … 880 | 2     | 16/08 … 22/08 | ativo    |
 *
 * - O nome do 1 passa de 20 caracteres: o eixo e a barra cortam, o balão não.
 * - O 3 comprou exatamente no dia do limite, e o 4 no dia seguinte: a borda dos
 *   noventa dias. Os dois são ativos; no dia 16/09 o 3 passa a inativo.
 * - Doze clientes para o Top 10 ter o que cortar (o 11 e o 12 ficam fora).
 * - `kpis.faturamento` (123.456,78) é diferente da soma do `por_cliente`: o
 *   "Faturamento Total" das estatísticas lê o KPI, e trocar pela soma derruba.
 *
 * Contas que os testes afirmam: 9 ativos e 3 inativos; ticket médio por cliente
 * = média dos doze tickets = 3.973,76; 29 notas; 75% de ativação.
 *
 * ⚠️ Não é `.test`: é importado de dentro de fábrica de `vi.mock`, que roda antes
 * dos imports do arquivo de teste — por isso o `await import(...)` lá.
 */

export const HOJE_CLIENTES = new Date(2026, 8, 15, 15, 0, 0);

const cliente = (
  documento: string,
  nome: string | null,
  cpf_cnpj: string | null,
  valor: number,
  notas: number,
  ultima_compra: string | null,
  contato: { email?: string; fone?: string } = {},
): ResumoComercial["por_cliente"][number] => ({
  documento,
  nome,
  cpf_cnpj,
  email: contato.email ?? null,
  fone: contato.fone ?? null,
  valor,
  valor_produtos: 1,
  notas,
  ultima_compra,
});

export const RESUMO_CLIENTES: ResumoComercial = {
  ...RESUMO_FALSO,
  kpis: { ...RESUMO_FALSO.kpis, faturamento: 123456.78, notas: 29 },
  por_cliente: [
    cliente(
      "11222333000144",
      "Alfa Mineração Recife Ltda",
      "11.222.333/0001-44",
      50000.5,
      4,
      "2026-09-10",
      { email: "compras@alfa.com", fone: "81999990000" },
    ),
    cliente(
      "55666777000188",
      "Beta Logística",
      "55.666.777/0001-88",
      30000,
      3,
      "2026-01-20",
      { fone: "8133334444" },
    ),
    cliente("12345678901", null, "123.456.789-01", 20000, 2, "2026-06-17", {
      email: "pessoa@exemplo.com",
    }),
    cliente(
      "99888777000166",
      "Gama Saúde",
      "99.888.777/0001-66",
      15000,
      5,
      "2026-06-18",
    ),
    cliente(
      "44333222000111",
      "Delta Engenharia",
      "44.333.222/0001-11",
      9000,
      1,
      null,
    ),
    ...Array.from({ length: 7 }, (_, i) => {
      const n = i + 6;
      return cliente(
        `000000000000${n}`,
        `Cliente ${String(n).padStart(2, "0")}`,
        `00.000.000/0000-${String(n).padStart(2, "0")}`,
        1000 - n * 10,
        2,
        `2026-08-${10 + n}`,
      );
    }),
  ],
};

/**
 * As opções dos filtros. Dois cadastros com o MESMO documento da Alfa (ids 1 e
 * 7): o multiselect junta os dois numa opção só, e o recorte tem de mandar os
 * dois ids. Um produto sem código, que vira "(sem código)" no rótulo e
 * `#Brinde` na chave.
 */
export const OPCOES_CLIENTES: FiltrosComerciais = {
  clientes: [
    {
      id: 1,
      nome: "Alfa Mineração Recife Ltda",
      cpf_cnpj: "11.222.333/0001-44",
    },
    { id: 2, nome: "Beta Logística", cpf_cnpj: "55.666.777/0001-88" },
    { id: 7, nome: "ALFA MINERACAO", cpf_cnpj: "11.222.333/0001-44" },
  ],
  vendedores: ["Vendedor A", "Vendedor B"],
  produtos: [
    { chave: "K1", codigo: "K1", descricao: "Kit bocal", valor: 0 },
    { chave: "#Brinde", codigo: null, descricao: "Brinde", valor: 0 },
  ],
};

/** O que cada teste liga e desliga, e os recortes que a tela pediu. */
export const ESTADO_CLIENTES = {
  carregando: false,
  vazio: false,
  erro: null as string | null,
  /** Um resumo no lugar de `RESUMO_CLIENTES`. Tem de ser um objeto fixo do
   *  arquivo de teste, e não montado a cada render (ver `hooksDeClientes`). */
  resumo: null as ResumoComercial | null,
  recortes: [] as RecorteComercial[],
};

export function reiniciarEstadoDeClientes() {
  ESTADO_CLIENTES.carregando = false;
  ESTADO_CLIENTES.vazio = false;
  ESTADO_CLIENTES.erro = null;
  ESTADO_CLIENTES.resumo = null;
  ESTADO_CLIENTES.recortes.length = 0;
}

/**
 * Os dois hooks do Comercial que Clientes lê. O resumo devolvido é sempre o
 * MESMO objeto (`RESUMO_CLIENTES` ou `RESUMO_FALSO`): o hook de verdade guarda
 * em estado, e uma lista nova a cada render prenderia o `usePaginacao` na
 * página 1.
 */
export function hooksDeClientes() {
  return {
    useResumoComercial: (recorte: RecorteComercial) => {
      ESTADO_CLIENTES.recortes.push(recorte);
      return {
        resumo:
          ESTADO_CLIENTES.vazio || ESTADO_CLIENTES.erro
            ? RESUMO_FALSO
            : (ESTADO_CLIENTES.resumo ?? RESUMO_CLIENTES),
        carregando: ESTADO_CLIENTES.carregando,
        atualizando: false,
        erro: ESTADO_CLIENTES.erro,
        recarregar: async () => {},
      };
    },
    useFiltrosComerciais: () => ({
      opcoes: OPCOES_CLIENTES,
      carregando: false,
    }),
  };
}
